import { inferirCategoria } from '../categorias';

// BBVA — Tarjeta de Crédito Oro
// Formato: FECHA OP.  FECHA CARGO  DESCRIPCIÓN  MONTO
// "23-mar-2026  23-mar-2026  MERPAGO*CARNESMAJOS   + $258.65"
// "13-abr-2026  13-abr-2026  PGO SPEI RECIB/...    - $115,000.00"
// TDC: "+" = cargo, "-" = pago/abono

const MONTH_MAP = {
    ene: '01', feb: '02', mar: '03', abr: '04',
    may: '05', jun: '06', jul: '07', ago: '08',
    sep: '09', oct: '10', nov: '11', dic: '12',
};

function bbvaDateToISO(dateStr) {
    // "23-mar-2026" → "2026-03-23"
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const day = parts[0].padStart(2, '0');
    const month = MONTH_MAP[parts[1].toLowerCase()] ?? '01';
    const year = parts[2];
    return `${year}-${month}-${day}`;
}

function parseAmount(str) {
    if (!str) return 0;
    return parseFloat(str.replace(/,/g, '')) || 0;
}

export function parseBBVA(text) {
    const accountMatch = text.match(/N[úu]mero de tarjeta[:\s]+([\d\s]+)/i);
    const lastFour = (accountMatch?.[1] ?? '').replace(/\s/g, '').slice(-4);
    const accountNumber = lastFour ? `****${lastFour}` : '';

    const periodMatch = text.match(/Periodo[:\s]+([\d\w-]+)\s+al\s+([\d\w-]+)/i);
    const period = periodMatch ? `${periodMatch[1]} - ${periodMatch[2]}` : '';

    const transactions = [];

    // Sección principal: FECHA OP  FECHA CARGO  DESCRIPCION  [+/-] $MONTO
    const txRegex = /^(\d{2}-(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)-\d{4})\s+(\d{2}-(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)-\d{4})\s+(.{5,80}?)\s+([+-])\s+\$\s*([\d,]+\.\d{2})/gim;
    let match;
    while ((match = txRegex.exec(text)) !== null) {
        const isoDate = bbvaDateToISO(match[1]);
        const description = match[3].trim().replace(/\s+/g, ' ').slice(0, 100);
        const sign = match[4];
        const monto = parseAmount(match[5]);
        // TDC BBVA: "+" = cargo al cliente (egreso), "-" = pago/abono (ingreso)
        const isPayment = sign === '-' || /PGO SPEI|PAGO/i.test(description);
        transactions.push({
            fecha: isoDate,
            concepto: description,
            monto,
            tipo: isPayment ? 'ingreso' : 'egreso',
            categoria: inferirCategoria(description),
            banco: 'BBVA',
        });
    }

    // Sección compras a meses
    const mesesRegex = /^(\d{2}-(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)-\d{4})\s+(.{5,80}?)\s+\$\s*([\d,]+\.\d{2})\s+\$\s*([\d,]+\.\d{2})\s+\$\s*([\d,]+\.\d{2})\s+(\d+)\s+de\s+(\d+)\s+0\.00%/gim;
    while ((match = mesesRegex.exec(text)) !== null) {
        const isoDate = bbvaDateToISO(match[1]);
        const description = `[${match[6]}/${match[7]} meses] ${match[2].trim()}`;
        const monthlyPayment = parseAmount(match[5]);
        transactions.push({
            fecha: isoDate,
            concepto: description,
            monto: monthlyPayment,
            tipo: 'egreso',
            categoria: inferirCategoria(match[2]),
            banco: 'BBVA',
        });
    }

    return { banco: 'BBVA', cuenta: accountNumber, periodo: period, transactions };
}
