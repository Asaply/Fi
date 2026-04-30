import { inferirCategoria } from './categorias';
import { parseBankStatement } from './parsers/bank-statement-parser';

const MESES = {
    ENE: '01', FEB: '02', MAR: '03', ABR: '04', MAY: '05', JUN: '06',
    JUL: '07', AGO: '08', SEP: '09', OCT: '10', NOV: '11', DIC: '12',
};

function normalizarMeses(text) {
    const map = {
        'ene': 'ENE', 'feb': 'FEB', 'mar': 'MAR', 'abr': 'ABR',
        'may': 'MAY', 'jun': 'JUN', 'jul': 'JUL', 'ago': 'AGO',
        'sep': 'SEP', 'oct': 'OCT', 'nov': 'NOV', 'dic': 'DIC',
        'jan': 'ENE', 'apr': 'ABR', 'aug': 'AGO',
    };
    return text.replace(/\b(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|jan|apr|aug)\.?\b/gi,
        (m) => map[m.replace('.', '').toLowerCase()] || m
    );
}

// ── Nu parser
const MONTO_RE = /([+\-])\s*(?:MX)?\$?([\d,]+\.\d{2})/;
const NU_LINE_RE = /^(\d{1,2})\s+(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)\s+(\d{4})\s+(.+?)\s+([+\-]\s*(?:MX)?\$?[\d,]+\.\d{2})$/i;
const NU_GLOBAL_RE = /(\d{1,2})\s+(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)\s+(\d{4})\s+(.+?)\s+([+\-]\s*(?:MX)?\$?[\d,]+\.\d{2})/gi;

function buildNuTx(day, mon, year, concepto, montoStr, isCreditCard) {
    const mes2 = MESES[mon.toUpperCase()];
    if (!mes2) return null;
    if (/cajita|nu\s+invest|rendimiento/i.test(concepto)) return null;
    const match = montoStr.match(MONTO_RE);
    if (!match) return null;
    const sign = match[1];
    const value = parseFloat(match[2].replace(/,/g, ''));
    if (isNaN(value) || value === 0) return null;
    const monto = sign === '-' ? -value : value;
    return {
        fecha: `${year}-${mes2}-${day.padStart(2, '0')}`,
        concepto: concepto.trim(),
        monto: Math.abs(monto),
        tipo: monto < 0 ? 'egreso' : (isCreditCard ? 'Transferencia' : 'ingreso'), // Nu: negative = spending
        categoria: inferirCategoria(concepto),
    };
}

function parsearNu(texto, isCreditCard) {
    const transacciones = [];

    // Skip saldo anterior injection — it's not a real transaction and inflates income totals
    let lastTx = null;
    let lineasSigue = 0;

    for (const linea of texto.split('\n')) {
        const trimmed = linea.trim();
        const m = trimmed.match(NU_LINE_RE);
        if (!m) {
            if (lastTx && lineasSigue < 2 && trimmed.length > 3 && !/p[aá]gina|hoja|saldo|total/i.test(trimmed)) {
                lastTx.concepto += ' ' + trimmed;
                lastTx.categoria = inferirCategoria(lastTx.concepto);
                lineasSigue++;
            }
            continue;
        }
        const tx = buildNuTx(m[1], m[2], m[3], m[4], m[5], isCreditCard);
        if (tx) {
            transacciones.push(tx);
            lastTx = tx;
            lineasSigue = 0;
        }
    }
    if (transacciones.length < 3) {
        const seen = new Set();
        NU_GLOBAL_RE.lastIndex = 0;
        let m;
        while ((m = NU_GLOBAL_RE.exec(texto)) !== null) {
            const tx = buildNuTx(m[1], m[2], m[3], m[4], m[5], isCreditCard);
            if (!tx) continue;
            const key = `${tx.fecha}|${tx.concepto}|${tx.monto}`;
            if (!seen.has(key)) { seen.add(key); transacciones.push(tx); }
        }
    }
    return transacciones;
}

// ── Generic parser
const CARGO_RE  = /CARGO|RETIRO|D[EÉ]BITO|COMPRA|PAGO\sA|SPEI\sENVIADO|ENV[IÍ]O|COMISI[OÓ]N/i;
const ABONO_RE  = /ABONO|DEP[OÓ]SITO|TRANSFERENCIA\s+RECIBIDA|CR[EÉ]DITO|SPEI\sRECIBIDO|RECIBISTE/i;
const DATE_SLASH = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/;
const DATE_DASH  = /\b(\d{1,2})[\s\-]+(?:de\s+)?(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)(?:\.?\s+de)?[\s\-]*(\d{2,4})?\b/i;
const DATE_ISO   = /\b(\d{4})-(\d{2})-(\d{2})\b/;

