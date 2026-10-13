// One sync of a link: accounts → movements (memory/rules categories) saved →
// AI categories for a capped slice, saved batch by batch → stale pendings →
// own-transfer pairs → link marked up to date. Idempotent: re-running over the
// same range neither duplicates rows nor re-categorizes settled ones.
import { INITIAL_HISTORY_DAYS, OVERLAP_DAYS, TRANSFER_WINDOW_DAYS, LINK_STATUS, AI_MAX_ROWS_PER_SYNC } from './constants.js';
import { mapAccount, mapTransaction } from './mapping.js';
import { buildMemory, categorizeLocally, applyAiCategories } from './categorize.js';
import { AI_BATCH_SIZE } from './ai.js';
import { stalePendingExternalIds } from './pending.js';
import { findOwnTransferPairs } from './transfers.js';

const DAY_MS = 86400000;
const isoDate = (d) => d.toISOString().slice(0, 10);
const addDays = (isoDay, n) => isoDate(new Date(Date.parse(isoDay) + n * DAY_MS));

// The whole history the provider may hold (up to INITIAL_HISTORY_DAYS).
export function historyWindow(now) {
    const to = isoDate(now);
    return { from: addDays(to, -INITIAL_HISTORY_DAYS), to };
}

export function syncWindow(link, now) {
    if (!link.last_synced_at) return historyWindow(now);
    return { from: addDays(isoDate(new Date(link.last_synced_at)), -OVERLAP_DAYS), to: isoDate(now) };
}

// Newest unresolved rows first, at most AI_MAX_ROWS_PER_SYNC, one AI call per
// batch; each batch is saved as soon as it is answered. Returns rows categorized.
async function categorizeWithAi(rows, { db, classify }) {
    if (!classify) return 0;
    const pending = rows.filter((r) => !r.categoria_origen)
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
        .slice(0, AI_MAX_ROWS_PER_SYNC);
    let done = 0;
    for (let i = 0; i < pending.length; i += AI_BATCH_SIZE) {
        let resolved;
        try {
            resolved = await applyAiCategories(pending.slice(i, i + AI_BATCH_SIZE), classify);
        } catch {
            break; // AI unavailable: the rest stay in "Otros" and are retried next sync.
        }
        if (resolved.length) {
            await db.upsertTransactions(resolved);
            done += resolved.length;
        }
    }
    return done;
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
    const local = categorizeLocally(fresh, { memoria });
    // Every row has the same key set (mapTransaction's), which bulk upsert needs:
    // supabase-js writes NULL for keys missing in some rows of a batch.
    // Everything is saved before the (slow) AI step, so a timeout there loses nothing.
    const rows = [...settled, ...local];
    if (rows.length) await db.upsertTransactions(rows);
    const aiCategorized = await categorizeWithAi(local, { db, classify });

    const inRange = await db.listBankTransactionsInRange(userId, accounts.map((a) => a.id), { from, to });
    const stale = stalePendingExternalIds(inRange, mapped.map((r) => r.external_id), { from, to });
    if (stale.length) await db.deleteTransactionsByExternalIds(userId, stale);

    const recent = await db.listRecentBankTransactions(userId, addDays(from, -TRANSFER_WINDOW_DAYS));
    const pairs = findOwnTransferPairs(recent.map((t) => ({ ...t, key: t.external_id })));
    for (const pair of pairs) await db.setTransferGroup(userId, pair, newId());

    // A link disconnected while this sync ran must not come back as 'valid'.
    await db.updateLinkIfActive(link.id, {
        status: LINK_STATUS.VALID,
        last_synced_at: now.toISOString(),
        last_error: null,
        updated_at: now.toISOString(),
    });

    return { accounts: accounts.length, transactions: rows.length, aiCategorized, removedPending: stale.length, transfersLinked: pairs.length };
}
