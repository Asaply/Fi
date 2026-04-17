import { NextResponse } from 'next/server';
import { PDFParse } from 'pdf-parse';

// ── Shared month map ──────────────────────────────────────────────────────────

const MESES = {
    ENE: '01', FEB: '02', MAR: '03', ABR: '04', MAY: '05', JUN: '06',
    JUL: '07', AGO: '08', SEP: '09', OCT: '10', NOV: '11', DIC: '12',
};

// ── Nu parser ─────────────────────────────────────────────────────────────────
// Nu format: "DD MMM YYYY CONCEPTO ±$X,XXX.XX"
// Example:   "30 MAR 2026 Blanca Cardenas Airbnb -$1,000.00"

const REGEX_NU_LINE   = /^(\d{1,2})\s+(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)\s+(\d{4})\s+(.+?)\s+([+\-]\$[\d,]+\.\d{2})$/i;
const REGEX_NU_GLOBAL = /(\d{1,2})\s+(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)\s+(\d{4})\s+(.+?)\s+([+\-]\$[\d,]+\.\d{2})/gi;

function buildNuTx(match) {
    const [, dia, mes, anio, concepto, montoStr] = match;
    const mes2 = MESES[mes.toUpperCase()];
    if (!mes2) return null;
    if (/cajita/i.test(concepto)) return null; // skip internal Nu transfers
    const monto = parseFloat(montoStr.replace(/[$,]/g, ''));
    if (isNaN(monto)) return null;
    return {
        fecha: `${anio}-${mes2}-${dia.padStart(2, '0')}`,
        concepto: concepto.trim(),
        monto: Math.abs(monto),
        tipo: monto >= 0 ? 'ingreso' : 'egreso',
        categoria: categorizarNu(concepto),
    };
}

function parsearNu(texto) {
    const transacciones = [];

    // Strategy 1: line-by-line (most PDFs split each transaction onto its own line)
    for (const linea of texto.split('\n')) {
        const match = linea.trim().match(REGEX_NU_LINE);
        if (!match) continue;
        const tx = buildNuTx(match);
        if (tx) transacciones.push(tx);
    }

    // Strategy 2: global scan on the full text (handles "one big line" extraction)
    if (transacciones.length < 3) {
        const seen = new Set();
        REGEX_NU_GLOBAL.lastIndex = 0;
        let m;
        while ((m = REGEX_NU_GLOBAL.exec(texto)) !== null) {
            const tx = buildNuTx(m);
            if (!tx) continue;
            const key = `${tx.fecha}|${tx.concepto}|${tx.monto}`;
            if (!seen.has(key)) {
                seen.add(key);
                transacciones.push(tx);
            }
        }
    }

    return transacciones;
}

function categorizarNu(concepto) {
    const t = (concepto || '').toLowerCase();
    if (/netflix|spotify|disney|hbo|apple|youtube|openai|claude|netlify|porkbun|vercel/i.test(t))
        return 'Suscripciones';
    if (/oxxo|walmart|chedraui|soriana|costco|alsuper|seven|super/i.test(t))
        return 'Supermercado';
    if (/restaur|rest |taqueria|paleteria|little caesar|wendys|mcdonalds|burger|pizza|comida|hambur/i.test(t))
        return 'Comida';
    if (/gasol|gasolinera|pemex|autozone|estacionamiento|caseta/i.test(t))
        return 'Transporte';
    if (/telmex|telcel|att|izzi|totalplay|cfe|gas natural|predial/i.test(t))
        return 'Servicios';
    if (/farmacia|benavides|doctor|hospital|laboratorio|similares/i.test(t))
        return 'Salud';
    if (/barbershop|salon|spa|peluqueria/i.test(t))
        return 'Higiene';
    if (/cine|teatro|bar |antro|steam|juego/i.test(t))
        return 'Ocio';
    if (/office depot|papeleria|libreria/i.test(t))
        return 'Papelería';
    if (/airbnb|hospedaje|hosedaje|hotel/i.test(t))
        return 'Airbnb / Hospedaje';
    if (/spei|transferencia|deposito|depósito|pago a|envio/i.test(t))
        return 'Transferencias';
    return 'Otros';
}

