import { categorize } from './categories';

// Banco Inbursa — Cuentaefe
// REAL FORMAT (line-by-line from pdf-parse/pdfjs):
//   MAY 01 2969869111
//   COSTCO CHIHUAHUA MX
//   807.00
//   95,627.97
//
// Cargo vs abono: compare saldo with previous saldo.
// Values are always positive — no explicit cargo/abono column.

const MONTH_MAP = {
    ENE: '01', FEB: '02', MAR: '03', ABR: '04',
    MAY: '05', JUN: '06', JUL: '07', AGO: '08',
    SEP: '09', OCT: '10', NOV: '11', DIC: '12',
};

function parseAmt(s) {
    if (!s) return 0;
    return parseFloat(s.replace(/,/g, '').trim()) || 0;
}

export function parseInbursa(text) {
    const accountMatch = text.match(/CUENTA\s+(\d{10,})/i);
    const accountNumber = accountMatch?.[1] ?? '';

    const periodMatch = text.match(/Del\s+(\d{2}\s+\w+\s+\d{4})\s+al\s+(\d{2}\s+\w+\s+\d{4})/i);
    const period = periodMatch ? `${periodMatch[1]} - ${periodMatch[2]}` : '';

    const yearMatch = text.match(/\b(20\d{2})\b/);
    const year = yearMatch?.[1] ?? String(new Date().getFullYear());

    const openingBalance = parseAmt(text.match(/SALDO ANTERIOR\s+([\d,]+\.\d{2})/i)?.[1]);
    const closingBalance  = parseAmt(text.match(/SALDO ACTUAL\s+([\d,]+\.\d{2})/i)?.[1]);
    const totalDeposits   = parseAmt(text.match(/ABONOS\s+([\d,]+\.\d{2})/i)?.[1]);
    const totalCharges    = parseAmt(text.match(/CARGOS\s+([\d,]+\.\d{2})/i)?.[1]);

    // Find detail section
    const detailStart = text.indexOf('DETALLE DE MOVIMIENTOS');
    const detailText = detailStart >= 0 ? text.slice(detailStart) : text;

    const lines = detailText.split('\n').map(l => l.trim()).filter(Boolean);
    const transactions = [];

    // Skip to first date line
    let i = 0;
    while (i < lines.length && !lines[i].match(/^(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)/)) i++;

    let prevSaldo = openingBalance;

    while (i < lines.length) {
        const line = lines[i];

        // Date line: "MAY 01" or "MAY 01 2969869111"
        const dateMatch = line.match(/^(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)\s+(\d{2})(?:\s+\d+)?$/);
        if (!dateMatch) { i++; continue; }

        const monthNum = MONTH_MAP[dateMatch[1]] ?? '01';
        const day = dateMatch[2].padStart(2, '0');
        const isoDate = `${year}-${monthNum}-${day}`;
        i++;

        // Collect description lines until we hit a money line
        const descLines = [];
        while (
            i < lines.length &&
            !lines[i].match(/^[\d,]+\.\d{2}$/) &&
            !lines[i].match(/^(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)/)
        ) {
            descLines.push(lines[i]);
            i++;
        }
        const description = descLines.join(' ').slice(0, 120);

        // Amount line
        if (i >= lines.length) break;
        const montoMatch = lines[i].match(/^([\d,]+\.\d{2})$/);
        if (!montoMatch) continue;
        i++;

        // Balance line
        let saldo = 0;
        if (i < lines.length) {
            const saldoMatch = lines[i].match(/^([\d,]+\.\d{2})$/);
            if (saldoMatch) {
                saldo = parseAmt(saldoMatch[1]);
                i++;
            }
        }

        const monto = parseAmt(montoMatch[1]);
        if (monto === 0) continue;
        if (/BALANCE INICIAL/i.test(description)) { prevSaldo = monto; continue; }

        // Determine tipo by saldo change
        const saldoRose = saldo > 0 && saldo >= prevSaldo - 1;
        if (saldo > 0) prevSaldo = saldo;

        // Keyword overrides
        const incomeKW = /INTERESES GANADOS|TRASPASO.*RECIB|ABONO|RENDIMIENTO|NOMINA|NÓMINA|DEPOSITO/i;
        const expenseKW = /COSTCO|GASOL|OXXO|FARMACIA|CASINO|SEARS|ALSUPER|COPPEL|CASETAS|PIZZERIA|MERCADO|RETIRO/i;

        let tipo = saldoRose ? 'ingreso' : 'egreso';
        if (incomeKW.test(description)) tipo = 'ingreso';
        if (expenseKW.test(description)) tipo = 'egreso';

        transactions.push({
            fecha: isoDate,
            concepto: description || 'Sin descripción',
            monto,
            tipo,
            categoria: categorize(description, tipo),
            banco: 'Inbursa',
        });
    }

    return { banco: 'Inbursa', cuenta: accountNumber, periodo: period, transactions };
}
