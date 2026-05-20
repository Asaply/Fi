/**
 * Audit log — fire-and-forget server-side event logger.
 * Writes to `audit_logs` table via service role (bypasses RLS).
 * Never throws — logging failure must not break the request.
 */

import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
    );
}

/**
 * @param {object} params
 * @param {string|null} params.userId   — auth user ID (null for anonymous events)
 * @param {string}      params.event    — e.g. 'analysis.completed'
 * @param {object}      [params.meta]   — additional context (no PII beyond user_id)
 * @param {string}      [params.ip]     — request IP
 */
export async function auditLog({ userId = null, event, meta = {}, ip = null }) {
    try {
        const supabase = getAdminClient();
        await supabase.from('audit_logs').insert({
            user_id: userId,
            event,
            metadata: meta,
            ip,
        });
    } catch (err) {
        // Never let logging break the main request
        console.error('[auditLog] Failed to write log:', err?.message);
    }
}

/** Extract IP from a NextRequest */
export function getIp(request) {
    return (
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        null
    );
}
