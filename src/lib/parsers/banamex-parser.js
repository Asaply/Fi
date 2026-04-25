import { inferirCategoria } from '../categorias';

// Banamex — MiCuenta
// Formato: FECHA  CONCEPTO  RETIROS  DEPÓSITOS  SALDO
// "16 FEB    PAGO INTERBANCARIO A NU MEXICO...  10,000.00              13,221.52"
// "23 FEB    PAGO RECIBIDO DE BBVA MEXICO...               2,500.00   10,404.53"
// Header: "del 16 de febrero al 15 de marzo del 2026"

const MONTH_ABR = {
    ENE: '01', FEB: '02', MAR: '03', ABR: '04',
    MAY: '05', JUN: '06', JUL: '07', AGO: '08',
    SEP: '09', OCT: '10', NOV: '11', DIC: '12',
};

function parseAmount(str) {
    if (!str) return 0;
    return parseFloat(str.replace(/,/g, '')) || 0;
}

export function parseBanamex(text) {
    const accountMatch = text.match(/N[úu]mero de cuenta de cheques\s+(\d+)/i)
        ?? text.match(/N[úu]mero de contrato\s+(\d+)/i);
    const accountNumber = accountMatch?.[1] ?? '';

    const periodMatch = text.match(/del\s+(\d+)\s+de\s+(\w+)\s+al\s+\d+\s+de\s+(\w+)\s+del\s+(\d{4})/i);
    const period = periodMatch ? `${periodMatch[1]} ${periodMatch[2]} - ${periodMatch[3]} ${periodMatch[4]}` : '';
    const year = periodMatch?.[4] ?? text.match(/\d{4}/)?.[0] ?? String(new Date().getFullYear());

    const transactions = [];

    // DD MES  DESCRIPCION  [retiro]  [deposito]  saldo
    const txRegex = /^(\d{2})\s+(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)\s+(.{10,100}?)\s{2,}([\d,]+\.\d{2})?\s*([\d,]+\.\d{2})?\s+([\d,]+\.\d{2})\s*$/gim;
    let match;
    while ((match = txRegex.exec(text)) !== null) {
        const day = match[1].padStart(2, '0');
        const monthNum = MONTH_ABR[match[2].toUpperCase()] ?? '01';
        const isoDate = `${year}-${monthNum}-${day}`;
        const description = match[3].trim().replace(/\s+/g, ' ').slice(0, 100);
        const col4 = match[4] ? parseAmount(match[4]) : null; // retiro
        const col5 = match[5] ? parseAmount(match[5]) : null; // depósito

        if (col4 !== null && col5 === null) {
            transactions.push({ fecha: isoDate, concepto: description, monto: col4, tipo: 'egreso', categoria: inferirCategoria(description), banco: 'Banamex' });
        } else if (col5 !== null && col4 === null) {
            transactions.push({ fecha: isoDate, concepto: description, monto: col5, tipo: 'ingreso', categoria: inferirCategoria(description), banco: 'Banamex' });
        } else if (col4 !== null && col5 !== null) {
            const isDeposit = /PAGO RECIBIDO|ABONO|DEPOSITO|SPIN BY OXXO/i.test(description);
            const monto = Math.max(col4, col5);
            transactions.push({ fecha: isoDate, concepto: description, monto, tipo: isDeposit ? 'ingreso' : 'egreso', categoria: inferirCategoria(description), banco: 'Banamex' });
        }
    }

    return { banco: 'Banamex', cuenta: accountNumber, periodo: period, transactions };
}
