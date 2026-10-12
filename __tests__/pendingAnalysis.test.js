import { describe, it, expect } from 'vitest';
import { analysisToTransactionRows } from '../src/lib/pendingAnalysis';

// Shape returned by POST /api/analyze (see mapTransactions in that route).
const analysis = {
    success: true,
    bank: 'BBVA',
    tipo_cuenta: 'Débito',
    transactions: [
        { fecha: '2026-03-02', concepto: 'OXXO REFORMA', monto: 85.5, tipo: 'egreso', categoria: 'Comida', banco: 'BBVA' },
        { fecha: '2026-03-15', concepto: 'NOMINA EMPRESA', monto: 12000, tipo: 'abono', categoria: 'Salario', banco: 'BBVA' },
        { fecha: '2026-03-20', concepto: 'AJUSTE SALDO', monto: -3, tipo: 'ajuste', categoria: 'Otros' },
    ],
};

describe('analysisToTransactionRows', () => {
    it('usa las columnas reales de la tabla transactions', () => {
        const [row] = analysisToTransactionRows(analysis, 'user-1');
        expect(row).toEqual({
            date: '2026-03-02',
            concept: 'OXXO REFORMA',
            amount: 85.5,
            type: 'Egreso',
            client: 'N/A',
            categoria: 'Comida',
            account_type: 'debito',
            bank: 'BBVA',
            user_id: 'user-1',
        });
    });

    it('mapea tipos igual que el import de /finanzas', () => {
        const types = analysisToTransactionRows(analysis, 'u').map(r => r.type);
        expect(types).toEqual(['Egreso', 'Ingreso', 'Ajuste']);
    });

    it('guarda montos en positivo', () => {
        const rows = analysisToTransactionRows(analysis, 'u');
        expect(rows[2].amount).toBe(3);
    });

    it('detecta cuenta de crédito', () => {
        const rows = analysisToTransactionRows({ ...analysis, tipo_cuenta: 'credito' }, 'u');
        expect(rows.every(r => r.account_type === 'credito')).toBe(true);
    });

    it('descarta filas sin monto o sin fecha', () => {
        const rows = analysisToTransactionRows({
            transactions: [
                { fecha: '2026-03-01', concepto: 'A', monto: 0, tipo: 'egreso' },
                { fecha: '', concepto: 'B', monto: 10, tipo: 'egreso' },
                { fecha: '2026-03-01', concepto: 'C', monto: 10, tipo: 'egreso' },
            ],
        }, 'u');
        expect(rows.map(r => r.concept)).toEqual(['C']);
    });

    it('devuelve [] con datos vacíos o inválidos', () => {
        expect(analysisToTransactionRows(null, 'u')).toEqual([]);
        expect(analysisToTransactionRows({}, 'u')).toEqual([]);
        expect(analysisToTransactionRows({ transactions: 'x' }, 'u')).toEqual([]);
    });
});
