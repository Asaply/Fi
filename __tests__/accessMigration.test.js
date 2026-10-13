import { describe, it, expect } from 'vitest';
import { accessFromRecords, losesAccess, sameAccess } from '../src/lib/accessMigration';

describe('accessFromRecords', () => {
    it('la fila de subscriptions tiene prioridad', () => {
        expect(accessFromRecords({
            subscription: { status: 'active', source: 'stripe', current_period_end: '2026-11-01T00:00:00Z' },
            freeGrant: { user_id: 'u' },
        })).toEqual({
            subscription_status: 'active',
            subscription_source: 'stripe',
            subscription_expires_at: '2026-11-01T00:00:00Z',
        });
    });
    it('free con suscripción vencida regresa a free', () => {
        expect(accessFromRecords({
            subscription: { status: 'expired', source: 'stripe', current_period_end: '2026-01-01T00:00:00Z' },
            freeGrant: { user_id: 'u' },
        }).subscription_status).toBe('free');
    });
    it('solo free_grants → free de por vida', () => {
        expect(accessFromRecords({ subscription: null, freeGrant: { user_id: 'u' } })).toEqual({
            subscription_status: 'free',
            subscription_source: 'free',
            subscription_expires_at: null,
        });
    });
    it('user_metadata falsificado sin fila ni grant → null (nunca se copia)', () => {
        expect(accessFromRecords({
            subscription: null,
            freeGrant: null,
            userMetadata: { subscription_status: 'active', subscription_source: 'stripe_legacy', subscription_expires_at: null },
        })).toBe(null);
    });
    it('sin nada → null (no se toca)', () => {
        expect(accessFromRecords({ subscription: null, freeGrant: null })).toBe(null);
    });
});

describe('losesAccess', () => {
    const now = Date.parse('2026-10-12T00:00:00Z');
    const umActive = { subscription_status: 'active', subscription_source: 'stripe_legacy', subscription_expires_at: null };

    it('user_metadata con acceso y sin acceso derivado → pierde', () => {
        expect(losesAccess(umActive, null, now)).toBe(true);
    });
    it('user_metadata con acceso y derivado vencido → pierde', () => {
        expect(losesAccess(umActive, {
            subscription_status: 'expired', subscription_source: 'stripe', subscription_expires_at: '2026-01-01T00:00:00Z',
        }, now)).toBe(true);
    });
    it('user_metadata con acceso y derivado con acceso → no pierde', () => {
        expect(losesAccess(umActive, { subscription_status: 'free', subscription_source: 'free', subscription_expires_at: null }, now)).toBe(false);
    });
    it('user_metadata sin acceso → no pierde', () => {
        expect(losesAccess({ subscription_status: 'none' }, null, now)).toBe(false);
        expect(losesAccess(undefined, null, now)).toBe(false);
    });
});

describe('sameAccess', () => {
    const access = {
        subscription_status: 'active',
        subscription_source: 'stripe',
        subscription_expires_at: '2026-11-01T00:00:00.000Z',
    };
    it('mismo instante con distinto formato ISO → igual', () => {
        expect(sameAccess({ ...access, subscription_expires_at: '2026-11-01T00:00:00+00:00' }, access)).toBe(true);
    });
    it('ambos sin vencimiento (null/undefined) → igual', () => {
        const free = { subscription_status: 'free', subscription_source: 'free', subscription_expires_at: null };
        expect(sameAccess({ subscription_status: 'free', subscription_source: 'free' }, free)).toBe(true);
    });
    it('distinto vencimiento → diferente', () => {
        expect(sameAccess({ ...access, subscription_expires_at: '2026-12-01T00:00:00Z' }, access)).toBe(false);
    });
    it('uno null y otro con fecha → diferente', () => {
        expect(sameAccess({ ...access, subscription_expires_at: null }, access)).toBe(false);
    });
    it('distinto estado o fuente → diferente', () => {
        expect(sameAccess({ ...access, subscription_status: 'expired' }, access)).toBe(false);
        expect(sameAccess({ ...access, subscription_source: 'apple' }, access)).toBe(false);
    });
    it('app_metadata vacío → diferente', () => {
        expect(sameAccess({}, access)).toBe(false);
    });
});
