'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
    Upload, PieChart, Bug, Lightbulb, Calendar,
    TrendingUp, PiggyBank, Shield, X, ChevronRight, ChevronLeft,
} from 'lucide-react';

const TUTORIAL_KEY = 'fnce_tutorial_v3';

const SLIDES = [
    {
        step: '01',
        icon: Upload,
        color: '#FF8700',
        grad: 'linear-gradient(135deg, rgba(255,135,0,0.2) 0%, rgba(255,80,0,0.08) 100%)',
        title: 'Importa tu banco',
        body: 'Sube el PDF o CSV de cualquier banco de México — BBVA, Nu, Santander, Banorte, HSBC, Citibanamex y más. La IA categoriza todo en segundos.',
        tip: 'Puedes importar múltiples estados de cuenta y verlos en conjunto o individualmente.',
    },
    {
        step: '02',
        icon: PieChart,
        color: '#a78bfa',
        grad: 'linear-gradient(135deg, rgba(167,139,250,0.2) 0%, rgba(99,102,241,0.08) 100%)',
        title: 'Finanzas',
        body: 'Explora ingresos, egresos e inversiones por categoría. Toca cualquier sección de la gráfica para ver el detalle de esas transacciones.',
        tip: 'Filtra por mes, trimestre o año con las píldoras de período en la parte superior.',
    },
    {
        step: '03',
        icon: Bug,
        color: '#f59e0b',
        grad: 'linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(234,88,12,0.08) 100%)',
        title: 'Gastos Hormiga',
        body: 'NVA detecta suscripciones olvidadas, cafés diarios y pequeños gastos recurrentes. Te muestra cuánto suman al mes y proyectados al año.',
        tip: 'Toca cualquier patrón para ver todas las transacciones que lo componen.',
    },
    {
        step: '04',
        icon: Lightbulb,
        color: '#34d399',
        grad: 'linear-gradient(135deg, rgba(52,211,153,0.2) 0%, rgba(16,185,129,0.08) 100%)',
        title: 'NVA Insights',
        body: 'Tu panel de inteligencia financiera. Analiza tus patrones de gasto, salud financiera y te da recomendaciones personalizadas basadas en tus movimientos.',
        tip: 'Los insights se actualizan cada vez que importas nuevos movimientos.',
    },
    {
        step: '05',
        icon: Calendar,
        color: '#38bdf8',
        grad: 'linear-gradient(135deg, rgba(56,189,248,0.2) 0%, rgba(14,165,233,0.08) 100%)',
        title: 'Calendario financiero',
        body: 'Ve tu dinero día a día. Verde = ingresos, rojo = egresos. Toca cualquier día para ver cada movimiento de esa fecha.',
        tip: 'El calendario salta automáticamente al mes de tu estado de cuenta más reciente.',
    },
    {
        step: '06',
        icon: TrendingUp,
        color: '#10b981',
        grad: 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(5,150,105,0.08) 100%)',
        title: 'Portfolio Health',
        body: 'Registra acciones, ETFs y crypto con tu precio de compra. Los precios se actualizan en tiempo real vía Yahoo Finance y CoinGecko.',
        tip: 'El P&L se calcula con el precio actual vs tu costo promedio de adquisición.',
    },
    {
        step: '07',
        icon: PiggyBank,
        color: '#f472b6',
        grad: 'linear-gradient(135deg, rgba(244,114,182,0.2) 0%, rgba(219,39,119,0.08) 100%)',
        title: 'Presupuestos',
        body: 'Crea límites de gasto por categoría. NVA te avisa cuando te acercas al límite y muestra tu progreso en tiempo real.',
        tip: 'Configura presupuestos mensuales para categorías como Restaurantes, Transporte o Suscripciones.',
    },
    {
        step: '08',
        icon: Shield,
        color: '#818cf8',
        grad: 'linear-gradient(135deg, rgba(129,140,248,0.2) 0%, rgba(79,70,229,0.08) 100%)',
        title: 'Tu cuenta y seguridad',
        body: 'Activa autenticación en dos pasos (MFA), configura PIN o biometría y exporta todos tus datos en PDF desde Perfil.',
        tip: 'Tus datos nunca se venden. El PDF original de tu banco jamás se almacena en nuestros servidores.',
    },
];

export function openTutorial() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('fnce:open-tutorial'));
    }
}

