"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, ArrowDownRight, Edit2, Trash2, Plus, Wallet, TrendingUp, Upload, CheckCircle2, Receipt, Settings, Landmark, CreditCard as CreditCardIcon, AlertTriangle, Lock, RefreshCw, TrendingDown, Target, BarChart2, Info } from "lucide-react";
import Modal from "@/components/Modal";
import CurrencyInput from "@/components/CurrencyInput";
import PLCalendar from "@/components/PLCalendar";
import { supabase } from "@/lib/supabaseClient";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { categoriasParaTipo, construirMemoriaCategorias, resolverCategoria } from "@/lib/categorias";
import { parseCSV, autoDetect, buildRows } from "@/lib/finanzas/csvImport";
import { PERIODOS_FIN, getFechaInicioFin } from "@/lib/finanzas/periodos";
import CreditInsights from "./components/CreditInsights";
import CustomCardEditModal from "./components/CustomCardEditModal";
import CreditConfigModal from "./components/CreditConfigModal";
import ImportModal from "./components/ImportModal";
import { getFilter, setFilter } from "@/lib/filterMemory";
import GastosPorCategoria from "@/components/GastosPorCategoria";
import IngresosPorCategoria from "@/components/IngresosPorCategoria";
import GastosHormiga from "@/components/GastosHormiga";
import InfoTip from "@/components/InfoTip";
import { openTutorial } from "@/components/AppTutorial";
import { toast } from "sonner";
import "./Finanzas.css";
import { API_BASE } from "@/lib/apiBase";

// ─── Component ───────────────────────────────────────────────────────────────

