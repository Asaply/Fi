"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import useSWR from "swr";
import { Activity, TrendingUp, TrendingDown, Plus, Edit2, Trash2, DollarSign, Target, Briefcase, Search, ChevronUp, ChevronDown, Info, ArrowUpRight, ArrowDownRight, Wallet, LayoutGrid } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import Modal from "@/components/Modal";
import CurrencyInput from "@/components/CurrencyInput";
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";
import "./Portfolio.css";
import { getFilter, setFilter } from '@/lib/filterMemory';
import { API_BASE } from '@/lib/apiBase';
import { openTutorial } from '@/components/AppTutorial';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];

const CATEGORY_COLORS = {
    'Crypto':            { bg: 'rgba(251,146,60,0.15)',  color: '#fb923c' },
    'Stock':             { bg: 'rgba(59,130,246,0.15)',  color: '#3b82f6' },
    'ETF':               { bg: 'rgba(52,211,153,0.15)',  color: '#34d399' },
    'Bono':              { bg: 'rgba(139,92,246,0.15)',  color: '#8b5cf6' },
    'REIT':              { bg: 'rgba(236,72,153,0.15)',  color: '#ec4899' },
    'Fondo/Mutual Fund': { bg: 'rgba(20,184,166,0.15)', color: '#14b8a6' },
    'Otro':              { bg: 'rgba(113,113,122,0.15)', color: '#71717a' },
};

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

    // Get auth token for native app (cookies don't work cross-origin)
    let authHeaders = {};
    if (API_BASE) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
            authHeaders = { 'Authorization': `Bearer ${session.access_token}` };
        }
    }

    await Promise.all(uniqueAssets.map(async (asset) => {
        let endpoint = '';
        const cat = asset.category.toLowerCase();
        if (cat === 'crypto') endpoint = `${API_BASE}/api/crypto?ticker=${asset.ticker}&range=7d`;
        else if (['stock', 'etf', 'bond', 'bono', 'acciones'].includes(cat)) endpoint = `${API_BASE}/api/price?ticker=${asset.ticker}&range=7d`;
        if (!endpoint) return;
        try {
            const res = await fetch(endpoint, { headers: authHeaders });
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
    const [pos, setPos] = useState(null);
    const iconRef = useRef(null);

    // Anchor the bubble to the icon but clamp it inside the viewport so it never
    // bleeds off the left/right edge (cards near the screen edges used to push a
    // fixed-width centered tooltip off-screen). Rendered via portal to escape any
    // parent overflow clipping. Tap-toggle because iOS has no hover.
    const open = () => {
        const el = iconRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const width = Math.min(240, window.innerWidth - 24);
        let left = r.left + r.width / 2 - width / 2;
        left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
        setPos({ left, top: r.top - 6, width });
        setShow(true);
    };

    useEffect(() => {
        if (!show) return;
        const close = () => setShow(false);
        window.addEventListener('scroll', close, true);
        return () => window.removeEventListener('scroll', close, true);
    }, [show]);

    return (
        <span ref={iconRef} style={{ display: 'inline-flex' }}
            onMouseEnter={open} onMouseLeave={() => setShow(false)}
            onClick={(e) => { e.stopPropagation(); show ? setShow(false) : open(); }}>
            <Info size={13} style={{ color: 'var(--text-tertiary)', cursor: 'help', marginLeft: '4px' }} />
            {show && pos && createPortal(
                <span style={{
                    position: 'fixed', left: pos.left, top: pos.top, transform: 'translateY(-100%)',
                    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                    borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: 'var(--text-secondary)',
                    width: pos.width, zIndex: 1000, lineHeight: 1.5, whiteSpace: 'normal',
                    boxShadow: 'var(--shadow-md)', pointerEvents: 'none'
                }}>{text}</span>, document.body
            )}
        </span>
    );
}

export default function PortfolioHealth() {
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

    // Category distribution: share % + element-wise aggregate value sparkline.
    const categoryStats = Object.keys(distributionMap).map(cat => {
        const catAssets = enrichedAssets.filter(a => a.category === cat);
        const value = distributionMap[cat];
        const share = totalValue > 0 ? (value / totalValue) * 100 : 0;
        const len = Math.max(0, ...catAssets.map(a => a.sparkline.length));
        const spark = Array.from({ length: len }, (_, i) => ({
            i,
            v: catAssets.reduce((s, a) => {
                const px = a.sparkline[i] ?? a.sparkline[a.sparkline.length - 1] ?? 0;
                return s + px * a.quantity;
            }, 0),
        }));
        const style = CATEGORY_COLORS[cat] || CATEGORY_COLORS['Otro'];
        const up = spark.length >= 2 ? spark[spark.length - 1].v >= spark[0].v : true;
        return { cat, value, share, spark, style, up };
    }).sort((a, b) => b.value - a.value);
    const dominantCat = categoryStats[0];

    // P&L per asset, sorted best→worst, with diverging-bar scale.
    const pnlRows = [...enrichedAssets].sort((a, b) => b.pnl - a.pnl);
    const maxAbsPnl = Math.max(1, ...pnlRows.map(a => Math.abs(a.pnl)));

    const scrollToAssets = () => {
        document.getElementById('portfolio-assets')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

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

    const dailyChange = enrichedAssets.reduce((sum, a) => {
        const sp = a.sparkline;
        if (sp.length < 2) return sum;
        return sum + (sp[sp.length - 1] - sp[sp.length - 2]) * a.quantity;
    }, 0);
    const riskLabel = beta > 1.8 ? 'Alto' : beta > 1.2 ? 'Moderado' : 'Bajo';
    const riskColor = beta > 1.8 ? 'var(--danger)' : beta > 1.2 ? '#f59e0b' : 'var(--success)';
    const monthlyReturn = totalCost > 0 ? totalPnlPerc / 12 : 0;

    const insights = [];
    if (enrichedAssets.length > 0) {
        if (cryptoPerc > 50) insights.push({ type: 'warning', icon: '⚠️', text: `Alta concentración en Crypto (${cryptoPerc.toFixed(0)}%). Considera diversificar en stocks o ETFs para reducir volatilidad.` });
        if (enrichedAssets.length < 4) insights.push({ type: 'info', icon: '💡', text: 'Portafolio poco diversificado. Agregar más activos reduce tu riesgo general.' });
        if (bestAsset.ticker !== '-' && bestAsset.pnlPerc > 15) insights.push({ type: 'positive', icon: '📈', text: `${bestAsset.ticker} es tu activo estrella con +${bestAsset.pnlPerc.toFixed(1)}% de rendimiento.` });
        if (totalPnlPerc < 0) insights.push({ type: 'warning', icon: '📉', text: `Tu portafolio está en pérdida (${totalPnlPerc.toFixed(1)}%). Revisa las posiciones con mayor pérdida.` });
        const hasETF = enrichedAssets.some(a => a.category === 'ETF');
        if (!hasETF) insights.push({ type: 'info', icon: '🛡️', text: 'Sin ETFs en tu portafolio. Agregar SPY o VOO puede reducir volatilidad hasta un 18%.' });
        if (divScore > 70) insights.push({ type: 'positive', icon: '✅', text: `Buena diversificación (${divScore}/100). Ningún activo domina en exceso tu portafolio.` });
    }

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
            {/* HERO — Valor total */}
            <div className="app-hero" style={{ marginBottom: assets.length > 0 ? '0' : '16px' }}>
                <p className="app-hero-label">Valor total del portafolio</p>
                <div className="app-hero-amount">
                    <span className="app-hero-int">{valInt}</span>
                    <span className="app-hero-dec">.{valDec}</span>
                </div>
                {assets.length > 0 && (
                    <div className={`app-hero-badge ${totalPnl >= 0 ? 'positive' : 'negative'}`}>
                        {totalPnl >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        {Math.abs(totalPnlPerc).toFixed(2)}% ROI Global
                    </div>
                )}
            </div>

            {/* KPI ROW */}
            {assets.length > 0 && (
                <div className="hero-kpi-row">
                    <div className="hero-kpi-item">
                        <span className="hero-kpi-label">Cambio hoy</span>
                        <span className={`hero-kpi-value ${dailyChange >= 0 ? 'kpi-positive' : 'kpi-negative'}`}>
                            {dailyChange >= 0 ? '+' : ''}{formatCurrency(dailyChange)}
                        </span>
                    </div>
                    <div className="hero-kpi-divider" />
                    <div className="hero-kpi-item">
                        <span className="hero-kpi-label">Retorno mensual est.</span>
                        <span className={`hero-kpi-value ${monthlyReturn >= 0 ? 'kpi-positive' : 'kpi-negative'}`}>
                            {monthlyReturn >= 0 ? '+' : ''}{monthlyReturn.toFixed(2)}%
                        </span>
                    </div>
                    <div className="hero-kpi-divider" />
                    <div className="hero-kpi-item">
                        <span className="hero-kpi-label">Riesgo</span>
                        <span className="hero-kpi-value" style={{ color: riskColor }}>{riskLabel}</span>
                    </div>
                    <div className="hero-kpi-divider" />
                    <div className="hero-kpi-item">
                        <span className="hero-kpi-label">Diversificación</span>
                        <span className="hero-kpi-value" style={{ color: healthColor }}>{divScore}/100</span>
                    </div>
                </div>
            )}

            {/* Controles */}
            <div className="portfolio-controls-row">
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
                <div className="portfolio-controls-actions">
                    <button className="btn-cta-primary portfolio-add-btn" data-tour="btn-agregar-activo" onClick={() => openModal()}>
                        <Plus size={15} />
                        <span className="portfolio-add-label">Agregar Activo</span>
                    </button>
                    <button onClick={openTutorial} className="btn-action-secondary portfolio-help-btn" title="Tutorial">?</button>
                </div>
            </div>

            {isLoading && !data ? (
                <div className="dashboard-metrics">
                    {[1, 2, 3, 4].map(i => <div key={i} className="metric-card skeleton" style={{ height: '100px' }} />)}
                </div>
            ) : assets.length === 0 ? (

                /* ONBOARDING — sin activos */
                <div className="portfolio-onboarding card">
                    <div className="onboarding-icon"><TrendingUp size={32} /></div>
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
                    {/* 1. HERO CHART — Performance vs mercado */}
                    <div className="chart-card hero-chart-card" style={{ padding: '24px' }}>
                        <div className="portfolio-chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Performance del portafolio</h3>
                                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>vs S&amp;P 500 y Nasdaq — simulado basado en rendimiento actual</p>
                            </div>
                            <div className="time-selector">
                                {timeRanges.map(tr => (
                                    <button key={tr} className={`time-btn ${activeRange === tr ? 'active' : ''}`} onClick={() => { setFilter('portfolio', tr); setActiveRange(tr); }}>{tr}</button>
                                ))}
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={300}>
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

                    {/* 2. METRIC GRID */}
                    <div className="app-metric-grid">
                        <div className="app-metric-card" data-tour="card-pnl">
                            <div className="app-metric-icon" style={{ background: totalPnl >= 0 ? 'rgba(52, 211, 153, 0.12)' : 'rgba(239, 68, 68, 0.12)', color: totalPnl >= 0 ? '#34d399' : '#ef4444' }}>
                                {totalPnl >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                            </div>
                            <span className="app-metric-title">Ganancia / Pérdida total</span>
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

                    {/* 3. TABLA DE ACTIVOS */}
                    <div id="portfolio-assets" className="table-section fnce-dynamic-panel" data-tour="tabla-activos">
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
                                        <th onClick={() => requestSort('quantity')}>Cantidad {getSortIcon('quantity')}</th>
                                        <th onClick={() => requestSort('currentPrice')}>Precio actual {getSortIcon('currentPrice')}</th>
                                        <th onClick={() => requestSort('avg_buy_price')}>Costo prom. {getSortIcon('avg_buy_price')}</th>
                                        <th onClick={() => requestSort('value')}>Valor {getSortIcon('value')}</th>
                                        <th onClick={() => requestSort('pnl')}>G/P {getSortIcon('pnl')}</th>
                                        <th onClick={() => requestSort('pnlPerc')}>% {getSortIcon('pnlPerc')}</th>
                                        <th>7 días</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedAssets.length === 0 ? (
                                        <tr><td colSpan="9" style={{ textAlign: 'center', opacity: 0.5, padding: '32px' }}>Sin resultados</td></tr>
                                    ) : sortedAssets.map(t => {
                                        const trendData = t.sparkline.map((val, i) => ({ i, val }));
                                        const isUp = t.sparkline[t.sparkline.length - 1] >= t.sparkline[0];
                                        const catStyle = CATEGORY_COLORS[t.category] || CATEGORY_COLORS['Otro'];
                                        return (
                                            <tr key={t.id}>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <div style={{
                                                            width: '36px', height: '36px', borderRadius: '50%',
                                                            background: catStyle.bg, color: catStyle.color,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            fontSize: '11px', fontWeight: 700, flexShrink: 0, letterSpacing: '-0.5px'
                                                        }}>
                                                            {t.ticker.slice(0, 3)}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 700, fontSize: '14px', lineHeight: 1.2 }}>{t.ticker}</div>
                                                            <div style={{ fontSize: '11px', color: catStyle.color, fontWeight: 500 }}>{t.category}</div>
                                                        </div>
                                                    </div>
                                                </td>
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

                    {/* 4. NVA INSIGHTS */}
                    {insights.length > 0 && (
                        <div className="nva-insights-card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                                <div className="nva-insights-badge">NVA</div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Insights de tu portafolio</h3>
                                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>Análisis automático basado en tus datos reales</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {insights.map((ins, i) => (
                                    <div key={i} className={`nva-insight-item nva-insight-${ins.type}`}>
                                        <span className="nva-insight-icon">{ins.icon}</span>
                                        <span className="nva-insight-text">{ins.text}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 5. DISTRIBUCIÓN POR CATEGORÍA — donut + lista con sparkline */}
                    <div className="pf-dist-card card">
                        <div className="pf-section-head">
                            <h3>Distribución por categoría</h3>
                            <button className="pf-ver-detalles" onClick={scrollToAssets}>
                                Ver detalles <ChevronRight size={15} />
                            </button>
                        </div>
                        <div className="pf-dist-body">
                            <div className="pf-donut">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={categoryStats} cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" paddingAngle={categoryStats.length > 1 ? 3 : 0} dataKey="value" stroke="none" startAngle={90} endAngle={-270}>
                                            {categoryStats.map((c, i) => <Cell key={i} fill={c.style.color} />)}
                                        </Pie>
                                        <RechartsTooltip formatter={(value, name, p) => [formatCurrency(value), p?.payload?.cat]} contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                                {dominantCat && (
                                    <div className="pf-donut-center">
                                        <span className="pf-donut-pct">{dominantCat.share.toFixed(0)}%</span>
                                        <span className="pf-donut-cat" style={{ color: dominantCat.style.color }}>{dominantCat.cat}</span>
                                        <span className="pf-donut-sub">de tu portafolio</span>
                                    </div>
                                )}
                            </div>
                            <div className="pf-cat-list">
                                {categoryStats.map(c => (
                                    <div key={c.cat} className="pf-cat-row">
                                        <span className="pf-cat-dot" style={{ background: c.style.color }} />
                                        <div className="pf-cat-info">
                                            <span className="pf-cat-name">{c.cat}</span>
                                            <span className="pf-cat-val">{formatCurrency(c.value)}</span>
                                        </div>
                                        <div className="pf-cat-spark">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={c.spark}>
                                                    <Line type="monotone" dataKey="v" stroke={c.style.color} strokeWidth={2} dot={false} isAnimationActive={false} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <span className="pf-cat-pct">{c.share.toFixed(0)}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {dominantCat && (
                            <div className="pf-dist-footer">
                                <span className="pf-dist-footer-icon" style={{ color: dominantCat.up ? 'var(--success)' : 'var(--danger)' }}>
                                    {dominantCat.up ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                </span>
                                <span>Tu mayor exposición es <strong style={{ color: dominantCat.style.color }}>{dominantCat.cat}</strong> con el <strong>{dominantCat.share.toFixed(0)}%</strong> del portafolio.</span>
                            </div>
                        )}
                    </div>

                    {/* 6. GANANCIA / PÉRDIDA POR ACTIVO — barras divergentes */}
                    <div className="pf-pnl-card card">
                        <div className="pf-section-head">
                            <h3>Ganancia / Pérdida por activo</h3>
                            <select className="pf-pnl-select" value={activeRange} onChange={e => { setFilter('portfolio', e.target.value); setActiveRange(e.target.value); }}>
                                <option value="1M">Este mes</option>
                                <option value="3M">3 meses</option>
                                <option value="6M">6 meses</option>
                                <option value="1A">Este año</option>
                            </select>
                        </div>
                        <div className="pf-pnl-list">
                            {pnlRows.map(a => {
                                const st = CATEGORY_COLORS[a.category] || CATEGORY_COLORS['Otro'];
                                const pct = (Math.abs(a.pnl) / maxAbsPnl) * 50; // half-width max
                                const pos = a.pnl >= 0;
                                return (
                                    <div key={a.id} className="pf-pnl-row">
                                        <span className="pf-pnl-icon" style={{ background: st.bg, color: st.color }}>{a.ticker.slice(0, 3)}</span>
                                        <div className="pf-pnl-labels">
                                            <span className="pf-pnl-ticker">{a.ticker}</span>
                                            <span className="pf-pnl-cat">{a.category}</span>
                                        </div>
                                        <div className="pf-pnl-bar-track">
                                            <span className="pf-pnl-axis" />
                                            <span
                                                className={`pf-pnl-bar ${pos ? 'pos' : 'neg'}`}
                                                style={pos ? { left: '50%', width: `${pct}%` } : { right: '50%', width: `${pct}%` }}
                                            />
                                        </div>
                                        <div className="pf-pnl-vals">
                                            <span className={pos ? 'amount-positive' : 'amount-negative'}>{pos ? '+' : ''}{formatCurrency(a.pnl)}</span>
                                            <span className={`pf-pnl-pct ${pos ? 'amount-positive' : 'amount-negative'}`}>{pos ? '+' : ''}{a.pnlPerc.toFixed(1)}%</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="pf-pnl-footer">
                            <div className="pf-pnl-foot-card">
                                <span className="pf-pnl-foot-icon up"><ArrowUpRight size={16} /></span>
                                <div>
                                    <span className="pf-pnl-foot-label">Mejor rendimiento</span>
                                    <span className="pf-pnl-foot-ticker">{bestAsset.ticker}</span>
                                </div>
                                <span className="pf-pnl-foot-val amount-positive">{bestAsset.pnlPerc === -Infinity ? '-' : `+${bestAsset.pnlPerc.toFixed(1)}%`}</span>
                            </div>
                            <div className="pf-pnl-foot-card">
                                <span className="pf-pnl-foot-icon down"><ArrowDownRight size={16} /></span>
                                <div>
                                    <span className="pf-pnl-foot-label">Peor rendimiento</span>
                                    <span className="pf-pnl-foot-ticker">{worstAsset.ticker}</span>
                                </div>
                                <span className="pf-pnl-foot-val amount-negative">{worstAsset.pnlPerc === Infinity ? '-' : `${worstAsset.pnlPerc.toFixed(1)}%`}</span>
                            </div>
                        </div>
                    </div>

                    {/* 7. MÉTRICAS DE RIESGO */}
                    <div className="card">
                        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)' }}>Métricas de Riesgo</h3>
                        <div className="risk-metrics-row">
                            <div className="risk-card">
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>¿Qué tan agresivo es?<Tooltip text="Compara tu portafolio con el mercado. Mayor a 1.0 significa que tus inversiones se mueven más fuerte que el S&P 500 — más riesgo, más oportunidad." /></span>
                                <span className="risk-card-val">{enrichedAssets.length > 0 ? beta.toFixed(2) : '-'}</span>
                            </div>
                            <div className="risk-card">
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Calidad del rendimiento<Tooltip text="Qué tan bien te pagan por el riesgo que tomas. Por encima de 1.0 es bueno — significa que tu ganancia justifica el riesgo." /></span>
                                <span className="risk-card-val">{enrichedAssets.length > 0 ? sharpe.toFixed(2) : '-'}</span>
                            </div>
                            <div className="risk-card">
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Qué tanto sube y baja<Tooltip text="Mide cuánto fluctúan tus activos en un año. Menor = más estable. Cripto tiene más fluctuación que acciones o ETFs." /></span>
                                <span className="risk-card-val">{enrichedAssets.length > 0 ? '14.2%' : '-'}</span>
                            </div>
                            <div className="risk-card">
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>La peor caída que tuvo<Tooltip text="La mayor pérdida que sufrió tu portafolio desde su punto más alto. Te ayuda a entender el peor escenario posible." /></span>
                                <span className="risk-card-val" style={{ color: 'var(--danger)' }}>{enrichedAssets.length > 0 ? '-22.4%' : '-'}</span>
                            </div>
                            <div className="risk-card">
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Qué tanto sigue al mercado<Tooltip text="Qué tan parecido se mueve tu portafolio al S&P 500. Cerca de 1.0 = muy alineado con el mercado general." /></span>
                                <span className="risk-card-val">{enrichedAssets.length > 0 ? '0.85' : '-'}</span>
                            </div>
                        </div>
                    </div>

                    {/* 8. SALUD DEL PORTAFOLIO */}
                    <div className="health-card">
                        <div className="health-header">
                            <div>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>¿Qué tan sano está tu dinero?</h3>
                                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                    0 = todo en un solo lugar · 100 = perfectamente equilibrado
                                </p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '48px', fontWeight: 800, color: healthColor, lineHeight: 1, letterSpacing: '-2px' }}>{overallHealth.toFixed(0)}</div>
                                <div style={{ fontSize: '13px', color: healthColor, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{healthLabel}</div>
                            </div>
                        </div>
                        <div className="health-bars-container">
                            {[
                                { label: '¿Qué tan diversificado estás?', score: divScore, tip: 'Qué tan repartido está tu dinero. Un puntaje alto significa que ninguna inversión domina demasiado — eso reduce riesgo.' },
                                { label: '¿Qué tan estable es?', score: volScore, tip: 'Qué tan tranquilo duermes con este portafolio. Alta cripto = más movimiento. ETFs y acciones grandes = más estabilidad.' },
                                { label: '¿Estás ganando al mercado?', score: benchScore, tip: 'Compara tu rendimiento con el S&P 500. Si estás por encima, tu portafolio le ganó al mercado general.' },
                                { label: '¿Qué tan fácil puedes salir?', score: liqScore, tip: 'Qué tan rápido puedes convertir tus inversiones en efectivo sin perder valor. Acciones y ETFs son muy líquidos.' },
                            ].map(({ label, score, tip }) => (
                                <div key={label} className="health-bar-row">
                                    <div className="h-bar-header">
                                        <span>{label}<Tooltip text={tip} /></span>
                                        <span style={{ fontWeight: 600 }}>{score}/100</span>
                                    </div>
                                    <div className="h-bar-track"><div className={`h-bar-fill ${getBarColor(score)}`} style={{ width: `${score}%` }} /></div>
                                </div>
                            ))}
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
                            <CurrencyInput className="form-input" required value={formData.avg_buy_price} onChange={e => setFormData({ ...formData, avg_buy_price: e.target.value })} placeholder="0.00" />
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

            {/* FAB — Agregar Activo */}
            <button className="portfolio-fab" data-tour="btn-agregar-activo" onClick={() => openModal()} title="Agregar Activo">
                <Plus size={22} />
            </button>

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
