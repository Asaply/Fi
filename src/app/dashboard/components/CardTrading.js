'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { formatMXN } from '@/lib/formatCurrency';

export default function CardTrading({ fechaInicio }) {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ totalPnL: 0, winRate: 0, wins: 0, losses: 0, periodCount: 0, bestTrade: null });

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
            const from = fechaInicio || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

            const { data } = await supabase
                .from('trading_operations')
                .select('date, asset, status, pnl')
                .gte('date', from);

            const rows = data || [];
            const closed = rows.filter(t => t.status === 'Cerrado');
            const totalPnL = closed.reduce((s, t) => s + (Number(t.pnl) || 0), 0);
            const wins = closed.filter(t => Number(t.pnl) > 0);
            const losses = closed.filter(t => Number(t.pnl) < 0);
            const winRate = closed.length > 0 ? ((wins.length / closed.length) * 100).toFixed(1) : 0;

            const bestTrade = wins.length > 0
                ? wins.reduce((best, t) => Number(t.pnl) > Number(best.pnl) ? t : best)
                : null;

            setStats({ totalPnL, winRate, wins: wins.length, losses: losses.length, periodCount: rows.length, bestTrade });
            } catch (_) {}
            setLoading(false);
        };
        load();
    }, [fechaInicio]);

    const { totalPnL, winRate, wins, losses, periodCount, bestTrade } = stats;
    const winRateNum = Number(winRate);
    const winRateColor = winRateNum >= 60 ? 'var(--success)' : winRateNum >= 40 ? '#f59e0b' : 'var(--danger)';

    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2 style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 }}>
                Resumen Trading
            </h2>

            {loading ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Cargando...</p>
            ) : (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>P&L Total</p>
                            <p style={{ fontSize: '22px', fontWeight: 700, color: totalPnL >= 0 ? 'var(--success)' : 'var(--danger)', margin: 0 }}>
                                {totalPnL >= 0 ? '+' : ''}{formatMXN(totalPnL)}
                            </p>
                        </div>
                        <div>
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Win Rate</p>
                            <p style={{ fontSize: '22px', fontWeight: 700, color: winRateColor, margin: 0 }}>{winRate}%</p>
                            <div style={{ display: 'flex', gap: '8px', fontSize: '12px', marginTop: '4px' }}>
                                <span style={{ color: 'var(--success)' }}>W: {wins}</span>
                                <span style={{ color: 'var(--danger)' }}>L: {losses}</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
                        <div>
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Trades en período</p>
                            <p style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>{periodCount}</p>
                        </div>
                        <div>
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Mejor trade</p>
                            {bestTrade ? (
                                <>
                                    <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--success)', margin: 0 }}>+{formatMXN(Number(bestTrade.pnl))}</p>
                                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>{bestTrade.asset}</p>
                                </>
                            ) : (
                                <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', margin: 0 }}>—</p>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
