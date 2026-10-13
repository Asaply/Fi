import { describe, it, expect } from 'vitest';
import { parseCSV, autoDetect, normalizarFecha, buildRows } from '../src/lib/finanzas/csvImport';
import { PERIODOS_FIN, getFechaInicioFin } from '../src/lib/finanzas/periodos';

describe('parseCSV', () => {
    it('separa por coma, respeta comillas y quita BOM', () => {
        const text = '﻿Fecha,Concepto,Monto\r\n01/03/2026,"OXXO, REFORMA",-85.50\r\n';
        expect(parseCSV(text)).toEqual([
            ['Fecha', 'Concepto', 'Monto'],
            ['01/03/2026', 'OXXO, REFORMA', '-85.50'],
        ]);
    });

    it('detecta punto y coma como separador', () => {
        expect(parseCSV('Fecha;Monto\n2026-03-01;10')).toEqual([['Fecha', 'Monto'], ['2026-03-01', '10']]);
    });

    it('devuelve [] con menos de 2 líneas', () => {
        expect(parseCSV('Fecha,Monto')).toEqual([]);
    });
});

describe('autoDetect', () => {
    it('reconoce encabezados comunes de bancos', () => {
        expect(autoDetect(['Fecha Operación', 'Descripción', 'Cargo', 'Abono'])).toEqual({
            date: 'Fecha Operación', concept: 'Descripción', amount: '', charge: 'Cargo', credit: 'Abono',
        });
    });

    it('deja vacío lo que no reconoce', () => {
        expect(autoDetect(['foo', 'bar'])).toEqual({ date: '', concept: '', amount: '', charge: '', credit: '' });
    });
});

describe('normalizarFecha', () => {
    it('acepta YYYY-MM-DD tal cual', () => {
        expect(normalizarFecha('2026-03-05')).toBe('2026-03-05');
    });

    it('convierte DD/MM/YYYY (formato mexicano)', () => {
        expect(normalizarFecha('5/3/2026')).toBe('2026-03-05');
    });

    it('expande año de 2 dígitos', () => {
        expect(normalizarFecha('05-03-26')).toBe('2026-03-05');
    });

    it('acepta YYYY/MM/DD', () => {
        expect(normalizarFecha('2026/3/5')).toBe('2026-03-05');
    });
});

describe('buildRows', () => {
    const headers = ['Fecha', 'Concepto', 'Cargo', 'Abono'];
    const mapping = { date: 'Fecha', concept: 'Concepto', amount: '', charge: 'Cargo', credit: 'Abono' };

    it('usa columnas cargo/abono para el tipo', () => {
        const rows = buildRows([
            ['01/03/2026', 'NETFLIX', '$199.00', ''],
            ['02/03/2026', 'NOMINA', '', '12,000.00'],
            ['03/03/2026', 'VACIO', '', ''],
        ], headers, mapping);
        expect(rows.map(r => [r._idx, r.date, r.amount, r.type])).toEqual([
            [0, '2026-03-01', 199, 'Egreso'],
            [1, '2026-03-02', 12000, 'Ingreso'],
        ]);
        expect(rows[0].client).toBe('N/A');
        expect(typeof rows[0].categoria).toBe('string');
    });

    it('en tarjeta de crédito un abono es Transferencia', () => {
        const rows = buildRows([['02/03/2026', 'PAGO', '', '500']], headers, mapping, true);
        expect(rows[0].type).toBe('Transferencia');
    });

    it('con columna única de monto, el signo define el tipo', () => {
        const h = ['Fecha', 'Concepto', 'Monto'];
        const m = { date: 'Fecha', concept: 'Concepto', amount: 'Monto', charge: '', credit: '' };
        const rows = buildRows([['2026-03-01', 'A', '-50'], ['2026-03-02', 'B', '70']], h, m);
        expect(rows.map(r => [r.amount, r.type])).toEqual([[50, 'Egreso'], [70, 'Ingreso']]);
    });

    it('pone concepto por defecto si falta', () => {
        const rows = buildRows([['2026-03-01', '', '10', '']], headers, mapping);
        expect(rows[0].concept).toBe('Transacción 1');
    });
});

describe('periodos', () => {
    it('incluye las opciones del filtro', () => {
        expect(PERIODOS_FIN.map(p => p.value)).toEqual(['1m', '3m', '6m', '1y', 'Todos']);
    });

    it('Todos empieza en 2000-01-01', () => {
        expect(getFechaInicioFin('Todos')).toBe('2000-01-01');
    });

    it('devuelve fechas YYYY-MM-DD para cada periodo', () => {
        for (const p of ['1m', '3m', '6m', '1y', 'otro']) {
            expect(getFechaInicioFin(p)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
    });
});
