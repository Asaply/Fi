'use client';
import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import Modal from '@/components/Modal';

const formatMXN = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

// Noise words to strip before grouping
const NOISE = /\b(pago|cargo|compra|en|de|el|la|los|las|por|con|del|al|un|una|a|y|o|s\.a|sapi|sa de|cv|sab|cxxx|spei|ref|no\.|num|via|card|mxn|mex)\b/gi;
const NUMS  = /\b\d[\d\-\*]+\b/g;
const PUNCT = /[*_\-,./#@!|]/g;

function normalizeMerchant(concept) {
    return (concept || '')
        .toLowerCase()
        .replace(PUNCT, ' ')
        .replace(NUMS, '')
        .replace(NOISE, '')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .slice(0, 3)
        .join(' ')
        .trim();
}

/**
 * Detects recurring expenses and returns top leaks sorted by total amount.
 * @param {Array} transactions — filtered egreso transactions
 * @param {number} minOccurrences — default 2
 * @param {number} topN — max leaks to surface
 */
function detectLeaks(transactions, minOccurrences = 2, topN = 5) {
    const groups = {};

    for (const t of transactions) {
        const key = normalizeMerchant(t.concept || t.concepto || '');
        if (!key || key.length < 3) continue;
        if (!groups[key]) groups[key] = { key, transactions: [], total: 0, label: '' };
        groups[key].transactions.push(t);
        groups[key].total += Math.abs(Number(t.amount || t.monto) || 0);
    }

    // Pick the most descriptive label (longest original concept in group)
    for (const g of Object.values(groups)) {
        g.label = g.transactions
            .map(t => (t.concept || t.concepto || '').trim())
            .sort((a, b) => b.length - a.length)[0] || g.key;
    }

    return Object.values(groups)
        .filter(g => g.transactions.length >= minOccurrences && g.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, topN);
}

export default function MicroFugas({ transactions = [] }) {
    const [expanded, setExpanded] = useState(false);
    const [selected, setSelected] = useState(null);

    const egresos = useMemo(() =>
        transactions.filter(t => {
            const type = (t.type || t.tipo || '').toLowerCase().trim();
            return type === 'egreso' || type === 'gasto personal';
        }),
        [transactions]
    );

    const leaks = useMemo(() => detectLeaks(egresos), [egresos]);

    if (leaks.length === 0) return null;

    const visible = expanded ? leaks : leaks.slice(0, 3);
    const selectedLeak = leaks.find(l => l.key === selected);

    return (
        <div className="card fnce-dynamic-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={14} style={{ color: '#F59E0B', flexShrink: 0 }} />
                    <h2 style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 }}>
                        Micro-fugas detectadas
                    </h2>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{leaks.length} recurrentes</span>
            </div>

            {/* Leak rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {visible.map((leak) => {
                    const freq = leak.transactions.length;
                    const avg = leak.total / freq;
                    return (
                        <div
                            key={leak.key}
                            onClick={() => setSelected(leak.key)}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '10px 12px',
                                background: 'rgba(245,158,11,0.06)',
                                border: '1px solid rgba(245,158,11,0.18)',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                gap: '12px',
                            }}
                        >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden', flex: 1 }}>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {leak.label}
                                </span>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                    {freq}x · ~{formatMXN(avg)} c/u
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', flexShrink: 0 }}>
                                <span style={{ fontSize: '13px', fontWeight: 700, color: '#F59E0B', fontVariantNumeric: 'tabular-nums' }}>
                                    {formatMXN(leak.total)}
                                </span>
                                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>total período</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Show more/less */}
            {leaks.length > 3 && (
                <button
                    onClick={() => setExpanded(e => !e)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', padding: '0', alignSelf: 'center', touchAction: 'manipulation' }}
                >
                    {expanded ? <><ChevronUp size={14} /> Ver menos</> : <><ChevronDown size={14} /> Ver {leaks.length - 3} más</>}
                </button>
            )}

            {/* Drill-down modal */}
            {selectedLeak && (
                <Modal
                    isOpen={!!selected}
                    onClose={() => setSelected(null)}
                    title={
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span>{selectedLeak.label}</span>
                            <span style={{ fontSize: '13px', color: '#F59E0B', fontWeight: 400, marginTop: '4px' }}>
                                {selectedLeak.transactions.length} cargos · {formatMXN(selectedLeak.total)} total
                            </span>
                        </div>
                    }
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto' }}>
                        <div style={{ padding: '10px 12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px', fontSize: '12px', color: '#F59E0B', lineHeight: 1.5 }}>
                            ⚠️ Gasto recurrente detectado. Si redujeras este cargo un 30%, ahorrarías{' '}
                            <strong>{formatMXN(selectedLeak.total * 0.3)}</strong> en este período.
                        </div>
                        {selectedLeak.transactions
                            .sort((a, b) => new Date(b.date || b.fecha || 0) - new Date(a.date || a.fecha || 0))
                            .map((t, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {t.concept || t.concepto || 'Sin descripción'}
                                        </span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                            {(t.date || t.fecha) ? new Date(t.date || t.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                                        </span>
                                    </div>
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', alignSelf: 'center', flexShrink: 0, marginLeft: '12px' }}>
                                        {formatMXN(Math.abs(Number(t.amount || t.monto) || 0))}
                                    </span>
                                </div>
                            ))}
                    </div>
                </Modal>
            )}
        </div>
    );
}
