#!/usr/bin/env node
/**
 * Pre-create the demo accounts handed out to the iOS test group.
 *
 * The TestFlight build is a static bundle — it has no /demo screen and calls the
 * live API on Vercel. Rather than shipping a new build just to add a demo entry
 * point, this script creates the accounts up front: each tester logs in with the
 * normal email/password form that is already in the app.
 *
 * One account per person. Each has its own user_id, so RLS isolates them
 * completely — a tester who deletes everything only wipes their own copy.
 *
 * Needs SUPABASE_SERVICE_ROLE_KEY (read from .env.local or the environment).
 *
 *   node scripts/seed/create-demo-accounts.mjs --count 15
 *   node scripts/seed/create-demo-accounts.mjs --list
 *   node scripts/seed/create-demo-accounts.mjs --reset tester03
 *   node scripts/seed/create-demo-accounts.mjs --reset all
 *   node scripts/seed/create-demo-accounts.mjs --delete all --yes
 *
 * Credentials are printed and written to demo-accounts.csv (gitignored).
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/* ── .env.local ────────────────────────────────────────────────────────── */
// Node does not read .env.local on its own; do it so the script is one command.
try {
    const env = await readFile(path.join(ROOT, '.env.local'), 'utf-8');
    for (const line of env.split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
} catch { /* no .env.local — rely on the real environment */ }

const { demoAdminClient, provisionDemoUser, seedDemoData, wipeDemoData } =
    await import('../../src/lib/demo/provision.js');
const { DEMO_EMAIL_DOMAIN, DEMO_COUNTS } = await import('../../src/lib/demo/seed.js');

/* ── Args ──────────────────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
    const i = argv.indexOf(`--${name}`);
    if (i === -1) return fallback;
    const next = argv[i + 1];
    return next && !next.startsWith('--') ? next : true;
};

const COUNT = Number(flag('count', 10));
const PREFIX = String(flag('prefix', 'tester'));
const OUT_CSV = path.join(ROOT, String(flag('out', 'demo-accounts.csv')));
const DO_LIST = !!flag('list', false);
const DO_RESET = flag('reset', null);
const DO_DELETE = flag('delete', null);
const ASSUME_YES = !!flag('yes', false);

/* ── Readable credentials ──────────────────────────────────────────────── */
// Short, unambiguous Spanish words — no accents, no confusable characters.
// A tester has to type this on a phone keyboard, so length beats entropy games:
// three words out of 64 is ~18 bits, and these accounts hold no real data.
const WORDS = `
arbol barco cielo dedo faro gato hilo isla lago luna mango mesa nido nube ola
oso pato pino playa pluma puerta rama rio roca sal selva sol tigre torre trigo
valle vela viento zorro campo cedro cobre coral cresta duna espiga fresa fuego
grillo hoja huerto jade laurel lienzo lirio manzana miel monte musgo nieve
nogal palma perla pino roble sierra tierra trebol viña
`.trim().split(/\s+/);

/** Three distinct words, hyphen-separated: "mesa-tigre-nube". */
function makePassword() {
    const picked = new Set();
    while (picked.size < 3) picked.add(WORDS[Math.floor(Math.random() * WORDS.length)]);
    return [...picked].join('-');
}
const emailFor = (label) => `${label}@${DEMO_EMAIL_DOMAIN}`;

/* ── Supabase helpers ──────────────────────────────────────────────────── */
const PAGE_SIZE = 200;

/** Every persistent demo account, oldest first. */
async function listDemoUsers(supabase) {
    const found = [];
    for (let page = 1; ; page++) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
        if (error) throw new Error(`listUsers: ${error.message}`);
        const users = data?.users || [];
        found.push(...users.filter(u =>
            u.user_metadata?.is_demo === true
            && u.user_metadata?.demo_persistent === true
            && String(u.email || '').endsWith(`@${DEMO_EMAIL_DOMAIN}`)
        ));
        if (users.length < PAGE_SIZE) break;
    }
    return found.sort((a, b) => String(a.email).localeCompare(String(b.email)));
}

async function confirm(question) {
    if (ASSUME_YES) return true;
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(`${question} [s/N] `);
    rl.close();
    return /^s(i)?$/i.test(answer.trim());
}

/* ── Commands ──────────────────────────────────────────────────────────── */

