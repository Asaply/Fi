'use client';
import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/lib/supabaseClient';
import { formatUSD } from '@/lib/formatCurrency';
import { API_BASE } from '@/lib/apiBase';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

async function fetchPrices(assets) {
    const prices = {};
    await Promise.all(assets.map(async (asset) => {
        const cat = asset.category?.toLowerCase();
        let endpoint = '';
        if (cat === 'crypto') endpoint = `${API_BASE}/api/crypto?ticker=${asset.ticker}&range=7d`;
        else if (['stock', 'etf', 'bono', 'bond', 'reit', 'fondo/mutual fund', 'otro'].includes(cat))
            endpoint = `${API_BASE}/api/price?ticker=${asset.ticker}&range=7d`;
        if (!endpoint) return;
        try {
            const res = await fetch(endpoint);
            if (res.ok) {
                const data = await res.json();
                if (data.price) prices[asset.ticker.toUpperCase()] = parseFloat(data.price);
            }
        } catch (_) {}
    }));
    return prices;
}

export default function CardPortfolio() {
    const [loading, setLoading] = useState(true);
    const [portfolio, setPortfolio] = useState({ totalValue: 0, totalCost: 0, byCategory: [], topAssets: [] });

    useEffect(() => {
        const load = async () => {
            try {
            const { data: assets } = await supabase.from('portfolio_assets').select('*');
            if (!assets || assets.length === 0) { setLoading(false); return; }

            const prices = await fetchPrices(assets);

            let totalValue = 0, totalCost = 0;
            const catMap = {};

            const enriched = assets.map(a => {
                const currentPrice = prices[a.ticker.toUpperCase()] ?? a.avg_buy_price;
                const cost = a.quantity * a.avg_buy_price;
                const value = a.quantity * currentPrice;
                totalValue += value;
                totalCost += cost;
                const cat = a.category || 'Otro';
                catMap[cat] = (catMap[cat] || 0) + value;
                return { ...a, value, pnl: value - cost };
            });

            const byCategory = Object.entries(catMap)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value);

            const topAssets = [...enriched]
                .sort((a, b) => b.value - a.value)
                .slice(0, 3);

            setPortfolio({ totalValue, totalCost, byCategory, topAssets });
            } catch (_) {}
            setLoading(false);
        };
        load();
    }, []);

    const { totalValue, totalCost, byCategory, topAssets } = portfolio;
    const totalPnL = totalValue - totalCost;
    const totalPnLPerc = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                Resumen Portfolio Health
            </h2>

            {loading ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Cargando...</p>
            ) : (
                <div className="portfolio-summary-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', alignItems: 'start' }}>

                    {/* Totals */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Valor total</p>
                            <p style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>{formatUSD(totalValue)}</p>
                        </div>
                        <div>
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>P&L Total</p>
                            <p style={{ fontSize: '18px', fontWeight: 700, color: totalPnL >= 0 ? 'var(--success)' : 'var(--danger)', margin: 0 }}>
                                {totalPnL >= 0 ? '+' : ''}{formatUSD(totalPnL)}
                            </p>
                            <p style={{ fontSize: '13px', color: totalPnLPerc >= 0 ? 'var(--success)' : 'var(--danger)', margin: 0 }}>
                                {totalPnLPerc >= 0 ? '+' : ''}{totalPnLPerc.toFixed(2)}%
                            </p>
                        </div>
                    </div>

                    {/* Donut */}
                    <div className="portfolio-donut-wrapper">
                        <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Por categoría</p>
                        {byCategory.length > 0 ? (
                            <ResponsiveContainer width="100%" height={140}>
                                <PieChart>
                                    <Pie data={byCategory} dataKey="value" nameKey="name" cx="50%" cy="50%"
                                        innerRadius={38} outerRadius={62} paddingAngle={2}>
                                        {byCategory.map((_, i) => (
                                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(v) => formatUSD(v)}
                                        contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '12px' }}
                                        labelStyle={{ color: 'var(--text-secondary)' }}
                                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Sin activos</p>
                        )}
                    </div>

                    {/* Top 3 */}
                    <div className="top-activos-list">
                        <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '10px' }}>Top 3 activos</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {topAssets.length === 0 ? (
                                <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Sin datos</p>
                            ) : topAssets.map((a, i) => (
                                <div key={a.id} className="top-activo-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{
                                            width: '20px', height: '20px', borderRadius: '50%',
                                            background: COLORS[i % COLORS.length], display: 'inline-flex',
                                            alignItems: 'center', justifyContent: 'center',
                                            fontSize: '10px', fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0
                                        }}>{i + 1}</span>
                                        <div>
                                            <p className="top-activo-nombre" style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>{a.ticker.toUpperCase()}</p>
                                            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>{a.category}</p>
                                        </div>
                                    </div>
                                    <p className="top-activo-monto" style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>{formatUSD(a.value)}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
}
