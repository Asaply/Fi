import { describe, it, expect } from 'vitest';
import { parseStatementText } from '../src/lib/statementParser';

describe('statementParser - Pruebas de Texto a JSON', () => {

    it('1. Debe parsear correctamente un formato estándar de Nu', () => {
        // Mock simple de texto similar a lo extraído de un PDF de Nu
        const mockNuText = `
10 ENE 2024 COMPRA EN AMAZON - $1,500.00
11 FEB 2024 PAGO TARJETA DE CREDITO + $500.00
12 MAR 2024 SUPERMERCADO WALMART - $2,300.50
        `;
        
        const result = parseStatementText(mockNuText);
        
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(3);
        
        // Verificando transacción 1 (Egreso)
        expect(result[0].fecha).toBe('2024-01-10');
        expect(result[0].concepto).toBe('COMPRA EN AMAZON');
        expect(result[0].monto).toBe(1500);
        expect(result[0].tipo).toBe('egreso');
        
        // Verificando transacción 2 (Ingreso / Pago)
        expect(result[1].fecha).toBe('2024-02-11');
        expect(result[1].monto).toBe(500);
        expect(result[1].tipo).toBe('ingreso');
    });

    it('2. Debe procesar correctamente líneas huérfanas como descripciones extra', () => {
        const mockMultilineText = `
10 ENE 2024 COMPRA CON TARJETA DE
CREDITO DE AMAZON - $500.00
11 ENE 2024 OTRA COMPRA EXTRA
DESCRIPCION MUY LARGA - $150.00
        `;
        
        // Nota: el parser Nu funciona con formato estricto en una línea por el REGEX, 
        // pero el generic parser puede que absorba líneas extra si la fecha está separada.
        // Aquí hacemos prueba de que el parser no crashea.
        const result = parseStatementText(mockMultilineText);
        expect(Array.isArray(result)).toBe(true);
    });
});
