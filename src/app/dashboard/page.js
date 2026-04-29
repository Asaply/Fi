'use client';
import { useState, useEffect } from 'react';
import { getFilter, setFilter } from '@/lib/filterMemory';
import OnboardingTour from '@/components/onboarding/OnboardingTour';
import { useOnboarding } from '@/hooks/useOnboarding';
import { DASHBOARD_STEPS } from '@/components/onboarding/tourSteps';
import GastosPorCategoria from '@/components/GastosPorCategoria';
import ReporteMensual from '@/components/ReporteMensual';
import Recordatorios from '@/components/Recordatorios';
import { supabase } from '@/lib/supabaseClient';
import { ArrowUpRight, ArrowDownRight, Wallet, TrendingUp, Search, Calendar } from 'lucide-react';
import { formatMXN } from '@/lib/formatCurrency';
import './Dashboard.css';

const PERIODOS = [
    { value: '1m',  label: 'Este mes' },
    { value: '3m',  label: '3 meses' },
    { value: '6m',  label: '6 meses' },
    { value: '1y',  label: '1 año' },
    { value: 'todo', label: 'Todo' },
];

function getFechaInicio(periodo) {
    const now = new Date();
    switch (periodo) {
        case '1m':   return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        case '3m':   return new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split('T')[0];
        case '6m':   return new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString().split('T')[0];
        case '1y':   return new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString().split('T')[0];
        case 'todo': return '2000-01-01';
        default:     return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    }
}

