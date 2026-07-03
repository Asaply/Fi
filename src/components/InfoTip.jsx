'use client';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

/**
 * Small "?" info tooltip. Anchors to the icon, clamps inside the viewport, and
 * renders via portal so it never gets clipped by a card. Tap-toggle on touch,
 * hover on desktop. Usage: <InfoTip text="…" /> or <InfoTip title="…" text="…" />.
 */
export default function InfoTip({ text, title, size = 14, color = 'var(--text-tertiary)' }) {
    const [show, setShow] = useState(false);
    const [pos, setPos] = useState(null);
    const ref = useRef(null);

    const open = () => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const width = Math.min(260, window.innerWidth - 24);
        let left = r.left + r.width / 2 - width / 2;
        left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
        setPos({ left, top: r.top - 6, width });
        setShow(true);
    };

    useEffect(() => {
        if (!show) return;
        const close = () => setShow(false);
        window.addEventListener('scroll', close, true);
        return () => window.removeEventListener('scroll', close, true);
    }, [show]);

    return (
        <span ref={ref} style={{ display: 'inline-flex', verticalAlign: 'middle', marginLeft: 4 }}
            onPointerEnter={(e) => { if (e.pointerType === 'mouse') open(); }}
            onPointerLeave={(e) => { if (e.pointerType === 'mouse') setShow(false); }}
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); show ? setShow(false) : open(); }}>
            <Info size={size} style={{ color, cursor: 'help' }} />
            {show && pos && createPortal(
                <span style={{
                    position: 'fixed', left: pos.left, top: pos.top, transform: 'translateY(-100%)',
                    width: pos.width, background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                    borderRadius: 10, padding: '10px 12px', zIndex: 2000, lineHeight: 1.5,
                    boxShadow: 'var(--shadow-md)', pointerEvents: 'none',
                }}>
                    {title && <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>{title}</span>}
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{text}</span>
                </span>, document.body
            )}
        </span>
    );
}
