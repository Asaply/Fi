'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
    Wallet, Upload, LayoutDashboard, Receipt,
    Zap, Calendar, TrendingUp, Sun, X, ChevronRight,
} from 'lucide-react';

const TUTORIAL_KEY = 'fnce_tutorial_v2';

const SLIDES = [
    {
        icon: Wallet,
        color: '#FF7A1A',
        bg: 'rgba(255,122,26,0.12)',
        title: 'Bienvenido a NVA',
        body: 'Tu centro financiero personal. Conecta tus estados de cuenta, analiza tus gastos y toma control de tu dinero — todo en un lugar.',
    },
    {
        icon: Upload,
        color: '#FF7A1A',
        bg: 'rgba(255,122,26,0.12)',
        title: 'Importa tu banco',
        body: 'Sube el PDF de BBVA, Nu, Santander, Banorte, HSBC o Citibanamex. La IA analiza y categoriza todo automáticamente en segundos.',
        tip: 'Puedes importar múltiples bancos y verlos de forma individual o en vista global.',
    },
    {
        icon: LayoutDashboard,
        color: '#3b82f6',
        bg: 'rgba(59,130,246,0.12)',
        title: 'Resumen general',
        body: 'Ve tu balance total, ingresos vs egresos y el desglose por categoría. Toca "Gastos" o "Ingresos" para cambiar la gráfica.',
        tip: 'Filtra por mes, trimestre o año con las píldoras de período.',
    },
    {
        icon: Receipt,
        color: '#8b5cf6',
        bg: 'rgba(139,92,246,0.12)',
        title: 'Finanzas y movimientos',
        body: 'Explora cada transacción. Filtra por Ingreso, Egreso o Inversión. Toca una categoría en la gráfica para ver el detalle completo.',
        tip: 'Usa "Actividad reciente" para editar o eliminar transacciones individuales.',
    },
    {
        icon: Zap,
        color: '#f59e0b',
        bg: 'rgba(245,158,11,0.12)',
        title: 'Gastos Hormiga',
        body: 'Detecta suscripciones, cafés y otros gastos pequeños recurrentes. NVA los agrupa y proyecta cuánto suman al mes y al año.',
        tip: 'Toca cualquier tarjeta de patrón para ver las transacciones que lo componen.',
    },
    {
        icon: Calendar,
        color: '#22c55e',
        bg: 'rgba(34,197,94,0.12)',
        title: 'Calendario de movimientos',
        body: 'Ve tu balance día a día. Verde = ingresos, rojo = gastos. Toca cualquier día para ver todos los movimientos de esa fecha.',
        tip: 'El calendario salta automáticamente al mes de tu último estado de cuenta.',
    },
    {
        icon: TrendingUp,
        color: '#10b981',
        bg: 'rgba(16,185,129,0.12)',
        title: 'Portfolio de inversiones',
        body: 'Agrega acciones, ETFs y crypto con tu precio de compra. Los precios se actualizan en tiempo real vía Yahoo Finance y CoinGecko.',
        tip: 'El P&L se calcula automáticamente con el precio actual vs tu costo promedio.',
    },
    {
        icon: Sun,
        color: '#6366f1',
        bg: 'rgba(99,102,241,0.12)',
        title: 'Tema y ajustes',
        body: 'Cambia entre modo oscuro y claro con el botón Sol/Luna: en la barra inferior (móvil) o en la esquina superior derecha (escritorio).',
        tip: 'Puedes volver a ver este tutorial desde el botón de info en la sección de Finanzas.',
    },
];

export function openTutorial() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('fnce:open-tutorial'));
    }
}

