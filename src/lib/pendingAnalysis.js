// The free analysis at /analyze runs before the user has an account, so its
// result is parked in sessionStorage until they sign up and land on /finanzas.
import { resolverCategoria } from './categorias';

export const PENDING_ANALYSIS_KEY = 'nva_pending_analysis';

// Normalize the account type the parser reports ("Débito", "credito", …).
export function tipoCuentaDe(analysis) {
    const raw = String(analysis?.tipo_cuenta || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return raw.startsWith('cred') ? 'credito' : 'debito';
}

// Map a POST /api/analyze response to rows for the `transactions` table.
// Mirrors the PDF import in /finanzas so both paths store the same shape.
export function analysisToTransactionRows(analysis, userId, memoria) {
    const transactions = analysis?.transactions;
    if (!Array.isArray(transactions)) return [];

    const accountType = tipoCuentaDe(analysis);
    return transactions
        .map((t, idx) => ({
            date: t.fecha,
            concept: t.concepto || `Transacción ${idx + 1}`,
            amount: Math.abs(Number(t.monto) || 0),
            type: t.tipo === 'ajuste' ? 'Ajuste' : (t.tipo === 'ingreso' || t.tipo === 'abono') ? 'Ingreso' : 'Egreso',
            client: 'N/A',
            categoria: resolverCategoria(t.concepto || '', t.categoria, memoria, t.tipo),
            account_type: accountType,
            bank: t.banco || analysis.bank || 'Desconocido',
            user_id: userId,
        }))
        .filter(r => r.amount > 0 && r.date);
}
