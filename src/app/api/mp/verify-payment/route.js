import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';

function getAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

// No session required — ownership verified through MP's external_reference (server-to-server).
// An attacker providing a payment_id can only activate the rightful owner of that payment,
// which is harmless since that user already paid.
export async function GET(request) {
    // Rate limit by IP: 20 attempts per minute
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const rl = checkRateLimit(`verify-payment-ip:${ip}`, { maxRequests: 20, windowMs: 60_000 });
    if (!rl.allowed) {
        return NextResponse.json({ error: 'Demasiadas solicitudes.' }, { status: 429 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const paymentId = searchParams.get('payment_id');

        if (!paymentId || !/^\d+$/.test(paymentId)) {
            return NextResponse.json({ error: 'Missing or invalid payment_id' }, { status: 400 });
        }

        // Fetch payment from MP (server-to-server)
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
        });

        if (!mpRes.ok) {
            console.error('[verify-payment] MP fetch failed for payment:', paymentId);
            return NextResponse.json({ error: 'Error verificando pago.' }, { status: 502 });
        }

        const payment = await mpRes.json();
        const userId = payment.external_reference; // set by our server at preference creation
        const status = payment.status;

        if (!userId) {
            return NextResponse.json({ status, activated: false });
        }

        if (status !== 'approved') {
            return NextResponse.json({ status, activated: false });
        }

        const supabase = getAdminClient();

        // Upsert subscription record
        await supabase
            .from('subscriptions')
            .upsert({
                user_id: userId,
                status: 'active',
                mp_payment_id: String(paymentId),
                mp_payment_data: payment,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });

        // Activate user metadata
        const { error: metaErr } = await supabase.auth.admin.updateUserById(userId, {
            user_metadata: { subscription_status: 'active' },
        });

        if (metaErr) {
            console.error('[verify-payment] Metadata update error:', metaErr.message);
            return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
        }

        return NextResponse.json({ status, activated: true, userId });

    } catch (err) {
        console.error('[verify-payment] Error:', err?.message);
        return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
    }
}