export default function AppTutorial() {
    const [isOpen, setIsOpen] = useState(false);
    const [slide, setSlide] = useState(0);
    const [visible, setVisible] = useState(false);
    const [dir, setDir] = useState(1); // 1=forward, -1=backward
    const touchStartX = useRef(null);

    // Listen for open event
    useEffect(() => {
        const handler = () => { setSlide(0); setDir(1); setIsOpen(true); };
        window.addEventListener('fnce:open-tutorial', handler);
        return () => window.removeEventListener('fnce:open-tutorial', handler);
    }, []);

    // First-visit auto-show
    useEffect(() => {
        try {
            if (!localStorage.getItem(TUTORIAL_KEY)) {
                const t = setTimeout(() => {
                    setSlide(0);
                    setIsOpen(true);
                }, 1200);
                return () => clearTimeout(t);
            }
        } catch (_) {}
    }, []);

    // Fade-in when opened
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
        setDir(next > slide ? 1 : -1);
        setVisible(false);
        setTimeout(() => { setSlide(next); setVisible(true); }, 160);
    }, [slide]);

    const handleNext = () => {
        if (slide === SLIDES.length - 1) { close(); } else { goTo(slide + 1); }
    };

    const handleBack = () => { if (slide > 0) goTo(slide - 1); };

    // Touch swipe
    const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
    const onTouchEnd = (e) => {
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
                background: 'rgba(0,0,0,0.82)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
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
                width: '100%', maxWidth: '380px',
                background: 'rgba(18,18,22,0.98)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '24px',
                padding: '28px 24px 24px',
                boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
                transform: visible ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.98)',
                transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1), opacity 0.22s ease',
                position: 'relative',
                userSelect: 'none',
            }}>
                {/* Close */}
                <button
                    onClick={close}
                    style={{
                        position: 'absolute', top: '16px', right: '16px',
                        background: 'rgba(255,255,255,0.07)', border: 'none',
                        borderRadius: '50%', width: '30px', height: '30px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
                        touchAction: 'manipulation',
                    }}
                >
                    <X size={15} />
                </button>

                {/* Slide counter */}
                <p style={{ margin: '0 0 20px', fontSize: '11px', fontWeight: 600, color: s.color, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {slide + 1} de {SLIDES.length}
                </p>

                {/* Icon */}
                <div style={{
                    width: '64px', height: '64px', borderRadius: '18px',
                    background: s.bg, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', marginBottom: '20px',
                }}>
                    <Icon size={30} color={s.color} strokeWidth={1.8} />
                </div>

                {/* Content */}
                <h2 style={{ margin: '0 0 10px', fontSize: '20px', fontWeight: 700, color: '#f0f0f5', lineHeight: 1.25, letterSpacing: '-0.3px' }}>
                    {s.title}
                </h2>
                <p style={{ margin: '0 0 14px', fontSize: '14px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.65 }}>
                    {s.body}
                </p>
                {s.tip && (
                    <div style={{
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                        borderRadius: '10px', padding: '10px 12px', marginBottom: '4px',
                    }}>
                        <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.55 }}>
                            <span style={{ color: s.color, fontWeight: 600 }}>Tip · </span>{s.tip}
                        </p>
                    </div>
                )}

                {/* Dots */}
                <div style={{ display: 'flex', gap: '5px', margin: '20px 0 16px' }}>
                    {SLIDES.map((_, i) => (
                        <div
                            key={i}
                            onClick={() => goTo(i)}
                            style={{
                                height: '5px', borderRadius: '3px', cursor: 'pointer',
                                width: i === slide ? '20px' : '5px',
                                background: i === slide ? s.color : 'rgba(255,255,255,0.15)',
                                transition: 'all 0.25s ease',
                            }}
                        />
                    ))}
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: '8px' }}>
                    {slide > 0 && (
                        <button
                            onClick={handleBack}
                            style={{
                                padding: '12px 16px', borderRadius: '12px',
                                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
                                color: 'rgba(255,255,255,0.7)', fontSize: '14px', fontWeight: 500,
                                cursor: 'pointer', touchAction: 'manipulation',
                            }}
                        >
                            ←
                        </button>
                    )}
                    <button
                        onClick={handleNext}
                        style={{
                            flex: 1, padding: '13px', borderRadius: '12px',
                            background: s.color, border: 'none',
                            color: 'white', fontSize: '15px', fontWeight: 600,
                            cursor: 'pointer', touchAction: 'manipulation',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            transition: 'opacity 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                        {isLast ? '¡Entendido!' : <>Siguiente <ChevronRight size={16} /></>}
                    </button>
                </div>

                {/* Swipe hint — mobile only, first slide */}
                {slide === 0 && (
                    <p style={{ margin: '12px 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>
                        Desliza para navegar
                    </p>
                )}
            </div>
        </div>
    );
}
