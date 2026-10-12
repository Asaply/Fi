import { describe, it, expect } from 'vitest';
import { buildDemoSeed, DEMO_COUNTS, DEMO_BUDGETS, DEMO_REMINDERS } from '../src/lib/demo/seed.js';

const USER = '00000000-0000-4000-8000-000000000001';
// Fixed clock so date assertions are stable.
const NOW = Date.parse('2026-06-15T12:00:00Z');

describe('demo seed', () => {
    const seed = buildDemoSeed(USER, NOW);

    it('produce las filas esperadas y todas con el user_id del demo', () => {
        expect(seed.transactions).toHaveLength(DEMO_COUNTS.transactions);
        expect(seed.portfolio).toHaveLength(DEMO_COUNTS.portfolio);
        expect(seed.budgets).toHaveLength(DEMO_COUNTS.budgets);
        expect(seed.reminders).toHaveLength(DEMO_COUNTS.reminders);

        const everyRow = [
            ...seed.transactions,
            ...seed.portfolio,
            ...seed.budgets.map(b => b.budget),
            ...seed.budgets.flatMap(b => b.payments),
            ...seed.reminders.map(r => r.row),
        ];
        expect(everyRow.every(r => r.user_id === USER)).toBe(true);
    });

    it('usa las columnas que lee /finanzas y /dashboard', () => {
        for (const t of seed.transactions) {
            expect(t).toMatchObject({
                date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
                concept: expect.any(String),
                amount: expect.any(Number),
                type: expect.stringMatching(/^(ingreso|egreso)$/),
                account_type: expect.stringMatching(/^(debito|credito)$/),
            });
            expect(t.amount).toBeGreaterThan(0);
            expect(t.categoria).toBeTruthy();
            expect(t.bank).toBeTruthy();
        }
    });

    it('rebasa las fechas sobre "hoy": la más reciente es hoy, ninguna en el futuro', () => {
        const dates = seed.transactions.map(t => t.date).sort();
        const today = new Date(NOW).toISOString().slice(0, 10);
        expect(dates[dates.length - 1]).toBe(today);
        expect(dates[dates.length - 1] <= today).toBe(true);
    });

    it('cubre varios bancos y ambos tipos de cuenta', () => {
        const banks = new Set(seed.transactions.map(t => t.bank));
        const accounts = new Set(seed.transactions.map(t => t.account_type));
        expect(banks.size).toBeGreaterThanOrEqual(4);
        expect(accounts).toEqual(new Set(['debito', 'credito']));
    });

    it('deja el mes en curso con movimientos para que el dashboard no salga vacío', () => {
        const thisMonth = new Date(NOW).toISOString().slice(0, 7);
        const count = seed.transactions.filter(t => t.date.startsWith(thisMonth)).length;
        expect(count).toBeGreaterThan(0);
    });

    it('ninguna meta de ahorro está ya completada', () => {
        for (const b of DEMO_BUDGETS) {
            const paid = b.payments.reduce((s, p) => s + p.amount, 0);
            expect(paid).toBeLessThan(b.target_amount);
        }
    });

    it('los recordatorios enlazados apuntan a una meta que existe', () => {
        const names = new Set(DEMO_BUDGETS.map(b => b.name));
        for (const r of DEMO_REMINDERS) {
            if (r.budgetName) expect(names.has(r.budgetName)).toBe(true);
        }
        // Hay recordatorios próximos (dayOffset negativo) para poblar el calendario.
        expect(DEMO_REMINDERS.some(r => r.dayOffset < 0)).toBe(true);
    });

    it('no queda PII de los estados de cuenta originales', () => {
        const concepts = seed.transactions.map(t => t.concept).join(' | ').toLowerCase();
        for (const leak of ['ada karina', 'anabel burrola', 'joaquin arturo',
                            'maria isela', 'irvinabel', 'carloseduardo', 'rosamaria']) {
            expect(concepts).not.toContain(leak);
        }
        // Ningún número de cuenta/tarjeta/referencia suelto.
        expect(seed.transactions.some(t => /\s\d{4,}\b/.test(t.concept))).toBe(false);
    });
});
