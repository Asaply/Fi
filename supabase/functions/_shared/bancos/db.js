// Data access for bank sync on top of a supabase-js client (service role in
// Edge Functions). The client is injected so this file has no imports of its own
// besides constants, and tests can pass a fake.
import { TRANSFER_CATEGORY } from './constants.js';

function chunks(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

function must({ data, error }) {
    if (error) throw new Error(error.message);
    return data;
}

export function createDb(sb) {
    return {
        async countActiveLinks(userId) {
            const { count, error } = await sb.from('bank_links').select('id', { count: 'exact', head: true })
                .eq('user_id', userId).neq('status', 'disconnected');
            if (error) throw new Error(error.message);
            return count || 0;
        },
        async getLinkById(id) {
            return must(await sb.from('bank_links').select('*').eq('id', id).maybeSingle());
        },
        async getLinkByProviderId(providerLinkId) {
            return must(await sb.from('bank_links').select('*').eq('provider_link_id', providerLinkId).maybeSingle());
        },
        async insertLink(row) {
            return must(await sb.from('bank_links').insert(row).select().single());
        },
        async updateLink(id, patch) {
            must(await sb.from('bank_links').update(patch).eq('id', id));
        },
        async listUserLinks(userId, { includeDisconnected = false } = {}) {
            let q = sb.from('bank_links').select('*').eq('user_id', userId);
            if (!includeDisconnected) q = q.neq('status', 'disconnected');
            return must(await q) || [];
        },
        async upsertAccounts(rows) {
            if (!rows.length) return [];
            const stamped = rows.map((r) => ({ ...r, updated_at: new Date().toISOString() }));
            return must(await sb.from('bank_accounts').upsert(stamped, { onConflict: 'provider_account_id' }).select()) || [];
        },
        async setAccountsConnected(linkId, connected) {
            must(await sb.from('bank_accounts').update({ connected }).eq('link_id', linkId));
        },
        async getTransactionsByExternalIds(userId, externalIds) {
            const out = [];
            for (const part of chunks(externalIds, 200)) {
                out.push(...(must(await sb.from('transactions')
                    .select('external_id, categoria, categoria_origen, transfer_group_id')
                    .eq('user_id', userId).in('external_id', part)) || []));
            }
            return out;
        },
        async listUserCategorized(userId) {
            return must(await sb.from('transactions').select('concept, categoria')
                .eq('user_id', userId).eq('categoria_origen', 'usuario').limit(5000)) || [];
        },
        async upsertTransactions(rows) {
            for (const part of chunks(rows, 500)) {
                must(await sb.from('transactions').upsert(part, { onConflict: 'user_id,external_id' }));
            }
        },
        async listBankTransactionsInRange(userId, accountIds, { from, to }) {
            if (!accountIds.length) return [];
            return must(await sb.from('transactions').select('external_id, bank_status, date')
                .eq('user_id', userId).in('bank_account_id', accountIds).gte('date', from).lte('date', to)) || [];
        },
        async deleteTransactionsByExternalIds(userId, externalIds) {
            for (const part of chunks(externalIds, 200)) {
                must(await sb.from('transactions').delete().eq('user_id', userId).in('external_id', part));
            }
        },
        async listRecentBankTransactions(userId, since) {
            return must(await sb.from('transactions')
                .select('external_id, bank_account_id, date, amount, type, concept, transfer_group_id')
                .eq('user_id', userId).eq('source', 'banco').gte('date', since)) || [];
        },
        async setTransferGroup(userId, externalIds, groupId) {
            must(await sb.from('transactions').update({ transfer_group_id: groupId })
                .eq('user_id', userId).in('external_id', externalIds));
            must(await sb.from('transactions').update({ categoria: TRANSFER_CATEGORY, categoria_origen: 'regla' })
                .eq('user_id', userId).in('external_id', externalIds)
                .or('categoria_origen.is.null,categoria_origen.neq.usuario'));
        },
    };
}
