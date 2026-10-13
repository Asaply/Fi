// Normalized provider data → rows for bank_accounts / transactions.
// Provider adapters must emit ProviderAccount / ProviderTransaction (see plan Task 3).

function numOrNull(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

export function mapAccount(pa, { userId, linkId }) {
    const credit = pa.kind === 'credit' ? (pa.credit || {}) : null;
    return {
        user_id: userId,
        link_id: linkId,
        provider_account_id: pa.id,
        name: pa.name ?? null,
        number_masked: pa.numberMasked ?? null,
        account_type: pa.kind === 'credit' ? 'credito' : 'debito',
        currency: pa.currency || 'MXN',
        balance_current: numOrNull(pa.balanceCurrent),
        balance_available: numOrNull(pa.balanceAvailable),
        credit_limit: credit ? numOrNull(credit.limit) : null,
        cutoff_date: credit?.cutoffDate ?? null,
        payment_due_date: credit?.paymentDueDate ?? null,
        minimum_payment: credit ? numOrNull(credit.minimumPayment) : null,
        no_interest_payment: credit ? numOrNull(credit.noInterestPayment) : null,
        connected: true,
    };
}

// A payment into a credit card is 'Transferencia' — same convention the CSV
// import already uses for credit statements.
export function mapTransaction(pt, { userId, account, bankName }) {
    const isCredit = account.account_type === 'credito';
    const type = pt.direction === 'in' ? (isCredit ? 'Transferencia' : 'Ingreso') : 'Egreso';
    return {
        user_id: userId,
        source: 'banco',
        external_id: pt.id,
        bank_account_id: account.id,
        date: pt.date,
        concept: String(pt.description || '').trim().slice(0, 200) || 'Movimiento',
        merchant: pt.merchant || null,
        amount: Math.abs(Number(pt.amount) || 0),
        type,
        account_type: account.account_type,
        bank: bankName || 'Banco',
        client: 'N/A',
        bank_status: pt.status === 'pending' ? 'pending' : 'processed',
        categoria: null,
        categoria_origen: null,
        transfer_group_id: null,
    };
}
