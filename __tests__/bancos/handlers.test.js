import { describe, it, expect, vi } from 'vitest';
import {
    handleConnectToken, handleRegisterLink, handleSync, handleDisconnect, handleWebhook, deleteAllUserLinks,
} from '../../supabase/functions/_shared/bancos/handlers.js';
import { createMockProvider } from '../../supabase/functions/_shared/bancos/provider/mock.js';
import { createFakeBankDb } from '../helpers/fakeBankDb.js';

const user = { id: 'u1' };
const other = { id: 'u2' };

function makeDeps(over = {}) {
    let clock = new Date('2026-10-13T12:00:00Z');
    const background = [];
    const deps = {
        db: createFakeBankDb(),
        provider: createMockProvider({ now: clock }),
        classify: null,
        now: () => clock,
        runInBackground: (p) => background.push(p),
        userHasAccess: (u) => u?.id !== 'no-access',
        webhookSecret: 's3cret',
        ...over,
    };
    return { deps, background, advance: (sec) => { clock = new Date(clock.getTime() + sec * 1000); } };
}

const flush = (bg) => Promise.all(bg);
const hook = (body, secret = 's3cret') => new Request('https://x', { method: 'POST', headers: { 'x-webhook-secret': secret }, body: JSON.stringify(body) });

describe('guardas comunes', () => {
    it('sin sesión 401, sin acceso 402, sin proveedor 503', async () => {
        const { deps } = makeDeps();
        expect((await handleConnectToken({ user: null, body: {} }, deps)).status).toBe(401);
        expect((await handleConnectToken({ user: { id: 'no-access' }, body: {} }, deps)).status).toBe(402);
        const none = makeDeps({ provider: null }).deps;
        expect(await handleConnectToken({ user, body: {} }, none)).toEqual({ status: 503, body: { error: 'provider_unavailable' } });
    });
});

describe('conectar y registrar', () => {
    it('token, registro, sincronización en segundo plano', async () => {
        const { deps, background } = makeDeps();
        expect((await handleConnectToken({ user, body: {} }, deps)).body.token).toMatch(/^mock-/);
        const pid = deps.provider.simulateConnect({ userId: 'u1', institutionName: 'BBVA' });
        const res = await handleRegisterLink({ user, body: { provider_link_id: pid } }, deps);
        expect(res.status).toBe(200);
        expect(res.body.link).toMatchObject({ institution_name: 'BBVA', status: 'syncing' });
        await flush(background);
        expect(deps.db.state.links[0].status).toBe('valid');
        expect(deps.db.state.transactions.length).toBeGreaterThan(0);
    });

    it('link de otro usuario → 403; ya registrado → 409; inexistente → 400', async () => {
        const { deps, background } = makeDeps();
        const pid = deps.provider.simulateConnect({ userId: 'u1' });
        expect((await handleRegisterLink({ user: other, body: { provider_link_id: pid } }, deps)).status).toBe(403);
        await handleRegisterLink({ user, body: { provider_link_id: pid } }, deps);
        await flush(background);
        expect((await handleRegisterLink({ user, body: { provider_link_id: pid } }, deps)).body.error).toBe('conflict');
        expect((await handleRegisterLink({ user, body: { provider_link_id: 'nope' } }, deps)).body.error).toBe('invalid_link');
        expect((await handleRegisterLink({ user, body: {} }, deps)).body.error).toBe('invalid_link');
    });

    it('límite de 5 bancos; reconectar uno existente sí se permite', async () => {
        const { deps } = makeDeps();
        for (let i = 0; i < 5; i++) {
            const pid = deps.provider.simulateConnect({ userId: 'u1' });
            await handleRegisterLink({ user, body: { provider_link_id: pid } }, deps);
        }
        expect((await handleConnectToken({ user, body: {} }, deps)).body.error).toBe('max_links');
        const linkId = deps.db.state.links[0].id;
        expect((await handleConnectToken({ user, body: { link_id: linkId } }, deps)).status).toBe(200);
        expect((await handleConnectToken({ user: other, body: { link_id: linkId } }, deps)).status).toBe(404);
    });

    it('re-registrar un link con token_required lo vuelve a sincronizar', async () => {
        const { deps, background } = makeDeps();
        const pid = deps.provider.simulateConnect({ userId: 'u1' });
        await handleRegisterLink({ user, body: { provider_link_id: pid } }, deps);
        await flush(background);
        deps.db.state.links[0].status = 'token_required';
        const res = await handleRegisterLink({ user, body: { provider_link_id: pid } }, deps);
        expect(res.status).toBe(200);
        await flush(background);
        expect(deps.db.state.links[0].status).toBe('valid');
    });
});

