'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    CircleDollarSign, Check, FileText, TrendingUp,
    Wallet, BarChart3, ArrowUpRight,
} from 'lucide-react';
import './Onboarding.css';

const ONBOARDING_KEY = 'fnce_onboarding_v1';

const USE_OPTIONS = [
    { id: 'personal',   icon: Wallet,    label: 'Finanzas personales', desc: 'Controla gastos e ingresos' },
    { id: 'business',   icon: BarChart3,  label: 'Mi negocio',          desc: 'Ingresos, egresos y clientes' },
    { id: 'investing',  icon: TrendingUp, label: 'Inversiones',          desc: 'Portfolio, trading y activos' },
];

export default function OnboardingPage() {
    const [step, setStep]           = useState(0);
    const [visible, setVisible]     = useState(false);
    const [selectedUse, setSelectedUse] = useState(null);
    const router = useRouter();

    useEffect(() => {
        if (typeof window !== 'undefined' && localStorage.getItem(ONBOARDING_KEY)) {
            router.replace('/dashboard');
            return;
        }
        const t = setTimeout(() => setVisible(true), 60);
        return () => clearTimeout(t);
    }, [router]);

    function advance(next) {
        setVisible(false);
        setTimeout(() => { setStep(next); setVisible(true); }, 200);
    }

    function complete(dest = '/dashboard') {
        if (selectedUse) localStorage.setItem('fnce_primary_use', selectedUse);
        localStorage.setItem(ONBOARDING_KEY, '1');
        router.push(dest);
    }

    return (
        <div className="ob-root">
            <div className="ob-bg-glow" aria-hidden />

            <div className={`ob-content ${visible ? 'ob-visible' : ''}`}>
                {step === 0 && (
                    <StepWelcome onNext={() => advance(1)} />
                )}
                {step === 1 && (
                    <StepUse
                        selected={selectedUse}
                        onSelect={setSelectedUse}
                        onNext={() => advance(2)}
                    />
                )}
                {step === 2 && (
                    <StepImport
                        onImport={() => complete('/finanzas')}
                        onSkip={() => advance(3)}
                    />
                )}
                {step === 3 && (
                    <StepDone onFinish={() => complete('/dashboard')} />
                )}
            </div>

            <div className="ob-dots" aria-hidden>
                {[0, 1, 2, 3].map(i => (
                    <div
                        key={i}
                        className={`ob-dot${i === step ? ' ob-dot-active' : i < step ? ' ob-dot-done' : ''}`}
                    />
                ))}
            </div>
        </div>
    );
}

/* ── Step 0: Welcome ─────────────────────────────────── */
function StepWelcome({ onNext }) {
    return (
        <div className="ob-step">
            <div className="ob-icon-wrap">
                <div className="ob-icon-ring">
                    <div className="ob-icon-circle ob-icon-orange">
                        <CircleDollarSign size={38} strokeWidth={1.5} />
                    </div>
                </div>
            </div>

            <h1 className="ob-title">Bienvenido a FNCE</h1>
            <p className="ob-subtitle">
                Tu centro de control financiero. Conecta tus bancos,
                visualiza tu dinero y toma mejores decisiones.
            </p>

            <div className="ob-actions">
                <button className="ob-btn-primary" onClick={onNext}>
                    Comenzar
                </button>
            </div>
        </div>
    );
}

/* ── Step 1: Use case ────────────────────────────────── */
function StepUse({ selected, onSelect, onNext }) {
    return (
        <div className="ob-step ob-step-use">
            <h1 className="ob-title ob-title-left">¿Para qué usarás FNCE?</h1>
            <p className="ob-subtitle ob-subtitle-left">
                Personalizamos tu experiencia desde el inicio.
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

/* ── Step 2: Import CTA ──────────────────────────────── */
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

/* ── Step 3: Done ────────────────────────────────────── */
function StepDone({ onFinish }) {
    return (
        <div className="ob-step">
            <div className="ob-icon-wrap">
                <div className="ob-icon-ring ob-icon-ring-green">
                    <div className="ob-icon-circle ob-icon-green">
                        <Check size={38} strokeWidth={2.5} />
                    </div>
                </div>
            </div>

            <h1 className="ob-title">¡Todo listo!</h1>
            <p className="ob-subtitle">
                Ya puedes usar FNCE al 100%. Tu dashboard te espera.
            </p>

            <div className="ob-actions">
                <button className="ob-btn-primary" onClick={onFinish}>
                    Ir al dashboard
                </button>
            </div>
        </div>
    );
}