// ── Generic parser (BBVA, Banorte, Santander, HSBC, Citibanamex) ──────────────
// Supports: dd/mm/yyyy  and  dd-MMM-YYYY

const CARGO_RE  = /CARGO|RETIRO|D[EÉ]BITO|COMPRA|PAGO\s/i;
const ABONO_RE  = /ABONO|DEP[OÓ]SITO|TRANSFERENCIA\s+RECIBIDA/i;
const DATE_RE   = /\b(\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}-[A-Z]{3}-\d{4})\b/i;
const AMOUNT_RE = /(-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g;

function parseDate(raw) {
    const m1 = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m1) return `${m1[3]}-${m1[2].padStart(2, '0')}-${m1[1].padStart(2, '0')}`;
    const m2 = raw.match(/^(\d{1,2})-([A-Z]{3})-(\d{4})$/i);
    if (m2) {
        const mo = MESES[m2[2].toUpperCase()];
        if (mo) return `${m2[3]}-${mo}-${m2[1].padStart(2, '0')}`;
    }
    return null;
}

function categorizarGenerico(concepto) {
    const t = (concepto || '').toLowerCase();
    if (/netflix|spotify|disney|amazon prime|apple|hbo|youtube|openai|claude/i.test(t)) return 'Suscripciones';
    if (/oxxo|walmart|chedraui|soriana|costco|alsuper/i.test(t)) return 'Supermercado';
    if (/restaur|mcdonalds|starbucks|uber eats|rappi|didi food|dominos|pizza/i.test(t)) return 'Comida';
    if (/uber|didi|cabify|gasolina|pemex|estacionamiento|caseta/i.test(t)) return 'Transporte';
    if (/telmex|telcel|att|izzi|totalplay|cfe|gas natural|predial/i.test(t)) return 'Servicios';
    if (/farmacia|benavides|doctor|hospital|laboratorio|similares/i.test(t)) return 'Salud';
    if (/salon|peluqueria|spa|barbershop/i.test(t)) return 'Higiene';
    if (/cine|teatro|bar |antro|steam/i.test(t)) return 'Ocio';
    if (/airbnb|hospedaje|hotel/i.test(t)) return 'Airbnb / Hospedaje';
    if (/spei|transferencia|envio|pago a/i.test(t)) return 'Transferencias';
    return 'Otros';
}

function parseMexicanStatement(text) {
    const transactions = [];
    for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.length < 8) continue;
        const dateMatch = trimmed.match(DATE_RE);
        if (!dateMatch) continue;
        const fecha = parseDate(dateMatch[1]);
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
        const dateEnd = trimmed.indexOf(dateMatch[1]) + dateMatch[1].length;
        const firstAmtIdx = trimmed.search(/\d{1,3}(?:,\d{3})*(?:\.\d{2})?/);
        const conceptRaw = trimmed.substring(dateEnd, firstAmtIdx > dateEnd ? firstAmtIdx : undefined);
        const concepto = conceptRaw.replace(/\s+/g, ' ').trim() || trimmed.substring(0, 60);
        transactions.push({ fecha, concepto, monto, tipo, categoria: categorizarGenerico(concepto) });
    }
    return transactions;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req) {
    let parser = null;
    try {
        const formData = await req.formData();
        const file = formData.get('file');
        if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

        const buffer = Buffer.from(await file.arrayBuffer());
        parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        const text = result.text;

        // Use whichever parser extracts more transactions
        const nuResult      = parsearNu(text);
        const genericResult = parseMexicanStatement(text);
        const transactions  = nuResult.length >= genericResult.length ? nuResult : genericResult;

        return NextResponse.json({ transactions });
    } catch (err) {
        console.error('[parse-statement]', err);
        return NextResponse.json({ error: err.message || 'Error al procesar el PDF' }, { status: 500 });
    } finally {
        if (parser) await parser.destroy().catch(() => {});
    }
}
