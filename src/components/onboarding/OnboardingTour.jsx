'use client';
import { useState, useEffect, useCallback } from 'react';

const TOOLTIP_W = 300;
const MOBILE_BREAKPOINT = 768;
// Bottom nav height on mobile — tooltip must not be covered by it
const BOTTOM_NAV_H = 72;

export default function OnboardingTour({ steps, isActive, onComplete, onSkip }) {
    const [current, setCurrent] = useState(0);
    const [tooltipStyle, setTooltipStyle] = useState({});
    const [highlightStyle, setHighlightStyle] = useState({});
    const [visible, setVisible] = useState(false);

    const isMobile = () => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT;

    const positionTooltip = useCallback((index) => {
        const step = steps[index];
        if (!step) return;

        const mobile = isMobile();

        // Always show centered modal on mobile
        if (mobile) {
            setHighlightStyle({});
            const availableH = window.innerHeight - BOTTOM_NAV_H;
            setTooltipStyle({
                position: 'fixed',
                top: Math.floor(availableH * 0.35),
                left: '50%',
                transform: 'translateX(-50%)',
                width: `min(${TOOLTIP_W}px, calc(100vw - 32px))`,
                zIndex: 9999,
            });
            return;
        }

        // Desktop: try to find and spotlight the target element
        const el = document.querySelector(step.target);
        if (!el) {
            // Fallback to centered modal if element not found
            setHighlightStyle({});
            setTooltipStyle({
                position: 'fixed',
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: TOOLTIP_W,
                zIndex: 9999,
            });
            return;
        }

        // Scroll element into view so getBoundingClientRect is accurate
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        // Short wait for scroll to settle, then recalculate
        setTimeout(() => {
            const rect = el.getBoundingClientRect();
            const pos = step.position || 'bottom';
            const gap = 14;

            setHighlightStyle({
                position: 'fixed',
                top: rect.top - 6,
                left: rect.left - 6,
                width: rect.width + 12,
                height: rect.height + 12,
                borderRadius: 8,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.78)',
                zIndex: 9998,
                pointerEvents: 'none',
                transition: 'all 0.25s ease',
            });

            let top = 0, left = 0;
            if (pos === 'bottom') { top = rect.bottom + gap; left = rect.left + rect.width / 2 - TOOLTIP_W / 2; }
            if (pos === 'top')    { top = rect.top - gap - 180; left = rect.left + rect.width / 2 - TOOLTIP_W / 2; }
            if (pos === 'right')  { top = rect.top + rect.height / 2 - 90; left = rect.right + gap; }
            if (pos === 'left')   { top = rect.top + rect.height / 2 - 90; left = rect.left - TOOLTIP_W - gap; }

            // Clamp to viewport
            left = Math.max(12, Math.min(left, window.innerWidth - TOOLTIP_W - 12));
            top  = Math.max(12, Math.min(top, window.innerHeight - 220));

            setTooltipStyle({ position: 'fixed', top, left, width: TOOLTIP_W, zIndex: 9999 });
        }, 250);
    }, [steps]);

    useEffect(() => {
        if (!isActive) { setCurrent(0); setVisible(false); return; }
        setVisible(false);
        // Longer delay so page fully renders and data loads before positioning
        const t = setTimeout(() => {
            positionTooltip(current);
            setTimeout(() => setVisible(true), 150);
        }, 800);
        return () => clearTimeout(t);
    }, [isActive, current, positionTooltip]);

    // Reposition on window resize
    useEffect(() => {
        if (!isActive) return;
        const onResize = () => positionTooltip(current);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [isActive, current, positionTooltip]);

    if (!isActive || steps.length === 0) return null;

    const step = steps[current];
    if (!step) return null;
    const isLast = current === steps.length - 1;
    const mobile = isMobile();

    function handleNext() {
        setVisible(false);
        setTimeout(() => {
            if (isLast) { onComplete(); } else { setCurrent(c => c + 1); }
        }, 150);
    }

    return (
        <>
            {/* Backdrop — on mobile does NOT close on tap to avoid accidents */}
            <div
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 9997 }}
                onClick={mobile ? undefined : undefined}
            />

            {/* Desktop spotlight */}
            {!mobile && Object.keys(highlightStyle).length > 0 && (
                <div style={highlightStyle} />
            )}

            {/* Tooltip / modal */}
            <div style={{
                ...tooltipStyle,
                background: '#18181c',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 14,
                padding: '20px',
                boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
                opacity: visible ? 1 : 0,
                transform: tooltipStyle.transform
                    ? (visible ? tooltipStyle.transform : tooltipStyle.transform + ' translateY(-4px)')
                    : (visible ? 'none' : 'translateY(-4px)'),
                transition: 'opacity 0.22s ease, transform 0.22s ease',
            }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '11px', color: '#FF7A1A', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        {current + 1} / {steps.length}
                    </span>
                    <button
                        onClick={onSkip}
                        style={{ fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer', background: 'none', border: 'none', padding: '8px', borderRadius: 4, lineHeight: 1, touchAction: 'manipulation' }}
                    >
                        Saltar
                    </button>
                </div>

                {/* Content */}
                <p style={{ fontWeight: 700, color: '#f0f0f2', margin: '0 0 8px 0', fontSize: '15px', lineHeight: 1.3 }}>
                    {step.title}
                </p>
                <p style={{ fontSize: '13px', color: '#8a8a9a', lineHeight: 1.6, margin: '0 0 16px 0' }}>
                    {step.description}
                </p>

                {/* Progress dots */}
                <div style={{ display: 'flex', gap: 4, marginBottom: '16px' }}>
                    {steps.map((_, i) => (
                        <div key={i} style={{
                            width: i === current ? 18 : 6,
                            height: 6,
                            borderRadius: 3,
                            background: i === current ? '#FF7A1A' : '#2a2a2e',
                            transition: 'all 0.2s',
                        }} />
                    ))}
                </div>

                {/* CTA */}
                <button
                    onClick={handleNext}
                    style={{
                        width: '100%',
                        padding: '12px',
                        background: '#FF7A1A',
                        color: 'white',
                        borderRadius: 9,
                        fontWeight: 600,
                        fontSize: '15px',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'opacity 0.15s',
                        touchAction: 'manipulation',
                        WebkitTapHighlightColor: 'transparent',
                    }}
                    onMouseEnter={e => e.target.style.opacity = '0.88'}
                    onMouseLeave={e => e.target.style.opacity = '1'}
                >
                    {isLast ? '¡Entendido!' : 'Siguiente →'}
                </button>
            </div>
        </>
    );
}