// Permite importes como "$1,000", "-$ 10.00", "500.00"
const AMOUNT_RE  = /(?:^|[\s,])([-+]?\s*\$?\s*\d{1,3}(?:,\d{3})*(?:\.\d{2}))/g;

function parseFecha(linea) {
    let m;
    const currentYear = new Date().getFullYear();

    if ((m = linea.match(DATE_SLASH))) {
        const y = m[3] ? (m[3].length === 2 ? `20${m[3]}` : m[3]) : currentYear;
        return { 
            fecha: `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`,
            endIdx: m.index + m[0].length 
        };
    }
    if ((m = linea.match(DATE_DASH))) {
        const mo = MESES[m[2].toUpperCase()];
        const y = m[3] ? (m[3].length === 2 ? `20${m[3]}` : m[3]) : currentYear;
        if (mo) {
            return { 
                fecha: `${y}-${mo}-${m[1].padStart(2, '0')}`,
                endIdx: m.index + m[0].length 
            };
        }
    }
    if ((m = linea.match(DATE_ISO))) {
        return { 
            fecha: `${m[1]}-${m[2]}-${m[3]}`,
            endIdx: m.index + m[0].length 
        };
    }
    return null;
}

function parseMexicanStatement(text, isCreditCard) {
    const transactions = [];
    let lastTx = null;
    let lineasSigue = 0;

    for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.length < 5) continue;
        
        const dateMatch = parseFecha(trimmed);
        if (!dateMatch) {
            // Línea huérfana sin fecha: se asume que es el detalle/concepto de la transacción anterior
            if (lastTx && lineasSigue < 4 && !/p[aá]gina|hoja|saldo|total|rfc/i.test(trimmed)) {
                lastTx.concepto += ' ' + trimmed;
                lastTx.categoria = inferirCategoria(lastTx.concepto);
                lineasSigue++;
            }
            continue;
        }
        const { fecha, endIdx: dateEnd } = dateMatch;

        const amounts = [];
        AMOUNT_RE.lastIndex = 0;
        let m;
        let firstAmtIdx = -1;
        while ((m = AMOUNT_RE.exec(trimmed)) !== null) {
            if (firstAmtIdx === -1) firstAmtIdx = m.index;
            const v = parseFloat(m[1].replace(/[,$\s]/g, ''));
            if (!isNaN(v) && Math.abs(v) >= 1) amounts.push(v);
        }
        if (amounts.length === 0) continue;

        const rawMonto = amounts[amounts.length - 1];
        const monto = Math.abs(rawMonto);
        
        let tipo = 'egreso';
        if (ABONO_RE.test(trimmed)) tipo = isCreditCard ? 'Transferencia' : 'ingreso';
        else if (CARGO_RE.test(trimmed)) tipo = 'egreso';
        else if (rawMonto < 0) tipo = 'egreso';
        else if (rawMonto > 0 && amounts.length > 1) tipo = isCreditCard ? 'Transferencia' : 'ingreso';
        // Single positive amount: ambiguous — for debit assume ingreso, for credit assume egreso (cargo)
        else if (rawMonto > 0 && amounts.length === 1) tipo = isCreditCard ? 'egreso' : 'ingreso';

        const conceptRaw = trimmed.substring(dateEnd, firstAmtIdx > dateEnd ? firstAmtIdx : undefined);
        const concepto = conceptRaw.replace(/\s+/g, ' ').trim() || trimmed.substring(0, 60);

        if (isCreditCard && tipo === 'ingreso') tipo = 'Transferencia';
        if (monto > 0) {
            const tx = { fecha, concepto, monto, tipo, categoria: inferirCategoria(concepto) };
            transactions.push(tx);
            lastTx = tx;
            lineasSigue = 0;
        }
    }
    return transactions;
}

export function parseStatementText(rawText, isCreditCard = false) {
    const text = normalizarMeses(rawText);

    // Try bank-specific parser first
    try {
        const bankResult = parseBankStatement(text, '', isCreditCard);
        if (bankResult && bankResult.transactions.length > 0) {
            return bankResult.transactions;
        }
    } catch (_) {}

    // Fallback to generic parsers
    const nuResult      = parsearNu(text, isCreditCard);
    const genericResult = parseMexicanStatement(text, isCreditCard);
    const transactions  = nuResult.length >= genericResult.length ? nuResult : genericResult;
    return transactions;
}
