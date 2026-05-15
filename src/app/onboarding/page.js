'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Check, FileText, TrendingUp,
    Lock, Eye, Shield, Building2,
    FileSearch, Lightbulb,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import './Onboarding.css';

const ONBOARDING_KEY = 'fnce_onboarding_v1';

// Steps:
// 0 = Loading spinner (auto 2.6s)
// 1 = Account created success (auto 2.2s)
// 2 = Value proposition
// 3 = Display name input
// 4 = Goal selection
// 5 = Security
// 6 = Import CTA
// 7 = Done
const TOTAL_STEPS = 8;

const GOAL_OPTIONS = [
    { id: 'save',    label: 'Ahorrar más',          desc: 'Encuentra dónde recortar gastos' },
    { id: 'control', label: 'Controlar mis gastos',  desc: 'Categoriza y visualiza cada peso' },
    { id: 'invest',  label: 'Invertir mi dinero',    desc: 'Portfolio, trading y activos' },
    { id: 'debt',    label: 'Mejorar mis finanzas',  desc: 'Deudas, crédito y flujo de caja' },
];

export default function OnboardingPage() {
    const [step, setStep]               = useState(0);
    const [visible, setVisible]         = useState(false);
    const [selectedGoal, setSelectedGoal] = useState(null);
    const router = useRouter();

    // Skip if already onboarded
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
        if (selectedGoal) localStorage.setItem('fnce_primary_use', selectedGoal);
        localStorage.setItem(ONBOARDING_KEY, '1');
        try {
            await supabase.auth.updateUser({ data: { onboarded: true } });
        } catch (_) {}
        router.push(dest);
    }

    return (
        <div className="ob-root">
            <div className="ob-bg-speedlines" aria-hidden />

            <div className={`ob-content ${visible ? 'ob-visible' : ''}`}>
                {step === 0 && <StepLoading />}
                {step === 1 && <StepSuccess onNext={() => advance(2)} />}
                {step === 2 && <StepValueProp onNext={() => advance(3)} />}
                {step === 3 && <StepName onNext={() => advance(4)} />}
                {step === 4 && (
                    <StepGoal
                        selected={selectedGoal}
                        onSelect={setSelectedGoal}
                        onNext={() => advance(5)}
                    />
                )}
                {step === 5 && <StepSecurity onNext={() => advance(6)} />}
                {step === 6 && (
                    <StepImport
                        onImport={() => complete('/finanzas')}
                        onSkip={() => advance(7)}
                    />
                )}
                {step === 7 && <StepDone onFinish={() => complete('/finanzas')} />}
            </div>

            {/* Progress dots — hide on spinner and success */}
            {step > 1 && (
                <div className="ob-dots" aria-hidden>
                    {Array.from({ length: TOTAL_STEPS - 2 }).map((_, i) => (
                        <div
                            key={i}
                            className={`ob-dot${(i + 2) === step ? ' ob-dot-active' : (i + 2) < step ? ' ob-dot-done' : ''}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

/* ── Step 0: Loading spinner ─────────────────────────────── */
function StepLoading() {
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

/* ── Step 2: Value proposition ───────────────────────────── */
function StepValueProp({ onNext }) {
    const features = [
        { icon: FileSearch, text: 'Analizamos tus estados de cuenta automáticamente.' },
        { icon: Lightbulb,  text: 'Detectamos patrones invisibles en tus gastos.' },
        { icon: TrendingUp, text: 'Recibe insights reales, no solo gráficas.' },
    ];

    return (
        <div className="ob-step">
            <h1 className="ob-title ob-title-xl">
                Entiende a dónde<br />va tu dinero.
            </h1>
            <div className="ob-feature-list">
                {features.map(({ icon: Icon, text }, i) => (
                    <div key={i} className="ob-feature-item">
                        <div className="ob-feature-icon">
                            <Icon size={18} strokeWidth={1.8} />
                        </div>
                        <p className="ob-feature-text">{text}</p>
                    </div>
                ))}
            </div>
            <div className="ob-actions">
                <button className="ob-btn-primary" onClick={onNext}>Comenzar</button>
            </div>
        </div>
    );
}

/* ── Step 3: Display name ────────────────────────────────── */
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

/* ── Step 4: Goal selection ──────────────────────────────── */
function StepGoal({ selected, onSelect, onNext }) {
    return (
        <div className="ob-step ob-step-use">
            <h1 className="ob-title ob-title-left">¿Cuál es tu objetivo principal?</h1>
            <p className="ob-subtitle ob-subtitle-left">
                Personalizamos NVA según tu meta.
            </p>

            <div className="ob-option-list">
                {GOAL_OPTIONS.map(({ id, label, desc }) => (
                    <button
                        key={id}
                        className={`ob-option${selected === id ? ' ob-option-selected' : ''}`}
                        onClick={() => onSelect(id)}
                    >
                        <div className="ob-option-text">
                            <span className="ob-option-label">{label}</span>
                            <span className="ob-option-desc">{desc}</span>
                        </div>
                        <div className={`ob-option-check${selected === id ? ' ob-option-check-active' : ''}`}>
                            {selected === id && <Check size={13} strokeWidth={3} />}
                        </div>
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

/* ── Step 5: Security ────────────────────────────────────── */
function StepSecurity({ onNext }) {
    const items = [
        { icon: Lock,      title: 'Cifrado de 256-bit',        desc: 'Nivel bancario' },
        { icon: Eye,       title: 'Solo lectura',               desc: 'No podemos mover tu dinero' },
        { icon: Building2, title: 'Estándares bancarios',       desc: 'Cumplimos normativas internacionales' },
        { icon: Shield,    title: 'Tu privacidad es primero',   desc: 'Nunca vendemos tus datos' },
    ];

    return (
        <div className="ob-step">
            <p className="ob-overline">Tu seguridad es nuestra prioridad</p>
            <h1 className="ob-title ob-title-xl">
                Tus datos están<br />100% protegidos.
            </h1>

            <div className="ob-security-list">
                {items.map(({ icon: Icon, title, desc }, i) => (
                    <div key={i} className="ob-security-item">
                        <div className="ob-security-icon">
                            <Icon size={16} strokeWidth={1.8} />
                        </div>
                        <div className="ob-security-text">
                            <span className="ob-security-title">{title}</span>
                            <span className="ob-security-desc">{desc}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="ob-actions">
                <button className="ob-btn-primary" onClick={onNext}>Continuar</button>
            </div>
        </div>
    );
}

/* ── Step 6: Import CTA ──────────────────────────────────── */
function StepImport({ onImport, onSkip }) {
    return (
        <div className="ob-step ob-step-form">
            <p className="ob-overline">Paso 1 de 1</p>
            <h1 className="ob-title ob-title-left">
                Sube tu primer<br />estado de cuenta
            </h1>
            <p className="ob-subtitle ob-subtitle-left">
                Puedes subir PDF o imagen. NVA lo analiza automáticamente.
            </p>

            <div className="ob-upload-box">
                <FileText size={34} strokeWidth={1.2} color="#ff6600" />
                <p className="ob-upload-label">Arrastra tu archivo aquí</p>
                <p className="ob-upload-sub">PDF · PNG · JPG (Máx. 20MB)</p>
            </div>

            <div className="ob-actions">
                <button className="ob-btn-primary" onClick={onImport}>
                    Subir estado de cuenta
                </button>
                <button className="ob-btn-link" onClick={onSkip}>¿No lo tienes a mano? Más tarde</button>
            </div>
        </div>
    );
}

/* ── Step 7: Done ────────────────────────────────────────── */
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

            <h1 className="ob-title">¡Bienvenido a NVA!</h1>
            <p className="ob-subtitle">
                Estás listo para tomar el control de tu dinero y lograr tus metas.
            </p>

            <div className="ob-actions">
                <button className="ob-btn-primary" onClick={onFinish}>
                    Ir a mi dashboard
                </button>
            </div>
        </div>
    );
}
