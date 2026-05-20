import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit } from '@/lib/rateLimit';
import { auditLog, getIp } from '@/lib/auditLog';

export const runtime = 'nodejs';

function getStripe() { return new Stripe(process.env.STRIPE_SECRET_KEY); }

function getAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

export async function GET(request) {
    const ip = getIp(request);
    const rl = await checkRateLimit(`stripe-verify:${ip}`, { maxRequests: 20, windowMs: 60_000 });
    if (!rl.allowed) {
        return NextResponse.json({ error: 'Demasiadas solicitudes.' }, { status: 429 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('session_id');

        if (!sessionId || !sessionId.startsWith('cs_')) {
            return NextResponse.json({ error: 'Invalid session_id' }, { status: 400 });
        }

        const session = await getStripe().checkout.sessions.retrieve(sessionId);
        const userId = session.client_reference_id || session.metadata?.user_id;
        const paid = session.payment_status === 'paid';

        console.log('[stripe/verify-session] userId:', userId, 'paid:', paid, 'payment_status:', session.payment_status);

        if (!userId || !paid) {
            return NextResponse.json({ paid: false });
        }

        const supabase = getAdminClient();

        // upsert is best-effort — don't let it block activation
        const { error: upsertErr } = await supabase
            .from('subscriptions')
            .upsert({
                user_id: userId,
                status: 'active',
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });

        if (upsertErr) {
            console.error('[stripe/verify-session] Upsert error (non-fatal):', upsertErr.message);
        }

        console.log('[stripe/verify-session] Calling updateUserById for:', userId);
        const { data: updatedUser, error: metaErr } = await supabase.auth.admin.updateUserById(userId, {
            user_metadata: { subscription_status: 'active' },
        });

        console.log('[stripe/verify-session] updateUserById result:', updatedUser?.user?.id, 'error:', metaErr?.message);

        if (metaErr) {
            console.error('[stripe/verify-session] Metadata error:', metaErr.message);
            return NextResponse.json({ paid: false, error: metaErr.message }, { status: 500 });
        }

        auditLog({ userId, event: 'payment.activated', meta: { source: 'verify-session', session_id: sessionId }, ip });

        return NextResponse.json({ paid: true, activated: true });

    } catch (err) {
        console.error('[stripe/verify-session] Error:', err?.message);
        return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
    }
}
