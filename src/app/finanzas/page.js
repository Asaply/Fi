"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { ArrowUpRight, ArrowDownRight, Edit2, Trash2, Plus, Wallet, TrendingUp, Upload, ChevronRight, AlertCircle, CheckCircle2, Receipt, Settings, Landmark, CreditCard as CreditCardIcon, Lightbulb, AlertTriangle, Lock, ShoppingBag, RefreshCw, TrendingDown, Calendar as CalendarIcon, Target, Zap, BarChart2, Info } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import Modal from "@/components/Modal";
import CurrencyInput from "@/components/CurrencyInput";
import PLCalendar from "@/components/PLCalendar";
import { supabase } from "@/lib/supabaseClient";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { inferirCategoria, categoriasParaTipo, CATEGORIAS_ALL } from "@/lib/categorias";
import { getFilter, setFilter } from "@/lib/filterMemory";
import GastosPorCategoria from "@/components/GastosPorCategoria";
import IngresosPorCategoria from "@/components/IngresosPorCategoria";
import GastosHormiga from "@/components/GastosHormiga";
import NvaIntelligencePanel from "@/components/NvaIntelligencePanel";
import { openTutorial } from "@/components/AppTutorial";
import { toast } from "sonner";
import BankConnectWidget from "@/components/BankConnectWidget";
import "./Finanzas.css";
import { API_BASE } from "@/lib/apiBase";
import { nvaEngine } from "@/nvaEngine";

const MOCK_DATA = [
    { id: 1, date: "2026-02-15", client: "Acme Corp", concept: "Desarrollo Web (50%)", type: "Ingreso", amount: 45000 },
    { id: 2, date: "2026-02-18", client: "N/A", concept: "Suscripción Vercel", type: "Egreso", amount: 400 },
    { id: 3, date: "2026-02-20", client: "TechFlow", concept: "Mantenimiento Mensual", type: "Ingreso", amount: 12000 },
    { id: 4, date: "2026-02-25", client: "N/A", concept: "Pago Diseñador Freelance", type: "Egreso", amount: 15000 },
];

// ── Categorization — now powered by src/lib/categorias.js ────────────────────

const CAT_COLORS = {
    'Restaurantes':                  '#f97316',
    'Comida y Abarrotes':            '#84cc16',
    'Transporte':                    '#3b82f6',
    'Suscripciones':                 '#8b5cf6',
    'Transferencias':                '#6366f1',
    'Salud':                         '#22c55e',
    'Entretenimiento':               '#f59e0b',
    'Ropa y Accesorios':             '#ec4899',
    'Servicios (luz, agua, internet)': '#06b6d4',
    'Educación':                     '#10b981',
    'Sueldo':                        '#34d399',
    'Freelance':                     '#60a5fa',
    'Transferencia recibida':        '#a78bfa',
    'Inversión':                     '#0A84FF',
    'Venta':                         '#fb923c',
    'Otros':                         '#6b7280',
};

// Alias — kept so existing JSX using categorizarTransaccion still works
function categorizarTransaccion(concepto) {
    return inferirCategoria(concepto);
}

// ─── CSV helpers ─────────────────────────────────────────────────────────────

