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

export default function GastosPorCategoria({ startDate, endDate }) {
    const [data, setData] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [activeIndex, setActiveIndex] = useState(null);
    const [allTransactions, setAllTransactions] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);

    const handleCategoryClick = (categoryName) => {
        if (!categoryName) return;
        setSelectedCategory(categoryName);
    };

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
            const { data: { user } } = await supabase.auth.getUser();
            const from = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
            const to = endDate || new Date().toISOString().split('T')[0];

            const { data: rows } = await supabase
                .from('transactions')
                .select('categoria, amount, type, concept, date')
                .eq('user_id', user?.id)
                .in('type', ['Egreso', 'egreso', 'Gasto Personal', 'gasto personal'])
                .gte('date', from)
                .lte('date', to);

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
    }, [startDate, endDate]);

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
                    Gastos por Categoría
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
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                >
                                    {data.map((entry, idx) => (
                                        <Cell
                                            key={entry.name}
                                            fill={getColor(entry.name, idx)}
                                            opacity={activeIndex === null || activeIndex === idx ? 1 : 0.4}
                                            onClick={() => handleCategoryClick(entry.name)}
                                            style={{ cursor: 'pointer' }}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (!active || !payload?.length) return null;
                                        const { name, value } = payload[0].payload;
                                        const pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                        return (
                                            <div style={{ background: 'var(--bg-surface)', border: '1px solid #333', borderRadius: 8, padding: '8px 12px' }}>
                                                <p style={{ color: CATEGORY_COLORS[name] || '#fff', margin: 0, fontSize: '12px', fontWeight: 600 }}>{name}</p>
                                                <p style={{ color: 'var(--text-primary)', margin: 0, fontSize: '12px' }}>{formatMXN(value)}</p>
                                                <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '11px' }}>{pct}%</p>
                                            </div>
                                        );
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Center label — total when idle, hidden when hovering (avoids tooltip overlap) */}
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
                    <div className="donut-legend" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {data.map((entry, idx) => (
                            <div key={entry.name} onClick={() => handleCategoryClick(entry.name)} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '4px', borderRadius: '6px', transition: 'background 0.2s' }} className="legend-item">
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: getColor(entry.name, idx), flexShrink: 0 }} />
                                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {entry.name}
                                </span>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                                    {formatMXN(entry.value)}
                                </span>
                            </div>
                        ))}
                        {/* Total row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderTop: '1px solid var(--bg-border)', paddingTop: '8px', marginTop: '2px' }}>
                            <div style={{ width: '8px', height: '8px', flexShrink: 0 }} />
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1 }}>Total</span>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                                {formatMXN(total)}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', minWidth: '38px', textAlign: 'right' }}>100.0%</span>
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
