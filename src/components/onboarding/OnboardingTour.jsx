'use client';
import { useEffect, useState, useRef } from 'react';

function getTargetRect(selector) {
    try {
        const el = document.querySelector(selector);
        if (!el) return null;
        return el.getBoundingClientRect();
    } catch {
        return null;
    }
}

function isMobile() {
    return typeof window !== 'undefined' && window.innerWidth < 768;
}

function TooltipArrow({ position }) {
    const base = { position: 'absolute', width: 0, height: 0 };
    const styles = {
        bottom: { ...base, top: -12, left: '50%', transform: 'translateX(-50%)', borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderBottom: '12px solid #242428' },
        top:    { ...base, bottom: -12, left: '50%', transform: 'translateX(-50%)', borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '12px solid #242428' },
        left:   { ...base, right: -12, top: '50%', transform: 'translateY(-50%)', borderTop: '8px solid transparent', borderBottom: '8px solid transparent', borderLeft: '12px solid #242428' },
        right:  { ...base, left: -12, top: '50%', transform: 'translateY(-50%)', borderTop: '8px solid transparent', borderBottom: '8px solid transparent', borderRight: '12px solid #242428' },
    };
    return <div style={styles[position] || styles.bottom} />;
}

function positionTooltip(rect, position, tooltipW = 280, tooltipH = 160) {
    const gap = 16;
    if (!rect) return { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' };

    switch (position) {
        case 'bottom':
            return { top: rect.bottom + gap, left: Math.min(Math.max(rect.left + rect.width / 2 - tooltipW / 2, 16), window.innerWidth - tooltipW - 16) };
        case 'top':
            return { top: rect.top - tooltipH - gap, left: Math.min(Math.max(rect.left + rect.width / 2 - tooltipW / 2, 16), window.innerWidth - tooltipW - 16) };
        case 'left':
            return { top: rect.top + rect.height / 2 - tooltipH / 2, left: rect.left - tooltipW - gap };
        case 'right':
            return { top: rect.top + rect.height / 2 - tooltipH / 2, left: rect.right + gap };
        default:
            return { top: rect.bottom + gap, left: rect.left };
    }
}

export default function OnboardingTour({ steps, isActive, currentStep, onNext, onComplete, onSkip }) {
    const [visible, setVisible] = useState(false);
    const [tooltipPos, setTooltipPos] = useState({});
    const [mobile, setMobile] = useState(false);
    const [targetRect, setTargetRect] = useState(null);
    const tooltipRef = useRef(null);

    const step = steps[currentStep];
    const isLast = currentStep === steps.length - 1;

    useEffect(() => {
        if (!isActive) { setVisible(false); return; }
        setMobile(isMobile());

        const update = () => {
            if (!step) return;
            const rect = getTargetRect(step.target);
            setTargetRect(rect);
            if (!isMobile() && rect) {
                const pos = positionTooltip(rect, step.position);
                setTooltipPos(pos);
            }
        };

        update();
        const timer = setTimeout(() => { update(); setVisible(true); }, 120);
        window.addEventListener('resize', update);
        return () => { clearTimeout(timer); window.removeEventListener('resize', update); };
    }, [isActive, currentStep, step]);

    if (!isActive || !step) return null;

    const highlightStyle = targetRect && !mobile ? {
        position: 'fixed',
        top: targetRect.top - 4,
        left: targetRect.left - 4,
        width: targetRect.width + 8,
        height: targetRect.height + 8,
        borderRadius: 8,
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.72)',
        zIndex: 9998,
        pointerEvents: 'none',
    } : null;

    const tooltipStyle = {
        position: 'fixed',
        zIndex: 9999,
        background: 'var(--bg-surface)',
        border: '1px solid var(--bg-border)',
        borderRadius: 12,
        padding: '1.25rem',
        width: 280,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(4px)',
        transition: 'opacity 0.2s, transform 0.2s',
        ...(mobile
            ? { top: '50%', left: '50%', transform: visible ? 'translate(-50%,-50%)' : 'translate(-50%,-48%)', width: 'min(320px, calc(100vw - 32px))' }
            : tooltipPos),
    };

    return (
        <>
            {/* Overlay — only show if no specific target highlight */}
            {(!targetRect || mobile) && (
                <div
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 9997 }}
                    onClick={onSkip}
                />
            )}

            {/* Target highlight cutout */}
            {highlightStyle && <div style={highlightStyle} />}

            {/* Tooltip */}
            <div ref={tooltipRef} style={tooltipStyle}>
                {!mobile && <TooltipArrow position={step.position} />}

                {/* Step counter */}
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
                    {currentStep + 1} / {steps.length}
                </div>

                <p style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                    {step.title}
                </p>
                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {step.description}
                </p>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <button
                        onClick={onSkip}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer', padding: 0 }}
                    >
                        Saltar tour
                    </button>
                    <button
                        onClick={isLast ? onComplete : onNext}
                        style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                    >
                        {isLast ? '¡Entendido!' : 'Siguiente →'}
                    </button>
                </div>
            </div>
        </>
    );
}
