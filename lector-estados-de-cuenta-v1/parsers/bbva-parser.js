import { categorize } from './categories.js';
import { parseBBVATDCStatementSync, mapToFNCETransactions } from './bbva-tdc-parser';

// BBVA — Tarjeta de Crédito TDC / Débito
//
// REAL FORMAT from real statement (pdfjs-dist / pdf-parse):
//   08-abr-2026 09-abr-2026 NETFLIX COM 1 + $329.00
//   13-abr-2026 13-abr-2026 PGO SPEI RECIB/0187338163 - $115,000.00
//   08-abr-2026 09-abr-2026 EBANX 1*TEMU2 ; Tarjeta Digital ***8950 - $1,717.76
//   (continuation lines like "IVA :$0.00 ..." or "USD $X TIPO DE CAMBIO $Y" are skipped)
//
// SIGN: + = cargo/compra (egreso), - = pago OR devolución
//   - PGO SPEI / PAGO SPEI → pago de tarjeta → Transferencia
//   - Other - sign          → devolución/reembolso → ingreso

const MONTH_MAP = {
    ene:'01', feb:'02', mar:'03', abr:'04', may:'05', jun:'06',
    jul:'07', ago:'08', sep:'09', oct:'10', nov:'11', dic:'12',
};

function bbvaDateToISO(d) {
    const p = d.split('-');
    if (p.length !== 3) return d;
    return `${p[2]}-${MONTH_MAP[p[1].toLowerCase()] ?? '01'}-${p[0].padStart(2, '0')}`;
}

function parseAmt(s) {
    return parseFloat((s || '').replace(/[$,\s]/g, '')) || 0;
}

function cleanDesc(s) {
    return s
        .replace(/;\s*Tarjeta Digital\s+\*+\d+/gi, '') // remove "Tarjeta Digital ***8950"
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 150);
}

// Noise/continuation lines to skip (don't match as transactions)
const NOISE_RE = /^(IVA\s*:|Capital\s*:|Pago\s+excedente|Capital\s+de\s+promoci|MXP\s+\$|USD\s+\$|Descripci[oó]n del movimiento|Fecha\s+de\s+la|N[uú]m\.\s+de\s+pago|Tasa\s+de|P[aá]gina\s+\d|N[uú]mero\s+de\s+cuenta)/i;

// Main tx line: "DD-mes-YYYY DD-mes-YYYY DESCRIPTION +/- $AMOUNT"
const TX_RE = /^(\d{2}-[a-záéíóúü]+-\d{4})\s+\d{2}-[a-záéíóúü]+-\d{4}\s+(.+?)\s+([+\-])\s*\$\s*([\d,]+\.\d{2})\s*$/i;

// Payment patterns: SPEI payment to card = Transferencia (not ingreso)
const PAYMENT_RE = /PGO\s+SPEI|PAGO\s+SPEI|TRANSFERENCIA\s+SPEI|ABONO\s+SPEI|PAGO\s+RECIB/i;

export function parseBBVA(text, isCreditCard = false) {
    // Auto-detect TDC from content
    const isTDC = isCreditCard
        || /tarjeta\s+de\s+cr[eé]dito|TDC|tarjeta\s+(oro|azul|platino|cl[aá]sica)/i.test(text);

    // Use the rich TDC parser when credit card detected
    if (isTDC) {
        try {
            const { statement, transactions: tdcTxs } = parseBBVATDCStatementSync(text);
            const mapped = mapToFNCETransactions(tdcTxs, '', statement.numero_tarjeta_ultimos4);
            const transactions = mapped.map(t => ({
                fecha: t.date,
                concepto: t.concept,
                monto: t.amount,
                tipo: t.type === 'income' ? 'ingreso' : t.type === 'Transferencia' ? 'Transferencia' : 'egreso',
                categoria: categorize(t.concept) || t.categoria,
                banco: 'BBVA',
            }));
            const cuenta = statement.numero_tarjeta_ultimos4 ? `****${statement.numero_tarjeta_ultimos4}` : '';
            const periodo = statement.periodo_inicio && statement.periodo_fin
                ? `${statement.periodo_inicio.toISOString().slice(0, 10)} - ${statement.periodo_fin.toISOString().slice(0, 10)}`
                : '';
            if (transactions.length > 0) {
                return { banco: 'BBVA', cuenta, periodo, transactions };
            }
        } catch (_) {
            // Fall through to legacy parser
        }
    }

    const cardMatch = text.match(/N[uú]mero de tarjeta[:\s]+([\d\s*]+)/i);
    const lastFour = (cardMatch?.[1] ?? '').replace(/[\s*]/g, '').slice(-4);
    const accountNumber = lastFour ? `****${lastFour}` : '';

    const periodMatch = text.match(/Periodo[:\s]+([\d\w-]+)\s+al\s+([\d\w-]+)/i);
    const period = periodMatch ? `${periodMatch[1]} - ${periodMatch[2]}` : '';

    // Only parse the REGULAR section (MSI monthly installments already appear here too)
    // Slice from first occurrence of regular section header to avoid duplicates
    const regularStart = text.indexOf('CARGOS,COMPRAS Y ABONOS REGULARES');
    const parseText = regularStart >= 0 ? text.slice(regularStart) : text;

    const transactions = [];
    const seen = new Set();

    for (const line of parseText.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || NOISE_RE.test(trimmed)) continue;

        const m = TX_RE.exec(trimmed);
        if (!m) continue;

        const fecha = bbvaDateToISO(m[1]);
        const description = cleanDesc(m[2]);
        const sign = m[3];
        const monto = parseAmt(m[4]);

        if (monto === 0 || description.length < 2) continue;

        // Dedup (same section header repeats on each page)
        const key = `${fecha}|${description}|${monto}`;
        if (seen.has(key)) continue;
        seen.add(key);

        // + = cargo (egreso)
        // - = pago SPEI → Transferencia | devolución de comercio → ingreso
        let tipo;
        if (sign === '+') {
            tipo = 'egreso';
        } else {
            // TDC: distinguish payment from merchant refund
            tipo = isTDC
                ? (PAYMENT_RE.test(description) ? 'Transferencia' : 'ingreso')
                : 'ingreso';
        }

        transactions.push({
            fecha,
            concepto: description,
            monto,
            tipo,
            categoria: categorize(description, tipo),
            banco: 'BBVA',
        });
    }

    return { banco: 'BBVA', cuenta: accountNumber, periodo: period, transactions };
}
