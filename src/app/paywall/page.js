'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import styles from './paywall.module.css';

function PaywallInner() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [userEmail, setUserEmail] = useState('');
    const router = useRouter();
    const searchParams = useSearchParams();
    const paymentError = searchParams.get('error');
    const paymentStatus = searchParams.get('status');

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) { router.replace('/login'); return; }
            if (session.user?.user_metadata?.subscription_status === 'active') {
                router.replace('/finanzas');
                return;
            }
            setUserEmail(session.user?.email || '');
        });
    }, [router]);

    async function handlePay() {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/stripe/create-checkout', { method: 'POST' });
            const data = await res.json();
            if (!res.ok || !data.url) {
                setError(data.error || 'Error al iniciar el pago. Intenta de nuevo.');
                setLoading(false);
                return;
            }
            window.location.href = data.url;
        } catch {
            setError('Error de conexión. Intenta de nuevo.');
            setLoading(false);
        }
    }

    return (
        <div className={styles.root}>
            <div className={styles.card}>
                <div className={styles.logoWrap}>
                    <Image src="/nva-icon.svg" alt="NVA" width={56} height={56} className={styles.logo} />
                </div>

                <h1 className={styles.title}>Activa tu cuenta NVA</h1>
                <p className={styles.subtitle}>Acceso completo, pago único</p>

                <div className={styles.priceBlock}>
                    <span className={styles.price}>$50</span>
                    <span className={styles.currency}>MXN</span>
                </div>

                <ul className={styles.features}>
                    <li>Análisis ilimitados de estados de cuenta</li>
                    <li>Categorización automática con IA</li>
                    <li>Insights y fugas de dinero</li>
                    <li>Dashboard financiero completo</li>
                    <li>Portfolio y trading tracker</li>
                    <li>Actualizaciones incluidas</li>
                </ul>

                {paymentError && (
                    <p className={styles.errorBanner}>
                        El pago no se completó. Intenta de nuevo.
                    </p>
                )}

                {paymentStatus === 'pending' && (
                    <p className={styles.pendingBanner}>
                        Tu pago está siendo procesado. Te avisaremos cuando se confirme.
                    </p>
                )}

                {error && <p className={styles.errorMsg}>{error}</p>}

                <button
                    className={styles.payBtn}
                    onClick={handlePay}
                    disabled={loading}
                >
                    {loading ? 'Redirigiendo...' : 'Pagar con Stripe'}
                </button>

                <p className={styles.note}>
                    Pago seguro vía Stripe · Tarjetas de crédito y débito
                </p>

                {userEmail && (
                    <p className={styles.emailNote}>
                        Cuenta: {userEmail}
                    </p>
                )}

                <button
                    className={styles.logoutBtn}
                    onClick={() => supabase.auth.signOut().then(() => router.replace('/login'))}
                >
                    Cerrar sesión
                </button>
            </div>
        </div>
    );
}

export default function PaywallPage() {
    return (
        <Suspense fallback={<div className={styles.root} />}>
            <PaywallInner />
        </Suspense>
    );
}
