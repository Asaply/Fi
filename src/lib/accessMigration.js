// Derive a user's app_metadata access from the source-of-truth tables, for the
// one-time move off user_metadata. Safe to re-run: same inputs, same output.
import { accessMetadata } from './access';

export function accessFromRecords({ subscription, freeGrant, userMetadata }) {
    const subscriptionActive = subscription?.status === 'active';
    if (subscription && (subscriptionActive || !freeGrant)) {
        return accessMetadata({
            status: subscription.status,
            source: subscription.source,
            expiresAt: subscription.current_period_end,
        });
    }
    if (freeGrant) {
        return accessMetadata({ status: 'free', source: 'free', expiresAt: null });
    }
    // One-time payers from before subscriptions existed may have no row.
    if (userMetadata?.subscription_source === 'stripe_legacy') {
        return accessMetadata({
            status: userMetadata.subscription_status,
            source: 'stripe_legacy',
            expiresAt: userMetadata.subscription_expires_at,
        });
    }
    return null;
}