describe('sincronizar manualmente', () => {
    it('202 y luego 429 con retry_after durante 10 minutos', async () => {
        const { deps, advance } = makeDeps();
        const pid = deps.provider.simulateConnect({ userId: 'u1' });
        const { body } = await handleRegisterLink({ user, body: { provider_link_id: pid } }, deps);
        expect((await handleSync({ user, body: { link_id: body.link.id } }, deps)).status).toBe(202);
        const limited = await handleSync({ user, body: { link_id: body.link.id } }, deps);
        expect(limited.status).toBe(429);
        expect(limited.body.retry_after).toBe(600);
        advance(601);
        expect((await handleSync({ user, body: { link_id: body.link.id } }, deps)).status).toBe(202);
        expect((await handleSync({ user: other, body: { link_id: body.link.id } }, deps)).status).toBe(404);
    });
});

describe('desconectar', () => {
    it('borra en el proveedor, marca link y cuentas; los movimientos se quedan', async () => {
        const { deps, background } = makeDeps();
        const pid = deps.provider.simulateConnect({ userId: 'u1' });
        const { body } = await handleRegisterLink({ user, body: { provider_link_id: pid } }, deps);
        await flush(background);
        const before = deps.db.state.transactions.length;
        expect((await handleDisconnect({ user, body: { link_id: body.link.id } }, deps)).body).toEqual({ ok: true });
        expect(await deps.provider.getLink(pid)).toBe(null);
        expect(deps.db.state.links[0].status).toBe('disconnected');
        expect(deps.db.state.accounts.every((a) => a.connected === false)).toBe(true);
        expect(deps.db.state.transactions).toHaveLength(before);
    });
});

describe('webhook', () => {
    it('secreto incorrecto → 401', async () => {
        const { deps } = makeDeps();
        expect((await handleWebhook({ request: hook({}, 'bad') }, deps)).status).toBe(401);
    });
    it('link desconocido → 200 ignorado', async () => {
        const { deps, background } = makeDeps();
        const res = await handleWebhook({ request: hook({ kind: 'new_transactions', providerLinkId: 'nope' }) }, deps);
        expect(res).toEqual({ status: 200, body: { received: true, ignored: true } });
        expect(background).toHaveLength(0);
    });
    it('movimientos nuevos → sincroniza; estados del link → actualiza', async () => {
        const { deps, background } = makeDeps();
        const pid = deps.provider.simulateConnect({ userId: 'u1' });
        await handleRegisterLink({ user, body: { provider_link_id: pid } }, deps);
        await flush(background);
        background.length = 0;
        await handleWebhook({ request: hook({ kind: 'new_transactions', providerLinkId: pid }) }, deps);
        expect(background).toHaveLength(1);
        await handleWebhook({ request: hook({ kind: 'link_token_required', providerLinkId: pid, message: 'token' }) }, deps);
        expect(deps.db.state.links[0]).toMatchObject({ status: 'token_required', last_error: 'token' });
        await handleWebhook({ request: hook({ kind: 'link_invalid', providerLinkId: pid }) }, deps);
        expect(deps.db.state.links[0].status).toBe('invalid');
    });
});

describe('errores de sincronización en segundo plano', () => {
    it('se guardan en last_error y no rompen', async () => {
        const provider = createMockProvider();
        const pid = provider.simulateConnect({ userId: 'u1' });
        provider.listAccounts = vi.fn().mockRejectedValue(new Error('banco caído'));
        const { deps, background } = makeDeps({ provider });
        await handleRegisterLink({ user, body: { provider_link_id: pid } }, deps);
        await flush(background);
        expect(deps.db.state.links[0]).toMatchObject({ status: 'syncing', last_error: 'banco caído' });
    });
});

