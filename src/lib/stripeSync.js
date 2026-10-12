// Shared logic for reflecting a Stripe subscription into our access model.
// Used by both the webhook and verify-session routes.
import { createClient } from '@supabase/supabase-js';
import { accessMetadata } from './access';

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

// Persist subscription state for a user: subscriptions row + app_metadata (+ mirror).
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

    const access = accessMetadata({ status, source: 'stripe', expiresAt });
    const { error: metaErr } = await admin.auth.admin.updateUserById(userId, {
        app_metadata: access,
        // Mirror for iOS builds already in the App Store, which read access from
        // user_metadata on the client. No server-side check trusts this copy.
        user_metadata: access,
    });
    if (metaErr) throw metaErr;

    return { status, expiresAt };
}