function parseCSV(text) {
    // Strip BOM and normalize line endings
    const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    const lines = clean.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];

    // Auto-detect separator (semicolon or comma)
    const sep = lines[0].includes(';') ? ';' : ',';

    const result = [];
    for (const line of lines) {
        if (!line.trim()) continue;
        const row = [];
        let cur = '', inQ = false;
        for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (c === '"') { inQ = !inQ; }
            else if (c === sep && !inQ) { row.push(cur.trim().replace(/^["']|["']$/g, '')); cur = ''; }
            else { cur += c; }
        }
        row.push(cur.trim().replace(/^["']|["']$/g, ''));
        result.push(row);
    }
    return result;
}

const COL_PATTERNS = {
    date:    [/^fecha$/i, /^date$/i, /^f\.?valor$/i, /^dt$/i, /^fecha operaci[oó]n$/i, /^fecha valor$/i, /^fec\.?$/i],
    concept: [/^concepto$/i, /^descripci[oó]n$/i, /^description$/i, /^detalle$/i, /^referencia$/i, /^operaci[oó]n$/i, /^comercio$/i, /^movimiento$/i, /^narrativa$/i],
    amount:  [/^monto$/i, /^importe$/i, /^amount$/i, /^valor$/i],
    charge:  [/^cargo$/i, /^retiro$/i, /^d[eé]bito$/i, /^debit$/i, /^egresos$/i, /^cargos$/i, /^salida$/i],
    credit:  [/^abono$/i, /^dep[oó]sito$/i, /^cr[eé]dito$/i, /^credit$/i, /^ingresos$/i, /^dep[oó]sitos$/i, /^entrada$/i],
};

function autoDetect(headers) {
    const map = { date: '', concept: '', amount: '', charge: '', credit: '' };
    headers.forEach(h => {
        const normalized = h.trim().toLowerCase().replace(/\s+/g, ' ');
        for (const [key, patterns] of Object.entries(COL_PATTERNS)) {
            if (!map[key] && patterns.some(p => p.test(normalized))) map[key] = h;
        }
    });
    return map;
}

function normalizarFecha(rawDate) {
    if (!rawDate) return new Date().toISOString().split('T')[0];
    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) return rawDate;
    // Try JS Date parse (handles ISO and some locale formats)
    const parts = rawDate.split(/[\/\-\.]/);
    if (parts.length === 3) {
        const [a, b, c] = parts;
        if (a.length === 4) {
            // YYYY-MM-DD or YYYY/MM/DD
            return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;
        } else {
            // DD/MM/YYYY (Mexican format)
            const year = c.length === 2 ? `20${c}` : c;
            return `${year}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
        }
    }
    return new Date().toISOString().split('T')[0];
}

function buildRows(rawRows, headers, mapping, isCreditCard = false) {
    const parseMonto = (s) => Math.abs(parseFloat((s || '').replace(/[$,\s]/g, '')) || 0);

    return rawRows.map((row, idx) => {
        const get = (col) => col ? (row[headers.indexOf(col)] || '') : '';
        const rawDate = get(mapping.date);
        const concept = get(mapping.concept).trim() || `Transacción ${idx + 1}`;
        let amount = 0, type = 'Egreso';

        if (mapping.charge || mapping.credit) {
            const charge = parseMonto(get(mapping.charge));
            const credit = parseMonto(get(mapping.credit));
            if (credit > 0 && charge === 0) { amount = credit; type = isCreditCard ? 'Transferencia' : 'Ingreso'; }
            else if (charge > 0) { amount = charge; type = 'Egreso'; }
            else { amount = Math.max(credit, charge); }
        } else if (mapping.amount) {
            const v = parseFloat((get(mapping.amount) || '').replace(/[$,\s]/g, '')) || 0;
            amount = Math.abs(v);
            let mappedType = v >= 0 ? 'Ingreso' : 'Egreso';
            if (isCreditCard) {
                if (mappedType === 'Ingreso') mappedType = 'Transferencia';
            }
            type = mappedType;
        }

        return { _idx: idx, date: normalizarFecha(rawDate), concept, amount, type, client: 'N/A', categoria: categorizarTransaccion(concept) };
    }).filter(r => r.amount > 0);
}

// ─── Component ───────────────────────────────────────────────────────────────

const PERIODOS_FIN = [
    { value: '1m', label: 'Este mes' },
    { value: '3m', label: '3 meses' },
    { value: '6m', label: '6 meses' },
    { value: '1y', label: 'Este año' },
    { value: 'Todos', label: 'Todos' },
];

function getFechaInicioFin(periodo) {
    const now = new Date();
    switch (periodo) {
        case '1m': return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        case '3m': return new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split('T')[0];
        case '6m': return new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString().split('T')[0];
        case '1y': return new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        case 'Todos': return '2000-01-01';
        default:   return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    }
}

export default function FinanzasPage() {
    const [transactions, setTransactions] = useState([]);
    const [tradingOps, setTradingOps] = useState([]);
    const [portfolioAssets, setPortfolioAssets] = useState([]);
    const [userConfig, setUserConfig] = useState({ concepto_custom_label: 'Por Cobrar', concepto_custom_total: 0 });
    const [periodo, setPeriodo] = useState('1m');
    const [accountType, setAccountType] = useState('debit'); // 'debit' | 'credit'
    const [selectedCard, setSelectedCard] = useState('global'); // 'global' | bank name
    const [mesFilter, setMesFilter] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditingCustomCard, setIsEditingCustomCard] = useState(false);
    const [customCardForm, setCustomCardForm] = useState({ label: '', monto: '' });

    // CSV import state
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [importStep, setImportStep] = useState(1); // 1=upload/map, 2=preview
    const [csvHeaders, setCsvHeaders] = useState([]);
    const [csvRawRows, setCsvRawRows] = useState([]);
    const [csvMapping, setCsvMapping] = useState({ date: '', concept: '', amount: '', charge: '', credit: '' });
    const [pendingRows, setPendingRows] = useState([]);
    const [isImporting, setIsImporting] = useState(false);
    const [importResult, setImportResult] = useState(null); // { ok, count }
    const [nvaIntelligence, setNvaIntelligence] = useState(null);
    const [isParsing, setIsParsing] = useState(false);
    const [pendingPdfFile, setPendingPdfFile] = useState(null);
    const [pdfBankInfo, setPdfBankInfo] = useState(null); // { banco, saldo_anterior, saldo_final }
    const [bankBalance, setBankBalance] = useState(null); // persisted last import balance
    const [isCreditCard, setIsCreditCard] = useState(false);
    const [showPdfPassword, setShowPdfPassword] = useState(false);
    const [pdfPassword, setPdfPassword] = useState('');
    const [pdfPasswordError, setPdfPasswordError] = useState(false);
    const [accountTypeMismatch, setAccountTypeMismatch] = useState(null); // { detectedType, pendingData }
    const fileInputRef = useRef(null);

    // Credit Mode Config State
    const [isEditingCreditConfig, setIsEditingCreditConfig] = useState(false);
    const [creditConfig, setCreditConfig] = useState({
        limit: 50000,
        statementBalance: '',
        noInterestPayment: '',
        cutoffDate: '',
        paymentDate: ''
    });

    // creditConfig loaded per-user in the mount effect below

    const handleSaveCreditConfig = async (e) => {
        e.preventDefault();
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) localStorage.setItem(`fnce_credit_config_${user.id}_${selectedCard}`, JSON.stringify(creditConfig));
        setIsEditingCreditConfig(false);
        toast.success("Configuración de tarjeta guardada");
    };

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const [txRes, tradingRes, portfolioRes, configRes] = await Promise.all([
                supabase.from('transactions').select('*').eq('user_id', user?.id).order('date', { ascending: false }),
                supabase.from('trading_operations').select('date, pnl, status').eq('user_id', user?.id),
                supabase.from('portfolio_assets').select('quantity, avg_buy_price').eq('user_id', user?.id),
                supabase.from('user_config').select('concepto_custom_label, concepto_custom_total').eq('user_id', user?.id).maybeSingle(),
            ]);

            if (txRes.error) console.error("Error fetching transactions:", txRes.error);
            else {
                const formattedData = (txRes.data || []).map(t => ({
                    ...t,
                    date: t.date ? new Date(t.date).toISOString().split('T')[0] : ''
                }));
                setTransactions(formattedData);
            }

            setTradingOps((tradingRes.data || []).map(t => ({
                ...t,
                date: t.date ? new Date(t.date).toISOString().split('T')[0] : ''
            })));
            setPortfolioAssets(portfolioRes.data || []);
            if (configRes.data) {
                setUserConfig({
                    concepto_custom_label: configRes.data.concepto_custom_label || 'Por Cobrar',
                    concepto_custom_total: Number(configRes.data.concepto_custom_total) || 0,
                });
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!user?.id) return;
            try {
                // Try legacy key first for backward compat
                const raw = localStorage.getItem(`nva_bank_balance_${user.id}`);
                if (raw) setBankBalance(JSON.parse(raw));
            } catch (_) {}
            try {
                const rawCC = localStorage.getItem(`fnce_credit_config_${user.id}`);
                if (rawCC) setCreditConfig(JSON.parse(rawCC));
            } catch (_) {}
        });
    }, []);

    useEffect(() => {
        const saved = getFilter('finanzas');
        if (saved) setPeriodo(saved);
    }, []);


    // Load per-card creditConfig + bankBalance when selectedCard changes
    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!user?.id) return;
            // Credit config
            const ccKey = `fnce_credit_config_${user.id}_${selectedCard}`;
            const rawCC = localStorage.getItem(ccKey);
            if (rawCC) {
                try { setCreditConfig(JSON.parse(rawCC)); } catch (_) {}
            } else {
                setCreditConfig({ limit: 50000, statementBalance: '', noInterestPayment: '', cutoffDate: '', paymentDate: '' });
            }
            // Bank balance (debit) — per-card key
            if (selectedCard !== 'global') {
                const bbKey = `nva_bank_balance_${user.id}_${selectedCard.toLowerCase().replace(/\s+/g, '_')}`;
                const rawBB = localStorage.getItem(bbKey);
                if (rawBB) {
                    try { setBankBalance(JSON.parse(rawBB)); } catch (_) {}
                } else {
                    setBankBalance(null);
                }
            } else {
                // Global: try legacy key
                const rawBB = localStorage.getItem(`nva_bank_balance_${user.id}`);
                if (rawBB) {
                    try { setBankBalance(JSON.parse(rawBB)); } catch (_) {}
                } else {
                    setBankBalance(null);
                }
            }
        });
    }, [selectedCard]);

    // One-time migration: rename 'Gasto Personal' → 'Egreso' in Supabase
    useEffect(() => {
        supabase.from('transactions')
            .update({ type: 'Egreso' })
            .eq('type', 'Gasto Personal')
            .then(({ error }) => { if (error) console.error('Migration:', error); });
    }, []);

    // ── Import handlers ──────────────────────────────────────────────────────
    const handleBankConnected = async (link, institution) => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/belvo/transactions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ link_id: link })
            });
            const data = await res.json();
            
            if (data.success && data.transactions && data.transactions.length > 0) {
                const { data: { user } } = await supabase.auth.getUser();
                const toInsert = data.transactions.map(tx => ({
                    ...tx,
                    user_id: user.id
                }));
                // Usamos upsert o insert para evitar duplicados en schema (requiere UNIQUE constraint external_id)
                const { error } = await supabase.from('transactions').insert(toInsert);
                if (error) {
                    console.error("DB Error:", error);
                    toast.error("Las transacciones fueron bajadas pero hubo un problema guardándolas.");
                } else {
                    toast.success(`Se importaron ${data.count} transacciones de ${institution.name}.`);
                    fetchData();
                }
            } else {
                toast.info("No se encontraron transacciones nuevas en esta cuenta.");
            }
        } catch (error) {
            console.error("Belvo logic error:", error);
            toast.error("Ocurrió un error sincronizando con el banco.");
        } finally {
            setIsLoading(false);
        }
    };

    const parsePdfFile = async (file, password = '') => {
        setIsParsing(true);
        try {
            const fd = new FormData();
            fd.append('file', file);

            const res = await fetch('/api/analyze', { method: 'POST', body: fd });
            const data = await res.json();

            if (!res.ok || !data.success) {
                toast.error(data.error || 'No se pudo analizar el archivo.');
                return;
            }

            const rawTipo = String(data.tipo_cuenta || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const tipoCuenta = rawTipo.startsWith('cred') ? 'credito' : 'debito';
            const rows = (data.transactions ?? []).map((t, idx) => ({
                _idx: idx,
                date: t.fecha,
                concept: t.concepto || `Transacción ${idx + 1}`,
                amount: Math.abs(Number(t.monto) || 0),
                type: t.tipo === 'ajuste' ? 'Ajuste' : (t.tipo === 'ingreso' || t.tipo === 'abono') ? 'Ingreso' : 'Egreso',
                client: 'N/A',
                categoria: t.categoria || 'Otros',
                account_type: tipoCuenta,
                bank: t.banco || data.bank || 'Desconocido',
            })).filter(r => r.amount > 0);

            if (rows.length === 0) {
                toast.warning('No se encontraron transacciones en el archivo.');
                return;
            }

            setPendingRows(rows);
            setPdfBankInfo({ banco: data.bank || 'Banco', tipo_cuenta: tipoCuenta, saldo_anterior: data.saldo_anterior || 0, saldo_final: data.saldo_final || 0, periodo: data.periodo || '' });
            // Auto-populate creditConfig if credit card statement
            if (tipoCuenta === 'credito' && data.credito_info) {
                const ci = data.credito_info;
                const newCreditConfig = {
                    limit: ci.limite_credito || creditConfig.limit || 50000,
                    statementBalance: ci.pago_sin_intereses || ci.pago_minimo || '',
                    noInterestPayment: ci.pago_sin_intereses || '',
                    cutoffDate: ci.dia_corte || creditConfig.cutoffDate || '',
                    paymentDate: ci.dia_pago || creditConfig.paymentDate || '',
                    pagoMinimo: ci.pago_minimo || '',
                    interesesPeriodo: ci.intereses_periodo || 0,
                    deudaAlCorte: data.saldo_final || 0,
                    mesesPagoMinimo: ci.meses_pago_minimo || 0,
                    totalInteresesMinimo: ci.total_intereses_minimo || 0,
                    cat: ci.cat || 0,
                };
                setCreditConfig(newCreditConfig);
                // Persist per-user (user id available in outer try block)
                const { data: { user: u } } = await (await import('@/lib/supabaseClient')).supabase.auth.getUser();
                if (u?.id) localStorage.setItem(`fnce_credit_config_${u.id}_${data.bank || 'global'}`, JSON.stringify(newCreditConfig));
            }
            // Persist balance for dashboard
            try {
                const { data: { user } } = await (await import('@/lib/supabaseClient')).supabase.auth.getUser();
                if (user?.id) {
                    const balanceData = {
                        banco: data.bank || 'Banco',
                        saldo_anterior: data.saldo_anterior || 0,
                        saldo_final: data.saldo_final || 0,
                        periodo: data.periodo || '',
                        account_type: tipoCuenta,
                        updated_at: new Date().toISOString(),
                    };
                    const bankKey = `nva_bank_balance_${user.id}_${(data.bank || 'global').toLowerCase().replace(/\s+/g, '_')}`;
                    localStorage.setItem(bankKey, JSON.stringify(balanceData));
                    setBankBalance(balanceData);
                }
            } catch (_) {}
            // Warn if statement type doesn't match the active tab
            const expectedType = accountType === 'credit' ? 'credito' : 'debito';
            if (tipoCuenta !== expectedType) {
                setAccountTypeMismatch({ detectedType: tipoCuenta, rows, bankInfo: { banco: data.bank || 'Banco', tipo_cuenta: tipoCuenta, saldo_anterior: data.saldo_anterior || 0, saldo_final: data.saldo_final || 0, periodo: data.periodo || '' } });
                return;
            }
            setImportStep(2);
            toast.success(`${rows.length} transacciones detectadas de ${data.bank || 'tu banco'}.`);
        } catch (err) {
            console.error('[parsePdfFile]', err);
            toast.error('Error al procesar el archivo PDF.');
        } finally {
            setShowPdfPassword(false);
            setPendingPdfFile(null);
            setPdfPassword('');
            setIsParsing(false);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        const isPDF = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';

        if (isPDF) {
            setShowPdfPassword(false);
            setPdfPassword('');
            setPdfPasswordError(false);

            try {
                const buffer = await file.arrayBuffer();
                const text = new TextDecoder('iso-8859-1').decode(new Uint8Array(buffer));
                if (text.includes('/Encrypt')) {
                    setPendingPdfFile(file);
                    setShowPdfPassword(true);
                    return;
                }
            } catch (err) {
                console.warn('Error pre-chequeo PDF:', err);
            }

            await parsePdfFile(file);
        } else {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const allRows = parseCSV(ev.target.result);
                if (allRows.length < 2) return;
                const [headerRow, ...dataRows] = allRows;
                const headers = headerRow.map(h => h.replace(/^["']|["']$/g, ''));
                const mapping = autoDetect(headers);
                setCsvHeaders(headers);
                setCsvRawRows(dataRows);
                setCsvMapping(mapping);
            };
            reader.readAsText(file, 'UTF-8');
        }
    };

    const handlePreview = () => {
        const rows = buildRows(csvRawRows, csvHeaders, csvMapping, isCreditCard);
        setPendingRows(rows);
        setImportStep(2);
    };

    const updatePendingRow = (idx, field, value) => {
        setPendingRows(prev => prev.map(r => r._idx === idx ? { ...r, [field]: value } : r));
    };

    const handleBulkType = (type) => {
        setPendingRows(prev => prev.map(r => ({ ...r, type })));
    };

    const handleConfirmImport = async () => {
        setIsImporting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No hay sesión activa. Vuelve a iniciar sesión.');

            const payload = pendingRows.map(r => ({
                date: r.date, concept: r.concept, amount: r.amount,
                type: r.type, client: r.client || 'N/A',
                categoria: r.categoria || 'Otros',
                account_type: r.account_type || (isCreditCard ? 'credito' : 'debito'),
                bank: r.bank || 'Desconocido',
                user_id: user.id,
            }));
            const { error } = await supabase.from('transactions').insert(payload);
            if (error) {
                console.error('Supabase import error:', JSON.stringify(error), error?.message, error?.code);
                throw new Error(error?.message || error?.code || 'Error al guardar en Supabase');
            }
            setImportResult({ ok: true, count: payload.length, errorMsg: null });
            setFilter('finanzas', 'Todos');
            setPeriodo('Todos');
            await fetchData();
        } catch (e) {
            console.error('Import error:', e?.message || JSON.stringify(e));
            setImportResult({ ok: false, count: 0, errorMsg: e?.message || 'Error desconocido al importar' });
        } finally {
            setIsImporting(false);
        }
    };

    const resetImport = () => {
        setIsImportOpen(false);
        setImportStep(1);
        setCsvHeaders([]);
        setCsvRawRows([]);
        setCsvMapping({ date: '', concept: '', amount: '', charge: '', credit: '' });
        setPendingRows([]);
        setImportResult(null);
        setShowPdfPassword(false);
        setPendingPdfFile(null);
        setPdfPassword('');
        setPdfPasswordError(false);
        setPdfBankInfo(null);
        if (importStep !== 2) setNvaIntelligence(null); // Keep it visible after successful import or reset manually
    };

    const [modalType, setModalType] = useState("Ingreso"); // Ingreso or Egreso
    const [editingTransaction, setEditingTransaction] = useState(null);
    const [activeFilter, setActiveFilter] = useState("Todos");
    const [highlightedTxId, setHighlightedTxId] = useState(null);
    const [showTransactions, setShowTransactions] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        client: "",
        concept: "",
        amount: "",
        categoria: "Otros",
    });

    const fechaInicio = getFechaInicioFin(periodo);

    // Period-filtered transactions for totals and table
    // Available cards per account type (for card switcher)
    const availableDebitCards = useMemo(() =>
        [...new Set(transactions.filter(t => (t.account_type || 'debito') === 'debito' && t.bank && t.bank !== 'Desconocido' && t.date >= fechaInicio).map(t => t.bank))].sort()
    , [transactions, fechaInicio]);
    const availableCreditCards = useMemo(() =>
        [...new Set(transactions.filter(t => t.account_type === 'credito' && t.bank && t.bank !== 'Desconocido' && t.date >= fechaInicio).map(t => t.bank))].sort()
    , [transactions, fechaInicio]);

    // Reset selectedCard when switching account type; auto-select if only 1 card
    useEffect(() => {
        const cards = accountType === 'credit' ? availableCreditCards : availableDebitCards;
        if (cards.length === 1) setSelectedCard(cards[0]);
        else setSelectedCard('global');
    }, [accountType, availableCreditCards, availableDebitCards]);

    const filteredTx = useMemo(() => {
        const targetType = accountType === 'credit' ? 'credito' : 'debito';
        return transactions.filter(t => {
            if (t.date < fechaInicio) return false;
            const at = t.account_type || 'debito';
            if (at !== targetType) return false;
            if (selectedCard !== 'global' && t.bank !== selectedCard) return false;
            return true;
        });
    }, [transactions, fechaInicio, accountType, selectedCard]);

    const totalIngresosBase = filteredTx.filter(t => t.type?.toLowerCase().trim() === 'ingreso').reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const totalEgresos = filteredTx.filter(t => t.type?.toLowerCase().trim() === 'egreso').reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

    // Trading income: positive P&L from closed trades in the period
    const tradingIncome = tradingOps
        .filter(t => t.date >= fechaInicio && t.status === 'Cerrado' && Number(t.pnl) > 0)
        .reduce((s, t) => s + Number(t.pnl), 0);

    const totalIngresos = totalIngresosBase + tradingIncome;

    // Portfolio: total cost basis from portfolio_assets
    const totalPortfolioInvested = portfolioAssets.reduce((s, a) => s + ((a.quantity || 0) * (a.avg_buy_price || 0)), 0);

    const gananciaNeta = totalIngresos - totalEgresos;

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
    };

    const openModal = (type, transactionToEdit = null) => {
        setModalType(type);
        if (transactionToEdit) {
            setEditingTransaction(transactionToEdit);
            setFormData({
                date: transactionToEdit.date,
                client: transactionToEdit.client === 'N/A' ? '' : transactionToEdit.client,
                concept: transactionToEdit.concept,
                amount: transactionToEdit.amount.toString(),
                categoria: transactionToEdit.categoria || 'Otros',
            });
        } else {
            setEditingTransaction(null);
            setFormData({
                date: new Date().toISOString().split('T')[0],
                client: "",
                concept: "",
                amount: "",
                categoria: categoriasParaTipo(type)[0],
            });
        }
        setIsModalOpen(true);
    };

    const [itemToDelete, setItemToDelete] = useState(null);
    const [showClearAll, setShowClearAll] = useState(false);
    const [showClearMemory, setShowClearMemory] = useState(false);
    const [multiCardHintDismissed, setMultiCardHintDismissed] = useState(
        typeof window !== 'undefined' && !!localStorage.getItem('fnce_multi_card_hint')
    );

    const handleDelete = (id) => {
        setItemToDelete(id);
    };

    const confirmClearMemory = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) return;
        // Remove all per-user localStorage keys
        const keysToRemove = Object.keys(localStorage).filter(k =>
            k.includes(user.id) || k.startsWith('fnce_') || k.startsWith('nva_')
        );
        keysToRemove.forEach(k => localStorage.removeItem(k));
        // Reset state
        setBankBalance(null);
        setCreditConfig({ limit: 50000, statementBalance: '', noInterestPayment: '', cutoffDate: '', paymentDate: '' });
        setShowClearMemory(false);
        toast.success(`Memoria limpiada (${keysToRemove.length} entradas eliminadas).`);
    };

    const confirmClearAll = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        const isGlobal = selectedCard === 'global';
        let query = supabase.from('transactions').delete().eq('user_id', user?.id);
        if (!isGlobal) query = query.eq('bank', selectedCard);
        const { error } = await query;

        if (error) {
            console.error("Error clearing transactions:", error);
            toast.error("Error al limpiar las transacciones.");
        } else {
            if (isGlobal) {
                setTransactions([]);
                setBankBalance(null);
                localStorage.removeItem(`nva_bank_balance_${user.id}`);
                localStorage.removeItem(`fnce_credit_config_${user.id}`);
                setCreditConfig({ limit: 50000, statementBalance: '', noInterestPayment: '', cutoffDate: '', paymentDate: '' });
            } else {
                setTransactions(prev => prev.filter(t => t.bank !== selectedCard));
                setBankBalance(null);
                const bankKey = `nva_bank_balance_${user.id}_${selectedCard.toLowerCase().replace(/\s+/g, '_')}`;
                localStorage.removeItem(bankKey);
                localStorage.removeItem(`fnce_credit_config_${user.id}_${selectedCard}`);
            }
            toast.success("Transacciones eliminadas.");
        }
        setShowClearAll(false);
    };

    const confirmDelete = async () => {
        if (itemToDelete) {
            const { error } = await supabase
                .from('transactions')
                .delete()
                .eq('id', itemToDelete);

            if (error) {
                console.error("Error deleting transaction:", error);
                toast.error("Error al eliminar la transacción.");
            } else {
                setTransactions(transactions.filter(t => t.id !== itemToDelete));
            }
            setItemToDelete(null);
        }
    };

    const handleSelectTransaction = (txId) => {
        setMesFilter('');
        setActiveFilter('Todos');
        setHighlightedTxId(txId);
        setShowTransactions(true);
        setTimeout(() => {
            const el = document.getElementById(`tx-${txId}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => setHighlightedTxId(null), 3000);
            }
        }, 200);
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!formData.concept || !formData.amount || !formData.date) {
            toast.error("Por favor completa los campos requeridos.");
            return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        const payload = {
            date: formData.date,
            client: formData.client || "N/A",
            concept: formData.concept,
            type: modalType,
            amount: parseFloat(formData.amount),
            categoria: formData.categoria || 'Otros',
            user_id: user?.id,
        };

        if (editingTransaction) {
            const { data, error } = await supabase
                .from('transactions')
                .update(payload)
                .eq('id', editingTransaction.id)
                .select();

            if (error) {
                console.error("Error updating transaction:", error);
                toast.error("Error al actualizar la transacción.");
            } else if (data?.[0]) {
                const updated = transactions.map(t => t.id === editingTransaction.id ? data[0] : t);
                setTransactions(updated.sort((a, b) => new Date(b.date) - new Date(a.date)));
            }
        } else {
            const { data, error } = await supabase
                .from('transactions')
                .insert([payload])
                .select();

            if (error) {
                console.error("Error creating transaction:", error);
                toast.error("Error al crear la transacción.");
            } else if (data?.[0]) {
                const updated = [data[0], ...transactions];
                setTransactions(updated.sort((a, b) => new Date(b.date) - new Date(a.date)));
            }
        }

        setIsModalOpen(false);
    };

    const getLast3MonthsData = () => {
        const data = [];
        const today = new Date();
        for (let i = 2; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);

            const monthData = {
                label: d.toLocaleString('es-MX', { month: 'short' }),
                ingresos: 0,
                egresos: 0,
                inversiones: 0,
            };

            transactions.forEach(t => {
                const [tYear, tMonth] = t.date.split('-');
                if (parseInt(tYear) === d.getFullYear() && parseInt(tMonth) === d.getMonth() + 1) {
                    const ttype = t.type?.toLowerCase().trim();
                    if (ttype === 'ingreso') monthData.ingresos += (Number(t.amount) || 0);
                    if (ttype === 'egreso') monthData.egresos += (Number(t.amount) || 0);
                    if (ttype === 'inversión') monthData.inversiones += (Number(t.amount) || 0);
                }
            });

            data.push(monthData);
        }
        return data;
    };

    const chartData = getLast3MonthsData();
    const maxAmount = Math.max(...chartData.flatMap(d => [d.ingresos, d.egresos, d.inversiones]), 100);

    // ── Analysis section ──────────────────────────────────────────────────────
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const analysisData = useMemo(() => {
        const egresos = filteredTx.filter(t => t.type?.toLowerCase().trim() === 'egreso');
        const totalEgresosAll = egresos.reduce((s, t) => s + (t.amount || 0), 0);
        if (totalEgresosAll === 0) return [];
        const byCategory = {};
        egresos.forEach(t => {
            const cat = t.categoria || 'Otros';
            if (!byCategory[cat]) byCategory[cat] = { total: 0, count: 0 };
            byCategory[cat].total += t.amount || 0;
            byCategory[cat].count++;
        });
        return Object.entries(byCategory)
            .map(([name, { total, count }]) => ({
                name,
                total,
                count,
                pct: (total / totalEgresosAll) * 100,
            }))
            .sort((a, b) => b.total - a.total);
    }, [filteredTx]);

    const monthTx = useMemo(() => filteredTx.filter(t => {
        const [y, m] = (t.date || '').split('-');
        return parseInt(y) === currentYear && parseInt(m) === currentMonth;
    }), [filteredTx, currentMonth, currentYear]);

    // Dynamic month options for the table filter
    const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const mesOpciones = useMemo(() => {
        const hoy = new Date();
        const opciones = [];
        for (let anio = hoy.getFullYear(); anio >= hoy.getFullYear() - 1; anio--) {
            MESES.forEach((mes, i) => {
                opciones.push({ label: `${mes} ${anio}`, value: `${anio}-${String(i + 1).padStart(2, '0')}` });
            });
        }
        return opciones;
    }, []);

    const monthIngresos = monthTx.filter(t => t.type?.toLowerCase().trim() === 'ingreso').reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const monthEgresos  = monthTx.filter(t => t.type?.toLowerCase().trim() === 'egreso').reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const monthNeta = monthIngresos - monthEgresos;

    const prevMonthNeta = useMemo(() => {
        const prev = new Date(currentYear, currentMonth - 2, 1);
        const prevStart = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-01`;
        const prevEnd = new Date(currentYear, currentMonth - 1, 0).toISOString().split('T')[0];
        const prevTx = transactions.filter(t => t.date >= prevStart && t.date <= prevEnd);
        const prevIn = prevTx.filter(t => t.type?.toLowerCase().trim() === 'ingreso').reduce((s, t) => s + Number(t.amount || 0), 0);
        const prevOut = prevTx.filter(t => t.type?.toLowerCase().trim() === 'egreso').reduce((s, t) => s + Number(t.amount || 0), 0);
        return prevIn - prevOut;
    }, [transactions, currentMonth, currentYear]);

    const heroBadgePct = prevMonthNeta !== 0
        ? ((monthNeta - prevMonthNeta) / Math.abs(prevMonthNeta)) * 100
        : null;

    const heroAbs = formatCurrency(Math.abs(gananciaNeta));
    const [heroInt, heroDec] = heroAbs.split('.');

    // Datos reales para el modo crédito
    // En tarjeta crédito: Ingreso = pago recibido, Ajuste = devolución/reembolso
    const cargosPeriodo = filteredTx.filter(t => t.type === 'Egreso').reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const pagosPeriodo = filteredTx.filter(t => t.type === 'Ingreso' || t.type === 'Transferencia').reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const ajustesPeriodo = filteredTx.filter(t => t.type === 'Ajuste').reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

    const creditTx = transactions.filter(t =>
        t.account_type === 'credito' &&
        (selectedCard === 'global' || t.bank === selectedCard)
    );
    const historicoCargos = creditTx.filter(t => t.type === 'Egreso').reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const historicoPagos = creditTx.filter(t => t.type === 'Ingreso' || t.type === 'Transferencia').reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const historicoAjustes = creditTx.filter(t => t.type === 'Ajuste').reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    
    const deudaActual = Number(creditConfig.deudaAlCorte) || Math.max(0, historicoCargos - historicoPagos - historicoAjustes);

    // Límite y cálculos
    const creditLimite = Number(creditConfig.limit) || 50000;
    const creditUtilizacion = creditLimite > 0 ? (deudaActual / creditLimite) * 100 : 0;
    const utilizationColor = creditUtilizacion < 30 ? '#22c55e' : creditUtilizacion < 70 ? '#eab308' : '#ef4444';

    const heroDeudaAbs = formatCurrency(deudaActual);
    const [heroDeudaInt, heroDeudaDec] = heroDeudaAbs.split('.');

    // Simulador
    const [simulatorMode, setSimulatorMode] = useState('total');
    const TASA_INTERES_MENSUAL = 0.0416;
    const pagoCorte = Number(creditConfig.statementBalance) || 0;
    const pagoNoInteres = Number(creditConfig.noInterestPayment) || pagoCorte || deudaActual;

    // Liquidez y cashflow
    const liquidezRestante = Math.max(0, creditLimite - deudaActual);
    const diasDelPeriodo = 30;
    const burnRateDiario = cargosPeriodo > 0 ? cargosPeriodo / diasDelPeriodo : 0;
    const diasHastaSaturacion = burnRateDiario > 0 ? Math.floor(liquidezRestante / burnRateDiario) : 999;

    // Debt intelligence
    const suscripcionesTx = filteredTx.filter(t => t.type === 'Egreso' && t.categoria === 'Suscripciones');
    const msiTx = filteredTx.filter(t => t.type === 'Egreso' && /\bmsi\b|meses sin inter/i.test(t.concept || ''));
    const totalSuscripciones = suscripcionesTx.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const totalMSI = msiTx.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const interesesPeriodo = Number(creditConfig.interesesPeriodo) || 0;
    const deudaComprometidaProxMes = totalSuscripciones + totalMSI;

    // Minimum payment consequence (from statement or calculated)
    const mesesPagoMinimo = Number(creditConfig.mesesPagoMinimo) || 0;
    const totalInteresesMinimo = Number(creditConfig.totalInteresesMinimo) || 0;
    const cat = Number(creditConfig.cat) || 0;
    // Fallback calculation if not in statement
    const pagoMinimoNum = Number(creditConfig.pagoMinimo) || deudaActual * 0.05;
    const tasaMensual = cat > 0 ? (cat / 100 / 12) : TASA_INTERES_MENSUAL;
    const mesesCalc = (deudaActual > 0 && pagoMinimoNum > deudaActual * tasaMensual)
        ? Math.ceil(Math.log(pagoMinimoNum / (pagoMinimoNum - deudaActual * tasaMensual)) / Math.log(1 + tasaMensual))
        : 0;
    const totalInteresesCalc = mesesCalc > 0 ? Math.round((pagoMinimoNum * mesesCalc) - deudaActual) : 0;
    const mesesMostrar = mesesPagoMinimo || mesesCalc;
    const interesesMostrar = totalInteresesMinimo || totalInteresesCalc;

    // Monthly historical analysis (all credit transactions, grouped by month)
    const creditMonthlyHistory = useMemo(() => {
        const map = {};
        creditTx.forEach(t => {
            if (!t.date) return;
            const month = t.date.slice(0, 7); // "2026-03"
            if (!map[month]) map[month] = { cargos: 0, pagos: 0, ajustes: 0 };
            if (t.type === 'Egreso') map[month].cargos += Number(t.amount) || 0;
            else if (t.type === 'Ingreso' || t.type === 'Transferencia') map[month].pagos += Number(t.amount) || 0;
            else if (t.type === 'Ajuste') map[month].ajustes += Number(t.amount) || 0;
        });
        return Object.entries(map)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, d]) => ({
                month,
                label: new Date(month + '-15').toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }),
                cargos: Math.round(d.cargos),
                pagos: Math.round(d.pagos),
                ajustes: Math.round(d.ajustes),
                neto: Math.round(d.pagos - d.cargos + d.ajustes), // positive = pagó más de lo que gastó
            }));
    }, [creditTx]);

    // Evolution narrative
    const firstMonth = creditMonthlyHistory[0];
    const lastMonth = creditMonthlyHistory[creditMonthlyHistory.length - 1];
    const prevMonth = creditMonthlyHistory[creditMonthlyHistory.length - 2];
    const maxCargos = Math.max(...creditMonthlyHistory.map(m => m.cargos), 1);

    // Last month narrative
    const lastMonthNarrative = lastMonth ? (() => {
        const { label, cargos, pagos, neto } = lastMonth;
        const partes = [`En ${label}:`];
        if (cargos > 0) partes.push(`gastaste ${formatCurrency(cargos)}`);
        if (pagos > 0) partes.push(`pagaste ${formatCurrency(pagos)}`);
        if (neto > 0) partes.push('evitaste intereses');
        else if (neto < -cargos * 0.1) partes.push('tu deuda creció');
        return partes.join(' · ');
    })() : null;

    // Trend vs previous month
    let trendVsPrev = null;
    if (prevMonth && lastMonth && prevMonth.cargos > 0) {
        const pct = ((lastMonth.cargos - prevMonth.cargos) / prevMonth.cargos) * 100;
        trendVsPrev = { pct: Math.round(Math.abs(pct)), direction: pct >= 0 ? 'up' : 'down' };
    }

    // Financial Health Score (0-100) — penaliza burn rate alto + deuda comprometida
    const scoreUtil = Math.max(0, (1 - Math.min(creditUtilizacion, 100) / 100) * 25);
    const scorePagoCompleto = historicoCargos > 0 ? Math.min(20, (historicoPagos / historicoCargos) * 20) : 20;
    const scoreLiquidez = creditLimite > 0 ? Math.min(10, (liquidezRestante / creditLimite) * 10) : 10;
    const scoreIntereses = interesesPeriodo > 0 ? 0 : 10;
    // Burn rate penalty: si burn > 50% del límite en el mes, penaliza
    const burnRateMensual = burnRateDiario * 30;
    const scoreBurn = creditLimite > 0 ? Math.max(0, 20 - (burnRateMensual / creditLimite) * 40) : 20;
    const scoreDeudaComp = deudaComprometidaProxMes < burnRateMensual * 0.2 ? 15 : Math.max(0, 15 - (deudaComprometidaProxMes / Math.max(burnRateMensual, 1)) * 20);
    const healthScore = Math.min(100, Math.round(scoreUtil + scorePagoCompleto + scoreLiquidez + scoreIntereses + scoreBurn + scoreDeudaComp));

    const riskLevel = healthScore >= 75 ? 'saludable' : healthScore >= 50 ? 'moderado' : healthScore >= 30 ? 'presion' : 'critico';
    const RISK = {
        saludable: { label: 'Saludable', color: '#22c55e', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)',  dotColor: '#22c55e' },
        moderado:  { label: 'Moderado',  color: '#eab308', bg: 'rgba(234,179,8,0.08)',  border: 'rgba(234,179,8,0.2)',  dotColor: '#eab308' },
        presion:   { label: 'Presión',   color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.2)', dotColor: '#f97316' },
        critico:   { label: 'Crítico',   color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.2)',  dotColor: '#ef4444' },
    };
    const risk = RISK[riskLevel];

    // Auto-insights — human language (consecuencias, no métricas)
    const autoInsights = [];
    if (creditUtilizacion >= 70) autoInsights.push({ Icon: AlertTriangle, iconColor: '#ef4444', text: `Ya usaste más del 70% de tu línea. Zona de presión financiera.` });
    else if (creditUtilizacion >= 30) autoInsights.push({ Icon: AlertTriangle, iconColor: '#eab308', text: `Usaste el ${Math.round(creditUtilizacion)}% de tu crédito disponible.` });
    else if (creditUtilizacion > 0) autoInsights.push({ Icon: CheckCircle2, iconColor: '#22c55e', text: `Usas solo el ${Math.round(creditUtilizacion)}% de tu línea. Muy bien.` });

    if (cargosPeriodo > 0 && historicoPagos < historicoCargos) autoInsights.push({ Icon: TrendingDown, iconColor: '#f87171', text: 'Tu deuda creció más de lo que pagaste este período.' });
    else if (historicoPagos > 0 && historicoPagos >= historicoCargos) autoInsights.push({ Icon: CheckCircle2, iconColor: '#22c55e', text: 'Pagaste más de lo que gastaste. Tu deuda disminuye.' });

    if (diasHastaSaturacion < 30 && burnRateDiario > 0) autoInsights.push({ Icon: AlertTriangle, iconColor: '#ef4444', text: `Gastando así agotarías tu crédito en ~${diasHastaSaturacion} días.` });
    else if (burnRateDiario > 0 && diasHastaSaturacion < 120) autoInsights.push({ Icon: BarChart2, iconColor: '#a78bfa', text: `Al ritmo actual, tu línea disponible dura ~${diasHastaSaturacion} días.` });

    if (totalSuscripciones > 0) autoInsights.push({ Icon: RefreshCw, iconColor: '#fb923c', text: `Tienes ${formatCurrency(totalSuscripciones)} en suscripciones que se cobran automáticamente.` });
    if (interesesPeriodo > 0) autoInsights.push({ Icon: TrendingDown, iconColor: '#f87171', text: `Pagaste ${formatCurrency(interesesPeriodo)} en intereses este período — dinero que no genera nada.` });
    if (deudaComprometidaProxMes > 0) autoInsights.push({ Icon: Lock, iconColor: '#a78bfa', text: `Ya comprometiste ${formatCurrency(deudaComprometidaProxMes)} del próximo mes (MSI + suscripciones).` });

    // Pago countdown
    const paymentDay = parseInt(creditConfig.paymentDate);
    let daysToPayment = null;
    if (!isNaN(paymentDay)) {
        const today = new Date();
        const cur = today.getDate();
        if (cur <= paymentDay) daysToPayment = paymentDay - cur;
        else {
            const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
            daysToPayment = (daysInMonth - cur) + paymentDay;
        }
    }

    const simulatedPayment = useMemo(() => {
        if (simulatorMode === 'minimo') return Number(creditConfig.pagoMinimo) || deudaActual * 0.05;
        if (simulatorMode === 'corte') return pagoCorte;
        return pagoNoInteres;
    }, [simulatorMode, deudaActual, pagoCorte, pagoNoInteres, creditConfig.pagoMinimo]);

    const simulatedRemaining = Math.max(0, deudaActual - simulatedPayment);
    const simulatedInterest = simulatorMode === 'total' ? 0 : simulatedRemaining * TASA_INTERES_MENSUAL;

    return (
        <div className="page-container">

            {/* Account type selector */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                <div className="period-filter-wrap fin-period-filter" style={{ background: 'var(--bg-elevated)', padding: '4px' }}>
                    <button className={`period-filter-btn ${accountType === 'debit' ? 'active' : ''}`} onClick={() => setAccountType('debit')} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Landmark size={12} /> Débito
                    </button>
                    <button className={`period-filter-btn ${accountType === 'credit' ? 'active' : ''}`} onClick={() => setAccountType('credit')} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <CreditCardIcon size={12} /> Crédito
                    </button>
                </div>
            </div>

            {/* Multi-card discovery hint — shown once when user has transactions */}
            {!isLoading && !multiCardHintDismissed && transactions.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(255,135,0,0.06)', border: '1px solid rgba(255,135,0,0.18)' }}>
                    <Info size={14} style={{ flexShrink: 0, color: 'var(--accent)', marginTop: '2px' }} />
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, flex: 1 }}>
                        Puedes importar estados de cuenta de múltiples tarjetas. Cada una tendrá su propio resumen — cambia entre ellas con las pestañas arriba.
                    </p>
                    <button
                        onClick={() => { localStorage.setItem('fnce_multi_card_hint', '1'); setMultiCardHintDismissed(true); }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '16px', lineHeight: 1, flexShrink: 0, padding: '0 2px' }}
                        aria-label="Cerrar"
                    >×</button>
                </div>
            )}

            {/* Card switcher — shows per-bank tabs */}
            {!isLoading && (() => {
                const cards = accountType === 'credit' ? availableCreditCards : availableDebitCards;
                if (cards.length === 0) return null;
                return (
                    <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '12px', scrollbarWidth: 'none' }}>
                        {cards.length > 1 && (
                            <button
                                onClick={() => setSelectedCard('global')}
                                style={{ flexShrink: 0, padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: selectedCard === 'global' ? 700 : 400, border: `1px solid ${selectedCard === 'global' ? 'var(--accent)' : 'var(--bg-border)'}`, background: selectedCard === 'global' ? 'rgba(255,135,0,0.12)' : 'transparent', color: selectedCard === 'global' ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer' }}
                            >
                                Global
                            </button>
                        )}
                        {cards.map(card => (
                            <button
                                key={card}
                                onClick={() => setSelectedCard(card)}
                                style={{ flexShrink: 0, padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: selectedCard === card ? 700 : 400, border: `1px solid ${selectedCard === card ? 'var(--accent)' : 'var(--bg-border)'}`, background: selectedCard === card ? 'rgba(255,135,0,0.12)' : 'transparent', color: selectedCard === card ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer' }}
                            >
                                {card}
                            </button>
                        ))}
                    </div>
                );
            })()}
            {/* Reset to global if card no longer exists */}
            {!isLoading && selectedCard !== 'global' && !(accountType === 'credit' ? availableCreditCards : availableDebitCards).includes(selectedCard) && setSelectedCard('global')}

            {/* Per-card page header */}
            {!isLoading && selectedCard !== 'global' && (
                <div style={{ marginBottom: '14px', padding: '14px 16px', borderRadius: '14px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.4px', lineHeight: 1 }}>{selectedCard}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>{accountType === 'credit' ? <><CreditCardIcon size={11} /> Tarjeta de Crédito</> : <><Landmark size={11} /> Cuenta de Débito</>}</span>
                            {bankBalance?.periodo ? ` · ${bankBalance.periodo}` : ''}
                        </div>
                    </div>
                    {(accountType === 'credit' ? availableCreditCards : availableDebitCards).length > 1 && (
                        <button
                            onClick={() => setSelectedCard('global')}
                            style={{ fontSize: '11px', color: 'var(--text-secondary)', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '20px', padding: '5px 12px', cursor: 'pointer', flexShrink: 0 }}
                        >
                            ← Global
                        </button>
                    )}
                </div>
            )}

            {/* Hero Balance */}
            {isLoading ? (
                <div className="fin-hero">
                    <div className="skeleton" style={{ height: '14px', width: '90px', margin: '0 auto 12px', borderRadius: '4px' }} />
                    <div className="skeleton" style={{ height: '52px', width: '220px', margin: '0 auto 12px', borderRadius: '8px' }} />
                    <div className="skeleton" style={{ height: '24px', width: '120px', margin: '0 auto', borderRadius: '20px' }} />
                </div>
            ) : accountType === 'credit' && creditTx.length === 0 ? (
                <div className="fin-hero" style={{ border: '1px dashed var(--bg-border)', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', minHeight: '120px' }}>
                    <CreditCardIcon size={32} style={{ color: 'var(--text-muted)' }} />
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Sin datos de tarjeta de crédito</p>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>Importa un estado de cuenta para ver tu análisis</p>
                </div>
            ) : accountType === 'credit' ? (
                <>
                    {/* RISK STATUS BANNER */}
                    <div style={{ marginBottom: '12px', padding: '14px 16px', borderRadius: '12px', background: risk.bg, border: `1px solid ${risk.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: risk.dotColor, boxShadow: `0 0 6px ${risk.dotColor}`, flexShrink: 0, display: 'inline-block' }} />
                            <div>
                                <p style={{ margin: 0, fontSize: '10px', fontWeight: 700, color: risk.color, textTransform: 'uppercase', letterSpacing: '1px' }}>
                                    Riesgo {risk.label}
                                </p>
                                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                                    {daysToPayment !== null
                                        ? daysToPayment <= 3 ? `¡Fecha límite en ${daysToPayment} días! Paga ahora.`
                                        : daysToPayment <= 10 ? `${daysToPayment} días para tu fecha límite de pago`
                                        : `Tu próximo pago vence en ${daysToPayment} días`
                                        : 'Configura tu tarjeta para activar alertas'}
                                </p>
                            </div>
                        </div>
                        <button className="btn-icon-sm" style={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0 }} onClick={() => setIsEditingCreditConfig(true)} title="Configurar">
                            <Settings size={16} />
                        </button>
                    </div>

                    {/* HEALTH SCORE */}
                    <div style={{ marginBottom: '12px', padding: '16px', borderRadius: '14px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Score de Salud Financiera</span>
                            <span style={{ fontSize: '20px', fontWeight: 800, color: risk.color }}>{healthScore}<span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>/100</span></span>
                        </div>
                        <div style={{ height: '6px', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                            <div style={{ width: `${healthScore}%`, height: '100%', background: `linear-gradient(90deg, ${risk.color}, ${healthScore > 70 ? '#22c55e' : risk.color})`, borderRadius: '999px', transition: 'width 0.6s ease-out' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Crítico</span>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Moderado</span>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Saludable</span>
                        </div>
                    </div>

                    {/* DEUDA HERO */}
                    <div className="fin-hero" style={{ position: 'relative', background: 'radial-gradient(ellipse at top, rgba(255,255,255,0.03), transparent)', border: '1px solid var(--bg-border)', borderRadius: '16px', paddingBottom: '16px' }}>
                        <p className="fin-hero-label" style={{ letterSpacing: '1.2px', opacity: 0.6, fontWeight: 500 }}>DEUDA REVOLVENTE</p>
                        <div className="fin-hero-amount" style={{ color: deudaActual === 0 ? '#34d399' : '#fff' }}>
                            <span className="fin-hero-int">{heroDeudaInt}</span>
                            <span className="fin-hero-dec">.{heroDeudaDec}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '10px' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>Crédito disponible</div>
                                <div style={{ fontSize: '14px', fontWeight: 700, color: '#34d399' }}>{formatCurrency(liquidezRestante)}</div>
                            </div>
                            {deudaComprometidaProxMes > 0 && (
                                <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '16px' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>Comprometido próx. mes</div>
                                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#a78bfa' }}>{formatCurrency(deudaComprometidaProxMes)}</div>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            ) : (
                <div className="fin-hero">
                    <p className="fin-hero-label">{selectedCard !== 'global' ? 'Balance Neto' : 'Balance Total'}</p>
                    <div className="fin-hero-amount">
                        <span className={`fin-hero-int${gananciaNeta < 0 ? ' negative' : ''}`}>{heroInt}</span>
                        <span className="fin-hero-dec">.{heroDec}</span>
                    </div>
                    {heroBadgePct !== null && (
                        <div className={`fin-hero-badge ${heroBadgePct >= 0 ? 'positive' : 'negative'}`}>
                            {heroBadgePct >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                            {Math.abs(heroBadgePct).toFixed(1)}% vs mes anterior
                        </div>
                    )}
                </div>
            )}

            {/* 💳 Saldos del último estado de cuenta importado */}
            {!isLoading && accountType === 'debit' && bankBalance && (bankBalance.saldo_anterior > 0 || bankBalance.saldo_final > 0) && (
                <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                    <div style={{ flex: 1, background: 'rgba(255,135,0,0.07)', border: '1px solid rgba(255,135,0,0.22)', borderRadius: '12px', padding: '12px 14px' }}>
                        <p style={{ margin: 0, fontSize: '10px', fontWeight: 600, color: 'rgba(255,135,0,0.8)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Saldo Anterior</p>
                        <p style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: 700, color: '#FF8700' }}>{formatCurrency(bankBalance.saldo_anterior)}</p>
                        <p style={{ margin: '2px 0 0', fontSize: '10px', color: 'var(--text-secondary)' }}>{bankBalance.banco}</p>
                    </div>
                    <div style={{ flex: 1, background: 'rgba(255,135,0,0.07)', border: '1px solid rgba(255,135,0,0.22)', borderRadius: '12px', padding: '12px 14px' }}>
                        <p style={{ margin: 0, fontSize: '10px', fontWeight: 600, color: 'rgba(255,135,0,0.8)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Saldo al Corte</p>
                        <p style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: 700, color: '#FF8700' }}>{formatCurrency(bankBalance.saldo_final)}</p>
                        <p style={{ margin: '2px 0 0', fontSize: '10px', color: 'var(--text-secondary)' }}>{bankBalance.periodo || bankBalance.banco}</p>
                    </div>
                </div>
            )}

            {/* UTILIZACIÓN — human language */}
            {!isLoading && accountType === 'credit' && creditTx.length > 0 && (
                <div style={{ marginTop: '12px', padding: '16px', borderRadius: '14px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ fontSize: '22px', fontWeight: 800, color: utilizationColor, letterSpacing: '-0.5px', lineHeight: 1 }}>
                                {Math.round(creditUtilizacion)}%
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '200px', lineHeight: 1.3 }}>
                                {creditUtilizacion >= 70 ? 'Ya usaste más de la mitad de tu línea.' :
                                 creditUtilizacion >= 30 ? `Usaste ${Math.round(creditUtilizacion)}% de tu crédito.` :
                                 creditUtilizacion > 0 ? 'Tienes mucho margen disponible.' : 'Sin deuda registrada.'}
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(deudaActual)}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>de {formatCurrency(creditLimite)}</div>
                        </div>
                    </div>
                    <div style={{ height: '6px', borderRadius: '999px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(creditUtilizacion, 100)}%`, height: '100%', background: utilizationColor, borderRadius: '999px', transition: 'width 0.5s ease-out' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                        <span style={{ color: '#22c55e' }}>0–30% Óptimo</span>
                        <span style={{ color: '#eab308' }}>30–70% Moderado</span>
                        <span style={{ color: '#ef4444' }}>70%+ Presión</span>
                    </div>
                </div>
            )}

            {/* 2x2 Metric grid */}
            {isLoading ? (
                <div className="fin-metric-grid">
                    <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
                </div>
            ) : accountType === 'credit' && creditTx.length > 0 ? (
                <div className="fin-metric-grid" style={{ marginTop: '12px' }}>
                    <div className="fin-metric-card">
                        <div className="fin-metric-icon" style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}>
                            <Wallet size={14} />
                        </div>
                        <span className="fin-metric-label">Puedes gastar</span>
                        <span className="fin-metric-value" style={{ color: '#60a5fa' }}>{formatCurrency(liquidezRestante)}</span>
                        <span className="fin-metric-hint">antes de saturar</span>
                    </div>
                    <div className="fin-metric-card">
                        <div className="fin-metric-icon" style={{ background: burnRateDiario > creditLimite / 60 ? 'rgba(248,113,113,0.12)' : 'rgba(251,191,36,0.12)', color: burnRateDiario > creditLimite / 60 ? '#f87171' : '#fbbf24' }}>
                            <TrendingUp size={14} />
                        </div>
                        <span className="fin-metric-label">Gastas por día</span>
                        <span className="fin-metric-value">{formatCurrency(burnRateDiario)}</span>
                        <span className="fin-metric-hint">este período</span>
                    </div>
                    <div className="fin-metric-card">
                        <div className="fin-metric-icon" style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171' }}>
                            <ArrowDownRight size={14} />
                        </div>
                        <span className="fin-metric-label">Cargos totales</span>
                        <span className="fin-metric-value">{formatCurrency(cargosPeriodo)}</span>
                        <span className="fin-metric-hint">este período</span>
                    </div>
                    <div className="fin-metric-card">
                        <div className="fin-metric-icon" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>
                            <ArrowUpRight size={14} />
                        </div>
                        <span className="fin-metric-label">Pagaste</span>
                        <span className="fin-metric-value" style={{ color: '#34d399' }}>{formatCurrency(pagosPeriodo)}</span>
                        <span className="fin-metric-hint">este período</span>
                    </div>
                </div>
            ) : (
                <div className="fin-metric-grid">
                    <div className="fin-metric-card">
                        <div className="fin-metric-icon" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>
                            <ArrowUpRight size={14} />
                        </div>
                        <span className="fin-metric-label amount-positive">Ingresos</span>
                        <span className="fin-metric-value amount-positive">{formatCurrency(totalIngresos)}</span>
                        {tradingIncome > 0 && <span className="fin-metric-hint">Trading +{formatCurrency(tradingIncome)}</span>}
                    </div>
                    <div className="fin-metric-card">
                        <div className="fin-metric-icon" style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171' }}>
                            <ArrowDownRight size={14} />
                        </div>
                        <span className="fin-metric-label amount-negative">Egresos</span>
                        <span className="fin-metric-value amount-negative">{formatCurrency(totalEgresos)}</span>
                    </div>
                    <div className="fin-metric-card" style={{ position: 'relative' }}>
                        <button
                            className="fin-metric-edit"
                            onClick={() => { setCustomCardForm({ label: userConfig.concepto_custom_label, monto: String(userConfig.concepto_custom_total) }); setIsEditingCustomCard(true); }}
                            title="Editar"
                        >
                            <Edit2 size={12} />
                        </button>
                        <div className="fin-metric-icon" style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}>
                            <Wallet size={14} />
                        </div>
                        <span className="fin-metric-label">{userConfig.concepto_custom_label}</span>
                        <span className="fin-metric-value">{formatCurrency(userConfig.concepto_custom_total)}</span>
                    </div>
                    <div className="fin-metric-card">
                        <div className="fin-metric-icon" style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}>
                            <TrendingUp size={14} />
                        </div>
                        <span className="fin-metric-label">Portafolio</span>
                        <span className="fin-metric-value">
                            {formatCurrency(totalPortfolioInvested)}
                        </span>
                        <span className="fin-metric-hint">Costo base</span>
                    </div>
                </div>
            )}

            {/* DEBT INTELLIGENCE + FORECASTING + SIMULATOR + INSIGHTS */}
            {!isLoading && accountType === 'credit' && creditTx.length > 0 && (
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
            )}

            {/* Action buttons */}
            <div className="fin-actions-bar">
                <button className="btn-fin-primary" data-tour="btn-nueva-transaccion" onClick={() => openModal("Ingreso")}>
                    <Plus size={13} /> Nueva
                </button>
                <button className="btn-fin-secondary" data-tour="btn-importar-csv" onClick={() => { setIsImportOpen(true); setImportStep(1); setImportResult(null); }}>
                    <Upload size={13} /> Importar
                </button>
                <div style={{ flex: 1 }} />
                {transactions.length > 0 && (
                    <button className="btn-fin-ghost" onClick={() => setShowClearAll(true)} title="Eliminar todas las transacciones">
                        <Trash2 size={13} />
                    </button>
                )}
                <button className="btn-fin-ghost" onClick={() => setShowClearMemory(true)} title="Limpiar memoria local de la app">
                    <RefreshCw size={13} />
                </button>
                <button className="btn-fin-ghost" onClick={openTutorial} title="Tutorial de la app">
                    <Info size={13} />
                </button>
            </div>

            {/* Period filter */}
            <div className="period-filter-wrap fin-period-filter" data-tour="filtros-periodo">
                {PERIODOS_FIN.map(p => (
                    <button
                        key={p.value}
                        className={`period-filter-btn ${periodo === p.value ? 'active' : ''}`}
                        onClick={() => { setFilter('finanzas', p.value); setPeriodo(p.value); }}
                    >{p.label}</button>
                ))}
            </div>

            {/* Type filter tabs */}
            <div data-tour="filtros-tipo" className="fin-type-tabs">
                {(accountType === 'credit' ? [
                    { value: 'Todos', label: 'Todos', count: filteredTx.length },
                    { value: 'Ingreso', label: 'Pagos', count: filteredTx.filter(t=>t.type==='Ingreso'||t.type==='Transferencia').length },
                    { value: 'Egreso', label: 'Cargos', count: filteredTx.filter(t=>t.type==='Egreso').length },
                    { value: 'Ajuste', label: 'Ajustes', count: filteredTx.filter(t=>t.type==='Ajuste').length },
                ] : [
                    { value: 'Todos', label: 'Todos', count: filteredTx.length },
                    { value: 'Ingreso', label: 'Ingreso', count: filteredTx.filter(t=>t.type==='Ingreso').length },
                    { value: 'Egreso', label: 'Egreso', count: filteredTx.filter(t=>t.type==='Egreso').length },
                    { value: 'Inversión', label: 'Inversión', count: filteredTx.filter(t=>t.type==='Inversión').length },
                    { value: userConfig.concepto_custom_label, label: userConfig.concepto_custom_label, count: filteredTx.filter(t=>t.type===userConfig.concepto_custom_label).length },
                ]).map(tab => (
                    <button
                        key={tab.value}
                        className={`period-filter-btn ${activeFilter === tab.value ? 'active' : ''}`}
                        onClick={() => setActiveFilter(tab.value)}
                    >
                        {tab.label}
                        {tab.count > 0 && (
                            <span className="fin-tab-count">{tab.count}</span>
                        )}
                    </button>
                ))}
            </div>

            {!isLoading && (
                <>
                    {activeFilter === 'Ingreso' ? (
                        <IngresosPorCategoria startDate={fechaInicio} accountType={accountType} bank={selectedCard} />
                    ) : (activeFilter === 'Egreso' || activeFilter === 'Todos') ? (
                        <>
                            <GastosPorCategoria startDate={fechaInicio} mode={accountType} accountType={accountType} bank={selectedCard} />
                            <GastosHormiga transactions={filteredTx} startDate={fechaInicio} onSelectTransaction={handleSelectTransaction} />
                        </>
                    ) : null}

                    <PLCalendar
                        transactions={selectedCard === 'global' ? transactions : transactions.filter(t => t.bank === selectedCard)}
                        accountType={accountType}
                    />

                    {/* Transactions toggle — glass pill */}
                    <button
                        onClick={() => setShowTransactions(v => !v)}
                        style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '14px 18px',
                            background: 'rgba(255,255,255,0.04)',
                            backdropFilter: 'blur(16px)',
                            WebkitBackdropFilter: 'blur(16px)',
                            border: '1px solid rgba(255,255,255,0.07)',
                            borderRadius: '28px',
                            boxShadow: '0 2px 16px rgba(0,0,0,0.12)',
                            cursor: 'pointer', touchAction: 'manipulation',
                            transition: 'background 0.2s',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Receipt size={15} style={{ color: 'var(--text-secondary)' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                                <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.1px' }}>Actividad reciente</span>
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    {filteredTx.length} movimientos registrados
                                </span>
                            </div>
                        </div>
                        <span style={{ fontSize: '16px', color: 'var(--text-secondary)', display: 'inline-block', transform: showTransactions ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease', lineHeight: 1 }}>⌄</span>
                    </button>

                    {showTransactions && (
                    <div style={{ animation: 'fadeSlideIn 0.25s ease forwards' }}>
                    <div className="card table-section fnce-dynamic-panel">
                        <div className="table-header">
                            <h2 className="summary-title" style={{ fontSize: "16px", color: "var(--text-primary)" }}>Transacciones Recientes</h2>
                            <div className="filters-group">
                                <select className="select-filter" value={mesFilter} onChange={e => setMesFilter(e.target.value)}>
                                    <option value="">Todos los meses</option>
                                    {mesOpciones.map(op => (
                                        <option key={op.value} value={op.value}>{op.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        {transactions.length === 0 ? (
                            <EmptyState
                                icon={<Receipt size={48} />}
                                title="Sin transacciones este mes"
                                description="Registra tu primer ingreso o egreso para empezar a ver tu balance."
                                action={{ label: "+ Nueva Transacción", onClick: () => openModal("Ingreso") }}
                            />
                        ) : (
                        <div className="table-responsive">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Cliente</th>
                                        <th>Concepto</th>
                                        <th>Tipo</th>
                                        <th>Monto</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(mesFilter ? filteredTx.filter(t => t.date?.startsWith(mesFilter)) : filteredTx)
                                        .filter(t => activeFilter === 'Todos' || t.type === activeFilter)
                                        .map(t => (
                                        <tr key={t.id} id={`tx-${t.id}`} className="table-row" style={highlightedTxId === t.id ? { background: 'rgba(255,122,26,0.12)', outline: '1px solid rgba(255,122,26,0.4)', borderRadius: '6px', transition: 'background 0.3s' } : undefined}>
                                            <td>{t.date}</td>
                                            <td>{t.client}</td>
                                            <td>{t.concept}</td>
                                            <td>
                                                {accountType === 'credit' ? (
                                                    <span className={`badge badge-${t.type.toLowerCase().replace(' ', '-')}`}>
                                                        {t.type === 'Transferencia' ? 'Pago' : t.type === 'Egreso' ? 'Cargo' : t.type === 'Ingreso' ? 'Ajuste' : t.type}
                                                    </span>
                                                ) : (
                                                    <span className={`badge badge-${t.type.toLowerCase().replace(' ', '-')}`}>
                                                        {t.type}
                                                    </span>
                                                )}
                                            </td>
                                            <td className={
                                                (t.type === 'Ingreso' ? 'amount-positive' :
                                                t.type === 'Egreso' ? 'amount-negative' :
                                                t.type === 'Inversión' ? 'amount-investment' :
                                                t.type === 'Por Cobrar' ? 'amount-por-cobrar' : '') + ' font-mono'
                                            }>
                                                {formatCurrency(t.amount)}
                                            </td>
                                            <td>
                                                <div className="actions-cell">
                                                    <button className="btn-icon-sm" onClick={() => openModal(t.type, t)}><Edit2 size={16} /></button>
                                                    <button className="btn-icon-sm" onClick={() => handleDelete(t.id)}><Trash2 size={16} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        )}
                    </div>
                    </div>
                    )}
                </>
            )}

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingTransaction ? 'Editar Transacción' : 'Nueva Transacción'}>
                <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} onSubmit={handleFormSubmit}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Tipo</label>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {(accountType === 'credit' ? [
                                { value: 'Transferencia', label: 'Pago', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
                                { value: 'Egreso', label: 'Cargo', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
                                { value: 'Ingreso', label: 'Ajuste', color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
                            ] : [
                                { value: 'Ingreso', label: 'Ingreso', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
                                { value: 'Egreso', label: 'Egreso', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
                                { value: 'Inversión', label: 'Inversión', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
                                { value: userConfig.concepto_custom_label, label: userConfig.concepto_custom_label, color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
                            ]).map(({ value, label, color, bg }) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => { setModalType(value); setFormData(prev => ({ ...prev, categoria: categoriasParaTipo(value)[0] })); }}
                                    style={{
                                        flex: 1,
                                        padding: '8px 4px',
                                        border: `2px solid ${modalType === value ? color : 'var(--border-color)'}`,
                                        borderRadius: '8px',
                                        background: modalType === value ? bg : 'transparent',
                                        color: modalType === value ? color : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        fontSize: '12px',
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Fecha *</label>
                        <input type="date" className="select-filter" style={{ width: '100%' }} required value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Cliente (Opcional)</label>
                        <input type="text" className="select-filter" placeholder="Nombre del cliente" style={{ width: '100%' }} value={formData.client} onChange={e => setFormData({ ...formData, client: e.target.value })} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Concepto *</label>
                        <input type="text" className="select-filter" placeholder="Ej. Pago inicial proyecto web" style={{ width: '100%' }} required value={formData.concept} onChange={e => setFormData({ ...formData, concept: e.target.value })} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Categoría</label>
                        <select className="select-filter" style={{ width: '100%' }} value={formData.categoria} onChange={e => setFormData({ ...formData, categoria: e.target.value })}>
                            {categoriasParaTipo(modalType).map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Monto *</label>
                        <CurrencyInput className="select-filter" placeholder="0.00" style={{ width: '100%' }} required value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                        <button type="button" className="btn-icon-sm glass" style={{ padding: '8px 16px', color: 'var(--text-primary)' }} onClick={() => setIsModalOpen(false)}>
                            Cancelar
                        </button>
                        <button type="submit" className="btn-primary">
                            Guardar Transacción
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={itemToDelete !== null} onClose={() => setItemToDelete(null)} title="Confirmar Eliminación">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <p style={{ color: 'var(--text-secondary)' }}>¿Estás seguro de que deseas eliminar este registro? Esta acción no se puede deshacer.</p>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                        <button type="button" className="btn-icon-sm glass" style={{ padding: '8px 16px', color: 'var(--text-primary)' }} onClick={() => setItemToDelete(null)}>
                            Cancelar
                        </button>
                        <button type="button" className="btn-primary" style={{ backgroundColor: 'var(--danger)', color: 'white' }} onClick={confirmDelete}>
                            Eliminar
                        </button>
                    </div>
                </div>
            </Modal>

            {/* ── Account type mismatch warning ── */}
            <Modal isOpen={!!accountTypeMismatch} onClose={() => setAccountTypeMismatch(null)} title="⚠️ Sección incorrecta">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ padding: '14px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px' }}>
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#ef4444' }}>
                            Estado de cuenta incorrecto
                        </p>
                        <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            Detectamos que este archivo es de una cuenta de{' '}
                            <strong style={{ color: 'var(--text-primary)' }}>
                                {accountTypeMismatch?.detectedType === 'credito' ? 'Crédito' : 'Débito'}
                            </strong>
                            {' '}pero estás en la sección de{' '}
                            <strong style={{ color: 'var(--text-primary)' }}>
                                {accountType === 'credit' ? 'Crédito' : 'Débito'}
                            </strong>.
                        </p>
                        <p style={{ margin: '8px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                            Banco detectado: <strong style={{ color: 'var(--text-primary)' }}>{accountTypeMismatch?.bankInfo?.banco}</strong>
                        </p>
                    </div>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Cambia a la pestaña correcta antes de importar, o continúa si estás seguro.
                    </p>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                        <button className="btn-secondary" onClick={() => setAccountTypeMismatch(null)}>
                            Cancelar
                        </button>
                        <button
                            className="btn-primary"
                            style={{ background: 'var(--danger)' }}
                            onClick={() => {
                                setPendingRows(accountTypeMismatch.rows);
                                setPdfBankInfo(accountTypeMismatch.bankInfo);
                                setAccountTypeMismatch(null);
                                setImportStep(2);
                                toast.warning('Importando en sección incorrecta — verifica tus datos.');
                            }}
                        >
                            Continuar de todas formas
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={showClearAll} onClose={() => setShowClearAll(false)} title={selectedCard === 'global' ? 'Limpiar todas las transacciones' : `Limpiar transacciones de ${selectedCard}`}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Se eliminarán <strong>{selectedCard === 'global' ? transactions.length : transactions.filter(t => t.bank === selectedCard).length}</strong> transacciones. Esta acción no se puede deshacer.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                        <button type="button" className="btn-icon-sm glass" style={{ padding: '8px 16px', color: 'var(--text-primary)' }} onClick={() => setShowClearAll(false)}>
                            Cancelar
                        </button>
                        <button type="button" className="btn-primary" style={{ backgroundColor: 'var(--danger)', color: 'white' }} onClick={confirmClearAll}>
                            Eliminar
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={showClearMemory} onClose={() => setShowClearMemory(false)} title="Limpiar memoria local">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.5 }}>
                        Se eliminará toda la memoria local de la app: saldos guardados, configuración de tarjeta, filtros y preferencias.<br /><br />
                        <strong style={{ color: 'var(--text-primary)' }}>Las transacciones en la base de datos NO se eliminan.</strong>
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                        <button type="button" className="btn-icon-sm glass" style={{ padding: '8px 16px', color: 'var(--text-primary)' }} onClick={() => setShowClearMemory(false)}>
                            Cancelar
                        </button>
                        <button type="button" className="btn-primary" style={{ backgroundColor: 'var(--danger)', color: 'white' }} onClick={confirmClearMemory}>
                            Limpiar memoria
                        </button>
                    </div>
                </div>
            </Modal>

            {/* ── Custom Card Edit Modal ── */}
            <Modal isOpen={isEditingCustomCard} onClose={() => setIsEditingCustomCard(false)} title="Editar tarjeta personalizada">
                <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} onSubmit={async (e) => {
                    e.preventDefault();
                    const { data: { user } } = await supabase.auth.getUser();
                    const newLabel = customCardForm.label.trim() || 'Por Cobrar';
                    const newMonto = parseFloat(customCardForm.monto) || 0;
                    const { error } = await supabase.from('user_config').upsert({
                        user_id: user.id,
                        concepto_custom_label: newLabel,
                        concepto_custom_total: newMonto,
                    }, { onConflict: 'user_id' });
                    if (!error) {
                        setUserConfig({ concepto_custom_label: newLabel, concepto_custom_total: newMonto });
                        setIsEditingCustomCard(false);
                    } else {
                        console.error('Error saving user_config:', error?.message);
                    }
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Nombre del concepto</label>
                        <input type="text" className="select-filter" style={{ width: '100%' }} placeholder="Ej: Ahorro, Por Cobrar, Meta..." value={customCardForm.label} onChange={e => setCustomCardForm(p => ({ ...p, label: e.target.value }))} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Monto</label>
                        <CurrencyInput className="select-filter" style={{ width: '100%' }} placeholder="0.00" value={customCardForm.monto} onChange={e => setCustomCardForm(p => ({ ...p, monto: e.target.value }))} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                        <button type="button" className="btn-icon-sm glass" style={{ padding: '8px 16px', color: 'var(--text-primary)' }} onClick={() => setIsEditingCustomCard(false)}>Cancelar</button>
                        <button type="submit" className="btn-primary">Guardar</button>
                    </div>
                </form>
            </Modal>

            {/* ── Credit Config Modal ── */}
            <Modal isOpen={isEditingCreditConfig} onClose={() => setIsEditingCreditConfig(false)} title="Configuración de Tarjeta">
                <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} onSubmit={handleSaveCreditConfig}>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                        Ajusta los parámetros de tu tarjeta para calcular tu utilización, saldo y cuenta regresiva.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Límite de Crédito</label>
                        <CurrencyInput className="select-filter" style={{ width: '100%' }} placeholder="Ej: 50,000" value={creditConfig.limit} onChange={e => setCreditConfig(p => ({ ...p, limit: e.target.value }))} required />
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                            <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Día de Corte</label>
                            <input type="number" className="select-filter" style={{ width: '100%' }} placeholder="Ej: 18" min="1" max="31" value={creditConfig.cutoffDate} onChange={e => setCreditConfig(p => ({ ...p, cutoffDate: e.target.value }))} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                            <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Día Límite de Pago</label>
                            <input type="number" className="select-filter" style={{ width: '100%' }} placeholder="Ej: 25" min="1" max="31" value={creditConfig.paymentDate} onChange={e => setCreditConfig(p => ({ ...p, paymentDate: e.target.value }))} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Saldo al corte</label>
                        <CurrencyInput className="select-filter" style={{ width: '100%' }} placeholder="0.00" value={creditConfig.statementBalance} onChange={e => setCreditConfig(p => ({ ...p, statementBalance: e.target.value }))} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Pago mínimo</label>
                        <CurrencyInput className="select-filter" style={{ width: '100%' }} placeholder="0.00" value={creditConfig.pagoMinimo || ''} onChange={e => setCreditConfig(p => ({ ...p, pagoMinimo: e.target.value }))} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Pago para no generar intereses</label>
                        <CurrencyInput className="select-filter" style={{ width: '100%' }} placeholder="0.00" value={creditConfig.noInterestPayment} onChange={e => setCreditConfig(p => ({ ...p, noInterestPayment: e.target.value }))} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                        <button type="button" className="btn-icon-sm glass" style={{ padding: '8px 16px', color: 'var(--text-primary)' }} onClick={() => setIsEditingCreditConfig(false)}>Cancelar</button>
                        <button type="submit" className="btn-primary">Guardar</button>
                    </div>
                </form>
            </Modal>

            {/* ── Import Modal ── */}
            <Modal isOpen={isImportOpen} onClose={resetImport} title="Importar Estado de Cuenta">
                <input ref={fileInputRef} type="file" accept=".csv,.pdf,text/csv,application/pdf" style={{ display: 'none' }} onChange={handleFileUpload} />

                {/* Result screen */}
                {importResult ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px 0' }}>
                        {importResult.ok ? (
                            <>
                                <CheckCircle2 size={48} color="var(--success)" />
                                <p style={{ fontWeight: 600, fontSize: '16px' }}>{importResult.count} transacciones importadas</p>
                                <div style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', background: 'rgba(255,135,0,0.07)', border: '1px solid rgba(255,135,0,0.2)', textAlign: 'center' }}>
                                    <p style={{ margin: '0 0 10px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                        ¿Tienes otra tarjeta o cuenta? Puedes importar múltiples estados de cuenta y ver el análisis de cada una por separado.
                                    </p>
                                    <button
                                        className="btn-cta-secondary"
                                        style={{ width: '100%', justifyContent: 'center' }}
                                        onClick={() => { setImportResult(null); setImportStep(1); setPendingRows([]); setPdfBankInfo(null); }}
                                    >
                                        <Upload size={14} /> Importar otra tarjeta
                                    </button>
                                </div>
                                <button className="btn-primary" style={{ width: '100%' }} onClick={resetImport}>Listo</button>
                            </>
                        ) : (
                            <>
                                <AlertCircle size={48} color="var(--danger)" />
                                <p style={{ color: 'var(--danger)', fontWeight: 600 }}>Error al importar</p>
                                {importResult.errorMsg && (
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center', maxWidth: '320px' }}>{importResult.errorMsg}</p>
                                )}
                                <button className="btn-secondary" onClick={() => setImportResult(null)}>Volver</button>
                            </>
                        )}
                    </div>
                ) : importStep === 1 ? (
                    /* Step 1: upload + column mapping */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '100px' }}>
                        <p style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
                            Sube tu estado de cuenta en PDF o CSV. Los PDF de BBVA, Banorte, Santander, HSBC, Citibanamex y Nu se procesan automáticamente.
                        </p>
                        <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--bg-border)', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            Puedes importar estados de múltiples tarjetas y cuentas. Cada una tendrá su propio análisis y podrás verlas de forma individual o en vista global.
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                            <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Tipo de Tarjeta (para clasificar abonos y retiros)</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    className={`btn-secondary ${!isCreditCard ? 'active' : ''}`}
                                    style={{ flex: 1, borderColor: !isCreditCard ? 'var(--brand)' : '', color: !isCreditCard ? 'var(--brand)' : '' }}
                                    onClick={() => setIsCreditCard(false)}
                                >
                                    Débito / Cheques
                                </button>
                                <button
                                    className={`btn-secondary ${isCreditCard ? 'active' : ''}`}
                                    style={{ flex: 1, borderColor: isCreditCard ? 'var(--brand)' : '', color: isCreditCard ? 'var(--brand)' : '' }}
                                    onClick={() => setIsCreditCard(true)}
                                >
                                    Crédito
                                </button>
                            </div>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{isCreditCard ? 'Los pagos a la tarjeta se registrarán como "Transferencia" (interno) y no sumarán a tus ingresos.' : 'Los depósitos se registrarán como "Ingreso" y los retiros como "Egreso".'}</p>
                        </div>


                        {isParsing ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '28px 16px', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                <div style={{ width: 36, height: 36, border: '3px solid rgba(255,122,26,0.2)', borderTopColor: '#FF7A1A', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
                                <div style={{ textAlign: 'center' }}>
                                    <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)', fontSize: '15px' }}>Analizando con IA...</p>
                                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>Esto puede tomar hasta 2 minutos</p>
                                </div>
                            </div>
                        ) : !showPdfPassword ? (
                            <button
                                className="btn-secondary"
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', padding: '12px', border: '2px dashed var(--border-color)', borderRadius: '8px', width: '100%' }}
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isParsing}
                            >
                                <Upload size={18} />
                                {csvHeaders.length > 0 ? `Archivo cargado (${csvRawRows.length} filas)` : 'Seleccionar archivo .pdf o .csv'}
                            </button>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Lock size={18} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                                    <div>
                                        <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>PDF protegido con contraseña</p>
                                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>Ingresa la contraseña para continuar</p>
                                    </div>
                                </div>
                                <input
                                    type="password"
                                    className="select-filter"
                                    style={{ width: '100%', fontSize: '14px', padding: '8px 12px', borderColor: pdfPasswordError ? 'var(--danger)' : undefined }}
                                    placeholder="Contraseña del PDF"
                                    value={pdfPassword}
                                    onChange={e => { setPdfPassword(e.target.value); setPdfPasswordError(false); }}
                                    onKeyDown={e => e.key === 'Enter' && !isParsing && pdfPassword && parsePdfFile(pendingPdfFile, pdfPassword)}
                                    autoFocus
                                />
                                {pdfPasswordError && (
                                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--danger)' }}>Contraseña incorrecta. Intenta de nuevo.</p>
                                )}
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        className="btn-secondary"
                                        style={{ flex: 1 }}
                                        onClick={() => { setShowPdfPassword(false); setPendingPdfFile(null); setPdfPassword(''); setPdfPasswordError(false); }}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        className="btn-primary"
                                        style={{ flex: 1 }}
                                        disabled={isParsing || !pdfPassword}
                                        onClick={() => parsePdfFile(pendingPdfFile, pdfPassword)}
                                    >
                                        {isParsing ? 'Procesando...' : 'Continuar'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {csvHeaders.length > 0 && (
                            <>
                                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '-8px' }}>Mapeo de columnas</p>
                                {[
                                    { key: 'date', label: 'Fecha *' },
                                    { key: 'concept', label: 'Concepto *' },
                                    { key: 'amount', label: 'Monto (columna única, + = ingreso)' },
                                    { key: 'charge', label: 'Cargo / Retiro (débito)' },
                                    { key: 'credit', label: 'Abono / Depósito (crédito)' },
                                ].map(({ key, label }) => (
                                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                                        <label style={{ fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{label}</label>
                                        <select
                                            className="select-filter"
                                            style={{ fontSize: '13px', padding: '4px 8px', minWidth: '160px' }}
                                            value={csvMapping[key]}
                                            onChange={e => setCsvMapping(prev => ({ ...prev, [key]: e.target.value }))}
                                        >
                                            <option value="">— ignorar —</option>
                                            {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                    </div>
                                ))}

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                                    <button className="btn-secondary" onClick={resetImport}>Cancelar</button>
                                    <button
                                        className="btn-primary"
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                                        onClick={handlePreview}
                                        disabled={!csvMapping.date || !csvMapping.concept || (!csvMapping.amount && !csvMapping.charge && !csvMapping.credit)}
                                    >
                                        Previsualizar <ChevronRight size={16} />
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                ) : (
                    /* Step 2: preview + confirm */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '100px' }}>
                        {/* Summary stats */}
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <div style={{ flex: 1, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '8px', padding: '10px 14px' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                                    {isCreditCard ? 'PAGOS' : 'INGRESOS'}
                                </div>
                                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--positive)' }}>
                                    {formatCurrency(pendingRows.filter(r => r.type === (isCreditCard ? 'Transferencia' : 'Ingreso')).reduce((s, r) => s + r.amount, 0))}
                                </div>
                            </div>
                            <div style={{ flex: 1, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '10px 14px' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                                    {isCreditCard ? 'CARGOS' : 'EGRESOS'}
                                </div>
                                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--negative)' }}>
                                    {formatCurrency(pendingRows.filter(r => r.type === 'Egreso').reduce((s, r) => s + r.amount, 0))}
                                </div>
                            </div>
                            <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '10px 14px' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>TRANSACCIONES</div>
                                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{pendingRows.length}</div>
                            </div>
                        </div>
                        
                        {pdfBankInfo && (pdfBankInfo.saldo_anterior > 0 || pdfBankInfo.saldo_final > 0) && (
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <div style={{ flex: 1, background: 'rgba(255,135,0,0.08)', border: '1px solid rgba(255,135,0,0.25)', borderRadius: '8px', padding: '10px 14px' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>SALDO ANTERIOR</div>
                                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#FF8700' }}>
                                        {formatCurrency(pdfBankInfo.saldo_anterior)}
                                    </div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>{pdfBankInfo.banco}</div>
                                </div>
                                <div style={{ flex: 1, background: 'rgba(255,135,0,0.08)', border: '1px solid rgba(255,135,0,0.25)', borderRadius: '8px', padding: '10px 14px' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>SALDO AL CORTE</div>
                                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#FF8700' }}>
                                        {formatCurrency(pdfBankInfo.saldo_final)}
                                    </div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>{pdfBankInfo.periodo || pdfBankInfo.banco}</div>
                                </div>
                            </div>
                        )}

                        {nvaIntelligence && (
                            <div className="mb-4">
                                <NvaIntelligencePanel intelligence={nvaIntelligence} />
                            </div>
                        )}

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'space-between', alignItems: 'center' }}>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                Revisa y ajusta tipo y categoría antes de importar.
                            </p>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Todo:</span>
                                {isCreditCard ? (
                                    <>
                                        <button className="btn-secondary" style={{ fontSize: '11px', padding: '3px 7px' }} onClick={() => handleBulkType('Transferencia')}>Pago</button>
                                        <button className="btn-secondary" style={{ fontSize: '11px', padding: '3px 7px' }} onClick={() => handleBulkType('Egreso')}>Cargo</button>
                                        <button className="btn-secondary" style={{ fontSize: '11px', padding: '3px 7px' }} onClick={() => handleBulkType('Ingreso')}>Ajuste</button>
                                    </>
                                ) : (
                                    ['Ingreso', 'Egreso', 'Inversión', 'Por Cobrar'].map(t => (
                                        <button key={t} className="btn-secondary" style={{ fontSize: '11px', padding: '3px 7px' }} onClick={() => handleBulkType(t)}>{t}</button>
                                    ))
                                )}
                            </div>
                        </div>

                        <div style={{ maxHeight: '340px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                            <table className="data-table" style={{ fontSize: '12px' }}>
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Concepto</th>
                                        <th>Monto</th>
                                        <th>Tipo</th>
                                        <th>Categoría</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pendingRows.map(r => (
                                        <tr key={r._idx}>
                                            <td style={{ whiteSpace: 'nowrap' }}>{r.date}</td>
                                            <td title={r.concept} style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.concept}</td>
                                            <td style={{ whiteSpace: 'nowrap' }}>{formatCurrency(r.amount)}</td>
                                            <td>
                                                <select
                                                    className="select-filter"
                                                    style={{ fontSize: '11px', padding: '2px 4px' }}
                                                    value={r.type}
                                                    onChange={e => updatePendingRow(r._idx, 'type', e.target.value)}
                                                >
                                                    {isCreditCard ? (
                                                        <>
                                                            <option value="Transferencia">Pago</option>
                                                            <option value="Egreso">Cargo</option>
                                                            <option value="Ingreso">Ajuste</option>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <option value="Ingreso">Ingreso</option>
                                                            <option value="Egreso">Egreso</option>
                                                            <option value="Inversión">Inversión</option>
                                                            <option value="Por Cobrar">Por Cobrar</option>
                                                        </>
                                                    )}
                                                </select>
                                            </td>
                                            <td>
                                                <select
                                                    className="select-filter"
                                                    style={{ fontSize: '11px', padding: '2px 4px' }}
                                                    value={r.categoria || 'Otros'}
                                                    onChange={e => updatePendingRow(r._idx, 'categoria', e.target.value)}
                                                >
                                                    {CATEGORIAS_ALL.map(c => <option key={c}>{c}</option>)}
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button className="btn-secondary" onClick={() => setImportStep(1)}>Volver</button>
                            <button
                                className="btn-primary"
                                onClick={handleConfirmImport}
                                disabled={isImporting || pendingRows.length === 0}
                            >
                                {isImporting ? 'Importando...' : `Importar ${pendingRows.length} transacciones`}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
