'use client';
import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/lib/supabaseClient';
import Modal from '@/components/Modal';

const CATEGORY_COLORS = {
    'Suscripciones': '#EC4899',
    'Comida': '#EAB308',
    'Transporte': '#22C55E',
    'Transferencias': '#A855F7',
    'Restaurantes': '#F97316',
    'Inversiones': '#3B82F6',
    'Otros': '#6B7280',
};

const DEFAULT_COLORS = ['#F97316','#EAB308','#22C55E','#3B82F6','#EC4899','#A855F7','#06B6D4','#10B981','#6B7280'];

function getColor(name, idx) {
    return CATEGORY_COLORS[name] || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
}

const formatMXN = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

function categorizarAutomatico(descripcion = '') {
    const d = descripcion.toLowerCase();
    if (/spotify|netflix|disney|hbo|apple|suscri/i.test(d)) return 'Suscripciones';
    if (/uber eats|rappi|didi food|restaurant|café|cafe|taco|pizza/i.test(d)) return 'Restaurantes';
    if (/uber|didi|cabify|gasolina|gasolinera|oxxo gas|transporte/i.test(d)) return 'Transporte';
    if (/walmart|soriana|chedraui|superama|mercado|tianguis|costco/i.test(d)) return 'Comida';
    if (/spei|transferencia|envio|envío|depósito|deposito/i.test(d)) return 'Transferencias';
    if (/inversion|inversión|bursanet|gbm|cetes|fondos/i.test(d)) return 'Inversiones';
    return 'Otros';
}

