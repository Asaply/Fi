'use client';
import { useState, useEffect } from 'react';
import { Trash2, Loader, Activity } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function FinancialSummaryWidget({ widgetId, removeWidget }) {
    const [metrics, setMetrics] = useState({ capital: 0, income: 0, expenses: 0, margin: 0 });
    const [isLoading, setIsLoading] = useState(false);
    const [isError, setIsError] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setIsError(false);
            try {
                const now = new Date();
                const fromDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
                const { data: { user } } = await supabase.auth.getUser();
                const { data: txData } = await supabase
                    .from('transactions')
                    .select('type, amount')
                    .eq('user_id', user?.id)
                    .gte('date', fromDate);

                let income = 0, expenses = 0;
                txData?.forEach(tx => {
                    const amt = parseFloat(tx.amount) || 0;
                    if (tx.type === 'Ingreso') income += amt;
                    else if (tx.type === 'Egreso') expenses += amt;
                });

                const capital = income - expenses;
                const margin = income > 0 ? ((income - expenses) / income) * 100 : 0;
                setMetrics({ capital, income, expenses, margin });
            } catch (e) {
                console.error(e);
                setIsError(true);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const fmt = (v) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v);

    return (
        <div className="fnce-widget">
            <div className="fnce-widget-header widget-drag-handle">
                <span className="fnce-widget-title">Resumen Financiero</span>
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
                ) : (
                    <div className="fnce-metrics-grid">
                        <div className="fnce-metric-card">
                            <span className="fnce-metric-card-label">Capital Neto</span>
                            <span className={`fnce-metric-card-value ${metrics.capital < 0 ? 'negative' : ''}`}>
                                {fmt(metrics.capital)}
                            </span>
                        </div>
                        <div className="fnce-metric-card">
                            <Activity size={11} className="fnce-metric-card-icon" />
                            <span className="fnce-metric-card-label">Margen</span>
                            <span className="fnce-metric-card-value">{metrics.margin.toFixed(1)}%</span>
                        </div>
                        <div className="fnce-metric-card">
                            <span className="fnce-metric-card-label">Total Ingresos</span>
                            <span className="fnce-metric-card-value">{fmt(metrics.income)}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
