'use client';
import { useMemo, useState, useEffect, useCallback } from 'react';
import Modal from '@/components/Modal';
import { supabase } from '@/lib/supabaseClient';

const formatMXN = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

// ─── Behavioral clusters ──────────────────────────────────────────────────────
// behavior: 'subscription' | 'recurrent' | 'episodic'
//   subscription → fixed monthly, project confidently
//   recurrent    → genuinely repetitive (coffee, OXXO) — project if enough evidence
//   episodic     → burst/occasional (shopping, concerts) — NEVER project, show context only
const CLUSTERS = [
    {
        id: 'comida_rapida',
        label: 'Comida preparada y delivery',
        insight: 'Detectamos varias compras en restaurantes, comida rápida o delivery.',
        behavior: 'recurrent',
        categories: new Set(['Restaurantes', 'Delivery comida']),
        keywords: /uber\s*eats|rappi|didi\s*food|mcdon|burger|kfc|carl.?s|subway|domino|pizza|little\s*caesar|starbucks|caf[eé]|coffee|wings|sushi|taco|wingstop|shake\s*shack|vips|toks|sanborn|chili.?s|applebee/i,
    },
    {
        id: 'conveniencia',
        label: 'Compras de conveniencia',
        insight: 'Compras frecuentes en tiendas de conveniencia.',
        behavior: 'recurrent',
        categories: new Set(['Conveniencia']),
        keywords: /\boxxo\b|7.?eleven|seven\s*eleven|circle.?k|kiosko|go\s*mart|extra\b/i,
    },
    {
        id: 'entretenimiento',
        label: 'Entretenimiento y ocio',
        insight: 'Gastos en ocio, entretenimiento y experiencias en este período.',
        behavior: 'episodic',
        categories: new Set(['Entretenimiento', 'Cine', 'Videojuegos', 'Eventos']),
        keywords: /cinepolis|cinemex|teatro|concierto|steam|nintendo|playstation|xbox|epic\s*games|ticketmaster|\bbar\b|antro|botanero/i,
    },
    {
        id: 'streaming',
        label: 'Streaming y entretenimiento digital',
        insight: 'Suscripciones mensuales a plataformas de video y música.',
        behavior: 'subscription',
        categories: new Set(['Streaming']),
        keywords: /netflix|spotify|disney\+?|hbo\b|max\b|amazon\s*prime|youtube\s*premium|paramount|apple\s*tv|crunchyroll|twitch/i,
    },
    {
        id: 'software_digital',
        label: 'Software y servicios digitales',
        insight: 'Suscripciones mensuales a herramientas y servicios en la nube.',
        behavior: 'subscription',
        categories: new Set(['Software', 'Infraestructura']),
        keywords: /openai|chatgpt|claude|anthropic|notion|figma|canva|adobe|midjourney|github|copilot|microsoft|office\s*365|onedrive|icloud|apple\.com\/bill|dropbox|evernote|lastpass|1password/i,
    },
    {
        id: 'compras_online',
        label: 'Compras en línea',
        insight: 'Compras digitales detectadas en este período.',
        behavior: 'episodic',
        categories: new Set(['Compras online', 'Ropa', 'Ropa deportiva']),
        keywords: /\bamazon\b(?!\s*web)|\bmercado\s*libre\b|shein|temu|aliexpress|ebanx|zara|h&m|bershka|pull.?bear|liverpool|suburbia|coppel/i,
    },
    {
        id: 'cuidado_personal',
        label: 'Cuidado personal',
        insight: 'Visitas recurrentes a peluquería, estética o spa.',
        behavior: 'recurrent',
        categories: new Set(['Cuidado personal']),
        keywords: /barber|estetica|est[eé]tica|spa\b|sal[oó]n|peluquer/i,
    },
];

