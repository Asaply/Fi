'use client';
import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/lib/supabaseClient';
import { formatMXN } from '@/lib/formatCurrency';

export default function CardFinanzas({ fechaInicio }) {
    const [loading, setLoading] = useState(true);
    const [chartData, setChartData] = useState([]);
    const [totals, setTotals] = useState({ ingresos: 0, egresos: 0 });

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
            const from = fechaInicio || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

            const { data } = await supabase
                .from('transactions')
                .select('date, type, amount')
                .gte('date', from);

            const rows = data || [];

            // Build monthly buckets between fechaInicio and now
            const start = new Date(from);
            const now = new Date();
            const buckets = {};

            let d = new Date(start.getFullYear(), start.getMonth(), 1);
            while (d <= now) {
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                const label = d.toLocaleString('es-MX', { month: 'short' });
                buckets[key] = { label, ingresos: 0, egresos: 0 };
                d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
            }

            rows.forEach(t => {
                const key = t.date?.slice(0, 7);
                if (!buckets[key]) return;
                const type = t.type?.toLowerCase().trim();
                const amount = Number(t.amount) || 0;
                if (type === 'ingreso') buckets[key].ingresos += amount;
                if (['egreso', 'gasto personal'].includes(type)) buckets[key].egresos += amount;
            });

            const chartArr = Object.values(buckets);
            setChartData(chartArr);

            const totalIngresos = rows
                .filter(t => t.type?.toLowerCase().trim() === 'ingreso')
                .reduce((s, t) => s + (Number(t.amount) || 0), 0);
            const totalEgresos = rows
                .filter(t => ['egreso', 'gasto personal'].includes(t.type?.toLowerCase().trim()))
                .reduce((s, t) => s + (Number(t.amount) || 0), 0);

            setTotals({ ingresos: totalIngresos, egresos: totalEgresos });
            } catch (_) {}
            setLoading(false);
        };
        load();
    }, [fechaInicio]);

    const neta = totals.ingresos - totals.egresos;

    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2 style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 }}>
                Resumen Finanzas
            </h2>

            {loading ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Cargando...</p>
            ) : (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                        <div>
                            <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>Ingresos</p>
                            <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--success)', margin: 0, fontFamily: 'var(--font-mono)' }}>{formatMXN(totals.ingresos)}</p>
                        </div>
                        <div>
                            <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>Egresos</p>
                            <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--danger)', margin: 0, fontFamily: 'var(--font-mono)' }}>{formatMXN(totals.egresos)}</p>
                        </div>
                        <div>
                            <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>Neto</p>
                            <p style={{ fontSize: '18px', fontWeight: 700, color: neta >= 0 ? 'var(--success)' : 'var(--danger)', margin: 0, fontFamily: 'var(--font-mono)' }}>
                                {neta >= 0 ? '+' : ''}{formatMXN(neta)}
                            </p>
                        </div>
                    </div>

                    {chartData.length > 1 && (
                        <div>
                            <ResponsiveContainer width="100%" height={100}>
                                <BarChart data={chartData} barSize={10} barGap={2}>
                                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                                    <YAxis hide />
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
                                    <Bar dataKey="ingresos" fill="var(--success)" radius={[3, 3, 0, 0]} opacity={0.85} />
                                    <Bar dataKey="egresos" fill="var(--danger)" radius={[3, 3, 0, 0]} opacity={0.85} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
