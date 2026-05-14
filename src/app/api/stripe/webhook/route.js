import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function getStripe() { return new Stripe(process.env.STRIPE_SECRET_KEY); }

function getAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

export async function POST(request) {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    let event;
    try {
        event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('[stripe/webhook] Invalid signature:', err.message);
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userId = session.client_reference_id || session.metadata?.user_id;
        const paid = session.payment_status === 'paid';

        if (!userId || !paid) {
            console.warn('[stripe/webhook] Missing userId or not paid:', session.id);
            return NextResponse.json({ ok: true });
        }

        const supabase = getAdminClient();

        await supabase
            .from('subscriptions')
            .upsert({
                user_id: userId,
                status: 'active',
                stripe_session_id: session.id,
                stripe_payment_data: session,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });

        const { error: metaErr } = await supabase.auth.admin.updateUserById(userId, {
            user_metadata: { subscription_status: 'active' },
        });

        if (metaErr) console.error('[stripe/webhook] Metadata update error:', metaErr.message);
    }

    return NextResponse.json({ ok: true });
}
