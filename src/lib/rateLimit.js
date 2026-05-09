/**
 * In-memory rate limiter keyed by user ID.
 * NOTE: Per-instance — resets on cold start. Adequate for burst protection;
 * for distributed rate limiting across Vercel instances, use Vercel KV or Supabase.
 */

const store = new Map(); // userId → { count, resetAt }

/**
 * Check and increment rate limit for a user.
 * @param {string} userId
 * @param {object} opts
 * @param {number} opts.maxRequests  — max calls per window (default 10)
 * @param {number} opts.windowMs    — rolling window in ms (default 60_000 = 1 min)
 * @returns {{ allowed: boolean, remaining: number, resetAt: number }}
 */
export function checkRateLimit(userId, { maxRequests = 10, windowMs = 60_000 } = {}) {
    const now = Date.now();
    const entry = store.get(userId);

    maybePrune();

    if (!entry || now >= entry.resetAt) {
        // New window
        store.set(userId, { count: 1, resetAt: now + windowMs });
        return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
    }

    if (entry.count >= maxRequests) {
        return { allowed: false, remaining: 0, resetAt: entry.resetAt };
    }

    entry.count++;
    return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

let lastPrune = Date.now();

function maybePrune() {
    const now = Date.now();
    if (now - lastPrune < 5 * 60_000) return;
    lastPrune = now;
    for (const [key, val] of store.entries()) {
        if (now >= val.resetAt) store.delete(key);
    }
}