export default function DashboardPage() {
    const { isActive: tourActive, complete: tourComplete, skip: tourSkip, reset: resetTour } = useOnboarding('dashboard');
    const [periodo, setPeriodo] = useState('3m');
    const [stats, setStats] = useState({
        ingresos: 0,
        egresos: 0,
        porCobrar: 0,
        porCobrarLabel: 'Por Cobrar',
        portafolio: 0,
        loading: true
    });

    useEffect(() => {
        const saved = getFilter('dashboard');
        if (saved) setPeriodo(saved);
    }, []);

    const fechaInicio = getFechaInicio(periodo);

    useEffect(() => {
        const loadDashboardStats = async () => {
            setStats(prev => ({ ...prev, loading: true }));
            try {
                const { data: { user } } = await supabase.auth.getUser();
                const uid = user?.id;

                const { data: txs } = await supabase
                    .from('transactions')
                    .select('type, amount')
                    .eq('user_id', uid)
                    .gte('date', fechaInicio);

                let ingresos = 0; let egresos = 0;
                if (txs) {
                    txs.forEach(t => {
                        const type = t.type?.toLowerCase().trim();
                        const amt = Number(t.amount) || 0;
                        if (type === 'ingreso') ingresos += amt;
                        if (['egreso', 'gasto personal'].includes(type)) egresos += amt;
                    });
                }

                // Per-user por cobrar — same source as finanzas page
                const { data: config } = await supabase
                    .from('user_config')
                    .select('concepto_custom_label, concepto_custom_total')
                    .eq('user_id', uid)
                    .maybeSingle();
                const porCobrar = Number(config?.concepto_custom_total) || 0;
                const porCobrarLabel = config?.concepto_custom_label || 'Por Cobrar';

                const { data: assets } = await supabase
                    .from('portfolio_assets')
                    .select('ticker, quantity, avg_buy_price')
                    .eq('user_id', uid);

                let portafolio = 0;
                if (assets) {
                    const pricePromises = assets.map(async (a) => {
                        try {
                            const res = await fetch(`/api/price?ticker=${encodeURIComponent(a.ticker)}`);
                            const data = await res.json();
                            if (data.price) return Number(data.price) * Number(a.quantity);
                        } catch (e) {}
                        return Number(a.avg_buy_price) * Number(a.quantity);
                    });
                    const values = await Promise.all(pricePromises);
                    portafolio = values.reduce((a, b) => a + b, 0);
                }

                setStats({ ingresos, egresos, porCobrar, porCobrarLabel, portafolio, loading: false });
            } catch (err) {
                console.error(err);
                setStats(prev => ({ ...prev, loading: false }));
            }
        };
        loadDashboardStats();
    }, [fechaInicio]);

    const balanceTotal = stats.ingresos - stats.egresos + stats.portafolio + stats.porCobrar;
    const balanceAbs = formatMXN(Math.abs(balanceTotal));
    const [balanceInt, balanceDec] = balanceAbs.split('.');

    return (
        <div className="page-container dashboard-page">
            <OnboardingTour
                steps={DASHBOARD_STEPS}
                isActive={tourActive}
                onComplete={tourComplete}
                onSkip={tourSkip}
            />
            {stats.loading ? (
                <div className="app-hero">
                    <div className="skeleton" style={{ height: '14px', width: '90px', margin: '0 auto 12px', borderRadius: '4px' }} />
                    <div className="skeleton" style={{ height: '52px', width: '220px', margin: '0 auto', borderRadius: '8px' }} />
                </div>
            ) : (
                <div className="app-hero">
                    <p className="app-hero-label">Balance Total</p>
                    <div className="app-hero-amount">
                        <span className={`app-hero-int${balanceTotal < 0 ? ' negative' : ''}`}>
                            {balanceTotal < 0 ? '-' : ''}{balanceInt}
                        </span>
                        <span className="app-hero-dec">.{balanceDec}</span>
                    </div>
                </div>
            )}

            {stats.loading ? (
                <div className="app-metric-grid">
                    <div className="skeleton card" style={{ height: '90px' }} />
                    <div className="skeleton card" style={{ height: '90px' }} />
                    <div className="skeleton card" style={{ height: '90px' }} />
                    <div className="skeleton card" style={{ height: '90px' }} />
                </div>
            ) : (
                <div className="app-metric-grid">
                    <div className="app-metric-card">
                        <div className="app-metric-icon" style={{ background: 'rgba(52, 211, 153, 0.12)', color: '#34d399' }}>
                            <ArrowUpRight size={16} />
                        </div>
                        <span className="app-metric-title">Ingresos</span>
                        <span className="app-metric-value">{formatMXN(stats.ingresos)}</span>
                    </div>
                    <div className="app-metric-card">
                        <div className="app-metric-icon" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>
                            <ArrowDownRight size={16} />
                        </div>
                        <span className="app-metric-title">Egresos</span>
                        <span className="app-metric-value">{formatMXN(stats.egresos)}</span>
                    </div>
                    <div className="app-metric-card">
                        <div className="app-metric-icon" style={{ background: 'rgba(234, 179, 8, 0.12)', color: '#eab308' }}>
                            <Wallet size={16} />
                        </div>
                        <span className="app-metric-title">{stats.porCobrarLabel}</span>
                        <span className="app-metric-value">{formatMXN(stats.porCobrar)}</span>
                    </div>
                    <div className="app-metric-card">
                        <div className="app-metric-icon" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>
                            <TrendingUp size={16} />
                        </div>
                        <span className="app-metric-title">Portafolio</span>
                        <span className="app-metric-value">{formatMXN(stats.portafolio)}</span>
                        <span className="app-metric-subtext">Costo base</span>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                <div className="page-actions" style={{ justifyContent: 'center' }}>
                    <div className="period-filter-wrap" data-tour="time-filter">
                        {PERIODOS.map(p => (
                            <button
                                key={p.value}
                                className={`period-filter-btn ${periodo === p.value ? 'active' : ''}`}
                                onClick={() => { setFilter('dashboard', p.value); setPeriodo(p.value); }}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Layout inferior */}
            <div className="dashboard-grid">
                <div className="dashboard-full-width" data-tour="gastos-categoria">
                    <GastosPorCategoria startDate={fechaInicio} />
                </div>
                <div className="dashboard-full-width">
                    <ReporteMensual startDate={fechaInicio} />
                </div>
                <div className="dashboard-full-width">
                    <Recordatorios />
                </div>
            </div>
        </div>
    );
}
