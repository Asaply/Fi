import { describe, it, expect } from 'vitest';
import { createDb, readAll } from '../../supabase/functions/_shared/bancos/db.js';

// Minimal supabase-js stand-in: records every builder call and resolves to `result`.
function recordingClient(result = { data: [], error: null, count: 0 }) {
    const calls = [];
    const client = {
        calls,
        from(table) {
            const chain = [['from', table]];
            calls.push(chain);
            const builder = new Proxy({}, {
                get(_t, prop) {
                    if (prop === 'then') return (res, rej) => Promise.resolve(result).then(res, rej);
                    return (...args) => { chain.push([prop, ...args]); return builder; };
                },
            });
            return builder;
        },
    };
    return client;
}

// Like recordingClient, but each awaited query resolves to the next page in `pages`.
function pagedClient(pages) {
    const queue = pages.map((n, p) => ({ data: Array.from({ length: n }, (_, i) => ({ id: `p${p}-${i}` })), error: null }));
    const base = recordingClient();
    let served = 0;
    const client = {
        calls: base.calls,
        get served() { return served; },
        from(table) {
            const chain = [['from', table]];
            base.calls.push(chain);
            const builder = new Proxy({}, {
                get(_t, prop) {
                    if (prop === 'then') {
                        const result = queue[served++] ?? { data: [], error: null };
                        return (res, rej) => Promise.resolve(result).then(res, rej);
                    }
                    return (...args) => { chain.push([prop, ...args]); return builder; };
                },
            });
            return builder;
        },
    };
    return client;
}

const ranges = (sb) => sb.calls.map((c) => c.find((x) => x[0] === 'range')?.slice(1));

describe('readAll', () => {
    it('concatena páginas hasta recibir una vacía', async () => {
        const sb = pagedClient([1000, 1000, 3, 0]);
        const rows = await readAll(() => sb.from('transactions').select('*').order('id'));
        expect(rows).toHaveLength(2003);
        expect(sb.served).toBe(4);
        expect(ranges(sb)).toEqual([[0, 999], [1000, 1999], [2000, 2999], [2003, 3002]]);
    });
    it('si el servidor corta por debajo del tamaño de página no se salta filas', async () => {
        const sb = pagedClient([500, 500, 0]);
        const rows = await readAll(() => sb.from('transactions').select('*'));
        expect(rows).toHaveLength(1000);
        expect(ranges(sb)).toEqual([[0, 999], [500, 1499], [1000, 1999]]);
    });
    it('un error en cualquier página se lanza', async () => {
        const sb = recordingClient({ data: null, error: { message: 'boom' } });
        await expect(readAll(() => sb.from('transactions').select('*'))).rejects.toThrow('boom');
    });
});

describe('lecturas paginadas y con orden total', () => {
    it('listRecentBankTransactions pagina, ordena por external_id e ignora filas ya agrupadas', async () => {
        const sb = pagedClient([1000, 2, 0]);
        expect(await createDb(sb).listRecentBankTransactions('u1', '2026-01-01')).toHaveLength(1002);
        expect(sb.calls).toHaveLength(3);
        for (const chain of sb.calls) {
            expect(chain).toContainEqual(['order', 'external_id']);
            expect(chain).toContainEqual(['is', 'transfer_group_id', null]);
        }
    });
    it('listBankTransactionsInRange pagina y ordena por external_id', async () => {
        const sb = pagedClient([1000, 1, 0]);
        expect(await createDb(sb).listBankTransactionsInRange('u1', ['a'], { from: '2026-01-01', to: '2026-02-01' })).toHaveLength(1001);
        expect(sb.calls[0]).toContainEqual(['order', 'external_id']);
    });
    it('listUserCategorized pagina, ordena por id y ya no usa limit', async () => {
        const sb = pagedClient([1000, 1000, 1000, 1000, 1000, 7, 0]);
        expect(await createDb(sb).listUserCategorized('u1')).toHaveLength(5007);
        expect(sb.calls[0]).toContainEqual(['order', 'id']);
        expect(sb.calls.flat().some((c) => c[0] === 'limit')).toBe(false);
    });
});

describe('createDb', () => {
    it('upsert de transacciones usa el conflicto (user_id, external_id) y parte en lotes de 500', async () => {
        const sb = recordingClient();
        await createDb(sb).upsertTransactions(Array.from({ length: 501 }, (_, i) => ({ external_id: `e${i}` })));
        const upserts = sb.calls.filter((c) => c[0][1] === 'transactions');
        expect(upserts).toHaveLength(2);
        expect(upserts[0].find((c) => c[0] === 'upsert')[2]).toEqual({ onConflict: 'user_id,external_id' });
    });
    it('upsert de cuentas usa provider_account_id', async () => {
        const sb = recordingClient({ data: [{ id: 'a' }], error: null });
        await createDb(sb).upsertAccounts([{ provider_account_id: 'p' }]);
        expect(sb.calls[0].find((c) => c[0] === 'upsert')[2]).toEqual({ onConflict: 'provider_account_id' });
    });
    it('cuenta links activos excluyendo desconectados', async () => {
        const sb = recordingClient({ data: null, error: null, count: 3 });
        expect(await createDb(sb).countActiveLinks('u1')).toBe(3);
        expect(sb.calls[0]).toContainEqual(['neq', 'status', 'disconnected']);
        expect(sb.calls[0]).toContainEqual(['eq', 'user_id', 'u1']);
    });
    it('errores de Supabase se lanzan', async () => {
        const sb = recordingClient({ data: null, error: { message: 'boom' } });
        await expect(createDb(sb).getLinkById('x')).rejects.toThrow('boom');
    });
    it('setTransferGroup no pisa categorías del usuario', async () => {
        const sb = recordingClient();
        await createDb(sb).setTransferGroup('u1', ['a', 'b'], 'g1');
        const second = sb.calls[1];
        expect(second).toContainEqual(['update', { categoria: 'Transferencia entre tus cuentas', categoria_origen: 'regla' }]);
        expect(second).toContainEqual(['or', 'categoria_origen.is.null,categoria_origen.neq.usuario']);
    });
});
