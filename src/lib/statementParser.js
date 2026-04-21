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
const CARGO_RE  = /CARGO|RETIRO|D[EÉ]BITO|COMPRA/i;
const ABONO_RE  = /ABONO|DEP[OÓ]SITO|TRANSFERENCIA\s+RECIBIDA|CR[EÉ]DITO/i;
const DATE_SLASH = /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/;
const DATE_DASH  = /\b(\d{1,2})-(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)-(\d{4})\b/i;
const DATE_ISO   = /\b(\d{4})-(\d{2})-(\d{2})\b/;
const AMOUNT_RE  = /(?:^|[\s,])([-+]?\d{1,3}(?:,\d{3})*(?:\.\d{2}))/g;

function parseFecha(linea) {
    let m;
    if ((m = linea.match(DATE_SLASH))) {
        const y = m[3].length === 2 ? `20${m[3]}` : m[3];
        return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    }
    if ((m = linea.match(DATE_DASH))) {
        const mo = MESES[m[2].toUpperCase()];
        if (mo) return `${m[3]}-${mo}-${m[1].padStart(2, '0')}`;
    }
    if ((m = linea.match(DATE_ISO))) {
        return `${m[1]}-${m[2]}-${m[3]}`;
    }
    return null;
}

function parseMexicanStatement(text) {
    const transactions = [];
    for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.length < 8) continue;
        const fecha = parseFecha(trimmed);
        if (!fecha) continue;

        const amounts = [];
        AMOUNT_RE.lastIndex = 0;
        let m;
        while ((m = AMOUNT_RE.exec(trimmed)) !== null) {
            const v = parseFloat(m[1].replace(/,/g, ''));
            if (!isNaN(v) && Math.abs(v) >= 1) amounts.push(v);
        }
        if (amounts.length === 0) continue;

        const rawMonto = amounts[amounts.length - 1];
        const monto = Math.abs(rawMonto);
        let tipo = 'egreso';
        if (ABONO_RE.test(trimmed)) tipo = 'ingreso';
        else if (CARGO_RE.test(trimmed)) tipo = 'egreso';
        else if (rawMonto > 0 && amounts.length > 1) tipo = 'ingreso';

        const dateEnd = trimmed.search(/\d{1,2}[\/\-]\d/) + (trimmed.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/)?.[0]?.length || 0);
        const firstAmtIdx = trimmed.search(/\s\d{1,3}(?:,\d{3})*\.\d{2}/);
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
