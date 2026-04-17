'use client';
import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Trash2, Loader } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function RevenueWidget({ widgetId, removeWidget }) {
    const [period, setPeriod] = useState('month');
    const [income, setIncome] = useState(0);
    const [expenses, setExpenses] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isError, setIsError] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setIsError(false);
            try {
                const now = new Date();
                let fromDate;
                if (period === 'month') {
                    fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                } else if (period === '3months') {
                    fromDate = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().split('T')[0];
                } else {
                    fromDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
                }
                const { data } = await supabase
                    .from('transactions')
                    .select('type, amount')
                    .gte('date', fromDate);

                let inc = 0, exp = 0;
                data?.forEach(tx => {
                    const amt = parseFloat(tx.amount) || 0;
                    if (tx.type === 'Ingreso') inc += amt;
                    else if (tx.type === 'Egreso') exp += amt;
                });
                setIncome(inc);
                setExpenses(exp);
            } catch (e) {
                console.error(e);
                setIsError(true);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [period]);

    const balance = income - expenses;
    const fmt = (v) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v);

    return (
        <div className="fnce-widget">
            <div className="fnce-widget-header widget-drag-handle">
                <span className="fnce-widget-title">Ingresos vs Egresos</span>
                <span className="fnce-live-badge">LIVE</span>
                <button onClick={() => removeWidget(widgetId)} className="fnce-widget-btn" title="Eliminar">
                    <Trash2 size={13} />
                </button>
            </div>

            <div className="fnce-widget-body">
                <select
                    className="fnce-period-select"
                    value={period}
                    onChange={e => setPeriod(e.target.value)}
                >
                    <option value="month">Este mes</option>
                    <option value="3months">Últimos 3 meses</option>
                    <option value="ytd">Este año</option>
                </select>

                {isLoading ? (
                    <div className="fnce-loading">
                        <Loader size={16} className="spin-anim" />
                    </div>
                ) : isError ? (
                    <div className="fnce-error">Error al cargar datos. Verifica tu conexión.</div>
                ) : (
                    <>
                        <div className="fnce-metric-row">
                            <TrendingUp size={14} className="fnce-icon-positive" />
                            <span className="fnce-metric-label">Ingresos</span>
                            <span className="fnce-metric-value positive">{fmt(income)}</span>
                        </div>
                        <div className="fnce-divider" />
                        <div className="fnce-metric-row">
                            <TrendingDown size={14} className="fnce-icon-negative" />
                            <span className="fnce-metric-label">Egresos</span>
                            <span className="fnce-metric-value negative">{fmt(expenses)}</span>
                        </div>
                        <div className="fnce-divider dashed" />
                        <div className="fnce-metric-row">
                            <DollarSign size={14} className="fnce-icon-neutral" />
                            <span className="fnce-metric-label"><strong>Balance Neto</strong></span>
                            <span className={`fnce-metric-value ${balance >= 0 ? 'positive' : 'negative'}`}>
                                {fmt(balance)}
                            </span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