// Functional categories — always excluded
const EXCLUDED_CATEGORIES = new Set([
    'Gasolina', 'Transporte', 'Transporte público', 'Casetas',
    'Supermercado', 'Comida y Abarrotes', 'Farmacia', 'Salud',
    'Electricidad', 'Agua', 'Gas hogar', 'Internet', 'Telefonía móvil',
    'Educación', 'Cursos online', 'Seguros', 'Comisiones bancarias',
    'Retiro efectivo', 'Transferencias', 'Hogar', 'Mascotas',
]);
const EXCLUDED_KW = /pemex|oxxo\s*gas|\bbp\b|shell|total\s*gas|caseta|cuota|autopista|televia|walmart|costco|chedraui|soriana|sam.?s|bodega\s*aurrera|superama|la\s*comer|farmacia|similares|benavides|del\s*ahorro|hospital|clinica|doctor|dentista|telmex|izzi|megacable|totalplay|cfe\b|sacmex|iave|seguro|qualitas|gnp|axa|retiro|atm\b|spei|transferencia|mercadopago|clip\b|dlocal|stripe/i;

function assignCluster(t) {
    const cat = t.categoria || t.category || '';
    const concept = t.concept || t.concepto || '';
    if (EXCLUDED_CATEGORIES.has(cat)) return null;
    if (EXCLUDED_KW.test(concept)) return null;
    for (const cluster of CLUSTERS) {
        if (cluster.categories.has(cat)) return cluster.id;
        if (cluster.keywords.test(concept)) return cluster.id;
    }
    return null; // uncategorized → skip (don't guess)
}

