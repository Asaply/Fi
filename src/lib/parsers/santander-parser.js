import { categorize } from './categories';

// Santander — Super Nómina / Cuenta de Cheques
// This parser receives OCR text (Santander PDFs are image-based).
//
// OCR format:
//   16-ABR-2024  7902325  ABONO TRANSFERENCIA SPEI HORA 04:18:12   1,005.02           9,363.04
//   16-ABR-2024  0095577  CONSUMO LOCAL AJENO TERMINACION 3217               78.00   9,285.04
//
// Columns: FECHA  FOLIO  DESCRIPCION  [DEPOSITO]  [RETIRO]  SALDO

const MONTH_ES = {
    ENE: '01', FEB: '02', MAR: '03', ABR: '04',
    MAY: '05', JUN: '06', JUL: '07', AGO: '08',
    SEP: '09', OCT: '10', NOV: '11', DIC: '12',
};

function santanderDate(s) {
    // "16-ABR-2024" → "2024-04-16"
    const p = s.split('-');
    if (p.length !== 3) return s;
    const month = MONTH_ES[p[1].toUpperCase()] ?? '01';
    return `${p[2]}-${month}-${p[0].padStart(2, '0')}`;
}

function parseAmt(s) {
    if (!s) return 0;
    return parseFloat(s.replace(/,/g, '').trim()) || 0;
}

const DATE_PATTERN_RE = /\d{2}-(?:ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)-\d{4}/i;

export function parseSantander(text, isCreditCard = false) {
    const accountMatch = text.match(/(\d{2}-\d{8,}-\d)/i)
        ?? text.match(/SUPER NOMINA\s*([\d-]+)/i);
    const accountNumber = accountMatch?.[1] ?? '';

    const periodMatch = text.match(/PERIODO\s+([\d\w-]+)\s+AL\s+([\d\w-]+)/i);
    const period = periodMatch ? `${periodMatch[1]} - ${periodMatch[2]}` : '';

    const openingBalance = parseAmt(text.match(/SALDO FINAL DEL PERIODO ANTERIOR[!:]?\s*\$?\s*([\d,]+\.\d{2})/i)?.[1]);
    const closingBalance  = parseAmt(text.match(/SALDO FINAL DEL PERIODO[:\s]+\$?\s*([\d,]+\.\d{2})(?!\s+ANTERIOR)/i)?.[1]);
    const totalDeposits   = parseAmt(text.match(/[-+]\s*Dep[oó]sitos\s+([\d,]+\.\d{2})/i)?.[1]);
    const totalCharges    = parseAmt(text.match(/[-+]\s*Retiros\s+([\d,]+\.\d{2})/i)?.[1]);

    const transactions = [];
    const lines = text.split('\n');

    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const dateMatch = line.match(/((\d{2})-(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)-(\d{4}))/i);
        if (!dateMatch) { i++; continue; }

        const isoDate = santanderDate(dateMatch[1]);
        const rest = line.slice(line.indexOf(dateMatch[1]) + dateMatch[1].length).trim();

        // Remove folio (4-10 digits at start)
        const restNoFolio = rest.replace(/^\d{4,10}\s+/, '');

        // Accumulate description (continuation lines without dates)
        let fullText = restNoFolio;
        i++;
        while (
            i < lines.length &&
            !DATE_PATTERN_RE.test(lines[i]) &&
            !/TOTAL\s+DEPOSITOS|SALDO FINAL DEL PERIODO:/i.test(lines[i])
        ) {
            const next = lines[i].trim();
            // Stop if next line is all digits/punctuation (it's part of the amounts row)
            if (next.match(/^[\d,. ]+$/) || next.length === 0) break;
            fullText += ' ' + next;
            i++;
        }

        // Extract all numeric amounts from fullText
        const amounts = (fullText.match(/[\d,]+\.\d{2}/g) ?? []).map(parseAmt);
        const description = fullText
            .replace(/[\d,]+\.\d{2}/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 150);

        if (amounts.length < 2) continue; // only saldo, no movement

        // amounts: may be [monto_tx, saldo] or [deposito, retiro, saldo]
        let monto = 0;
        let tipo = 'egreso';

        if (amounts.length === 2) {
            monto = amounts[0];
            const isIncome = /ABONO|RECIBIDO|TRANSFERENCIA.*SPEI|N[OÓ]MINA|DEVOLUC/i.test(description);
            tipo = isIncome ? (isCreditCard ? 'Transferencia' : 'ingreso') : 'egreso';
        } else if (amounts.length >= 3) {
            const v1 = amounts[0];
            const v2 = amounts[1];
            // Santander: DEPOSITO col before RETIRO col; one is 0 (absent)
            if (v1 > 0 && v2 === 0) { monto = v1; tipo = isCreditCard ? 'Transferencia' : 'ingreso'; }
            else if (v2 > 0 && v1 === 0) { monto = v2; tipo = 'egreso'; }
            else { monto = v1; tipo = isCreditCard ? 'Transferencia' : 'ingreso'; } // fallback
        }

        if (monto === 0 || description.length < 2) continue;

        transactions.push({
            fecha: isoDate,
            concepto: description,
            monto,
            tipo,
            categoria: categorize(description, tipo),
            banco: 'Santander',
        });
    }

    if (openingBalance > 0) {
        const startDate = transactions[0]?.fecha
            ?? (periodMatch?.[1] ? santanderDate(periodMatch[1]) : null)
            ?? new Date().getFullYear() + '-01-01';
        transactions.unshift({
            fecha: startDate,
            concepto: 'Saldo Anterior',
            monto: openingBalance,
            tipo: 'ingreso',
            categoria: categorize('Saldo Anterior', 'ingreso'),
            banco: 'Santander',
        });
    }

    return { banco: 'Santander', cuenta: accountNumber, periodo: period, transactions };
}
