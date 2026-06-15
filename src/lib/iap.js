// Client-side helpers for the native iOS StoreKit bridge + payment platform
// detection. The Swift side (CustomBridgeViewController) observes document.title
// for the __nvaPurchase / __nvaRestorePurchases commands and returns the signed
// transaction (JWS) via window.__nvaPurchaseResult / __nvaRestoreResult.
import { supabase } from '@/lib/supabaseClient';

// Must hit www (apex redirects drop the Authorization header), matching the
// native upload flow in CustomBridgeViewController.
const VERIFY_URL = 'https://www.nva.lat/api/iap/verify';

export function isNativeApp() {
    if (typeof window === 'undefined') return false;
    return !!(
        window.Capacitor?.isNativePlatform?.() ||
        window.Capacitor?.platform === 'ios' ||
        window.Capacitor?.platform === 'android'
    );
}

async function verifyJws(jws) {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const r = await fetch(VERIFY_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ jws }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.active) throw new Error(j.error || 'verify_failed');
    await supabase.auth.refreshSession();
    return j;
}

// Trigger a StoreKit purchase. Resolves once the server has verified the
// transaction and activated the subscription; rejects on cancel/error.
export function nativePurchase() {
    return new Promise((resolve, reject) => {
        window.__nvaPurchaseResult = async (jws) => {
            delete window.__nvaPurchaseResult;
            delete window.__nvaPurchaseError;
            try { resolve(await verifyJws(jws)); } catch (e) { reject(e); }
        };
        window.__nvaPurchaseError = (reason) => {
            delete window.__nvaPurchaseResult;
            delete window.__nvaPurchaseError;
            reject(new Error(reason || 'unknown'));
        };
        document.title = '__nvaPurchase';
    });
}

// Restore an existing subscription (Apple requires a Restore Purchases action).
export function nativeRestore() {
    return new Promise((resolve, reject) => {
        window.__nvaRestoreResult = async (jws) => {
            delete window.__nvaRestoreResult;
            delete window.__nvaRestoreError;
            try { resolve(await verifyJws(jws)); } catch (e) { reject(e); }
        };
        window.__nvaRestoreError = (reason) => {
            delete window.__nvaRestoreResult;
            delete window.__nvaRestoreError;
            reject(new Error(reason || 'no_active_subscription'));
        };
        document.title = '__nvaRestorePurchases';
    });
}
