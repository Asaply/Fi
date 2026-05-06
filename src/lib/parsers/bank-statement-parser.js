import { parseSantander } from './santander-parser.js';
import { parseBanamex } from './banamex-parser.js';
import { parseBBVA } from './bbva-parser.js';
import { parseNu } from './nu-parser.js';
import { parseHSBC } from './hsbc-parser.js';
import { parseInbursa } from './inbursa-parser.js';

/**
 * Detect bank from PDF text (or filename as fallback for image PDFs).
 * @param {string} text
 * @param {string} [filename]
 * @returns {'hsbc'|'inbursa'|'santander'|'banamex'|'bbva'|'nu'|null}
 */
export function detectBank(text, filename = '') {
    const f = filename.toLowerCase();

    // By text content
    if (/nomina flexible hsbc|hsbc.*estado de cuenta/i.test(text)) return 'hsbc';
    if (/banco inbursa|cuentaefe|inbursa.*estado de cuenta/i.test(text)) return 'inbursa';
    if (/banco santander|super nomina.*santander|estado de cuenta n[oó]mina.*santander/i.test(text)) return 'santander';
    if (/banamex|micuenta|banco nacional de m[eé]xico/i.test(text)) return 'banamex';
    if (/bbva mexico|tarjeta oro bbva|bbva.*estado de cuenta/i.test(text)) return 'bbva';
    if (/cuenta nu|nu mexico/i.test(text)) return 'nu';

    // Fallback to filename when text is empty/unreadable (image PDF)
    if (!text.trim() || text.trim().length < 50) {
        if (f.includes('hsbc')) return 'hsbc';
        if (f.includes('inbursa')) return 'inbursa';
        if (f.includes('santander')) return 'santander';
        if (f.includes('banamex')) return 'banamex';
        if (f.includes('bbva')) return 'bbva';
        if (f.includes('nu')) return 'nu';
    }

    return null;
}

/**
 * Detect if a PDF needs OCR (image-based or corrupted encoding).
 * HSBC: many non-ASCII chars (Õ Ö Ô É Á) = corrupted encoding.
 * @param {string} text
 * @returns {boolean}
 */
export function needsOCR(text) {
    if (!text || text.trim().length < 100) return true;
    const nonAsciiRatio = (text.match(/[^\x00-\x7F]/g) ?? []).length / text.length;
    return nonAsciiRatio > 0.3;
}

/**
 * Parse a bank statement. Returns { banco, cuenta, periodo, transactions }
 * where transactions use format: { fecha, concepto, monto, tipo, categoria }
 * @param {string} text
 * @param {string} [filename]
 * @param {boolean} [isCreditCard]
 */
export function parseBankStatement(text, filename = '', isCreditCard = false) {
    const bank = detectBank(text, filename);
    if (!bank) return null;

    switch (bank) {
        case 'hsbc':      return parseHSBC(text, isCreditCard);
        case 'inbursa':   return parseInbursa(text, isCreditCard);
        case 'santander': return parseSantander(text, isCreditCard);
        case 'banamex':   return parseBanamex(text, isCreditCard);
        case 'bbva':      return parseBBVA(text, isCreditCard);
        case 'nu':        return parseNu(text, isCreditCard);
        default:          return null;
    }
}
