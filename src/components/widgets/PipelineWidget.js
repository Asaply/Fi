'use client';
import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Trash2, Settings, X, Loader } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

const COLORS = ['#86868b', '#0071e3', '#af52de', '#ff9f0a', '#34c759', '#ff3b30'];

// Prospectos stages
const PROSPECT_STAGES = [
    { id: 'nuevo', title: 'Nuevo' },
    { id: 'contactado', title: 'Contactado' },
    { id: 'propuesta', title: 'Propuesta' },
    { id: 'negociacion', title: 'Negociación' },
    { id: 'cerrado', title: 'Cerrado' },
    { id: 'perdido', title: 'Perdido' },
];

// Clientes stages
const CLIENT_STAGES = [
    { id: 'prospecto', title: 'Prospecto' },
    { id: 'propuesta', title: 'Propuesta' },
    { id: 'desarrollo', title: 'Desarrollo' },
    { id: 'entregado', title: 'Entregado' },
    { id: 'mantenimiento', title: 'Mantenimiento' },
];

export default function PipelineWidget({ widgetId, data = {}, updateWidgetData, removeWidget, gridHeight }) {
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isError, setIsError] = useState(false);
    const [chartData, setChartData] = useState([]);
    const [localData, setLocalData] = useState({
        title: data.title || 'Métricas de Conversión',
        useRealData: data.useRealData !== undefined ? data.useRealData : true,
        source: data.source || 'prospects',
    });

    const fetchRealData = async (source) => {
        setIsLoading(true);
        setIsError(false);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (source === 'prospects') {
                const { data: rows } = await supabase.from('prospects').select('stage').eq('user_id', user?.id);
                const counts = {};
                PROSPECT_STAGES.forEach(s => { counts[s.id] = 0; });
                rows?.forEach(r => { if (counts[r.stage] !== undefined) counts[r.stage]++; });
                setChartData(PROSPECT_STAGES.map(s => ({ step: s.title, leads: counts[s.id] })));
            } else {
                const { data: rows } = await supabase.from('clients').select('status').eq('user_id', user?.id);
                const counts = {};
                CLIENT_STAGES.forEach(s => { counts[s.id] = 0; });
                rows?.forEach(r => { if (counts[r.status] !== undefined) counts[r.status]++; });
                setChartData(CLIENT_STAGES.map(s => ({ step: s.title, leads: counts[s.id] })));
            }
        } catch (e) { console.error(e); setIsError(true); }
        finally { setIsLoading(false); }
    };

    useEffect(() => {
        if (localData.useRealData) fetchRealData(localData.source);
    }, [localData.useRealData, localData.source]);

    const handleToggle = (useRealData) => {
        const updated = { ...localData, useRealData };
        setLocalData(updated);
        updateWidgetData(widgetId, updated);
        if (useRealData) fetchRealData(updated.source);
    };

    const handleSource = (source) => {
        const updated = { ...localData, source };
        setLocalData(updated);
        updateWidgetData(widgetId, updated);
        if (localData.useRealData) fetchRealData(source);
    };

    return (
        <div className="widget-card pipeline-widget" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
                <div style={{ margin: '0 16px 12px', padding: '12px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 500 }}>Datos en vivo</span>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={localData.useRealData} onChange={e => handleToggle(e.target.checked)} />
                            <span style={{ color: localData.useRealData ? '#10b981' : 'var(--text-secondary)' }}>{localData.useRealData ? 'Activado' : 'Desactivado'}</span>
                        </label>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Fuente</span>
                        <select className="form-input" style={{ fontSize: '12px', padding: '4px 8px', width: 'auto' }} value={localData.source} onChange={e => handleSource(e.target.value)}>
                            <option value="prospects">Prospectos</option>
                            <option value="clients">Clientes</option>
                        </select>
                    </div>
                </div>
            )}

            <div className="widget-content" style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                {isLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, color: 'var(--text-secondary)' }}>
                        <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />
                    </div>
                ) : isError ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, color: 'var(--danger)', fontSize: '13px', textAlign: 'center' }}>
                        Error al cargar datos. Verifica tu conexión.
                    </div>
                ) : (
                    <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 30, left: 20, bottom: 8 }}>
                                <XAxis type="number" allowDecimals={false} hide />
                                <YAxis dataKey="step" type="category" axisLine={false} tickLine={false} width={90} style={{ fontSize: '12px', fill: '#a1a1aa' }} />
                                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#ffffff' }} labelStyle={{ color: '#aaaaaa' }} />
                                <Bar dataKey="leads" radius={[0, 4, 4, 0]} barSize={20}>
                                    {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>
    );
}
