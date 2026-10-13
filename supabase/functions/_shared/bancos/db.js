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

// PostgREST silently caps every response at `max_rows` (1000 on Supabase), and
// `.limit()` can't go past it. Reads that must be complete page with `.range()`
// until a page comes back empty. `build` returns a fresh, totally ordered query
// each time; `from` advances by what actually arrived, so a server cap smaller
// than `size` still skips nothing.
export async function readAll(build, size = 1000) {
    const out = [];
    let from = 0;
    for (;;) {
        const page = must(await build().range(from, from + size - 1)) || [];
        if (!page.length) return out;
        out.push(...page);
        from += page.length;
    }
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
            return readAll(() => sb.from('transactions').select('concept, categoria')
                .eq('user_id', userId).eq('categoria_origen', 'usuario').order('id'));
        },
        async upsertTransactions(rows) {
            for (const part of chunks(rows, 500)) {
                must(await sb.from('transactions').upsert(part, { onConflict: 'user_id,external_id' }));
            }
        },
        async listBankTransactionsInRange(userId, accountIds, { from, to }) {
            if (!accountIds.length) return [];
            return readAll(() => sb.from('transactions').select('external_id, bank_status, date')
                .eq('user_id', userId).in('bank_account_id', accountIds).gte('date', from).lte('date', to)
                .order('external_id'));
        },
        async deleteTransactionsByExternalIds(userId, externalIds) {
            for (const part of chunks(externalIds, 200)) {
                must(await sb.from('transactions').delete().eq('user_id', userId).in('external_id', part));
            }
        },
        // Only rows not yet in a transfer group: pairing ignores grouped ones anyway.
        async listRecentBankTransactions(userId, since) {
            return readAll(() => sb.from('transactions')
                .select('external_id, bank_account_id, date, amount, type, concept, transfer_group_id')
                .eq('user_id', userId).eq('source', 'banco').gte('date', since).is('transfer_group_id', null)
                .order('external_id'));
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
