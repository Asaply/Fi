import { clusterRows, isAmount, parseAmount } from '../rows.js';

// Scotiabank (Scotia Nómina). One row per movement, verified via x-coords:
//   x~53 day + x~64 month ("20" "MAY")
//   x~92..250 concept (word cells)
//   x~252 origen/reference (long digit string, no decimals → not an amount)
//   x~400 DEPÓSITO  ← ingreso
//   x~475 RETIRO    ← egreso
//   x~548 SALDO (running) ← IGNORE
const AMOUNT_MIN_X = 380;
const AMOUNT_MAX_X = 540;
const DEP_RET_SPLIT = 440;
const CONCEPT_MIN_X = 88;
const CONCEPT_MAX_X = 250;

const MONTHS = { ENE: '01', FEB: '02', MAR: '03', ABR: '04', MAY: '05', JUN: '06', JUL: '07', AGO: '08', SEP: '09', OCT: '10', NOV: '11', DIC: '12' };

function num(str) {
    return Number(String(str).replace(/[^0-9.]/g, '')) || 0;
}

export function parseScotiaDebito(pages, fullText) {
    // period "20-MAY-25/18-JUN-25" → end year
    const my = fullText.match(/(\d{1,2})-[A-Za-z]{3}-(\d{2})\/(\d{1,2})-[A-Za-z]{3}-(\d{2})/);
    const year = my ? 2000 + Number(my[4]) : new Date().getFullYear();
    const movimientos = [];

    for (const pg of pages) {
        const rows = clusterRows(pg.items, 3);
        for (const row of rows) {
            const c = row.cells;
            const day = c[0];
            if (!day || day.x > 60 || !/^\d{1,2}$/.test(day.str)) continue;
            const mon = c[1] && MONTHS[c[1].str.toUpperCase()];
            if (!mon) continue;
            const fecha = `${year}-${mon}-${day.str.padStart(2, '0')}`;

            const amountCell = c.find(cell => isAmount(cell.str) && cell.x >= AMOUNT_MIN_X && cell.x < AMOUNT_MAX_X);
            if (!amountCell) continue;

            const concepto = c
                .filter(cell => cell.x >= CONCEPT_MIN_X && cell.x < CONCEPT_MAX_X && !isAmount(cell.str))
                .map(cell => cell.str).join(' ').replace(/\s+/g, ' ').trim();
            if (!concepto) continue;

            const monto = parseAmount(amountCell.str).value;
            if (monto <= 0) continue;
            const tipo = amountCell.x < DEP_RET_SPLIT ? 'ingreso' : 'egreso';
            movimientos.push({ fecha, concepto, monto, tipo });
        }
    }

    // Scotiabank renders header glyphs spaced out ("D e p ó s i t os"), so match
    // against a whitespace-collapsed copy.
    const flat = fullText.replace(/\s+/g, '');
    const mDep = flat.match(/Dep[oó]sitos\$([\d,]+\.\d{2})/i);
    const mRet = flat.match(/Retiros\$([\d,]+\.\d{2})/i);
    const mIni = flat.match(/Saldoinicial\$([\d,]+\.\d{2})/i);
    const mFin = flat.match(/Saldofinaldelacuenta\$([\d,]+\.\d{2})/i);
    const mPer = fullText.match(/Periodo\s+([\d]{1,2}-[A-Za-z]{3}-\d{2}\/[\d]{1,2}-[A-Za-z]{3}-\d{2})/i);

    return {
        banco: 'Scotiabank',
        tipo_cuenta: 'debito',
        periodo: mPer ? mPer[1] : '',
        saldo_anterior: mIni ? num(mIni[1]) : 0,
        saldo_final: mFin ? num(mFin[1]) : 0,
        total_cargos: mRet ? num(mRet[1]) : 0,
        total_abonos: mDep ? num(mDep[1]) : 0,
        num_movimientos: 0,
        movimientos,
    };
}
