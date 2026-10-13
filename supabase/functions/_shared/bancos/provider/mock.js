// In-memory provider with realistic Mexican data. Used by tests and to exercise
// the whole backend before a real provider is integrated. Never set it in production.

const KINDS = new Set(['accounts_ready', 'transactions_ready', 'new_transactions', 'link_invalid', 'link_token_required']);

function isoDaysAgo(now, n) {
    return new Date(now.getTime() - n * 86400000).toISOString().slice(0, 10);
}

export function createMockProvider({ now = new Date() } = {}) {
    const links = new Map();
    let seq = 0;

    function txFor(linkId) {
        const d = (n) => isoDaysAgo(now, n);
        const deb = `${linkId}-deb`;
        const tdc = `${linkId}-tdc`;
        const t = (id, accountId, date, description, merchant, amount, direction, status = 'processed') =>
            ({ id: `${linkId}-${id}`, accountId, date, description, merchant, amount, direction, status, currency: 'MXN' });
        return [
            t('t1', deb, d(1), 'OXXO REFORMA 22', 'OXXO', 89.5, 'out'),
            t('t2', deb, d(2), 'NOMINA EMPRESA SA DE CV', null, 24500, 'in'),
            t('t3', tdc, d(3), 'UBER *TRIP', 'Uber', 142.3, 'out'),
            t('t4', tdc, d(4), 'ZZQX COMERCIO RARO', null, 560, 'out'),
            t('t5', tdc, d(0), 'NETFLIX.COM', 'Netflix', 299, 'out', 'pending'),
            t('t6', deb, d(5), 'PAGO TDC 9034 SPEI', null, 5000, 'out'),
            t('t7', tdc, d(5), 'SU PAGO GRACIAS', null, 5000, 'in'),
            t('t8', deb, d(40), 'COMPRA WALMART EXPRESS', 'Walmart', 734.9, 'out'),
            t('t9', deb, d(200), 'CFE SUMINISTRADOR', 'CFE', 612, 'out'),
        ];
    }

    return {
        name: 'mock',

        simulateConnect({ userId, institutionName = 'Banco de prueba' }) {
            const id = `mock-link-${++seq}`;
            links.set(id, { id, externalUserId: userId, institutionCode: 'mock_bank', institutionName, recurrent: true });
            return id;
        },

        async createConnectToken({ userId, providerLinkId } = {}) {
            return { token: `mock-${userId}-${providerLinkId || 'new'}` };
        },

        async getLink(providerLinkId) {
            return links.get(providerLinkId) || null;
        },

        async listAccounts(providerLinkId) {
            if (!links.has(providerLinkId)) return [];
            return [
                { id: `${providerLinkId}-deb`, name: 'Cuenta de prueba', numberMasked: '•••• 4821', kind: 'debit', currency: 'MXN', balanceCurrent: 18420.55, balanceAvailable: 18420.55, credit: null },
                { id: `${providerLinkId}-tdc`, name: 'Tarjeta de prueba', numberMasked: '•••• 9034', kind: 'credit', currency: 'MXN', balanceCurrent: 7350, balanceAvailable: 22650,
                  credit: { limit: 30000, cutoffDate: isoDaysAgo(now, -12), paymentDueDate: isoDaysAgo(now, -32), minimumPayment: 650, noInterestPayment: 7350 } },
            ];
        },

        async listTransactions(providerLinkId, { from, to }) {
            if (!links.has(providerLinkId)) return [];
            return txFor(providerLinkId).filter((t) => t.date >= from && t.date <= to);
        },

        async deleteLink(providerLinkId) {
            links.delete(providerLinkId);
        },

        async parseWebhook(request, secret) {
            if (!secret || request.headers.get('x-webhook-secret') !== secret) return { authorized: false };
            let body = {};
            try { body = await request.json(); } catch { body = {}; }
            const kind = KINDS.has(body.kind) ? body.kind : 'ignored';
            return { authorized: true, event: { kind, providerLinkId: body.providerLinkId ?? null, message: body.message ?? null } };
        },
    };
}
