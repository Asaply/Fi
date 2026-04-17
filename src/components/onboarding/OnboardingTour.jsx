'use client';
import { useState, useEffect } from 'react';

export default function OnboardingTour({ steps, isActive, onComplete, onSkip }) {
    const [current, setCurrent] = useState(0);
    const [tooltipStyle, setTooltipStyle] = useState({});
    const [highlightStyle, setHighlightStyle] = useState({});
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!isActive) { setCurrent(0); setVisible(false); return; }
        positionTooltip(current);
        const t = setTimeout(() => setVisible(true), 80);
        return () => clearTimeout(t);
    }, [isActive, current]);

    function positionTooltip(index) {
        const step = steps[index];
        if (!step) return;
        const el = document.querySelector(step.target);
        if (!el) return;

        const rect = el.getBoundingClientRect();
        const pos = step.position || 'bottom';
        const gap = 12;

        setHighlightStyle({
            position: 'fixed',
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            borderRadius: 8,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.75)',
            zIndex: 9998,
            pointerEvents: 'none',
        });

        const tooltipW = 280;
        let top = 0, left = 0;

        if (pos === 'bottom') { top = rect.bottom + gap; left = rect.left + rect.width / 2 - tooltipW / 2; }
        if (pos === 'top')    { top = rect.top - gap - 160; left = rect.left + rect.width / 2 - tooltipW / 2; }
        if (pos === 'right')  { top = rect.top + rect.height / 2 - 80; left = rect.right + gap; }
        if (pos === 'left')   { top = rect.top + rect.height / 2 - 80; left = rect.left - tooltipW - gap; }

        // Mobile: center as modal
        if (window.innerWidth < 768) {
            setTooltipStyle({
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: visible ? 'translate(-50%,-50%)' : 'translate(-50%,-48%)',
                width: 'min(320px, calc(100vw - 32px))',
                zIndex: 9999,
            });
            return;
        }

        left = Math.max(12, Math.min(left, window.innerWidth - tooltipW - 12));
        top = Math.max(12, Math.min(top, window.innerHeight - 200));

        setTooltipStyle({ position: 'fixed', top, left, width: tooltipW, zIndex: 9999 });
    }

    if (!isActive || steps.length === 0) return null;

    const step = steps[current];
    if (!step) return null;
    const isLast = current === steps.length - 1;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

    return (
        <>
            {/* Overlay for mobile or when target not found */}
            {(isMobile || !document.querySelector(step.target)) && (
                <div
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9997 }}
                    onClick={onSkip}
                />
            )}

            {/* Spotlight highlight */}
            {!isMobile && <div style={highlightStyle} />}

            {/* Tooltip */}
            <div style={{
                ...tooltipStyle,
                background: '#1a1a1e',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12,
                padding: '1.25rem',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                opacity: visible ? 1 : 0,
                transition: 'opacity 0.2s, transform 0.2s',
            }}>
                {/* Header row: step indicator + skip */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.7rem', color: '#6366f1', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        {current + 1} / {steps.length}
                    </span>
                    <button onClick={onSkip} style={{ fontSize: '0.7rem', color: '#4a4a5a', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>
                        Saltar tour
                    </button>
                </div>

                <p style={{ fontWeight: 700, color: '#f0f0f2', marginBottom: '0.4rem', fontSize: '0.95rem', margin: '0 0 6px 0' }}>
                    {step.title}
                </p>
                <p style={{ fontSize: '0.8rem', color: '#8a8a9a', lineHeight: 1.5, margin: '0 0 1rem 0' }}>
                    {step.description}
                </p>

                {/* Progress dots */}
                <div style={{ display: 'flex', gap: 4, marginBottom: '1rem' }}>
                    {steps.map((_, i) => (
                        <div key={i} style={{
                            width: i === current ? 16 : 6,
                            height: 6,
                            borderRadius: 3,
                            background: i === current ? '#6366f1' : '#2a2a2e',
                            transition: 'all 0.2s',
                        }} />
                    ))}
                </div>

                <button
                    onClick={() => {
                        setVisible(false);
                        setTimeout(() => {
                            if (isLast) { onComplete(); } else { setCurrent(c => c + 1); }
                        }, 150);
                    }}
                    style={{
                        width: '100%',
                        padding: '0.6rem',
                        background: '#6366f1',
                        color: 'white',
                        borderRadius: 8,
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        border: 'none',
                        cursor: 'pointer',
                    }}
                >
                    {isLast ? '¡Entendido!' : 'Siguiente →'}
                </button>
            </div>
        </>
    );
}
