/**
 * Distributed rate limiter for anonymous users.
 * Uses Supabase so limits persist across Vercel instances and cold starts.
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
 * @param {string} key      — e.g. `anon:<ip>`
 * @param {number} max      — max requests in window
 * @param {number} windowMs — window size in ms
 * @returns {{ allowed: boolean, remaining: number }}
 */
export async function checkAnonRateLimit(key, max = 1, windowMs = 24 * 60 * 60_000) {
    const supabase = getAdminClient();
    const now = new Date();

    // Fetch current record
    const { data, error } = await supabase
        .from('anon_rate_limits')
        .select('count, reset_at')
        .eq('key', key)
        .single();

    if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows found — that's fine, treat as first request
        console.error('[rateLimitAnon] fetch error:', error.message);
        // Fail open — don't block user on DB error
        return { allowed: true, remaining: max - 1 };
    }

    const resetAt = data ? new Date(data.reset_at) : null;
    const windowExpired = !data || now >= resetAt;

    if (windowExpired) {
        // New window — upsert with count=1
        const newResetAt = new Date(now.getTime() + windowMs).toISOString();
        await supabase.from('anon_rate_limits').upsert(
            { key, count: 1, reset_at: newResetAt },
            { onConflict: 'key' }
        );
        return { allowed: true, remaining: max - 1 };
    }

    if (data.count >= max) {
        return { allowed: false, remaining: 0 };
    }

    // Increment
    await supabase
        .from('anon_rate_limits')
        .update({ count: data.count + 1 })
        .eq('key', key);

    return { allowed: true, remaining: max - (data.count + 1) };
}
