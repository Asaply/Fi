import { categorize } from './categories';

// Banamex — MiCuenta
// REAL FORMAT (pdf-parse output):
//   16
//   FEB
//   PAGO INTERBANCARIO A NU MEXICO
//   AL BENEF. DEREK
//   REF. 0130226 pago MISMO DIA
//   10,000.00        ← no trailing space = RETIRO (egreso)
//   13,221.52
//
//   23 FEB           ← date on same line also occurs
//   PAGO RECIBIDO DE BBVA MEXICO
//   2,500.00         ← trailing space = DEPÓSITO (ingreso)
//   10,404.53
//
// KEY RULE: trailing space on amount line = deposit (ingreso).

const MONTHS = new Set(['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC']);
const MONTH_MAP = {
    ENE:'01', FEB:'02', MAR:'03', ABR:'04', MAY:'05', JUN:'06',
    JUL:'07', AGO:'08', SEP:'09', OCT:'10', NOV:'11', DIC:'12',
};

// Exact noise lines and prefixes to discard
const NOISE_EXACT = new Set([
    'FECHA','CONCEPTO','RETIROS','DEPÓSITOS','SALDO','SALDO ANTERIOR',
    'Centro de Atención Telefónica','Ciudad de México: 55 1226 2639',
    "Resto del país: 800 021 2345",
    'Detalle de Operaciones  En pesos Moneda Nacional',
    '0003909','000190.B26INDA020.AR.0313.01',
    'Resumen Operaciones Tarjeta',
]);
const NOISE_PREFIXES = [
    'Página ','TARJETA ','CONSUMOS','IMPORTE',
    'VARIOS','TOTAL','AHORRO FACIL','**La GAT','MiCuenta',
    'Resumen','Número de contrato','Saldo anterior','(+)','(-)',
    'Intereses','Saldo al','En el período','Saldo promedio','Días del',
    'Tasa de interés','Impuesto','* Expresada','Estado de Cuenta',
    'AHORRO','Periodo','GAT Nominal','GAT Real','Número de Contrato',
    'SUC.','AVENIDA','POPULAR','DEREK',
];

const DATE_ONE_LINE = /^(\d{1,2})\s+(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)$/i;
const DATE_NUM_ONLY = /^(\d{1,2})$/;
// Amount: digits/commas + decimal, optional single trailing space
const AMOUNT_LINE   = /^([\d,]+\.\d{2})( ?)$/;

function isNoise(line) {
    const s = line.trim();
    if (!s) return true;
    if (NOISE_EXACT.has(s) || NOISE_EXACT.has(line)) return true;
    if (NOISE_PREFIXES.some(p => s.startsWith(p))) return true;
    if (/^Página\s+\d+/.test(s)) return true;
    // Long numeric ref lines: "20260218 75064956047001025192098 683519"
    if (/^\d{8}\s+\d{10,}/.test(s)) return true;
    // Pure long numeric strings (CLABE, account numbers)
    if (/^\d{10,}$/.test(s)) return true;
    // Tech codes like "000190.B26INDA020.AR.0313.01"
    if (/^\d{6}\.[A-Z0-9.]+$/.test(s)) return true;
    return false;
}

function parseAmt(s) {
    return parseFloat((s || '').replace(/,/g, '')) || 0;
}

