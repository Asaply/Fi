'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import styles from '../paywall.module.css';

function SuccessContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [status, setStatus] = useState('verifying'); // verifying | active | waiting

    useEffect(() => {
        const paymentId = searchParams.get('payment_id');

        async function activate() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.replace('/login'); return; }

            // 1. If MP gave us a payment_id, verify directly (immediate activation)
            if (paymentId) {
                try {
                    const res = await fetch(`/api/mp/verify-payment?payment_id=${paymentId}`);
                    const json = await res.json();
                    if (json.activated) {
                        // Refresh local session so middleware picks up new metadata
                        await supabase.auth.refreshSession();
                        setStatus('active');
                        setTimeout(() => router.replace('/finanzas'), 2000);
                        return;
                    }
                } catch (e) {
                    console.error('[success] verify-payment error:', e);
                }
            }

            // 2. Fallback: poll refreshSession (webhook may have already fired)
            let attempts = 0;
            async function poll() {
                await supabase.auth.refreshSession();
                const { data: { user: refreshed } } = await supabase.auth.getUser();

                if (refreshed?.user_metadata?.subscription_status === 'active') {
                    setStatus('active');
                    setTimeout(() => router.replace('/finanzas'), 2000);
                    return;
                }

                attempts++;
                if (attempts < 5) {
                    setTimeout(poll, 2000);
                } else {
                    setStatus('waiting');
                }
            }

            poll();
        }

        activate();
    }, [router, searchParams]);

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
                        <p className={styles.subtitle}>Entrando a tu dashboard...</p>
                    </>
                )}

                {status === 'verifying' && (
                    <>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
                        <h1 className={styles.title}>Verificando pago...</h1>
                        <p className={styles.subtitle}>Un momento, confirmando con MercadoPago</p>
                    </>
                )}

                {status === 'waiting' && (
                    <>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📧</div>
                        <h1 className={styles.title}>Pago recibido</h1>
                        <p className={styles.subtitle} style={{ maxWidth: 280 }}>
                            La confirmación puede tardar unos minutos. Cierra sesión y vuelve a entrar para activar tu cuenta.
                        </p>
                        <button
                            className={styles.payBtn}
                            style={{ marginTop: '1.5rem' }}
                            onClick={() => supabase.auth.signOut().then(() => router.replace('/login'))}
                        >
                            Cerrar sesión
                        </button>
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
