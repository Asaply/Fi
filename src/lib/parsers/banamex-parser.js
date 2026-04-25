import { categorize } from './categories';

// Banamex — MiCuenta
// REAL FORMAT (pdf-parse output):
//   16
//   FEB
//   PAGO INTERBANCARIO A NU MEXICO
//   AL BENEF. DEREK
//   REF. 0130226 pago MISMO DIA
//   10,000.00
//   13,221.52
//
// OR sometimes: "16 FEB" on same line.
// Trailing space on deposits: "2,500.00 " vs "10,000.00" for retiros.

const MONTH_ABR = {
    ENE: '01', FEB: '02', MAR: '03', ABR: '04',
    MAY: '05', JUN: '06', JUL: '07', AGO: '08',
    SEP: '09', OCT: '10', NOV: '11', DIC: '12',
};

function parseAmt(s) {
    if (!s) return 0;
    return parseFloat(s.replace(/,/g, '').trim()) || 0;
}

const INCOME_KW = /PAGO RECIBIDO|ABONO|DEPOSITO CANALES|SPIN BY OXXO|TRANSFERENCIA.*RECIB|N[OÓ]MINA|SUELDO|INTERESES/i;
const EXPENSE_KW = /PAGO INTERBANCARIO A|AMAZON|APPLE\.COM|NAYAXX|HTECH|COMISION|RETIRO|CARGO/i;

export function parseBanamex(text) {
    const accountMatch = text.match(/N[uú]mero de cuenta de cheques\s+(\d+)/i)
        ?? text.match(/N[uú]mero de contrato\s+(\d+)/i);
    const accountNumber = accountMatch?.[1] ?? '';

    const periodMatch = text.match(/del\s+(\d+)\s+de\s+(\w+)\s+al\s+\d+\s+de\s+(\w+)\s+del\s+(\d{4})/i);
    const period = periodMatch ? `${periodMatch[1]} ${periodMatch[2]} - ${periodMatch[3]} ${periodMatch[4]}` : '';
    const year = periodMatch?.[4] ?? text.match(/\b(20\d{2})\b/)?.[1] ?? String(new Date().getFullYear());

    const openingBalance = parseAmt(text.match(/Saldo anterior\s+En pesos M\.N\.\s+([\d,]+\.\d{2})/i)?.[1]);
    const closingBalance  = parseAmt(text.match(/Saldo al Corte\s+([\d,]+\.\d{2})/i)?.[1]);
    const totalDeposits   = parseAmt(text.match(/\(\+\)\s+\d+\s+Dep[oó]sitos\s+([\d,]+\.\d{2})/i)?.[1]);
    const totalCharges    = parseAmt(text.match(/\(-\)\s+\d+\s+Retiros[\s/].*?\s+([\d,]+\.\d{2})/i)?.[1]);

    const detailStart = text.indexOf('Detalle de Operaciones');
    const detailText = detailStart >= 0 ? text.slice(detailStart) : text;
    const lines = detailText.split('\n').map(l => l.trim()).filter(Boolean);

    const transactions = [];
    const AMOUNT_RE = /^([\d,]+\.\d{2})\s*$/;
    const MONTH_RE  = /^(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)$/i;
    const DAY_RE    = /^(\d{1,2})$/;

    let currentDay = '';
    let currentMonth = '';
    let currentDescLines = [];
    let state = 'idle';

    const flush = () => {
        if (!currentDay || !currentMonth || currentDescLines.length === 0) return;

        // Find amount lines at end of desc block
        const amtLines = [];
        while (currentDescLines.length > 0 && AMOUNT_RE.test(currentDescLines[currentDescLines.length - 1])) {
            amtLines.unshift(parseAmt(currentDescLines.pop()));
        }

        if (amtLines.length === 0) return;

        const description = currentDescLines
            .filter(l => !l.match(/^\d{8}\s/) && !l.match(/^\d{4}\/\d{4}/))
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 150);

        if (/SALDO ANTERIOR/i.test(description)) return;

        const monto = amtLines[0]; // first amount = transaction amount (second = saldo)
        if (monto === 0) return;

        const isIncome = INCOME_KW.test(description);
        const isExpense = EXPENSE_KW.test(description);
        const tipo = isIncome ? 'ingreso' : isExpense ? 'egreso' : 'egreso';
        const monthNum = MONTH_ABR[currentMonth.toUpperCase()] ?? '01';

        transactions.push({
            fecha: `${year}-${monthNum}-${currentDay}`,
            concepto: description || 'Sin descripción',
            monto,
            tipo,
            categoria: categorize(description, tipo),
            banco: 'Banamex',
        });
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // "16 FEB" on same line
        const dateOneLine = line.match(/^(\d{1,2})\s+(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)$/i);
        // "16" alone with next line being month
        const dayOnly = DAY_RE.exec(line);
        const nextIsMonth = i + 1 < lines.length && MONTH_RE.test(lines[i + 1]);

        if (dateOneLine) {
            flush();
            currentDay = dateOneLine[1].padStart(2, '0');
            currentMonth = dateOneLine[2].toUpperCase();
            currentDescLines = [];
            state = 'collecting';
        } else if (dayOnly && nextIsMonth) {
            flush();
            currentDay = dayOnly[1].padStart(2, '0');
            currentMonth = lines[i + 1].toUpperCase();
            i++;
            currentDescLines = [];
            state = 'collecting';
        } else if (state === 'collecting') {
            currentDescLines.push(line);
        }
    }
    flush();

    return { banco: 'Banamex', cuenta: accountNumber, periodo: period, transactions };
}
