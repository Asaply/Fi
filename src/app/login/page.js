'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Check } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { hasAccess } from '@/lib/access';
import './Login.css';

// mode: 'landing' | 'login' | 'register' | 'registered'

function getPasswordStrength(password) {
    let score = 0;
    if (password.length >= 8)           score++;
    if (/[A-Z]/.test(password))         score++;
    if (/[0-9]/.test(password))         score++;
    if (/[^A-Za-z0-9]/.test(password))  score++;
    return score; // 0-4
}

const STRENGTH_LABELS = ['', 'Débil', 'Regular', 'Buena', 'Fuerte'];
const STRENGTH_COLORS = ['#333', '#ef4444', '#f97316', '#eab308', '#22c55e'];

function translateError(msg) {
    if (!msg) return '';
    if (msg.includes('Invalid login credentials'))   return 'Email o contraseña incorrectos.';
    if (msg.includes('Email not confirmed'))          return 'Confirma tu email antes de entrar.';
    if (msg.includes('User already registered'))      return 'Este email ya tiene una cuenta. Inicia sesión.';
    if (msg.includes('Password should be at least')) return 'La contraseña debe tener al menos 6 caracteres.';
    if (msg.includes('rate limit'))                   return 'Demasiados intentos. Espera un momento.';
    if (msg.includes('Unable to validate email'))     return 'Email inválido.';
    if (msg.includes('Signup requires a valid password')) return 'La contraseña no es válida.';
    return msg;
}

function LoginBanner({ reason }) {
    if (!reason) return null;
    const msg = reason === 'free_analysis_used'
        ? 'Ya usaste tu análisis gratis. Crea una cuenta para análisis ilimitados.'
        : reason === 'more_analyses'
        ? 'Crea tu cuenta para guardar y analizar más estados de cuenta.'
        : null;
    if (!msg) return null;
    return (
        <div style={{
            background: '#FF8700', color: '#fff', fontWeight: 600,
            fontSize: '0.9rem', textAlign: 'center', padding: '0.75rem 1rem',
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        }}>
            {msg}
        </div>
    );
}

