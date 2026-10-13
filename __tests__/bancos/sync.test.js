import { describe, it, expect, vi } from 'vitest';
import { syncLink, syncWindow } from '../../supabase/functions/_shared/bancos/sync.js';
import { createMockProvider } from '../../supabase/functions/_shared/bancos/provider/mock.js';
import { createFakeBankDb } from '../helpers/fakeBankDb.js';
import { AI_MAX_ROWS_PER_SYNC } from '../../supabase/functions/_shared/bancos/constants.js';

const now = new Date('2026-10-13T12:00:00Z');

// Fake AI: answers per concept, so the result doesn't depend on how many rows the rules leave unresolved.
const fakeAi = async (items) => items.map((i) => (i.concept.includes('ZZQX') ? 'Ropa y Accesorios' : 'Entretenimiento'));

async function setup(dbOptions) {
    const db = createFakeBankDb(dbOptions);
    const provider = createMockProvider({ now });
    const pid = provider.simulateConnect({ userId: 'u1', institutionName: 'BBVA' });
    const link = await db.insertLink({ user_id: 'u1', provider_link_id: pid, institution_name: 'BBVA', status: 'syncing', last_synced_at: null });
    let n = 0;
    return { db, provider, link, newId: () => `g${++n}` };
}

describe('syncWindow', () => {
    it('primera vez: 365 días; después: desde la última menos 3 días', () => {
        expect(syncWindow({ last_synced_at: null }, now)).toEqual({ from: '2025-10-13', to: '2026-10-13' });
        expect(syncWindow({ last_synced_at: '2026-10-10T08:00:00Z' }, now)).toEqual({ from: '2026-10-07', to: '2026-10-13' });
    });
});

describe('syncLink', () => {
    it('primera sincronización: cuentas, movimientos categorizados, transferencia ligada y link al día', async () => {
        const { db, provider, link, newId } = await setup();
        const classify = vi.fn(fakeAi);
        const { from, to } = syncWindow(link, now);
        const res = await syncLink({ db, provider, classify, link, from, to, now, newId });

        expect(res).toMatchObject({ accounts: 2, transactions: 9, transfersLinked: 1 });
        expect(db.state.accounts.map((a) => a.account_type).sort()).toEqual(['credito', 'debito']);
        const tx = Object.fromEntries(db.state.transactions.map((t) => [t.external_id.split('-').pop(), t]));
        expect(tx.t5.bank_status).toBe('pending');
        expect(tx.t4).toMatchObject({ categoria: 'Ropa y Accesorios', categoria_origen: 'ia' });
        expect(tx.t6.transfer_group_id).toBe('g1');
        expect(tx.t7.transfer_group_id).toBe('g1');
        expect(tx.t7.categoria).toBe('Transferencia entre tus cuentas');
        expect(db.state.links[0]).toMatchObject({ status: 'valid', last_synced_at: now.toISOString(), last_error: null });
    });

    it('re-sincronizar no duplica, no re-llama a la IA para lo ya categorizado y respeta al usuario', async () => {
        const { db, provider, link, newId } = await setup();
        const classify = vi.fn(fakeAi);
        await syncLink({ db, provider, classify, link, ...syncWindow(link, now), now, newId });
        const uber = db.state.transactions.find((t) => t.external_id.endsWith('-t3'));
        uber.categoria = 'Viaje / Hospedaje';
        uber.categoria_origen = 'usuario';
        classify.mockClear();

        await syncLink({ db, provider, classify, link, from: '2025-10-13', to: '2026-10-13', now, newId });
        expect(db.state.transactions).toHaveLength(9);
        expect(classify).not.toHaveBeenCalled();
        expect(uber).toMatchObject({ categoria: 'Viaje / Hospedaje', categoria_origen: 'usuario' });
        expect(db.state.transactions.filter((t) => t.transfer_group_id)).toHaveLength(2);
    });

    it('la memoria del usuario se aplica a movimientos nuevos del mismo comercio', async () => {
        const { db, provider, link, newId } = await setup();
        await db.upsertTransactions([{ user_id: 'u1', external_id: 'manual-1', concept: 'OXXO REFORMA 22', categoria: 'Restaurantes', categoria_origen: 'usuario', source: 'manual', date: '2026-01-01' }]);
        await syncLink({ db, provider, classify: null, link, ...syncWindow(link, now), now, newId });
        const oxxo = db.state.transactions.find((t) => t.external_id.endsWith('-t1'));
        expect(oxxo).toMatchObject({ categoria: 'Restaurantes', categoria_origen: 'memoria' });
    });

    it('borra pendientes que el proveedor ya no devuelve dentro del rango', async () => {
        const { db, provider, link, newId } = await setup();
        await syncLink({ db, provider, classify: null, link, ...syncWindow(link, now), now, newId });
        const acc = db.state.accounts.find((a) => a.account_type === 'credito');
        await db.upsertTransactions([{ user_id: 'u1', external_id: 'old-pending', bank_account_id: acc.id, bank_status: 'pending', date: '2026-10-12', source: 'banco', concept: 'X', amount: 1, type: 'Egreso' }]);
        const res = await syncLink({ db, provider, classify: null, link, from: '2026-10-07', to: '2026-10-13', now, newId });
        expect(res.removedPending).toBe(1);
        expect(db.state.transactions.some((t) => t.external_id === 'old-pending')).toBe(false);
    });
});

