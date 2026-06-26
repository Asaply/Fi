'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { hasAccess } from '@/lib/access';

// Native-only. When the email-verification (or any auth) link bounces back into
// the app via the nvaapp:// custom scheme, Capacitor fires `appUrlOpen`. We pull
// the session out of the URL, establish it, and route the user onward — so the
// native flow lands logged-in on onboarding, matching the web /auth/callback route.
function isNativeApp() {
    return typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
}

function routeAfterAuth(router, user) {
    const m = user?.user_metadata;
    if (!m?.onboarded) router.replace('/onboarding');
    else if (!hasAccess(m)) router.replace('/paywall');
    else router.replace('/finanzas');
}

export default function NativeAuthDeepLink() {
    const router = useRouter();

    useEffect(() => {
        if (!isNativeApp()) return;
        let remove;
        (async () => {
            const { App } = await import('@capacitor/app');
            const handle = await App.addListener('appUrlOpen', async ({ url }) => {
                if (!url || !url.includes('auth/callback')) return;
                try {
                    // Implicit flow (native localStorage client): tokens in the hash.
                    const hash = url.split('#')[1];
                    if (hash) {
                        const p = new URLSearchParams(hash);
                        const access_token = p.get('access_token');
                        const refresh_token = p.get('refresh_token');
                        if (access_token && refresh_token) {
                            const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
                            if (!error) { routeAfterAuth(router, data?.user); return; }
                        }
                    }
                    // PKCE flow fallback: code in the query string.
                    const query = url.split('?')[1]?.split('#')[0];
                    if (query) {
                        const code = new URLSearchParams(query).get('code');
                        if (code) {
                            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
                            if (!error) { routeAfterAuth(router, data?.user); return; }
                        }
                    }
                } catch (_) {
                    // Swallow — a malformed deep link shouldn't crash the app.
                }
            });
            remove = () => handle.remove();
        })();
        return () => { if (remove) remove(); };
    }, [router]);

    return null;
}
