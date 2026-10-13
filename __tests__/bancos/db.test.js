import { describe, it, expect } from 'vitest';
import { createDb } from '../../supabase/functions/_shared/bancos/db.js';

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
