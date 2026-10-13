// One sync of a link: accounts → movements → categories → stale pendings →
// own-transfer pairs → link marked up to date. Idempotent: re-running over the
// same range neither duplicates rows nor re-categorizes settled ones.
import { INITIAL_HISTORY_DAYS, OVERLAP_DAYS, TRANSFER_WINDOW_DAYS, LINK_STATUS } from './constants.js';
import { mapAccount, mapTransaction } from './mapping.js';
import { buildMemory, categorizeRows } from './categorize.js';
import { stalePendingExternalIds } from './pending.js';
import { findOwnTransferPairs } from './transfers.js';

const DAY_MS = 86400000;
const isoDate = (d) => d.toISOString().slice(0, 10);
const addDays = (isoDay, n) => isoDate(new Date(Date.parse(isoDay) + n * DAY_MS));

export function syncWindow(link, now) {
    const to = isoDate(now);
    if (!link.last_synced_at) return { from: addDays(to, -INITIAL_HISTORY_DAYS), to };
    return { from: addDays(isoDate(new Date(link.last_synced_at)), -OVERLAP_DAYS), to };
}

export async function syncLink({ db, provider, classify, link, from, to, now = new Date(), newId = () => crypto.randomUUID() }) {
    const userId = link.user_id;

    const providerAccounts = await provider.listAccounts(link.provider_link_id);
    const accounts = await db.upsertAccounts(providerAccounts.map((pa) => mapAccount(pa, { userId, linkId: link.id })));
    const accountByProviderId = new Map(accounts.map((a) => [a.provider_account_id, a]));

    const providerTx = await provider.listTransactions(link.provider_link_id, { from, to });
    const mappedAll = providerTx
        .map((pt) => {
            const account = accountByProviderId.get(pt.accountId);
            return account ? mapTransaction(pt, { userId, account, bankName: link.institution_name }) : null;
        })
        .filter((r) => r && r.amount > 0 && r.date);
    // Postgres rejects an upsert batch that hits the same (user_id, external_id) twice,
    // so keep one row per external_id: the last occurrence wins.
    const mapped = [...new Map(mappedAll.map((r) => [r.external_id, r])).values()];

    const existing = new Map((await db.getTransactionsByExternalIds(userId, mapped.map((r) => r.external_id)))
        .map((e) => [e.external_id, e]));
    const settled = [];
    const fresh = [];
    for (const r of mapped) {
        const e = existing.get(r.external_id);
        if (e?.categoria_origen) {
            settled.push({ ...r, categoria: e.categoria, categoria_origen: e.categoria_origen, transfer_group_id: e.transfer_group_id });
        } else {
            fresh.push({ ...r, transfer_group_id: e?.transfer_group_id ?? null });
        }
    }
    const memoria = buildMemory(await db.listUserCategorized(userId));
    const categorized = await categorizeRows(fresh, { memoria, classify });
    // Every row has the same key set (mapTransaction's), which bulk upsert needs:
    // supabase-js writes NULL for keys missing in some rows of a batch.
    const rows = [...settled, ...categorized];
    if (rows.length) await db.upsertTransactions(rows);

    const inRange = await db.listBankTransactionsInRange(userId, accounts.map((a) => a.id), { from, to });
    const stale = stalePendingExternalIds(inRange, mapped.map((r) => r.external_id), { from, to });
    if (stale.length) await db.deleteTransactionsByExternalIds(userId, stale);

    const recent = await db.listRecentBankTransactions(userId, addDays(from, -TRANSFER_WINDOW_DAYS));
    const pairs = findOwnTransferPairs(recent.map((t) => ({ ...t, key: t.external_id })));
    for (const pair of pairs) await db.setTransferGroup(userId, pair, newId());

    await db.updateLink(link.id, {
        status: LINK_STATUS.VALID,
        last_synced_at: now.toISOString(),
        last_error: null,
        updated_at: now.toISOString(),
    });

    return { accounts: accounts.length, transactions: rows.length, removedPending: stale.length, transfersLinked: pairs.length };
}
