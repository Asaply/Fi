// Shared logic for reflecting a Stripe subscription into our access model.
// Used by both the webhook and verify-session routes.
import { createClient } from '@supabase/supabase-js';

export function getAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

// Map a Stripe subscription.status → our subscription_status.
// past_due stays 'active' until the period end (the access helper's expiry
// check handles the cutoff); canceled/unpaid become 'expired'.
const STRIPE_STATUS_MAP = {
    active: 'active',
    trialing: 'active',
    past_due: 'active',
    canceled: 'expired',
    unpaid: 'expired',
    incomplete: 'none',
    incomplete_expired: 'expired',
};

export function mapStripeSubscription(sub) {
    const status = STRIPE_STATUS_MAP[sub.status] || 'none';
    const expiresAt = sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null;
    return { status, expiresAt };
}

function customerId(sub) {
    return typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null;
}

// Persist subscription state for a user: subscriptions row + user_metadata.
// updateUserById shallow-merges user_metadata, so other keys (onboarded…) survive.
export async function applyStripeSubscription(admin, userId, sub) {
    const { status, expiresAt } = mapStripeSubscription(sub);

    const { error: upsertErr } = await admin
        .from('subscriptions')
        .upsert({
            user_id: userId,
            status: status === 'active' ? 'active' : 'expired',
            source: 'stripe',
            stripe_customer_id: customerId(sub),
            stripe_subscription_id: sub.id,
            current_period_end: expiresAt,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
    if (upsertErr) console.error('[stripeSync] subscriptions upsert (non-fatal):', upsertErr.message);

    const { error: metaErr } = await admin.auth.admin.updateUserById(userId, {
        user_metadata: {
            subscription_status: status,
            subscription_source: 'stripe',
            subscription_expires_at: expiresAt,
        },
    });
    if (metaErr) throw metaErr;

    return { status, expiresAt };
}
