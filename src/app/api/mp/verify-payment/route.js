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

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const paymentId = searchParams.get('payment_id');

        if (!paymentId) {
            return NextResponse.json({ error: 'Missing payment_id' }, { status: 400 });
        }

        // Fetch payment from MP
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
        });

        if (!mpRes.ok) {
            console.error('[verify-payment] MP fetch failed for payment:', paymentId);
            return NextResponse.json({ error: 'MP fetch failed' }, { status: 502 });
        }

        const payment = await mpRes.json();
        const userId = payment.external_reference;
        const status = payment.status; // approved | rejected | pending | in_process

        if (!userId) {
            console.error('[verify-payment] No external_reference for payment:', paymentId);
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

        // Activate user metadata immediately
        const { error: metaErr } = await supabase.auth.admin.updateUserById(userId, {
            user_metadata: { subscription_status: 'active' },
        });

        if (metaErr) {
            console.error('[verify-payment] Metadata update error:', metaErr.message);
            return NextResponse.json({ status, activated: false, error: metaErr.message }, { status: 500 });
        }

        return NextResponse.json({ status, activated: true });

    } catch (err) {
        console.error('[verify-payment] Error:', err?.message);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
