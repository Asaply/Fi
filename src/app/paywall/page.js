'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Image from 'next/image';
import { Check } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { API_BASE } from '@/lib/apiBase';
import { userHasAccess } from '@/lib/access';
import { isNativeApp, nativePurchase, nativeRestore } from '@/lib/iap';
import { isTrialEligible } from '@/lib/trialEligibility';
import { TRIAL_DAYS } from '@/lib/trial';
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
    const [native, setNative] = useState(() => isNativeApp());
    const [trialEligible, setTrialEligible] = useState(true);
    const router = useRouter();
    const searchParams = useSearchParams();
    const paymentError = searchParams.get('error');
    const paymentStatus = searchParams.get('status');

    useEffect(() => {
        setNative(isNativeApp());
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
                const emailParam = new URLSearchParams(window.location.search).get('email');
                const loginUrl = emailParam
                    ? `/login?email=${encodeURIComponent(emailParam)}&redirect=/paywall`
                    : '/login?redirect=/paywall';
                router.replace(loginUrl);
                return;
            }
            if (userHasAccess(session.user)) {
                router.replace('/finanzas');
                return;
            }
            setUserEmail(session.user?.email || '');
            isTrialEligible(session.user?.id).then(setTrialEligible);
        });
    }, [router]);

    async function handlePay() {
        // Native must use StoreKit IAP only — never Stripe (App Store 3.1.1).
        if (isNativeApp()) return handleNativePurchase();
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE}/api/stripe/create-checkout`, { method: 'POST' });
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

    async function handleNativePurchase() {
        setLoading(true);
        setError('');
        try {
            await nativePurchase();
            router.replace('/finanzas');
        } catch (e) {
            if (e.message !== 'cancelled') setError('No se pudo completar la compra. Intenta de nuevo.');
            setLoading(false);
        }
    }

    async function handleNativeRestore() {
        setLoading(true);
        setError('');
        try {
            await nativeRestore();
            router.replace('/finanzas');
        } catch {
            setError('No encontramos una suscripción activa para restaurar.');
            setLoading(false);
        }
    }

    if (native) {
        return (
            <div className={styles.root}>
                <div className={styles.card}>
                    <div className={styles.logoWrap}>
                        <Image src="/nva-icon.svg" alt="NVA" width={56} height={56} className={styles.logo} />
                    </div>
                    <h1 className={styles.title}>Activa NVA al 100%</h1>
                    <p className={styles.subtitle}>Suscripción mensual · Cancela cuando quieras</p>

                    <div className={styles.priceBlock}>
                        <span className={styles.currency}>$</span>
                        <span className={styles.price}>99</span>
                        <span className={styles.priceSuffix}>MXN / mes</span>
                    </div>

                    <ul className={styles.features}>
                        {FEATURES.map((f, i) => (
                            <li key={i}>
                                <span className={styles.featureCheck}><Check size={11} strokeWidth={3} /></span>
                                {f}
                            </li>
                        ))}
                    </ul>

                    {error && <p className={styles.errorMsg}>{error}</p>}

                    <button
                        className={styles.payBtn}
                        onClick={handleNativePurchase}
                        disabled={loading}
                    >
                        {loading ? 'Procesando...' : 'Suscribirme — $99 MXN/mes'}
                    </button>
                    <button
                        className={styles.logoutBtn}
                        onClick={handleNativeRestore}
                        disabled={loading}
                        style={{ marginTop: '0.5rem' }}
                    >
                        Restaurar compras
                    </button>
                    <p className={styles.note}>
                        Nuevos suscriptores: {TRIAL_DAYS} días gratis · Se renueva automáticamente · Gestiona en Ajustes de tu Apple ID
                    </p>
                    <p className={styles.legalLinks}>
                        <a href="https://www.nva.lat/terms" target="_blank" rel="noopener noreferrer">Términos de uso (EULA)</a>
                        {' · '}
                        <a href="https://www.nva.lat/privacy" target="_blank" rel="noopener noreferrer">Política de privacidad</a>
                    </p>
                    {userEmail && (
                        <p className={styles.emailNote}>Cuenta: {userEmail}</p>
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

    return (
        <div className={styles.root}>
            <div className={styles.card}>
                <div className={styles.logoWrap}>
                    <Image src="/nva-icon.svg" alt="NVA" width={56} height={56} className={styles.logo} />
                </div>

                <h1 className={styles.title}>Activa NVA al 100%</h1>
                <p className={styles.subtitle}>Suscripción mensual · Cancela cuando quieras</p>

                <div className={styles.priceBlock}>
                    <span className={styles.currency}>$</span>
                    <span className={styles.price}>99</span>
                    <span className={styles.priceSuffix}>MXN / mes</span>
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
                    {loading
                        ? 'Redirigiendo...'
                        : trialEligible ? `Probar ${TRIAL_DAYS} días gratis` : 'Suscribirme — $99 MXN/mes'}
                </button>

                <p className={styles.note}>
                    {trialEligible
                        ? `${TRIAL_DAYS} días gratis, luego $99 MXN/mes · Pago seguro vía Stripe · Cancela cuando quieras`
                        : 'Pago seguro vía Stripe · Cancela cuando quieras'}
                </p>
                <p className={styles.legalLinks}>
                    <a href="https://www.nva.lat/terms" target="_blank" rel="noopener noreferrer">Términos de uso (EULA)</a>
                    {' · '}
                    <a href="https://www.nva.lat/privacy" target="_blank" rel="noopener noreferrer">Política de privacidad</a>
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