export function parseBanamex(text) {
    // Metadata
    const accountMatch = text.match(/N[uú]mero de cuenta de cheques\s+(\d+)/i)
        ?? text.match(/N[uú]mero de contrato\s+(\d+)/i);
    const accountNumber = accountMatch?.[1] ?? '';

    const periodMatch = text.match(/del\s+\d+\s+de\s+\w+\s+al\s+\d+\s+de\s+\w+\s+del\s+(\d{4})/i);
    const year = periodMatch?.[1] ?? text.match(/\b(20\d{2})\b/)?.[1] ?? String(new Date().getFullYear());
    const periodFull = text.match(/Per[ií]odo del (.+?)(?:\n|$)/i)?.[1]?.trim() ?? '';

    const openingBalance = parseAmt(text.match(/Saldo anterior\s+En pesos M\.N\.\s+([\d,]+\.\d{2})/i)?.[1]);
    const closingBalance  = parseAmt(text.match(/Saldo al Corte\s+([\d,]+\.\d{2})/i)?.[1]);
    const totalDeposits   = parseAmt(text.match(/\(\+\)\s+\d+\s+Dep[oó]sitos\s+([\d,]+\.\d{2})/i)?.[1]);
    const totalCharges    = parseAmt(text.match(/\(-\)\s+\d+\s+Retiros[^\n]*?([\d,]+\.\d{2})/i)?.[1]);

    // Collect all "Detalle de Operaciones" sections (one per page)
    const rawLines = [];
    let searchFrom = 0;
    while (true) {
        const idx = text.indexOf('Detalle de Operaciones', searchFrom);
        if (idx < 0) break;
        rawLines.push(...text.slice(idx).split('\n'));
        searchFrom = idx + 1;
    }
    // Fallback: use whole text
    if (rawLines.length === 0) rawLines.push(...text.split('\n'));

    const lines = rawLines.filter(l => !isNoise(l));

    // State machine
    const transactions = [];
    let currentDate = '';
    let currentLines = [];

    function flushTx() {
        if (!currentDate || currentLines.length === 0) return;

        // Find last two AMOUNT_LINE matches → [monto, saldo]
        const amtIdxs = [];
        for (let j = 0; j < currentLines.length; j++) {
            if (AMOUNT_LINE.test(currentLines[j])) amtIdxs.push(j);
        }
        if (amtIdxs.length < 2) return;

        const montoIdx = amtIdxs[amtIdxs.length - 2];
        const montoLine = currentLines[montoIdx];
        const montoMatch = AMOUNT_LINE.exec(montoLine);
        if (!montoMatch) return;

        const isDeposit = montoMatch[2] === ' ';  // trailing space = depósito
        const monto = parseAmt(montoMatch[1]);
        if (monto === 0) return;

        const descLines = currentLines
            .slice(0, montoIdx)
            .map(l => l.trim())
            .filter(l => l.length > 0)
            .filter(l => !/^\d{8}/.test(l) && !/^\d{10,}$/.test(l))
            .filter(l => !/^\d{4}\/\d{4}$/.test(l))
            .filter(l => !l.startsWith('RASTREO') && !l.startsWith('CTA.BENEFICIARIO'));

        const concepto = descLines.join(' ').replace(/\s+/g, ' ').trim().slice(0, 150);
        if (!concepto) return;

        const tipo = isDeposit ? 'ingreso' : 'egreso';

        transactions.push({
            fecha: currentDate,
            concepto,
            monto,
            tipo,
            categoria: categorize(concepto, tipo),
            banco: 'Banamex',
        });
    }

    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const s = line.trim();

        // "DD MES" on one line
        const oneLineMatch = DATE_ONE_LINE.exec(s);
        if (oneLineMatch) {
            flushTx();
            const day = oneLineMatch[1].padStart(2, '0');
            const mon = oneLineMatch[2].toUpperCase();
            currentDate = `${year}-${MONTH_MAP[mon]}-${day}`;
            currentLines = [];
            i++;
            continue;
        }

        // "DD" on one line, "MES" on next
        const numOnly = DATE_NUM_ONLY.exec(s);
        const nextTrimmed = i + 1 < lines.length ? lines[i + 1].trim().toUpperCase() : '';
        if (numOnly && MONTHS.has(nextTrimmed)) {
            flushTx();
            const day = numOnly[1].padStart(2, '0');
            currentDate = `${year}-${MONTH_MAP[nextTrimmed]}-${day}`;
            currentLines = [];
            i += 2;
            continue;
        }

        if (currentDate) {
            currentLines.push(line);
        }
        i++;
    }
    flushTx();

    return { banco: 'Banamex', cuenta: accountNumber, periodo: periodFull, transactions };
}