export default function FinanzasPage() {
    const router = useRouter();
    const [transactions, setTransactions] = useState([]);
    const [tradingOps, setTradingOps] = useState([]);
    const [portfolioAssets, setPortfolioAssets] = useState([]);
    const [userConfig, setUserConfig] = useState({ concepto_custom_label: 'Por Cobrar', concepto_custom_total: 0 });
    const [periodo, setPeriodo] = useState('Todos');
    const [accountType, setAccountType] = useState('debit'); // 'debit' | 'credit'
    const [selectedCard, setSelectedCard] = useState('global'); // 'global' | bank name
    const [mesFilter, setMesFilter] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditingCustomCard, setIsEditingCustomCard] = useState(false);
    const [customCardForm, setCustomCardForm] = useState({ label: '', monto: '' });

    // Meta (budget) linkable to the custom card — shows a selected goal's progress.
    const [budgets, setBudgets] = useState([]);
    const [budgetPaid, setBudgetPaid] = useState({}); // { budget_id: paidAmount }
    const [featuredMetaId, setFeaturedMetaId] = useState(null);

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
            const [txRes, tradingRes, portfolioRes, configRes, budgetsRes, paymentsRes] = await Promise.all([
                supabase.from('transactions').select('*').eq('user_id', user?.id).order('date', { ascending: false }),
                supabase.from('trading_operations').select('date, pnl, status').eq('user_id', user?.id),
                supabase.from('portfolio_assets').select('quantity, avg_buy_price').eq('user_id', user?.id),
                supabase.from('user_config').select('concepto_custom_label, concepto_custom_total').eq('user_id', user?.id).maybeSingle(),
                supabase.from('budgets').select('*').eq('user_id', user?.id).order('created_at', { ascending: false }),
                supabase.from('budget_payments').select('budget_id, amount').eq('user_id', user?.id),
            ]);

            const bRows = budgetsRes.data || [];
            setBudgets(bRows);
            const paidMap = {};
            (paymentsRes.data || []).forEach(p => { paidMap[p.budget_id] = (paidMap[p.budget_id] || 0) + Number(p.amount); });
            setBudgetPaid(paidMap);

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
            try {
                const meta = localStorage.getItem(`nva_featured_meta_${user.id}`);
                if (meta) setFeaturedMetaId(meta);
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

    // One-time migration: statements de crédito se guardaron como 'debito' porque
    // el parser no detectó el tipo. El usuario confirmó que TODO su débito es en
    // realidad crédito. Movemos debito → credito una sola vez por dispositivo.
    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user?.id) return;
            const flag = `fnce_migrate_debito_a_credito_${user.id}`;
            if (localStorage.getItem(flag)) return;
            const { error } = await supabase.from('transactions')
                .update({ account_type: 'credito' })
                .eq('user_id', user.id)
                .eq('account_type', 'debito');
            if (!error) {
                localStorage.setItem(flag, '1');
                fetchData();
            } else {
                console.error('Migration debito→credito:', error);
            }
        })();
    }, []);

    // ── Import handlers ──────────────────────────────────────────────────────
    // NOTE: La conexión bancaria vía Belvo está INACTIVA. El código de la
    // integración se conserva en src/components/BankConnectWidget.jsx y en
    // src/app/api/belvo/* (dormido, no cableado a la UI). Ver docs/BELVO_INTEGRATION.md
    // para reactivarla. Se retiró el handler de aquí para no dejar código colgante.

    const parsePdfFile = async (file, password = '') => {
        setIsParsing(true);
        try {
            // Refresh session to ensure token is valid (getSession returns cached/potentially expired token)
            const { data: { session: refreshed } } = await supabase.auth.refreshSession();
            const session = refreshed ?? (await supabase.auth.getSession()).data.session;
            const token = session?.access_token || '';
            const isNative = typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();

            let data;
            if (isNative) {
                // Native iOS: upload via Swift URLSession (WKWebView can't upload files)
                const base64 = await new Promise((res, rej) => {
                    const reader = new FileReader();
                    reader.onload = () => res(reader.result.split(',')[1]);
                    reader.onerror = rej;
                    reader.readAsDataURL(file);
                });
                window.__nvaUploadData = base64;
                window.__nvaUploadFileName = file.name;
                window.__nvaUploadToken = token;
                data = await new Promise((resolve, reject) => {
                    let settled = false;
                    const cleanup = () => {
                        delete window.__nvaUploadResult;
                        delete window.__nvaUploadError;
                        delete window.__nvaUploadData;
                        delete window.__nvaUploadFileName;
                        delete window.__nvaUploadToken;
                    };
                    window.__nvaUploadResult = (json) => {
                        if (settled) return;
                        settled = true;
                        cleanup();
                        try { resolve(JSON.parse(json)); }
                        catch { reject(new Error('Invalid server response')); }
                    };
                    window.__nvaUploadError = (err) => {
                        if (settled) return;
                        settled = true;
                        cleanup();
                        reject(new Error(err));
                    };
                    document.title = `__nvaUpload:${token}`;
                    setTimeout(() => {
                        if (settled) return;
                        settled = true;
                        cleanup();
                        reject(new Error('Upload timeout'));
                    }, 180000);
                });
            } else {
                // Web: standard FormData upload
                const fd = new FormData();
                fd.append('file', file);
                const headers = {};
                if (token) headers['Authorization'] = `Bearer ${token}`;
                const res = await fetch(`${API_BASE}/api/analyze`, { method: 'POST', body: fd, headers });
                const raw = await res.text();
                try {
                    data = JSON.parse(raw);
                } catch {
                    // Non-JSON body = platform-level error (e.g. Vercel function
                    // timeout returns plain "An error occurred"). Show a useful
                    // message instead of a raw JSON parse error.
                    const msg = res.status === 504 || /timed? ?out|An error occurred/i.test(raw)
                        ? 'El análisis tardó demasiado. Intenta de nuevo o divide el estado de cuenta en periodos más cortos.'
                        : `No se pudo analizar el archivo (${res.status}).`;
                    toast.error(msg);
                    return;
                }
            }

            if (!data.success) {
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
                categoria: resolverCategoria(t.concepto || '', t.categoria, categoriaMemoria, t.tipo),
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
                    deudaAlCorte: ci.saldo_al_corte || data.saldo_final || 0,
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
            // Warn if the extracted amounts don't reconcile with the statement's
            // declared totals — the numbers may be off, review before importing.
            if (data.reconciliation && data.reconciliation.ok === false) {
                toast.warning('Revisa los montos: no cuadran con los totales del estado de cuenta.', { duration: 6000 });
            }
        } catch (err) {
            console.error('[parsePdfFile]', err);
            const m = String(err?.message || '');
            const friendly = /timeout|Invalid server response|Unexpected token|not valid JSON|An error occurred/i.test(m)
                ? 'El análisis tardó demasiado o falló. Intenta de nuevo o divide el estado de cuenta en periodos más cortos.'
                : (m || 'Error al procesar el archivo PDF.');
            toast.error(friendly);
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
                const buffer = await new Promise((res, rej) => {
                    const r = new FileReader();
                    r.onload = () => res(r.result);
                    r.onerror = rej;
                    r.readAsArrayBuffer(file);
                });
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
        const rows = buildRows(csvRawRows, csvHeaders, csvMapping, isCreditCard, categoriaMemoria);
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
                // Guardar según la sección donde el usuario está importando (Débito/
                // Crédito), no el tipo adivinado por el parser — así los statements
                // de crédito no caen en débito si la detección falla.
                account_type: accountType === 'credit' ? 'credito' : 'debito',
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

    // Memory of how the user has categorized each merchant before — reused during
    // import so recurring merchants inherit the user's own category instead of
    // falling to Otros. Built from ALL transactions (not period-filtered).
    const categoriaMemoria = useMemo(() => construirMemoriaCategorias(transactions), [transactions]);

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
    // Include the legacy 'Gasto Personal' type as an egreso, matching the rest of
    // the app (chart, dashboard, GastosHormiga). Otherwise egreso totals show $0
    // while the category chart shows the same rows as spending.
    const totalEgresos = filteredTx.filter(t => ['egreso', 'gasto personal'].includes(t.type?.toLowerCase().trim())).reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

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

    // Meta linked to the custom card (if any). Falls back to concept card when null.
    const featuredMeta = useMemo(() => {
        const b = budgets.find(x => String(x.id) === String(featuredMetaId));
        if (!b) return null;
        const paid = budgetPaid[b.id] || 0;
        const target = Number(b.target_amount) || 0;
        const pct = target > 0 ? Math.min(100, (paid / target) * 100) : 0;
        return { ...b, paid, target, pct };
    }, [budgets, budgetPaid, featuredMetaId]);

    const linkMeta = async (id) => {
        const { data: { user } } = await supabase.auth.getUser();
        setFeaturedMetaId(id);
        try {
            if (user?.id) {
                if (id) localStorage.setItem(`nva_featured_meta_${user.id}`, String(id));
                else localStorage.removeItem(`nva_featured_meta_${user.id}`);
            }
        } catch (_) {}
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
    const [multiCardHintDismissed, setMultiCardHintDismissed] = useState(
        typeof window !== 'undefined' && !!localStorage.getItem('fnce_multi_card_hint')
    );

    const handleDelete = (id) => {
        setItemToDelete(id);
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
                // Global delete also wipes local memory (merged from the old
                // "Limpiar memoria" action): all per-user keys plus fnce_/nva_
                // prefixed saldos, card config, filters and preferences. Leftover
                // per-bank keys otherwise resurface as stale limits/balances when a
                // statement for a same-named bank is re-imported ("residuo" en crédito).
                Object.keys(localStorage)
                    .filter(k => (user?.id && k.includes(user.id)) || k.startsWith('fnce_') || k.startsWith('nva_'))
                    .forEach(k => localStorage.removeItem(k));
                setCreditConfig({ limit: 50000, statementBalance: '', noInterestPayment: '', cutoffDate: '', paymentDate: '' });
            } else {
                setTransactions(prev => prev.filter(t => t.bank !== selectedCard));
                setBankBalance(null);
                const bankKey = `nva_bank_balance_${user.id}_${selectedCard.toLowerCase().replace(/\s+/g, '_')}`;
                localStorage.removeItem(bankKey);
                localStorage.removeItem(`fnce_credit_config_${user.id}_${selectedCard}`);
            }
            toast.success(isGlobal ? "Transacciones y memoria local eliminadas." : "Transacciones eliminadas.");
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
                const deleted = transactions.find(t => t.id === itemToDelete);
                const remaining = transactions.filter(t => t.id !== itemToDelete);
                setTransactions(remaining);
                // If that was the last tx of its bank, drop the bank's stale
                // localStorage keys so it doesn't resurface on re-import.
                const bank = deleted?.bank;
                if (bank && bank !== 'Desconocido' && !remaining.some(t => t.bank === bank)) {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user?.id) {
                        localStorage.removeItem(`nva_bank_balance_${user.id}_${bank.toLowerCase().replace(/\s+/g, '_')}`);
                        localStorage.removeItem(`fnce_credit_config_${user.id}_${bank}`);
                    }
                }
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

    // Re-run the (now expanded) categorization rules over transactions currently
    // in "Otros" and persist any that resolve to a real category. Existing rows
    // were imported before the rules grew, so they stay in Otros until re-run.
    const [isRecategorizando, setIsRecategorizando] = useState(false);
    const recategorizarOtros = async () => {
        if (isRecategorizando) return;
        setIsRecategorizando(true);
        try {
            const otros = transactions.filter(t => (t.categoria || 'Otros') === 'Otros');
            const cambios = [];
            for (const t of otros) {
                const nueva = resolverCategoria(t.concept || '', null, categoriaMemoria, t.type);
                if (nueva && nueva !== 'Otros') cambios.push({ id: t.id, categoria: nueva });
            }
            if (cambios.length === 0) {
                toast.info('No hay transacciones en "Otros" que las reglas puedan reclasificar.');
                return;
            }
            const { data: { user } } = await supabase.auth.getUser();
            if (!user?.id) { toast.error('Sesión no válida.'); return; }
            // Persist each change (Supabase has no multi-row differing-value update).
            const results = await Promise.all(cambios.map(c =>
                supabase.from('transactions').update({ categoria: c.categoria }).eq('id', c.id).eq('user_id', user.id)
            ));
            const fallidos = results.filter(r => r.error).length;
            const okMap = new Map(cambios.map(c => [c.id, c.categoria]));
            setTransactions(prev => prev.map(t => okMap.has(t.id) ? { ...t, categoria: okMap.get(t.id) } : t));
            if (fallidos > 0) toast.warning(`Reclasificadas ${cambios.length - fallidos}, fallaron ${fallidos}.`);
            else toast.success(`${cambios.length} transacciones reclasificadas.`);
        } catch (err) {
            toast.error('Error al recategorizar: ' + (err?.message || 'desconocido'));
        } finally {
            setIsRecategorizando(false);
        }
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

    // ── Analysis section ──────────────────────────────────────────────────────
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

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
            <div className="fin-account-type-bar">
                <button className={`fin-account-type-btn ${accountType === 'debit' ? 'active' : ''}`} onClick={() => setAccountType('debit')}>
                    <Landmark size={12} /> Débito
                </button>
                <button className={`fin-account-type-btn ${accountType === 'credit' ? 'active' : ''}`} onClick={() => setAccountType('credit')}>
                    <CreditCardIcon size={12} /> Crédito
                </button>
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
                // Display only: "BBVA ·5036" → "BBVA •••• 5036". Stored value
                // (used for DB queries / selectedCard) stays untouched.
                const fmtCard = (c) => String(c).replace(/\s*·\s*(\d{4})\s*$/, ' •••• $1');
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
                                {fmtCard(card)}
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
                        <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.4px', lineHeight: 1 }}>{String(selectedCard).replace(/\s*·\s*(\d{4})\s*$/, ' •••• $1')}</div>
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
                            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'inline-flex', alignItems: 'center' }}>
                                Score de Salud Financiera
                                <InfoTip title="Score de Salud Financiera (0–100)" text="Qué tan sana está tu tarjeta. Combina qué tanto de tu línea usas (utilización), si pagas de contado o solo el mínimo, el crédito que te queda disponible, los intereses que generas y cuánto ya comprometiste del próximo mes (MSI + suscripciones). Más alto = más sano: 75+ saludable, 50–74 moderado, menos = presión o riesgo." />
                            </span>
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
                        <p className="fin-hero-label" style={{ letterSpacing: '1.2px', opacity: 0.6, fontWeight: 500 }}>DEUDA REVOLVENTE<InfoTip title="Deuda revolvente" text="Lo que debes a la tarjeta y que genera intereses si no lo liquidas. Revolvente = se renueva mes a mes: pagas parte, el resto sigue cobrando interés. No incluye tus MSI (esos van aparte, sin interés)." color="rgba(255,255,255,0.55)" /></p>
                        <div className="fin-hero-amount" style={{ color: deudaActual === 0 ? '#34d399' : '#fff' }}>
                            <span className="fin-hero-int">{heroDeudaInt}</span>
                            <span className="fin-hero-dec">.{heroDeudaDec}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '10px' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>Crédito disponible<InfoTip title="Crédito disponible" text="Lo que aún puedes gastar: tu línea total menos lo que ya debes. Si llega a $0, la tarjeta se rechaza hasta que pagues." color="rgba(255,255,255,0.45)" /></div>
                                <div style={{ fontSize: '14px', fontWeight: 700, color: '#34d399' }}>{formatCurrency(liquidezRestante)}</div>
                            </div>
                            {deudaComprometidaProxMes > 0 && (
                                <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '16px' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>Comprometido próx. mes<InfoTip title="Comprometido próximo mes" text="Dinero que ya debes el mes que viene aunque no gastes nada más: las mensualidades de tus MSI + tus suscripciones recurrentes. Réstalo mentalmente de tu presupuesto." color="rgba(255,255,255,0.45)" /></div>
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
                                {Math.round(creditUtilizacion)}%<InfoTip title="Utilización" text="Qué porcentaje de tu línea de crédito estás usando. Debajo de 30% es saludable y cuida tu score de buró; arriba de 70% te marca como sobreapalancado. Se calcula: deuda ÷ límite." size={15} />
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
                    <div
                        className="fin-metric-card"
                        style={{ position: 'relative', cursor: featuredMeta ? 'pointer' : 'default' }}
                        onClick={featuredMeta ? () => router.push('/budgets') : undefined}
                    >
                        <button
                            className="fin-metric-edit"
                            onClick={(e) => { e.stopPropagation(); setCustomCardForm({ label: userConfig.concepto_custom_label, monto: String(userConfig.concepto_custom_total) }); setIsEditingCustomCard(true); }}
                            title="Editar"
                        >
                            <Edit2 size={12} />
                        </button>
                        {featuredMeta ? (
                            <>
                                <div className="fin-metric-icon" style={{ background: `${featuredMeta.color || '#fbbf24'}20`, color: featuredMeta.color || '#fbbf24' }}>
                                    {featuredMeta.icon ? <span style={{ fontSize: '14px', lineHeight: 1 }}>{featuredMeta.icon}</span> : <Target size={14} />}
                                </div>
                                <span className="fin-metric-label">{featuredMeta.name}</span>
                                <span className="fin-metric-value">{formatCurrency(featuredMeta.paid)}</span>
                                <div className="fin-meta-bar"><div className="fin-meta-bar-fill" style={{ width: `${featuredMeta.pct}%`, background: featuredMeta.color || '#fbbf24' }} /></div>
                                <span className="fin-metric-hint">{featuredMeta.pct.toFixed(0)}% de {formatCurrency(featuredMeta.target)}</span>
                            </>
                        ) : (
                            <>
                                <div className="fin-metric-icon" style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}>
                                    <Wallet size={14} />
                                </div>
                                <span className="fin-metric-label">{userConfig.concepto_custom_label}</span>
                                <span className="fin-metric-value">{formatCurrency(userConfig.concepto_custom_total)}</span>
                            </>
                        )}
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
                <CreditInsights
                    autoInsights={autoInsights}
                    burnRateDiario={burnRateDiario}
                    cat={cat}
                    creditConfig={creditConfig}
                    creditMonthlyHistory={creditMonthlyHistory}
                    deudaActual={deudaActual}
                    deudaComprometidaProxMes={deudaComprometidaProxMes}
                    diasHastaSaturacion={diasHastaSaturacion}
                    formatCurrency={formatCurrency}
                    historicoAjustes={historicoAjustes}
                    historicoCargos={historicoCargos}
                    historicoPagos={historicoPagos}
                    interesesMostrar={interesesMostrar}
                    interesesPeriodo={interesesPeriodo}
                    lastMonth={lastMonth}
                    lastMonthNarrative={lastMonthNarrative}
                    maxCargos={maxCargos}
                    mesesMostrar={mesesMostrar}
                    pagoNoInteres={pagoNoInteres}
                    setIsEditingCreditConfig={setIsEditingCreditConfig}
                    setSimulatorMode={setSimulatorMode}
                    simulatedInterest={simulatedInterest}
                    simulatedPayment={simulatedPayment}
                    simulatedRemaining={simulatedRemaining}
                    simulatorMode={simulatorMode}
                    totalMSI={totalMSI}
                    totalSuscripciones={totalSuscripciones}
                    trendVsPrev={trendVsPrev}
                />
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
                <button className="btn-fin-ghost" onClick={recategorizarOtros} disabled={isRecategorizando} title="Reclasificar transacciones en Otros con las reglas actuales">
                    <RefreshCw size={13} className={isRecategorizando ? 'spin' : ''} />
                </button>
                <button className="btn-fin-ghost" onClick={() => setShowClearAll(true)} title="Eliminar transacciones y memoria local">
                    <Trash2 size={13} />
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

            <Modal isOpen={showClearAll} onClose={() => setShowClearAll(false)} title={selectedCard === 'global' ? 'Eliminar todo' : `Eliminar ${selectedCard}`}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
                        Se eliminarán <strong style={{ color: 'var(--text-primary)' }}>{selectedCard === 'global' ? transactions.length : transactions.filter(t => t.bank === selectedCard).length}</strong> transacciones{selectedCard === 'global' ? '' : ` de ${selectedCard}`} de la base de datos <strong style={{ color: 'var(--text-primary)' }}>de forma permanente</strong>.
                        <br /><br />
                        También se borrará la <strong style={{ color: 'var(--text-primary)' }}>memoria local</strong> asociada: saldos guardados, configuración de tarjetas de crédito (límite, fecha de corte, pago) y balances importados.
                        {selectedCard === 'global' && <> También se restablecen filtros y preferencias de la app.</>}
                        <br /><br />
                        Tu portafolio y operaciones de trading <strong style={{ color: 'var(--text-primary)' }}>no</strong> se ven afectados. Esta acción <strong style={{ color: 'var(--danger)' }}>no se puede deshacer</strong>.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                        <button type="button" className="btn-icon-sm glass" style={{ padding: '8px 16px', color: 'var(--text-primary)' }} onClick={() => setShowClearAll(false)}>
                            Cancelar
                        </button>
                        <button type="button" className="btn-primary" style={{ backgroundColor: 'var(--danger)', color: 'white' }} onClick={confirmClearAll}>
                            Eliminar todo
                        </button>
                    </div>
                </div>
            </Modal>

            {/* ── Custom Card Edit Modal ── */}
            <CustomCardEditModal
                budgetPaid={budgetPaid}
                budgets={budgets}
                customCardForm={customCardForm}
                featuredMetaId={featuredMetaId}
                formatCurrency={formatCurrency}
                isEditingCustomCard={isEditingCustomCard}
                linkMeta={linkMeta}
                router={router}
                setCustomCardForm={setCustomCardForm}
                setIsEditingCustomCard={setIsEditingCustomCard}
                setUserConfig={setUserConfig}
                supabase={supabase}
            />

            {/* ── Credit Config Modal ── */}
            <CreditConfigModal
                creditConfig={creditConfig}
                handleSaveCreditConfig={handleSaveCreditConfig}
                isEditingCreditConfig={isEditingCreditConfig}
                setCreditConfig={setCreditConfig}
                setIsEditingCreditConfig={setIsEditingCreditConfig}
            />

            {/* ── Import Modal ── */}
            <ImportModal
                csvHeaders={csvHeaders}
                csvMapping={csvMapping}
                csvRawRows={csvRawRows}
                fileInputRef={fileInputRef}
                formatCurrency={formatCurrency}
                handleBulkType={handleBulkType}
                handleConfirmImport={handleConfirmImport}
                handleFileUpload={handleFileUpload}
                handlePreview={handlePreview}
                importResult={importResult}
                importStep={importStep}
                isCreditCard={isCreditCard}
                isImportOpen={isImportOpen}
                isImporting={isImporting}
                isParsing={isParsing}
                nvaIntelligence={nvaIntelligence}
                parsePdfFile={parsePdfFile}
                pdfBankInfo={pdfBankInfo}
                pdfPassword={pdfPassword}
                pdfPasswordError={pdfPasswordError}
                pendingPdfFile={pendingPdfFile}
                pendingRows={pendingRows}
                resetImport={resetImport}
                setCsvMapping={setCsvMapping}
                setImportResult={setImportResult}
                setImportStep={setImportStep}
                setIsCreditCard={setIsCreditCard}
                setPdfBankInfo={setPdfBankInfo}
                setPdfPassword={setPdfPassword}
                setPdfPasswordError={setPdfPasswordError}
                setPendingPdfFile={setPendingPdfFile}
                setPendingRows={setPendingRows}
                setShowPdfPassword={setShowPdfPassword}
                showPdfPassword={showPdfPassword}
                updatePendingRow={updatePendingRow}
            />
        </div>
    );
}