describe('el link conserva su estado si falla la sincronización', () => {
    it('sincronización manual de un link token_required que falla lo deja token_required', async () => {
        const { deps, background, advance } = makeDeps();
        const pid = deps.provider.simulateConnect({ userId: 'u1' });
        const { body } = await handleRegisterLink({ user, body: { provider_link_id: pid } }, deps);
        await flush(background);
        deps.db.state.links[0].status = 'token_required';
        deps.provider.listAccounts = vi.fn().mockRejectedValue(new Error('banco caído'));
        advance(601);
        background.length = 0;
        expect((await handleSync({ user, body: { link_id: body.link.id } }, deps)).status).toBe(202);
        await flush(background);
        expect(deps.db.state.links[0]).toMatchObject({ status: 'token_required', last_error: 'banco caído' });
    });

    it('re-registrar un link token_required con el proveedor caído lo deja token_required', async () => {
        const { deps, background } = makeDeps();
        const pid = deps.provider.simulateConnect({ userId: 'u1' });
        await handleRegisterLink({ user, body: { provider_link_id: pid } }, deps);
        await flush(background);
        deps.db.state.links[0].status = 'token_required';
        deps.provider.listAccounts = vi.fn().mockRejectedValue(new Error('banco caído'));
        background.length = 0;
        expect((await handleRegisterLink({ user, body: { provider_link_id: pid } }, deps)).status).toBe(200);
        await flush(background);
        expect(deps.db.state.links[0]).toMatchObject({ status: 'token_required', last_error: 'banco caído' });
    });

    it('webhook de movimientos sobre un link invalid que falla lo deja invalid', async () => {
        const { deps, background } = makeDeps();
        const pid = deps.provider.simulateConnect({ userId: 'u1' });
        await handleRegisterLink({ user, body: { provider_link_id: pid } }, deps);
        await flush(background);
        deps.db.state.links[0].status = 'invalid';
        deps.provider.listAccounts = vi.fn().mockRejectedValue(new Error('banco caído'));
        background.length = 0;
        await handleWebhook({ request: hook({ kind: 'new_transactions', providerLinkId: pid }) }, deps);
        await flush(background);
        expect(deps.db.state.links[0]).toMatchObject({ status: 'invalid', last_error: 'banco caído' });
    });
});

describe('endurecimiento', () => {
    it('webhook sin secreto configurado → 503 sin cambiar estado', async () => {
        const { deps, background } = makeDeps({ webhookSecret: undefined });
        const pid = deps.provider.simulateConnect({ userId: 'u1' });
        await handleRegisterLink({ user, body: { provider_link_id: pid } }, deps);
        await flush(background);
        const before = JSON.stringify(deps.db.state);
        background.length = 0;
        const res = await handleWebhook({ request: hook({ kind: 'link_invalid', providerLinkId: pid }, '') }, deps);
        expect(res).toEqual({ status: 503, body: { error: 'webhook_not_configured' } });
        expect(JSON.stringify(deps.db.state)).toBe(before);
        expect(background).toHaveLength(0);
    });

    it('link_id que no es string → 404', async () => {
        const { deps } = makeDeps();
        for (const link_id of [123, {}, [], 'x'.repeat(101)]) {
            expect((await handleSync({ user, body: { link_id } }, deps)).status).toBe(404);
            expect((await handleDisconnect({ user, body: { link_id } }, deps)).status).toBe(404);
            expect((await handleConnectToken({ user, body: { link_id } }, deps)).status).toBe(404);
        }
    });
});

describe('deleteAllUserLinks sin la migración aplicada', () => {
    const missing = (message) => async () => { throw new Error(message); };

    it('tabla bank_links inexistente → 0 links, no bloquea borrar la cuenta', async () => {
        for (const message of [
            "Could not find the table 'public.bank_links' in the schema cache",
            'relation "public.bank_links" does not exist',
        ]) {
            const { deps } = makeDeps({ provider: null });
            deps.db.listUserLinks = missing(message);
            expect(await deleteAllUserLinks({ userId: 'u1' }, deps)).toBe(0);
        }
    });

    it('cualquier otro error de base de datos sí aborta', async () => {
        const { deps } = makeDeps({ provider: null });
        deps.db.listUserLinks = missing('connection refused');
        await expect(deleteAllUserLinks({ userId: 'u1' }, deps)).rejects.toThrow('connection refused');
    });

    it('error de otra tabla no se confunde con bank_links', async () => {
        const { deps } = makeDeps({ provider: null });
        deps.db.listUserLinks = missing('relation "public.transactions" does not exist');
        await expect(deleteAllUserLinks({ userId: 'u1' }, deps)).rejects.toThrow('transactions');
    });
});

