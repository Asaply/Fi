// Period filter options for /finanzas and the start date each one maps to.

export const PERIODOS_FIN = [
    { value: '1m', label: 'Este mes' },
    { value: '3m', label: '3 meses' },
    { value: '6m', label: '6 meses' },
    { value: '1y', label: 'Este año' },
    { value: 'Todos', label: 'Todos' },
];

export function getFechaInicioFin(periodo) {
    const now = new Date();
    switch (periodo) {
        case '1m': return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        case '3m': return new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split('T')[0];
        case '6m': return new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString().split('T')[0];
        case '1y': return new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        case 'Todos': return '2000-01-01';
        default:   return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    }
}
