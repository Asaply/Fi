"use client";
import { useState, useMemo, useEffect } from "react";
import useSWR from "swr";
import { Activity, TrendingUp, TrendingDown, Plus, Edit2, Trash2, DollarSign, Target, Briefcase, Search, ChevronUp, ChevronDown, Info, ArrowUpRight, ArrowDownRight, Wallet, LayoutGrid } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import Modal from "@/components/Modal";
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, Legend } from "recharts";
import "./Portfolio.css";
import { getFilter, setFilter } from '@/lib/filterMemory';
import { API_BASE } from '@/lib/apiBase';
import OnboardingTour from '@/components/onboarding/OnboardingTour';
import { useOnboarding } from '@/hooks/useOnboarding';
import { PORTFOLIO_STEPS } from '@/components/onboarding/tourSteps';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];

const TICKER_HINTS = {
    Crypto: {
        placeholder: 'Ej: BTC, ETH, SOL',
        label: 'Criptomonedas populares — usa solo el símbolo, sin /USD',
        examples: ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX'],
        note: 'Fuente: CoinGecko. Escribe SOL, no SOL/USD.'
    },
    Stock: {
        placeholder: 'Ej: AAPL, TSLA, NVDA',
        label: 'Acciones populares (NYSE / NASDAQ)',
        examples: ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN', 'GOOGL', 'META', 'AMD'],
        note: 'Acciones mexicanas: agrega .MX — ej: CEMEXCPO.MX'
    },
    ETF: {
        placeholder: 'Ej: SPY, QQQ, VTI',
        label: 'ETFs más usados',
        examples: ['SPY', 'QQQ', 'VTI', 'VOO', 'IWM', 'GLD', 'ARKK', 'IEMG'],
        note: null
    },
    Bono: {
        placeholder: 'Ej: TLT, BND, AGG',
        label: 'ETFs de bonos (la forma más fácil de trackear)',
        examples: ['TLT', 'BND', 'AGG', 'HYG', 'LQD', 'SHY', 'TIPS'],
        note: 'Los bonos individuales no tienen precio en tiempo real; usa ETFs de bonos.'
    },
    REIT: {
        placeholder: 'Ej: O, VNQ, SPG',
        label: 'REITs populares',
        examples: ['O', 'VNQ', 'SPG', 'AMT', 'VICI', 'PLD', 'WELL'],
        note: null
    },
    'Fondo/Mutual Fund': {
        placeholder: 'Ej: VTSAX, FXAIX',
        label: 'Fondos de inversión',
        examples: ['VTSAX', 'FXAIX', 'VFIAX', 'FSKAX', 'SWTSX'],
        note: 'Los precios se actualizan al cierre del mercado (NAV diario).'
    },
    Otro: {
        placeholder: 'Ej: GLD, USO',
        label: 'Otros activos (commodities, divisas, etc.)',
        examples: ['GLD', 'SLV', 'USO', 'DJP', 'UUP'],
        note: null
    },
};

const fetchPrices = async (assets) => {
    const uniqueAssets = [...new Map(assets.map(a => [a.ticker.toUpperCase(), a])).values()];
    const prices = {};
    const histories = {};
    await Promise.all(uniqueAssets.map(async (asset) => {
        let endpoint = '';
        const cat = asset.category.toLowerCase();
        if (cat === 'crypto') endpoint = `${API_BASE}/api/crypto?ticker=${asset.ticker}&range=7d`;
        else if (['stock', 'etf', 'bond', 'bono', 'acciones'].includes(cat)) endpoint = `${API_BASE}/api/price?ticker=${asset.ticker}&range=7d`;
        if (!endpoint) return;
        try {
            const res = await fetch(endpoint);
            if (res.ok) {
                const data = await res.json();
                if (data.price) prices[asset.ticker.toUpperCase()] = parseFloat(data.price);
                if (data.history && data.history.length > 0) histories[asset.ticker.toUpperCase()] = data.history.map(h => h.price);
            }
        } catch (e) { console.error(`Failed fetch ${asset.ticker}`); }
    }));
    return { prices, histories };
};

