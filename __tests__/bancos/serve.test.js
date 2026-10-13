import { describe, it, expect, vi } from 'vitest';
import { createServe } from '../../supabase/functions/_shared/bancos/serve.js';

function fakeCreateClient(userForToken) {
    return vi.fn(() => ({
        auth: { getUser: vi.fn(async (token) => ({ data: { user: token === 'good' ? userForToken : null } })) },
        from: () => { throw new Error('db not used in this test'); },
    }));
}
const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'srv', BANK_PROVIDER: 'mock', BANK_WEBHOOK_SECRET: 's' };

describe('serve', () => {
    it('OPTIONS responde CORS', async () => {
        const serve = createServe({ createClient: fakeCreateClient(), env, waitUntil: () => {} });
        const res = await serve(async () => ({ status: 200, body: {} }))(new Request('https://f', { method: 'OPTIONS' }));
        expect(res.status).toBe(204);
        expect(res.headers.get('access-control-allow-origin')).toBe('*');
    });

    it('resuelve el usuario del Bearer y pasa body y deps al handler', async () => {
        const serve = createServe({ createClient: fakeCreateClient({ id: 'u1' }), env, waitUntil: () => {} });
        const handler = vi.fn(async ({ user, body }, deps) => ({ status: 200, body: { user: user?.id, body, hasProvider: !!deps.provider } }));
        const res = await serve(handler)(new Request('https://f', { method: 'POST', headers: { Authorization: 'Bearer good' }, body: JSON.stringify({ a: 1 }) }));
        expect(await res.json()).toEqual({ user: 'u1', body: { a: 1 }, hasProvider: true });
        expect(res.headers.get('content-type')).toContain('application/json');
    });

    it('token inválido → user null; sin auth → recibe request', async () => {
        const serve = createServe({ createClient: fakeCreateClient({ id: 'u1' }), env, waitUntil: () => {} });
        const res = await serve(async ({ user }) => ({ status: 200, body: { user } }))(new Request('https://f', { method: 'POST', headers: { Authorization: 'Bearer bad' } }));
        expect(await res.json()).toEqual({ user: null });
        const res2 = await serve(async ({ request }) => ({ status: 200, body: { isReq: request instanceof Request } }), { auth: false })(new Request('https://f', { method: 'POST' }));
        expect(await res2.json()).toEqual({ isReq: true });
    });

    it('excepción del handler → 500 sin detalles', async () => {
        const serve = createServe({ createClient: fakeCreateClient(), env, waitUntil: () => {} });
        const res = await serve(async () => { throw new Error('secret detail'); })(new Request('https://f', { method: 'POST' }));
        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({ error: 'internal' });
    });

    it('runInBackground usa waitUntil', async () => {
        const waitUntil = vi.fn();
        const serve = createServe({ createClient: fakeCreateClient(), env, waitUntil });
        await serve(async (_ctx, deps) => { deps.runInBackground(Promise.resolve()); return { status: 200, body: {} }; })(new Request('https://f', { method: 'POST' }));
        expect(waitUntil).toHaveBeenCalledTimes(1);
    });

    it('webhookSecret pasa tal cual: valor definido y undefined si no hay', async () => {
        const probe = async (_ctx, deps) => ({ status: 200, body: { secret: deps.webhookSecret ?? null, has: 'webhookSecret' in deps } });
        const a = createServe({ createClient: fakeCreateClient(), env, waitUntil: () => {} });
        expect(await (await a(probe)(new Request('https://f', { method: 'POST' }))).json()).toEqual({ secret: 's', has: true });
        const { BANK_WEBHOOK_SECRET, ...envNoSecret } = env;
        const b = createServe({ createClient: fakeCreateClient(), env: envNoSecret, waitUntil: () => {} });
        expect(await (await b(probe)(new Request('https://f', { method: 'POST' }))).json()).toEqual({ secret: null, has: true });
    });

    it('método distinto de POST/OPTIONS → 405', async () => {
        const serve = createServe({ createClient: fakeCreateClient(), env, waitUntil: () => {} });
        const res = await serve(async () => ({ status: 200, body: {} }))(new Request('https://f', { method: 'GET' }));
        expect(res.status).toBe(405);
    });
});
