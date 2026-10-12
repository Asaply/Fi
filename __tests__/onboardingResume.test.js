import { describe, it, expect } from 'vitest';
import { STEP, onboardingStartStep } from '../src/lib/onboardingResume';

describe('onboardingStartStep', () => {
    it('usuario nuevo empieza desde el principio', () => {
        expect(onboardingStartStep({ app_metadata: {}, user_metadata: {} })).toBe(STEP.START);
    });
    it('ya puso su nombre pero no pagó → Planes', () => {
        expect(onboardingStartStep({ app_metadata: {}, user_metadata: { display_name: 'Ana' } })).toBe(STEP.PLANS);
    });
    it('ya tiene acceso (regresó de Stripe) → Importar', () => {
        expect(onboardingStartStep({ app_metadata: { subscription_status: 'free' }, user_metadata: {} })).toBe(STEP.IMPORT);
    });
    it('el orden nuevo pone Planes antes de Importar', () => {
        expect(STEP.PLANS).toBeLessThan(STEP.IMPORT);
        expect(STEP.IMPORT).toBeLessThan(STEP.INSIGHTS);
        expect(STEP.INSIGHTS).toBeLessThan(STEP.DONE);
    });
});
