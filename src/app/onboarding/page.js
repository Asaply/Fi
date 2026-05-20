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
// 7 = Analysis insights (post-import)
// 8 = Plans / payment (paywall)
// 9 = Done
const TOTAL_STEPS = 10;

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
    const [analysisData, setAnalysisData] = useState(null);
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
        window.location.href = dest;
    }

    async function completeAndPay() {
        if (selectedGoal) localStorage.setItem('fnce_primary_use', selectedGoal);
        localStorage.setItem(ONBOARDING_KEY, '1');
        try {
            await supabase.auth.updateUser({ data: { onboarded: true } });
        } catch (_) {}
        try {
            const res = await fetch('/api/stripe/create-checkout', { method: 'POST' });
            const data = await res.json();
            if (data.url) { window.location.href = data.url; return; }
        } catch (_) {}
        router.push('/paywall');
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
                        onImportComplete={(data) => { setAnalysisData(data); advance(7); }}
                        onSkip={() => advance(8)}
                    />
                )}
                {step === 7 && (
                    <StepInsights
                        data={analysisData}
                        onNext={() => advance(8)}
                    />
                )}
                {step === 8 && (
                    <StepPlans
                        onPay={completeAndPay}
                        onSkip={() => advance(9)}
                    />
                )}
                {step === 9 && <StepDone onFinish={() => complete('/finanzas')} />}
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
            <div className="ob-vp-logo-wrap">
                <img src="/nva-icon.svg" alt="NVA" className="ob-vp-logo" />
            </div>
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
function StepImport({ onImportComplete, onSkip }) {
    const [file, setFile]       = useState(null);
    const [dragging, setDragging] = useState(false);
    const [loading, setLoading] = useState(false);
    const [statusMsg, setStatusMsg] = useState('');
    const [error, setError]     = useState('');

    async function handleUpload() {
        if (!file) return;
        setLoading(true);
        setError('');
        setStatusMsg('Leyendo tu estado de cuenta...');

        try {
            const fd = new FormData();
            fd.append('file', file);

            setStatusMsg('Detectando banco y transacciones...');
            const res = await fetch('/api/analyze', { method: 'POST', body: fd });
            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Error al procesar el archivo.');
            }

            setStatusMsg('Guardando transacciones...');

            const { data: { user } } = await supabase.auth.getUser();
            const banco = data.bank || 'Desconocido';
            const accountType = data.tipo_cuenta || 'debito';

            const payload = (data.transactions || []).map(t => ({
                date: t.fecha,
                concept: t.concepto,
                amount: t.monto,
                type: t.tipo === 'ajuste' ? 'egreso' : t.tipo,
                client: 'N/A',
                categoria: t.categoria || 'Otros',
                bank: banco,
                account_type: accountType,
                user_id: user.id,
            }));

            if (payload.length > 0) {
                await supabase.from('transactions').insert(payload);
            }

            onImportComplete(data);
        } catch (err) {
            setError(err.message || 'Error al procesar el archivo. Intenta de nuevo.');
            setLoading(false);
        }
    }

    function handleDrop(e) {
        e.preventDefault();
        setDragging(false);
        const dropped = e.dataTransfer.files?.[0];
        if (dropped) setFile(dropped);
    }

    return (
        <div className="ob-step ob-step-form">
            <p className="ob-overline">Paso 1 de 1</p>
            <h1 className="ob-title ob-title-left">
                Sube tu primer<br />estado de cuenta
            </h1>
            <p className="ob-subtitle ob-subtitle-left">
                Compatible con todos los bancos de México: Nu, BBVA, Banorte, Santander, HSBC, Citibanamex, Spin, Mercado Pago, Hey Banco y más.
            </p>

            {!loading ? (
                <>
                    <input
                        type="file"
                        accept=".pdf"
                        id="ob-file-input"
                        style={{ display: 'none' }}
                        onChange={e => { setFile(e.target.files?.[0] || null); setError(''); }}
                    />
                    <label
                        htmlFor="ob-file-input"
                        className={`ob-upload-box${dragging ? ' ob-upload-dragging' : ''}${file ? ' ob-upload-has-file' : ''}`}
                        onDragOver={e => { e.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={handleDrop}
                    >
                        <FileText size={34} strokeWidth={1.2} color={file ? '#fff' : '#ff6600'} />
                        <p className="ob-upload-label">{file ? file.name : 'Toca para seleccionar tu PDF'}</p>
                        <p className="ob-upload-sub">{file ? 'Toca para cambiar archivo' : 'PDF · Máx. 20MB · Solo lectura'}</p>
                    </label>

                    {error && <p className="ob-error">{error}</p>}

                    <div className="ob-actions">
                        <button
                            className="ob-btn-primary"
                            onClick={handleUpload}
                            disabled={!file}
                        >
                            Analizar estado de cuenta
                        </button>
                        <button className="ob-btn-link" onClick={onSkip}>¿No lo tienes a mano? Más tarde</button>
                    </div>
                </>
            ) : (
                <>
                    <div className="ob-progress-wrap">
                        <div className="ob-progress-track">
                            <div className="ob-progress-fill" />
                        </div>
                        <p className="ob-progress-msg">{statusMsg}</p>
                    </div>
                    <div className="ob-actions" style={{ marginTop: '32px' }}>
                        <button className="ob-btn-link" onClick={onSkip}>Saltar por ahora</button>
                    </div>
                </>
            )}
        </div>
    );
}

/* ── Step 7: Analysis insights ───────────────────────────── */
function formatMXN(n) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n || 0);
}

