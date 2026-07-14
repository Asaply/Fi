'use client';
import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { ChevronRight, Lightbulb } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import Modal from '@/components/Modal';
import { getCategoryIcon } from '@/components/categoryIcons';
import './CategoryChart.css';

const CATEGORY_COLORS = {
    'Nómina': '#22C55E',
    'Freelance': '#10B981',
    'Ventas': '#3B82F6',
    'SPEI recibido': '#6366F1',
    'Intereses': '#F59E0B',
    'Devoluciones': '#EC4899',
    'Inversiones': '#8B5CF6',
    'Transferencias': '#06B6D4',
    'Otros': '#6B7280',
};
const DEFAULT_COLORS = ['#22C55E','#10B981','#3B82F6','#6366F1','#F59E0B','#EC4899','#8B5CF6','#06B6D4','#6B7280'];
function getColor(name, idx) { return CATEGORY_COLORS[name] || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]; }
const formatMXN = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

export default function IngresosPorCategoria({ startDate, endDate, accountType = 'debit', bank }) {
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
                    .in('type', ['Ingreso', 'ingreso'])
                    .gte('date', from)
                    .lte('date', to);
                if (bank && bank !== 'global') query = query.eq('bank', bank);
                const { data: rows } = await query;

                const ingresos = (rows || []).map(t => ({ ...t, categoria: t.categoria || 'Otros' }));

                setAllTransactions(ingresos);
                const totalAmt = ingresos.reduce((s, t) => s + (Number(t.amount) || 0), 0);

                const grouped = ingresos.reduce((acc, t) => {
                    acc[t.categoria] = (acc[t.categoria] || 0) + Math.abs(Number(t.amount) || 0);
                    return acc;
                }, {});

                setData(Object.entries(grouped).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value));
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

    const dominant = data[0];
    const domPct = dominant && total > 0 ? (dominant.value / total) * 100 : 0;
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
                    <h2 className="cat-title">Ingresos por categoría</h2>
                    {total > 0 && <span className="cat-sub" style={{ color: '#22c55e' }}>{formatMXN(total)} en total</span>}
                </div>
                {data.length > 0 && (
                    <button className="cat-ver" onClick={() => setShowBreakdown(v => !v)}>
                        {showBreakdown ? 'Ocultar' : 'Ver detalles'} <ChevronRight size={15} />
                    </button>
                )}
            </div>

            {data.length === 0 ? (
                <p className="cat-empty">Sin ingresos en este período</p>
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
                                    {/* Tooltip pinned to the top (position y:0) so it never overlaps
                                        the center total; x follows the cursor. */}
                                    <Tooltip
                                        position={{ y: 0 }}
                                        allowEscapeViewBox={{ x: false, y: true }}
                                        content={({ active, payload }) => {
                                        if (!active || !payload?.length) return null;
                                        const { name, value } = payload[0].payload;
                                        const p = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                        return (
                                            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '8px 12px', boxShadow: 'var(--shadow-md)' }}>
                                                <p style={{ color: 'var(--text-primary)', margin: 0, fontSize: '12px', fontWeight: 600 }}>{name}</p>
                                                <p style={{ color: 'var(--text-primary)', margin: 0, fontSize: '12px' }}>{formatMXN(value)} · {p}%</p>
                                            </div>
                                        );
                                    }} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="cat-donut-center">
                                <span className="cat-donut-total-label">Total</span>
                                <span className="cat-donut-total" style={{ color: '#22c55e' }}>{formatMXN(total)}</span>
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
                            <span className="cat-insight-icon"><Lightbulb size={16} style={{ color: '#22c55e' }} /></span>
                            <span>
                                <span className="cat-insight-title">Insight</span>
                                <strong>{dominant.name}</strong> es tu mayor fuente de ingresos, con el <strong style={{ color: getColor(dominant.name, 0) }}>{domPct.toFixed(0)}%</strong> del total del período.
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
                    <span style={{ fontSize: '14px', color: '#22c55e', fontWeight: 400, marginTop: '4px' }}>
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
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#22c55e', alignSelf: 'center', flexShrink: 0, marginLeft: '12px' }}>
                                +{formatMXN(t.amount)}
                            </span>
                        </div>
                    ))}
                    {categoryTx.length === 0 && (
                        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '13px' }}>Sin transacciones en esta categoría.</p>
                    )}
                </div>
            </Modal>
        </div>
    );
}
