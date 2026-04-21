import { NextResponse } from 'next/server';
import { PDFParse, PasswordException } from 'pdf-parse';

// ── Shared month map ──────────────────────────────────────────────────────────

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

// ── PDF text extraction (with password support) ───────────────────────────────

async function extractPdfText(buffer, password) {
    const options = { data: buffer };
    if (password) options.password = password;

    const parser = new PDFParse(options);
    try {
        const result = await parser.getText();
        return result.text;
    } catch (err) {
        if (err instanceof PasswordException || err.name === 'PasswordException') {
            // If we supplied a password it was wrong; otherwise it's required
            const code = password ? 'INCORRECT_PASSWORD' : 'PASSWORD_REQUIRED';
            throw Object.assign(new Error(code), { code });
        }
        throw err;
    } finally {
        await parser.destroy().catch(() => {});
    }
}

// ── Categorización ─────────────────────────────────────────────────────────────

function categorizar(concepto) {
    const t = (concepto || '').toLowerCase();
    if (/netflix|spotify|disney|hbo|apple|youtube|openai|claude|netlify|porkbun|vercel|amazon prime/i.test(t))
        return 'Suscripciones';
    if (/oxxo|walmart|chedraui|soriana|costco|alsuper|seven.?eleven|super\s/i.test(t))
        return 'Supermercado';
    if (/restaur|rest\s|taqueria|paleteria|little caesar|wendys|mcdonalds|burger|pizza|comida|hambur|starbucks|uber\s?eats|rappi|didi\s?food|dominos/i.test(t))
        return 'Comida';
    if (/gasol|gasolinera|pemex|autozone|estacionamiento|caseta|uber|didi|cabify/i.test(t))
        return 'Transporte';
    if (/telmex|telcel|att|izzi|totalplay|cfe|gas\s?natural|predial/i.test(t))
        return 'Servicios';
    if (/farmacia|benavides|doctor|hospital|laboratorio|similares/i.test(t))
        return 'Salud';
    if (/barbershop|salon|spa|peluqueria/i.test(t))
        return 'Higiene';
    if (/cine|teatro|\bbar\b|antro|steam|juego/i.test(t))
        return 'Ocio';
    if (/office depot|papeleria|libreria/i.test(t))
        return 'Papelería';
    if (/airbnb|hospedaje|hotel/i.test(t))
        return 'Airbnb / Hospedaje';
    if (/spei|transferencia|deposito|depósito|pago\s?a\s|envio|envío/i.test(t))
        return 'Transferencias';
    return 'Otros';
}

// ── Nu parser ─────────────────────────────────────────────────────────────────

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
        categoria: categorizar(concepto),
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

// ── Generic parser (BBVA, Banorte, Santander, HSBC, Citibanamex) ──────────────

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
            transactions.push({ fecha, concepto, monto, tipo, categoria: categorizar(concepto) });
        }
    }
    return transactions;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req) {
    try {
        const formData = await req.formData();
        const file = formData.get('file');
        if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

        const password = formData.get('password') || '';
        const buffer = Buffer.from(await file.arrayBuffer());

        let rawText;
        try {
            rawText = await extractPdfText(buffer, password);
        } catch (err) {
            if (err.code === 'PASSWORD_REQUIRED') {
                return NextResponse.json(
                    { error: 'Este PDF está protegido con contraseña.', code: 'PASSWORD_REQUIRED' },
                    { status: 422 }
                );
            }
            if (err.code === 'INCORRECT_PASSWORD') {
                return NextResponse.json(
                    { error: 'Contraseña incorrecta. Intenta de nuevo.', code: 'INCORRECT_PASSWORD' },
                    { status: 422 }
                );
            }
            throw err;
        }

        const text = normalizarMeses(rawText);

        const nuResult      = parsearNu(text);
        const genericResult = parseMexicanStatement(text);
        const transactions  = nuResult.length >= genericResult.length ? nuResult : genericResult;

        if (transactions.length === 0) {
            const preview = rawText.substring(0, 800).replace(/\n+/g, ' | ');
            return NextResponse.json(
                { error: `No se encontraron transacciones. Formato no reconocido. Vista previa: "${preview}"` },
                { status: 422 }
            );
        }

        return NextResponse.json({ transactions });
    } catch (err) {
        console.error('[parse-statement]', err);
        return NextResponse.json({ error: err.message || 'Error al procesar el PDF' }, { status: 500 });
    }
}
