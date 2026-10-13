// Single source of truth for "does this user have access to the app".
// Pure, dependency-free — safe to import from edge middleware, server routes,
// and client components alike.
//
// app_metadata shape:
//   subscription_status: 'active' | 'free' | 'expired' | 'none'
//   subscription_source: 'stripe' | 'apple' | 'free' | 'stripe_legacy' | undefined
//   subscription_expires_at: ISO string | null   // null = never expires (free + legacy)

// Grace window after expiry before we lock the user out. Covers the gap between
// a subscription period ending and the renewal webhook (Apple/Stripe) arriving.
const GRACE_MS = 24 * 60 * 60 * 1000; // 24h

export function hasAccess(meta, now = Date.now()) {
    if (!meta) return false;
    const status = meta.subscription_status;

    // Grandfathered free tier — never expires.
    if (status === 'free') return true;

    if (status === 'active') {
        // Legacy one-time payers + free have no expiry → always valid.
        if (!meta.subscription_expires_at) return true;
        const expires = new Date(meta.subscription_expires_at).getTime();
        if (Number.isNaN(expires)) return true; // be permissive on bad data
        return expires + GRACE_MS > now;
    }

    return false;
}

// Access lives in app_metadata, which only the server (service role) can write.
// user_metadata is editable by the user from the browser, so it must never
// decide access.
export function getAccessMeta(user) {
    return user?.app_metadata || null;
}

export function userHasAccess(user, now = Date.now()) {
    return hasAccess(getAccessMeta(user), now);
}

// Where a signed-in user belongs: onboarding first, then paywall, then the app.
export function postAuthDestination(user) {
    if (!user?.user_metadata?.onboarded) return '/onboarding';
    if (!userHasAccess(user)) return '/paywall';
    return '/finanzas';
}

// Shape written to app_metadata (and mirrored to user_metadata for old iOS builds).
export function accessMetadata({ status, source, expiresAt }) {
    return {
        subscription_status: status,
        subscription_source: source,
        subscription_expires_at: expiresAt ?? null,
    };
}
