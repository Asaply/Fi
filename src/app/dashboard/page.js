'use client';
import { useState, useEffect } from 'react';
import { getFilter, setFilter } from '@/lib/filterMemory';
import GastosPorCategoria from '@/components/GastosPorCategoria';
import IngresosPorCategoria from '@/components/IngresosPorCategoria';
import ReporteMensual from '@/components/ReporteMensual';
import Recordatorios from '@/components/Recordatorios';
import { supabase } from '@/lib/supabaseClient';
import { ArrowUpRight, ArrowDownRight, Wallet, TrendingUp, CreditCard, Search, Calendar, Building2, Landmark } from 'lucide-react';
import { formatMXN } from '@/lib/formatCurrency';
import { API_BASE } from '@/lib/apiBase';
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
    const [periodo, setPeriodo] = useState('3m');
    const [categoryType, setCategoryType] = useState('gastos'); // 'gastos' | 'ingresos'
    const [categoryView, setCategoryView] = useState('debit'); // 'debit' | 'credit'
    const [stats, setStats] = useState({
        ingresos: 0,
        egresos: 0,
        porCobrar: 0,
        porCobrarLabel: 'Por Cobrar',
        portafolio: 0,
        portfolioIsLive: false,
        // credit
        deudaCredito: 0,
        cargosCredito: 0,
        creditCards: [],  // [{ bank, deuda, limite }]
        // debit
        debitCards: [],   // [{ banco, saldo_anterior, saldo_final, periodo }]
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
                    .select('type, amount, account_type, bank')
                    .eq('user_id', uid)
                    .gte('date', fechaInicio);

                let ingresos = 0, egresos = 0, cargosCredito = 0, pagosCredito = 0;
                const creditBankSet = new Set();
                if (txs) {
                    txs.forEach(t => {
                        const type = t.type?.toLowerCase().trim();
                        const amt = Number(t.amount) || 0;
                        const at = t.account_type || 'debito';
                        if (at === 'debito') {
                            if (type === 'ingreso') ingresos += amt;
                            if (['egreso', 'gasto personal'].includes(type)) egresos += amt;
                        } else if (at === 'credito') {
                            if (type === 'egreso') cargosCredito += amt;
                            if (['ingreso', 'transferencia'].includes(type)) pagosCredito += amt;
                            if (t.bank && t.bank !== 'Desconocido') creditBankSet.add(t.bank);
                        }
                    });
                }

                // Credit cards — load deuda + limite from localStorage per-card configs
                const creditCards = [];
                let deudaCredito = 0;
                for (const bank of creditBankSet) {
                    const raw = localStorage.getItem(`fnce_credit_config_${uid}_${bank}`);
                    if (raw) {
                        try {
                            const cfg = JSON.parse(raw);
                            const deuda = Number(cfg.deudaAlCorte) || 0;
                            const limite = Number(cfg.limit) || 0;
                            creditCards.push({ bank, deuda, limite });
                            deudaCredito += deuda;
                        } catch (_) {}
                    } else {
                        creditCards.push({ bank, deuda: 0, limite: 0 });
                    }
                }

                // Debit cards — load saldo from localStorage per-card bank balance keys
                // Only include entries explicitly tagged as 'debito' (credit imports now tag account_type)
                const debitCards = [];
                const allKeys = Object.keys(localStorage);
                for (const key of allKeys) {
                    if (key.startsWith(`nva_bank_balance_${uid}_`)) {
                        try {
                            const bb = JSON.parse(localStorage.getItem(key));
                            if (bb?.banco && bb.banco !== 'Banco' && bb.account_type !== 'credito') {
                                debitCards.push(bb);
                            }
                        } catch (_) {}
                    }
                }

                // Per-user por cobrar
                const { data: config } = await supabase
                    .from('user_config')
                    .select('concepto_custom_label, concepto_custom_total')
                    .eq('user_id', uid)
                    .maybeSingle();
                const porCobrar = Number(config?.concepto_custom_total) || 0;
                const porCobrarLabel = config?.concepto_custom_label || 'Por Cobrar';

                const { data: assets } = await supabase
                    .from('portfolio_assets')
                    .select('ticker, quantity, avg_buy_price, category')
                    .eq('user_id', uid);

                let portafolio = 0;
                let portfolioIsLive = false;
                if (assets && assets.length > 0) {
                    const pricePromises = assets.map(async (a) => {
                        try {
                            const cat = (a.category || '').toLowerCase();
                            const endpoint = cat === 'crypto'
                                ? `${API_BASE}/api/crypto?ticker=${encodeURIComponent(a.ticker)}`
                                : `${API_BASE}/api/price?ticker=${encodeURIComponent(a.ticker)}`;
                            const res = await fetch(endpoint);
                            if (res.ok) {
                                const d = await res.json();
                                if (d.price) {
                                    portfolioIsLive = true;
                                    return Number(d.price) * Number(a.quantity);
                                }
                            }
                        } catch (_) {}
                        return Number(a.avg_buy_price) * Number(a.quantity);
                    });
                    const values = await Promise.all(pricePromises);
                    portafolio = values.reduce((acc, v) => acc + v, 0);
                }

                setStats({ ingresos, egresos, porCobrar, porCobrarLabel, portafolio, portfolioIsLive, deudaCredito, cargosCredito, creditCards, debitCards, loading: false });
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
                        <span className="app-metric-subtext">débito</span>
                    </div>
                    <div className="app-metric-card">
                        <div className="app-metric-icon" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>
                            <ArrowDownRight size={16} />
                        </div>
                        <span className="app-metric-title">Egresos</span>
                        <span className="app-metric-value">{formatMXN(stats.egresos)}</span>
                        <span className="app-metric-subtext">débito</span>
                    </div>
                    <div className="app-metric-card">
                        <div className="app-metric-icon" style={{ background: stats.deudaCredito > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(52,211,153,0.12)', color: stats.deudaCredito > 0 ? '#ef4444' : '#34d399' }}>
                            <CreditCard size={16} />
                        </div>
                        <span className="app-metric-title">Deuda Crédito</span>
                        <span className="app-metric-value" style={{ color: stats.deudaCredito > 0 ? '#ef4444' : '#34d399' }}>
                            {formatMXN(stats.deudaCredito)}
                        </span>
                        {stats.creditCards.length > 1 && (
                            <span className="app-metric-subtext">{stats.creditCards.length} tarjetas</span>
                        )}
                    </div>
                    <div className="app-metric-card">
                        <div className="app-metric-icon" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>
                            <TrendingUp size={16} />
                        </div>
                        <span className="app-metric-title">Portafolio</span>
                        <span className="app-metric-value">{formatMXN(stats.portafolio)}</span>
                        <span className="app-metric-subtext">{stats.portfolioIsLive ? 'Valor actual' : 'Costo base'}</span>
                    </div>
                </div>
            )}

            {/* Debit account balances */}
            {!stats.loading && stats.debitCards.length > 0 && (
                <div style={{ marginBottom: '8px' }}>
                    <p style={{ margin: '0 0 8px', fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: '5px' }}><Landmark size={11} /> Cuentas de Débito</p>
                    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none' }}>
                        {stats.debitCards.map((bb, i) => (
                            <div key={i} style={{ flexShrink: 0, minWidth: '140px', padding: '12px 14px', borderRadius: '12px', background: 'rgba(255,135,0,0.07)', border: '1px solid rgba(255,135,0,0.2)' }}>
                                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 600, color: 'rgba(255,135,0,0.85)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{bb.banco}</p>
                                <p style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#FF8700' }}>{formatMXN(bb.saldo_final || 0)}</p>
                                {bb.periodo && <p style={{ margin: '2px 0 0', fontSize: '10px', color: 'var(--text-secondary)' }}>{bb.periodo}</p>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Credit card breakdown */}
            {!stats.loading && stats.creditCards.length > 0 && (
                <div style={{ marginBottom: '8px' }}>
                    <p style={{ margin: '0 0 8px', fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: '5px' }}><CreditCard size={11} /> Tarjetas de Crédito</p>
                    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none' }}>
                        {stats.creditCards.map((cc, i) => {
                            const util = cc.limite > 0 ? (cc.deuda / cc.limite) * 100 : 0;
                            const color = util >= 70 ? '#ef4444' : util >= 30 ? '#eab308' : '#34d399';
                            return (
                                <div key={i} style={{ flexShrink: 0, minWidth: '150px', padding: '12px 14px', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                                    <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{cc.bank}</p>
                                    <p style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700, color }}>{formatMXN(cc.deuda)}</p>
                                    {cc.limite > 0 && (
                                        <>
                                            <div style={{ height: '3px', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: '4px' }}>
                                                <div style={{ width: `${Math.min(util, 100)}%`, height: '100%', background: color, borderRadius: '999px' }} />
                                            </div>
                                            <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-secondary)' }}>{Math.round(util)}% de {formatMXN(cc.limite)}</p>
                                        </>
                                    )}
                                </div>
                            );
                        })}
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
                    {/* Gastos / Ingresos top toggle */}
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                        <button
                            onClick={() => setCategoryType('gastos')}
                            style={{ flex: 1, padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: categoryType === 'gastos' ? 700 : 400, border: `1px solid ${categoryType === 'gastos' ? 'var(--accent)' : 'var(--bg-border)'}`, background: categoryType === 'gastos' ? 'rgba(255,135,0,0.12)' : 'transparent', color: categoryType === 'gastos' ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                        >
                            <ArrowDownRight size={12} style={{ flexShrink: 0 }} /> Gastos
                        </button>
                        <button
                            onClick={() => setCategoryType('ingresos')}
                            style={{ flex: 1, padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: categoryType === 'ingresos' ? 700 : 400, border: `1px solid ${categoryType === 'ingresos' ? 'var(--accent)' : 'var(--bg-border)'}`, background: categoryType === 'ingresos' ? 'rgba(255,135,0,0.12)' : 'transparent', color: categoryType === 'ingresos' ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                        >
                            <ArrowUpRight size={12} style={{ flexShrink: 0 }} /> Ingresos
                        </button>
                    </div>

                    {categoryType === 'gastos' ? (
                        <>
                            {/* Débito / Crédito sub-toggle */}
                            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                                <button
                                    onClick={() => setCategoryView('debit')}
                                    style={{ flex: 1, padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: categoryView === 'debit' ? 700 : 400, border: `1px solid ${categoryView === 'debit' ? 'rgba(255,255,255,0.2)' : 'var(--bg-border)'}`, background: categoryView === 'debit' ? 'rgba(255,255,255,0.06)' : 'transparent', color: categoryView === 'debit' ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                                >
                                    <Landmark size={12} style={{ flexShrink: 0 }} /> Débito
                                </button>
                                <button
                                    onClick={() => setCategoryView('credit')}
                                    style={{ flex: 1, padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: categoryView === 'credit' ? 700 : 400, border: `1px solid ${categoryView === 'credit' ? 'rgba(255,255,255,0.2)' : 'var(--bg-border)'}`, background: categoryView === 'credit' ? 'rgba(255,255,255,0.06)' : 'transparent', color: categoryView === 'credit' ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                                >
                                    <CreditCard size={12} style={{ flexShrink: 0 }} /> Crédito
                                </button>
                            </div>
                            <GastosPorCategoria startDate={fechaInicio} accountType={categoryView} mode={categoryView} />
                        </>
                    ) : (
                        <IngresosPorCategoria startDate={fechaInicio} accountType="debit" />
                    )}
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
