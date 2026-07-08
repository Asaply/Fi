import { clusterRows, isAmount, parseAmount } from '../rows.js';
import { ddMmmToISO, periodYear } from '../dates.js';

// BBVA débito (Libretón / Cuenta Digital). Column layout, verified against real
// statements via x-coordinates:
//   x~15  operation date (DD/MMM)
//   x~59  liquidation date (DD/MMM)
//   x~107 concept
//   x~360-410  CARGO amount (right-aligned)   ← egreso
//   x~410-470  ABONO amount (right-aligned)   ← ingreso
//   x>=475     SALDO columns                  ← IGNORE (the classic trap)
const AMOUNT_MIN_X = 360;
const AMOUNT_MAX_X = 472;   // anything past this is a running balance
const CARGO_ABONO_SPLIT = 410;
const CONCEPT_MIN_X = 100;

function num(str) {
    return Number(String(str).replace(/[^0-9.]/g, '')) || 0;
}

export function parseBbvaDebito(pages, fullText) {
    const ctx = periodYear(fullText);
    const movimientos = [];

    for (const pg of pages) {
        const rows = clusterRows(pg.items, 3);
        for (const row of rows) {
            const first = row.cells[0];
            if (!first || first.x > 40) continue;               // must start at date column
            if (!/^\d{1,2}\/[A-Za-z]{3}/.test(first.str)) continue;
            const fecha = ddMmmToISO(first.str, ctx);
            if (!fecha) continue;

            // concept = text cells between the dates and the money columns
            const concepto = row.cells
                .filter(c => c.x >= CONCEPT_MIN_X && c.x < AMOUNT_MIN_X && !isAmount(c.str))
                .map(c => c.str).join(' ').replace(/\s+/g, ' ').trim();

            // the movement amount is the FIRST money cell inside the amount band;
            // money cells at x >= AMOUNT_MAX_X are SALDO and must be skipped.
            const amountCell = row.cells.find(c => isAmount(c.str) && c.x >= AMOUNT_MIN_X && c.x < AMOUNT_MAX_X);
            if (!amountCell || !concepto) continue;

            const monto = parseAmount(amountCell.str).value;
            if (monto <= 0) continue;
            const tipo = amountCell.x < CARGO_ABONO_SPLIT ? 'egreso' : 'ingreso';
            movimientos.push({ fecha, concepto, monto, tipo });
        }
    }

    // Header totals for reconciliation.
    const mAbonos = fullText.match(/Dep[oó]sitos\s*\/\s*Abonos\s*\(\+\)\s+\d+\s+([\d,]+\.\d{2})/i);
    const mCargos = fullText.match(/Retiros\s*\/\s*Cargos\s*\(-\)\s+\d+\s+([\d,]+\.\d{2})/i);
    const mNAb = fullText.match(/Dep[oó]sitos\s*\/\s*Abonos\s*\(\+\)\s+(\d+)/i);
    const mNCa = fullText.match(/Retiros\s*\/\s*Cargos\s*\(-\)\s+(\d+)/i);
    const mSaldoAnt = fullText.match(/Saldo Anterior\s+([\d,]+\.\d{2})/i);
    const mSaldoFin = fullText.match(/Saldo Final\s+([\d,]+\.\d{2})/i);
    const mPer = fullText.match(/Periodo\s+DEL\s+([\d\/]+\s+AL\s+[\d\/]+)/i);

    const numAb = mNAb ? Number(mNAb[1]) : 0;
    const numCa = mNCa ? Number(mNCa[1]) : 0;

    return {
        banco: 'BBVA',
        tipo_cuenta: 'debito',
        periodo: mPer ? mPer[1] : '',
        saldo_anterior: mSaldoAnt ? num(mSaldoAnt[1]) : 0,
        saldo_final: mSaldoFin ? num(mSaldoFin[1]) : 0,
        total_cargos: mCargos ? num(mCargos[1]) : 0,
        total_abonos: mAbonos ? num(mAbonos[1]) : 0,
        num_movimientos: (numAb + numCa) || movimientos.length,
        movimientos,
    };
}
