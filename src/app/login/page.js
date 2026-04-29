'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import './Login.css';

// mode: 'landing' | 'login' | 'register' | 'registered'

export default function LoginPage() {
    const [mode, setMode]           = useState('landing');
    const [tosAccepted, setTos]     = useState(false);
    const [email, setEmail]         = useState('');
    const [password, setPassword]   = useState('');
    const [showPass, setShowPass]   = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError]         = useState('');
    const [visible, setVisible]     = useState(false);
    const router = useRouter();

    useEffect(() => {
        const t = setTimeout(() => setVisible(true), 60);
        return () => clearTimeout(t);
    }, []);

    function transition(next) {
        setVisible(false);
        setError('');
        setTimeout(() => { setMode(next); setVisible(true); }, 180);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        if (mode === 'login') {
            const { error: err } = await supabase.auth.signInWithPassword({ email, password });
            if (err) setError(err.message);
            else router.push('/dashboard');
        } else {
            const { error: err } = await supabase.auth.signUp({
                email, password,
                options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
            });
            if (err) setError(err.message);
            else transition('registered');
        }
        setIsLoading(false);
    }

    async function handleGoogle() {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${window.location.origin}/auth/callback` },
        });
    }

    return (
        <div className="login-root">
            <div className="login-bg-glow"        aria-hidden />
            <div className="login-bg-speedlines"  aria-hidden />

            <div className={`login-panel ${visible ? 'lp-visible' : ''}`}>

                {/* ── LANDING ──────────────────────────────── */}
                {mode === 'landing' && (
                    <div className="lp-landing">
                        <div className="lp-top">
                            <img src="/img/finn-logo.svg" alt="FINN" className="lp-logo-img" />
                            <h1 className="lp-brand">FINN</h1>
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
                                    <a href="#" className="tos-link" onClick={e => e.stopPropagation()}>Términos y Condiciones</a>
                                    {' '}y la{' '}
                                    <a href="#" className="tos-link" onClick={e => e.stopPropagation()}>Política de Privacidad</a>
                                    {' '}de FINN
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
                                    ? 'Entra a tu cuenta FINN'
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

                            {error && <p className="auth-error">{error}</p>}

                            <button type="submit" className="auth-btn-primary" disabled={isLoading}>
                                {isLoading
                                    ? 'Cargando...'
                                    : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
                            </button>
                        </form>

                        <div className="auth-divider"><span>o</span></div>

                        <button onClick={handleGoogle} className="auth-btn-google">
                            <GoogleIcon />
                            Continuar con Google
                        </button>
                    </div>
                )}

                {/* ── EMAIL SENT ───────────────────────────── */}
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
            </div>
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
