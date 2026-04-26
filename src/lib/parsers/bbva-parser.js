import { categorize } from './categories';

// BBVA — Tarjeta de Crédito Oro
// REAL FORMAT (pdf-parse):
//   08-abr-2026 09-abr-2026 NETFLIX COM 1 + $329.00
//   13-abr-2026 13-abr-2026 PGO SPEI RECIB/0187338163 - $115,000.00
//   (optional continuation) IVA :$ 0.00 ...
//   28-mar-2026 30-mar-2026 WM SUPERCENTER N1015 + $254.02
//   (optional continuation) USD $13.99 TIPO DE CAMBIO $18.16
//
// SIGN: + = cargo (expense), - = pago/abono (income)

const MONTH_MAP = {
    ene:'01', feb:'02', mar:'03', abr:'04', may:'05', jun:'06',
    jul:'07', ago:'08', sep:'09', oct:'10', nov:'11', dic:'12',
};

function bbvaDateToISO(d) {
    const p = d.split('-');
    if (p.length !== 3) return d;
    return `${p[2]}-${MONTH_MAP[p[1].toLowerCase()] ?? '01'}-${p[0].padStart(2, '0')}`;
}

function parseAmt(s) {
    return parseFloat((s || '').replace(/[$,\s]/g, '')) || 0;
}

// Main tx line: "DD-mes-YYYY DD-mes-YYYY DESCRIPTION +/- $AMOUNT"
const TX_RE = /^(\d{2}-[a-záéíóúü]+-\d{4})\s+\d{2}-[a-záéíóúü]+-\d{4}\s+(.+?)\s+([+\-])\s*\$\s*([\d,]+\.\d{2})\s*$/i;

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

    for (const line of text.split('\n')) {
        const m = TX_RE.exec(line.trim());
        if (!m) continue;

        const fecha = bbvaDateToISO(m[1]);
        const description = m[2].trim().slice(0, 150);
        const sign = m[3];
        const monto = parseAmt(m[4]);

        if (monto === 0 || description.length < 2) continue;

        // Skip header/noise lines caught by regex
        if (/^Fecha\s+de\s+la|Descripci[oó]n del movimiento/i.test(description)) continue;

        // + = cargo (expense), - = pago/abono (income)
        const tipo = sign === '-' ? 'ingreso' : 'egreso';

        transactions.push({
            fecha,
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
        const mesesEnd = text.indexOf('CARGOS,COMPRAS Y ABONOS REGULARES', mesesStart + 1);
        const mesesText = mesesEnd > mesesStart
            ? text.slice(mesesStart, mesesEnd)
            : text.slice(mesesStart);

        for (const line of mesesText.split('\n')) {
            const m = TX_RE.exec(line.trim());
            if (!m) continue;
            const fecha = bbvaDateToISO(m[1]);
            const description = `[MSI] ${m[2].trim()}`.slice(0, 150);
            const monto = parseAmt(m[4]);
            if (monto === 0) continue;
            transactions.push({
                fecha,
                concepto: description,
                monto,
                tipo: 'egreso',
                categoria: categorize(m[2], 'egreso'),
                banco: 'BBVA',
            });
        }
    }

    return { banco: 'BBVA', cuenta: accountNumber, periodo: period, transactions };
}
