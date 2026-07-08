import { extractItems } from './extractItems.js';
import { parseBbvaDebito } from './banks/bbvaDebito.js';
import { parseNuDebito } from './banks/nuDebito.js';
import { parseInbursaDebito } from './banks/inbursaDebito.js';
import { parseBbvaCredito } from './banks/bbvaCredito.js';
import { parseScotiaDebito } from './banks/scotiaDebito.js';
import { parseBanamexDebito } from './banks/banamexDebito.js';

// Registry of deterministic parsers. Each entry: how to recognize the bank from
// the statement's text layer, and the parser to run. Order matters only for
// disambiguation (more specific first).
const BANKS = [
    {
        id: 'bbva-debito',
        // Débito-specific: only BBVA débito statements carry the
        // "Retiros / Cargos (-)" + "Depósitos / Abonos (+)" summary block.
        // Credit cards use a different layout (pago mínimo / pago no intereses).
        match: (t) => /BBVA/i.test(t) && /Retiros\s*\/\s*Cargos\s*\(-\)/i.test(t) && /Dep[oó]sitos\s*\/\s*Abonos\s*\(\+\)/i.test(t),
        parse: parseBbvaDebito,
    },
    {
        id: 'nu-debito',
        match: (t) => /\bNu\b/.test(t) && /Nu M[eé]xico Financiera/i.test(t) && /Saldo inicial/i.test(t),
        parse: parseNuDebito,
    },
    {
        id: 'bbva-credito',
        match: (t) => /BBVA/i.test(t) && /Pago para no generar intereses/i.test(t) && /TOTAL CARGOS/i.test(t),
        parse: parseBbvaCredito,
    },
    {
        id: 'inbursa-debito',
        match: (t) => /INBURSA/i.test(t) && /DETALLE DE MOVIMIENTOS/i.test(t) && /SALDO ANTERIOR/i.test(t),
        parse: parseInbursaDebito,
    },
    {
        id: 'scotia-debito',
        match: (t) => /Scotiabank/i.test(t) && /Detalle de tus movimientos/i.test(t),
        parse: parseScotiaDebito,
    },
    {
        id: 'banamex-debito',
        match: (t) => /Banamex/i.test(t) && /Detalle de Operaciones/i.test(t) && /RETIROS\s+DEP[OÓ]SITOS/i.test(t),
        parse: parseBanamexDebito,
    },
];

/** Is the extracted text usable (real text layer, not a scanned/garbled PDF)? */
function textIsUsable(fullText) {
    if (!fullText || fullText.length < 800) return false;
    const ascii = (fullText.match(/[a-zA-Z0-9]/g) || []).length;
    return ascii / fullText.length > 0.4;
}

/**
 * Attempt a deterministic, coordinate-based parse of a bank statement PDF.
 * Returns a parsed object in the SAME shape the AI path produces
 * ({ banco, tipo_cuenta, periodo, saldo_anterior, saldo_final, total_cargos,
 * total_abonos, num_movimientos, movimientos }) plus `_engine: 'deterministic'`
 * and `_bank`. Returns null when the text is unusable or no parser matches — the
 * caller then falls back to the AI vision path.
 *
 * @param {Buffer|Uint8Array} buffer
 * @returns {Promise<object|null>}
 */
export async function tryDeterministicParse(buffer) {
    let extracted;
    try {
        extracted = await extractItems(buffer);
    } catch {
        return null; // encrypted / corrupt / image-only → let AI handle it
    }
    const { fullText, pages } = extracted;
    if (!textIsUsable(fullText)) return null;

    const bank = BANKS.find(b => b.match(fullText));
    if (!bank) return null;

    try {
        const parsed = bank.parse(pages, fullText);
        if (!parsed || !Array.isArray(parsed.movimientos) || parsed.movimientos.length === 0) return null;
        parsed._engine = 'deterministic';
        parsed._bank = bank.id;
        return parsed;
    } catch {
        return null;
    }
}
