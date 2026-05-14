import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser, unauthorized } from '@/lib/apiAuth';
import { checkRateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';

function getAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

export async function GET(request) {
    // Require authenticated user
    const user = await getAuthUser();
    if (!user) return unauthorized();

    // Rate limit: 10 attempts per minute per user
    const rl = checkRateLimit(`verify-payment:${user.id}`, { maxRequests: 10, windowMs: 60_000 });
    if (!rl.allowed) {
        return NextResponse.json({ error: 'Demasiadas solicitudes.' }, {
            status: 429,
            headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
        });
    }

    try {
        const { searchParams } = new URL(request.url);
        const paymentId = searchParams.get('payment_id');

        if (!paymentId || !/^\d+$/.test(paymentId)) {
            return NextResponse.json({ error: 'Missing or invalid payment_id' }, { status: 400 });
        }

        // Fetch payment from MP
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
        });

        if (!mpRes.ok) {
            console.error('[verify-payment] MP fetch failed for payment:', paymentId);
            return NextResponse.json({ error: 'Error verificando pago.' }, { status: 502 });
        }

        const payment = await mpRes.json();
        const paymentOwner = payment.external_reference;
        const status = payment.status;

        // Ownership check: payment must belong to the authenticated user
        if (!paymentOwner || paymentOwner !== user.id) {
            console.warn('[verify-payment] Ownership mismatch:', { user: user.id, owner: paymentOwner, paymentId });
            return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
        }

        if (status !== 'approved') {
            return NextResponse.json({ status, activated: false });
        }

        const supabase = getAdminClient();

        // Upsert subscription record
        await supabase
            .from('subscriptions')
            .upsert({
                user_id: user.id,
                status: 'active',
                mp_payment_id: String(paymentId),
                mp_payment_data: payment,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });

        // Activate user metadata immediately
        const { error: metaErr } = await supabase.auth.admin.updateUserById(user.id, {
            user_metadata: { subscription_status: 'active' },
        });

        if (metaErr) {
            console.error('[verify-payment] Metadata update error:', metaErr.message);
            return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
        }

        return NextResponse.json({ status, activated: true });

    } catch (err) {
        console.error('[verify-payment] Error:', err?.message);
        return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
    }
}
