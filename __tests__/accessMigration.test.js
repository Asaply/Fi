import { describe, it, expect } from 'vitest';
import { accessFromRecords } from '../src/lib/accessMigration';

describe('accessFromRecords', () => {
    it('la fila de subscriptions tiene prioridad', () => {
        expect(accessFromRecords({
            subscription: { status: 'active', source: 'stripe', current_period_end: '2026-11-01T00:00:00Z' },
            freeGrant: { user_id: 'u' },
            userMetadata: {},
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
            userMetadata: {},
        }).subscription_status).toBe('free');
    });
    it('solo free_grants → free de por vida', () => {
        expect(accessFromRecords({ subscription: null, freeGrant: { user_id: 'u' }, userMetadata: {} })).toEqual({
            subscription_status: 'free',
            subscription_source: 'free',
            subscription_expires_at: null,
        });
    });
    it('pago único legacy sin fila se copia de user_metadata', () => {
        expect(accessFromRecords({
            subscription: null,
            freeGrant: null,
            userMetadata: { subscription_status: 'active', subscription_source: 'stripe_legacy', subscription_expires_at: null },
        })).toEqual({
            subscription_status: 'active',
            subscription_source: 'stripe_legacy',
            subscription_expires_at: null,
        });
    });
    it('sin nada → null (no se toca)', () => {
        expect(accessFromRecords({ subscription: null, freeGrant: null, userMetadata: { subscription_status: 'free' } })).toBe(null);
    });
});
