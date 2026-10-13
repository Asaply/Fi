// Request logic for the bank-* Edge Functions. Pure: everything external comes in
// `deps` ({ db, provider, classify, now, runInBackground, userHasAccess, webhookSecret }).
import { MAX_LINKS_PER_USER, SYNC_COOLDOWN_SECONDS, LINK_STATUS } from './constants.js';
import { syncLink, syncWindow, historyWindow } from './sync.js';

const ok = (body, status = 200) => ({ status, body });
const fail = (status, error, extra = {}) => ({ status, body: { error, ...extra } });

function guard(user, deps, { needsAccess = true } = {}) {
    if (!user) return fail(401, 'no_session');
    if (needsAccess && !deps.userHasAccess(user)) return fail(402, 'no_subscription');
    if (!deps.provider) return fail(503, 'provider_unavailable');
    return null;
}

async function ownLink(user, linkId, deps) {
    if (typeof linkId !== 'string' || !linkId || linkId.length > 100) return null;
    const link = await deps.db.getLinkById(linkId);
    if (!link || link.user_id !== user.id || link.status === LINK_STATUS.DISCONNECTED) return null;
    return link;
}

// Never throws: failures are stored on the link so the app can show them, and the link
// keeps the status it had before this attempt (`previousStatus`, default `link.status`).
// `fullHistory`: fetch the provider's whole history (its historical-update events),
// not just the incremental window since the last sync.
export async function runSync(link, deps, { previousStatus, fullHistory = false } = {}) {
    const restoreStatus = previousStatus ?? link.status;
    try {
        const now = deps.now();
        const { from, to } = fullHistory ? historyWindow(now) : syncWindow(link, now);
        await syncLink({ db: deps.db, provider: deps.provider, classify: deps.classify, link, from, to, now });
    } catch (e) {
        try {
            await deps.db.updateLinkIfActive(link.id, {
                last_error: String(e?.message || e).slice(0, 500),
                status: restoreStatus,
                updated_at: deps.now().toISOString(),
            });
        } catch {
            // nothing else to do; the next webhook or manual sync retries
        }
    }
}

export async function handleConnectToken({ user, body }, deps) {
    const blocked = guard(user, deps);
    if (blocked) return blocked;
    let providerLinkId;
    if (body?.link_id) {
        const link = await ownLink(user, body.link_id, deps);
        if (!link) return fail(404, 'not_found');
        providerLinkId = link.provider_link_id;
    } else if (await deps.db.countActiveLinks(user.id) >= MAX_LINKS_PER_USER) {
        return fail(409, 'max_links');
    }
    const { token } = await deps.provider.createConnectToken({ userId: user.id, providerLinkId });
    return ok({ token });
}

export async function handleRegisterLink({ user, body }, deps) {
    const blocked = guard(user, deps);
    if (blocked) return blocked;
    const providerLinkId = body?.provider_link_id;
    if (typeof providerLinkId !== 'string' || !providerLinkId || providerLinkId.length > 200) return fail(400, 'invalid_link');

    const remote = await deps.provider.getLink(providerLinkId);
    if (!remote) return fail(400, 'invalid_link');
    if (remote.externalUserId !== user.id) return fail(403, 'forbidden');
    if (!remote.recurrent) return fail(400, 'not_recurrent');

    const nowIso = deps.now().toISOString();
    const existing = await deps.db.getLinkByProviderId(providerLinkId);
    let link;
    let previousStatus;
    if (existing) {
        if (existing.user_id !== user.id) return fail(403, 'forbidden');
        if (existing.status === LINK_STATUS.VALID || existing.status === LINK_STATUS.SYNCING) return fail(409, 'conflict');
        if (existing.status === LINK_STATUS.DISCONNECTED && await deps.db.countActiveLinks(user.id) >= MAX_LINKS_PER_USER) {
            return fail(409, 'max_links');
        }
        previousStatus = existing.status;
        await deps.db.updateLink(existing.id, { status: LINK_STATUS.SYNCING, last_error: null, updated_at: nowIso });
        link = { ...existing, status: LINK_STATUS.SYNCING };
    } else {
        if (await deps.db.countActiveLinks(user.id) >= MAX_LINKS_PER_USER) return fail(409, 'max_links');
        link = await deps.db.insertLink({
            user_id: user.id,
            provider_link_id: providerLinkId,
            institution_name: remote.institutionName,
            institution_code: remote.institutionCode,
            status: LINK_STATUS.SYNCING,
            created_at: nowIso,
            updated_at: nowIso,
        });
    }
    deps.runInBackground(runSync(link, deps, { previousStatus }));
    return ok({ link: { id: link.id, institution_name: link.institution_name, status: LINK_STATUS.SYNCING } });
}

