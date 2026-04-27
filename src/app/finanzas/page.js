"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { ArrowUpRight, ArrowDownRight, Edit2, Trash2, Plus, Wallet, TrendingUp, Upload, ChevronRight, AlertCircle, CheckCircle2, Receipt } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import Modal from "@/components/Modal";
import PLCalendar from "@/components/PLCalendar";
import { supabase } from "@/lib/supabaseClient";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { inferirCategoria, categoriasParaTipo, CATEGORIAS_ALL } from "@/lib/categorias";
import { getFilter, setFilter } from "@/lib/filterMemory";
import { parseStatementText } from "@/lib/statementParser";
import { parseStatementWithAI, parseStatementTextWithAI } from "@/lib/parsers/ai-statement-parser";
import { pdfToImages } from "@/lib/parsers/pdf-to-images";
import GastosPorCategoria from "@/components/GastosPorCategoria";
import OnboardingTour from "@/components/onboarding/OnboardingTour";
import { useOnboarding } from "@/hooks/useOnboarding";
import { FINANZAS_STEPS } from "@/components/onboarding/tourSteps";
import { toast } from "sonner";
import BankConnectWidget from "@/components/BankConnectWidget";
import "./Finanzas.css";
import { API_BASE } from "@/lib/apiBase";

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

