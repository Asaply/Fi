import { describe, it, expect } from 'vitest';
import { hasAccess, getAccessMeta, userHasAccess, postAuthDestination, accessMetadata } from '../src/lib/access';

const NOW = Date.parse('2026-10-12T12:00:00Z');
const future = '2026-11-12T00:00:00Z';
const past = '2026-09-01T00:00:00Z';

describe('hasAccess (sin cambios)', () => {
    it('free nunca vence', () => {
        expect(hasAccess({ subscription_status: 'free' }, NOW)).toBe(true);
    });
    it('active con vencimiento futuro', () => {
        expect(hasAccess({ subscription_status: 'active', subscription_expires_at: future }, NOW)).toBe(true);
    });
    it('active vencido hace más de 24 h', () => {
        expect(hasAccess({ subscription_status: 'active', subscription_expires_at: past }, NOW)).toBe(false);
    });
    it('active sin vencimiento (legacy)', () => {
        expect(hasAccess({ subscription_status: 'active', subscription_expires_at: null }, NOW)).toBe(true);
    });
    it('expired o vacío', () => {
        expect(hasAccess({ subscription_status: 'expired' }, NOW)).toBe(false);
        expect(hasAccess(null, NOW)).toBe(false);
    });
});

describe('userHasAccess lee SOLO app_metadata', () => {
    it('da acceso por app_metadata', () => {
        const user = { app_metadata: { subscription_status: 'free' }, user_metadata: {} };
        expect(userHasAccess(user, NOW)).toBe(true);
    });
    it('ignora user_metadata aunque diga free (escalada del cliente)', () => {
        const user = { app_metadata: {}, user_metadata: { subscription_status: 'free' } };
        expect(userHasAccess(user, NOW)).toBe(false);
    });
    it('sin usuario no hay acceso', () => {
        expect(userHasAccess(null, NOW)).toBe(false);
        expect(getAccessMeta(undefined)).toBe(null);
    });
});

describe('postAuthDestination', () => {
    const paid = { subscription_status: 'free' };
    it('sin onboarding → /onboarding', () => {
        expect(postAuthDestination({ app_metadata: paid, user_metadata: {} })).toBe('/onboarding');
    });
    it('onboarded sin acceso → /paywall', () => {
        expect(postAuthDestination({ app_metadata: {}, user_metadata: { onboarded: true } })).toBe('/paywall');
    });
    it('onboarded con acceso → /finanzas', () => {
        expect(postAuthDestination({ app_metadata: paid, user_metadata: { onboarded: true } })).toBe('/finanzas');
    });
});

describe('accessMetadata', () => {
    it('arma las tres claves', () => {
        expect(accessMetadata({ status: 'active', source: 'stripe', expiresAt: future })).toEqual({
            subscription_status: 'active',
            subscription_source: 'stripe',
            subscription_expires_at: future,
        });
    });
    it('expiresAt ausente → null', () => {
        expect(accessMetadata({ status: 'free', source: 'free' }).subscription_expires_at).toBe(null);
    });
});
