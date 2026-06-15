import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auditLog } from '@/lib/auditLog';
import { getAdminClient, applyStripeSubscription } from '@/lib/stripeSync';

export const runtime = 'nodejs';

function getStripe() { return new Stripe(process.env.STRIPE_SECRET_KEY); }

// Resolve our user id from a Stripe subscription (metadata) or, failing that,
// from the stored subscriptions row keyed by stripe_subscription_id.
async function resolveUserId(admin, sub) {
    if (sub.metadata?.user_id) return sub.metadata.user_id;
    const { data } = await admin
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_subscription_id', sub.id)
        .maybeSingle();
    return data?.user_id || null;
}

export async function POST(request) {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    let event;
    try {
        event = getStripe().webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('[stripe/webhook] Invalid signature:', err.message);
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const stripe = getStripe();
    const admin = getAdminClient();

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                if (session.mode !== 'subscription') break;
                const userId = session.client_reference_id || session.metadata?.user_id;
                if (!userId || !session.subscription) break;
                const sub = await stripe.subscriptions.retrieve(session.subscription);
                if (!sub.metadata?.user_id) {
                    // Ensure future subscription events can resolve the user.
                    await stripe.subscriptions.update(sub.id, { metadata: { user_id: userId } });
                }
                await applyStripeSubscription(admin, userId, sub);
                auditLog({ userId, event: 'subscription.activated', meta: { source: 'webhook', subscription_id: sub.id } });
                break;
            }

            case 'customer.subscription.created':
            case 'customer.subscription.updated':
            case 'customer.subscription.deleted': {
                const sub = event.data.object;
                const userId = await resolveUserId(admin, sub);
                if (!userId) { console.warn('[stripe/webhook] No user for sub', sub.id); break; }
                const { status } = await applyStripeSubscription(admin, userId, sub);
                auditLog({ userId, event: `subscription.${event.type}`, meta: { subscription_id: sub.id, status } });
                break;
            }

            case 'invoice.paid': {
                const invoice = event.data.object;
                if (!invoice.subscription) break;
                const sub = await stripe.subscriptions.retrieve(invoice.subscription);
                const userId = await resolveUserId(admin, sub);
                if (!userId) break;
                await applyStripeSubscription(admin, userId, sub);  // bumps expires_at on renewal
                auditLog({ userId, event: 'subscription.renewed', meta: { subscription_id: sub.id } });
                break;
            }

            // invoice.payment_failed: Stripe keeps the sub past_due and retries.
            // We leave access until current_period_end (handled by the expiry check);
            // a later customer.subscription.updated → canceled/unpaid will expire it.
            default:
                break;
        }
    } catch (err) {
        console.error('[stripe/webhook] Handler error:', err?.message);
        return NextResponse.json({ error: 'handler_error' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
