'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import styles from '../paywall.module.css';

export default function PaywallSuccessPage() {
    const router = useRouter();
    const [status, setStatus] = useState('verifying'); // verifying | active | waiting

    useEffect(() => {
        let attempts = 0;

        async function check() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.replace('/login'); return; }

            // Refresh session to get updated metadata from webhook
            await supabase.auth.refreshSession();
            const { data: { user: refreshed } } = await supabase.auth.getUser();

            if (refreshed?.user_metadata?.subscription_status === 'active') {
                setStatus('active');
                setTimeout(() => router.replace('/finanzas'), 2000);
                return;
            }

            // Webhook might take a few seconds — retry up to 10 times
            attempts++;
            if (attempts < 10) {
                setTimeout(check, 1500);
            } else {
                setStatus('waiting');
            }
        }

        check();
    }, [router]);

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
