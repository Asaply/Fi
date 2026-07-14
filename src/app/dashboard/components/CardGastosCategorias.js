'use client';
import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/lib/supabaseClient';
import { formatMXN } from '@/lib/formatCurrency';

const CAT_COLORS = {
    'Restaurantes':                    '#f97316',
    'Comida y Abarrotes':              '#eab308',
    'Transporte':                      '#3b82f6',
    'Suscripciones':                   '#a855f7',
    'Transferencias':                  '#6b7280',
    'Salud':                           '#ef4444',
    'Entretenimiento':                 '#ec4899',
    'Ropa y Accesorios':               '#14b8a6',
    'Servicios (luz, agua, internet)': '#06b6d4',
    'Educación':                       '#22c55e',
    'Inversiones':                     '#3b82f6',
    'Otros':                           '#4b5563',
};

const DEFAULT_COLORS = ['#f97316','#3b82f6','#a855f7','#22c55e','#eab308','#ec4899','#06b6d4','#ef4444','#14b8a6','#6b7280'];

export default function CardGastosCategorias({ fechaInicio }) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState([]);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const from = fechaInicio || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

            const { data: rows } = await supabase
                .from('transactions')
                .select('type, amount, categoria')
                .gte('date', from);

            const egresos = (rows || []).filter(t =>
                ['egreso', 'gasto personal'].includes(t.type?.toLowerCase().trim())
            );

            const totalEgresos = egresos.reduce((s, t) => s + (Number(t.amount) || 0), 0);

            const porCat = egresos.reduce((acc, t) => {
                const cat = t.categoria || 'Otros';
                acc[cat] = (acc[cat] || 0) + (Number(t.amount) || 0);
                return acc;
            }, {});

            const sorted = Object.entries(porCat)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([name, value]) => ({ name, value }));

            setData(sorted);
            setTotal(totalEgresos);
            setLoading(false);
        };
        load();
    }, [fechaInicio]);

    const getColor = (name, idx) => CAT_COLORS[name] || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];

    return (
        <div className="card fnce-dynamic-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 }}>
                    Gastos por Categoría
                </h2>
                {total > 0 && (
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {formatMXN(total)}
                    </span>
                )}
            </div>

            {loading ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Cargando...</p>
            ) : data.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>
                    Sin egresos en este período
                </p>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '24px', alignItems: 'center' }}>
                    {/* Donut chart */}
                    <div style={{ height: '200px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={58}
                                    outerRadius={88}
                                    paddingAngle={2}
                                    dataKey="value"
                                    strokeWidth={0}
                                >
                                    {data.map((entry, idx) => (
                                        <Cell key={entry.name} fill={getColor(entry.name, idx)} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    position={{ y: 0 }}
                                    allowEscapeViewBox={{ x: false, y: true }}
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
                                    cursor={{ fill: 'transparent' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Legend */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {data.map((entry, idx) => {
                            const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : 0;
                            const color = getColor(entry.name, idx);
                            return (
                                <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {entry.name}
                                    </span>
                                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                                        {formatMXN(entry.value)}
                                    </span>
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', minWidth: '38px', textAlign: 'right' }}>
                                        {pct}%
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
