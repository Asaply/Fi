#!/usr/bin/env node
// Copy each user's access into app_metadata from `subscriptions` + `free_grants`.
// user_metadata is never copied (the user can edit it). Users whose
// user_metadata grants access today but who have no backing row are listed as
// "PERDERÍA ACCESO" for manual reconciling; they are not granted anything.
// Dry-run by default; pass --apply to write. Safe to re-run.
//   node scripts/migrate-access-to-app-metadata.mjs
//   node scripts/migrate-access-to-app-metadata.mjs --apply
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { accessFromRecords, losesAccess, sameAccess } from '../src/lib/accessMigration.js';

function loadEnvLocal() {
    if (!fs.existsSync('.env.local')) return;
    for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
}

loadEnvLocal();
const apply = process.argv.includes('--apply');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
    console.error('Faltan NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
}
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function allUsers() {
    const users = [];
    for (let page = 1; ; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        users.push(...data.users);
        if (data.users.length < 1000) return users;
    }
}

// PostgREST caps each response at 1000 rows; read every page so no row is dropped.
const PAGE = 1000;
async function selectAll(table, columns) {
    const rows = [];
    for (let from = 0; ; from += PAGE) {
        const { data, error } = await admin
            .from(table)
            .select(columns)
            .order('user_id')
            .range(from, from + PAGE - 1);
        if (error) throw new Error(`${table}: ${error.message}`);
        rows.push(...data);
        if (data.length < PAGE) return rows;
    }
}

const subs = await selectAll('subscriptions', 'user_id, status, source, current_period_end');
const grants = await selectAll('free_grants', 'user_id');
const subByUser = new Map(subs.map((s) => [s.user_id, s]));
const grantByUser = new Map(grants.map((g) => [g.user_id, g]));

const users = await allUsers();
const counts = {};
const changed = [];
const wouldLose = [];
let toWrite = 0;
let written = 0;
const failed = [];
for (const user of users) {
    const access = accessFromRecords({
        subscription: subByUser.get(user.id) || null,
        freeGrant: grantByUser.get(user.id) || null,
    });
    const label = access ? `${access.subscription_status}/${access.subscription_source}` : 'sin acceso';
    counts[label] = (counts[label] || 0) + 1;

    const um = user.user_metadata || {};
    if (losesAccess(um, access)) {
        wouldLose.push(`${user.email} (${um.subscription_status ?? '—'}/${um.subscription_source ?? '—'}/${um.subscription_expires_at ?? 'sin vencimiento'})`);
    }
    if (!access) continue;

    if (sameAccess(user.app_metadata || {}, access)) continue;
    toWrite++;

    if (um.subscription_status !== access.subscription_status) {
        changed.push(`${user.email}: user_metadata=${um.subscription_status ?? '—'} → ${access.subscription_status}`);
    }
    if (apply) {
        const { error } = await admin.auth.admin.updateUserById(user.id, { app_metadata: access });
        if (error) failed.push(`${user.email}: ${error.message}`);
        else written++;
    }
}

console.log(`Usuarios: ${users.length}`);
console.table(counts);
if (changed.length) {
    console.log('Difieren de su user_metadata actual (revisar):');
    for (const line of changed) console.log('  ' + line);
}
console.log('');
console.log(`!!! PERDERÍA ACCESO (reconciliar a mano antes de --apply): ${wouldLose.length}`);
for (const line of wouldLose) console.log('  ' + line);
console.log('');
if (!apply) {
    console.log(`Escribiría: ${toWrite}`);
    console.log('Dry-run: no se escribió nada. Usa --apply para escribir.');
} else {
    console.log(`Escritos: ${written}`);
    if (failed.length) {
        console.log(`Fallaron: ${failed.length}`);
        for (const line of failed) console.log('  ' + line);
        process.exitCode = 1;
    } else {
        console.log('✓ app_metadata escrito.');
    }
}
