// Data layer for the bank screens. Screens import ONLY from here, never from
// mock.js or Supabase directly, so switching from mock to the real backend needs
// no UI changes. Contract: docs/superpowers/specs/2026-10-12-sincronizacion-bancaria-design.md
//
// NEXT_PUBLIC_BANCOS_MOCK=1 in .env.local → in-memory demo data (mock.js).
import { supabase } from '@/lib/supabaseClient';
import * as mock from './mock';
import { BancosError } from './mock';

export { BancosError, MAX_LINKS_PER_USER } from './mock';

const useMock = process.env.NEXT_PUBLIC_BANCOS_MOCK === '1';

const STATUS_TO_CODE = { 401: 'no_session', 402: 'no_subscription', 403: 'forbidden', 404: 'not_found', 429: 'rate_limited', 503: 'unavailable' };

async function invoke(name, body) {
    const { data, error } = await supabase.functions.invoke(name, { body });
    if (!error) return data;
    const res = error.context; // Response for HTTP errors from the function
    const status = res?.status;
    let payload = {};
    try { payload = await res.json(); } catch { /* non-JSON body */ }
    let code = STATUS_TO_CODE[status] || 'unknown';
    if (status === 409) code = payload.error === 'max_links' ? 'max_links' : 'conflict';
    throw new BancosError(code, { retryAfter: payload.retry_after ?? null, message: payload.error });
}

async function select(query) {
    const { data, error } = await query;
    if (error) throw new BancosError('unknown', { message: error.message });
    return data || [];
}

export async function listarBancos() {
    if (useMock) return mock.listarBancos();
    return select(supabase.from('bank_links')
        .select('id, institution_name, status, last_synced_at, last_error')
        .neq('status', 'disconnected')
        .order('created_at', { ascending: true }));
}

export async function listarCuentas(linkId) {
    if (useMock) return mock.listarCuentas(linkId);
    return select(supabase.from('bank_accounts')
        .select('id, link_id, name, number_masked, account_type, currency, balance_current, balance_available, credit_limit, cutoff_date, payment_due_date, minimum_payment, no_interest_payment, connected')
        .eq('link_id', linkId));
}

// Only for bank screens in mock mode; the existing finanzas/dashboard queries
// keep reading `transactions` directly.
export async function listarMovimientos() {
    if (useMock) return mock.listarMovimientos();
    return select(supabase.from('transactions').select('*').order('date', { ascending: false }));
}

export async function pedirTokenConexion(linkId) {
    if (useMock) return mock.pedirTokenConexion(linkId);
    return invoke('bank-connect-token', linkId ? { link_id: linkId } : {});
}

export async function registrarBanco(providerLinkId) {
    if (useMock) return mock.registrarBanco(providerLinkId);
    return invoke('bank-register-link', { provider_link_id: providerLinkId });
}

export async function sincronizar(linkId) {
    if (useMock) return mock.sincronizar(linkId);
    return invoke('bank-sync', { link_id: linkId });
}

export async function desconectar(linkId) {
    if (useMock) return mock.desconectar(linkId);
    return invoke('bank-disconnect', { link_id: linkId });
}

export async function cambiarCategoria(transactionId, categoria) {
    if (useMock) return mock.cambiarCategoria(transactionId, categoria);
    const { data, error } = await supabase.from('transactions')
        .update({ categoria, categoria_origen: 'usuario' })
        .eq('id', transactionId)
        .select()
        .single();
    if (error) throw new BancosError('unknown', { message: error.message });
    return data;
}

// Income/expense totals must ignore transfers between the user's own accounts.
export function cuentaParaTotales(t) {
    return !t.transfer_group_id;
}
