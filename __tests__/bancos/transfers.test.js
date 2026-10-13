import { describe, it, expect } from 'vitest';
import { findOwnTransferPairs } from '../../supabase/functions/_shared/bancos/transfers.js';

const out = (key, acc, date, amount, concept = 'PAGO TDC 9034 SPEI') => ({ key, bank_account_id: acc, date, amount, type: 'Egreso', concept, transfer_group_id: null });
const inn = (key, acc, date, amount, concept = 'SU PAGO GRACIAS', type = 'Transferencia') => ({ key, bank_account_id: acc, date, amount, type, concept, transfer_group_id: null });

describe('findOwnTransferPairs', () => {
    it('liga un pago claro de débito a tarjeta', () => {
        expect(findOwnTransferPairs([out('o1', 'deb', '2026-10-05', 5000), inn('i1', 'tdc', '2026-10-06', 5000)])).toEqual([['o1', 'i1']]);
    });
    it('no liga montos distintos', () => {
        expect(findOwnTransferPairs([out('o1', 'deb', '2026-10-05', 5000), inn('i1', 'tdc', '2026-10-05', 4999)])).toEqual([]);
    });
    it('no liga fuera de la ventana de 3 días', () => {
        expect(findOwnTransferPairs([out('o1', 'deb', '2026-10-01', 5000), inn('i1', 'tdc', '2026-10-05', 5000)])).toEqual([]);
    });
    it('no liga dentro de la misma cuenta', () => {
        expect(findOwnTransferPairs([out('o1', 'deb', '2026-10-05', 5000), inn('i1', 'deb', '2026-10-05', 5000)])).toEqual([]);
    });
    it('no liga sin pista de pago/transferencia en ningún concepto', () => {
        expect(findOwnTransferPairs([out('o1', 'deb', '2026-10-05', 300, 'OXXO'), inn('i1', 'nu', '2026-10-05', 300, 'DEPOSITO EFECTIVO', 'Ingreso')])).toEqual([]);
    });
    it('ambiguo (dos entradas candidatas) → no liga', () => {
        expect(findOwnTransferPairs([out('o1', 'deb', '2026-10-05', 1000), inn('i1', 'tdc', '2026-10-05', 1000), inn('i2', 'nu', '2026-10-05', 1000, 'SPEI RECIBIDO', 'Ingreso')])).toEqual([]);
    });
    it('ambiguo (dos salidas candidatas) → no liga', () => {
        expect(findOwnTransferPairs([out('o1', 'deb', '2026-10-05', 1000), out('o2', 'nu', '2026-10-05', 1000), inn('i1', 'tdc', '2026-10-05', 1000)])).toEqual([]);
    });
    it('ignora filas ya ligadas', () => {
        const o = { ...out('o1', 'deb', '2026-10-05', 5000), transfer_group_id: 'g' };
        expect(findOwnTransferPairs([o, inn('i1', 'tdc', '2026-10-05', 5000)])).toEqual([]);
    });
});