describe('syncLink: robustez del lote', () => {
    it('todas las filas que llegan a upsertTransactions tienen exactamente las mismas llaves', async () => {
        const { db, provider, link, newId } = await setup();
        const classify = vi.fn(fakeAi);
        const spy = vi.spyOn(db, 'upsertTransactions');
        await syncLink({ db, provider, classify, link, ...syncWindow(link, now), now, newId });
        // Second pass mixes settled rows (already categorized) with fresh ones (e.g. the "Otros" retry path).
        await syncLink({ db, provider, classify: null, link, from: '2025-10-13', to: '2026-10-13', now, newId });
        // 1st sync: local categories + one AI batch; 2nd sync: local categories only.
        expect(spy).toHaveBeenCalledTimes(3);
        for (const [rows] of spy.mock.calls) {
            expect(rows.length).toBeGreaterThan(0);
            expect(new Set(rows.map((r) => Object.keys(r).sort().join())).size).toBe(1);
        }
    });

    it('un lote mixto (asentadas + nuevas) también conserva llaves uniformes', async () => {
        const { db, provider, link, newId } = await setup();
        await syncLink({ db, provider, classify: null, link, from: '2026-10-07', to: '2026-10-13', now, newId });
        const spy = vi.spyOn(db, 'upsertTransactions');
        await syncLink({ db, provider, classify: vi.fn(fakeAi), link, from: '2025-10-13', to: '2026-10-13', now, newId });
        const [rows] = spy.mock.calls[0];
        expect(rows.some((r) => r.categoria_origen)).toBe(true);
        expect(new Set(rows.map((r) => Object.keys(r).sort().join())).size).toBe(1);
    });

    it('si el proveedor repite un movimiento en la misma respuesta, se guarda una sola fila', async () => {
        const { db, provider, link, newId } = await setup();
        const dupProvider = {
            ...provider,
            listAccounts: (id) => provider.listAccounts(id),
            listTransactions: async (id, range) => {
                const list = await provider.listTransactions(id, range);
                return [...list, ...list];
            },
        };
        const spy = vi.spyOn(db, 'upsertTransactions');
        const res = await syncLink({ db, provider: dupProvider, classify: null, link, ...syncWindow(link, now), now, newId });
        expect(db.state.transactions).toHaveLength(9);
        expect(res.transactions).toBe(9);
        const [rows] = spy.mock.calls[0];
        expect(new Set(rows.map((r) => r.external_id)).size).toBe(rows.length);
    });

    it('con duplicados conserva la última aparición', async () => {
        const { db, provider, link, newId } = await setup();
        const dupProvider = {
            ...provider,
            listTransactions: async (id, range) => {
                const list = await provider.listTransactions(id, range);
                const first = list.find((t) => t.id.endsWith('-t1'));
                return [first, ...list.filter((t) => t !== first), { ...first, description: 'OXXO ACTUALIZADO' }];
            },
        };
        await syncLink({ db, provider: dupProvider, classify: null, link, ...syncWindow(link, now), now, newId });
        expect(db.state.transactions.find((t) => t.external_id.endsWith('-t1')).concept).toBe('OXXO ACTUALIZADO');
    });
});

