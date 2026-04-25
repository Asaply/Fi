import { inferirCategoria } from '../categorias';

// HSBC Nómina Flexible
// Formato: DÍA  DESCRIPCIÓN  REF  RETIRO/CARGO  DEPÓSITO/ABONO  SALDO
// Periodo: "01/08/2025 al 31/08/2025"
// Cuenta:  "NÚMERO DE CUENTA  6622023477"

function parseAmount(str) {
    if (!str) return 0;
    return parseFloat(str.replace(/,/g, '')) || 0;
}

export function parseHSBC(text) {
    const accountMatch = text.match(/N[ÚU]MERO DE CUENTA\s+(\d+)/i);
    const accountNumber = accountMatch?.[1] ?? '';

    const periodMatch = text.match(/(\d{2}\/\d{2}\/\d{4})\s+al\s+(\d{2}\/\d{2}\/\d{4})/);
    const period = periodMatch ? `${periodMatch[1]} - ${periodMatch[2]}` : '';
    const year = periodMatch?.[2]?.split('/')?.[2] ?? String(new Date().getFullYear());
    const month = periodMatch?.[1]?.split('/')?.[1] ?? '';

    const detailStart = text.indexOf('DETALLE MOVIMIENTOS');
    const detailText = detailStart >= 0 ? text.slice(detailStart) : text;

    const transactions = [];

    // Primary: día + desc + dos columnas numéricas
    const txRegex = /^(\d{2})\s+(.{10,80}?)\s{2,}([\d,]+\.\d{2})\s+([\d,]+\.\d{2})/gm;
    let match;
    while ((match = txRegex.exec(detailText)) !== null) {
        const day = match[1].padStart(2, '0');
        const description = match[2].trim().replace(/\s+/g, ' ');
        const col3 = parseAmount(match[3]);
        const isCharge = /TRANSFERENCIA|RETIRO|COMISION|IVA|APPLE|PADDLE|OXXO|TELCEL|PAYPAL|PAGO\s/i.test(description);
        const monto = col3;
        const tipo = isCharge ? 'egreso' : 'ingreso';

        transactions.push({
            fecha: `${year}-${month}-${day}`,
            concepto: description.slice(0, 100),
            monto: Math.abs(monto),
            tipo,
            categoria: inferirCategoria(description),
            banco: 'HSBC',
        });
    }

    // Fallback: línea por línea
    if (transactions.length === 0) {
        for (const line of detailText.split('\n')) {
            const trimmed = line.trim();
            const dayMatch = trimmed.match(/^(\d{2})\s+(.+)/);
            if (!dayMatch) continue;
            const day = dayMatch[1];
            if (parseInt(day) < 1 || parseInt(day) > 31) continue;
            const rest = dayMatch[2];
            const amounts = rest.match(/\$\s*([\d,]+\.\d{2})/g);
            if (!amounts || amounts.length < 1) continue;
            const description = rest.replace(/\$[\s\d,.]+/g, '').trim().slice(0, 100);
            const firstAmount = parseAmount(amounts[0].replace('$', '').trim());
            const isDeposit = /TRANSFERENCIA BPI|DEPOSITO|ABONO/i.test(rest) && amounts.length === 1;
            transactions.push({
                fecha: `${year}-${month}-${day}`,
                concepto: description,
                monto: Math.abs(firstAmount),
                tipo: isDeposit ? 'ingreso' : 'egreso',
                categoria: inferirCategoria(description),
                banco: 'HSBC',
            });
        }
    }

    return { banco: 'HSBC', cuenta: accountNumber, periodo: period, transactions };
}
