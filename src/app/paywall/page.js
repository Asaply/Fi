'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Image from 'next/image';
import { Check } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import styles from './paywall.module.css';

const FEATURES = [
    'Análisis ilimitados de estados de cuenta',
    'Categorización automática con IA',
    'Detección de fugas de dinero',
    'Dashboard financiero completo',
    'Portfolio y trading tracker',
    'Actualizaciones incluidas para siempre',
];

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

                <h1 className={styles.title}>Activa NVA al 100%</h1>
                <p className={styles.subtitle}>Pago único · Sin suscripción · Sin sorpresas</p>

                <div className={styles.priceBlock}>
                    <span className={styles.currency}>$</span>
                    <span className={styles.price}>99</span>
                    <span className={styles.priceSuffix}>MXN</span>
                </div>

                <ul className={styles.features}>
                    {FEATURES.map((f, i) => (
                        <li key={i}>
                            <span className={styles.featureCheck}><Check size={11} strokeWidth={3} /></span>
                            {f}
                        </li>
                    ))}
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
                    {loading ? 'Redirigiendo...' : 'Activar NVA — $99 MXN'}
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
