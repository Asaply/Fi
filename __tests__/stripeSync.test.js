import { describe, it, expect, vi } from 'vitest';
import {
    mapStripeSubscription,
    applyStripeSubscription,
    isCheckoutActivated,
    invoiceSubscriptionId,
} from '../src/lib/stripeSync';

const periodEnd = Date.parse('2026-10-19T00:00:00Z') / 1000;

describe('mapStripeSubscription', () => {
    it('trialing da acceso hasta el fin de la prueba', () => {
        expect(mapStripeSubscription({ status: 'trialing', current_period_end: periodEnd })).toEqual({
            status: 'active',
            expiresAt: '2026-10-19T00:00:00.000Z',
        });
    });
    it('canceled expira', () => {
        expect(mapStripeSubscription({ status: 'canceled', current_period_end: periodEnd }).status).toBe('expired');
    });
    it('API dahlia: toma current_period_end del primer item', () => {
        expect(mapStripeSubscription({
            status: 'active',
            items: { object: 'list', data: [{ id: 'si_1', current_period_end: periodEnd }] },
        })).toEqual({ status: 'active', expiresAt: '2026-10-19T00:00:00.000Z' });
    });
    it('solo trial_end → vence al terminar la prueba', () => {
        expect(mapStripeSubscription({ status: 'trialing', trial_end: periodEnd, items: { data: [] } })).toEqual({
            status: 'active',
            expiresAt: '2026-10-19T00:00:00.000Z',
        });
    });
});

describe('isCheckoutActivated', () => {
    it('complete + paid → true', () => {
        expect(isCheckoutActivated({ status: 'complete', payment_status: 'paid' })).toBe(true);
    });
    it('complete + no_payment_required (prueba) → true', () => {
        expect(isCheckoutActivated({ status: 'complete', payment_status: 'no_payment_required' })).toBe(true);
    });
    it('open + unpaid → false', () => {
        expect(isCheckoutActivated({ status: 'open', payment_status: 'unpaid' })).toBe(false);
    });
    it('sin sesión → false', () => {
        expect(isCheckoutActivated(null)).toBe(false);
    });
});

describe('invoiceSubscriptionId', () => {
    it('API dahlia: parent.subscription_details.subscription', () => {
        expect(invoiceSubscriptionId({ parent: { subscription_details: { subscription: 'sub_new' } } })).toBe('sub_new');
    });
    it('API anterior: invoice.subscription', () => {
        expect(invoiceSubscriptionId({ subscription: 'sub_old' })).toBe('sub_old');
    });
    it('suscripción expandida → su id', () => {
        expect(invoiceSubscriptionId({ parent: { subscription_details: { subscription: { id: 'sub_x' } } } })).toBe('sub_x');
    });
    it('factura sin suscripción → null', () => {
        expect(invoiceSubscriptionId({ parent: null })).toBe(null);
    });
});

describe('applyStripeSubscription', () => {
    it('escribe app_metadata y el espejo en user_metadata', async () => {
        const updateUserById = vi.fn().mockResolvedValue({ error: null });
        const admin = {
            from: () => ({ upsert: () => Promise.resolve({ error: null }) }),
            auth: { admin: { updateUserById } },
        };
        await applyStripeSubscription(admin, 'user-1', {
            id: 'sub_1', customer: 'cus_1', status: 'trialing', current_period_end: periodEnd,
        });
        const expected = {
            subscription_status: 'active',
            subscription_source: 'stripe',
            subscription_expires_at: '2026-10-19T00:00:00.000Z',
        };
        expect(updateUserById).toHaveBeenCalledWith('user-1', { app_metadata: expected, user_metadata: expected });
    });
});
