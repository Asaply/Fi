import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser, unauthorized, serverError } from '@/lib/apiAuth';
import { auditLog } from '@/lib/auditLog';

export const runtime = 'nodejs';

const FREE_LIMIT = 150;

function getAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

// POST /api/access/claim
// Claims a free lifetime slot for the authenticated user if any of the first
// FREE_LIMIT are still available. Idempotent (same user → same slot).
export async function POST() {
    try {
        const user = await getAuthUser();
        if (!user) return unauthorized();

        const admin = getAdminClient();

        const { data, error } = await admin.rpc('claim_free_slot', {
            p_user_id: user.id,
            p_limit: FREE_LIMIT,
        });
        if (error) return serverError('access/claim rpc', error);

        const row = Array.isArray(data) ? data[0] : data;

        if (row?.granted) {
            const { error: metaErr } = await admin.auth.admin.updateUserById(user.id, {
                user_metadata: {
                    subscription_status: 'free',
                    subscription_source: 'free',
                    subscription_expires_at: null,
                },
            });
            if (metaErr) return serverError('access/claim metadata', metaErr);

            auditLog({ userId: user.id, event: 'free.granted', meta: { slot: row.slot } });
            return NextResponse.json({ granted: true, slot: row.slot });
        }

        return NextResponse.json({ granted: false, requiresPayment: true });
    } catch (err) {
        return serverError('access/claim', err);
    }
}

// GET /api/access/claim — how many free slots remain (for the "quedan X de 150" UI).
// Avoids next/headers (cookies/headers) so it stays compatible with static export.
// The count is non-sensitive; middleware already gates unauthenticated access.
export async function GET() {
    try {
        const admin = getAdminClient();
        const { count, error } = await admin
            .from('free_grants')
            .select('*', { count: 'exact', head: true });
        if (error) return serverError('access/claim count', error);

        const taken = count || 0;
        const remaining = Math.max(0, FREE_LIMIT - taken);
        return NextResponse.json({ taken, limit: FREE_LIMIT, remaining });
    } catch (err) {
        return serverError('access/claim GET', err);
    }
}
