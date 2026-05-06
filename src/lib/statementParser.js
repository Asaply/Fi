import { inferirCategoria } from './categorias.js';
import { parseBankStatement } from './parsers/bank-statement-parser.js';

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
const DATE_DASH  = /\b(\d{1,2})[\s\-\/]+(?:de\s+)?(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)(?:\.?\s+de)?(?:[\s\-\/]+(\d{2,4})(?!\/))?\b/i;
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
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
    
    let currentTx = null;
    const currentYear = new Date().getFullYear();

    function flush() {
        if (currentTx && currentTx.monto > 0) {
            currentTx.concepto = currentTx.concepto.replace(/\s+/g, ' ').trim().slice(0, 150);
            currentTx.categoria = inferirCategoria(currentTx.concepto);
            transactions.push({ ...currentTx });
        }
        currentTx = null;
    }

    for (const line of lines) {
        const dateMatch = parseFecha(line);
        
        if (dateMatch) {
            flush();
            currentTx = {
                fecha: dateMatch.fecha,
                concepto: line.substring(dateMatch.endIdx).trim(),
                monto: 0,
                tipo: 'egreso',
                amounts: []
            };
            // Also check for amounts on the same line
            extractAmountsAndType(line, currentTx, dateMatch);
        } else if (currentTx) {
            // Look for amounts in this line
            extractAmountsAndType(line, currentTx, null);
        }
    }
    flush();

    return transactions;

    function extractAmountsAndType(textLine, tx, dateMatch) {
        const amounts = [];
        AMOUNT_RE.lastIndex = 0;
        let m;
        // Don't match the date as an amount if we are on the date line
        const searchLine = dateMatch ? textLine.substring(dateMatch.endIdx) : textLine;
        while ((m = AMOUNT_RE.exec(searchLine)) !== null) {
            const v = parseFloat(m[1].replace(/[,$\s]/g, ''));
            if (!isNaN(v) && Math.abs(v) >= 1) amounts.push(v);
        }

        if (amounts.length > 0) {
            if (tx.monto === 0) {
                const rawMonto = amounts[0];
                tx.monto = Math.abs(rawMonto);
                
                if (ABONO_RE.test(searchLine) || ABONO_RE.test(tx.concepto)) {
                    tx.tipo = isCreditCard ? 'Transferencia' : 'ingreso';
                } else if (CARGO_RE.test(searchLine) || CARGO_RE.test(tx.concepto)) {
                    tx.tipo = 'egreso';
                } else if (rawMonto < 0) {
                    tx.tipo = 'egreso';
                } else if (amounts.length > 1) {
                    tx.tipo = isCreditCard ? 'egreso' : 'ingreso';
                }
            }
            
            const textWithoutAmounts = searchLine.replace(AMOUNT_RE, '').trim();
            if (textWithoutAmounts && !/saldo|total|periodo/i.test(textWithoutAmounts)) {
                // if we are checking the date line, it's already in the concept, don't duplicate
                if (dateMatch) {
                    tx.concepto = textWithoutAmounts;
                } else {
                    tx.concepto += ' ' + textWithoutAmounts;
                }
            }
        } else {
            if (!/p[aá]gina|hoja|saldo|total|rfc|cliente|cuenta/i.test(searchLine)) {
                if (dateMatch) {
                    tx.concepto = searchLine;
                } else {
                    tx.concepto += ' ' + searchLine;
                }
            }
        }
    }
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