export default function AppTutorial() {
    const [isOpen, setIsOpen]   = useState(false);
    const [slide, setSlide]     = useState(0);
    const [visible, setVisible] = useState(false);
    const touchStartX           = useRef(null);

    useEffect(() => {
        const handler = () => { setSlide(0); setIsOpen(true); };
        window.addEventListener('fnce:open-tutorial', handler);
        return () => window.removeEventListener('fnce:open-tutorial', handler);
    }, []);

    useEffect(() => {
        try {
            if (!localStorage.getItem(TUTORIAL_KEY)) {
                const t = setTimeout(() => { setSlide(0); setIsOpen(true); }, 1200);
                return () => clearTimeout(t);
            }
        } catch (_) {}
    }, []);

    useEffect(() => {
        if (!isOpen) { setVisible(false); return; }
        const t = setTimeout(() => setVisible(true), 30);
        return () => clearTimeout(t);
    }, [isOpen]);

    const close = useCallback(() => {
        setVisible(false);
        setTimeout(() => setIsOpen(false), 220);
        try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch (_) {}
    }, []);

    const goTo = useCallback((next) => {
        setVisible(false);
        setTimeout(() => { setSlide(next); setVisible(true); }, 140);
    }, []);

    const handleNext = () => slide === SLIDES.length - 1 ? close() : goTo(slide + 1);
    const handleBack = () => slide > 0 && goTo(slide - 1);

    const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
    const onTouchEnd   = (e) => {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        touchStartX.current = null;
        if (dx < -50) handleNext();
        else if (dx > 50) handleBack();
    };

    if (!isOpen) return null;

    const s = SLIDES[slide];
    const Icon = s.icon;
    const isLast = slide === SLIDES.length - 1;

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(0,0,0,0.88)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '16px',
                opacity: visible ? 1 : 0,
                transition: 'opacity 0.22s ease',
            }}
            onClick={(e) => { if (e.target === e.currentTarget) close(); }}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
        >
            <div style={{
                width: '100%', maxWidth: '400px',
                background: '#0e0e12',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '28px',
                overflow: 'hidden',
                boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
                transform: visible ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
                transition: 'transform 0.28s cubic-bezier(0.34,1.56,0.64,1)',
                userSelect: 'none',
            }}>
                {/* ── Visual area ── */}
                <div style={{
                    height: '180px',
                    background: s.grad,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '28px 28px 20px',
                    position: 'relative',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                }}>
                    {/* Step number */}
                    <span style={{
                        fontSize: '72px', fontWeight: 900, lineHeight: 1,
                        color: s.color, opacity: 0.18,
                        position: 'absolute', right: '24px', bottom: '8px',
                        letterSpacing: '-4px', fontVariantNumeric: 'tabular-nums',
                    }}>{s.step}</span>

                    <div>
                        {/* NVA badge */}
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            background: 'rgba(255,255,255,0.07)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '999px', padding: '3px 10px',
                            marginBottom: '16px',
                        }}>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>
                                NVA · {slide + 1}/{SLIDES.length}
                            </span>
                        </div>

                        {/* Icon */}
                        <div style={{
                            width: '56px', height: '56px', borderRadius: '16px',
                            background: `${s.color}22`,
                            border: `1px solid ${s.color}33`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Icon size={26} color={s.color} strokeWidth={1.7} />
                        </div>
                    </div>

                    {/* Close */}
                    <button
                        onClick={close}
                        style={{
                            position: 'absolute', top: '16px', right: '16px',
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '50%', width: '32px', height: '32px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
                        }}
                    >
                        <X size={14} />
                    </button>
                </div>

                {/* ── Content ── */}
                <div style={{ padding: '24px 28px 20px' }}>
                    <h2 style={{
                        margin: '0 0 10px',
                        fontSize: '22px', fontWeight: 800,
                        color: '#f5f5f7', lineHeight: 1.2,
                        letterSpacing: '-0.4px',
                    }}>
                        {s.title}
                    </h2>
                    <p style={{
                        margin: '0 0 16px',
                        fontSize: '14px', color: 'rgba(255,255,255,0.55)',
                        lineHeight: 1.7,
                    }}>
                        {s.body}
                    </p>

                    {s.tip && (
                        <div style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.07)',
                            borderRadius: '12px', padding: '10px 14px',
                            marginBottom: '4px',
                        }}>
                            <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.38)', lineHeight: 1.6 }}>
                                <span style={{ color: s.color, fontWeight: 700 }}>Tip · </span>
                                {s.tip}
                            </p>
                        </div>
                    )}
                </div>

                {/* ── Progress dots ── */}
                <div style={{ display: 'flex', gap: '4px', padding: '0 28px 4px', flexWrap: 'wrap' }}>
                    {SLIDES.map((_, i) => (
                        <div
                            key={i}
                            onClick={() => goTo(i)}
                            style={{
                                height: '4px', borderRadius: '2px', cursor: 'pointer',
                                width: i === slide ? '20px' : '4px',
                                background: i === slide ? s.color : 'rgba(255,255,255,0.12)',
                                transition: 'all 0.25s ease',
                                flexShrink: 0,
                            }}
                        />
                    ))}
                </div>

                {/* ── Navigation ── */}
                <div style={{ display: 'flex', gap: '8px', padding: '12px 28px 24px' }}>
                    {slide > 0 && (
                        <button
                            onClick={handleBack}
                            style={{
                                width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                        >
                            <ChevronLeft size={18} />
                        </button>
                    )}
                    <button
                        onClick={handleNext}
                        style={{
                            flex: 1, height: '44px', borderRadius: '12px',
                            background: s.color, border: 'none',
                            color: '#000', fontSize: '14px', fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            transition: 'opacity 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                        {isLast ? '¡Listo!' : <>Siguiente <ChevronRight size={16} /></>}
                    </button>
                </div>

                {slide === 0 && (
                    <p style={{
                        margin: '0 0 16px', textAlign: 'center',
                        fontSize: '11px', color: 'rgba(255,255,255,0.18)',
                    }}>
                        Desliza o toca los puntos para navegar
                    </p>
                )}
            </div>
        </div>
    );
}
