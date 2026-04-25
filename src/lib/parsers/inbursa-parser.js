import { inferirCategoria } from '../categorias';

// Banco Inbursa — Cuentaefe
// Formato: MES DD  REF  CONCEPTO  CARGOS  ABONOS  SALDO
// "MAY 01  2969869111  COSTCO CHIHUAHUA MX  807.00    95,627.97"
// Header: "Del 01 May 2024 al 31 May 2024"

const MONTH_MAP = {
    ENE: '01', FEB: '02', MAR: '03', ABR: '04',
    MAY: '05', JUN: '06', JUL: '07', AGO: '08',
    SEP: '09', OCT: '10', NOV: '11', DIC: '12',
};

function parseAmount(str) {
    if (!str) return 0;
    return parseFloat(str.replace(/,/g, '')) || 0;
}

export function parseInbursa(text) {
    const accountMatch = text.match(/CUENTA\s+(\d+)/i);
    const accountNumber = accountMatch?.[1] ?? '';

    const periodMatch = text.match(/Del\s+(\d{2}\s+\w+\s+\d{4})\s+al\s+(\d{2}\s+\w+\s+\d{4})/i);
    const period = periodMatch ? `${periodMatch[1]} - ${periodMatch[2]}` : '';
    const yearMatch = text.match(/\d{4}/);
    const year = yearMatch?.[0] ?? String(new Date().getFullYear());

    const transactions = [];

    // Primary regex
    const txRegex = /^(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)\s+(\d{2})\s+(\d+)\s+(.{5,60}?)\s{2,}([\d,]+\.\d{2})?\s*([\d,]+\.\d{2})?\s+([\d,]+\.\d{2})\s*$/gm;
    let match;
    while ((match = txRegex.exec(text)) !== null) {
        const monthNum = MONTH_MAP[match[1]] ?? '01';
        const day = match[2];
        const description = match[4].trim();
        const cargoStr = match[5];
        const abonoStr = match[6];

        if (cargoStr) {
            transactions.push({
                fecha: `${year}-${monthNum}-${day}`,
                concepto: description,
                monto: parseAmount(cargoStr),
                tipo: 'egreso',
                categoria: inferirCategoria(description),
                banco: 'Inbursa',
            });
        } else if (abonoStr) {
            transactions.push({
                fecha: `${year}-${monthNum}-${day}`,
                concepto: description,
                monto: parseAmount(abonoStr),
                tipo: 'ingreso',
                categoria: inferirCategoria(description),
                banco: 'Inbursa',
            });
        }
    }

    // Fallback
    if (transactions.length === 0) {
        const simpleRegex = /^(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)\s+(\d{2})\s+.{6,10}\s+(.{5,50})\s+([\d,]+\.\d{2})\s*([\d,]+\.\d{2})?\s*([\d,]+\.\d{2})/gm;
        while ((match = simpleRegex.exec(text)) !== null) {
            const monthNum = MONTH_MAP[match[1]] ?? '01';
            const description = match[3].trim();
            const val1 = parseAmount(match[4]);
            const val2 = match[5] ? parseAmount(match[5]) : null;
            if (val2 !== null) {
                if (val1 > 0) {
                    transactions.push({ fecha: `${year}-${monthNum}-${match[2]}`, concepto: description, monto: val1, tipo: 'egreso', categoria: inferirCategoria(description), banco: 'Inbursa' });
                } else {
                    transactions.push({ fecha: `${year}-${monthNum}-${match[2]}`, concepto: description, monto: val2, tipo: 'ingreso', categoria: inferirCategoria(description), banco: 'Inbursa' });
                }
            } else {
                transactions.push({ fecha: `${year}-${monthNum}-${match[2]}`, concepto: description, monto: val1, tipo: 'egreso', categoria: inferirCategoria(description), banco: 'Inbursa' });
            }
        }
    }

    return { banco: 'Inbursa', cuenta: accountNumber, periodo: period, transactions };
}
