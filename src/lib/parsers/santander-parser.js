import { inferirCategoria } from '../categorias';

// Santander — Super Nómina / Cuenta de Cheques
// Formato: FECHA  FOLIO  DESCRIPCION  DEPOSITO  RETIRO  SALDO
// "16-ABR-2024  7902325 ABONO TRANSFERENCIA SPEI...  1,005.02           9,363.04"
// "16-ABR-2024  0095577 CONSUMO LOCAL AJENO...                  78.00   9,285.04"

const MONTH_MAP = {
    ENE: '01', FEB: '02', MAR: '03', ABR: '04',
    MAY: '05', JUN: '06', JUL: '07', AGO: '08',
    SEP: '09', OCT: '10', NOV: '11', DIC: '12',
};

function santanderDateToISO(dateStr) {
    // "16-ABR-2024" → "2024-04-16"
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const day = parts[0].padStart(2, '0');
    const month = MONTH_MAP[parts[1].toUpperCase()] ?? '01';
    const year = parts[2];
    return `${year}-${month}-${day}`;
}

function parseAmount(str) {
    if (!str) return 0;
    return parseFloat(str.replace(/,/g, '')) || 0;
}

export function parseSantander(text) {
    const accountMatch = text.match(/(\d{2}-\d{8,}-\d)/i)
        ?? text.match(/SUPER NOMINA\s+([\d-]+)/i);
    const accountNumber = accountMatch?.[1] ?? '';

    const periodMatch = text.match(/PERIODO\s+([\d\w-]+)\s+AL\s+([\d\w-]+)/i);
    const period = periodMatch ? `${periodMatch[1]} - ${periodMatch[2]}` : '';

    const transactions = [];

    const txRegex = /^(\d{2}-(?:ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)-\d{4})\s+(\d{4,10})\s+(.{10,}?)\s{2,}([\d,]+\.\d{2})?\s*([\d,]+\.\d{2})?\s+([\d,]+\.\d{2})\s*$/gim;
    let match;
    while ((match = txRegex.exec(text)) !== null) {
        const isoDate = santanderDateToISO(match[1]);
        const description = match[3].trim().replace(/\s+/g, ' ').slice(0, 100);
        const col4 = match[4] ? parseAmount(match[4]) : null;
        const col5 = match[5] ? parseAmount(match[5]) : null;

        if (col4 !== null && col5 === null) {
            transactions.push({ fecha: isoDate, concepto: description, monto: col4, tipo: 'ingreso', categoria: inferirCategoria(description), banco: 'Santander' });
        } else if (col5 !== null && col4 === null) {
            transactions.push({ fecha: isoDate, concepto: description, monto: col5, tipo: 'egreso', categoria: inferirCategoria(description), banco: 'Santander' });
        } else if (col4 !== null && col5 !== null) {
            if (col4 > 0) transactions.push({ fecha: isoDate, concepto: description, monto: col4, tipo: 'ingreso', categoria: inferirCategoria(description), banco: 'Santander' });
            if (col5 > 0) transactions.push({ fecha: isoDate, concepto: description, monto: col5, tipo: 'egreso', categoria: inferirCategoria(description), banco: 'Santander' });
        }
    }

    return { banco: 'Santander', cuenta: accountNumber, periodo: period, transactions };
}
