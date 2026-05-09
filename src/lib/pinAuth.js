/**
 * PIN & Biometric authentication utilities.
 * PIN is hashed with PBKDF2-SHA256 (100k iterations) + random salt.
 * Legacy SHA-256 PINs are transparently supported and upgraded on next set.
 */

const PIN_STORE_KEY   = 'fnce_pin_v2';    // { hash, salt } JSON (PBKDF2)
const PIN_LEGACY_KEY  = 'fnce_pin_hash';  // plain SHA-256 hex (legacy)
const PIN_ENABLED_KEY = 'fnce_pin_enabled';
const BIOMETRIC_KEY         = 'fnce_biometric_credential';
const BIOMETRIC_ENABLED_KEY = 'fnce_biometric_enabled';
const PBKDF2_ITERATIONS     = 100_000;

/* ── Helpers ── */

function hexToBytes(hex) {
    const arr = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    return arr;
}

function bytesToHex(buf) {
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function pbkdf2Hash(pin, saltHex) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
    const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS },
        key,
        256
    );
    return { hash: bytesToHex(bits), salt: bytesToHex(salt) };
}

async function sha256Hex(pin) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
    return bytesToHex(buf);
}

/* ── Public API ── */

export function isPinEnabled() {
    try { return localStorage.getItem(PIN_ENABLED_KEY) === '1'; } catch { return false; }
}

export function isBiometricEnabled() {
    try { return localStorage.getItem(BIOMETRIC_ENABLED_KEY) === '1'; } catch { return false; }
}

export function isUnlocked() {
    try { return sessionStorage.getItem('fnce_unlocked') === '1'; } catch { return false; }
}

export function markUnlocked() {
    try { sessionStorage.setItem('fnce_unlocked', '1'); } catch {}
}

export function lockSession() {
    try { sessionStorage.removeItem('fnce_unlocked'); } catch {}
}

/** Store PIN as PBKDF2 hash. Removes legacy SHA-256 entry. */
export async function setPin(pin) {
    const { hash, salt } = await pbkdf2Hash(pin);
    localStorage.setItem(PIN_STORE_KEY, JSON.stringify({ hash, salt }));
    localStorage.setItem(PIN_ENABLED_KEY, '1');
    localStorage.removeItem(PIN_LEGACY_KEY); // remove legacy
}

/** Verify PIN against PBKDF2 or legacy SHA-256 (auto-upgrade on success). */
export async function verifyPin(pin) {
    // PBKDF2 path (v2)
    const stored = (() => {
        try { return JSON.parse(localStorage.getItem(PIN_STORE_KEY)); } catch { return null; }
    })();

    if (stored?.hash && stored?.salt) {
        const { hash } = await pbkdf2Hash(pin, stored.salt);
        return hash === stored.hash;
    }

    // Legacy SHA-256 path — verify then silently upgrade
    const legacyHash = localStorage.getItem(PIN_LEGACY_KEY);
    if (legacyHash) {
        const check = await sha256Hex(pin);
        if (check === legacyHash) {
            // Upgrade to PBKDF2 transparently
            await setPin(pin);
            return true;
        }
        return false;
    }

    return false;
}

export function disablePin() {
    localStorage.removeItem(PIN_STORE_KEY);
    localStorage.removeItem(PIN_LEGACY_KEY);
    localStorage.removeItem(PIN_ENABLED_KEY);
    disableBiometric();
    lockSession();
}

export function disableBiometric() {
    localStorage.removeItem(BIOMETRIC_KEY);
    localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
}

/* ── Biometric (WebAuthn platform authenticator) ── */

export async function isBiometricSupported() {
    try {
        return !!(typeof PublicKeyCredential !== 'undefined' &&
            await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
    } catch { return false; }
}

export async function registerBiometric() {
    const userId = crypto.getRandomValues(new Uint8Array(16));
    const credential = await navigator.credentials.create({
        publicKey: {
            challenge: crypto.getRandomValues(new Uint8Array(32)),
            rp: { name: 'NVA Finance', id: window.location.hostname },
            user: { id: userId, name: 'nva-user', displayName: 'Usuario NVA' },
            pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
            authenticatorSelection: {
                authenticatorAttachment: 'platform',
                userVerification: 'required',
            },
            timeout: 60000,
        },
    });
    const credId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
    localStorage.setItem(BIOMETRIC_KEY, credId);
    localStorage.setItem(BIOMETRIC_ENABLED_KEY, '1');
    return true;
}

export async function verifyBiometric() {
    const b64 = localStorage.getItem(BIOMETRIC_KEY);
    if (!b64) throw new Error('Sin credencial registrada.');
    const credId = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const assertion = await navigator.credentials.get({
        publicKey: {
            challenge: crypto.getRandomValues(new Uint8Array(32)),
            rpId: window.location.hostname,
            allowCredentials: [{ id: credId, type: 'public-key' }],
            userVerification: 'required',
            timeout: 60000,
        },
    });
    return !!assertion;
}
