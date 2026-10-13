// Derive a user's app_metadata access from the source-of-truth tables, for the
// one-time move off user_metadata. Safe to re-run: same inputs, same output.
// Access comes only from `subscriptions` and `free_grants`; user_metadata is
// user-editable, so it is never copied into app_metadata.
// Imported by a plain Node ESM script: keep explicit `.js` extensions.
import { accessMetadata, hasAccess } from './access.js';

export function accessFromRecords({ subscription, freeGrant }) {
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
    return null;
}

// True when the user has access today through user_metadata but would not once
// access is read from the derived app_metadata. These need manual reconciling.
export function losesAccess(userMetadata, access, now = Date.now()) {
    return hasAccess(userMetadata, now) && !hasAccess(access, now);
}

// Expiry dates come back from PostgREST as `+00:00` and from JS as `.000Z`;
// compare instants, not strings.
function sameExpiry(a, b) {
    const left = a ?? null;
    const right = b ?? null;
    if (left === null || right === null) return left === right;
    return Date.parse(left) === Date.parse(right);
}

// Whether the user's current app_metadata already holds the derived access.
export function sameAccess(current, access) {
    return (current?.subscription_status === access.subscription_status) &&
        (current?.subscription_source === access.subscription_source) &&
        sameExpiry(current?.subscription_expires_at, access.subscription_expires_at);
}
