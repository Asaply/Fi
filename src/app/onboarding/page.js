'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Check, FileText, TrendingUp,
    Wallet, BarChart3, ArrowUpRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import './Onboarding.css';

const ONBOARDING_KEY = 'fnce_onboarding_v1';

// Steps:
// 0 = Loading spinner (auto 2.6s)
// 1 = Account created success
// 2 = Display name input
// 3 = Use-case selection
// 4 = Import CTA
// 5 = Done
const TOTAL_STEPS = 6;

const USE_OPTIONS = [
    { id: 'personal',  icon: Wallet,    label: 'Finanzas personales', desc: 'Controla gastos e ingresos' },
    { id: 'business',  icon: BarChart3,  label: 'Mi negocio',          desc: 'Ingresos, egresos y clientes' },
    { id: 'investing', icon: TrendingUp, label: 'Inversiones',          desc: 'Portfolio, trading y activos' },
];

export default function OnboardingPage() {
    const [step, setStep]           = useState(0);
    const [visible, setVisible]     = useState(false);
    const [selectedUse, setSelectedUse] = useState(null);
    const router = useRouter();

    // Skip if already onboarded (localStorage OR Supabase metadata)
    useEffect(() => {
        if (typeof window !== 'undefined' && localStorage.getItem(ONBOARDING_KEY)) {
            router.replace('/finanzas');
            return;
        }
        supabase.auth.getUser().then(({ data }) => {
            if (data?.user?.user_metadata?.onboarded) {
                router.replace('/finanzas');
            }
        });
        const t = setTimeout(() => setVisible(true), 60);
        return () => clearTimeout(t);
    }, [router]);

    // Step 0: auto-advance spinner
    useEffect(() => {
        if (step !== 0) return;
        const t = setTimeout(() => advance(1), 2700);
        return () => clearTimeout(t);
    }, [step]);

    function advance(next) {
        setVisible(false);
        setTimeout(() => { setStep(next); setVisible(true); }, 200);
    }

    async function complete(dest = '/finanzas') {
        if (selectedUse) localStorage.setItem('fnce_primary_use', selectedUse);
        localStorage.setItem(ONBOARDING_KEY, '1');
        // Persist onboarded flag in Supabase so existing-user check works on any device
        try {
            await supabase.auth.updateUser({ data: { onboarded: true } });
        } catch (_) {}
        router.push(dest);
    }

    return (
        <div className="ob-root">
            <div className="ob-bg-speedlines"  aria-hidden />

            <div className={`ob-content ${visible ? 'ob-visible' : ''}`}>
                {step === 0 && <StepLoading />}
                {step === 1 && <StepSuccess onNext={() => advance(2)} />}
                {step === 2 && <StepName    onNext={() => advance(3)} />}
                {step === 3 && (
                    <StepUse
                        selected={selectedUse}
                        onSelect={setSelectedUse}
                        onNext={() => advance(4)}
                    />
                )}
                {step === 4 && (
                    <StepImport
                        onImport={() => complete('/finanzas')}
                        onSkip={() => advance(5)}
                    />
                )}
                {step === 5 && <StepDone onFinish={() => complete('/finanzas')} />}
            </div>

            {/* Progress dots — hide on spinner */}
            {step > 0 && (
                <div className="ob-dots" aria-hidden>
                    {Array.from({ length: TOTAL_STEPS - 1 }).map((_, i) => (
                        <div
                            key={i}
                            className={`ob-dot${(i + 1) === step ? ' ob-dot-active' : (i + 1) < step ? ' ob-dot-done' : ''}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

/* ── Step 0: Loading spinner ─────────────────────────────── */
function StepLoading() {
    // 2*PI*44 ≈ 276.46
    return (
        <div className="ob-step">
            <div className="ob-spinner-wrap">
                <div className="ob-icon-circle ob-icon-orange">
                    <img src="/nva-icon.svg" alt="NVA" className="ob-logo-sm" />
                </div>
                <svg className="ob-spinner-svg" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="48" cy="48" r="44" stroke="rgba(255,102,0,0.12)" strokeWidth="3"/>
                    <circle
                        cx="48" cy="48" r="44"
                        stroke="#ff6600"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray="276.46"
                        strokeDashoffset="276.46"
                        className="ob-spinner-track"
                        transform="rotate(-90 48 48)"
                    />
                </svg>
            </div>
            <h1 className="ob-title">Configurando tu cuenta</h1>
            <p className="ob-subtitle">Un momento, preparamos todo para ti.</p>
        </div>
    );
}

/* ── Step 1: Account created ─────────────────────────────── */
function StepSuccess({ onNext }) {
    useEffect(() => {
        const t = setTimeout(onNext, 2200);
        return () => clearTimeout(t);
    }, [onNext]);

    return (
        <div className="ob-step">
            <div className="ob-icon-wrap">
                <div className="ob-icon-ring ob-icon-ring-green">
                    <div className="ob-icon-circle ob-icon-green">
                        <Check size={38} strokeWidth={2.5} />
                    </div>
                </div>
            </div>
            <h1 className="ob-title">¡Cuenta creada!</h1>
            <p className="ob-subtitle">Tu cuenta ha sido creada exitosamente.</p>
        </div>
    );
}

/* ── Step 2: Display name ────────────────────────────────── */
function StepName({ onNext }) {
    const [name, setName]       = useState('');
    const [loading, setLoading] = useState(false);

    async function handleContinue() {
        if (!name.trim()) { onNext(); return; }
        setLoading(true);
        try {
            await supabase.auth.updateUser({ data: { display_name: name.trim() } });
        } catch (_) {}
        setLoading(false);
        onNext();
    }

    return (
        <div className="ob-step ob-step-form">
            <div className="ob-skip-row">
                <button className="ob-btn-skip" onClick={onNext}>Saltar</button>
            </div>

            <h1 className="ob-title ob-title-left">¿Cómo te llamas?</h1>
            <p className="ob-subtitle ob-subtitle-left">
                Personaliza tu experiencia con tu nombre.
            </p>

            <div className="ob-input-wrap">
                <input
                    className="ob-input"
                    type="text"
                    placeholder="Tu nombre"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    maxLength={40}
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && handleContinue()}
                />
            </div>

            <div className="ob-actions">
                <button className="ob-btn-primary" onClick={handleContinue} disabled={loading}>
                    {loading ? 'Guardando...' : 'Continuar'}
                </button>
            </div>
        </div>
    );
}

/* ── Step 3: Use case ────────────────────────────────────── */
function StepUse({ selected, onSelect, onNext }) {
    return (
        <div className="ob-step ob-step-use">
            <h1 className="ob-title ob-title-left">¿Para qué usarás NVA?</h1>
            <p className="ob-subtitle ob-subtitle-left">
                Personaliza tu experiencia desde el inicio.
            </p>

            <div className="ob-option-list">
                {USE_OPTIONS.map(({ id, label, desc }) => (
                    <button
                        key={id}
                        className={`ob-option${selected === id ? ' ob-option-selected' : ''}`}
                        onClick={() => onSelect(id)}
                    >
                        <div className="ob-option-text">
                            <span className="ob-option-label">{label}</span>
                            <span className="ob-option-desc">{desc}</span>
                        </div>
                        <ArrowUpRight size={16} className="ob-option-arrow" />
                    </button>
                ))}
            </div>

            <div className="ob-actions">
                <button
                    className="ob-btn-primary"
                    onClick={onNext}
                    disabled={!selected}
                >
                    Continuar
                </button>
                <button className="ob-btn-link" onClick={onNext}>Saltar</button>
            </div>
        </div>
    );
}

/* ── Step 4: Import CTA ──────────────────────────────────── */
function StepImport({ onImport, onSkip }) {
    return (
        <div className="ob-step">
            <div className="ob-icon-wrap">
                <div className="ob-icon-ring">
                    <div className="ob-icon-circle ob-icon-orange">
                        <FileText size={38} strokeWidth={1.5} />
                    </div>
                </div>
            </div>

            <h1 className="ob-title">Conecta tu banco</h1>
            <p className="ob-subtitle">
                Importa un estado de cuenta en PDF para ver tus movimientos
                automáticamente, sin teclear nada.
            </p>

            <div className="ob-actions">
                <button className="ob-btn-primary" onClick={onImport}>
                    Importar estado de cuenta
                </button>
                <button className="ob-btn-link" onClick={onSkip}>Ahora no</button>
            </div>
        </div>
    );
}

/* ── Step 5: Done ────────────────────────────────────────── */
function StepDone({ onFinish }) {
    return (
        <div className="ob-step">
            <div className="ob-icon-wrap">
                <div className="ob-icon-ring ob-icon-ring-orange">
                    <div className="ob-icon-circle ob-icon-orange">
                        <img src="/nva-icon.svg" alt="NVA" className="ob-logo-sm" />
                    </div>
                </div>
            </div>

            <h1 className="ob-title">¡Todo listo!</h1>
            <p className="ob-subtitle">
                Ya puedes usar NVA al 100%. Tu dashboard te espera.
            </p>

            <div className="ob-actions">
                <button className="ob-btn-primary" onClick={onFinish}>
                    Ir al dashboard
                </button>
            </div>
        </div>
    );
}
