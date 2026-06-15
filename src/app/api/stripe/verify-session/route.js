import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { checkRateLimit } from '@/lib/rateLimit';
import { auditLog, getIp } from '@/lib/auditLog';
import { getAdminClient, applyStripeSubscription } from '@/lib/stripeSync';

export const runtime = 'nodejs';

function getStripe() { return new Stripe(process.env.STRIPE_SECRET_KEY); }

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

        const stripe = getStripe();
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        const userId = session.client_reference_id || session.metadata?.user_id;
        const paid = session.payment_status === 'paid';

        if (!userId || !paid || !session.subscription) {
            return NextResponse.json({ paid: false });
        }

        const admin = getAdminClient();
        const sub = await stripe.subscriptions.retrieve(session.subscription);

        // Make sure the subscription carries user_id so later webhooks resolve it.
        if (!sub.metadata?.user_id) {
            try { await stripe.subscriptions.update(sub.id, { metadata: { user_id: userId } }); } catch (_) {}
        }

        try {
            await applyStripeSubscription(admin, userId, sub);
        } catch (metaErr) {
            console.error('[stripe/verify-session] Metadata error:', metaErr.message);
            return NextResponse.json({ paid: false, error: metaErr.message }, { status: 500 });
        }

        auditLog({ userId, event: 'subscription.activated', meta: { source: 'verify-session', session_id: sessionId }, ip });

        return NextResponse.json({ paid: true, activated: true });

    } catch (err) {
        console.error('[stripe/verify-session] Error:', err?.message);
        return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
    }
}
