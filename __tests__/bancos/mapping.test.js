import { describe, it, expect } from 'vitest';
import { mapAccount, mapTransaction } from '../../supabase/functions/_shared/bancos/mapping.js';
import { MAX_LINKS_PER_USER, TRANSFER_CATEGORY } from '../../supabase/functions/_shared/bancos/constants.js';

const credit = {
    id: 'pa-2', name: 'Tarjeta Azul', numberMasked: '•••• 9034', kind: 'credit', currency: 'MXN',
    balanceCurrent: '7350.00', balanceAvailable: 22650, credit: { limit: 30000, cutoffDate: '2026-10-20', paymentDueDate: '2026-11-09', minimumPayment: 650, noInterestPayment: 7350 },
};

describe('constantes', () => {
    it('valores del spec', () => {
        expect(MAX_LINKS_PER_USER).toBe(5);
        expect(TRANSFER_CATEGORY).toBe('Transferencia entre tus cuentas');
    });
});

describe('mapAccount', () => {
    it('tarjeta → credito con datos de crédito numéricos', () => {
        expect(mapAccount(credit, { userId: 'u1', linkId: 'l1' })).toEqual({
            user_id: 'u1', link_id: 'l1', provider_account_id: 'pa-2', name: 'Tarjeta Azul', number_masked: '•••• 9034',
            account_type: 'credito', currency: 'MXN', balance_current: 7350, balance_available: 22650,
            credit_limit: 30000, cutoff_date: '2026-10-20', payment_due_date: '2026-11-09', minimum_payment: 650, no_interest_payment: 7350,
            connected: true,
        });
    });
    it('débito → sin datos de crédito y MXN por defecto', () => {
        const row = mapAccount({ id: 'pa-1', name: 'Cuenta', kind: 'debit', balanceCurrent: 10, credit: { limit: 1 } }, { userId: 'u1', linkId: 'l1' });
        expect(row).toMatchObject({ account_type: 'debito', currency: 'MXN', credit_limit: null, cutoff_date: null, balance_available: null });
    });
});

describe('mapTransaction', () => {
    const debitAcc = { id: 'acc-1', account_type: 'debito' };
    const creditAcc = { id: 'acc-2', account_type: 'credito' };
    const base = { id: 'pt-1', accountId: 'pa-1', date: '2026-10-01', description: '  OXXO REFORMA  ', merchant: 'OXXO', amount: -89.5, direction: 'out', status: 'processed', currency: 'MXN' };

    it('salida → Egreso con columnas de la app y del banco', () => {
        expect(mapTransaction(base, { userId: 'u1', account: debitAcc, bankName: 'BBVA' })).toEqual({
            user_id: 'u1', source: 'banco', external_id: 'pt-1', bank_account_id: 'acc-1', date: '2026-10-01',
            concept: 'OXXO REFORMA', merchant: 'OXXO', amount: 89.5, type: 'Egreso', account_type: 'debito', bank: 'BBVA',
            client: 'N/A', bank_status: 'processed', categoria: null, categoria_origen: null, transfer_group_id: null,
        });
    });
    it('entrada en débito → Ingreso; entrada en crédito (pago) → Transferencia', () => {
        expect(mapTransaction({ ...base, direction: 'in' }, { userId: 'u1', account: debitAcc, bankName: 'B' }).type).toBe('Ingreso');
        expect(mapTransaction({ ...base, direction: 'in' }, { userId: 'u1', account: creditAcc, bankName: 'B' }).type).toBe('Transferencia');
    });
    it('pendiente, concepto vacío y sin banco', () => {
        const r = mapTransaction({ ...base, status: 'pending', description: '', merchant: undefined }, { userId: 'u1', account: debitAcc });
        expect(r).toMatchObject({ bank_status: 'pending', concept: 'Movimiento', merchant: null, bank: 'Banco' });
    });
});
