/**
 * Demo account provisioning — shared by the /api/demo route (web, on demand)
 * and scripts/seed/create-demo-accounts.mjs (pre-created accounts for the iOS
 * TestFlight group).
 *
 * Uses relative imports and no Next.js APIs so a plain `node` script can import
 * it directly.
 */
import { createClient } from '@supabase/supabase-js';
import { buildDemoSeed, DEMO_COUNTS } from './seed.js';

/** Supabase rejects statements far larger than this in one insert. */
const CHUNK = 250;

/** Service-role client. Bypasses RLS — server/CLI only, never ship this key. */
export function demoAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY.');
    }
    return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Metadata that makes a demo account usable immediately: past onboarding, past
 * the paywall, and tagged so cleanup can find it. `subscription_status: 'free'`
 * satisfies hasAccess() without touching the free_grants promo table.
 *
 * `demo_persistent` marks the accounts handed out to the iOS test group: they
 * are meant to live for the whole testing round, so /api/demo/cleanup skips
 * them no matter their age. Only the on-demand web demos expire.
 */
export function demoUserMetadata(label, { persistent = false } = {}) {
    return {
        full_name: label || 'Cuenta de prueba',
        onboarded: true,
        subscription_status: 'free',
        subscription_source: 'free',
        subscription_expires_at: null,
        is_demo: true,
        demo_persistent: persistent,
        demo_created_at: new Date().toISOString(),
    };
}

async function insertChunked(supabase, table, rows) {
    for (let i = 0; i < rows.length; i += CHUNK) {
        const { error } = await supabase.from(table).insert(rows.slice(i, i + CHUNK));
        if (error) throw new Error(`${table}: ${error.message}`);
    }
}

/** Remove every seeded row for a user, leaving the auth account in place. */
export async function wipeDemoData(supabase, userId) {
    // budget_payments before budgets — FK order.
    const tables = ['transactions', 'portfolio_assets', 'budget_payments', 'budgets',
        'reminders', 'trading_operations'];
    for (const table of tables) {
        const { error } = await supabase.from(table).delete().eq('user_id', userId);
        if (error) throw new Error(`${table} (borrado): ${error.message}`);
    }
}

/** Insert the full demo dataset for an existing user. */
export async function seedDemoData(supabase, userId, now = Date.now()) {
    const seed = buildDemoSeed(userId, now);

    await insertChunked(supabase, 'transactions', seed.transactions);
    await insertChunked(supabase, 'portfolio_assets', seed.portfolio);

    // Budgets first — their generated ids are what payments and reminders link to.
    let { data: budgetRows, error: bErr } = await supabase
        .from('budgets')
        .insert(seed.budgets.map(b => b.budget))
        .select('id, name');

    // `icon` was added to /budgets after supabase-budgets.sql shipped. If the
    // column is missing (supabase-demo.sql not run yet), seed without it rather
    // than failing the whole account.
    if (bErr && /icon/i.test(bErr.message)) {
        console.warn('[demo] columna budgets.icon ausente — corre supabase-demo.sql');
        ({ data: budgetRows, error: bErr } = await supabase
            .from('budgets')
            .insert(seed.budgets.map(({ budget: { icon, ...rest } }) => rest))
            .select('id, name'));
    }
    if (bErr) throw new Error(`budgets: ${bErr.message}`);

    const budgetIdByName = Object.fromEntries((budgetRows || []).map(b => [b.name, b.id]));

    const payments = seed.budgets.flatMap(({ budget, payments }) =>
        payments.map(p => ({ ...p, budget_id: budgetIdByName[budget.name] }))
    ).filter(p => p.budget_id);
    if (payments.length) await insertChunked(supabase, 'budget_payments', payments);

    await insertChunked(supabase, 'reminders', seed.reminders.map(({ row, budgetName }) => ({
        ...row,
        budget_id: budgetName ? budgetIdByName[budgetName] ?? null : null,
    })));

    return DEMO_COUNTS;
}

/**
 * Create a demo auth user and seed it. Deletes the half-built account if
 * seeding fails, so a failure never leaves an unusable login behind.
 *
 * @returns {Promise<{ userId: string, counts: typeof DEMO_COUNTS }>}
 */
export async function provisionDemoUser(supabase, { email, password, label, persistent = false }) {
    const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: demoUserMetadata(label, { persistent }),
    });
    if (error) throw new Error(`createUser: ${error.message}`);

    const userId = data.user.id;
    try {
        const counts = await seedDemoData(supabase, userId);
        return { userId, counts };
    } catch (err) {
        try { await supabase.auth.admin.deleteUser(userId); } catch { /* best effort */ }
        throw err;
    }
}
