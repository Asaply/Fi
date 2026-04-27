import { categorize } from './categories';

// Banamex — MiCuenta
// REAL FORMAT (pdf-parse):
//   Detalle de Operaciones En pesos Moneda Nacional
//   FECHA CONCEPTO RETIROS DEPÓSITOS SALDO
//   SALDO ANTERIOR 23,221.52
//   16 FEB PAGO INTERBANCARIO A NU MEXICO
//   AL BENEF. DEREK
//   REF. 0130226 pago MISMO DIA 10,000.00 13,221.52
//   23 FEB PAGO RECIBIDO DE BBVA MEXICO
//   2,500.00 15,721.52
//
// Date starts line: "16 FEB DESCRIPTION..."
// Last content of each tx has TWO trailing amounts: monto + saldo
// Saldo comparison with prev determines tipo (no trailing-space trick)

const MONTH_MAP = {
    ENE:'01', FEB:'02', MAR:'03', ABR:'04', MAY:'05', JUN:'06',
    JUL:'07', AGO:'08', SEP:'09', OCT:'10', NOV:'11', DIC:'12',
};

// Exact noise lines injected between transactions
const NOISE_EXACT = new Set([
    'FECHA','CONCEPTO','RETIROS','DEPÓSITOS','SALDO',
    'Centro de Atención Telefónica',
    'Ciudad de México: 55 1226 2639',
    "Resto del país: 800 021 2345",
    'SUC. 4109 PACHECO, CHIHUAHUA,',
    'AVENIDA CARLOS PACHECO VILLA SN',
    'POPULAR', 'POPULAR ',
    'DEREK ARMANDO VALENZUELA MACIAS',
    'Detalle de Operaciones  En pesos Moneda Nacional',
    '0003909', '000190.B26INDA020.AR.0313.01',
    'Resumen Operaciones Tarjeta',
]);

const NOISE_PREFIXES = [
    'Página ','TARJETA ','TOTAL','AHORRO FACIL','**La GAT','MiCuenta',
    'Resumen','Número de contrato','Saldo anterior','(+)','(-)',
    'Intereses','Saldo al','En el período','Saldo promedio','Días del',
    'Tasa de interés','Impuesto','* Expresada','Estado de Cuenta',
    'Período del','Número de sucursal','Número de cuenta',
    'Número de Tarjeta','CLABE','AHORRO','Periodo','GAT Nominal',
    'GAT Real','Número de Contrato','Número de cliente','RFC ',
    'SALDO ANTERIOR',
];

// Line starting a new transaction: "16 FEB DESCRIPTION..." or just "16 FEB"
const DATE_START = /^(\d{1,2})\s+(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)\s*(.*)/i;
// Two amounts at end of combined text: monto + saldo
const TWO_AMOUNTS_END = /([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/;

function isNoise(line) {
    const s = line.trim();
    if (!s) return true;
    if (NOISE_EXACT.has(s) || NOISE_EXACT.has(line)) return true;
    if (NOISE_PREFIXES.some(p => s.startsWith(p))) return true;
    if (/^Página\s+\d+/.test(s)) return true;
    if (/^Detalle de Operaciones/i.test(s)) return true;
    if (/^FECHA\s+CONCEPTO/i.test(s)) return true;
    // Reference lines: "20260218 75064956047001025192098 683519"
    if (/^\d{8}\s+\d{10,}/.test(s)) return true;
    // Long numeric strings (CLABE, account numbers)
    if (/^\d{10,}$/.test(s)) return true;
    // Reference codes: "000190.B26INDA020.AR.0313.01"
    if (/^\d{6}\.[A-Z0-9.]+$/.test(s)) return true;
    // Slash codes: "9000/0012"
    if (/^\d{4}\/\d{4}$/.test(s)) return true;
    return false;
}

function parseAmt(s) {
    return parseFloat((s || '').replace(/,/g, '')) || 0;
}

export function parseBanamex(text) {
    const accountMatch = text.match(/N[uú]mero de cuenta de cheques\s+(\d+)/i)
        ?? text.match(/N[uú]mero de contrato\s+(\d+)/i);
    const accountNumber = accountMatch?.[1] ?? '';

    const yearMatch = text.match(/del\s+\d+\s+de\s+\w+\s+al\s+\d+\s+de\s+\w+\s+del\s+(\d{4})/i)
        ?? text.match(/\b(20\d{2})\b/);
    const year = yearMatch?.[1] ?? String(new Date().getFullYear());

    const periodFull = text.match(/Per[ií]odo del\s+(.+?)(?:\n|$)/i)?.[1]?.trim() ?? '';

    const openingBalance = parseAmt(
        text.match(/SALDO ANTERIOR\s+([\d,]+\.\d{2})/i)?.[1]
        ?? text.match(/Saldo anterior\s+En pesos M\.N\.\s+([\d,]+\.\d{2})/i)?.[1]
    );

    // Collect lines starting from first "Detalle de Operaciones"
    // (single slice avoids duplicating later pages)
    const detailStart = text.indexOf('Detalle de Operaciones');
    const allLines = (detailStart >= 0 ? text.slice(detailStart) : text).split('\n');

    const transactions = [];
    let prevSaldo = openingBalance;
    let currentDate = '';
    let currentParts = [];

    function flush() {
        if (!currentDate || currentParts.length === 0) return;

        const combined = currentParts.join(' ').trim();
        const amtMatch = TWO_AMOUNTS_END.exec(combined);
        if (!amtMatch) return;

        const monto = parseAmt(amtMatch[1]);
        const saldo = parseAmt(amtMatch[2]);
        if (monto === 0) return;

        // Build description: text before the two amounts, strip noise tokens
        let desc = combined.slice(0, amtMatch.index).trim();
        desc = desc.replace(/\bREF\.\s*\d+\b/gi, '');
        desc = desc.replace(/\bRASTREO\b.*/i, '');
        desc = desc.replace(/\bCTA\.BENEFICIARIO\b.*/i, '');
        desc = desc.replace(/\bpago MISMO DIA\b/i, '');
        desc = desc.replace(/\s+/g, ' ').trim().slice(0, 150);

        if (!desc) return;

        const isIncome = saldo > prevSaldo + 0.005;
        prevSaldo = saldo > 0 ? saldo : prevSaldo;
        const tipo = isIncome ? 'ingreso' : 'egreso';

        transactions.push({
            fecha: currentDate,
            concepto: desc,
            monto,
            tipo,
            categoria: categorize(desc, tipo),
            banco: 'Banamex',
        });
    }

    for (const line of allLines) {
        if (isNoise(line)) continue;

        const s = line.trim();
        const dateM = DATE_START.exec(s);
        if (dateM) {
            flush();
            const day = dateM[1].padStart(2, '0');
            const mon = dateM[2].toUpperCase();
            currentDate = `${year}-${MONTH_MAP[mon]}-${day}`;
            currentParts = [dateM[3].trim()].filter(Boolean);
        } else if (currentDate) {
            // Skip pure reference lines inside tx body
            if (/^\d{8}\s/.test(s)) continue;
            if (/^\d{10,}$/.test(s)) continue;
            if (/^\d{6}\.[A-Z0-9.]+$/.test(s)) continue;
            currentParts.push(s);
        }
    }
    flush();

    return { banco: 'Banamex', cuenta: accountNumber, periodo: periodFull, transactions };
}