describe('deleteAllUserLinks', () => {
    it('borra todos los links activos del usuario en el proveedor', async () => {
        const { deps } = makeDeps();
        const p1 = deps.provider.simulateConnect({ userId: 'u1' });
        const p2 = deps.provider.simulateConnect({ userId: 'u1' });
        await handleRegisterLink({ user, body: { provider_link_id: p1 } }, deps);
        await handleRegisterLink({ user, body: { provider_link_id: p2 } }, deps);
        expect(await deleteAllUserLinks({ userId: 'u1' }, deps)).toBe(2);
        expect(await deps.provider.getLink(p1)).toBe(null);
    });
    it('sin links no necesita proveedor; con links y sin proveedor lanza', async () => {
        const { deps } = makeDeps({ provider: null });
        expect(await deleteAllUserLinks({ userId: 'u1' }, deps)).toBe(0);
        await deps.db.insertLink({ user_id: 'u1', provider_link_id: 'x', status: 'valid' });
        await expect(deleteAllUserLinks({ userId: 'u1' }, deps)).rejects.toThrow('provider_unavailable');
    });
});

describe('historial completo en los eventos históricos del proveedor', () => {
    async function registered() {
        const ctx = makeDeps();
        const pid = ctx.deps.provider.simulateConnect({ userId: 'u1' });
        await handleRegisterLink({ user, body: { provider_link_id: pid } }, ctx.deps);
        await flush(ctx.background);
        ctx.background.length = 0;
        ctx.advance(3600);
        const spy = vi.spyOn(ctx.deps.provider, 'listTransactions');
        return { ...ctx, pid, spy };
    }

    for (const kind of ['transactions_ready', 'accounts_ready']) {
        it(`${kind} después del registro pide 365 días aunque ya haya last_synced_at`, async () => {
            const { deps, background, pid, spy } = await registered();
            expect(deps.db.state.links[0].last_synced_at).toBeTruthy();
            await handleWebhook({ request: hook({ kind, providerLinkId: pid }) }, deps);
            await flush(background);
            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy.mock.calls[0][1]).toEqual({ from: '2025-10-13', to: '2026-10-13' });
        });
    }

    it('new_transactions sigue usando la ventana incremental', async () => {
        const { deps, background, pid, spy } = await registered();
        await handleWebhook({ request: hook({ kind: 'new_transactions', providerLinkId: pid }) }, deps);
        await flush(background);
        expect(spy.mock.calls[0][1]).toEqual({ from: '2026-10-10', to: '2026-10-13' });
    });
});

describe('desconectar durante una sincronización en curso', () => {
    // listTransactions blocks until `release(result)`; disconnect happens meanwhile.
    function gatedProvider(deps) {
        const original = deps.provider.listTransactions.bind(deps.provider);
        let release;
        const gate = new Promise((r) => { release = r; });
        deps.provider.listTransactions = async (id, range) => {
            const fail = await gate;
            if (fail) throw new Error(fail);
            return original(id, range);
        };
        return (fail = null) => release(fail);
    }

    for (const [label, failure] of [['termina bien', null], ['falla', 'banco caído']]) {
        it(`si la sincronización ${label} después, el link sigue desconectado`, async () => {
            const { deps, background } = makeDeps();
            const pid = deps.provider.simulateConnect({ userId: 'u1' });
            const release = gatedProvider(deps);
            const { body } = await handleRegisterLink({ user, body: { provider_link_id: pid } }, deps);
            await new Promise((r) => setTimeout(r, 0));
            expect((await handleDisconnect({ user, body: { link_id: body.link.id } }, deps)).body).toEqual({ ok: true });
            release(failure);
            await flush(background);
            expect(deps.db.state.links[0].status).toBe('disconnected');
            expect(await deps.db.countActiveLinks('u1')).toBe(0);
        });
    }
});
