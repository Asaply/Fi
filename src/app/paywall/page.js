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
import { getRemainingSlots, claimFreeSlot } from '@/lib/freeTier';
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
    const [remaining, setRemaining] = useState(null);
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
            getRemainingSlots().then((s) => setRemaining(s?.remaining ?? 0));
        });
    }, [router]);

    async function handleFree() {
        setLoading(true);
        setError('');
        try {
            const json = await claimFreeSlot();
            if (json.granted) {
                await supabase.auth.refreshSession();
                router.replace('/finanzas');
                return;
            }
            setRemaining(0);
            setError('Se agotaron los lugares gratis. Suscríbete para continuar.');
        } catch (_) {
            setError('No se pudo activar el acceso gratis. Intenta de nuevo.');
        }
        setLoading(false);
    }

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

                    {remaining > 0 && (
                        <button className={styles.payBtn} onClick={handleFree} disabled={loading}>
                            {loading ? 'Activando...' : `Comenzar gratis — quedan ${remaining} de 150`}
                        </button>
                    )}
                    <button
                        className={remaining > 0 ? styles.logoutBtn : styles.payBtn}
                        onClick={handleNativePurchase}
                        disabled={loading}
                        style={remaining > 0 ? { marginTop: '0.5rem' } : undefined}
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
                        Se renueva automáticamente · Gestiona en Ajustes de tu Apple ID
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

                {remaining > 0 && (
                    <button className={styles.payBtn} onClick={handleFree} disabled={loading}>
                        {loading ? 'Activando...' : `Comenzar gratis — quedan ${remaining} de 150`}
                    </button>
                )}
                <button
                    className={remaining > 0 ? styles.logoutBtn : styles.payBtn}
                    onClick={handlePay}
                    disabled={loading}
                    style={remaining > 0 ? { marginTop: '0.5rem' } : undefined}
                >
                    {loading ? 'Redirigiendo...' : 'Suscribirme — $99 MXN/mes'}
                </button>

                <p className={styles.note}>
                    Pago seguro vía Stripe · Cancela cuando quieras
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
