import { parseHSBC } from './hsbc-parser';
import { parseInbursa } from './inbursa-parser';
import { parseSantander } from './santander-parser';
import { parseBanamex } from './banamex-parser';
import { parseBBVA } from './bbva-parser';

export function detectBank(text) {
    if (/NOMINA FLEXIBLE HSBC|HSBC/i.test(text)) return 'hsbc';
    if (/BANCO INBURSA|Cuentaefe|INBURSA/i.test(text)) return 'inbursa';
    if (/Banco Santander|SUPER NOMINA.*Santander|ESTADO DE CUENTA N[ÓO]MINA.*Santander/i.test(text)) return 'santander';
    if (/Banamex|MiCuenta|BANCO NACIONAL DE M[ÉE]XICO/i.test(text)) return 'banamex';
    if (/BBVA|TARJETA ORO BBVA|BBVA MEXICO/i.test(text)) return 'bbva';
    return null;
}

// Returns { banco, cuenta, periodo, transactions }
// where transactions use the existing format: { fecha, concepto, monto, tipo, categoria }
export function parseBankStatement(text) {
    const bank = detectBank(text);
    if (!bank) return null;

    switch (bank) {
        case 'hsbc':      return parseHSBC(text);
        case 'inbursa':   return parseInbursa(text);
        case 'santander': return parseSantander(text);
        case 'banamex':   return parseBanamex(text);
        case 'bbva':      return parseBBVA(text);
        default:          return null;
    }
}
