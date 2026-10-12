'use client';
/**
 * Demo entry point.
 *
 * One link for the whole test group: /demo?code=<DEMO_ACCESS_CODE>. Each tester
 * who opens it gets their OWN throwaway account, seeded with the sample bank
 * statements. Nobody shares a user_id, so no tester can wipe or edit another's
 * data — RLS already isolates them.
 *
 * An existing session is reused instead of burning a new demo on every reload.
 */
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { API_BASE } from '@/lib/apiBase';
import '../login/Login.css';
import './Demo.css';

const DEST = '/finanzas';

const STEPS = [
    'Creando tu cuenta de prueba…',
    'Cargando estados de cuenta de ejemplo…',
    'Entrando…',
];

function DemoPageInner() {
    const router = useRouter();
    const params = useSearchParams();

    const [code, setCode] = useState('');
    const [phase, setPhase] = useState('checking'); // checking | form | working | done
    const [step, setStep] = useState(0);
    const [error, setError] = useState('');
    const [existingEmail, setExistingEmail] = useState('');

    /* Reuse an active session rather than provisioning another demo. */
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (cancelled) return;
            if (user) { setExistingEmail(user.email || ''); setPhase('existing'); return; }
            setCode(params.get('code') || '');
            setPhase('form');
        })();
        return () => { cancelled = true; };
    }, [params]);

    const startDemo = useCallback(async (accessCode) => {
        setError('');
        setPhase('working');
        setStep(0);
        try {
            const res = await fetch(`${API_BASE}/api/demo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: accessCode }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'No se pudo crear la cuenta de prueba.');

            setStep(2);
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: data.email,
                password: data.password,
            });
            if (signInError) throw new Error(signInError.message);

            setPhase('done');
            router.replace(DEST);
        } catch (err) {
            setError(err?.message || 'Error inesperado.');
            setPhase('form');
        }
    }, [router]);

    /* With ?code= in the link the demo starts on its own — one click for testers. */
    useEffect(() => {
        const fromUrl = params.get('code');
        if (phase === 'form' && fromUrl && !error) startDemo(fromUrl);
    }, [phase, params, error, startDemo]);

    /* Advance the progress copy while the seed inserts (~500 rows). */
    useEffect(() => {
        if (phase !== 'working' || step >= 1) return;
        const t = setTimeout(() => setStep(1), 1200);
        return () => clearTimeout(t);
    }, [phase, step]);

    if (phase === 'checking') return <div className="login-root" />;

    return (
        <div className="login-root">
            <div className="login-panel lp-visible">
                <div className="lp-form">
                    <div className="lp-form-header demo-header">
                        <img src="/nva-icon.svg" alt="NVA" className="lp-logo-img" />
                        <h2 className="lp-form-title">Cuenta de prueba</h2>
                        <p className="lp-form-sub">
                            Datos de ejemplo ya cargados: 6 cuentas de 5 bancos, portafolio,
                            metas de ahorro y recordatorios. Todo lo que hagas aquí es tuyo
                            y no afecta a los demás.
                        </p>
                    </div>

                    {phase === 'existing' && (
                        <div className="lp-fields">
                            <p className="demo-note">
                                Ya tienes una sesión abierta{existingEmail ? ` como ${existingEmail}` : ''}.
                            </p>
                            <button className="auth-btn-primary" onClick={() => router.replace(DEST)}>
                                Continuar donde iba
                            </button>
                            <button
                                className="auth-btn-link"
                                onClick={async () => {
                                    await supabase.auth.signOut();
                                    setExistingEmail('');
                                    setCode(params.get('code') || '');
                                    setPhase('form');
                                }}
                            >
                                Empezar una prueba desde cero
                            </button>
                        </div>
                    )}

                    {phase === 'working' && (
                        <div className="lp-fields">
                            <div className="demo-spinner" aria-hidden />
                            <p className="demo-note">{STEPS[step]}</p>
                        </div>
                    )}

                    {phase === 'form' && (
                        <form
                            className="lp-fields"
                            onSubmit={(e) => { e.preventDefault(); if (code.trim()) startDemo(code.trim()); }}
                        >
                            {error && <p className="auth-error">{error}</p>}
                            <input
                                type="text"
                                className="auth-input"
                                placeholder="Código de acceso"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                autoComplete="off"
                                autoCapitalize="none"
                                spellCheck={false}
                                required
                            />
                            <button type="submit" className="auth-btn-primary" disabled={!code.trim()}>
                                Entrar a la demo
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function DemoPage() {
    return (
        <Suspense fallback={<div className="login-root" />}>
            <DemoPageInner />
        </Suspense>
    );
}