export default function GastosPorCategoria({ startDate, endDate, mode = 'debit', accountType = 'debit', bank = 'global' }) {
    const [data, setData] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [activeIndex, setActiveIndex] = useState(null);
    const [allTransactions, setAllTransactions] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [showAll, setShowAll] = useState(false);

    const VISIBLE = 3;

    const handleCategoryClick = (categoryName) => {
        if (!categoryName) return;
        setSelectedCategory(categoryName);
    };

    const handlePieClick = (categoryName) => {
        setShowAll(true); // expand legend
        handleCategoryClick(categoryName);
    };

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
            const { data: { user } } = await supabase.auth.getUser();
            const from = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
            const to = endDate || new Date().toISOString().split('T')[0];

            const dbAccountType = accountType === 'credit' ? 'credito' : 'debito';
            let query = supabase
                .from('transactions')
                .select('categoria, amount, type, concept, date, account_type, bank')
                .eq('user_id', user?.id)
                .eq('account_type', dbAccountType)
                .in('type', ['Egreso', 'egreso', 'Gasto Personal', 'gasto personal'])
                .gte('date', from)
                .lte('date', to);
            if (bank && bank !== 'global') query = query.eq('bank', bank);
            const { data: rows } = await query;

            const egresos = (rows || []).filter(t =>
                ['egreso', 'gasto personal'].includes(t.type?.toLowerCase().trim() ?? '')
            ).map(t => ({ ...t, categoria: t.categoria || categorizarAutomatico(t.concept || '') }));

            setAllTransactions(egresos);

            const totalAmt = egresos.reduce((s, t) => s + (Number(t.amount) || 0), 0);

            const grouped = egresos.reduce((acc, t) => {
                const cat = t.categoria;
                acc[cat] = (acc[cat] || 0) + Math.abs(Number(t.amount) || 0);
                return acc;
            }, {});

            const chartData = Object.entries(grouped)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value);

            setData(chartData);
            setTotal(totalAmt);
            } catch (_) {}
            setLoading(false);
        };
        load();
    }, [startDate, endDate, accountType, bank]);

    if (loading) {
        return (
            <div className="card fnce-dynamic-panel" style={{ padding: '20px' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Cargando...</p>
            </div>
        );
    }

    return (
        <div className="card fnce-dynamic-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 }}>
                    {mode === 'credit' ? 'CARGOS POR CATEGORÍA (CICLO ACTUAL)' : 'Gastos por Categoría'}
                </h2>
                {total > 0 && (
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                        {formatMXN(total)}
                    </span>
                )}
            </div>

            {data.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>
                    Sin egresos en este período
                </p>
            ) : (
                <div className="donut-layout" style={{ display: 'grid', gridTemplateColumns: '40% 1fr', gap: '24px', alignItems: 'center' }}>
                    {/* Donut chart */}
                    <div className="donut-chart-wrapper" style={{ height: '200px', position: 'relative' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={56}
                                    outerRadius={86}
                                    paddingAngle={2}
                                    dataKey="value"
                                    strokeWidth={0}
                                    onMouseEnter={(_, idx) => setActiveIndex(idx)}
                                    onMouseLeave={() => setActiveIndex(null)}
                                    cursor={{ fill: 'transparent' }}
                                >
                                    {data.map((entry, idx) => (
                                        <Cell
                                            key={entry.name}
                                            fill={getColor(entry.name, idx)}
                                            opacity={activeIndex === null || activeIndex === idx ? 1 : 0.4}
                                            onClick={() => { setActiveIndex(idx); handlePieClick(entry.name); }}
                                            style={{ cursor: 'pointer' }}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (!active || !payload?.length) return null;
                                        const { name, value } = payload[0].payload;
                                        const pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                        const dark = document.documentElement.getAttribute('data-theme') !== 'light';
                                        const bg = dark ? '#1c1c1e' : '#ffffff';
                                        const border = dark ? '#333' : '#e5e5e5';
                                        const text = dark ? '#ffffff' : '#111111';
                                        const muted = dark ? '#999999' : '#888888';
                                        return (
                                            <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                                                <p style={{ color: text, margin: 0, fontSize: '12px', fontWeight: 600 }}>{name}</p>
                                                <p style={{ color: text, margin: 0, fontSize: '12px' }}>{formatMXN(value)}</p>
                                                <p style={{ color: muted, margin: 0, fontSize: '11px' }}>{pct}%</p>
                                            </div>
                                        );
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        {activeIndex === null && total > 0 && (
                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                                <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                    {formatMXN(total)}
                                </p>
                                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)' }}>
                                    100%
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Legend */}
                    <div className="donut-legend" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {(showAll ? data : data.slice(0, VISIBLE)).map((entry, idx) => {
                            const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : 0;
                            return (
                                <div key={entry.name} onClick={() => handleCategoryClick(entry.name)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '6px 8px', borderRadius: '8px', transition: 'background 0.15s' }}
                                    className="legend-item">
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: getColor(entry.name, idx), flexShrink: 0 }} />
                                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {entry.name}
                                    </span>
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', minWidth: '34px', textAlign: 'right' }}>{pct}%</span>
                                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', minWidth: '72px', textAlign: 'right' }}>
                                        {formatMXN(entry.value)}
                                    </span>
                                </div>
                            );
                        })}

                        {/* Ver más / Ver menos */}
                        {data.length > VISIBLE && (
                            <button onClick={() => setShowAll(v => !v)}
                                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 500, padding: '7px 12px', touchAction: 'manipulation', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', marginTop: '2px' }}>
                                {showAll ? '↑ Ver menos' : `↓ Ver ${data.length - VISIBLE} categorías más`}
                            </button>
                        )}

                        {/* Total row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderTop: '1px solid var(--bg-border)', paddingTop: '8px', marginTop: '2px' }}>
                            <div style={{ width: '8px', height: '8px', flexShrink: 0 }} />
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1 }}>Total</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', minWidth: '34px', textAlign: 'right' }}>100%</span>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', minWidth: '72px', textAlign: 'right' }}>
                                {formatMXN(total)}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {(() => {
                const categoryTx = allTransactions.filter(t => t.categoria === selectedCategory);
                const categoryTotal = categoryTx.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
                const pct = total > 0 ? ((categoryTotal / total) * 100).toFixed(1) : 0;
                
                return (
                    <Modal isOpen={!!selectedCategory} onClose={() => setSelectedCategory(null)} title={
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span>{selectedCategory}</span>
                            <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 400, marginTop: '4px' }}>
                                {formatMXN(categoryTotal)} ({pct}% del total)
                            </span>
                        </div>
                    }>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto' }}>
                    {allTransactions.filter(t => t.categoria === selectedCategory).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).map((t, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
                                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.concept || 'Sin descripción'}</span>
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t.date ? new Date(t.date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}</span>
                            </div>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', alignSelf: 'center', flexShrink: 0, marginLeft: '12px' }}>
                                {formatMXN(t.amount)}
                            </span>
                        </div>
                    ))}
                    {categoryTx.length === 0 && (
                        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '13px' }}>No se encontraron transacciones detalladas.</p>
                    )}
                </div>
            </Modal>
                );
            })()}
        </div>
    );
}
