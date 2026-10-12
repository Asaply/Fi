/**
 * Demo account cleanup.
 *
 * GET|POST /api/demo/cleanup   (Authorization: Bearer $CRON_SECRET)
 *
 * Deletes every demo user older than DEMO_TTL_HOURS along with its rows, so the
 * per-tester accounts created by /api/demo do not pile up. Wired to a daily
 * Vercel cron in vercel.json; also safe to hit by hand.
 *
 * Only touches users whose email is on DEMO_EMAIL_DOMAIN *and* whose metadata
 * carries is_demo — a real account can never match both.
 */
import { NextResponse } from 'next/server';
import { serverError } from '@/lib/apiAuth';
import { DEMO_EMAIL_DOMAIN } from '@/lib/demo/seed';
import { demoAdminClient } from '@/lib/demo/provision';

export const runtime = 'nodejs';
export const maxDuration = 60;

const TTL_HOURS = Number(process.env.DEMO_TTL_HOURS || 72);
const TABLES = ['transactions', 'trading_operations', 'portfolio_assets', 'clients',
    'prospects', 'budget_payments', 'budgets', 'reminders', 'user_config'];
const PAGE_SIZE = 200;

function isExpiredDemo(user, cutoffMs) {
    const meta = user.user_metadata || {};
    const isDemo = meta.is_demo === true
        && String(user.email || '').endsWith(`@${DEMO_EMAIL_DOMAIN}`);
    if (!isDemo) return false;
    // Accounts handed to the iOS test group never expire on a timer — they are
    // retired explicitly with `create-demo-accounts.mjs --delete`.
    if (meta.demo_persistent === true) return false;
    const created = Date.parse(meta.demo_created_at || user.created_at);
    return Number.isFinite(created) && created < cutoffMs;
}

async function handle(request) {
    const secret = process.env.CRON_SECRET;
    if (!secret) return NextResponse.json({ error: 'CRON_SECRET no configurado.' }, { status: 503 });
    if (request.headers.get('authorization') !== `Bearer ${secret}`) {
        return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const supabase = demoAdminClient();
    const cutoffMs = Date.now() - TTL_HOURS * 3600_000;
    const deleted = [];
    const failed = [];

    try {
        // Walk every page. Deleting shifts pagination, so collect first, delete after.
        const expired = [];
        for (let page = 1; ; page++) {
            const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
            if (error) throw new Error(`listUsers: ${error.message}`);
            const users = data?.users || [];
            expired.push(...users.filter(u => isExpiredDemo(u, cutoffMs)));
            if (users.length < PAGE_SIZE) break;
        }

        for (const user of expired) {
            try {
                // budget_payments before budgets in TABLES — FK order matters.
                for (const table of TABLES) {
                    await supabase.from(table).delete().eq('user_id', user.id);
                }
                const { error } = await supabase.auth.admin.deleteUser(user.id);
                if (error) throw new Error(error.message);
                deleted.push(user.email);
            } catch (err) {
                failed.push({ email: user.email, error: err?.message ?? String(err) });
            }
        }
    } catch (err) {
        return serverError('demo/cleanup', err);
    }

    console.log(`[demo/cleanup] ttl=${TTL_HOURS}h eliminados=${deleted.length} fallidos=${failed.length}`);
    return NextResponse.json({ ttlHours: TTL_HOURS, deleted: deleted.length, failed });
}

export const GET = handle;
export const POST = handle;
