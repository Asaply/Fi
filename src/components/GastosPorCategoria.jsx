'use client';
import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { ChevronRight, Lightbulb } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import Modal from '@/components/Modal';
import { getCategoryIcon } from '@/components/categoryIcons';
import './CategoryChart.css';

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
    const [showBreakdown, setShowBreakdown] = useState(false);

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

    const title = mode === 'credit' ? 'Cargos por categoría' : 'Gastos por categoría';
    const dominant = data[0];
    const domPct = dominant && total > 0 ? (dominant.value / total) * 100 : 0;

    // Legend: top 5 named + an aggregate "Más categorías" if there are more.
    const LEG = 5;
    const legend = data.slice(0, LEG);
    const restVal = data.slice(LEG).reduce((s, d) => s + d.value, 0);

    const categoryTx = allTransactions.filter(t => t.categoria === selectedCategory);
    const categoryTotal = categoryTx.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    const catPct = total > 0 ? ((categoryTotal / total) * 100).toFixed(1) : 0;

    return (
        <div className="card fnce-dynamic-panel cat-card">
            <div className="cat-head">
                <div className="cat-head-titles">
                    <h2 className="cat-title">{title}</h2>
                    {total > 0 && <span className="cat-sub">{formatMXN(total)} en total</span>}
                </div>
                {data.length > 0 && (
                    <button className="cat-ver" onClick={() => setShowBreakdown(v => !v)}>
                        {showBreakdown ? 'Ocultar' : 'Ver detalles'} <ChevronRight size={15} />
                    </button>
                )}
            </div>

            {data.length === 0 ? (
                <p className="cat-empty">Sin egresos en este período</p>
            ) : (
                <>
                    <div className="cat-donut-row">
                        <div className="cat-donut">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={data} cx="50%" cy="50%" innerRadius={52} outerRadius={72} paddingAngle={2} dataKey="value" strokeWidth={0}
                                        onMouseEnter={(_, idx) => setActiveIndex(idx)} onMouseLeave={() => setActiveIndex(null)}>
                                        {data.map((entry, idx) => (
                                            <Cell key={entry.name} fill={getColor(entry.name, idx)}
                                                opacity={activeIndex === null || activeIndex === idx ? 1 : 0.4}
                                                onClick={() => setSelectedCategory(entry.name)} style={{ cursor: 'pointer' }} />
                                        ))}
                                    </Pie>
                                    {/* No hover tooltip: it overlapped the center total. The legend
                                        below already shows name/amount/%, and tapping a slice opens
                                        the category detail. */}
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="cat-donut-center">
                                <span className="cat-donut-total-label">Total</span>
                                <span className="cat-donut-total">{formatMXN(total)}</span>
                                <span className="cat-donut-pct">100%</span>
                            </div>
                        </div>

                        <div className="cat-legend">
                            {legend.map((entry, idx) => {
                                const p = total > 0 ? ((entry.value / total) * 100).toFixed(1) : 0;
                                const color = getColor(entry.name, idx);
                                return (
                                    <button key={entry.name} className="cat-legend-row" onClick={() => setSelectedCategory(entry.name)}>
                                        <span className="cat-legend-dot" style={{ background: color }} />
                                        <span className="cat-legend-info">
                                            <span className="cat-legend-name">{entry.name}</span>
                                            <span className="cat-legend-amt">{formatMXN(entry.value)}</span>
                                        </span>
                                        <span className="cat-legend-pct" style={{ color }}>{p}%</span>
                                    </button>
                                );
                            })}
                            {restVal > 0 && (
                                <button className="cat-legend-row" onClick={() => setShowBreakdown(true)}>
                                    <span className="cat-legend-dot" style={{ background: 'var(--text-secondary)' }} />
                                    <span className="cat-legend-info">
                                        <span className="cat-legend-name">Más categorías</span>
                                        <span className="cat-legend-amt">{formatMXN(restVal)}</span>
                                    </span>
                                    <span className="cat-legend-pct" style={{ color: 'var(--text-secondary)' }}>{((restVal / total) * 100).toFixed(1)}%</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {dominant && (
                        <div className="cat-insight">
                            <span className="cat-insight-icon"><Lightbulb size={16} style={{ color: 'var(--accent-color, #FF8700)' }} /></span>
                            <span>
                                <span className="cat-insight-title">Insight</span>
                                La categoría <strong>{dominant.name}</strong> representa el <strong style={{ color: getColor(dominant.name, 0) }}>{domPct.toFixed(0)}%</strong> de tus gastos. Revisa tus movimientos para encontrar oportunidades de ahorro.
                            </span>
                        </div>
                    )}

                    {showBreakdown && (
                        <div className="cat-breakdown">
                            <div className="cat-breakdown-head">
                                <h3>Desglose por categoría</h3>
                                <span>% del total</span>
                            </div>
                            {data.map((entry, idx) => {
                                const p = total > 0 ? (entry.value / total) * 100 : 0;
                                const color = getColor(entry.name, idx);
                                const Icon = getCategoryIcon(entry.name);
                                return (
                                    <button key={entry.name} className="cat-row" onClick={() => setSelectedCategory(entry.name)}>
                                        <span className="cat-row-icon" style={{ background: `${color}22`, color }}><Icon size={18} /></span>
                                        <span className="cat-row-mid">
                                            <span className="cat-row-toprow">
                                                <span className="cat-row-name">{entry.name}</span>
                                                <span className="cat-row-pct" style={{ color }}>{p.toFixed(1)}%</span>
                                            </span>
                                            <span className="cat-bar"><span className="cat-bar-fill" style={{ width: `${p}%`, background: color }} /></span>
                                        </span>
                                        <span className="cat-row-amt">{formatMXN(entry.value)}</span>
                                        <ChevronRight className="cat-row-chev" size={16} />
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            <Modal isOpen={!!selectedCategory} onClose={() => setSelectedCategory(null)} title={
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span>{selectedCategory}</span>
                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 400, marginTop: '4px' }}>
                        {formatMXN(categoryTotal)} ({catPct}% del total)
                    </span>
                </div>
            }>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto' }}>
                    {categoryTx.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).map((t, i) => (
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
        </div>
    );
}