describe('syncLink: lecturas completas aunque el servidor corte páginas', () => {
    it('con maxRows pequeño el resultado es el mismo', async () => {
        const { db, provider, link, newId } = await setup({ maxRows: 2 });
        const res = await syncLink({ db, provider, classify: vi.fn(fakeAi), link, ...syncWindow(link, now), now, newId });
        expect(res).toMatchObject({ accounts: 2, transactions: 9, transfersLinked: 1 });
    });

    it('un rival guardado antes sigue bloqueando el par aunque haya más filas que maxRows', async () => {
        const { db, provider, link, newId } = await setup({ maxRows: 2 });
        await syncLink({ db, provider, classify: null, link, from: '2026-10-12', to: '2026-10-13', now, newId });
        const deb = db.state.accounts.find((a) => a.account_type === 'debito');
        // A second 5000 "PAGO" outflow from debit the same day: t6 and this one both match t7 → ambiguous → no link.
        await db.upsertTransactions([{ user_id: 'u1', source: 'banco', external_id: 'aaa-rival', bank_account_id: deb.id, date: '2026-10-08', amount: 5000, type: 'Egreso', concept: 'PAGO TDC SPEI', transfer_group_id: null }]);
        const res = await syncLink({ db, provider, classify: null, link, ...syncWindow({ last_synced_at: null }, now), now, newId });
        expect(res.transfersLinked).toBe(0);
        expect(db.state.transactions.filter((t) => t.transfer_group_id)).toHaveLength(0);
    });
});

describe('syncLink: IA acotada y después de guardar', () => {
    // Provider with `n` movements nobody's rules know ("ZZQX n"), one per day back from today.
    function manyUnknown(provider, n) {
        return {
            ...provider,
            listTransactions: async (id) => Array.from({ length: n }, (_, i) => ({
                id: `${id}-u${String(i).padStart(4, '0')}`, accountId: `${id}-deb`,
                date: new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10),
                description: `ZZQX ${i}`, merchant: null, amount: 10 + i, direction: 'out', status: 'processed',
            })),
        };
    }

    it(`con más de ${AI_MAX_ROWS_PER_SYNC} filas sin resolver la IA recibe como máximo ${AI_MAX_ROWS_PER_SYNC}, las más recientes`, async () => {
        const { db, provider, link, newId } = await setup();
        const classify = vi.fn(async (items) => items.map(() => 'Ropa y Accesorios'));
        const res = await syncLink({ db, provider: manyUnknown(provider, 300), classify, link, ...syncWindow(link, now), now, newId });
        const sent = classify.mock.calls.flatMap(([items]) => items);
        expect(sent).toHaveLength(AI_MAX_ROWS_PER_SYNC);
        expect(classify.mock.calls.every(([items]) => items.length <= 50)).toBe(true);
        expect(sent.map((i) => i.concept)).toContain('ZZQX 0');
        expect(sent.map((i) => i.concept)).not.toContain(`ZZQX ${AI_MAX_ROWS_PER_SYNC}`);
        expect(res).toMatchObject({ transactions: 300, aiCategorized: AI_MAX_ROWS_PER_SYNC });
        expect(db.state.transactions.filter((t) => t.categoria_origen === 'ia')).toHaveLength(AI_MAX_ROWS_PER_SYNC);
        expect(db.state.transactions.filter((t) => t.categoria === 'Otros' && t.categoria_origen === null)).toHaveLength(100);
    });

    it('si la IA lanza, las filas ya quedaron guardadas en Otros y el link queda al día', async () => {
        const { db, provider, link, newId } = await setup();
        const classify = vi.fn(async () => { throw new Error('ai down'); });
        await syncLink({ db, provider: manyUnknown(provider, 120), classify, link, ...syncWindow(link, now), now, newId });
        expect(classify).toHaveBeenCalledTimes(1);
        expect(db.state.transactions).toHaveLength(120);
        expect(db.state.transactions.every((t) => t.categoria === 'Otros' && t.categoria_origen === null)).toBe(true);
        expect(db.state.links[0].status).toBe('valid');
    });

    it('el resultado de un lote se guarda antes de pedir el siguiente', async () => {
        const { db, provider, link, newId } = await setup();
        const seen = [];
        const classify = vi.fn(async (items) => {
            seen.push(db.state.transactions.filter((t) => t.categoria_origen === 'ia').length);
            return items.map(() => 'Ropa y Accesorios');
        });
        await syncLink({ db, provider: manyUnknown(provider, 120), classify, link, ...syncWindow(link, now), now, newId });
        expect(seen).toEqual([0, 50, 100]);
    });

    it('las filas guardadas por lote de IA conservan el mismo juego de llaves', async () => {
        const { db, provider, link, newId } = await setup();
        const spy = vi.spyOn(db, 'upsertTransactions');
        await syncLink({ db, provider: manyUnknown(provider, 60), classify: async (items) => items.map(() => 'Ropa y Accesorios'), link, ...syncWindow(link, now), now, newId });
        const keySets = new Set(spy.mock.calls.flatMap(([rows]) => rows.map((r) => Object.keys(r).sort().join())));
        expect(keySets.size).toBe(1);
    });
});

