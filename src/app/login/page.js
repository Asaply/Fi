'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CircleDollarSign } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import './Login.css';

export default function LoginPage() {
    const [mode, setMode] = useState('login'); // 'login' | 'register'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [registered, setRegistered] = useState(false);
    const router = useRouter();

    async function handleEmailAuth(e) {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        if (mode === 'login') {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                setError(error.message);
            } else {
                router.push('/dashboard');
            }
        } else {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth/callback`,
                },
            });
            if (error) {
                setError(error.message);
            } else {
                setRegistered(true);
            }
        }
        setIsLoading(false);
    }

    async function handleGoogleAuth() {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${window.location.origin}/auth/callback` },
        });
    }

    return (
        <div className="login-root">
            <div className="login-bg-glow" aria-hidden="true" />
            <div className="login-bg-speedlines" aria-hidden="true" />
            <div className="login-card">
                {/* Logo */}
                <div className="login-logo">
                    <div className="login-logo-icon">
                        <CircleDollarSign size={28} strokeWidth={1.8} />
                    </div>
                    <h1 className="login-title">FNCE</h1>
                    <p className="login-subtitle">Tus finanzas en un solo lugar</p>
                </div>

                {/* Mode tabs */}
                <div className="login-tabs">
                    <button
                        className={`login-tab ${mode === 'login' ? 'active' : ''}`}
                        onClick={() => { setMode('login'); setError(''); setRegistered(false); }}
                    >
                        Iniciar sesión
                    </button>
                    <button
                        className={`login-tab ${mode === 'register' ? 'active' : ''}`}
                        onClick={() => { setMode('register'); setError(''); setRegistered(false); }}
                    >
                        Registrarse
                    </button>
                </div>

                {/* Post-register confirmation */}
                {registered ? (
                    <div className="login-confirm-box">
                        <span className="login-confirm-check">✓</span>
                        Revisa tu email y haz click en el link de verificación. Al hacerlo, entrarás automáticamente a la app.
                    </div>
                ) : (
                    <>
                        {/* Form */}
                        <form onSubmit={handleEmailAuth} className="login-form">
                            <input
                                type="email"
                                placeholder="Email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="login-input"
                                required
                                autoComplete="email"
                            />
                            <input
                                type="password"
                                placeholder="Contraseña"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="login-input"
                                required
                                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                            />

                            {error && <p className="login-error">{error}</p>}

                            <button type="submit" className="login-btn-primary" disabled={isLoading}>
                                {isLoading ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
                            </button>
                        </form>

                        {/* Divider */}
                        <div className="login-divider">
                            <span className="login-divider-line" />
                            <span className="login-divider-text">o</span>
                            <span className="login-divider-line" />
                        </div>

                        {/* Google */}
                        <button onClick={handleGoogleAuth} className="login-btn-google">
                            <svg width="16" height="16" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Continuar con Google
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
