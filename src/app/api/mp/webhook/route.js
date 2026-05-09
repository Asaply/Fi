import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function getAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

export async function POST(request) {
    try {
        const body = await request.json();

        // MercadoPago sends topic=payment for payment notifications
        const topic = body.type || body.topic;
        const paymentId = body.data?.id || body.id;

        if (topic !== 'payment' || !paymentId) {
            return NextResponse.json({ ok: true });
        }

        // Fetch payment details from MP
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
        });

        if (!mpRes.ok) {
            console.error('[mp/webhook] Failed to fetch payment:', paymentId);
            return NextResponse.json({ error: 'MP fetch failed' }, { status: 500 });
        }

        const payment = await mpRes.json();
        const userId = payment.external_reference;
        const status = payment.status; // approved | rejected | pending

        if (!userId) {
            console.error('[mp/webhook] No external_reference in payment:', paymentId);
            return NextResponse.json({ ok: true });
        }

        const supabase = getAdminClient();

        // Upsert subscription record
        const { error: dbErr } = await supabase
            .from('subscriptions')
            .upsert({
                user_id: userId,
                status: status === 'approved' ? 'active' : status,
                mp_payment_id: String(paymentId),
                mp_payment_data: payment,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });

        if (dbErr) console.error('[mp/webhook] DB upsert error:', dbErr.message);

        // If approved → update user metadata so middleware can check fast
        if (status === 'approved') {
            const { error: metaErr } = await supabase.auth.admin.updateUserById(userId, {
                user_metadata: { subscription_status: 'active' },
            });
            if (metaErr) console.error('[mp/webhook] Metadata update error:', metaErr.message);
        }

        return NextResponse.json({ ok: true });

    } catch (err) {
        console.error('[mp/webhook] Error:', err?.message);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
