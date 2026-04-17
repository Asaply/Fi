'use client';
import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { Trash2, Settings, X, Loader } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];

export default function PortfolioWidget({ widgetId, data = {}, updateWidgetData, removeWidget, gridHeight }) {
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isError, setIsError] = useState(false);
    const [chartData, setChartData] = useState([]);
    const [localData, setLocalData] = useState({
        title: data.title || 'Diversificación de Activos',
        useRealData: data.useRealData !== undefined ? data.useRealData : true,
    });

    const fetchRealData = async () => {
        setIsLoading(true);
        setIsError(false);
        try {
            const { data: assets } = await supabase
                .from('portfolio_assets')
                .select('category, quantity, avg_buy_price');

            const grouped = {};
            assets?.forEach(a => {
                const cat = a.category || 'Otro';
                grouped[cat] = (grouped[cat] || 0) + (parseFloat(a.quantity) * parseFloat(a.avg_buy_price));
            });
            setChartData(Object.entries(grouped).map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) })));
        } catch (e) { console.error(e); setIsError(true); }
        finally { setIsLoading(false); }
    };

    useEffect(() => {
        if (localData.useRealData) fetchRealData();
    }, [localData.useRealData]);

    const handleToggle = (useRealData) => {
        const updated = { ...localData, useRealData };
        setLocalData(updated);
        updateWidgetData(widgetId, updated);
        if (useRealData) fetchRealData();
    };

    const fmt = (v) => `$${v.toLocaleString('es-MX', { minimumFractionDigits: 0 })}`;

    return (
        <div className="widget-card portfolio-widget" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <h4 className="widget-title">
                {localData.title}
                <div className="widget-header-actions">
                    {localData.useRealData && <span style={{ fontSize: '10px', padding: '2px 6px', background: 'rgba(16,185,129,0.15)', color: '#10b981', borderRadius: '4px', fontWeight: 600 }}>LIVE</span>}
                    <button onClick={() => setIsConfigOpen(!isConfigOpen)} className="widget-action-btn edit" title="Configurar">
                        {isConfigOpen ? <X size={14} /> : <Settings size={14} />}
                    </button>
                    <button onClick={() => removeWidget(widgetId)} className="widget-action-btn delete"><Trash2 size={14} /></button>
                </div>
            </h4>

            {isConfigOpen && (
                <div style={{ margin: '0 16px 12px', padding: '12px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 500 }}>Datos en vivo</span>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={localData.useRealData} onChange={e => handleToggle(e.target.checked)} />
                            <span style={{ color: localData.useRealData ? '#10b981' : 'var(--text-secondary)' }}>{localData.useRealData ? 'Activado' : 'Desactivado'}</span>
                        </label>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '11px', margin: 0 }}>
                        Sincronizado con tu tabla de activos (Portfolio Health).
                    </p>
                </div>
            )}

            <div className="widget-content" style={{ flex: 1, position: 'relative', minHeight: 0, padding: '0 16px 16px 16px' }}>
                {isLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, color: 'var(--text-secondary)' }}>
                        <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />
                    </div>
                ) : isError ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, color: 'var(--danger)', fontSize: '13px', textAlign: 'center', padding: '16px' }}>
                        Error al cargar datos. Verifica tu conexión.
                    </div>
                ) : chartData.length === 0 ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center', padding: '16px' }}>
                        Sin activos registrados.<br />Agrega activos en Portfolio Health.
                    </div>
                ) : (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={chartData} cx="50%" cy="50%" innerRadius={0} outerRadius={80} dataKey="value"
                                    labelLine={false} label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
                                    {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                </Pie>
                                <RechartsTooltip formatter={(v) => fmt(v)} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }} />
                                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>
    );
}
