import { clusterRows } from '../rows.js';
import { ddMmmDashToISO } from '../dates.js';

// BBVA tarjeta de crédito. The importable movements live in the
// "CARGOS, COMPRAS Y ABONOS REGULARES (NO A MESES)" table. Layout via x-coords:
//   x~35  operation date (DD-mmm-YYYY)
//   x~122 posting date
//   x~203 description
//   x~516 signed amount "+ $329.00" (charge=egreso) / "- $115,000.00" (payment=ingreso)
// The "COMPRAS Y CARGOS DIFERIDOS A MESES" schedule and the points tables have
// no signed amount in this column, so they are naturally skipped. Foreign-currency
// sub-lines ("USD $13.99 TIPO DE CAMBIO ...") carry no +/- prefix → skipped too.
const SIGNED_AMOUNT = /^[+\-]\s*\$[\d,]+\.\d{2}$/;
const AMOUNT_MIN_X = 470;
const CONCEPT_MIN_X = 180;

function num(str) {
    return Number(String(str).replace(/[^0-9.]/g, '')) || 0;
}

export function parseBbvaCredito(pages, fullText) {
    const movimientos = [];

    for (const pg of pages) {
        const rows = clusterRows(pg.items, 3);
        for (const row of rows) {
            const first = row.cells[0];
            if (!first || first.x > 55) continue;
            const fecha = ddMmmDashToISO(first.str);
            if (!fecha) continue;

            const amountCell = row.cells.find(c => c.x >= AMOUNT_MIN_X && SIGNED_AMOUNT.test(c.str.trim()));
            if (!amountCell) continue;

            let concepto = row.cells
                .filter(c => c.x >= CONCEPT_MIN_X && c.x < AMOUNT_MIN_X && !SIGNED_AMOUNT.test(c.str.trim()))
                .map(c => c.str).join(' ').replace(/\s+/g, ' ').trim();
            // drop MSI installment markers like "04 DE 06 " / "12 DE 12 "
            concepto = concepto.replace(/^\d{1,2}\s+DE\s+\d{1,2}\s+/i, '').trim();
            if (!concepto) continue;

            const negative = amountCell.str.trim().startsWith('-');
            const monto = num(amountCell.str);
            if (monto <= 0) continue;
            // On a credit card a "+" is a charge (egreso) and a "-" is a payment (ingreso).
            movimientos.push({ fecha, concepto, monto, tipo: negative ? 'ingreso' : 'egreso' });
        }
    }

    const mCa = fullText.match(/TOTAL CARGOS\s+\$?([\d,]+\.\d{2})/i);
    const mAb = fullText.match(/TOTAL ABONOS\s+-?\$?([\d,]+\.\d{2})/i);
    const mPer = fullText.match(/Periodo:\s*([\d]{1,2}-[a-z]{3}-\d{4}\s+al\s+[\d]{1,2}-[a-z]{3}-\d{4})/i);

    // Statement header fields (collapse whitespace: glyphs can be spaced out).
    const flat = fullText.replace(/\s+/g, ' ');
    const grab = (re) => { const m = flat.match(re); return m ? num(m[1]) : 0; };
    const limiteCredito     = grab(/L[íi]mite de cr[ée]dito:\s*\$?([\d,]+\.\d{2})/i);
    const creditoDisponible = grab(/Cr[ée]dito disponible:\s*\$?([\d,]+\.\d{2})/i);
    const pagoSinIntereses  = grab(/Pago para no generar intereses:\s*\d*\s*\$?([\d,]+\.\d{2})/i);
    const pagoMinimo        = grab(/Pago m[íi]nimo:\s*\d*\s*\$?([\d,]+\.\d{2})/i);
    const cat               = grab(/CAT[^\d]*([\d]+\.\d{1,2})\s*%/i);
    const mCorte = flat.match(/Fecha de corte:\s*(\d{1,2})-[a-z]{3}-\d{4}/i);
    const mPago  = flat.match(/l[íi]mite de pago:[^\n]*?(\d{1,2})-[a-z]{3}-\d{4}/i);
    // On a credit card the real debt at cutoff = credit line − available credit.
    const saldoAlCorte = (limiteCredito > 0 && creditoDisponible > 0)
        ? Math.round((limiteCredito - creditoDisponible) * 100) / 100
        : 0;

    return {
        banco: 'BBVA',
        tipo_cuenta: 'credito',
        periodo: mPer ? mPer[1].trim() : '',
        // Keep saldos at 0: revolving cards don't satisfy the balance identity
        // (saldoAnt + abonos − cargos == saldoFin), so setting them would break
        // reconciliation. The real debt is carried in credito_info.saldo_al_corte.
        saldo_anterior: 0,
        saldo_final: 0,
        total_cargos: mCa ? num(mCa[1]) : 0,
        total_abonos: mAb ? num(mAb[1]) : 0,
        num_movimientos: 0,
        credito_info: {
            limite_credito: limiteCredito,
            credito_disponible: creditoDisponible,
            saldo_al_corte: saldoAlCorte,
            pago_sin_intereses: pagoSinIntereses,
            pago_minimo: pagoMinimo,
            dia_corte: mCorte ? Number(mCorte[1]) : 0,
            dia_pago: mPago ? Number(mPago[1]) : 0,
            cat,
        },
        movimientos,
    };
}
