import { describe, it, expect, vi } from 'vitest';
import { mapStripeSubscription, applyStripeSubscription } from '../src/lib/stripeSync';

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
