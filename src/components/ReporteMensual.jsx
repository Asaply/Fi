'use client';
import { useState, useEffect } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { supabase } from '@/lib/supabaseClient';

const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const formatMXN = (n) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

const formatMXNShort = (n) => {
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
};

export default function ReporteMensual({ startDate, endDate }) {
    const [chartData, setChartData] = useState([]);
    const [totales, setTotales] = useState({ ingresos: 0, egresos: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { setLoading(false); return; }

            const from = startDate || new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1).toISOString().split('T')[0];
            const to = endDate || new Date().toISOString().split('T')[0];

            const [txRes, tradingRes] = await Promise.all([
                supabase
                    .from('transactions')
                    .select('date, amount, type')
                    .eq('user_id', user.id)
                    .in('type', ['Ingreso', 'Egreso', 'ingreso', 'egreso'])
                    .gte('date', from)
                    .lte('date', to),
                supabase
                    .from('trading_operations')
                    .select('date, pnl, status')
                    .eq('user_id', user.id)
                    .eq('status', 'Cerrado')
                    .gte('date', from)
                    .lte('date', to),
            ]);

            const txRows = txRes.data || [];
            const tradingRows = tradingRes.data || [];

            // Build map YYYY-MM → { ingresos, egresos }
            const monthMap = {};
            const ensure = (ym) => {
                if (!monthMap[ym]) monthMap[ym] = { ingresos: 0, egresos: 0 };
                return monthMap[ym];
            };

            for (const t of txRows) {
                const ym = (t.date || '').slice(0, 7);
                if (!ym) continue;
                const m = ensure(ym);
                const tipo = (t.type || '').toLowerCase();
                if (tipo === 'ingreso') m.ingresos += Number(t.amount) || 0;
                if (tipo === 'egreso')  m.egresos  += Number(t.amount) || 0;
            }

            for (const t of tradingRows) {
                const pnl = Number(t.pnl) || 0;
                if (pnl <= 0) continue;
                const ym = (t.date || '').slice(0, 7);
                if (!ym) continue;
                ensure(ym).ingresos += pnl;
            }

            // Generate ordered month list from startDate to endDate
            const result = [];
            const cur = new Date(new Date(from).getFullYear(), new Date(from).getMonth(), 1);
            const endD = new Date(new Date(to).getFullYear(), new Date(to).getMonth(), 1);
            while (cur <= endD) {
                const ym = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
                result.push({
                    mes: MESES_CORTOS[cur.getMonth()],
                    ingresos: monthMap[ym]?.ingresos || 0,
                    egresos: monthMap[ym]?.egresos || 0,
                });
                cur.setMonth(cur.getMonth() + 1);
            }

            const totalIngresos = result.reduce((s, m) => s + m.ingresos, 0);
            const totalEgresos  = result.reduce((s, m) => s + m.egresos, 0);

            setChartData(result);
            setTotales({ ingresos: totalIngresos, egresos: totalEgresos });
            } catch (_) {}
            setLoading(false);
        };
        load();
    }, [startDate, endDate]);

    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 }}>
                    Reporte Mensual
                </h2>
            </div>

            {loading ? (
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Cargando...</p>
            ) : chartData.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', padding: '24px 0' }}>
                    Sin datos en este período
                </p>
            ) : (
                <>
                    {/* Bar chart */}
                    <div style={{ height: '220px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} barCategoryGap="30%" barGap={3}>
                                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis
                                    dataKey="mes"
                                    tick={{ fill: '#71717a', fontSize: 12 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    tickFormatter={formatMXNShort}
                                    tick={{ fill: '#71717a', fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={52}
                                />
                                <Tooltip
                                    content={({ active, payload, label }) => {
                                        if (!active || !payload?.length) return null;
                                        const dark = document.documentElement.getAttribute('data-theme') !== 'light';
                                        return (
                                            <div style={{ background: dark ? '#1c1c1e' : '#fff', border: `1px solid ${dark ? '#333' : '#e5e5e5'}`, borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                                                {label && <p style={{ color: dark ? '#999' : '#666', margin: '0 0 4px', fontSize: '11px' }}>{label}</p>}
                                                {payload.map((p, i) => (
                                                    <p key={i} style={{ color: p.color || (dark ? '#fff' : '#111'), margin: 0, fontSize: '12px', fontWeight: 500 }}>
                                                        {p.name === 'ingresos' ? 'Ingresos' : 'Egresos'}: {formatMXN(p.value)}
                                                    </p>
                                                ))}
                                            </div>
                                        );
                                    }}
                                    cursor={{ fill: 'transparent' }}
                                />
                                <Bar dataKey="ingresos" fill="#22C55E" radius={[4, 4, 0, 0]} name="ingresos" />
                                <Bar dataKey="egresos"  fill="#EF4444" radius={[4, 4, 0, 0]} name="egresos" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Totals summary */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--bg-border)', paddingTop: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22C55E', flexShrink: 0 }} />
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1 }}>Ingresos totales</span>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#22C55E', fontVariantNumeric: 'tabular-nums' }}>
                                {formatMXN(totales.ingresos)}
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444', flexShrink: 0 }} />
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1 }}>Egresos totales</span>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#EF4444', fontVariantNumeric: 'tabular-nums' }}>
                                {formatMXN(totales.egresos)}
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '4px', borderTop: '1px solid var(--bg-border-subtle)' }}>
                            <div style={{ width: '8px', height: '8px', flexShrink: 0 }} />
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1 }}>Balance neto</span>
                            <span style={{ fontSize: '14px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: totales.ingresos - totales.egresos >= 0 ? '#22C55E' : '#EF4444' }}>
                                {formatMXN(totales.ingresos - totales.egresos)}
                            </span>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