function LoginPageInner() {
    const [mode, setMode]               = useState('landing');
    const [tosAccepted, setTos]         = useState(false);
    const [email, setEmail]             = useState('');
    const [password, setPassword]       = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [showPass, setShowPass]       = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [isLoading, setIsLoading]     = useState(false);
    const [error, setError]             = useState('');
    const [mfaFactorId, setMfaFactorId] = useState('');
    const [mfaCode, setMfaCode]         = useState('');
    const [visible, setVisible]         = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const reason = searchParams.get('reason');
    const redirectTo = searchParams.get('redirect') || null;

    useEffect(() => {
        const t = setTimeout(() => setVisible(true), 60);
        const emailParam = searchParams.get('email');
        if (emailParam) {
            setEmail(emailParam);
            setTimeout(() => { setMode('login'); setVisible(true); }, 60);
        }
        return () => clearTimeout(t);
    }, []);


    async function handleForgotPassword(e) {
        e.preventDefault();
        if (!email) { setError('Ingresa tu email.'); return; }
        setIsLoading(true);
        setError('');
        const redirectTo = `${window.location.origin}/auth/callback?next=/auth/reset-password`;
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
        if (err) setError(translateError(err.message));
        else transition('forgot-sent');
        setIsLoading(false);
    }

    function transition(next) {
        setVisible(false);
        setError('');
        setPassword('');
        setConfirmPass('');
        setTimeout(() => { setMode(next); setVisible(true); }, 180);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        if (mode === 'login') {
            const { data: loginData, error: err } = await supabase.auth.signInWithPassword({ email, password });
            if (err) {
                // Email not confirmed → show verify screen instead of generic error
                if (err.message.includes('Email not confirmed')) {
                    transition('verify-email');
                } else {
                    setError(translateError(err.message));
                }
            } else {
                // Check if MFA is required before redirecting
                const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
                if (aal?.nextLevel === 'aal2' && aal.nextLevel !== aal.currentLevel) {
                    const { data: factors } = await supabase.auth.mfa.listFactors();
                    const totp = factors?.totp?.[0];
                    if (totp) {
                        setMfaFactorId(totp.id);
                        transition('mfa');
                        setIsLoading(false);
                        return;
                    }
                }
                // Clear PIN if user came from "forgot PIN" flow
                if (localStorage.getItem('fnce_pin_clear_on_login') === '1') {
                    localStorage.removeItem('fnce_pin_clear_on_login');
                    localStorage.removeItem('fnce_pin_hash');
                    localStorage.removeItem('fnce_pin_enabled');
                    localStorage.removeItem('fnce_biometric_credential');
                    localStorage.removeItem('fnce_biometric_enabled');
                    localStorage.removeItem('fnce_pin_attempts');
                }
                const isOnboarded = !!loginData?.user?.user_metadata?.onboarded;
                if (redirectTo) router.push(redirectTo);
                else if (!isOnboarded) router.push('/onboarding');
                else router.push('/finanzas');
            }
        } else {
            if (password !== confirmPass) {
                setError('Las contraseñas no coinciden.');
                setIsLoading(false);
                return;
            }
            if (getPasswordStrength(password) < 3) {
                setError('Elige una contraseña más segura (mayúscula + número + 8 caracteres).');
                setIsLoading(false);
                return;
            }
            // Native must deep-link back into the app via the nvaapp:// scheme;
            // window.location.origin is capacitor://localhost which Supabase
            // rejects, so the email link would fall back to the web Site URL.
            const emailRedirectTo = isNativeApp()
                ? 'nvaapp://auth/callback'
                : `${window.location.origin}/auth/callback`;
            const { error: err } = await supabase.auth.signUp({
                email, password,
                options: { emailRedirectTo },
            });
            if (err) setError(translateError(err.message));
            else transition('registered');
        }
        setIsLoading(false);
    }

    async function handleMfaVerify(e) {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
        if (cErr) { setError('Error al generar desafío MFA.'); setIsLoading(false); return; }
        const { error: vErr } = await supabase.auth.mfa.verify({ factorId: mfaFactorId, challengeId: challenge.id, code: mfaCode.replace(/\s/g, '') });
        if (vErr) { setError('Código incorrecto.'); setIsLoading(false); return; }
        const { data: { user } } = await supabase.auth.getUser();
        const isOnboarded = !!user?.user_metadata?.onboarded;
        if (redirectTo) router.push(redirectTo);
        else if (!isOnboarded) router.push('/onboarding');
        else router.push('/finanzas');
    }

    function isNativeApp() {
        return typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
    }

    async function handleApple() {
        setIsLoading(true);
        setError('');
        try {
            if (isNativeApp()) {
                // Generate nonce for Supabase verification
                const rawNonce = crypto.randomUUID();
                const hashBuffer = await crypto.subtle.digest(
                    'SHA-256',
                    new TextEncoder().encode(rawNonce)
                );
                const hashedNonce = Array.from(new Uint8Array(hashBuffer))
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join('');

                window.__nvaHandleAppleToken = async (identityToken) => {
                    try {
                        const { data: authData, error: authErr } = await supabase.auth.signInWithIdToken({
                            provider: 'apple',
                            token: identityToken,
                            nonce: rawNonce,
                        });
                        if (authErr) throw authErr;
                        const user = authData?.user;
                        const isOnboarded = !!user?.user_metadata?.onboarded;
                        const isPaid = hasAccess(user?.user_metadata);
                        if (!isOnboarded) router.push('/onboarding');
                        else if (!isPaid) router.push('/paywall');
                        else router.push('/finanzas');
                    } catch (e2) {
                        setError(`Error al autenticar: ${e2.message}`);
                        setIsLoading(false);
                    }
                };
                window.__nvaAppleError = (reason) => {
                    if (reason === 'cancelled') {
                        setIsLoading(false);
                    } else {
                        setError('Apple: ' + (reason || 'unknown'));
                        setIsLoading(false);
                    }
                };
                document.title = '__nvaAppleSignIn:' + hashedNonce;
            } else {
                await supabase.auth.signInWithOAuth({
                    provider: 'apple',
                    options: { redirectTo: `${window.location.origin}/auth/callback` },
                });
            }
        } catch (e) {
            setError(`Error Apple: ${e.message}`);
            setIsLoading(false);
        }
    }

    async function handleGoogle() {
        setIsLoading(true);
        setError('');
        try {
            if (isNativeApp()) {
                // Use localStorage-based client (SSR cookie client has PKCE issues in WKWebView)
                const { createClient } = await import('@supabase/supabase-js');
                const nativeSupabase = createClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL,
                    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
                );
                const { data, error: err } = await nativeSupabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: { redirectTo: 'nvaapp://auth/callback', skipBrowserRedirect: true },
                });
                if (err) throw err;
                if (data?.url) {
                    window.__nvaHandleOAuthTokens = async (accessToken, refreshToken) => {
                        try {
                            const { data: authData, error: authErr } = await supabase.auth.setSession({
                                access_token: accessToken,
                                refresh_token: refreshToken,
                            });
                            if (authErr) throw authErr;
                            const user = authData?.user;
                            const isOnboarded = !!user?.user_metadata?.onboarded;
                            const isPaid = hasAccess(user?.user_metadata);
                            if (!isOnboarded) router.push('/onboarding');
                            else if (!isPaid) router.push('/paywall');
                            else router.push('/finanzas');
                        } catch (e2) {
                            setError(`Error al autenticar: ${e2.message}`);
                            setIsLoading(false);
                        }
                    };
                    window.__nvaOAuthError = (reason) => {
                        setError('OAuth: ' + (reason || 'unknown'));
                        setIsLoading(false);
                    };
                    document.title = '__nvaOAuth:' + data.url;
                }
            } else {
                await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: { redirectTo: `${window.location.origin}/auth/callback` },
                });
            }
        } catch (e) {
            setError(`Error Google: ${e.message}`);
            setIsLoading(false);
        }
    }

    return (
        <div className="login-root">
            <LoginBanner reason={reason} />
            <div className="login-bg-glow"        aria-hidden />
            <div className="login-bg-speedlines"  aria-hidden />

            <div className={`login-panel ${visible ? 'lp-visible' : ''}`}>

                {/* ── LANDING ──────────────────────────────── */}
                {mode === 'landing' && (
                    <div className="lp-landing">
                        <div className="lp-top">
                            <img src="/nva-icon.svg" alt="NVA" className="lp-logo-img" />
                            <p className="lp-tagline">Tus finanzas personales, en un solo lugar.</p>

                            <label className="tos-row">
                                <span
                                    className={`tos-box ${tosAccepted ? 'tos-box-checked' : ''}`}
                                    onClick={() => setTos(v => !v)}
                                    role="checkbox"
                                    aria-checked={tosAccepted}
                                    tabIndex={0}
                                    onKeyDown={e => e.key === ' ' && setTos(v => !v)}
                                >
                                    {tosAccepted && (
                                        <svg viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M1 5L4.5 8.5L11 1" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                    )}
                                </span>
                                <span className="tos-text">
                                    Acepto los{' '}
                                    <a href="/terms" target="_blank" rel="noopener noreferrer" className="tos-link" onClick={e => e.stopPropagation()}>Términos y Condiciones</a>
                                    {' '}y la{' '}
                                    <a href="/privacy" target="_blank" rel="noopener noreferrer" className="tos-link" onClick={e => e.stopPropagation()}>Política de Privacidad</a>
                                    {' '}de NVA
                                </span>
                            </label>
                        </div>

                        <div className="lp-cards">
                            <button
                                className={`route-card ${!tosAccepted ? 'route-card-disabled' : ''}`}
                                onClick={() => tosAccepted && transition('register')}
                                tabIndex={tosAccepted ? 0 : -1}
                            >
                                <div className="route-card-body">
                                    <span className="route-card-label">Nueva cuenta</span>
                                    <span className="route-card-desc">Crea tu cuenta nueva</span>
                                </div>
                                <ArrowDiag />
                            </button>

                            <button
                                className={`route-card ${!tosAccepted ? 'route-card-disabled' : ''}`}
                                onClick={() => tosAccepted && transition('login')}
                                tabIndex={tosAccepted ? 0 : -1}
                            >
                                <div className="route-card-body">
                                    <span className="route-card-label">Cuenta existente</span>
                                    <span className="route-card-desc">Inicia sesión en tu cuenta</span>
                                </div>
                                <ArrowDiag />
                            </button>
                        </div>
                    </div>
                )}

                {/* ── LOGIN / REGISTER FORM ─────────────────── */}
                {(mode === 'login' || mode === 'register') && (
                    <div className="lp-form">
                        <button className="lp-back" onClick={() => transition('landing')}>
                            <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" width="20" height="20">
                                <path d="M12.5 5L7.5 10L12.5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </button>

                        <div className="lp-form-header">
                            <h2 className="lp-form-title">
                                {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
                            </h2>
                            <p className="lp-form-sub">
                                {mode === 'login'
                                    ? 'Entra a tu cuenta NVA'
                                    : 'Empieza a controlar tus finanzas'}
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="lp-fields">
                            <input
                                type="email"
                                placeholder="Email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="auth-input"
                                required
                                autoComplete="email"
                            />
                            <div className="auth-input-wrap">
                                <input
                                    type={showPass ? 'text' : 'password'}
                                    placeholder="Contraseña"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="auth-input auth-input-pass"
                                    required
                                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                                />
                                <button
                                    type="button"
                                    className="auth-eye"
                                    onClick={() => setShowPass(v => !v)}
                                    tabIndex={-1}
                                >
                                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>

                            {/* Register-only: strength meter + confirm password */}
                            {mode === 'register' && password.length > 0 && (
                                <PasswordStrength password={password} />
                            )}

                            {mode === 'register' && (
                                <div className="auth-input-wrap">
                                    <input
                                        type={showConfirm ? 'text' : 'password'}
                                        placeholder="Confirmar contraseña"
                                        value={confirmPass}
                                        onChange={e => setConfirmPass(e.target.value)}
                                        className={`auth-input auth-input-pass${confirmPass && confirmPass !== password ? ' auth-input-error' : ''}`}
                                        required
                                        autoComplete="new-password"
                                    />
                                    <button
                                        type="button"
                                        className="auth-eye"
                                        onClick={() => setShowConfirm(v => !v)}
                                        tabIndex={-1}
                                    >
                                        {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            )}

                            {error && <p className="auth-error">{error}</p>}

                            <button
                                type="submit"
                                className="auth-btn-primary"
                                disabled={isLoading || (mode === 'register' && (
                                    getPasswordStrength(password) < 3 ||
                                    password !== confirmPass ||
                                    !confirmPass
                                ))}
                            >
                                {isLoading
                                    ? 'Cargando...'
                                    : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
                            </button>
                        </form>

                        {mode === 'login' && (
                            <button
                                type="button"
                                className="auth-btn-link"
                                onClick={() => transition('forgot')}
                                style={{ marginTop: '-4px' }}
                            >
                                ¿Olvidaste tu contraseña?
                            </button>
                        )}

                        <div className="auth-divider"><span>o</span></div>

                        <button onClick={handleGoogle} className="auth-btn-google">
                            <GoogleIcon />
                            Continuar con Google
                        </button>

                        <button onClick={handleApple} className="auth-btn-apple">
                            <svg viewBox="0 0 17 20" fill="currentColor" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
                                <path d="M13.545 10.239c-.022-2.234 1.823-3.306 1.906-3.358-.037-.054-1.04-1.527-2.652-1.89-1.126-.242-2.2.664-2.77.664-.582 0-1.473-.652-2.427-.634a3.58 3.58 0 0 0-3.013 1.837c-1.292 2.237-.33 5.538.924 7.352.62.886 1.35 1.882 2.314 1.846.934-.038 1.284-.6 2.413-.6 1.118 0 1.441.6 2.414.58.999-.016 1.632-.898 2.237-1.79.714-1.024.999-2.024 1.016-2.076-.024-.008-1.94-.744-1.962-2.952zM11.703 3.2C12.21 2.584 12.556 1.733 12.46.87c-.734.03-1.636.494-2.162 1.1-.47.54-.886 1.416-.776 2.248.822.063 1.663-.413 2.181-1.018z"/>
                            </svg>
                            Continuar con Apple
                        </button>
                    </div>
                )}

                {/* ── FORGOT PASSWORD ──────────────────────── */}
                {mode === 'forgot' && (
                    <div className="lp-form">
                        <button className="lp-back" onClick={() => transition('login')}>
                            <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" width="20" height="20">
                                <path d="M12.5 5L7.5 10L12.5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </button>
                        <div className="lp-form-header">
                            <h2 className="lp-form-title">Recuperar contraseña</h2>
                            <p className="lp-form-sub">Te enviaremos un enlace para restablecer tu contraseña.</p>
                        </div>
                        <form onSubmit={handleForgotPassword} className="lp-fields">
                            <input
                                type="email"
                                placeholder="Email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="auth-input"
                                required
                                autoComplete="email"
                            />
                            {error && <p className="auth-error">{error}</p>}
                            <button type="submit" className="auth-btn-primary" disabled={isLoading}>
                                {isLoading ? 'Enviando...' : 'Enviar enlace'}
                            </button>
                        </form>
                    </div>
                )}

                {/* ── FORGOT SENT ──────────────────────────── */}
                {mode === 'forgot-sent' && (
                    <div className="lp-registered">
                        <div className="lp-check-wrap">
                            <div className="lp-check-circle">
                                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="28" height="28">
                                    <path d="M5 13L9 17L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </div>
                        </div>
                        <h2 className="lp-form-title">Revisa tu email</h2>
                        <p className="lp-form-sub" style={{ maxWidth: 300, textAlign: 'center' }}>
                            Enviamos un enlace de recuperación. Haz click en él para crear una nueva contraseña.
                        </p>
                        <button className="auth-btn-link" onClick={() => transition('login')}>
                            Volver al inicio
                        </button>
                    </div>
                )}

                {/* ── EMAIL SENT (after register) ──────────── */}
                {mode === 'registered' && (
                    <div className="lp-registered">
                        <div className="lp-check-wrap">
                            <div className="lp-check-circle">
                                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="28" height="28">
                                    <path d="M5 13L9 17L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </div>
                        </div>
                        <h2 className="lp-form-title">Revisa tu email</h2>
                        <p className="lp-form-sub" style={{ maxWidth: 300, textAlign: 'center' }}>
                            Enviamos un link de verificación. Haz click en él para activar tu cuenta.
                        </p>
                        <button className="auth-btn-link" onClick={() => transition('login')}>
                            Volver al inicio
                        </button>
                    </div>
                )}

                {/* ── VERIFY EMAIL (unverified login attempt) ── */}
                {mode === 'verify-email' && (
                    <VerifyEmailScreen
                        email={email}
                        onBack={() => transition('login')}
                    />
                )}

                {/* ── MFA VERIFICATION ─────────────────────── */}
                {mode === 'mfa' && (
                    <div className="lp-form">
                        <div className="lp-form-header">
                            <h2 className="lp-form-title">Verificación en dos pasos</h2>
                            <p className="lp-form-sub">Ingresa el código de tu app de autenticación.</p>
                        </div>
                        <form onSubmit={handleMfaVerify} className="lp-fields">
                            <input
                                type="text"
                                inputMode="numeric"
                                placeholder="000000"
                                value={mfaCode}
                                onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                className="auth-input"
                                maxLength={6}
                                autoComplete="one-time-code"
                                style={{ textAlign: 'center', letterSpacing: '0.3em', fontSize: '1.4rem' }}
                                autoFocus
                            />
                            {error && <p className="auth-error">{error}</p>}
                            <button type="submit" className="auth-btn-primary" disabled={isLoading || mfaCode.length < 6}>
                                {isLoading ? 'Verificando...' : 'Confirmar'}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}

function NVALoader() {
    return (
        <div className="nva-loader">
            <div className="nva-loader-ring">
                <img src="/nva-icon.svg" alt="" className="nva-loader-logo" />
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<NVALoader />}>
            <LoginPageInner />
        </Suspense>
    );
}

function PasswordStrength({ password }) {
    const score = getPasswordStrength(password);
    const reqs = [
        { label: '8+ caracteres',  met: password.length >= 8 },
        { label: 'Mayúscula',      met: /[A-Z]/.test(password) },
        { label: 'Número',         met: /[0-9]/.test(password) },
        { label: 'Símbolo',        met: /[^A-Za-z0-9]/.test(password) },
    ];

    return (
        <div className="auth-strength">
            <div className="auth-strength-bar">
                {[1,2,3,4].map(i => (
                    <div
                        key={i}
                        className="auth-strength-seg"
                        style={{ background: i <= score ? STRENGTH_COLORS[score] : '#222' }}
                    />
                ))}
            </div>
            {score > 0 && (
                <span className="auth-strength-label" style={{ color: STRENGTH_COLORS[score] }}>
                    {STRENGTH_LABELS[score]}
                </span>
            )}
            <div className="auth-reqs">
                {reqs.map(r => (
                    <span key={r.label} className={`auth-req${r.met ? ' auth-req-met' : ''}`}>
                        <Check size={10} strokeWidth={3} />
                        {r.label}
                    </span>
                ))}
            </div>
        </div>
    );
}

function VerifyEmailScreen({ email, onBack }) {
    const [resent, setResent] = useState(false);
    const [sending, setSending] = useState(false);

    async function handleResend() {
        setSending(true);
        const native = typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
        await supabase.auth.resend({
            type: 'signup',
            email,
            options: {
                emailRedirectTo: native
                    ? 'nvaapp://auth/callback'
                    : `${window.location.origin}/auth/callback`,
            },
        });
        setSending(false);
        setResent(true);
    }

    return (
        <div className="lp-registered">
            <div className="lp-check-wrap">
                <div className="lp-check-circle" style={{ background: 'rgba(255,102,0,0.12)' }}>
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="28" height="28">
                        <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke="#ff6600" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </div>
            </div>
            <h2 className="lp-form-title">Confirma tu email</h2>
            <p className="lp-form-sub" style={{ maxWidth: 300, textAlign: 'center' }}>
                Enviamos un link a <strong style={{ color: 'rgba(255,255,255,0.85)' }}>{email || 'tu correo'}</strong>. Haz click en él para activar tu cuenta.
            </p>
            {resent && (
                <p style={{ fontSize: 13, color: '#22c55e', marginTop: 4 }}>
                    ¡Correo reenviado!
                </p>
            )}
            <button
                className="auth-btn-primary"
                style={{ marginTop: '1.5rem', maxWidth: 260 }}
                onClick={handleResend}
                disabled={sending || resent}
            >
                {sending ? 'Enviando...' : resent ? 'Correo enviado' : 'Reenviar correo'}
            </button>
            <button className="auth-btn-link" onClick={onBack}>
                Volver al inicio
            </button>
        </div>
    );
}

function ArrowDiag() {
    return (
        <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" width="17" height="17" style={{ flexShrink: 0 }}>
            <path d="M5 15L15 5M15 5H7M15 5V13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    );
}

function GoogleIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
    );
}
