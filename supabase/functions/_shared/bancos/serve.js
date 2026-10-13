// HTTP glue for the bank-* Edge Functions: CORS, JSON, Supabase auth and deps.
// createClient / env / waitUntil are injected by each Deno entrypoint, so this
// file stays runtime-agnostic and testable in Node.
import { userHasAccess } from '../access.js';
import { createDb } from './db.js';
import { getProvider } from './provider/index.js';
import { createAnthropicClassifier } from './ai.js';

const CORS = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
};

function json(status, body) {
    return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });
}

export function createServe({ createClient, env, waitUntil }) {
    return function serve(handler, { auth = true } = {}) {
        return async (req) => {
            if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
            if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

            const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
                auth: { persistSession: false, autoRefreshToken: false },
            });
            const deps = {
                db: createDb(admin),
                provider: getProvider(env),
                classify: createAnthropicClassifier({ apiKey: env.ANTHROPIC_API_KEY }),
                now: () => new Date(),
                runInBackground: (p) => waitUntil(Promise.resolve(p).catch((e) => console.error('[bancos] background', e))),
                userHasAccess,
                webhookSecret: env.BANK_WEBHOOK_SECRET,
            };

            try {
                let ctx;
                if (auth) {
                    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
                    let user = null;
                    if (token) {
                        const { data } = await admin.auth.getUser(token);
                        user = data?.user ?? null;
                    }
                    let body = {};
                    try { body = await req.json(); } catch { body = {}; }
                    ctx = { user, body };
                } else {
                    ctx = { request: req };
                }
                const { status, body } = await handler(ctx, deps);
                return json(status, body);
            } catch (e) {
                console.error('[bancos]', e);
                return json(500, { error: 'internal' });
            }
        };
    };
}
