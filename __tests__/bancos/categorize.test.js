import { describe, it, expect, vi } from 'vitest';
import { buildMemory, categorizeRows } from '../../supabase/functions/_shared/bancos/categorize.js';

const row = (concept, type = 'Egreso', merchant = null) => ({ concept, merchant, type, amount: 100, categoria: null, categoria_origen: null });

describe('categorizeRows', () => {
    it('la memoria del usuario gana a las reglas', async () => {
        const memoria = buildMemory([{ concept: 'UBER *TRIP', categoria: 'Viaje / Hospedaje' }]);
        const [r] = await categorizeRows([row('UBER *TRIP')], { memoria });
        expect(r).toMatchObject({ categoria: 'Viaje / Hospedaje', categoria_origen: 'memoria' });
    });
    it('las reglas resuelven lo conocido sin llamar a la IA', async () => {
        const classify = vi.fn();
        const [r] = await categorizeRows([row('NETFLIX.COM')], { memoria: new Map(), classify });
        expect(r.categoria_origen).toBe('regla');
        expect(classify).not.toHaveBeenCalled();
    });
    it('lo que queda en Otros va a la IA en un solo lote', async () => {
        const classify = vi.fn().mockResolvedValue(['Entretenimiento', 'Otros']);
        const out = await categorizeRows([row('ZZQX 1'), row('ZZQX 2')], { memoria: new Map(), classify });
        expect(classify).toHaveBeenCalledTimes(1);
        expect(out[0]).toMatchObject({ categoria: 'Entretenimiento', categoria_origen: 'ia' });
        expect(out[1]).toMatchObject({ categoria: 'Otros', categoria_origen: null });
    });
    it('categoría inventada por la IA → Otros', async () => {
        const [r] = await categorizeRows([row('ZZQX')], { memoria: new Map(), classify: async () => ['Criptogatos'] });
        expect(r).toMatchObject({ categoria: 'Otros', categoria_origen: null });
    });
    it('si la IA falla quedan en Otros para reintentar', async () => {
        const [r] = await categorizeRows([row('ZZQX')], { memoria: new Map(), classify: async () => { throw new Error('down'); } });
        expect(r).toMatchObject({ categoria: 'Otros', categoria_origen: null });
    });
    it('sin clasificador no falla', async () => {
        const [r] = await categorizeRows([row('ZZQX')], { memoria: new Map(), classify: null });
        expect(r.categoria).toBe('Otros');
    });
    it('no modifica las filas de entrada', async () => {
        const input = [row('NETFLIX.COM')];
        await categorizeRows(input, { memoria: new Map() });
        expect(input[0].categoria).toBe(null);
    });
    it('la IA no puede asignar la categoría reservada de transferencias', async () => {
        const [r] = await categorizeRows([row('ZZQX')], { memoria: new Map(), classify: async () => ['Transferencia entre tus cuentas'] });
        expect(r).toMatchObject({ categoria: 'Otros', categoria_origen: null });
    });
    it('la IA no puede asignar una categoría de ingreso a un egreso', async () => {
        const [r] = await categorizeRows([row('ZZQX', 'Egreso')], { memoria: new Map(), classify: async () => ['Sueldo'] });
        expect(r).toMatchObject({ categoria: 'Otros', categoria_origen: null });
    });
    it('la IA sí puede asignar una categoría de ingreso a un ingreso', async () => {
        const [r] = await categorizeRows([row('ZZQX', 'Ingreso')], { memoria: new Map(), classify: async () => ['Sueldo'] });
        expect(r).toMatchObject({ categoria: 'Sueldo', categoria_origen: 'ia' });
    });
});