function StepInsights({ data, onNext }) {
    const ins = data?.insights || {};
    const banco = data?.bank || 'tu banco';
    const count = data?.transactionCount || 0;
    const topCats = (ins.categories || []).slice(0, 3);
    const topLeak = ins.topLeaks?.[0];

    return (
        <div className="ob-step">
            <p className="ob-overline">¡Listo! Analizamos {count} movimientos</p>
            <h1 className="ob-title ob-title-xl ob-title-left">
                ¡Encontramos<br />esto!
            </h1>
            <p className="ob-subtitle ob-subtitle-left">
                Algunos insights clave de tu estado de {banco}.
            </p>

            <div className="ob-insights-grid">
                <div className="ob-insight-card ob-insight-card-wide">
                    <p className="ob-insight-label">Gasto total del período</p>
                    <p className="ob-insight-value">{formatMXN(ins.totalExpenses)}</p>
                    {ins.totalIncome > 0 && (
                        <p className="ob-insight-sub">Ingresos: {formatMXN(ins.totalIncome)}</p>
                    )}
                </div>

                {topLeak && (
                    <div className="ob-insight-card ob-insight-card-wide ob-insight-card-warn">
                        <p className="ob-insight-label">Mayor gasto recurrente</p>
                        <p className="ob-insight-value">{formatMXN(topLeak.amount)}</p>
                        <p className="ob-insight-sub">{topLeak.name}</p>
                    </div>
                )}

                {topCats.length > 0 && (
                    <div className="ob-insight-card ob-insight-card-wide">
                        <p className="ob-insight-label">Top categorías</p>
                        <div className="ob-cat-list">
                            {topCats.map((c, i) => (
                                <div key={i} className="ob-cat-row">
                                    <span className="ob-cat-dot" style={{ background: c.color || '#ff6600' }} />
                                    <span className="ob-cat-name">{c.name}</span>
                                    <span className="ob-cat-amt">{formatMXN(c.amount)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="ob-actions">
                <button className="ob-btn-primary" onClick={onNext}>
                    Ver todos mis insights
                </button>
            </div>
        </div>
    );
}

/* ── Step 8: Plans ───────────────────────────────────────── */
const PLAN_FEATURES = [
    'Análisis ilimitados de estados de cuenta',
    'Categorización automática con IA',
    'Detección de fugas de dinero',
    'Dashboard financiero completo',
    'Portfolio y trading tracker',
    'Actualizaciones incluidas para siempre',
];

function StepPlans({ onPay, onSkip }) {
    const [loading, setLoading]   = useState(false);
    const [checking, setChecking] = useState(true);
    const [error, setError]       = useState('');

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            if (data?.user?.user_metadata?.subscription_status === 'active') {
                onSkip();
            } else {
                setChecking(false);
            }
        });
    }, [onSkip]);

    async function handlePay() {
        setLoading(true);
        setError('');
        try {
            await onPay();
        } catch (_) {
            setError('Error al iniciar el pago. Intenta de nuevo.');
            setLoading(false);
        }
    }

    if (checking) return null;

    return (
        <div className="ob-step">
            <p className="ob-overline">Último paso</p>
            <h1 className="ob-title ob-title-xl">
                Activa NVA<br />al 100%.
            </h1>
            <p className="ob-subtitle">Pago único · Sin suscripción</p>

            <ul className="ob-plan-features">
                {PLAN_FEATURES.map((f, i) => (
                    <li key={i} className="ob-plan-feature-item">
                        <span className="ob-plan-check"><Check size={12} strokeWidth={3} /></span>
                        {f}
                    </li>
                ))}
            </ul>

            <div className="ob-plan-price-card">
                <div className="ob-plan-price-row">
                    <span className="ob-plan-currency">$</span>
                    <span className="ob-plan-price">99</span>
                    <span className="ob-plan-period">MXN · pago único</span>
                </div>
                <p className="ob-plan-note">Pago seguro vía Stripe · Tarjetas de crédito y débito</p>
            </div>

            {error && <p className="ob-error">{error}</p>}

            <div className="ob-actions">
                <button className="ob-btn-pay" onClick={handlePay} disabled={loading}>
                    {loading ? 'Redirigiendo...' : 'Activar NVA — $99 MXN'}
                </button>
                <p className="ob-plan-required-note">
                    Activa tu cuenta para acceder al dashboard
                </p>
            </div>
        </div>
    );
}

/* ── Step 9: Done ────────────────────────────────────────── */
function StepDone({ onFinish }) {
    return (
        <div className="ob-step">
            <div className="ob-done-logo-wrap">
                <img src="/nva-icon.svg" alt="NVA" className="ob-done-logo" />
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
