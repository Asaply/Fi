// In-memory implementation of the db.js interface for handler/sync tests.
import { TRANSFER_CATEGORY } from '../../supabase/functions/_shared/bancos/constants.js';

const byKey = (k) => (a, b) => (a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0);

// The db.js contract is that list methods return COMPLETE, totally ordered results
// (db.js pages past the server's max_rows). `maxRows` makes the fake read its own
// data in capped pages the same way, so results stay complete whatever the cap.
export function createFakeBankDb({ maxRows } = {}) {
    const state = { links: [], accounts: [], transactions: [] };
    let seq = 0;
    const id = (p) => `${p}-${++seq}`;
    const complete = (rows) => {
        if (!maxRows) return rows;
        const out = [];
        for (let from = 0; ; from += maxRows) {
            const page = rows.slice(from, from + maxRows);
            if (!page.length) return out;
            out.push(...page);
        }
    };

    return {
        state,
        async countActiveLinks(userId) {
            return state.links.filter((l) => l.user_id === userId && l.status !== 'disconnected').length;
        },
        async getLinkById(linkId) { return state.links.find((l) => l.id === linkId) || null; },
        async getLinkByProviderId(pid) { return state.links.find((l) => l.provider_link_id === pid) || null; },
        async insertLink(row) { const r = { id: id('link'), ...row }; state.links.push(r); return r; },
        async updateLink(linkId, patch) { Object.assign(state.links.find((l) => l.id === linkId), patch); },
        async updateLinkIfActive(linkId, patch) {
            const link = state.links.find((l) => l.id === linkId);
            if (link && link.status !== 'disconnected') Object.assign(link, patch);
        },
        async listUserLinks(userId, { includeDisconnected = false } = {}) {
            return state.links.filter((l) => l.user_id === userId && (includeDisconnected || l.status !== 'disconnected'));
        },
        async upsertAccounts(rows) {
            return rows.map((row) => {
                const existing = state.accounts.find((a) => a.user_id === row.user_id && a.provider_account_id === row.provider_account_id);
                if (existing) return Object.assign(existing, row);
                const r = { id: id('acc'), ...row };
                state.accounts.push(r);
                return r;
            });
        },
        async setAccountsConnected(linkId, connected) {
            state.accounts.filter((a) => a.link_id === linkId).forEach((a) => { a.connected = connected; });
        },
        async getTransactionsByExternalIds(userId, ids) {
            return state.transactions
                .filter((t) => t.user_id === userId && ids.includes(t.external_id))
                .map(({ external_id, client, categoria, categoria_origen, transfer_group_id }) => ({ external_id, client, categoria, categoria_origen, transfer_group_id }));
        },
        async listUserCategorized(userId) {
            return complete(state.transactions.filter((t) => t.user_id === userId && t.categoria_origen === 'usuario')
                .sort(byKey('id')).map(({ concept, categoria }) => ({ concept, categoria })));
        },
        async upsertTransactions(rows) {
            for (const row of rows) {
                const existing = state.transactions.find((t) => t.user_id === row.user_id && t.external_id === row.external_id);
                if (existing) Object.assign(existing, row);
                else state.transactions.push({ id: id('tx'), ...row });
            }
        },
        async listBankTransactionsInRange(userId, accountIds, { from, to }) {
            return complete(state.transactions
                .filter((t) => t.user_id === userId && accountIds.includes(t.bank_account_id) && t.date >= from && t.date <= to)
                .sort(byKey('external_id'))
                .map(({ external_id, bank_status, date }) => ({ external_id, bank_status, date })));
        },
        async deletePendingByExternalIds(userId, ids) {
            state.transactions = state.transactions.filter((t) => !(t.user_id === userId && t.bank_status === 'pending' && ids.includes(t.external_id)));
        },
        async listRecentBankTransactions(userId, since) {
            return complete(state.transactions
                .filter((t) => t.user_id === userId && t.source === 'banco' && t.date >= since && !t.transfer_group_id)
                .sort(byKey('external_id'))
                .map(({ external_id, bank_account_id, date, amount, type, concept, transfer_group_id }) => ({ external_id, bank_account_id, date, amount, type, concept, transfer_group_id })));
        },
        async setTransferGroup(userId, ids, groupId) {
            for (const t of state.transactions) {
                if (t.user_id !== userId || !ids.includes(t.external_id)) continue;
                t.transfer_group_id = groupId;
                if (t.categoria_origen !== 'usuario') { t.categoria = TRANSFER_CATEGORY; t.categoria_origen = 'regla'; }
            }
        },
    };
}
