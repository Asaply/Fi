/**
 * Distributed rate limiter — uses Supabase anon_rate_limits table.
 * Works across all Vercel instances and survives cold starts.
 */

import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
    );
}

/**
 * @param {string} key          — e.g. user ID or `stripe-verify:<ip>`
 * @param {object} opts
 * @param {number} opts.maxRequests  — max calls per window (default 10)
 * @param {number} opts.windowMs     — window in ms (default 60_000)
 * @returns {Promise<{ allowed: boolean, remaining: number, resetAt: number }>}
 */
export async function checkRateLimit(key, { maxRequests = 10, windowMs = 60_000 } = {}) {
    const supabase = getAdminClient();
    const now = new Date();

    const { data, error } = await supabase
        .from('anon_rate_limits')
        .select('count, reset_at')
        .eq('key', key)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('[rateLimit] fetch error:', error.message);
        // Fail open — don't block user on DB error
        return { allowed: true, remaining: maxRequests - 1, resetAt: now.getTime() + windowMs };
    }

    const resetAt = data ? new Date(data.reset_at) : null;
    const windowExpired = !data || now >= resetAt;

    if (windowExpired) {
        const newResetAt = new Date(now.getTime() + windowMs).toISOString();
        await supabase.from('anon_rate_limits').upsert(
            { key, count: 1, reset_at: newResetAt },
            { onConflict: 'key' }
        );
        return { allowed: true, remaining: maxRequests - 1, resetAt: now.getTime() + windowMs };
    }

    if (data.count >= maxRequests) {
        return { allowed: false, remaining: 0, resetAt: resetAt.getTime() };
    }

    await supabase
        .from('anon_rate_limits')
        .update({ count: data.count + 1 })
        .eq('key', key);

    return { allowed: true, remaining: maxRequests - (data.count + 1), resetAt: resetAt.getTime() };
}
