import { describe, it, expect } from 'vitest';
import { stalePendingExternalIds } from '../../supabase/functions/_shared/bancos/pending.js';

describe('stalePendingExternalIds', () => {
    const existing = [
        { external_id: 'p1', bank_status: 'pending', date: '2026-10-10' },
        { external_id: 'p2', bank_status: 'pending', date: '2026-10-11' },
        { external_id: 'x1', bank_status: 'processed', date: '2026-10-10' },
        { external_id: 'old', bank_status: 'pending', date: '2026-09-01' },
    ];
    it('marca pendientes del rango que el proveedor ya no devuelve', () => {
        expect(stalePendingExternalIds(existing, ['p2', 'x1'], { from: '2026-10-01', to: '2026-10-12' })).toEqual(['p1']);
    });
    it('no toca procesados ni pendientes fuera del rango', () => {
        expect(stalePendingExternalIds(existing, [], { from: '2026-10-01', to: '2026-10-12' })).toEqual(['p1', 'p2']);
    });
});
