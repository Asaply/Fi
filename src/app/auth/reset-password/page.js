'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Check } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import '@/app/login/Login.css';

function getPasswordStrength(password) {
    let score = 0;
    if (password.length >= 8)           score++;
    if (/[A-Z]/.test(password))         score++;
    if (/[0-9]/.test(password))         score++;
    if (/[^A-Za-z0-9]/.test(password))  score++;
    return score;
}

const STRENGTH_LABELS = ['', 'Débil', 'Regular', 'Buena', 'Fuerte'];
const STRENGTH_COLORS = ['#333', '#ef4444', '#f97316', '#eab308', '#22c55e'];

export default function ResetPasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);
    const [ready, setReady] = useState(false);

    // Handle both PKCE (code already exchanged by /auth/callback) and implicit flow
    // (access_token in URL hash). In both cases, onAuthStateChange fires PASSWORD_RECOVERY.
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
                setReady(true);
            }
        });
        // Also check for existing session (callback already exchanged the code)
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) setReady(true);
        });
        return () => subscription.unsubscribe();
    }, []);

    const strength = getPasswordStrength(password);

    async function handleSubmit(e) {
        e.preventDefault();
        if (password !== confirm) { setError('Las contraseñas no coinciden.'); return; }
        if (strength < 3) { setError('Elige una contraseña más segura (mayúscula + número + 8 caracteres).'); return; }
        setIsLoading(true);
        setError('');
        const { error: err } = await supabase.auth.updateUser({ password });
        if (err) {
            setError(err.message);
        } else {
            setDone(true);
            setTimeout(() => router.push('/finanzas'), 2500);
        }
        setIsLoading(false);
    }

    if (!ready) {
        return (
            <div className="login-root">
                <div className="login-panel lp-visible">
                    <div className="lp-form">
                        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px 0' }}>
                            Verificando enlace...
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="login-root">
            <div className="login-panel lp-visible">
                <div className="lp-form">
                    <div className="lp-form-header">
                        <h2 className="lp-form-title">Nueva contraseña</h2>
                        <p className="lp-form-sub">Elige una contraseña segura para tu cuenta.</p>
                    </div>

                    {done ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px 0' }}>
                            <div className="lp-check-circle">
                                <svg viewBox="0 0 24 24" fill="none" width="28" height="28">
                                    <path d="M5 13L9 17L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center' }}>
                                Contraseña actualizada. Redirigiendo...
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="lp-fields">
                            <div className="auth-input-wrap">
                                <input
                                    type={showPass ? 'text' : 'password'}
                                    placeholder="Nueva contraseña"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="auth-input auth-input-pass"
                                    required
                                    autoComplete="new-password"
                                />
                                <button type="button" className="auth-eye" onClick={() => setShowPass(v => !v)} tabIndex={-1}>
                                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>

                            {password.length > 0 && (
                                <PasswordStrength password={password} />
                            )}

                            <div className="auth-input-wrap">
                                <input
                                    type={showConfirm ? 'text' : 'password'}
                                    placeholder="Confirmar contraseña"
                                    value={confirm}
                                    onChange={e => setConfirm(e.target.value)}
                                    className={`auth-input auth-input-pass${confirm && confirm !== password ? ' auth-input-error' : ''}`}
                                    required
                                    autoComplete="new-password"
                                />
                                <button type="button" className="auth-eye" onClick={() => setShowConfirm(v => !v)} tabIndex={-1}>
                                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>

                            {error && <p className="auth-error">{error}</p>}

                            <button
                                type="submit"
                                className="auth-btn-primary"
                                disabled={isLoading || strength < 3 || password !== confirm || !confirm}
                            >
                                {isLoading ? 'Guardando...' : 'Guardar contraseña'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}

function PasswordStrength({ password }) {
    const score = getPasswordStrength(password);
    const reqs = [
        { label: '8+ caracteres', met: password.length >= 8 },
        { label: 'Mayúscula',     met: /[A-Z]/.test(password) },
        { label: 'Número',        met: /[0-9]/.test(password) },
        { label: 'Símbolo',       met: /[^A-Za-z0-9]/.test(password) },
    ];
    return (
        <div className="auth-strength">
            <div className="auth-strength-bar">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="auth-strength-seg"
                        style={{ background: i <= score ? STRENGTH_COLORS[score] : '#222' }} />
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
                        <Check size={10} strokeWidth={3} /> {r.label}
                    </span>
                ))}
            </div>
        </div>
    );
}
