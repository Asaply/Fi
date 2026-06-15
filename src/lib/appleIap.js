// Server-side Apple StoreKit verification + access sync.
// Verifies App Store signed transactions / notifications (JWS) using Apple's
// official library, then reflects subscription state into our access model.
import fs from 'fs';
import path from 'path';
import { SignedDataVerifier, Environment } from '@apple/app-store-server-library';

export const APPLE_BUNDLE_ID = process.env.APPLE_BUNDLE_ID || 'lat.nva.app';
export const APPLE_PRODUCT_ID = process.env.APPLE_SUB_PRODUCT_ID || 'lat.nva.app.sub.monthly';
const APP_APPLE_ID = process.env.APPLE_APP_APPLE_ID ? Number(process.env.APPLE_APP_APPLE_ID) : undefined;

// Apple root CAs anchor the cert chain. Supply either:
//   APPLE_ROOT_CAS = comma-separated base64 of the .cer files, or
//   ./apple-certs/*.cer|pem|der  (download from apple.com/certificateauthority)
function loadRootCAs() {
    if (process.env.APPLE_ROOT_CAS) {
        return process.env.APPLE_ROOT_CAS.split(',').map((b64) => Buffer.from(b64.trim(), 'base64'));
    }
    const dir = path.join(process.cwd(), 'apple-certs');
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter((f) => /\.(cer|pem|der)$/i.test(f))
        .map((f) => fs.readFileSync(path.join(dir, f)));
}

const verifiers = {};
function getVerifier(env) {
    if (!verifiers[env]) {
        verifiers[env] = new SignedDataVerifier(loadRootCAs(), true, env, APPLE_BUNDLE_ID, APP_APPLE_ID);
    }
    return verifiers[env];
}

// Production transactions fail verification under the sandbox verifier and vice
// versa, so try production first then fall back to sandbox.
async function tryBothEnvs(fn) {
    try {
        return await fn(getVerifier(Environment.PRODUCTION));
    } catch (_) {
        return await fn(getVerifier(Environment.SANDBOX));
    }
}

export function verifyTransaction(jws) {
    return tryBothEnvs((v) => v.verifyAndDecodeTransaction(jws));
}

export function verifyNotification(signedPayload) {
    return tryBothEnvs((v) => v.verifyAndDecodeNotification(signedPayload));
}

// Notification types that force an inactive state regardless of expiry date.
const FORCE_EXPIRED = new Set(['REFUND', 'REVOKE', 'EXPIRED', 'GRACE_PERIOD_EXPIRED']);

// Derive our status from a decoded transaction + (optional) notification type.
export function deriveAppleStatus(tx, notificationType, now = Date.now()) {
    const expiresAt = tx?.expiresDate ? new Date(tx.expiresDate).toISOString() : null;
    if (notificationType && FORCE_EXPIRED.has(notificationType)) {
        return { status: 'expired', expiresAt };
    }
    const active = tx?.expiresDate ? tx.expiresDate > now && !tx.revocationDate : false;
    return { status: active ? 'active' : 'expired', expiresAt };
}

// Persist Apple subscription state: subscriptions row + user_metadata.
export async function applyAppleSubscription(admin, userId, { status, expiresAt, originalTransactionId }) {
    const { error: upsertErr } = await admin
        .from('subscriptions')
        .upsert({
            user_id: userId,
            status: status === 'active' ? 'active' : 'expired',
            source: 'apple',
            apple_original_transaction_id: originalTransactionId || null,
            current_period_end: expiresAt,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
    if (upsertErr) console.error('[appleIap] subscriptions upsert (non-fatal):', upsertErr.message);

    const { error: metaErr } = await admin.auth.admin.updateUserById(userId, {
        user_metadata: {
            subscription_status: status,
            subscription_source: 'apple',
            subscription_expires_at: expiresAt,
        },
    });
    if (metaErr) throw metaErr;
}

// Resolve our user id from an Apple originalTransactionId (set at verify time).
export async function findUserByOriginalTxId(admin, originalTransactionId) {
    if (!originalTransactionId) return null;
    const { data } = await admin
        .from('subscriptions')
        .select('user_id')
        .eq('apple_original_transaction_id', originalTransactionId)
        .maybeSingle();
    return data?.user_id || null;
}
