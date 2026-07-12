'use client';
import { useState, useEffect, useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import './ReporteMensual.css';

const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MESES_LARGOS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const formatMXN = (n) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

const formatMXNShort = (n) => {
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
};

// Whole-peso currency for the narrow stat cards (no cents → fits 3-up on mobile
// without truncating). Big amounts collapse to $K/$M so they never overflow.
const formatMXNStat = (n) => {
    if (Math.abs(n) >= 100_000) return formatMXNShort(n);
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
};

// Percent change vs a previous value; null when there's no comparable base.
const pctChange = (cur, prev) => {
    if (!prev || prev === 0) return null;
    return ((cur - prev) / Math.abs(prev)) * 100;
};

export default function ReporteMensual({ startDate, endDate }) {
    const [chartData, setChartData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedIdx, setSelectedIdx] = useState(null);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { setLoading(false); return; }

            const from = startDate || new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1).toISOString().split('T')[0];
            const to = endDate || new Date().toISOString().split('T')[0];

            const [txRes, tradingRes] = await Promise.all([
                supabase
                    .from('transactions')
                    .select('date, amount, type')
                    .eq('user_id', user.id)
                    .in('type', ['Ingreso', 'Egreso', 'ingreso', 'egreso'])
                    .gte('date', from)
                    .lte('date', to),
                supabase
                    .from('trading_operations')
                    .select('date, pnl, status')
                    .eq('user_id', user.id)
                    .eq('status', 'Cerrado')
                    .gte('date', from)
                    .lte('date', to),
            ]);

            const txRows = txRes.data || [];
            const tradingRows = tradingRes.data || [];

            const monthMap = {};
            const ensure = (ym) => {
                if (!monthMap[ym]) monthMap[ym] = { ingresos: 0, egresos: 0 };
                return monthMap[ym];
            };

            for (const t of txRows) {
                const ym = (t.date || '').slice(0, 7);
                if (!ym) continue;
                const m = ensure(ym);
                const tipo = (t.type || '').toLowerCase();
                if (tipo === 'ingreso') m.ingresos += Number(t.amount) || 0;
                if (tipo === 'egreso')  m.egresos  += Number(t.amount) || 0;
            }

            for (const t of tradingRows) {
                const pnl = Number(t.pnl) || 0;
                if (pnl <= 0) continue;
                const ym = (t.date || '').slice(0, 7);
                if (!ym) continue;
                ensure(ym).ingresos += pnl;
            }

            const result = [];
            const cur = new Date(new Date(from).getFullYear(), new Date(from).getMonth(), 1);
            const endD = new Date(new Date(to).getFullYear(), new Date(to).getMonth(), 1);
            while (cur <= endD) {
                const ym = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
                result.push({
                    mes: MESES_CORTOS[cur.getMonth()],
                    mesLargo: MESES_LARGOS[cur.getMonth()],
                    anio: cur.getFullYear(),
                    ingresos: monthMap[ym]?.ingresos || 0,
                    egresos: monthMap[ym]?.egresos || 0,
                });
                cur.setMonth(cur.getMonth() + 1);
            }

            setChartData(result);
            setSelectedIdx(result.length ? result.length - 1 : null);
            } catch (_) {}
            setLoading(false);
        };
        load();
    }, [startDate, endDate]);

    const totals = useMemo(() => {
        const ingresos = chartData.reduce((s, m) => s + m.ingresos, 0);
        const egresos = chartData.reduce((s, m) => s + m.egresos, 0);
        return { ingresos, egresos, balance: ingresos - egresos };
    }, [chartData]);

    if (loading) {
        return (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p className="rm-empty">Cargando...</p>
            </div>
        );
    }
    if (!chartData.length) {
        return (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h2 className="rm-eyebrow">Reporte Mensual</h2>
                <p className="rm-empty">Sin datos en este período</p>
            </div>
        );
    }

    // selectedIdx can be a month index or the string 'all' (global view).
    const isAll = selectedIdx === 'all';
    const idx = isAll ? chartData.length - 1 : (selectedIdx ?? chartData.length - 1);

    // In 'all' mode the "selected" figures are the whole-period aggregates.
    const sel = isAll
        ? { ingresos: totals.ingresos, egresos: totals.egresos, mesLargo: 'todo el periodo' }
        : (chartData[idx] || chartData[chartData.length - 1]);
    const prev = !isAll && idx > 0 ? chartData[idx - 1] : null;
    const selBalance = sel.ingresos - sel.egresos;

    const balPct = prev ? pctChange(selBalance, prev.ingresos - prev.egresos) : null;
    const ingPct = prev ? pctChange(sel.ingresos, prev.ingresos) : null;
    const egrPct = prev ? pctChange(sel.egresos, prev.egresos) : null;
    const prevLabel = prev ? `${prev.mes.toLowerCase()} ${prev.anio}` : '';

    const heroInt = Math.trunc(Math.abs(selBalance)).toLocaleString('es-MX');
    const heroDec = (Math.abs(selBalance) % 1).toFixed(2).slice(1);

    const Badge = ({ pct, cls = 'rm-hero-badge' }) => {
        if (pct === null) return null;
        const up = pct >= 0;
        return (
            <div className={`${cls} ${up ? 'up' : 'down'}`}>
                {up ? <ArrowUpRight size={cls === 'rm-hero-badge' ? 15 : 12} /> : <ArrowDownRight size={cls === 'rm-hero-badge' ? 15 : 12} />}
                {Math.abs(pct).toFixed(0)}% <span>vs {prevLabel}</span>
            </div>
        );
    };

    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Header: eyebrow + month selector */}
            <div className="rm-head">
                <h2 className="rm-eyebrow">Reporte Mensual</h2>
                <select
                    className="rm-select"
                    value={isAll ? 'all' : idx}
                    onChange={(e) => setSelectedIdx(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                    aria-label="Seleccionar periodo"
                >
                    <option value="all">Todo</option>
                    {chartData.map((m, i) => (
                        <option key={i} value={i}>{m.mesLargo} {m.anio}</option>
                    ))}
                </select>
            </div>

            {/* Hero: selected month's net balance */}
            <div className="rm-hero">
                <div className="rm-hero-main">
                    <div className={`rm-hero-amount${selBalance < 0 ? ' negative' : ''}`}>
                        <span className="rm-hero-int">{selBalance < 0 ? '-$' : '$'}{heroInt}</span>
                        <span className="rm-hero-dec">{heroDec}</span>
                    </div>
                    <p className="rm-hero-label">Balance neto de {sel.mesLargo.toLowerCase()}</p>
                    <Badge pct={balPct} />
                </div>
                <div className="rm-hero-icon"><Wallet size={26} /></div>
            </div>

            {/* Legend */}
            <div className="rm-legend">
                <span className="rm-legend-item"><span className="rm-legend-dot" style={{ background: '#22C55E' }} /> Ingresos</span>
                <span className="rm-legend-item"><span className="rm-legend-dot" style={{ background: '#EF4444' }} /> Egresos</span>
            </div>

            {/* Fat rounded bars */}
            <div className="rm-chart">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} barCategoryGap="28%" barGap={4} onClick={(s) => { if (s && s.activeTooltipIndex != null) setSelectedIdx(s.activeTooltipIndex); }}>
                        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="mes" tick={{ fill: '#71717a', fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={formatMXNShort} tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} width={46} />
                        <Tooltip
                            cursor={{ fill: 'rgba(255,255,255,0.04)', radius: 8 }}
                            content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const d = payload[0].payload;
                                const bal = d.ingresos - d.egresos;
                                return (
                                    <div className="rm-tip">
                                        <p className="rm-tip-title">{d.mesLargo} {d.anio}</p>
                                        <div className="rm-tip-row">
                                            <span className="lbl"><span className="rm-legend-dot" style={{ background: '#22C55E' }} /> Ingresos</span>
                                            <span className="val">{formatMXN(d.ingresos)}</span>
                                        </div>
                                        <div className="rm-tip-row">
                                            <span className="lbl"><span className="rm-legend-dot" style={{ background: '#EF4444' }} /> Egresos</span>
                                            <span className="val">{formatMXN(d.egresos)}</span>
                                        </div>
                                        <div className="rm-tip-div" />
                                        <div className="rm-tip-row">
                                            <span className="lbl">Balance</span>
                                            <span className="val" style={{ color: bal >= 0 ? '#22C55E' : '#EF4444' }}>{formatMXN(bal)}</span>
                                        </div>
                                    </div>
                                );
                            }}
                        />
                        <Bar dataKey="ingresos" fill="#22C55E" radius={[8, 8, 8, 8]} maxBarSize={20} name="ingresos">
                            {chartData.map((_, i) => <Cell key={i} opacity={isAll || i === idx ? 1 : 0.5} />)}
                        </Bar>
                        <Bar dataKey="egresos" fill="#EF4444" radius={[8, 8, 8, 8]} maxBarSize={20} name="egresos">
                            {chartData.map((_, i) => <Cell key={i} opacity={isAll || i === idx ? 1 : 0.5} />)}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Stat cards for the selected month */}
            <div className="rm-stats">
                <div className="rm-stat">
                    <span className="rm-stat-label">Ingresos</span>
                    <div className="rm-stat-icon" style={{ background: 'rgba(34,197,94,0.12)', color: '#22C55E' }}><TrendingUp size={18} /></div>
                    <span className="rm-stat-val" style={{ color: '#22C55E' }}>{formatMXNStat(sel.ingresos)}</span>
                    <Badge pct={ingPct} cls="rm-stat-badge" />
                </div>
                <div className="rm-stat">
                    <span className="rm-stat-label">Egresos</span>
                    <div className="rm-stat-icon" style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}><TrendingDown size={18} /></div>
                    <span className="rm-stat-val" style={{ color: '#EF4444' }}>{formatMXNStat(sel.egresos)}</span>
                    {/* For expenses, a drop is good → invert badge color */}
                    {egrPct !== null && (
                        <div className={`rm-stat-badge ${egrPct <= 0 ? 'up' : 'down'}`}>
                            {egrPct <= 0 ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}
                            {Math.abs(egrPct).toFixed(0)}% <span>vs {prevLabel}</span>
                        </div>
                    )}
                </div>
                <div className="rm-stat">
                    <span className="rm-stat-label">Balance</span>
                    <div className="rm-stat-icon" style={{ background: 'rgba(255,135,0,0.12)', color: 'var(--accent-color, #FF8700)' }}><Wallet size={18} /></div>
                    <span className="rm-stat-val" style={{ color: selBalance >= 0 ? 'var(--accent-color, #FF8700)' : '#EF4444' }}>{formatMXNStat(selBalance)}</span>
                    <Badge pct={balPct} cls="rm-stat-badge" />
                </div>
            </div>
        </div>
    );
}
