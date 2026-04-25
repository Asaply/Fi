import { categorize } from './categories';

// HSBC Nómina Flexible
// This parser receives text extracted by pdfjs-dist (client) or OCR.
// HSBC PDFs often have corrupted encoding — detect with needsOCR() before parsing.
//
// OCR/clean format:
//   01   5213009006___APPLE.COM/BILL US   11771645     $49.00              $1,117.03
//   04   TRANSFERENCIA BPI DESDE...       13651011              $1,600.00   $2,499.18
// Columns: DÍA  DESCRIPCIÓN  REF  [RETIRO]  [ABONO]  SALDO

function parseAmt(s) {
    if (!s) return 0;
    return parseFloat(s.replace(/[$,\s]/g, '')) || 0;
}

export function parseHSBC(text) {
    const accountMatch = text.match(/N[ÚU]MERO DE CUENTA\s+(\d+)/i)
        ?? text.match(/N[uú]mero de cuenta[:\s]+(\d+)/i);
    const accountNumber = accountMatch?.[1] ?? '';

    const periodMatch = text.match(/(\d{2}\/\d{2}\/\d{4})\s+al\s+(\d{2}\/\d{2}\/\d{4})/)
        ?? text.match(/Per[ií]odo del\s+(\d{2}\/\d{2}\/\d{4})\s+al\s+(\d{2}\/\d{2}\/\d{4})/);
    const period = periodMatch ? `${periodMatch[1]} - ${periodMatch[2]}` : '';

    const ymMatch = periodMatch?.[1]?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    const year      = ymMatch?.[3] ?? String(new Date().getFullYear());
    const baseMonth = ymMatch?.[2] ?? '01';

    const openingBalance = parseAmt(text.match(/Saldo Inicial del[\s\n]+Periodo\s+\$?([\d,]+\.\d{2})/i)?.[1]);
    const closingBalance  = parseAmt(text.match(/Saldo Final del[\s\n]+Periodo\s+\$?([\d,]+\.\d{2})/i)?.[1]);
    const totalDeposits   = parseAmt(text.match(/Dep[oó]sitos\/[\s\n]+Abonos\s+\$\s*([\d,]+\.\d{2})/i)?.[1]);
    const totalCharges    = parseAmt(text.match(/Retiros\/Cargos\s+\$\s*([\d,]+\.\d{2})/i)?.[1]);

    const detailStart = text.indexOf('DETALLE MOVIMIENTOS');
    const detailText  = detailStart >= 0 ? text.slice(detailStart) : text;

    const transactions = [];

    // Primary: día (1-2 digits) + desc + optional ref digits + [retiro $X] + [abono $X] + saldo $X
    // Match lines: "01   APPLE.COM/BILL...   11771645     $49.00              $1,117.03"
    const txRegex = /^(\d{1,2})\s{2,}(.+?)\s{2,}(?:\d{6,}\s+)?(\$[\s\d,.]+)?\s*(\$[\s\d,.]+)?\s*(\$[\s\d,.]+)\s*$/gm;
    let match;

    while ((match = txRegex.exec(detailText)) !== null) {
        const day = match[1].padStart(2, '0');
        const rawDesc = match[2].trim();

        // Skip header rows
        if (/d[ií]a|descripci[oó]n|referencia|serial/i.test(rawDesc)) continue;

        const col3 = match[3] ? parseAmt(match[3]) : 0; // retiro or abono
        const col4 = match[4] ? parseAmt(match[4]) : 0; // abono or saldo
        // match[5] = saldo (always present)

        const description = rawDesc
            .replace(/^\d{10,}\s*/, '')    // strip ref numbers
            .replace(/_{3,}/g, '')         // strip underscores
            .trim()
            .slice(0, 120);

        let monto = 0;
        let tipo = 'egreso';

        if (col3 > 0 && col4 === 0) {
            monto = col3; tipo = 'egreso';
        } else if (col4 > 0 && col3 === 0) {
            monto = col4; tipo = 'ingreso';
        } else if (col3 > 0 && col4 > 0) {
            const isDeposit = /TRANSFERENCIA BPI|ABONO|DEPOSITO/i.test(description);
            if (isDeposit) { monto = Math.max(col3, col4); tipo = 'ingreso'; }
            else           { monto = Math.min(col3, col4); tipo = 'egreso';  }
        } else {
            continue;
        }

        if (monto === 0) continue;

        transactions.push({
            fecha: `${year}-${baseMonth}-${day}`,
            concepto: description,
            monto,
            tipo,
            categoria: categorize(description, tipo),
            banco: 'HSBC',
        });
    }

    // Fallback: simpler line-by-line
    if (transactions.length === 0) {
        for (const line of detailText.split('\n')) {
            const m = line.match(/^(\d{1,2})\s+(.+?)\s+\$\s*([\d,]+\.\d{2})/);
            if (!m) continue;
            const day = m[1].padStart(2, '0');
            const desc = m[2].replace(/^\d{10,}\s*/, '').replace(/_{3,}/g, '').trim().slice(0, 120);
            const monto = parseFloat(m[3].replace(/,/g, ''));
            if (!monto) continue;
            const isIncome = /TRANSFERENCIA BPI|ABONO|DEPOSITO/i.test(desc);
            transactions.push({
                fecha: `${year}-${baseMonth}-${day}`,
                concepto: desc,
                monto,
                tipo: isIncome ? 'ingreso' : 'egreso',
                categoria: categorize(desc, isIncome ? 'ingreso' : 'egreso'),
                banco: 'HSBC',
            });
        }
    }

    return { banco: 'HSBC', cuenta: accountNumber, periodo: period, transactions };
}