function buildRows(rawRows, headers, mapping) {
    const parseMonto = (s) => Math.abs(parseFloat((s || '').replace(/[$,\s]/g, '')) || 0);

    return rawRows.map((row, idx) => {
        const get = (col) => col ? (row[headers.indexOf(col)] || '') : '';
        const rawDate = get(mapping.date);
        const concept = get(mapping.concept).trim() || `Transacción ${idx + 1}`;
        let amount = 0, type = 'Egreso';

        if (mapping.charge || mapping.credit) {
            const charge = parseMonto(get(mapping.charge));
            const credit = parseMonto(get(mapping.credit));
            if (credit > 0 && charge === 0) { amount = credit; type = 'Ingreso'; }
            else if (charge > 0) { amount = charge; type = 'Egreso'; }
            else { amount = Math.max(credit, charge); }
        } else if (mapping.amount) {
            const v = parseFloat((get(mapping.amount) || '').replace(/[$,\s]/g, '')) || 0;
            amount = Math.abs(v);
            type = v >= 0 ? 'Ingreso' : 'Egreso';
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
];

function getFechaInicioFin(periodo) {
    const now = new Date();
    switch (periodo) {
        case '1m': return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        case '3m': return new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split('T')[0];
        case '6m': return new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString().split('T')[0];
        case '1y': return new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        default:   return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    }
}

export default function FinanzasPage() {
    const { isActive: tourActive, complete: tourComplete, skip: tourSkip, reset: resetTour } = useOnboarding('finanzas');
    const [transactions, setTransactions] = useState([]);
    const [tradingOps, setTradingOps] = useState([]);
    const [portfolioAssets, setPortfolioAssets] = useState([]);
    const [userConfig, setUserConfig] = useState({ concepto_custom_label: 'Por Cobrar', concepto_custom_total: 0 });
    const [periodo, setPeriodo] = useState('1m');
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
    const [isParsing, setIsParsing] = useState(false);
    const [pendingPdfFile, setPendingPdfFile] = useState(null);
    const [showPdfPassword, setShowPdfPassword] = useState(false);
    const [pdfPassword, setPdfPassword] = useState('');
    const [pdfPasswordError, setPdfPasswordError] = useState(false);
    const fileInputRef = useRef(null);

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

    useEffect(() => { fetchData(); }, []);

    useEffect(() => {
        const saved = getFilter('finanzas');
        if (saved) setPeriodo(saved);
    }, []);

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
        let rawText = null;
        try {
            // Cargamos pdf.js por CDN puro para evitar problemas de Webpack en build/Vercel
            if (!window.pdfjsLib) {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            }

            const pdfjsLib = window.pdfjsLib;
            const buffer = await file.arrayBuffer();

            const loadingTask = pdfjsLib.getDocument({
                data: buffer,
                password: password || undefined,
                cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
                cMapPacked: true,
                standardFontDataUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/',
            });
            const pdfDoc = await loadingTask.promise;
            
            for (let i = 1; i <= pdfDoc.numPages; i++) {
                const page = await pdfDoc.getPage(i);
                const content = await page.getTextContent();
                
                const items = content.items.filter(item => item.str.trim().length > 0);
                
                items.sort((a, b) => {
                    const yA = a.transform[5];
                    const yB = b.transform[5];
                    if (Math.abs(yA - yB) > 5) return yB - yA;
                    return a.transform[4] - b.transform[4];
                });

                let lastY;
                let pageText = '';
                for (const item of items) {
                    const y = item.transform[5];
                    if (lastY !== undefined && Math.abs(lastY - y) > 5) {
                        pageText += '\n';
                    } else if (lastY !== undefined) {
                        pageText += ' ';
                    }
                    pageText += item.str.trim();
                    lastY = y;
                }
                rawText = (rawText || '') + pageText + '\n\n';
            }
        } catch (err) {
            console.warn("Client PDF error:", err);
            if (err.name === 'PasswordException' || err.message?.includes('Password') || err.message?.includes('contraseña')) {
                setPdfPasswordError(true);
                setIsParsing(false);
                return;
            }
            toast.error("No se pudo descifrar o leer el documento en este dispositivo.");
            setIsParsing(false);
            return;
        }

        // Try regex parsers first (fast, free, no API key needed)
        let transacciones = rawText?.trim() ? parseStatementText(rawText) : [];

        if (transacciones.length < 3) {
            const toastId = toast.loading("Analizando con IA...", { duration: 40000 });
            let aiError = null;

            // Path A: text-based AI (digital PDF — fast, cheap, any bank)
            if (rawText?.trim().length > 200) {
                try {
                    const aiResult = await parseStatementTextWithAI(rawText);
                    if (aiResult.transactions.length > 0) {
                        transacciones = aiResult.transactions;
                        toast.dismiss(toastId);
                        toast.success(`IA detectó ${transacciones.length} transacciones de ${aiResult.banco}.`);
                    }
                } catch (err) {
                    aiError = err;
                    console.error("AI text parse error:", err.message);
                }
            }

            // Path B: vision-based AI (scanned/image PDF — only if text path failed or no text)
            if (transacciones.length < 3) {
                try {
                    const images = await pdfToImages(file, { scale: 1.5, maxPages: 8, skipFirst: false });
                    const aiResult = await parseStatementWithAI(images);
                    if (aiResult.transactions.length > 0) {
                        transacciones = aiResult.transactions;
                        toast.dismiss(toastId);
                        toast.success(`IA (visión) detectó ${transacciones.length} transacciones de ${aiResult.banco}.`);
                    }
                } catch (visionErr) {
                    console.error("AI vision parse error:", visionErr.message);
                    aiError = aiError ?? visionErr;
                }
            }

            toast.dismiss(toastId);

            if (transacciones.length === 0) {
                const msg = aiError?.message?.includes('ANTHROPIC_API_KEY')
                    ? 'Falta configurar ANTHROPIC_API_KEY en el servidor.'
                    : aiError?.message ?? 'No se encontraron transacciones. Verifica que sea un estado de cuenta válido.';
                toast.error(msg);
                setIsParsing(false);
                return;
            }
        }

        if (transacciones.length === 0) {
            toast.error("No se encontraron transacciones. Formato no reconocido.");
            setIsParsing(false);
            return;
        }

        const rows = transacciones.map((tx, i) => ({
            _idx: i,
            date: tx.fecha,
            concept: tx.concepto,
            amount: tx.monto,
            type: tx.tipo === 'ingreso' ? 'Ingreso' : 'Egreso',
            client: 'N/A',
            categoria: tx.categoria || 'Otros',
        }));

        setShowPdfPassword(false);
        setPendingPdfFile(null);
        setPdfPassword('');
        setPendingRows(rows);
        setImportStep(2);
        setIsParsing(false);
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
        const rows = buildRows(csvRawRows, csvHeaders, csvMapping);
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
    };

    const [modalType, setModalType] = useState("Ingreso"); // Ingreso or Egreso
    const [editingTransaction, setEditingTransaction] = useState(null);
    const [activeFilter, setActiveFilter] = useState("Todos");

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
    const filteredTx = useMemo(
        () => transactions.filter(t => t.date >= fechaInicio),
        [transactions, fechaInicio]
    );

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

    const handleDelete = (id) => {
        setItemToDelete(id);
    };

    const confirmClearAll = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
            .from('transactions')
            .delete()
            .eq('user_id', user?.id);

        if (error) {
            console.error("Error clearing transactions:", error);
            toast.error("Error al limpiar las transacciones.");
        } else {
            setTransactions([]);
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

    return (
        <div className="page-container">
            <OnboardingTour
                steps={FINANZAS_STEPS}
                isActive={tourActive}
                onComplete={tourComplete}
                onSkip={tourSkip}
            />
            {/* Hero Balance */}
            {isLoading ? (
                <div className="fin-hero">
                    <div className="skeleton" style={{ height: '14px', width: '90px', margin: '0 auto 12px', borderRadius: '4px' }} />
                    <div className="skeleton" style={{ height: '52px', width: '220px', margin: '0 auto 12px', borderRadius: '8px' }} />
                    <div className="skeleton" style={{ height: '24px', width: '120px', margin: '0 auto', borderRadius: '20px' }} />
                </div>
            ) : (
                <div className="fin-hero">
                    <p className="fin-hero-label">Balance Total</p>
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

            {/* 2x2 Metric grid */}
            {isLoading ? (
                <div className="fin-metric-grid">
                    <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
                </div>
            ) : (
                <div className="fin-metric-grid">
                    <div className="fin-metric-card">
                        <div className="fin-metric-icon" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>
                            <ArrowUpRight size={14} />
                        </div>
                        <span className="fin-metric-label">Ingresos</span>
                        <span className="fin-metric-value amount-positive">{formatCurrency(totalIngresos)}</span>
                        {tradingIncome > 0 && <span className="fin-metric-hint">Trading +{formatCurrency(tradingIncome)}</span>}
                    </div>
                    <div className="fin-metric-card">
                        <div className="fin-metric-icon" style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171' }}>
                            <ArrowDownRight size={14} />
                        </div>
                        <span className="fin-metric-label">Egresos</span>
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
                        <span className="fin-metric-value" style={{ color: '#f59e0b' }}>{formatCurrency(userConfig.concepto_custom_total)}</span>
                    </div>
                    <div className="fin-metric-card">
                        <div className="fin-metric-icon" style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}>
                            <TrendingUp size={14} />
                        </div>
                        <span className="fin-metric-label">Portafolio</span>
                        <span className="fin-metric-value" style={{ color: '#60a5fa' }}>{formatCurrency(totalPortfolioInvested)}</span>
                        <span className="fin-metric-hint">Costo base</span>
                    </div>
                </div>
            )}

            {/* Action buttons */}
            <div className="fin-actions-col">
                <BankConnectWidget onSuccess={handleBankConnected} />
                <div className="fin-actions-row">
                    <button className="btn-cta-secondary" data-tour="btn-nueva-transaccion" onClick={() => openModal("Ingreso")}>
                        <Plus size={14} /> Nueva
                    </button>
                    <button className="btn-cta-secondary" data-tour="btn-importar-csv" onClick={() => { setIsImportOpen(true); setImportStep(1); setImportResult(null); }}>
                        <Upload size={14} /> Importar
                    </button>
                    {transactions.length > 0 && (
                        <button className="btn-cta-secondary" style={{ color: 'var(--danger)' }} onClick={() => setShowClearAll(true)} title="Eliminar todas las transacciones">
                            <Trash2 size={14} /> Limpiar
                        </button>
                    )}
                    <button className="btn-cta-tertiary" onClick={resetTour} title="¿Cómo usar esta sección?">?</button>
                </div>
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
                {[
                    { value: 'Todos', label: 'Todos', count: filteredTx.length },
                    { value: 'Ingreso', label: 'Ingreso', count: filteredTx.filter(t=>t.type==='Ingreso').length },
                    { value: 'Egreso', label: 'Egreso', count: filteredTx.filter(t=>t.type==='Egreso').length },
                    { value: 'Inversión', label: 'Inversión', count: filteredTx.filter(t=>t.type==='Inversión').length },
                    { value: userConfig.concepto_custom_label, label: userConfig.concepto_custom_label, count: filteredTx.filter(t=>t.type===userConfig.concepto_custom_label).length },
                ].map(tab => (
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
                    <GastosPorCategoria startDate={fechaInicio} />

                    <PLCalendar transactions={transactions} />

                    <div className="card table-section">
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
                                        <tr key={t.id} className="table-row">
                                            <td>{t.date}</td>
                                            <td>{t.client}</td>
                                            <td>{t.concept}</td>
                                            <td>
                                                <span className={`badge badge-${t.type.toLowerCase().replace(' ', '-')}`}>
                                                    {t.type}
                                                </span>
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
                </>
            )}

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingTransaction ? 'Editar Transacción' : 'Nueva Transacción'}>
                <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} onSubmit={handleFormSubmit}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Tipo</label>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {[
                                { value: 'Ingreso',    color: '#22c55e', bg: 'rgba(34,197,94,0.15)'   },
                                { value: 'Egreso',     color: '#ef4444', bg: 'rgba(239,68,68,0.15)'   },
                                { value: 'Inversión',  color: '#3b82f6', bg: 'rgba(59,130,246,0.15)'  },
                                { value: userConfig.concepto_custom_label, color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
                            ].map(({ value, color, bg }) => (
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
                                    {value}
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
                        <input type="number" className="select-filter" placeholder="0.00" step="0.01" style={{ width: '100%' }} required value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
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

            <Modal isOpen={showClearAll} onClose={() => setShowClearAll(false)} title="Limpiar todas las transacciones">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Se eliminarán <strong>{transactions.length}</strong> transacciones. Esta acción no se puede deshacer.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
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
                        <input type="number" className="select-filter" style={{ width: '100%' }} placeholder="0.00" step="0.01" value={customCardForm.monto} onChange={e => setCustomCardForm(p => ({ ...p, monto: e.target.value }))} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                        <button type="button" className="btn-icon-sm glass" style={{ padding: '8px 16px', color: 'var(--text-primary)' }} onClick={() => setIsEditingCustomCard(false)}>Cancelar</button>
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
                                <button className="btn-primary" onClick={resetImport}>Listo</button>
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                            Sube tu estado de cuenta en PDF o CSV. Los PDF de BBVA, Banorte, Santander, HSBC, Citibanamex y Nu se procesan automáticamente.
                        </p>

                        {!showPdfPassword ? (
                            <button
                                className="btn-secondary"
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', padding: '12px', border: '2px dashed var(--border-color)', borderRadius: '8px', width: '100%' }}
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isParsing}
                            >
                                <Upload size={18} />
                                {isParsing ? 'Procesando PDF...' : csvHeaders.length > 0 ? `Archivo cargado (${csvRawRows.length} filas)` : 'Seleccionar archivo .pdf o .csv'}
                            </button>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '18px' }}>🔒</span>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>PDF protegido con contraseña</p>
                                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>Ingresa la contraseña para continuar</p>
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Summary stats */}
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <div style={{ flex: 1, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '8px', padding: '10px 14px' }}>
                                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '2px' }}>INGRESOS</div>
                                <div style={{ fontSize: '15px', fontWeight: 700, color: '#22c55e' }}>{formatCurrency(pendingRows.filter(r => r.type === 'Ingreso').reduce((s, r) => s + r.amount, 0))}</div>
                            </div>
                            <div style={{ flex: 1, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '10px 14px' }}>
                                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '2px' }}>EGRESOS</div>
                                <div style={{ fontSize: '15px', fontWeight: 700, color: '#ef4444' }}>{formatCurrency(pendingRows.filter(r => r.type === 'Egreso').reduce((s, r) => s + r.amount, 0))}</div>
                            </div>
                            <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '10px 14px' }}>
                                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '2px' }}>TRANSACCIONES</div>
                                <div style={{ fontSize: '15px', fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{pendingRows.length}</div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                Revisa y ajusta tipo y categoría antes de importar.
                            </p>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Todo:</span>
                                {['Ingreso', 'Egreso', 'Inversión', 'Por Cobrar'].map(t => (
                                    <button key={t} className="btn-secondary" style={{ fontSize: '11px', padding: '3px 7px' }} onClick={() => handleBulkType(t)}>{t}</button>
                                ))}
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
                                                    <option>Ingreso</option>
                                                    <option>Egreso</option>
                                                    <option>Inversión</option>
                                                    <option>Por Cobrar</option>
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