async function cmdList(supabase) {
    const users = await listDemoUsers(supabase);
    if (!users.length) { console.log('No hay cuentas de prueba creadas.'); return; }
    console.log(`\n${users.length} cuentas de prueba:\n`);
    for (const u of users) {
        const last = u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString('es-MX') : 'nunca';
        console.log(`  ${String(u.email).padEnd(30)} último acceso: ${last}`);
    }
    console.log('\nLas contraseñas no se pueden recuperar. Si se perdieron, usa --reset');
    console.log('para regenerar los datos o borra y vuelve a crear las cuentas.\n');
}

async function cmdCreate(supabase) {
    const existing = new Set((await listDemoUsers(supabase)).map(u => u.email));
    const created = [];

    console.log(`\nCreando ${COUNT} cuentas (${DEMO_COUNTS.transactions} movimientos cada una)…\n`);

    for (let i = 1; created.length < COUNT; i++) {
        const label = `${PREFIX}${String(i).padStart(2, '0')}`;
        const email = emailFor(label);
        if (existing.has(email)) continue; // resume without clobbering

        const password = makePassword();
        try {
            await provisionDemoUser(supabase, {
                email, password, label: `Prueba ${label}`, persistent: true,
            });
            created.push({ label, email, password });
            console.log(`  ✅ ${email.padEnd(30)} ${password}`);
        } catch (err) {
            console.error(`  ❌ ${email} — ${err?.message ?? err}`);
        }
    }

    if (!created.length) { console.log('Nada que crear.'); return; }

    const csv = ['cuenta,email,password', ...created.map(c => `${c.label},${c.email},${c.password}`)].join('\n') + '\n';
    await writeFile(OUT_CSV, csv);
    console.log(`\n${created.length} cuentas listas. Credenciales en ${path.relative(ROOT, OUT_CSV)}`);
    console.log('Reparte una por persona. Cada cuenta está aislada: nadie ve ni borra los datos de otro.\n');
}

async function cmdReset(supabase, target) {
    const users = await listDemoUsers(supabase);
    const picked = target === true || target === 'all'
        ? users
        : users.filter(u => u.email === emailFor(target) || u.email === target);

    if (!picked.length) { console.error(`No se encontró ninguna cuenta para "${target}".`); process.exitCode = 1; return; }
    if (!await confirm(`Borrar y volver a sembrar los datos de ${picked.length} cuenta(s)?`)) {
        console.log('Cancelado.'); return;
    }

    for (const u of picked) {
        try {
            await wipeDemoData(supabase, u.id);
            await seedDemoData(supabase, u.id);
            console.log(`  ✅ ${u.email} regenerada`);
        } catch (err) {
            console.error(`  ❌ ${u.email} — ${err?.message ?? err}`);
        }
    }
    console.log('\nLas contraseñas no cambian — los testers siguen entrando igual.\n');
}

async function cmdDelete(supabase, target) {
    const users = await listDemoUsers(supabase);
    const picked = target === true || target === 'all'
        ? users
        : users.filter(u => u.email === emailFor(target) || u.email === target);

    if (!picked.length) { console.error(`No se encontró ninguna cuenta para "${target}".`); process.exitCode = 1; return; }
    console.log(`\nSe eliminarán ${picked.length} cuenta(s) y todos sus datos:`);
    for (const u of picked) console.log(`  ${u.email}`);
    if (!await confirm('\n¿Continuar? Esto no se puede deshacer.')) { console.log('Cancelado.'); return; }

    for (const u of picked) {
        try {
            await wipeDemoData(supabase, u.id);
            const { error } = await supabase.auth.admin.deleteUser(u.id);
            if (error) throw new Error(error.message);
            console.log(`  ✅ ${u.email} eliminada`);
        } catch (err) {
            console.error(`  ❌ ${u.email} — ${err?.message ?? err}`);
        }
    }
}

/* ── Main ──────────────────────────────────────────────────────────────── */
async function main() {
    const supabase = demoAdminClient();
    if (DO_LIST) return cmdList(supabase);
    if (DO_DELETE) return cmdDelete(supabase, DO_DELETE);
    if (DO_RESET) return cmdReset(supabase, DO_RESET);
    return cmdCreate(supabase);
}

main().catch(err => {
    console.error(`\n${err?.message ?? err}\n`);
    process.exit(1);
});
