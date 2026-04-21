import { inferirCategoria } from './categorias';

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

function buildNuTx(day, mon, year, concepto, montoStr) {
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
        tipo: monto < 0 ? 'egreso' : 'ingreso',
        categoria: inferirCategoria(concepto),
    };
}

function parsearNu(texto) {
    const transacciones = [];
    for (const linea of texto.split('\n')) {
        const m = linea.trim().match(NU_LINE_RE);
        if (!m) continue;
        const tx = buildNuTx(m[1], m[2], m[3], m[4], m[5]);
        if (tx) transacciones.push(tx);
    }
    if (transacciones.length < 3) {
        const seen = new Set();
        NU_GLOBAL_RE.lastIndex = 0;
        let m;
        while ((m = NU_GLOBAL_RE.exec(texto)) !== null) {
            const tx = buildNuTx(m[1], m[2], m[3], m[4], m[5]);
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

function parseMexicanStatement(text) {
    const transactions = [];
    for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.length < 8) continue;
        const dateMatch = parseFecha(trimmed);
        if (!dateMatch) continue;
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
        if (ABONO_RE.test(trimmed)) tipo = 'ingreso';
        else if (CARGO_RE.test(trimmed)) tipo = 'egreso';
        else if (rawMonto < 0) tipo = 'egreso';
        else if (rawMonto > 0 && amounts.length > 1) tipo = 'ingreso'; // Asume que si es positivo y hay múltiples, es abono (Banorte/BBVA)
        else if (rawMonto > 0 && amounts.length === 1) tipo = 'ingreso';

        const conceptRaw = trimmed.substring(dateEnd, firstAmtIdx > dateEnd ? firstAmtIdx : undefined);
        const concepto = conceptRaw.replace(/\s+/g, ' ').trim() || trimmed.substring(0, 60);

        if (monto > 0) {
            transactions.push({ fecha, concepto, monto, tipo, categoria: inferirCategoria(concepto) });
        }
    }
    return transactions;
}

export function parseStatementText(rawText) {
    const text = normalizarMeses(rawText);
    const nuResult      = parsearNu(text);
    const genericResult = parseMexicanStatement(text);
    const transactions  = nuResult.length >= genericResult.length ? nuResult : genericResult;
    return transactions;
}
