'use client';

import { useState, useEffect, useCallback } from 'react';
import { Delete, AlertCircle, Fingerprint, Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { verifyPin, verifyBiometric, isBiometricEnabled, markUnlocked, disablePin } from '@/lib/pinAuth';

const PIN_ATTEMPTS_KEY = 'fnce_pin_attempts';
const MAX_PIN_ATTEMPTS = 5;

function getPinAttempts() {
    try { return parseInt(localStorage.getItem(PIN_ATTEMPTS_KEY) || '0', 10); } catch { return 0; }
}
function incPinAttempts() {
    try { localStorage.setItem(PIN_ATTEMPTS_KEY, String(getPinAttempts() + 1)); } catch {}
}
function resetPinAttempts() {
    try { localStorage.removeItem(PIN_ATTEMPTS_KEY); } catch {}
}
import './PinLock.css';

const PIN_LENGTH = 4;

export default function PinLock({ onUnlock }) {
    const router = useRouter();
    const [view, setView] = useState('pin'); // 'pin' | 'forgot'

    return view === 'pin'
        ? <PinView onUnlock={onUnlock} onForgot={() => setView('forgot')} />
        : <ForgotView onBack={() => setView('pin')} onUnlock={onUnlock} router={router} />;
}

/* ── PIN numpad view ── */
function PinView({ onUnlock, onForgot }) {
    const [digits, setDigits] = useState('');
    const [error, setError] = useState('');
    const [shaking, setShaking] = useState(false);
    const [bioAvailable, setBioAvailable] = useState(false);
    const [attempts, setAttempts] = useState(() => getPinAttempts());

    const locked = attempts >= MAX_PIN_ATTEMPTS;

    const tryBiometric = useCallback(async () => {
        try {
            const ok = await verifyBiometric();
            if (ok) { resetPinAttempts(); markUnlocked(); onUnlock(); }
        } catch {
            // user cancelled — fall back to PIN silently
        }
    }, [onUnlock]);

    useEffect(() => {
        if (isBiometricEnabled() && !locked) {
            setBioAvailable(true);
            tryBiometric();
        }
    }, [tryBiometric, locked]);

    const shake = () => {
        setShaking(true);
        setTimeout(() => setShaking(false), 500);
    };

    const handleDigit = useCallback(async (d) => {
        if (digits.length >= PIN_LENGTH || locked) return;
        const next = digits + d;
        setDigits(next);
        setError('');

        if (next.length === PIN_LENGTH) {
            const ok = await verifyPin(next);
            if (ok) {
                resetPinAttempts();
                markUnlocked();
                onUnlock();
            } else {
                incPinAttempts();
                const newAttempts = getPinAttempts();
                setAttempts(newAttempts);
                const remaining = MAX_PIN_ATTEMPTS - newAttempts;
                if (remaining <= 0) {
                    setError('PIN bloqueado');
                } else {
                    setError(`PIN incorrecto · ${remaining} intento${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''}`);
                }
                shake();
                setDigits('');
            }
        }
    }, [digits, onUnlock, locked]);

    const handleDelete = () => {
        setDigits(prev => prev.slice(0, -1));
        setError('');
    };

    // Locked state — too many failed attempts
    if (locked) {
        return (
            <div className="pin-lock">
                <div className="pin-lock-inner">
                    <div className="pin-lock-logo">NVA</div>
                    <p className="pin-lock-title">PIN bloqueado</p>
                    <div className="pin-error" style={{ justifyContent: 'center', marginBottom: '24px' }}>
                        <AlertCircle size={13} /> Demasiados intentos fallidos
                    </div>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '24px', lineHeight: '1.5' }}>
                        Verifica tu identidad para restablecer el PIN.
                    </p>
                    <button className="pin-forgot-btn" style={{ width: '100%' }} onClick={onForgot}>
                        Verificar identidad
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="pin-lock">
            <div className="pin-lock-inner">
                <div className="pin-lock-logo">NVA</div>
                <p className="pin-lock-title">Ingresa tu PIN</p>

                <div className={`pin-dots${shaking ? ' pin-dots-shake' : ''}`}>
                    {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                        <div key={i} className={`pin-dot${i < digits.length ? ' filled' : ''}`} />
                    ))}
                </div>

                <div className="pin-error">
                    {error && <><AlertCircle size={13} /> {error}</>}
                </div>

                <div className="pin-pad">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                        <button key={n} className="pin-key" onClick={() => handleDigit(String(n))}>
                            {n}
                        </button>
                    ))}
                    <button className="pin-key pin-key-bio" onClick={tryBiometric} disabled={!bioAvailable}>
                        {bioAvailable && <Fingerprint size={24} />}
                    </button>
                    <button className="pin-key" onClick={() => handleDigit('0')}>0</button>
                    <button className="pin-key pin-key-del" onClick={handleDelete}>
                        <Delete size={20} />
                    </button>
                </div>

                <button className="pin-forgot-link" onClick={onForgot}>
                    ¿Olvidaste tu PIN?
                </button>
            </div>
        </div>
    );
}

/* ── Forgot PIN view — verify identity to reset ── */
function ForgotView({ onBack, onUnlock, router }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleVerify(e) {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) {
            setError('Email o contraseña incorrectos.');
        } else {
            resetPinAttempts();
            disablePin();
            markUnlocked();
            onUnlock();
        }
        setIsLoading(false);
    }

    function handleGoogle() {
        // Flag to clear PIN after Google re-auth
        localStorage.setItem('fnce_pin_clear_on_login', '1');
        supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${window.location.origin}/auth/callback` },
        });
    }

    return (
        <div className="pin-lock">
            <div className="pin-lock-inner pin-forgot-inner">
                <button className="pin-back-btn" onClick={onBack}>
                    <svg viewBox="0 0 20 20" fill="none" width="20" height="20">
                        <path d="M12.5 5L7.5 10L12.5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </button>

                <div className="pin-lock-logo">NVA</div>
                <p className="pin-lock-title">Recuperar acceso</p>
                <p className="pin-forgot-sub">Verifica tu identidad para restablecer el PIN.</p>

                <form onSubmit={handleVerify} className="pin-forgot-form">
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="pin-forgot-input"
                        required
                        autoComplete="email"
                    />
                    <div className="pin-forgot-input-wrap">
                        <input
                            type={showPass ? 'text' : 'password'}
                            placeholder="Contraseña"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="pin-forgot-input"
                            required
                            autoComplete="current-password"
                        />
                        <button type="button" className="pin-forgot-eye" onClick={() => setShowPass(v => !v)} tabIndex={-1}>
                            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>

                    {error && (
                        <div className="pin-error" style={{ justifyContent: 'center' }}>
                            <AlertCircle size={13} /> {error}
                        </div>
                    )}

                    <button type="submit" className="pin-forgot-btn" disabled={isLoading}>
                        {isLoading ? 'Verificando...' : 'Verificar y restablecer PIN'}
                    </button>
                </form>

                <div className="pin-forgot-divider"><span>o</span></div>

                <button className="pin-forgot-google" onClick={handleGoogle}>
                    <GoogleIcon />
                    Continuar con Google
                </button>
            </div>
        </div>
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
