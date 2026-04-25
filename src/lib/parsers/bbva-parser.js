import { categorize } from './categories';

// BBVA — Tarjeta de Crédito Oro
// REAL FORMAT (line-by-line from pdf-parse):
//   08-abr-2026
//   09-abr-2026
//   NETFLIX COM 1
//   + $329.00
//
//   13-abr-2026
//   13-abr-2026
//   PGO SPEI RECIB/0187338163
//   - $115,000.00
//
// SIGN RULE (TDC): "+" = cargo al usuario (EGRESO), "-" = pago a la deuda (INGRESO).

const MONTH_MAP = {
    ene: '01', feb: '02', mar: '03', abr: '04',
    may: '05', jun: '06', jul: '07', ago: '08',
    sep: '09', oct: '10', nov: '11', dic: '12',
};

function bbvaDateToISO(d) {
    const p = d.split('-');
    if (p.length !== 3) return d;
    const month = MONTH_MAP[p[1].toLowerCase()] ?? '01';
    return `${p[2]}-${month}-${p[0].padStart(2, '0')}`;
}

function parseAmt(s) {
    if (!s) return 0;
    return parseFloat(s.replace(/[$,\s]/g, '')) || 0;
}

const DATE_RE = /^\d{2}-(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)-\d{4}$/i;
const AMOUNT_LINE_RE = /^([+-])\s*\$\s*([\d,]+\.\d{2})$/;
const DOLLAR_AMOUNT_RE = /^\$\s*([\d,]+\.\d{2})$/;

export function parseBBVA(text) {
    const cardMatch = text.match(/N[uú]mero de tarjeta[:\s]+([\d\s]+)/i);
    const lastFour = (cardMatch?.[1] ?? '').replace(/\s/g, '').slice(-4);
    const accountNumber = lastFour ? `****${lastFour}` : '';

    const periodMatch = text.match(/Periodo[:\s]+([\d\w-]+)\s+al\s+([\d\w-]+)/i);
    const period = periodMatch ? `${periodMatch[1]} - ${periodMatch[2]}` : '';

    const openingBalance = parseAmt(text.match(/Adeudo del periodo anterior\s+\$?([\d,]+\.\d{2})/i)?.[1]);
    const closingBalance  = parseAmt(text.match(/PAGO PARA NO GENERAR INTERESES\S?\s+\$?([\d,]+\.\d{2})/i)?.[1]);
    const totalDeposits   = parseAmt(text.match(/Pagos y abonos\s+-\s+\$?([\d,]+\.\d{2})/i)?.[1]);
    const totalCharges    = parseAmt(text.match(/Cargos regulares \(no a meses\)\s+\+\s+\$?([\d,]+\.\d{2})/i)?.[1]);

    const transactions = [];
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // Main section: parse line by line
    // fecha_op → [fecha_cargo] → description(s) → [+/-] $monto
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (!DATE_RE.test(line)) { i++; continue; }

        const fechaOp = line;
        i++;

        // Optional: second date = fecha de cargo
        if (i < lines.length && DATE_RE.test(lines[i])) i++;

        // Description lines until amount
        const descLines = [];
        while (i < lines.length && !AMOUNT_LINE_RE.test(lines[i])) {
            if (DATE_RE.test(lines[i])) break; // next transaction
            descLines.push(lines[i]);
            i++;
        }

        if (i >= lines.length) break;

        const montoMatch = AMOUNT_LINE_RE.exec(lines[i]);
        if (!montoMatch) continue;
        i++;

        const sign = montoMatch[1];   // "+" or "-"
        const monto = parseAmt(montoMatch[2]);
        const description = descLines.join(' ').replace(/\s+/g, ' ').trim().slice(0, 150);

        if (monto === 0 || description.length < 2) continue;

        // BBVA TDC: "+" = cargo (egreso para el usuario), "-" = pago (ingreso)
        const tipo = sign === '-' ? 'ingreso' : 'egreso';

        transactions.push({
            fecha: bbvaDateToISO(fechaOp),
            concepto: description,
            monto,
            tipo,
            categoria: categorize(description, tipo),
            banco: 'BBVA',
        });
    }

    // MSI section: COMPRAS Y CARGOS DIFERIDOS A MESES
    const mesesStart = text.indexOf('COMPRAS Y CARGOS DIFERIDOS A MESES');
    if (mesesStart >= 0) {
        const mesesText = text.slice(mesesStart);
        const mesesLines = mesesText.split('\n').map(l => l.trim()).filter(Boolean);
        let j = 0;
        while (j < mesesLines.length) {
            if (!DATE_RE.test(mesesLines[j])) { j++; continue; }
            const fecha = mesesLines[j]; j++;
            const desc = mesesLines[j] ?? ''; j++;
            // Collect $ amounts
            const amounts = [];
            while (j < mesesLines.length && DOLLAR_AMOUNT_RE.test(mesesLines[j])) {
                amounts.push(parseAmt(mesesLines[j]));
                j++;
            }
            // Skip "N de M" and "0.00%"
            while (j < mesesLines.length && (mesesLines[j].match(/^\d+ de \d+$/) || mesesLines[j] === '0.00%')) j++;

            const pagoRequerido = amounts[2] ?? amounts[0] ?? 0;
            if (pagoRequerido > 0) {
                transactions.push({
                    fecha: bbvaDateToISO(fecha),
                    concepto: `[MSI] ${desc.trim()}`,
                    monto: pagoRequerido,
                    tipo: 'egreso',
                    categoria: categorize(desc, 'egreso'),
                    banco: 'BBVA',
                });
            }
        }
    }

    return { banco: 'BBVA', cuenta: accountNumber, periodo: period, transactions };
}
