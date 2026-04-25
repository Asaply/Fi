import { parseHSBC } from './hsbc-parser';
import { parseInbursa } from './inbursa-parser';
import { parseSantander } from './santander-parser';
import { parseBanamex } from './banamex-parser';
import { parseBBVA } from './bbva-parser';

/**
 * Detect bank from PDF text (or filename as fallback for image PDFs).
 * @param {string} text
 * @param {string} [filename]
 * @returns {'hsbc'|'inbursa'|'santander'|'banamex'|'bbva'|null}
 */
export function detectBank(text, filename = '') {
    const f = filename.toLowerCase();

    // By text content
    if (/nomina flexible hsbc|hsbc.*estado de cuenta/i.test(text)) return 'hsbc';
    if (/banco inbursa|cuentaefe|inbursa.*estado de cuenta/i.test(text)) return 'inbursa';
    if (/banco santander|super nomina.*santander|estado de cuenta n[oó]mina.*santander/i.test(text)) return 'santander';
    if (/banamex|micuenta|banco nacional de m[eé]xico/i.test(text)) return 'banamex';
    if (/bbva mexico|tarjeta oro bbva|bbva.*estado de cuenta/i.test(text)) return 'bbva';

    // Fallback to filename when text is empty/unreadable (image PDF)
    if (!text.trim() || text.trim().length < 50) {
        if (f.includes('hsbc')) return 'hsbc';
        if (f.includes('inbursa')) return 'inbursa';
        if (f.includes('santander')) return 'santander';
        if (f.includes('banamex')) return 'banamex';
        if (f.includes('bbva')) return 'bbva';
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
 */
export function parseBankStatement(text, filename = '') {
    const bank = detectBank(text, filename);
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