export async function handleSync({ user, body }, deps) {
    const blocked = guard(user, deps);
    if (blocked) return blocked;
    const link = await ownLink(user, body?.link_id, deps);
    if (!link) return fail(404, 'not_found');

    const now = deps.now();
    const last = link.last_manual_sync_at ? Date.parse(link.last_manual_sync_at) : 0;
    const elapsed = (now.getTime() - last) / 1000;
    if (elapsed < SYNC_COOLDOWN_SECONDS) {
        return fail(429, 'rate_limited', { retry_after: Math.ceil(SYNC_COOLDOWN_SECONDS - elapsed) });
    }
    const previousStatus = link.status;
    await deps.db.updateLink(link.id, { status: LINK_STATUS.SYNCING, last_manual_sync_at: now.toISOString(), updated_at: now.toISOString() });
    deps.runInBackground(runSync(link, deps, { previousStatus }));
    return ok({ status: LINK_STATUS.SYNCING }, 202);
}

export async function handleDisconnect({ user, body }, deps) {
    const blocked = guard(user, deps, { needsAccess: false });
    if (blocked) return blocked;
    const link = await ownLink(user, body?.link_id, deps);
    if (!link) return fail(404, 'not_found');
    await deps.provider.deleteLink(link.provider_link_id);
    await deps.db.updateLink(link.id, { status: LINK_STATUS.DISCONNECTED, updated_at: deps.now().toISOString() });
    await deps.db.setAccountsConnected(link.id, false);
    return ok({ ok: true });
}

export async function handleWebhook({ request }, deps) {
    if (!deps.provider) return fail(503, 'provider_unavailable');
    if (!deps.webhookSecret) return fail(503, 'webhook_not_configured');
    const parsed = await deps.provider.parseWebhook(request, deps.webhookSecret);
    if (!parsed.authorized) return fail(401, 'unauthorized');
    const event = parsed.event;
    if (!event || event.kind === 'ignored' || !event.providerLinkId) return ok({ received: true });

    const link = await deps.db.getLinkByProviderId(event.providerLinkId);
    if (!link || link.status === LINK_STATUS.DISCONNECTED) return ok({ received: true, ignored: true });

    const nowIso = deps.now().toISOString();
    switch (event.kind) {
        // Historical updates can arrive after register-link already synced (and set
        // last_synced_at), so they always fetch the full history window.
        case 'accounts_ready':
        case 'transactions_ready':
            deps.runInBackground(runSync(link, deps, { fullHistory: true }));
            break;
        case 'new_transactions':
            deps.runInBackground(runSync(link, deps));
            break;
        case 'link_invalid':
            await deps.db.updateLink(link.id, { status: LINK_STATUS.INVALID, last_error: event.message ?? null, updated_at: nowIso });
            break;
        case 'link_token_required':
            await deps.db.updateLink(link.id, { status: LINK_STATUS.TOKEN_REQUIRED, last_error: event.message ?? null, updated_at: nowIso });
            break;
        default:
            break;
    }
    return ok({ received: true });
}

// Account deletion: stop provider billing before the user disappears.
export async function deleteAllUserLinks({ userId }, deps) {
    const links = await deps.db.listUserLinks(userId, { includeDisconnected: false });
    if (!links.length) return 0;
    if (!deps.provider) throw new Error('provider_unavailable');
    for (const link of links) await deps.provider.deleteLink(link.provider_link_id);
    return links.length;
}
