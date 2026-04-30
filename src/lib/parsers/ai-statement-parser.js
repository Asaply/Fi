/**
 * AI-powered bank statement parser.
 * Two paths:
 *   1. Text-based  — extracted text → /api/parse-statement → Claude (fast, cheap)
 *   2. Vision-based — page images  → /api/parse-ai        → Claude Vision (for scanned PDFs)
 *
 * Returns transactions in finanzas format: {fecha, concepto, monto, tipo, categoria, banco}
 */

function categorizeAI(description, type) {
    if (type === 'income' || type === 'ingreso' || type === 'abono') {
        if (/nomina|nómina|sueldo|salario/i.test(description)) return 'Salario';
        if (/intereses/i.test(description)) return 'Intereses';
        if (/deposito canales|spin by oxxo/i.test(description)) return 'Depósito';
        return 'Transferencias recibidas';
    }
    if (/oxxo|seven|alsuper|costco|walmart|soriana|chedraui|abarr/i.test(description)) return 'Supermercado';
    if (/restaurant|delipollo|burger|mcdonald|pizza|cafet|cafe |taco|pollo/i.test(description)) return 'Restaurantes';
    if (/gasol|gasolina|pemex|combustible/i.test(description)) return 'Gasolina';
    if (/casetas|autopista/i.test(description)) return 'Casetas';
    if (/uber|didi|cabify/i.test(description)) return 'Transporte';
    if (/netflix|spotify|apple\.com|amazon prime|disney|paddle/i.test(description)) return 'Suscripciones';
    if (/telcel|telmex|totalplay|izzi|megacable|recarga/i.test(description)) return 'Telefonía';
    if (/cfe|luz y fuerza/i.test(description)) return 'Servicios del hogar';
    if (/farmacia|farma|similar|benavides|medica|hospital/i.test(description)) return 'Salud';
    if (/amazon|mercadopago|merpago|paypal|temu/i.test(description)) return 'Compras online';
    if (/qualitas|allianz|seguros|seguro/i.test(description)) return 'Seguros';
    if (/comision|administracion renta|iva cobrado/i.test(description)) return 'Comisiones bancarias';
    if (/retiro cajero|cajero|atm|disp atm/i.test(description)) return 'Retiro efectivo';
    if (/pago interbancario a|transferencia a|pago a/i.test(description)) return 'Transferencias enviadas';
    return 'Otros gastos';
}

function mapToFinanzasFormat(tx, banco) {
    const isIncome = tx.type === 'income' || tx.tipo === 'ingreso' || tx.tipo === 'abono';
    const desc = tx.description ?? tx.descripcion ?? tx.concepto ?? '';
    return {
        fecha: tx.date ?? tx.fecha ?? '',
        concepto: String(desc).trim().slice(0, 150),
        monto: Math.abs(Number(tx.amount ?? tx.monto) || 0),
        tipo: isIncome ? 'ingreso' : 'egreso',
        categoria: categorizeAI(String(desc), isIncome ? 'income' : 'expense'),
        banco: banco ?? 'Desconocido',
    };
}

/**
 * Parse via text extraction (digital PDFs).
 * Calls /api/parse-statement with extracted text.
 * @param {string} rawText
 * @param {boolean} [isCreditCard]
 * @returns {Promise<{banco: string, transactions: Array}>}
 */
export async function parseStatementTextWithAI(rawText, isCreditCard = false) {
    const formData = new FormData();
    formData.append('rawText', rawText);
    formData.append('isCreditCard', String(isCreditCard));

    const response = await fetch('/api/parse-statement', {
        method: 'POST',
        body: formData,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error ?? `Error ${response.status} en /api/parse-statement`);
    }

    const banco = data.data?.banco ?? 'Desconocido';

    // parse-statement returns data.transactions already mapped
    const transactions = (data.transactions ?? []).filter(t => t.monto > 0 && t.fecha);

    return { banco, transactions };
}

/**
 * Parse via Claude Vision (scanned/image PDFs).
 * Calls /api/parse-ai with base64 page images.
 * @param {string[]} pagesBase64
 * @param {string} [mediaType]
 * @returns {Promise<{banco: string, transactions: Array}>}
 */
export async function parseStatementWithAI(pagesBase64, mediaType = 'image/png') {
    const response = await fetch('/api/parse-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: pagesBase64, mediaType }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error ?? `Error ${response.status} en /api/parse-ai`);
    }

    const banco = data.bank ?? data.banco ?? 'Desconocido';
    const transactions = (data.transactions ?? [])
        .map(tx => mapToFinanzasFormat(tx, banco))
        .filter(t => t.monto > 0 && t.fecha);

    return { banco, transactions };
}
