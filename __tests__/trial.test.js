import { describe, it, expect } from 'vitest';
import { TRIAL_DAYS, trialDaysFor } from '../src/lib/trial';

describe('trialDaysFor', () => {
    it('la prueba dura 7 días', () => {
        expect(TRIAL_DAYS).toBe(7);
    });
    it('sin suscripción previa → 7 días', () => {
        expect(trialDaysFor(null)).toBe(7);
        expect(trialDaysFor(undefined)).toBe(7);
    });
    it('con cualquier suscripción previa → 0', () => {
        expect(trialDaysFor({ user_id: 'u', status: 'expired' })).toBe(0);
    });
});
