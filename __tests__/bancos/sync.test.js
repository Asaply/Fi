import { describe, it, expect, vi } from 'vitest';
import { syncLink, syncWindow } from '../../supabase/functions/_shared/bancos/sync.js';
import { createMockProvider } from '../../supabase/functions/_shared/bancos/provider/mock.js';
import { createFakeBankDb } from '../helpers/fakeBankDb.js';

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
        expect(spy).toHaveBeenCalledTimes(2);
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
