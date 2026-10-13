// In-memory stand-in for the bank-sync backend, shaped exactly like the contract in
// docs/superpowers/specs/2026-10-12-sincronizacion-bancaria-design.md. Lets the
// frontend build every bank screen before a provider is integrated.

export class BancosError extends Error {
    // code: 'no_session' | 'no_subscription' | 'max_links' | 'forbidden' | 'conflict'
    //       | 'not_found' | 'rate_limited' | 'unavailable' | 'unknown'
    constructor(code, { retryAfter = null, message } = {}) {
        super(message || code);
        this.code = code;
        this.retryAfter = retryAfter;
    }
}

export { MAX_LINKS_PER_USER } from '../../../supabase/functions/_shared/bancos/constants.js';
import { MAX_LINKS_PER_USER } from '../../../supabase/functions/_shared/bancos/constants.js';
const SYNC_COOLDOWN_MS = 10 * 60 * 1000;
const SYNC_DURATION_MS = 4000;

function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
}

function initialState() {
    const now = new Date().toISOString();
    return {
        links: [
            { id: 'link-bbva', institution_name: 'BBVA México', status: 'valid', last_synced_at: now, last_error: null },
            { id: 'link-nu', institution_name: 'Nu México', status: 'token_required', last_synced_at: daysAgo(3), last_error: 'El banco pide un token para continuar.' },
        ],
        accounts: [
            { id: 'acc-bbva-deb', link_id: 'link-bbva', name: 'Cuenta Libretón', number_masked: '•••• 4821', account_type: 'debito', currency: 'MXN', balance_current: 18420.55, balance_available: 18420.55, credit_limit: null, cutoff_date: null, payment_due_date: null, minimum_payment: null, no_interest_payment: null, connected: true },
            { id: 'acc-bbva-tdc', link_id: 'link-bbva', name: 'Tarjeta Azul', number_masked: '•••• 9034', account_type: 'credito', currency: 'MXN', balance_current: 7350.0, balance_available: 22650.0, credit_limit: 30000, cutoff_date: daysAgo(-12), payment_due_date: daysAgo(-32), minimum_payment: 650, no_interest_payment: 7350.0, connected: true },
            { id: 'acc-nu-deb', link_id: 'link-nu', name: 'Cuenta Nu', number_masked: '•••• 1177', account_type: 'debito', currency: 'MXN', balance_current: 3210.4, balance_available: 3210.4, credit_limit: null, cutoff_date: null, payment_due_date: null, minimum_payment: null, no_interest_payment: null, connected: true },
        ],
        transactions: [
            tx('t1', 'acc-bbva-deb', 'BBVA México', 'debito', daysAgo(1), 'OXXO REFORMA 22', 'OXXO', 89.5, 'Egreso', 'Comida y Abarrotes', 'regla'),
            tx('t2', 'acc-bbva-deb', 'BBVA México', 'debito', daysAgo(2), 'NOMINA EMPRESA SA DE CV', null, 24500, 'Ingreso', 'Sueldo', 'regla'),
            tx('t3', 'acc-bbva-tdc', 'BBVA México', 'credito', daysAgo(3), 'UBER *TRIP', 'Uber', 142.3, 'Egreso', 'Transporte', 'memoria'),
            tx('t4', 'acc-bbva-tdc', 'BBVA México', 'credito', daysAgo(4), 'MERPAGO*TIENDAXYZ', 'Mercado Pago', 560, 'Egreso', 'Ropa y Accesorios', 'ia'),
            tx('t5', 'acc-bbva-tdc', 'BBVA México', 'credito', daysAgo(0), 'NETFLIX.COM', 'Netflix', 299, 'Egreso', 'Suscripciones', 'regla', { bank_status: 'pending' }),
            // Paying the credit card from the debit account: both sides share a transfer_group_id
            // and must be excluded from income/expense totals.
            tx('t6', 'acc-bbva-deb', 'BBVA México', 'debito', daysAgo(5), 'PAGO TDC 9034 SPEI', null, 5000, 'Egreso', 'Transferencia entre tus cuentas', 'regla', { transfer_group_id: 'tg-1' }),
            tx('t7', 'acc-bbva-tdc', 'BBVA México', 'credito', daysAgo(5), 'SU PAGO GRACIAS', null, 5000, 'Transferencia', 'Transferencia entre tus cuentas', 'regla', { transfer_group_id: 'tg-1' }),
            tx('t8', 'acc-nu-deb', 'Nu México', 'debito', daysAgo(6), 'SPEI RECIBIDO JUAN PEREZ', null, 1200, 'Ingreso', 'Transferencia recibida', 'regla'),
            tx('t9', 'acc-nu-deb', 'Nu México', 'debito', daysAgo(7), 'COMPRA WALMART EXPRESS', 'Walmart', 734.9, 'Egreso', 'Comida y Abarrotes', 'usuario'),
        ],
        lastSync: {},
    };
}

