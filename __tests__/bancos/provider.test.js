import { describe, it, expect } from 'vitest';
import { getProvider } from '../../supabase/functions/_shared/bancos/provider/index.js';
import { createMockProvider } from '../../supabase/functions/_shared/bancos/provider/mock.js';

const req = (headers, body) => new Request('https://x/bank-webhook', { method: 'POST', headers, body: JSON.stringify(body) });

describe('getProvider', () => {
    it('sin configurar → null; mock → simulado', () => {
        expect(getProvider({})).toBe(null);
        expect(getProvider({ BANK_PROVIDER: 'syncfy' })).toBe(null);
        expect(typeof getProvider({ BANK_PROVIDER: 'mock' }).getLink).toBe('function');
    });
});

describe('proveedor simulado', () => {
    const now = new Date('2026-10-13T12:00:00Z');

    it('conectar crea un link recurrente del usuario', async () => {
        const p = createMockProvider({ now });
        const id = p.simulateConnect({ userId: 'u1', institutionName: 'BBVA' });
        expect(await p.getLink(id)).toEqual({ id, externalUserId: 'u1', institutionCode: 'mock_bank', institutionName: 'BBVA', recurrent: true });
        expect(await p.getLink('nope')).toBe(null);
        expect((await p.createConnectToken({ userId: 'u1' })).token).toMatch(/^mock-/);
    });

    it('cuentas y movimientos con el formato normalizado, filtrados por fecha', async () => {
        const p = createMockProvider({ now });
        const id = p.simulateConnect({ userId: 'u1' });
        const accounts = await p.listAccounts(id);
        expect(accounts.map((a) => a.kind).sort()).toEqual(['credit', 'debit']);
        const all = await p.listTransactions(id, { from: '2025-10-13', to: '2026-10-13' });
        expect(all.length).toBeGreaterThan(5);
        for (const t of all) {
            expect(t.amount).toBeGreaterThan(0);
            expect(['in', 'out']).toContain(t.direction);
            expect(accounts.map((a) => a.id)).toContain(t.accountId);
        }
        expect(all.some((t) => t.status === 'pending')).toBe(true);
        const recent = await p.listTransactions(id, { from: '2026-10-12', to: '2026-10-13' });
        expect(recent.length).toBeLessThan(all.length);
    });

    it('borrar link no falla aunque no exista', async () => {
        const p = createMockProvider({ now });
        const id = p.simulateConnect({ userId: 'u1' });
        await p.deleteLink(id);
        await p.deleteLink(id);
        expect(await p.getLink(id)).toBe(null);
    });

    it('webhook: secreto requerido y evento normalizado', async () => {
        const p = createMockProvider({ now });
        expect(await p.parseWebhook(req({ 'x-webhook-secret': 'bad' }, {}), 's3cret')).toEqual({ authorized: false });
        expect(await p.parseWebhook(req({ 'x-webhook-secret': 's3cret' }, { kind: 'new_transactions', providerLinkId: 'L1' }), 's3cret'))
            .toEqual({ authorized: true, event: { kind: 'new_transactions', providerLinkId: 'L1', message: null } });
        expect((await p.parseWebhook(req({ 'x-webhook-secret': 's3cret' }, { kind: 'raro' }), 's3cret')).event.kind).toBe('ignored');
    });
});