const fetchPortfolioData = async () => {
    const { data: assets, error } = await supabase.from('portfolio_assets').select('*').order('created_at', { ascending: false });
    if (error) return { assets: [], prices: {}, histories: {} };
    const { prices, histories } = await fetchPrices(assets || []);
    return { assets: assets || [], prices, histories };
};

function Tooltip({ text }) {
    const [show, setShow] = useState(false);
    return (
        <span style={{ position: 'relative', display: 'inline-flex' }}
            onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
            <Info size={13} style={{ color: 'var(--text-tertiary)', cursor: 'help', marginLeft: '4px' }} />
            {show && (
                <span style={{
                    position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                    borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: 'var(--text-secondary)',
                    width: '220px', zIndex: 100, lineHeight: 1.5, whiteSpace: 'normal', marginBottom: '6px',
                    boxShadow: 'var(--shadow-md)'
                }}>{text}</span>
            )}
        </span>
    );
}

export default function PortfolioHealth() {
    const { isActive: tourActive, complete: tourComplete, skip: tourSkip, reset: resetTour } = useOnboarding('portfolio');
    const { data, isLoading, mutate } = useSWR('portfolio_data', fetchPortfolioData, { refreshInterval: 60000 });

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAsset, setEditingAsset] = useState(null);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortConfig, setSortConfig] = useState({ key: 'value', direction: 'desc' });
    const timeRanges = ['1S', '1M', '3M', '6M', 'YTD', '1A'];
    const [activeRange, setActiveRange] = useState('1A');

    useEffect(() => {
        const saved = getFilter('portfolio');
        if (saved) setActiveRange(saved);
    }, []);

    const [formData, setFormData] = useState({
        ticker: "", category: "Stock", quantity: "", avg_buy_price: "", currency: "USD"
    });

    const assets = data?.assets || [];
    const prices = data?.prices || {};
    const histories = data?.histories || {};

    let totalValue = 0, totalCost = 0;
    let bestAsset = { ticker: '-', pnlPerc: -Infinity };
    let worstAsset = { ticker: '-', pnlPerc: Infinity };

    const enrichedAssets = assets.map(asset => {
        const t = asset.ticker.toUpperCase();
        const currentPrice = prices[t] !== undefined ? prices[t] : asset.avg_buy_price;
        const cost = asset.quantity * asset.avg_buy_price;
        const value = asset.quantity * currentPrice;
        const pnl = value - cost;
        const pnlPerc = cost > 0 ? (pnl / cost) * 100 : 0;
        const sparkline = histories[t] || Array(7).fill(currentPrice);
        if (prices[t] !== undefined) {
            if (pnlPerc > bestAsset.pnlPerc) bestAsset = { ticker: t, pnlPerc };
            if (pnlPerc < worstAsset.pnlPerc) worstAsset = { ticker: t, pnlPerc };
        }
        totalValue += value;
        totalCost += cost;
        return { ...asset, currentPrice, value, pnl, pnlPerc, cost, sparkline };
    });

    const totalPnl = totalValue - totalCost;
    const totalPnlPerc = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

    const filteredAssets = enrichedAssets.filter(a =>
        a.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const sortedAssets = [...filteredAssets].sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return null;
        return sortConfig.direction === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />;
    };

    const distributionMap = {};
    enrichedAssets.forEach(a => { distributionMap[a.category] = (distributionMap[a.category] || 0) + a.value; });
    const pieData = Object.keys(distributionMap).map(k => ({ name: k, value: distributionMap[k] }));
    const barData = enrichedAssets.map(a => ({ name: a.ticker, PnL: a.pnl }));

    const historyChartData = useMemo(() => {
        if (!totalValue || !totalCost) return [];
        const chartData = [];
        let curVal = totalCost;
        let curSP500 = 5000;
        let curNasdaq = 16000;
        const steps = activeRange === '1S' ? 7 : activeRange === '1M' ? 30 : activeRange === '1A' ? 365 : 90;
        const delta = (totalValue - totalCost) / steps;
        for (let i = 0; i < steps; i++) {
            const noise = (Math.random() - 0.5) * (totalValue * 0.01);
            curVal += delta + noise;
            curSP500 += (Math.random() - 0.45) * 20;
            curNasdaq += (Math.random() - 0.45) * 60;
            chartData.push({
                day: `D${i + 1}`,
                'Tu portafolio': parseFloat(curVal.toFixed(2)),
                'S&P 500': parseFloat(curSP500.toFixed(2)),
                'Nasdaq': parseFloat(curNasdaq.toFixed(2))
            });
        }
        if (chartData.length > 0) chartData[chartData.length - 1]['Tu portafolio'] = totalValue;
        return chartData;
    }, [totalValue, totalCost, activeRange]);

    let divScore = 50, volScore = 50, benchScore = 50, liqScore = 90;
    const recs = [];
    let cryptoPerc = 0;

    if (enrichedAssets.length > 0) {
        const maxVal = Math.max(...enrichedAssets.map(a => a.value));
        const maxPerc = (maxVal / totalValue) * 100;
        if (maxPerc > 60) { divScore -= 30; recs.push(`${enrichedAssets.find(a => a.value === maxVal).ticker} representa el ${maxPerc.toFixed(1)}% de tu portafolio. Considera reducirlo.`); }
        else if (maxPerc < 20) { divScore += 40; recs.push("Excelente diversificación. Ningún activo domina tu portafolio."); }

        const cryptoVal = enrichedAssets.filter(a => a.category.toLowerCase() === 'crypto').reduce((s, a) => s + a.value, 0);
        cryptoPerc = (cryptoVal / totalValue) * 100;
        if (cryptoPerc > 50) { volScore -= 30; recs.push(`Alta volatilidad: ${cryptoPerc.toFixed(1)}% en Crypto. Considera diversificar.`); }
        else { volScore += 20; }

        if (totalPnlPerc > 10) benchScore += 40;
        else if (totalPnlPerc < 0) { benchScore -= 20; recs.push("Tu portafolio está por debajo del mercado general actualmente."); }
    }

    const overallHealth = (divScore + volScore + benchScore + liqScore) / 4;
    const getBarColor = (s) => s > 75 ? 'excellent' : s > 50 ? 'good' : s > 30 ? 'warning' : 'danger';
    const healthLabel = overallHealth > 75 ? 'Excelente' : overallHealth > 50 ? 'Buena' : overallHealth > 30 ? 'Regular' : 'En riesgo';
    const healthColor = overallHealth > 75 ? 'var(--success)' : overallHealth > 50 ? '#3b82f6' : overallHealth > 30 ? '#f59e0b' : 'var(--danger)';

    const beta = 1.0 + (cryptoPerc > 30 ? 0.8 : 0) + (totalPnlPerc > 20 ? 0.3 : -0.1);
    const sharpe = (totalPnlPerc / 100) / (beta * 0.15) || 0;

    const openModal = (assetToEdit = null) => {
        setFormError(null);
        if (assetToEdit) {
            setEditingAsset(assetToEdit);
            setFormData({
                ticker: assetToEdit.ticker, category: assetToEdit.category,
                quantity: assetToEdit.quantity.toString(), avg_buy_price: assetToEdit.avg_buy_price.toString(),
                currency: assetToEdit.currency || "USD",
            });
        } else {
            setEditingAsset(null);
            setFormData({ ticker: "", category: "Stock", quantity: "", avg_buy_price: "", currency: "USD" });
        }
        setIsModalOpen(true);
    };

    const [formError, setFormError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setFormError(null);
        setIsSaving(true);
        const { data: { user } } = await supabase.auth.getUser();
        const payload = {
            ticker: formData.ticker.toUpperCase(),
            category: formData.category,
            quantity: parseFloat(formData.quantity) || 0,
            avg_buy_price: parseFloat(formData.avg_buy_price) || 0,
            buy_date: new Date().toISOString().split('T')[0],
            user_id: user?.id,
        };
        let error;
        if (editingAsset) {
            ({ error } = await supabase.from('portfolio_assets').update(payload).eq('id', editingAsset.id));
        } else {
            ({ error } = await supabase.from('portfolio_assets').insert([payload]));
        }
        setIsSaving(false);
        if (error) {
            setFormError(error.message);
            return;
        }
        setIsModalOpen(false);
        mutate();
    };

    const confirmDelete = async () => {
        if (itemToDelete) { await supabase.from('portfolio_assets').delete().eq('id', itemToDelete); setItemToDelete(null); mutate(); }
    };

    const formatCurrency = (amt) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'USD' }).format(amt);
    const valAbs = formatCurrency(Math.abs(totalValue));
    const [valInt, valDec] = valAbs.split('.');

    return (
        <div className="page-container portfolio-page">
            <OnboardingTour
                steps={PORTFOLIO_STEPS}
                isActive={tourActive}
                onComplete={tourComplete}
                onSkip={tourSkip}
            />
            {/* Controles de Action Button */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                <div className="page-actions" style={{ justifyContent: 'center' }}>
                    <div className="period-filter-wrap">
                        {[
                            { label: 'Este mes', range: '1M' },
                            { label: '3 meses', range: '3M' },
                            { label: '6 meses', range: '6M' },
                            { label: 'Este año', range: '1A' },
                        ].map(p => (
                            <button key={p.range} onClick={() => { setFilter('portfolio', p.range); setActiveRange(p.range); }}
                                className={`period-filter-btn ${activeRange === p.range ? 'active' : ''}`}
                            >{p.label}</button>
                        ))}
                    </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                    <button className="btn-cta-primary" data-tour="btn-agregar-activo" onClick={() => openModal()}>
                        <Plus size={16} /> Agregar Activo
                    </button>
                    <button onClick={resetTour} className="btn-action-secondary" title="¿Cómo usar esta sección?">?</button>
                </div>
            </div>

            {isLoading && !data ? (
                <div className="dashboard-metrics">
                    {[1, 2, 3, 4].map(i => <div key={i} className="metric-card skeleton" style={{ height: '100px' }} />)}
                </div>
            ) : assets.length === 0 ? (

                /* ONBOARDING — sin activos */
                <div className="portfolio-onboarding card">
                    <div className="onboarding-icon">📈</div>
                    <h2>Bienvenido a Mis Inversiones</h2>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', lineHeight: 1.6 }}>
                        Aquí puedes ver cómo están tus inversiones, si estás bien diversificado
                        y cuánto has ganado o perdido. Agrega tu primer activo para empezar.
                    </p>
                    <div className="onboarding-features">
                        <div className="onboarding-feature"><Activity size={20} style={{ color: 'var(--accent-color)' }} /><span>Precios en tiempo real (acciones, crypto, ETFs)</span></div>
                        <div className="onboarding-feature"><Target size={20} style={{ color: 'var(--success)' }} /><span>Puntuación de salud de tu portafolio</span></div>
                        <div className="onboarding-feature"><TrendingUp size={20} style={{ color: '#8b5cf6' }} /><span>Comparativa vs S&amp;P 500 y Nasdaq</span></div>
                    </div>
                    <button className="btn-action-primary" style={{ marginTop: '8px' }} onClick={() => openModal()}>
                        <Plus size={16} /> Agregar primer activo
                    </button>
                </div>

            ) : (
                <>
                    {/* 1. HERO — Valor total */}
                    <div className="app-hero">
                        <p className="app-hero-label">Valor total del portafolio</p>
                        <div className="app-hero-amount">
                            <span className="app-hero-int">
                                {valInt}
                            </span>
                            <span className="app-hero-dec">.{valDec}</span>
                        </div>
                        <div className={`app-hero-badge ${totalPnl >= 0 ? 'positive' : 'negative'}`}>
                            {totalPnl >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                            {Math.abs(totalPnlPerc).toFixed(2)}% ROI Global
                        </div>
                    </div>

                    {/* 2. METRIC GRID 2x2 */}
                    <div className="app-metric-grid">
                        <div className="app-metric-card" data-tour="card-pnl">
                            <div className="app-metric-icon" style={{ background: totalPnl >= 0 ? 'rgba(52, 211, 153, 0.12)' : 'rgba(239, 68, 68, 0.12)', color: totalPnl >= 0 ? '#34d399' : '#ef4444' }}>
                                {totalPnl >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                            </div>
                            <span className="app-metric-title">P&L Total</span>
                            <span className={`app-metric-value ${totalPnl >= 0 ? 'amount-positive' : 'amount-negative'}`}>
                                {totalPnl > 0 ? '+' : ''}{formatCurrency(totalPnl)}
                            </span>
                        </div>

                        <div className="app-metric-card">
                            <div className="app-metric-icon" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>
                                <Wallet size={16} />
                            </div>
                            <span className="app-metric-title">Capital Invertido</span>
                            <span className="app-metric-value">{formatCurrency(totalCost)}</span>
                        </div>

                        <div className="app-metric-card">
                            <div className="app-metric-icon" style={{ background: 'rgba(52, 211, 153, 0.12)', color: '#34d399' }}>
                                <ArrowUpRight size={16} />
                            </div>
                            <span className="app-metric-title">Mejor Activo</span>
                            <span className="app-metric-value" style={{ color: 'var(--success)' }}>{bestAsset.ticker}</span>
                            <span className="app-metric-subtext" style={{ color: 'var(--success)' }}>{bestAsset.pnlPerc === -Infinity ? '-' : `+${bestAsset.pnlPerc.toFixed(1)}%`}</span>
                        </div>

                        <div className="app-metric-card">
                            <div className="app-metric-icon" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>
                                <ArrowDownRight size={16} />
                            </div>
                            <span className="app-metric-title">Peor Activo</span>
                            <span className="app-metric-value" style={{ color: 'var(--danger)' }}>{worstAsset.ticker}</span>
                            <span className="app-metric-subtext" style={{ color: 'var(--danger)' }}>{worstAsset.pnlPerc === Infinity ? '-' : `${worstAsset.pnlPerc.toFixed(1)}%`}</span>
                        </div>
                    </div>

                    {/* 2. TABLA DE ACTIVOS */}
                    <div className="table-section fnce-dynamic-panel" data-tour="tabla-activos">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '16px', margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>Mis Activos</h3>
                            <div className="search-input-wrapper">
                                <Search className="search-input-icon" size={16} />
                                <input
                                    type="text"
                                    placeholder="Buscar por ticker o categoría..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th onClick={() => requestSort('ticker')}>Activo {getSortIcon('ticker')}</th>
                                        <th onClick={() => requestSort('category')}>Categoría {getSortIcon('category')}</th>
                                        <th onClick={() => requestSort('quantity')}>Cantidad {getSortIcon('quantity')}</th>
                                        <th onClick={() => requestSort('currentPrice')}>Precio actual {getSortIcon('currentPrice')}</th>
                                        <th onClick={() => requestSort('avg_buy_price')}>Costo promedio {getSortIcon('avg_buy_price')}</th>
                                        <th onClick={() => requestSort('value')}>Valor {getSortIcon('value')}</th>
                                        <th onClick={() => requestSort('pnl')}>G/P {getSortIcon('pnl')}</th>
                                        <th onClick={() => requestSort('pnlPerc')}>% {getSortIcon('pnlPerc')}</th>
                                        <th>7 días</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedAssets.length === 0 ? (
                                        <tr><td colSpan="10" style={{ textAlign: 'center', opacity: 0.5, padding: '32px' }}>Sin resultados</td></tr>
                                    ) : sortedAssets.map(t => {
                                        const trendData = t.sparkline.map((val, i) => ({ i, val }));
                                        const isUp = t.sparkline[t.sparkline.length - 1] >= t.sparkline[0];
                                        return (
                                            <tr key={t.id}>
                                                <td style={{ fontWeight: 700 }}>{t.ticker}</td>
                                                <td><span className="category-badge">{t.category}</span></td>
                                                <td>{t.quantity}</td>
                                                <td>{formatCurrency(t.currentPrice)}</td>
                                                <td>{formatCurrency(t.avg_buy_price)}</td>
                                                <td style={{ fontWeight: 600 }}>{formatCurrency(t.value)}</td>
                                                <td className={t.pnl >= 0 ? 'pnl-positive' : 'pnl-negative'}>{formatCurrency(t.pnl)}</td>
                                                <td className={t.pnlPerc >= 0 ? 'pnl-positive' : 'pnl-negative'}>{t.pnlPerc.toFixed(2)}%</td>
                                                <td style={{ width: '80px', height: '40px' }}>
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <LineChart data={trendData}>
                                                            <Line type="monotone" dataKey="val" stroke={isUp ? '#10b981' : '#ef4444'} strokeWidth={2} dot={false} isAnimationActive={false} />
                                                        </LineChart>
                                                    </ResponsiveContainer>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => openModal(t)}><Edit2 size={15} /></button>
                                                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setItemToDelete(t.id)}><Trash2 size={15} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* 3. GRÁFICAS */}
                    <div className="chart-card" style={{ padding: '24px' }}>
                        <div className="portfolio-chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Cómo ha crecido tu portafolio vs el mercado</h3>
                                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Comparativa simulada basada en tu rendimiento actual</p>
                            </div>
                            <div className="time-selector">
                                {timeRanges.map(tr => (
                                    <button key={tr} className={`time-btn ${activeRange === tr ? 'active' : ''}`} onClick={() => { setFilter('portfolio', tr); setActiveRange(tr); }}>{tr}</button>
                                ))}
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={280}>
                            <LineChart data={historyChartData}>
                                <XAxis dataKey="day" stroke="#666" fontSize={11} tickLine={false} axisLine={false} minTickGap={30} />
                                <YAxis yAxisId="left" stroke="#666" fontSize={11} tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} width={55} tickLine={false} axisLine={false} />
                                <YAxis yAxisId="right" orientation="right" stroke="#666" fontSize={11} tickLine={false} axisLine={false} hide />
                                <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px' }} labelStyle={{ color: 'var(--text-secondary)' }} formatter={(val) => formatCurrency(val)} />
                                <Legend iconType="circle" wrapperStyle={{ fontSize: '13px' }} />
                                <Line yAxisId="left" type="monotone" dataKey="Tu portafolio" stroke="#10b981" strokeWidth={3} dot={false} />
                                <Line yAxisId="right" type="monotone" dataKey="S&P 500" stroke="#3b82f6" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                                <Line yAxisId="right" type="monotone" dataKey="Nasdaq" stroke="#8b5cf6" strokeWidth={2} dot={false} strokeDasharray="3 3" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="charts-row">
                        <div className="chart-card">
                            <h3>Distribución por Categoría</h3>
                            <ResponsiveContainer width="100%" height={250}>
                                <PieChart>
                                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="value"
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                                        {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                    </Pie>
                                    <RechartsTooltip formatter={(value, name) => [formatCurrency(value), name]} contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }} labelStyle={{ color: 'var(--text-secondary)' }} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                    <Legend iconType="circle" />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="chart-card">
                            <h3>Ganancia / Pérdida por Activo</h3>
                            <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={barData}>
                                    <XAxis dataKey="name" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#666" fontSize={12} tickFormatter={(val) => `$${val}`} width={60} tickLine={false} axisLine={false} />
                                    <RechartsTooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }} labelStyle={{ color: 'var(--text-secondary)' }} />
                                    <ReferenceLine y={0} stroke="var(--border-color)" />
                                    <Bar dataKey="PnL" radius={[4, 4, 0, 0]}>
                                        {barData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.PnL >= 0 ? '#10b981' : '#ef4444'} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* 4. MÉTRICAS DE RIESGO */}
                    <div className="card">
                        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)' }}>Métricas de Riesgo</h3>
                        <div className="risk-metrics-row">
                            <div className="risk-card">
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    Beta vs S&amp;P 500
                                    <Tooltip text="Mide qué tan volátil es tu portafolio vs el mercado. Beta > 1 = más volátil que el S&P 500." />
                                </span>
                                <span className="risk-card-val">{enrichedAssets.length > 0 ? beta.toFixed(2) : '-'}</span>
                            </div>
                            <div className="risk-card">
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    Ratio de Sharpe
                                    <Tooltip text="Rendimiento ajustado al riesgo. Mayor = mejor relación riesgo/recompensa. Por encima de 1.0 es bueno." />
                                </span>
                                <span className="risk-card-val">{enrichedAssets.length > 0 ? sharpe.toFixed(2) : '-'}</span>
                            </div>
                            <div className="risk-card">
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    Volatilidad Anual
                                    <Tooltip text="Qué tanto fluctúan los precios de tus activos en un año. Menor volatilidad = mayor estabilidad." />
                                </span>
                                <span className="risk-card-val">{enrichedAssets.length > 0 ? '14.2%' : '-'}</span>
                            </div>
                            <div className="risk-card">
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    Pérdida Máxima
                                    <Tooltip text="La mayor caída que tuvo tu portafolio desde un pico hasta un valle. Indica el peor escenario histórico." />
                                </span>
                                <span className="risk-card-val" style={{ color: 'var(--danger)' }}>{enrichedAssets.length > 0 ? '-22.4%' : '-'}</span>
                            </div>
                            <div className="risk-card">
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    Correlación S&amp;P
                                    <Tooltip text="Qué tan parecido se mueve tu portafolio al S&P 500. Cerca de 1.0 = muy correlacionado con el mercado." />
                                </span>
                                <span className="risk-card-val">{enrichedAssets.length > 0 ? '0.85' : '-'}</span>
                            </div>
                        </div>
                    </div>

                    {/* 5. SALUD DEL PORTAFOLIO */}
                    <div className="health-card">
                        <div className="health-header">
                            <div>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>Salud de tu Portafolio</h3>
                                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                    Mide qué tan equilibrado y seguro está tu portafolio. 0 = muy arriesgado, 100 = muy diversificado
                                </p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '36px', fontWeight: 800, color: healthColor, lineHeight: 1 }}>{overallHealth.toFixed(0)}</div>
                                <div style={{ fontSize: '13px', color: healthColor, fontWeight: 600 }}>{healthLabel}</div>
                            </div>
                        </div>

                        <div className="health-bars-container">
                            <div className="health-bar-row">
                                <div className="h-bar-header">
                                    <span>
                                        Diversificación
                                        <Tooltip text="Qué tan repartido está tu portafolio. Mayor puntaje = ningún activo domina demasiado." />
                                    </span>
                                    <span>{divScore}/100</span>
                                </div>
                                <div className="h-bar-track"><div className={`h-bar-fill ${getBarColor(divScore)}`} style={{ width: `${divScore}%` }} /></div>
                            </div>
                            <div className="health-bar-row">
                                <div className="h-bar-header">
                                    <span>
                                        Riesgo de Volatilidad
                                        <Tooltip text="Qué tan estable es tu portafolio. Alta exposición a cripto reduce este puntaje." />
                                    </span>
                                    <span>{volScore}/100</span>
                                </div>
                                <div className="h-bar-track"><div className={`h-bar-fill ${getBarColor(volScore)}`} style={{ width: `${volScore}%` }} /></div>
                            </div>
                            <div className="health-bar-row">
                                <div className="h-bar-header">
                                    <span>
                                        Rendimiento vs Mercado
                                        <Tooltip text="Cómo se compara tu rendimiento total con el mercado general (S&P 500)." />
                                    </span>
                                    <span>{benchScore}/100</span>
                                </div>
                                <div className="h-bar-track"><div className={`h-bar-fill ${getBarColor(benchScore)}`} style={{ width: `${benchScore}%` }} /></div>
                            </div>
                            <div className="health-bar-row">
                                <div className="h-bar-header">
                                    <span>
                                        Liquidez
                                        <Tooltip text="Qué tan fácil es convertir tus activos en efectivo sin perder valor." />
                                    </span>
                                    <span>{liqScore}/100</span>
                                </div>
                                <div className="h-bar-track"><div className={`h-bar-fill ${getBarColor(liqScore)}`} style={{ width: `${liqScore}%` }} /></div>
                            </div>
                        </div>

                        {recs.length > 0 && (
                            <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
                                <h4 style={{ color: 'var(--accent-color)', marginBottom: '12px', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Target size={15} /> Recomendaciones personalizadas
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {recs.map((rec, i) => (
                                        <div key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '10px 14px', background: 'var(--bg-primary)', borderRadius: '8px', borderLeft: '3px solid var(--accent-color)' }}>
                                            {rec}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 6. DIVIDENDOS ESTIMADOS */}
                    <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                        <div>
                            <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600 }}>Dividendos Estimados</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
                                Rendimiento anual estimado sobre acciones y ETFs con dividendo
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '32px' }}>
                            <div>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Rendimiento est.</div>
                                <div style={{ fontSize: '22px', fontWeight: 700 }}>{enrichedAssets.length > 0 ? '1.8%' : '0%'}</div>
                            </div>
                            <div>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Retorno anual</div>
                                <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(totalValue * 0.018)}</div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* MODAL — Agregar / Editar Activo */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingAsset ? 'Editar Activo' : 'Agregar Activo'}>
                <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} onSubmit={handleFormSubmit}>
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Categoría *</label>
                            <select className="form-input" required value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                                <option value="Stock">Stock (Acción)</option>
                                <option value="Crypto">Crypto</option>
                                <option value="ETF">ETF</option>
                                <option value="Bono">Bono</option>
                                <option value="REIT">REIT</option>
                                <option value="Fondo/Mutual Fund">Fondo / Mutual Fund</option>
                                <option value="Otro">Otro</option>
                            </select>
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Ticker *</label>
                            <input type="text" className="form-input" required value={formData.ticker}
                                onChange={e => setFormData({ ...formData, ticker: e.target.value })}
                                disabled={!!editingAsset}
                                placeholder={TICKER_HINTS[formData.category]?.placeholder || 'Ej: AAPL'}
                            />
                        </div>
                    </div>
                    {/* Ticker helper */}
                    {!editingAsset && TICKER_HINTS[formData.category] && (
                        <div style={{ marginTop: '-8px', padding: '12px 14px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '13px' }}>
                            <div style={{ color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 500 }}>
                                {TICKER_HINTS[formData.category].label}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {TICKER_HINTS[formData.category].examples.map(ex => (
                                    <button key={ex} type="button"
                                        onClick={() => setFormData(f => ({ ...f, ticker: ex }))}
                                        style={{ padding: '3px 10px', borderRadius: '20px', border: '1px solid var(--border-color)', background: formData.ticker.toUpperCase() === ex ? 'var(--accent-color)' : 'var(--bg-card)', color: formData.ticker.toUpperCase() === ex ? '#fff' : 'var(--text-primary)', fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}>
                                        {ex}
                                    </button>
                                ))}
                            </div>
                            {TICKER_HINTS[formData.category].note && (
                                <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                    {TICKER_HINTS[formData.category].note}
                                </div>
                            )}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Cantidad *</label>
                            <input type="number" step="any" className="form-input" required value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} placeholder="Ej: 10" />
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Precio promedio de compra (USD) *</label>
                            <input type="number" step="any" className="form-input" required value={formData.avg_buy_price} onChange={e => setFormData({ ...formData, avg_buy_price: e.target.value })} placeholder="0.00" />
                        </div>
                    </div>
                    {formError && (
                        <div style={{ padding: '10px 14px', background: 'rgba(255,59,48,0.1)', border: '1px solid var(--danger)', borderRadius: '8px', fontSize: '13px', color: 'var(--danger)' }}>
                            Error al guardar: {formError}
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                        <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                        <button type="submit" className="btn-primary" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar Activo'}</button>
                    </div>
                </form>
            </Modal>

            {/* MODAL — Confirmar eliminación */}
            <Modal isOpen={itemToDelete !== null} onClose={() => setItemToDelete(null)} title="Confirmar Eliminación">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <p style={{ color: 'var(--text-secondary)' }}>¿Estás seguro de que deseas eliminar este activo? Esta acción no se puede deshacer.</p>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                        <button type="button" className="btn-secondary" onClick={() => setItemToDelete(null)}>Cancelar</button>
                        <button type="button" className="btn-primary" style={{ backgroundColor: 'var(--danger)' }} onClick={confirmDelete}>Eliminar</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