function tx(id, bankAccountId, bank, accountType, date, concept, merchant, amount, type, categoria, origen, extra = {}) {
    return {
        id, date, concept, merchant, amount, type, categoria,
        account_type: accountType, bank, client: 'N/A',
        source: 'banco', external_id: `ext-${id}`, bank_account_id: bankAccountId,
        bank_status: 'processed', categoria_origen: origen, transfer_group_id: null,
        ...extra,
    };
}

let state = initialState();
let options = { delayMs: 300, hasSubscription: true };

// Test/demo helpers — not part of the contract.
export function resetMock(next = {}) {
    state = initialState();
    options = { delayMs: 300, hasSubscription: true, ...next };
}

const wait = () => (options.delayMs > 0 ? new Promise((r) => setTimeout(r, options.delayMs)) : Promise.resolve());
const clone = (v) => JSON.parse(JSON.stringify(v));

function findLink(linkId) {
    const link = state.links.find((l) => l.id === linkId);
    if (!link) throw new BancosError('not_found');
    return link;
}

function finishSyncLater(link) {
    setTimeout(() => {
        if (link.status !== 'syncing') return;
        link.status = 'valid';
        link.last_synced_at = new Date().toISOString();
        link.last_error = null;
    }, SYNC_DURATION_MS);
}

export async function listarBancos() {
    await wait();
    return clone(state.links.filter((l) => l.status !== 'disconnected'));
}

export async function listarCuentas(linkId) {
    await wait();
    return clone(state.accounts.filter((a) => a.link_id === linkId));
}

export async function listarMovimientos() {
    await wait();
    return clone(state.transactions);
}

export async function pedirTokenConexion(linkId) {
    await wait();
    if (!options.hasSubscription) throw new BancosError('no_subscription');
    if (linkId) findLink(linkId);
    else if (state.links.filter((l) => l.status !== 'disconnected').length >= MAX_LINKS_PER_USER) {
        throw new BancosError('max_links');
    }
    return { token: `mock-token-${Date.now()}` };
}

export async function registrarBanco(providerLinkId, institutionName = 'Banco de prueba') {
    await wait();
    if (!options.hasSubscription) throw new BancosError('no_subscription');
    const existing = state.links.find((l) => l.id === providerLinkId);
    if (existing && existing.status !== 'disconnected') {
        // Reconnect flow (widget in update mode) re-registers the same link.
        existing.status = 'syncing';
        finishSyncLater(existing);
        return { link: { id: existing.id, institution_name: existing.institution_name, status: 'syncing' } };
    }
    const link = { id: providerLinkId, institution_name: institutionName, status: 'syncing', last_synced_at: null, last_error: null };
    state.links.push(link);
    finishSyncLater(link);
    return { link: { id: link.id, institution_name: link.institution_name, status: 'syncing' } };
}

export async function sincronizar(linkId) {
    await wait();
    const link = findLink(linkId);
    const last = state.lastSync[linkId] || 0;
    const remaining = SYNC_COOLDOWN_MS - (Date.now() - last);
    if (remaining > 0) throw new BancosError('rate_limited', { retryAfter: Math.ceil(remaining / 1000) });
    state.lastSync[linkId] = Date.now();
    link.status = 'syncing';
    finishSyncLater(link);
    return { status: 'syncing' };
}

export async function desconectar(linkId) {
    await wait();
    const link = findLink(linkId);
    link.status = 'disconnected';
    state.accounts.filter((a) => a.link_id === linkId).forEach((a) => { a.connected = false; });
    return { ok: true };
}

export async function cambiarCategoria(transactionId, categoria) {
    await wait();
    const t = state.transactions.find((x) => x.id === transactionId);
    if (!t) throw new BancosError('not_found');
    t.categoria = categoria;
    t.categoria_origen = 'usuario';
    return clone(t);
}
