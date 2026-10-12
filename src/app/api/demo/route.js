/**
 * Demo account provisioning, on demand (web).
 *
 * POST /api/demo  { code }  →  { email, password }
 *
 * Creates a throwaway Supabase user *per tester* and seeds it with the demo
 * dataset. Every tester gets their own user_id, so RLS keeps them fully
 * isolated: importing, editing or deleting in one demo never touches another.
 * The caller signs in with the returned credentials.
 *
 * The iOS TestFlight group does NOT use this route — those accounts are
 * pre-created with scripts/seed/create-demo-accounts.mjs and handed out as
 * plain credentials, so no new app build is needed. Same seed either way.
 *
 * Guarded by DEMO_ACCESS_CODE — without that env var the endpoint is disabled,
 * so this can never become an open user-creation hole.
 */
import { NextResponse } from 'next/server';
import { serverError } from '@/lib/apiAuth';
import { checkAnonRateLimit } from '@/lib/rateLimitAnon';
import { auditLog, getIp } from '@/lib/auditLog';
import { DEMO_EMAIL_DOMAIN } from '@/lib/demo/seed';
import { demoAdminClient, provisionDemoUser } from '@/lib/demo/provision';

export const runtime = 'nodejs';
export const maxDuration = 60;

const DEMOS_PER_IP = Number(process.env.DEMO_MAX_PER_IP || 5);
const RATE_WINDOW_MS = 24 * 60 * 60_000;

const randomHex = (bytes) =>
    Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
        .map(b => b.toString(16).padStart(2, '0')).join('');

export async function POST(request) {
    const accessCode = process.env.DEMO_ACCESS_CODE;
    if (!accessCode) {
        return NextResponse.json({ error: 'El modo demo no está habilitado.' }, { status: 503 });
    }

    let body = {};
    try { body = await request.json(); } catch { /* empty body → invalid code below */ }
    if (String(body.code || '').trim() !== accessCode) {
        return NextResponse.json({ error: 'Código de acceso inválido.' }, { status: 403 });
    }

    const ip = getIp(request);
    const { allowed } = await checkAnonRateLimit(`demo:${ip || 'unknown'}`, DEMOS_PER_IP, RATE_WINDOW_MS);
    if (!allowed) {
        return NextResponse.json(
            { error: `Alcanzaste el límite de ${DEMOS_PER_IP} demos por día. Vuelve a entrar con el acceso que ya creaste.` },
            { status: 429 }
        );
    }

    const email = `demo-${randomHex(8)}@${DEMO_EMAIL_DOMAIN}`;
    const password = randomHex(16);

    try {
        const { userId, counts } = await provisionDemoUser(demoAdminClient(), { email, password });
        auditLog({ userId, event: 'demo.created', meta: { counts }, ip });
        return NextResponse.json({ email, password, counts });
    } catch (err) {
        return serverError('demo/create', err);
    }
}
