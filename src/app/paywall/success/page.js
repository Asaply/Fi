'use client';
import { Suspense, useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import styles from '../paywall.module.css';

function SuccessContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    // status: 'activating' | 'active' | 'manual'
    const [status, setStatus] = useState('activating');
    const [canContinue, setCanContinue] = useState(false);
    const attemptsRef = useRef(0);
    const activatedRef = useRef(false);

    useEffect(() => {
        const sessionId = searchParams.get('session_id');

        async function tryActivate() {
            if (activatedRef.current) return;

            // 1. Direct verification via Stripe session_id
            if (sessionId) {
                try {
                    const res = await fetch(`/api/stripe/verify-session?session_id=${sessionId}`);
                    const json = await res.json();
                    if (json.activated) {
                        activatedRef.current = true;
                        await supabase.auth.refreshSession();
                        const { data: { user } } = await supabase.auth.getUser();
                        const dest = user?.user_metadata?.onboarded ? '/finanzas' : '/onboarding';
                        setStatus('active');
                        setTimeout(() => router.replace(dest), 1800);
                        return;
                    }
                } catch (e) {
                    console.error('[success] verify-payment error:', e);
                }
            }

            // 2. Fallback: check if webhook already activated via session refresh
            await supabase.auth.refreshSession();
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.user_metadata?.subscription_status === 'active') {
                activatedRef.current = true;
                const dest = user?.user_metadata?.onboarded ? '/finanzas' : '/onboarding';
                setStatus('active');
                setTimeout(() => router.replace(dest), 1800);
                return;
            }

            attemptsRef.current++;

            // After 3 attempts (~9s), show manual continue button
            if (attemptsRef.current >= 3) {
                setCanContinue(true);
            }

            // Keep retrying up to 10 attempts (~30s)
            if (attemptsRef.current < 10) {
                setTimeout(tryActivate, 3000);
            }
        }

        tryActivate();
    }, [router, searchParams]);

    async function handleManualContinue() {
        await supabase.auth.refreshSession();
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.user_metadata?.subscription_status === 'active') {
            const dest = user?.user_metadata?.onboarded ? '/finanzas' : '/onboarding';
            router.replace(dest);
        } else {
            // Force sign out and back in to get fresh token
            await supabase.auth.signOut();
            router.replace('/login');
        }
    }

    return (
        <div className={styles.root}>
            <div className={styles.card}>
                <div className={styles.logoWrap}>
                    <Image src="/nva-icon.svg" alt="NVA" width={56} height={56} className={styles.logo} />
                </div>

                {status === 'active' && (
                    <>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
                        <h1 className={styles.title}>¡Cuenta activada!</h1>
                        <p className={styles.subtitle}>Entrando a la app...</p>
                    </>
                )}

                {status === 'activating' && (
                    <>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
                        <h1 className={styles.title}>¡Pago recibido!</h1>
                        <p className={styles.subtitle}>Activando tu cuenta...</p>

                        {canContinue && (
                            <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
                                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', maxWidth: 260, textAlign: 'center' }}>
                                    La activación está tomando más de lo esperado.
                                </p>
                                <button
                                    className={styles.payBtn}
                                    onClick={handleManualContinue}
                                >
                                    Continuar →
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default function PaywallSuccessPage() {
    return (
        <Suspense>
            <SuccessContent />
        </Suspense>
    );
}
