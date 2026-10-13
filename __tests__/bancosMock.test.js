import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as mock from '../src/lib/bancos/mock';

beforeEach(() => mock.resetMock({ delayMs: 0 }));

describe('mock de bancos sigue el contrato', () => {
    it('lista bancos con los campos del contrato y sin desconectados', async () => {
        const bancos = await mock.listarBancos();
        expect(bancos.length).toBeGreaterThan(0);
        for (const b of bancos) {
            expect(Object.keys(b).sort()).toEqual(['id', 'institution_name', 'last_error', 'last_synced_at', 'status']);
            expect(['syncing', 'valid', 'token_required', 'invalid']).toContain(b.status);
        }
    });

    it('cuentas de crédito traen límite y fechas', async () => {
        const cuentas = await mock.listarCuentas('link-bbva');
        const tdc = cuentas.find((c) => c.account_type === 'credito');
        expect(tdc.credit_limit).toBeGreaterThan(0);
        expect(tdc.payment_due_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('el pago de tarjeta aparece en ambos lados con el mismo transfer_group_id', async () => {
        const movs = await mock.listarMovimientos();
        const grupo = movs.filter((t) => t.transfer_group_id === 'tg-1');
        expect(grupo).toHaveLength(2);
        expect(new Set(grupo.map((t) => t.bank_account_id)).size).toBe(2);
    });

    it('registrar un banco lo deja sincronizando y luego al día', async () => {
        vi.useFakeTimers();
        try {
            const { link } = await mock.registrarBanco('link-nuevo', 'Banorte');
            expect(link.status).toBe('syncing');
            await vi.advanceTimersByTimeAsync(5000);
            const bancos = await mock.listarBancos();
            expect(bancos.find((b) => b.id === 'link-nuevo').status).toBe('valid');
        } finally {
            vi.useRealTimers();
        }
    });

    it('sincronizar dos veces seguidas da rate_limited con retryAfter', async () => {
        await mock.sincronizar('link-bbva');
        await expect(mock.sincronizar('link-bbva')).rejects.toMatchObject({ code: 'rate_limited', retryAfter: expect.any(Number) });
    });

    it('sin suscripción no se puede pedir token', async () => {
        mock.resetMock({ delayMs: 0, hasSubscription: false });
        await expect(mock.pedirTokenConexion()).rejects.toMatchObject({ code: 'no_subscription' });
    });

    it('límite de bancos', async () => {
        for (let i = 0; i < 3; i++) await mock.registrarBanco(`extra-${i}`);
        await expect(mock.pedirTokenConexion()).rejects.toMatchObject({ code: 'max_links' });
        // reconectar uno existente sí se permite
        await expect(mock.pedirTokenConexion('link-nu')).resolves.toHaveProperty('token');
    });

    it('desconectar lo quita de la lista y marca sus cuentas', async () => {
        await mock.desconectar('link-nu');
        expect((await mock.listarBancos()).some((b) => b.id === 'link-nu')).toBe(false);
        expect((await mock.listarCuentas('link-nu')).every((c) => c.connected === false)).toBe(true);
    });

    it('cambiar categoría la marca como del usuario', async () => {
        const t = await mock.cambiarCategoria('t4', 'Entretenimiento');
        expect(t).toMatchObject({ categoria: 'Entretenimiento', categoria_origen: 'usuario' });
    });
});
