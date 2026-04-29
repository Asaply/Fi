'use client';
import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Trash2, Loader } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

const COLORS = ['#4ade80', '#f87171', '#60a5fa', '#fb923c', '#a78bfa', '#34d399'];

export default function ExpensesWidget({ widgetId, removeWidget }) {
    const [chartData, setChartData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isError, setIsError] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setIsError(false);
            try {
                const now = new Date();
                const fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                const { data } = await supabase
                    .from('transactions')
                    .select('concept, client, amount')
                    .eq('type', 'Egreso')
                    .gte('date', fromDate);

                const grouped = {};
                data?.forEach(tx => {
                    const key = tx.concept || tx.client || 'Otros';
                    grouped[key] = (grouped[key] || 0) + (parseFloat(tx.amount) || 0);
                });
                const sorted = Object.entries(grouped).sort((a, b) => b[1] - a[1]);
                const top = sorted.slice(0, 6);
                const othersVal = sorted.slice(6).reduce((s, [, v]) => s + v, 0);
                const result = top.map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }));
                if (othersVal > 0) result.push({ name: 'Otros', value: parseFloat(othersVal.toFixed(2)) });
                setChartData(result);
            } catch (e) {
                console.error(e);
                setIsError(true);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    return (
        <div className="fnce-widget">
            <div className="fnce-widget-header widget-drag-handle">
                <span className="fnce-widget-title">Distribución de Egresos</span>
                <span className="fnce-live-badge">LIVE</span>
                <button onClick={() => removeWidget(widgetId)} className="fnce-widget-btn" title="Eliminar">
                    <Trash2 size={13} />
                </button>
            </div>

            <div className="fnce-widget-body">
                {isLoading ? (
                    <div className="fnce-loading">
                        <Loader size={16} className="spin-anim" />
                    </div>
                ) : isError ? (
                    <div className="fnce-error">Error al cargar datos. Verifica tu conexión.</div>
                ) : chartData.length === 0 ? (
                    <div className="fnce-empty-state">
                        Sin egresos este mes.<br />
                        Agrega transacciones en Finanzas.
                    </div>
                ) : (
                    <div style={{ height: '180px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={48}
                                    outerRadius={72}
                                    paddingAngle={4}
                                    dataKey="value"
                                >
                                    {chartData.map((_, i) => (
                                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(v) => `$${v.toLocaleString('es-MX')}`}
                                    contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '11px' }}
                                    labelStyle={{ color: 'var(--text-secondary)' }}
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                />
                                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', color: 'var(--text-secondary)' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>
    );
}
