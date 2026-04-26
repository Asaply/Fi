/**
 * AI-powered bank statement parser.
 * Sends PDF page images to Claude Vision via /api/parse-ai (server-side proxy).
 * Returns transactions in the finanzas page format: {fecha, concepto, monto, tipo, categoria}.
 */

function categorizeAI(description, type) {
    if (type === 'income') {
        if (/nomina|nómina|sueldo|salario/i.test(description)) return 'Salario';
        if (/intereses/i.test(description)) return 'Intereses';
        if (/deposito canales/i.test(description)) return 'Depósito';
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

/**
 * Parse a bank statement using Claude Vision.
 * @param {string[]} pagesBase64 - Array of base64 PNG images (one per page)
 * @param {string} [mediaType]
 * @returns {Promise<{banco: string, transactions: Array}>}
 */
export async function parseStatementWithAI(pagesBase64, mediaType = 'image/png') {
    const response = await fetch('/api/parse-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: pagesBase64, mediaType }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(err.error ?? `Error ${response.status}`);
    }

    const parsed = await response.json();

    const transactions = (parsed.transactions ?? [])
        .map(tx => ({
            fecha: tx.date ?? '',
            concepto: String(tx.description ?? '').trim().slice(0, 150),
            monto: Math.abs(Number(tx.amount) || 0),
            tipo: tx.type === 'income' ? 'ingreso' : 'egreso',
            categoria: categorizeAI(String(tx.description ?? ''), tx.type),
            banco: parsed.bank ?? 'Desconocido',
        }))
        .filter(tx => tx.monto > 0 && tx.fecha);

    return {
        banco: parsed.bank ?? 'Desconocido',
        transactions,
    };
}
