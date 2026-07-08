import { clusterRows, isAmount, parseAmount } from '../rows.js';
import { mmmDdToISO, periodYear } from '../dates.js';

// Banco Inbursa (Cuentaefe / débito). Layout verified via x-coordinates:
//   x~14  "MMM DD" date + reference number
//   x~108 concept
//   x~392 CARGO amount      ← egreso
//   x~457 ABONO amount      ← ingreso
//   x>=500 SALDO (running)  ← IGNORE
const CARGO_MIN_X = 360;
const AMOUNT_MAX_X = 500;
const CARGO_ABONO_SPLIT = 430;
const CONCEPT_MIN_X = 90;

function num(str) {
    return Number(String(str).replace(/[^0-9.]/g, '')) || 0;
}

export function parseInbursaDebito(pages, fullText) {
    const yr = (fullText.match(/al\s+\d{1,2}\s+[A-Za-z]{3}\s+(\d{4})/i) || [])[1]
        || String(periodYear(fullText).year);
    const movimientos = [];

    for (const pg of pages) {
        const rows = clusterRows(pg.items, 3);
        for (const row of rows) {
            const first = row.cells[0];
            if (!first || first.x > 40) continue;
            const fecha = mmmDdToISO(first.str, yr);
            if (!fecha) continue;

            const concepto = row.cells
                .filter(c => c.x >= CONCEPT_MIN_X && c.x < CARGO_MIN_X && !isAmount(c.str))
                .map(c => c.str).join(' ').replace(/\s+/g, ' ').replace(/\s*MX$/, '').trim();

            const amountCell = row.cells.find(c => isAmount(c.str) && c.x >= CARGO_MIN_X && c.x < AMOUNT_MAX_X);
            if (!amountCell || !concepto || /BALANCE INICIAL/i.test(concepto)) continue;

            const monto = parseAmount(amountCell.str).value;
            if (monto <= 0) continue;
            const tipo = amountCell.x < CARGO_ABONO_SPLIT ? 'egreso' : 'ingreso';
            movimientos.push({ fecha, concepto, monto, tipo });
        }
    }

    const mAb = fullText.match(/ABONOS\s+([\d,]+\.\d{2})/i);
    const mCa = fullText.match(/CARGOS\s+([\d,]+\.\d{2})/i);
    const mAnt = fullText.match(/SALDO ANTERIOR\s+([\d,]+\.\d{2})/i);
    const mFin = fullText.match(/SALDO ACTUAL\s+([\d,]+\.\d{2})/i);
    const mPer = fullText.match(/PERIODO\s+(Del[^\n]+?\d{4})/i);

    return {
        banco: 'Inbursa',
        tipo_cuenta: 'debito',
        periodo: mPer ? mPer[1].trim() : '',
        saldo_anterior: mAnt ? num(mAnt[1]) : 0,
        saldo_final: mFin ? num(mFin[1]) : 0,
        total_cargos: mCa ? num(mCa[1]) : 0,
        total_abonos: mAb ? num(mAb[1]) : 0,
        num_movimientos: 0,
        movimientos,
    };
}
