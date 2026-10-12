// Credit mode insights: debt breakdown, what-ifs, minimum-payment cost, simulator, auto-insights, monthly history.
// Extracted from src/app/finanzas/page.js; state and handlers stay in the page.
import { AlertTriangle, CalendarIcon, CheckCircle2, Lock, Target, Zap } from 'lucide-react';

export default function CreditInsights({
    autoInsights,
    burnRateDiario,
    cat,
    creditConfig,
    creditMonthlyHistory,
    deudaActual,
    deudaComprometidaProxMes,
    diasHastaSaturacion,
    formatCurrency,
    historicoAjustes,
    historicoCargos,
    historicoPagos,
    interesesMostrar,
    interesesPeriodo,
    lastMonth,
    lastMonthNarrative,
    maxCargos,
    mesesMostrar,
    pagoNoInteres,
    setIsEditingCreditConfig,
    setSimulatorMode,
    simulatedInterest,
    simulatedPayment,
    simulatedRemaining,
    simulatorMode,
    totalMSI,
    totalSuscripciones,
    trendVsPrev,
}) {
    return (
        <div style={{ marginTop: '12px', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* DEBT INTELLIGENCE */}
            <div style={{ padding: '16px', borderRadius: '14px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <p style={{ margin: '0 0 14px', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Inteligencia de Deuda</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[
                        { label: 'Compras y Cargos', value: historicoCargos, color: 'var(--text-primary)' },
                        { label: 'Pagos realizados', value: -historicoPagos, color: '#34d399' },
                        { label: 'Devoluciones', value: -historicoAjustes, color: '#60a5fa' },
                        ...(interesesPeriodo > 0 ? [{ label: 'Intereses / Comis.', value: interesesPeriodo, color: '#f87171' }] : []),
                        ...(totalMSI > 0 ? [{ label: 'MSI activos', value: totalMSI, color: '#a78bfa' }] : []),
                        ...(totalSuscripciones > 0 ? [{ label: 'Suscripciones', value: totalSuscripciones, color: '#fb923c' }] : []),
                    ].map(({ label, value, color }) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{label}</span>
                            <span style={{ fontSize: '13px', fontWeight: 600, color }}>{value < 0 ? '-' : ''}{formatCurrency(Math.abs(value))}</span>
                        </div>
                    ))}
                    <div style={{ height: '1px', background: 'var(--bg-border)', margin: '2px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Deuda neta</span>
                        <span style={{ fontSize: '14px', fontWeight: 800, color: deudaActual > 0 ? '#f87171' : '#34d399' }}>{formatCurrency(deudaActual)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer', paddingTop: '4px' }} onClick={() => setIsEditingCreditConfig(true)}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CalendarIcon size={10} /> Corte: {creditConfig.cutoffDate || '—'}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CalendarIcon size={10} /> Límite: {creditConfig.paymentDate || '—'}</span>
                    </div>
                </div>
            </div>

            {/* FORECASTING */}
            <div style={{ padding: '16px', borderRadius: '14px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <p style={{ margin: '0 0 14px', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>¿Qué pasa si...?</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {burnRateDiario > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '13px', color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                {diasHastaSaturacion < 60
                                    ? <AlertTriangle size={13} style={{ color: '#ef4444', flexShrink: 0 }} />
                                    : diasHastaSaturacion < 120
                                    ? <AlertTriangle size={13} style={{ color: '#eab308', flexShrink: 0 }} />
                                    : <CheckCircle2 size={13} style={{ color: '#22c55e', flexShrink: 0 }} />
                                } ...sigues gastando igual
                            </span>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: diasHastaSaturacion < 30 ? '#ef4444' : diasHastaSaturacion < 60 ? '#eab308' : '#34d399' }}>
                                {diasHastaSaturacion > 365 ? 'línea aguanta 1+ año' : `saturarías en ~${diasHastaSaturacion} días`}
                            </span>
                        </div>
                    )}
                    {deudaComprometidaProxMes > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '13px', color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}><Lock size={13} style={{ color: '#a78bfa', flexShrink: 0 }} /> ...no cancelas nada fijo</span>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#a78bfa' }}>{formatCurrency(deudaComprometidaProxMes)} comprometido</span>
                        </div>
                    )}
                    {pagoNoInteres > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '13px', color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}><Target size={13} style={{ color: '#34d399', flexShrink: 0 }} /> ...pagas para evitar intereses</span>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#34d399' }}>paga {formatCurrency(pagoNoInteres)}</span>
                        </div>
                    )}
                    {Number(creditConfig.pagoMinimo) > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '13px', color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}><Zap size={13} style={{ color: '#eab308', flexShrink: 0 }} /> ...pagas el mínimo</span>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#eab308' }}>{formatCurrency(Number(creditConfig.pagoMinimo))}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* MINIMUM PAYMENT CONSEQUENCE — killer feature */}
            {deudaActual > 0 && mesesMostrar > 0 && (
                <div style={{ padding: '16px', borderRadius: '14px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <p style={{ margin: '0 0 12px', fontSize: '11px', fontWeight: 600, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: '5px' }}><AlertTriangle size={11} /> Si solo pagas el mínimo...</p>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <div style={{ flex: 1, textAlign: 'center', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px' }}>
                            <div style={{ fontSize: '22px', fontWeight: 800, color: '#f87171', lineHeight: 1 }}>{mesesMostrar}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>meses para liquidar</div>
                        </div>
                        <div style={{ flex: 1, textAlign: 'center', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px' }}>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: '#f87171', lineHeight: 1 }}>{formatCurrency(interesesMostrar)}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>en intereses totales</div>
                        </div>
                    </div>
                    {cat > 0 && (
                        <p style={{ margin: '10px 0 0', fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center' }}>CAT: {cat}% anual</p>
                    )}
                </div>
            )}

            {/* SIMULATOR */}
            <div style={{ padding: '16px', borderRadius: '14px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <p style={{ margin: '0 0 12px', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Simulador de Pago</p>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '14px', background: 'rgba(0,0,0,0.2)', padding: '3px', borderRadius: '8px' }}>
                    {[['minimo', 'Mínimo'], ['corte', 'Sin intereses'], ['total', 'Total']].map(([mode, label]) => (
                        <button key={mode} style={{ flex: 1, fontSize: '11px', padding: '6px 4px', background: simulatorMode === mode ? 'var(--bg-elevated)' : 'transparent', border: 'none', color: simulatorMode === mode ? '#fff' : 'var(--text-secondary)', borderRadius: '6px', cursor: 'pointer', fontWeight: simulatorMode === mode ? 600 : 400 }} onClick={() => setSimulatorMode(mode)}>{label}</button>
                    ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Si pagas:</span>
                        <span style={{ fontSize: '15px', fontWeight: 700, color: '#34d399' }}>{formatCurrency(simulatedPayment)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Deuda restante:</span>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(simulatedRemaining)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '8px', background: simulatedInterest > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.08)', border: `1px solid ${simulatedInterest > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)'}` }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: simulatedInterest > 0 ? '#f87171' : '#4ade80' }}>Intereses próx. mes:</span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: simulatedInterest > 0 ? '#f87171' : '#4ade80' }}>{simulatedInterest > 0 ? `~${formatCurrency(simulatedInterest)}` : '$0.00'}</span>
                    </div>
                </div>
            </div>

            {/* AUTO-INSIGHTS */}
            {autoInsights.length > 0 && (
                <div style={{ padding: '16px', borderRadius: '14px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                    <p style={{ margin: '0 0 12px', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Lo que dice tu estado</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {autoInsights.map((ins, i) => (
                            <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                <ins.Icon size={14} style={{ flexShrink: 0, marginTop: '2px', color: ins.iconColor }} />
                                <span style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.4 }}>{ins.text}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* HISTORIAL MENSUAL */}
            {creditMonthlyHistory.length > 1 && (
                <div style={{ padding: '16px', borderRadius: '14px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <p style={{ margin: 0, fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Evolución mensual</p>
                        {trendVsPrev && (
                            <span style={{ fontSize: '11px', fontWeight: 600, color: trendVsPrev.direction === 'up' ? '#f87171' : '#34d399', padding: '2px 8px', borderRadius: '20px', background: trendVsPrev.direction === 'up' ? 'rgba(248,113,113,0.1)' : 'rgba(52,211,153,0.1)' }}>
                                {trendVsPrev.direction === 'up' ? '↑' : '↓'} {trendVsPrev.pct}% vs mes anterior
                            </span>
                        )}
                    </div>

                    {/* Narrative */}
                    {lastMonthNarrative && (
                        <p style={{ margin: '0 0 14px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', borderLeft: `3px solid ${lastMonth.neto >= 0 ? '#34d399' : '#f87171'}` }}>
                            {lastMonthNarrative}
                        </p>
                    )}

                    {/* Monthly bars */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {creditMonthlyHistory.slice(-6).reverse().map(m => (
                            <div key={m.month}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{m.label}</span>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <span style={{ fontSize: '11px', color: '#f87171' }}>{formatCurrency(m.cargos)}</span>
                                        <span style={{ fontSize: '11px', color: '#34d399' }}>{formatCurrency(m.pagos)}</span>
                                    </div>
                                </div>
                                <div style={{ position: 'relative', height: '6px', borderRadius: '999px', background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                                    {/* Cargos bar */}
                                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(100, (m.cargos / maxCargos) * 100)}%`, background: '#f87171', borderRadius: '999px', opacity: 0.7 }} />
                                    {/* Pagos overlay */}
                                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(100, (m.pagos / maxCargos) * 100)}%`, background: '#34d399', borderRadius: '999px', opacity: 0.5 }} />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '10px', color: 'var(--text-secondary)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f87171', display: 'inline-block' }} /> Cargos</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} /> Pagos</span>
                    </div>
                </div>
            )}
        </div>
    );
}
