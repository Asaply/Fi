import { categorize } from './categories';

// Banco Inbursa — Cuentaefe
// REAL FORMAT (pdf-parse, mostly ONE LINE per tx):
//   MAY 01 2969869111 COSTCO CHIHUAHUA MX 807.00 95,627.97
//   MAY 06 2975324467 TRASPASO ENTRE CUENTAS        ← multi-line description
//   TRASPASO DE (SANBORNS) - 8198 - DE LAURA IVONNE
//   PARRA CARDENAS A TU CUENTA (EFE) - 50060703854
//   9,000.00 101,214.90
//
// Columns: FECHA REFERENCIA CONCEPTO CARGOS ABONOS SALDO
// No explicit cargo/abono column — compare saldo with prev to determine tipo.

const MONTH_MAP = {
    ENE:'01', FEB:'02', MAR:'03', ABR:'04', MAY:'05', JUN:'06',
    JUL:'07', AGO:'08', SEP:'09', OCT:'10', NOV:'11', DIC:'12',
};

function parseAmt(s) {
    return parseFloat((s || '').replace(/,/g, '').trim()) || 0;
}

// Line starting a new transaction: "MAY 01 ..." or "MAY 01 2969869111 ..."
const DATE_START = /^(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)\s+(\d{2})(?:\s+\d+)?(.*)/i;
// Two amounts at end of line (or standalone): amount + saldo
const TWO_AMOUNTS_END = /([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/;

function isNoise(line) {
    const s = line.trim();
    if (!s) return true;
    if (/^FECHA\s+REFERENCIA|^DETALLE DE MOVIMIENTOS|^BANCO INBURSA|^AVENIDA PASEO/i.test(s)) return true;
    if (/^Página:\s*\d+/i.test(s)) return true;
    if (/^\d{6,}$/.test(s)) return true; // pure reference numbers
    return false;
}

export function parseInbursa(text) {
    const accountMatch = text.match(/CUENTA\s+(\d{10,})/i);
    const accountNumber = accountMatch?.[1] ?? '';

    const periodMatch = text.match(/PERIODO\s+Del\s+(.+?)\s+al\s+(.+?)(?:\s+FECHA|\n)/i)
        ?? text.match(/Del\s+(\d{2}\s+\w+\s+\d{4})\s+al\s+(\d{2}\s+\w+\s+\d{4})/i);
    const period = periodMatch ? `${periodMatch[1]} - ${periodMatch[2]}` : '';

    const yearMatch = text.match(/\b(20\d{2})\b/);
    const year = yearMatch?.[1] ?? String(new Date().getFullYear());

    const openingBalance = parseAmt(text.match(/SALDO ANTERIOR\s+([\d,]+\.\d{2})/i)?.[1]);
    const closingBalance  = parseAmt(text.match(/SALDO ACTUAL\s+([\d,]+\.\d{2})/i)?.[1]);
    const totalDeposits   = parseAmt(text.match(/ABONOS\s+([\d,]+\.\d{2})/i)?.[1]);
    const totalCharges    = parseAmt(text.match(/CARGOS\s+([\d,]+\.\d{2})/i)?.[1]);

    const detailStart = text.indexOf('DETALLE DE MOVIMIENTOS');
    const detailText = detailStart >= 0 ? text.slice(detailStart) : text;

    const lines = detailText.split('\n');
    const transactions = [];
    let prevSaldo = openingBalance;

    let currentDate = '';
    let currentParts = []; // accumulated text parts for current tx

    function flush() {
        if (!currentDate || currentParts.length === 0) return;

        // Inbursa: amounts can appear on the DATE line (same PDF row) when the
        // transaction has continuation description lines below it.
        // Strategy: check first part first (multi-line case), else use combined (single-line/last-line case).
        let amtMatch, desc;
        const firstMatch = TWO_AMOUNTS_END.exec(currentParts[0]);

        if (firstMatch && currentParts.length > 1) {
            // Amounts on date line; continuation lines are description only
            amtMatch = firstMatch;
            const firstDesc = currentParts[0].slice(0, firstMatch.index).trim();
            const rest = currentParts.slice(1).join(' ').trim();
            desc = (firstDesc + ' ' + rest).replace(/\s+/g, ' ').trim().slice(0, 150);
        } else {
            // Amounts on last (or only) line
            const combined = currentParts.join(' ').trim();
            amtMatch = TWO_AMOUNTS_END.exec(combined);
            if (!amtMatch) return;
            desc = combined.slice(0, amtMatch.index).trim();
            desc = desc.replace(/^\d{7,12}\s*/, '').trim(); // remove ref number
            desc = desc.replace(/\s+/g, ' ').slice(0, 150);
        }

        const monto = parseAmt(amtMatch[1]);
        const saldo = parseAmt(amtMatch[2]);

        if (monto === 0) return;

        if (/BALANCE INICIAL/i.test(desc)) {
            prevSaldo = saldo || monto;
            return;
        }

        // Determine tipo by saldo direction
        const isIncome = saldo > prevSaldo + 0.005;
        prevSaldo = saldo > 0 ? saldo : prevSaldo;

        // Keyword overrides
        let tipo = isIncome ? 'ingreso' : 'egreso';
        if (/INTERESES GANADOS|TRASPASO.*RECIB|ABONO|RENDIMIENTO|NOMINA|NÓMINA|DEPOSITO/i.test(desc)) tipo = 'ingreso';
        if (/COSTCO|GASOL|OXXO|FARMACIA|CASINO|SEARS|ALSUPER|COPPEL|CASETAS|PIZZERIA|MERCADO|RETIRO/i.test(desc)) tipo = 'egreso';

        if (!desc) return;

        transactions.push({
            fecha: currentDate,
            concepto: desc,
            monto,
            tipo,
            categoria: categorize(desc, tipo),
            banco: 'Inbursa',
        });
    }

    for (const line of lines) {
        if (isNoise(line)) continue;

        const dateM = DATE_START.exec(line.trim());
        if (dateM) {
            flush();
            const mon = dateM[1].toUpperCase();
            const day = dateM[2].padStart(2, '0');
            currentDate = `${year}-${MONTH_MAP[mon]}-${day}`;
            currentParts = [dateM[3].trim()]; // rest of the date line (ref + desc + maybe amounts)
        } else if (currentDate) {
            currentParts.push(line.trim());
        }
    }
    flush();

    if (openingBalance > 0) {
        const startDate = transactions[0]?.fecha ?? `${year}-01-01`;
        transactions.unshift({
            fecha: startDate,
            concepto: 'Saldo Anterior',
            monto: openingBalance,
            tipo: 'ingreso',
            categoria: categorize('Saldo Anterior', 'ingreso'),
            banco: 'Inbursa',
        });
    }

    return { banco: 'Inbursa', cuenta: accountNumber, periodo: period, transactions };
}
