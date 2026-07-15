import { clusterRows } from '../rows.js';
import { ddMmmDashToISO } from '../dates.js';

// BBVA tarjeta de crédito. The importable movements live in the
// "CARGOS, COMPRAS Y ABONOS REGULARES (NO A MESES)" / "DESGLOSE DE MOVIMIENTOS"
// table. Two BBVA layouts exist:
//   A) date | posting date | description | "+ $329.00" signed amount
//   B) "Fecha de la operación | Fecha de cargo | Descripción | Monto" with the
//      amount as "+ $78.00" / "- $6,535.99" (sign and value can be split cells).
// A movement row starts with an operation date (DD-mmm-YYYY) in the first cell.
// The amount is the RIGHTMOST value carrying an explicit +/- sign, so:
//   - "IVA :$ 0.00 Interes:..." detail lines (no leading date) are skipped,
//   - FX sub-lines ("USD $187.99 TIPO DE CAMBIO $17.47") have no sign → skipped,
//   - the MSI/points tables carry no signed amount → skipped.
// "+" = charge (egreso), "-" = payment (ingreso).
const VALUE = /^([+\-])?\s*\$?([\d,]+\.\d{2})$/; // sign optional (may be a separate cell)

function num(str) {
    return Number(String(str).replace(/[^0-9.]/g, '')) || 0;
}

export function parseBbvaCredito(pages, fullText) {
    const movimientos = [];

    for (const pg of pages) {
        const rows = clusterRows(pg.items, 3);
        for (const row of rows) {
            const cells = [...row.cells].sort((a, b) => a.x - b.x);
            const first = cells[0];
            if (!first || first.x > 60) continue;
            const fecha = ddMmmDashToISO(first.str);
            if (!fecha) continue;

            // Rightmost signed value = the movement amount. Sign may live in this
            // cell ("+ $78.00") or in the immediately preceding cell ("+","$78.00").
            let amtX = null, amtVal = 0, sign = null;
            for (let i = cells.length - 1; i >= 0; i--) {
                const s = cells[i].str.trim();
                const m = s.match(VALUE);
                if (!m) continue;
                sign = m[1];
                if (!sign && i > 0) {
                    const prev = cells[i - 1].str.trim();
                    if (prev === '+' || prev === '-') sign = prev;
                }
                amtX = cells[i].x;
                amtVal = num(m[2]);
                break;
            }
            if (!sign || amtVal <= 0) continue; // require explicit sign → skips FX/detail rows

            // Concept = cells between the first date and the amount, dropping the
            // second date column, sign/amount cells, and the "; Tarjeta Digital"
            // suffix.
            let concepto = cells
                .filter(c => c.x > first.x + 5 && c.x < amtX
                    && !VALUE.test(c.str.trim()) && !/^[+\-]$/.test(c.str.trim())
                    && !ddMmmDashToISO(c.str))
                .map(c => c.str).join(' ').replace(/\s+/g, ' ').trim();
            concepto = concepto.replace(/\s*;.*$/, '').trim();          // drop "; Tarjeta Digital ***0560"
            concepto = concepto.replace(/^\d{1,2}\s+DE\s+\d{1,2}\s+/i, '').trim(); // MSI marker
            if (!concepto) continue;

            // A payment to the card ("PAGO TARJETA DE CREDITO", "SU PAGO") is an
            // abono that reduces the balance — never a charge. Force it to
            // ingreso regardless of how the sign column printed, so it isn't
            // counted as a gasto.
            const esPago = /\bpago\b.*\b(tarjeta|tdc|cuenta)\b|^su pago\b|pago recibido/i.test(concepto);
            const tipo = (esPago || sign === '-') ? 'ingreso' : 'egreso';
            movimientos.push({ fecha, concepto: concepto.slice(0, 80), monto: amtVal, tipo });
        }
    }

    const mCa = fullText.match(/TOTAL CARGOS\s+\$?([\d,]+\.\d{2})/i);
    const mAb = fullText.match(/TOTAL ABONOS\s+-?\$?([\d,]+\.\d{2})/i);
    const mComis = fullText.match(/Monto de comisiones\s+\+?\s*\$?([\d,]+\.\d{2})/i);
    const mPer = fullText.match(/Periodo:\s*([\d]{1,2}-[a-z]{3}-\d{4}\s+al\s+[\d]{1,2}-[a-z]{3}-\d{4})/i);

    // BBVA lists commission charges (e.g. "DISPOSICION CRED.EFEC.CAJERO") as
    // movement rows in the desglose but EXCLUDES them from "TOTAL CARGOS" (they
    // are totaled separately under "Monto de comisiones"). So the movement
    // egresos sum to TOTAL CARGOS + Monto de comisiones. Add the commissions to
    // the reconciliation target. (When there are no commission rows, comisiones
    // is 0 → unchanged, so the other layout still reconciles.)
    const totalCargos = (mCa ? num(mCa[1]) : 0) + (mComis ? num(mComis[1]) : 0);

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
    // Last 4 digits of the card — lets the app tell apart two cards of the same
    // bank (BBVA ·6560 vs BBVA ·1234) instead of merging them into one tab.
    const mCard = flat.match(/N[úu]mero de tarjeta:\s*\d*(\d{4})\b/i)
        || flat.match(/N[úu]mero de cuenta:\s*[X\*\s]*(\d{4})\b/i);
    const cardLast4 = mCard ? mCard[1] : '';
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
        total_cargos: totalCargos,
        total_abonos: mAb ? num(mAb[1]) : 0,
        num_movimientos: 0,
        card_last4: cardLast4,
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