describe('syncLink: ediciones del usuario en filas existentes', () => {
    it('conserva el client editado por el usuario y las llaves siguen uniformes', async () => {
        const { db, provider, link, newId } = await setup();
        await syncLink({ db, provider, classify: null, link, ...syncWindow(link, now), now, newId });
        const oxxo = db.state.transactions.find((t) => t.external_id.endsWith('-t1'));
        const zzqx = db.state.transactions.find((t) => t.external_id.endsWith('-t4'));
        oxxo.client = 'Papá';   // settled row (rules categorized it)
        zzqx.client = 'Trabajo'; // fresh row (still "Otros", re-categorized every sync)
        const spy = vi.spyOn(db, 'upsertTransactions');
        await syncLink({ db, provider, classify: null, link, from: '2025-10-13', to: '2026-10-13', now, newId });
        expect(oxxo.client).toBe('Papá');
        expect(zzqx.client).toBe('Trabajo');
        const [rows] = spy.mock.calls[0];
        expect(new Set(rows.map((r) => Object.keys(r).sort().join())).size).toBe(1);
        expect(rows.every((r) => typeof r.client === 'string')).toBe(true);
    });

    it('cuentas: el mismo provider_account_id en otro usuario es otra fila', async () => {
        const db = createFakeBankDb();
        const [a] = await db.upsertAccounts([{ user_id: 'u1', provider_account_id: 'p1', name: 'A' }]);
        const [b] = await db.upsertAccounts([{ user_id: 'u2', provider_account_id: 'p1', name: 'B' }]);
        expect(a.id).not.toBe(b.id);
        expect(db.state.accounts.map((x) => x.name)).toEqual(['A', 'B']);
    });

    it('el borrado de pendientes nunca toca filas procesadas', async () => {
        const db = createFakeBankDb();
        await db.upsertTransactions([
            { user_id: 'u1', external_id: 'p', bank_status: 'pending' },
            { user_id: 'u1', external_id: 'q', bank_status: 'processed' },
        ]);
        await db.deletePendingByExternalIds('u1', ['p', 'q']);
        expect(db.state.transactions.map((t) => t.external_id)).toEqual(['q']);
    });
});