// ─── Label cleaner ────────────────────────────────────────────────────────────
// Mexican bank descriptions look like:
//   "CONSUMO LOCAL AJENO TERMINACION 3217 - Amazon Prime"
//   "CONSUMO INTERNACIONAL MC TERMINACION 4231 - APPLE.COM/BILL"
//   "CARGO EN STARBUCKS COFFEE MEXICO"
function cleanLabel(concept) {
    let s = (concept || '').trim();

    // Pattern 1: "... TERMINACION XXXX - Actual Merchant" — extract everything after the dash
    const afterDash = s.match(/TERMINACION\s+\d+\s*[-–]\s*(.+)/i);
    if (afterDash) {
        s = afterDash[1].trim();
    } else {
        // Pattern 2: strip "CONSUMO LOCAL/INTERNACIONAL/NACIONAL AJENO/PROPIO"
        s = s.replace(/^CONSUMO\s+(LOCAL|INTERNACIONAL|NACIONAL)\s*(AJENO|PROPIO)?\s*(AJENO|PROPIO)?\s*/gi, '');
        // Strip "TERMINACION XXXX" anywhere
        s = s.replace(/TERMINACION\s+\d+\s*/gi, '');
        // Strip common banking prefixes
        s = s.replace(/^(COMPRA\s+EN|CARGO\s+EN|CARGO\s+A|PAGO\s+A|ABONO\s+A|CARGO\s+POR|COMISION|RETIRO\s+EN)\s+/gi, '');
    }

    // Strip card/terminal suffixes
    s = s.replace(/\s+(S\.?A\.?\s*DE\s*C\.?V\.?|SAPI|TRANSFERENCIA|SPEI).*$/gi, '');
    // Strip trailing card numbers
    s = s.replace(/\s+\d{4,}\s*$/, '');
    // Strip "/BILL", "/ITUNES", etc. from Apple URLs but keep the brand
    s = s.replace(/APPLE\.COM\/\w+/i, 'Apple');
    // Normalize whitespace
    s = s.replace(/\s+/g, ' ').trim();

    if (!s) return concept || '—';
    // Title case
    return s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

// ─── Top merchants in a cluster ───────────────────────────────────────────────
function topMerchants(transactions, n = 4) {
    const counts = {};
    for (const t of transactions) {
        // Clean FIRST, then take first 3 words as merchant key
        const cleaned = cleanLabel(t.concept || t.concepto || '');
        const label = cleaned.split(' ').slice(0, 3).join(' ');
        if (label && label !== '—') counts[label] = (counts[label] || 0) + 1;
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return { top: sorted.slice(0, n).map(([name]) => name), total: sorted.length };
}

// ─── Confidence scoring ────────────────────────────────────────────────────────
// Returns { confidence: 'high'|'medium'|'low', shouldProject: bool, frequencyLabel: string, monthly: number|null }
//
// Rules:
//   episodic    → never project (ropa, entretenimiento, compras ocasionales)
//   subscription → always project (Netflix, Spotify — nature guarantees recurrence)
//   recurrent   → project only if: ≥5 txs OR (≥3 txs AND span ≥14 days AND intervals regular)
//
// "Patrón diario" from 3 txs in 4 days = false confidence → prevented here.

function assessPattern(transactions, behavior) {
    const n = transactions.length;
    const dates = transactions
        .map(t => new Date(t.date || t.fecha))
        .filter(d => !isNaN(d))
        .sort((a, b) => a - b);
    const spanDays = dates.length >= 2 ? (dates[dates.length - 1] - dates[0]) / 86400000 : 0;
    const totalAmt = transactions.reduce((s, t) => s + Math.abs(Number(t.amount || t.monto) || 0), 0);
    const avg = n > 0 ? totalAmt / n : 0;

    // ── Subscriptions: high confidence, project monthly spend directly
    if (behavior === 'subscription') {
        const monthly = avg * Math.max(n, 1); // sum (fixed charges)
        return { confidence: 'high', shouldProject: true, frequencyLabel: 'cargo mensual', monthly, annual: monthly * 12 };
    }

    // ── Episodic: never project, just summarize
    if (behavior === 'episodic') {
        const label = spanDays <= 7
            ? 'compras agrupadas'
            : spanDays <= 30
            ? 'actividad en el período'
            : 'actividad reciente';
        return { confidence: 'low', shouldProject: false, frequencyLabel: label, monthly: null, annual: null };
    }

    // ── Recurrent: assess interval regularity
    // Compute coefficient of variation of intervals
    let cv = 1;
    if (dates.length >= 3) {
        const intervals = [];
        for (let i = 1; i < dates.length; i++) intervals.push((dates[i] - dates[i - 1]) / 86400000);
        const mean = intervals.reduce((s, v) => s + v, 0) / intervals.length;
        const std = Math.sqrt(intervals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / intervals.length);
        cv = mean > 0 ? std / mean : 1;
    }

    const isRegular = cv < 0.6;
    const hasEnoughData = n >= 5 || (n >= 3 && spanDays >= 14 && isRegular);

    if (!hasEnoughData) {
        return { confidence: 'low', shouldProject: false, frequencyLabel: 'actividad reciente', monthly: null, annual: null };
    }

    // Project using frequency rate
    const monthly = spanDays > 0 ? (n / spanDays) * 30 * avg : avg;
    const annual = monthly * 12;

    // Frequency label
    const avgInterval = spanDays / Math.max(n - 1, 1);
    let frequencyLabel = 'frecuencia mensual';
    if (avgInterval <= 3)  frequencyLabel = 'frecuencia diaria';
    else if (avgInterval <= 10) frequencyLabel = 'frecuencia semanal';
    else if (avgInterval <= 20) frequencyLabel = 'frecuencia quincenal';

    const confidence = n >= 8 && isRegular ? 'high' : 'medium';
    return { confidence, shouldProject: true, frequencyLabel, monthly, annual };
}

// ─── Severity (by periods detected in memory) ─────────────────────────────────
function severity(periods) {
    if (periods >= 3) return { label: 'Hábito consolidado', color: '#EF4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.2)'  };
    if (periods >= 2) return { label: 'Tendencia creciente', color: '#F97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.2)' };
    return                   { label: 'Patrón detectado',   color: '#FBBF24', bg: 'rgba(251,191,36,0.07)', border: 'rgba(251,191,36,0.2)' };
}

const MIN_TX = 3;

// ─── Detection — cluster-based ────────────────────────────────────────────────
function detectClusters(transactions) {
    const egresos = transactions.filter(t => {
        const type = (t.type || t.tipo || '').toLowerCase().trim();
        return type === 'egreso' || type === 'gasto personal';
    });

    const buckets = {}; // clusterId → transactions[]
    for (const t of egresos) {
        const clusterId = assignCluster(t);
        if (!clusterId) continue;
        if (!buckets[clusterId]) buckets[clusterId] = [];
        buckets[clusterId].push(t);
    }

    return Object.entries(buckets)
        .filter(([, txs]) => txs.length >= MIN_TX)
        .map(([id, txs]) => {
            const meta = CLUSTERS.find(c => c.id === id);
            const total = txs.reduce((s, t) => s + Math.abs(Number(t.amount || t.monto) || 0), 0);
            const avg = total / txs.length;
            const dates = txs.map(t => new Date(t.date || t.fecha)).filter(d => !isNaN(d)).sort((a, b) => a - b);
            const spanDays = dates.length >= 2 ? Math.round((dates[dates.length - 1] - dates[0]) / 86400000) : 0;
            const pattern = assessPattern(txs, meta.behavior);
            const { top: merchants, total: totalMerchants } = topMerchants(txs);
            return {
                id, label: meta.label, insight: meta.insight, behavior: meta.behavior,
                transactions: txs, total, avg, spanDays, merchants, totalMerchants,
                confidence: pattern.confidence,
                shouldProject: pattern.shouldProject,
                frequencyLabel: pattern.frequencyLabel,
                monthly: pattern.monthly,
                annual: pattern.annual,
            };
        })
        // Sort: projectable clusters first (by monthly), then episodic (by total)
        .sort((a, b) => {
            if (a.shouldProject !== b.shouldProject) return a.shouldProject ? -1 : 1;
            return (b.monthly ?? b.total) - (a.monthly ?? a.total);
        });
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function GastosHormiga({ transactions = [], onSelectTransaction }) {
    const [stored, setStored] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [expanded, setExpanded] = useState(false);
    const [regularizing, setRegularizing] = useState(null);

    const detected = useMemo(() => detectClusters(transactions), [transactions]);

    const syncPatterns = useCallback(async () => {
        if (detected.length === 0) { setLoading(false); return; }
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { setLoading(false); return; }
            const today = new Date().toISOString().split('T')[0];
            const currentMonth = today.slice(0, 7);
            const { data: existing } = await supabase.from('hormiga_patterns').select('*').eq('user_id', user.id);
            const existingMap = {};
            for (const p of (existing || [])) existingMap[p.pattern_key] = p;
            const upserts = detected.map(g => {
                const prev = existingMap[g.id];
                const isNewPeriod = !prev || prev.last_seen?.slice(0, 7) !== currentMonth;
                return {
                    user_id: user.id,
                    pattern_key: g.id,
                    label: g.label,
                    periods_detected: prev ? (isNewPeriod ? prev.periods_detected + 1 : prev.periods_detected) : 1,
                    total_accumulated: prev ? prev.total_accumulated + (isNewPeriod ? g.total : 0) : g.total,
                    first_seen: prev?.first_seen || today,
                    last_seen: today,
                    is_regularized: prev?.is_regularized ?? false,
                };
            });
            await supabase.from('hormiga_patterns').upsert(upserts, { onConflict: 'user_id,pattern_key' });
            const { data: refreshed } = await supabase.from('hormiga_patterns').select('*').eq('user_id', user.id);
            setStored(refreshed || []);
        } catch (e) { console.error('[GastosHormiga]', e?.message); }
        setLoading(false);
    }, [detected]);

    useEffect(() => { syncPatterns(); }, [syncPatterns]);

    const handleRegularizar = async (patternKey) => {
        setRegularizing(patternKey);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            await supabase.from('hormiga_patterns').update({ is_regularized: true }).eq('user_id', user.id).eq('pattern_key', patternKey);
            setStored(prev => prev.map(p => p.pattern_key === patternKey ? { ...p, is_regularized: true } : p));
            setSelected(null);
        } catch (e) { console.error('[GastosHormiga] regularize:', e?.message); }
        setRegularizing(null);
    };

    const items = useMemo(() => {
        const storedMap = {};
        for (const s of stored) storedMap[s.pattern_key] = s;
        return detected
            .map(g => {
                const s = storedMap[g.id];
                if (s?.is_regularized) return null;
                return { ...g, periodsDetected: s?.periods_detected ?? 1, totalAccumulated: s?.total_accumulated ?? g.total };
            })
            .filter(Boolean)
            .sort((a, b) => {
                if (a.shouldProject !== b.shouldProject) return a.shouldProject ? -1 : 1;
                const aVal = a.shouldProject ? (a.monthly ?? 0) * a.periodsDetected : a.total;
                const bVal = b.shouldProject ? (b.monthly ?? 0) * b.periodsDetected : b.total;
                return bVal - aVal;
            });
    }, [detected, stored]);

    if (loading || items.length === 0) return null;

    const projectableItems = items.filter(g => g.shouldProject);
    const totalMonthly = projectableItems.reduce((s, g) => s + (g.monthly ?? 0), 0);
    const totalPeriod  = items.reduce((s, g) => s + g.total, 0);
    const totalEgresos = transactions
        .filter(t => ['egreso', 'gasto personal'].includes((t.type || '').toLowerCase().trim()))
        .reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
    const pct = totalEgresos > 0 ? ((totalPeriod / totalEgresos) * 100).toFixed(1) : 0;

    const visible = expanded ? items : items.slice(0, 3);
    const sel = items.find(g => g.id === selected);

    return (
        <div className="card fnce-dynamic-panel" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 }}>
                    Patrones de consumo
                </h2>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{items.length} hábitos detectados</span>
            </div>

            {/* Global insight — compact summary */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {items.length} {items.length === 1 ? 'patrón' : 'patrones'} detectados
                        {pct > 0 && <> · <strong style={{ color: 'var(--text-primary)' }}>{pct}%</strong> de egresos</>}
                    </span>
                    {totalMonthly > 0
                        ? <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Reducir 20% liberaría {formatMXN(totalMonthly * 0.2)}/mes estimado</span>
                        : <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Actividad detectada en el período · {formatMXN(totalPeriod)} total</span>
                    }
                </div>
                {totalMonthly > 0 && (
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#FBBF24', fontVariantNumeric: 'tabular-nums', flexShrink: 0, marginLeft: '12px' }}>
                        {formatMXN(totalMonthly)}<span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-muted)' }}>/mes</span>
                    </span>
                )}
            </div>

            {/* Cluster cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {visible.map((g) => {
                    const sev = severity(g.periodsDetected);
                    const extra = g.totalMerchants - 2;
                    const merchantText = g.merchants.length === 0
                        ? `${g.transactions.length} movimientos detectados`
                        : g.merchants.length <= 2
                            ? `incluye ${g.merchants.join(' y ')}`
                            : `incluye ${g.merchants.slice(0, 2).join(', ')}${extra > 0 ? ` y ${extra} ${extra === 1 ? 'comercio' : 'comercios'} más` : ''}`;
                    return (
                        <div key={g.id} onClick={() => setSelected(g.id)}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', cursor: 'pointer', gap: '12px' }}>
                            {/* Left — label + context */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden', flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.label}</span>
                                    <span style={{ fontSize: '9px', color: sev.color, opacity: 0.7, flexShrink: 0 }}>●</span>
                                </div>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {g.transactions.length} movimientos{g.spanDays > 0 ? ` en ${g.spanDays} días` : ''}
                                    {g.frequencyLabel && ` · ${g.frequencyLabel}`}
                                    {merchantText ? ` · ${merchantText}` : ''}
                                </span>
                            </div>
                            {/* Right — projected or period total */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px', flexShrink: 0 }}>
                                {g.shouldProject ? (
                                    <>
                                        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                                            {formatMXN(g.monthly)}<span style={{ fontSize: '10px', fontWeight: 400, color: 'var(--text-muted)' }}>/mes</span>
                                        </span>
                                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{g.confidence === 'high' ? 'proyección' : 'estimación preliminar'}</span>
                                    </>
                                ) : (
                                    <>
                                        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                                            {formatMXN(g.total)}
                                        </span>
                                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>este período</span>
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {items.length > 3 && (
                <button onClick={() => setExpanded(e => !e)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '12px', padding: 0, alignSelf: 'center', touchAction: 'manipulation' }}>
                    {expanded ? 'Ver menos' : `Ver ${items.length - 3} más`}
                </button>
            )}

            {/* Drill-down modal */}
            {sel && (
                <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span>{sel.label}</span>
                        <span style={{ fontSize: '13px', color: severity(sel.periodsDetected).color, fontWeight: 400, marginTop: '4px' }}>
                            {sel.transactions.length} movimientos · {sel.frequencyLabel}
                        </span>
                    </div>
                }>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '520px', overflowY: 'auto' }}>

                        {/* Behavioral insight */}
                        <div style={{ padding: '12px 14px', background: `${severity(sel.periodsDetected).color}10`, border: `1px solid ${severity(sel.periodsDetected).color}25`, borderRadius: '10px', fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.7 }}>
                            {sel.insight}
                            {' '}<strong>{sel.transactions.length} movimientos{sel.spanDays > 0 ? ` en ${sel.spanDays} días` : ''}</strong>.
                            {sel.periodsDetected >= 2 && <> Detectado en <strong>{sel.periodsDetected} meses seguidos</strong>.</>}
                            {!sel.shouldProject && <> Este tipo de gasto suele ser ocasional — no se generó proyección de largo plazo.</>}
                        </div>

                        {/* Metrics — always show avg + total; projection metrics only if shouldProject */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            {[
                                { label: 'Promedio por movimiento', value: formatMXN(sel.avg) },
                                { label: 'Total este período',      value: formatMXN(sel.total) },
                                ...(sel.shouldProject ? [
                                    { label: sel.confidence === 'high' ? 'Proyección mensual' : 'Estimación mensual', value: formatMXN(sel.monthly), color: '#FBBF24', note: sel.confidence === 'high' ? 'basado en frecuencia' : 'datos preliminares' },
                                    { label: 'Tendencia anual',     value: formatMXN(sel.annual),        color: '#F97316', note: 'estimación no definitiva' },
                                    { label: 'Ahorro posible/mes',  value: formatMXN(sel.monthly * 0.2), color: '#34D399', note: 'reduciendo 20%' },
                                    { label: 'Ahorro posible/año',  value: formatMXN(sel.annual  * 0.2), color: '#34D399', note: 'reduciendo 20%' },
                                ] : []),
                            ].map(({ label, value, color, note }) => (
                                <div key={label} style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                    <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
                                    <p style={{ margin: '4px 0 2px', fontSize: '14px', fontWeight: 700, color: color || 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
                                    {note && <p style={{ margin: 0, fontSize: '9px', color: 'var(--text-secondary)' }}>{note}</p>}
                                </div>
                            ))}
                        </div>

                        {/* Transaction list */}
                        {sel.transactions
                            .sort((a, b) => new Date(b.date || b.fecha || 0) - new Date(a.date || a.fecha || 0))
                            .map((t, i) => (
                                <div key={i}
                                    onClick={() => { if (onSelectTransaction && t.id) { setSelected(null); onSelectTransaction(t.id); } }}
                                    style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: onSelectTransaction && t.id ? 'pointer' : 'default' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cleanLabel(t.concept || t.concepto || '—')}</span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                            {(t.date || t.fecha) ? new Date(t.date || t.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                                            {t.categoria ? ` · ${t.categoria}` : ''}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: '12px' }}>
                                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                            {formatMXN(Math.abs(Number(t.amount || t.monto) || 0))}
                                        </span>
                                        {onSelectTransaction && t.id && (
                                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', opacity: 0.6 }}>↗</span>
                                        )}
                                    </div>
                                </div>
                            ))}

                        {/* Regularizar */}
                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 10px', lineHeight: 1.5 }}>
                                ¿Este patrón es intencional? Márcalo y dejamos de reportarlo.
                            </p>
                            <button onClick={() => handleRegularizar(sel.id)} disabled={!!regularizing}
                                style={{ width: '100%', padding: '10px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', touchAction: 'manipulation', opacity: regularizing ? 0.5 : 1 }}>
                                {regularizing === sel.id ? 'Guardando...' : 'Marcar como intencional'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
