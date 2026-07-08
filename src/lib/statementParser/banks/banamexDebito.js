import { clusterRows, isAmount, parseAmount } from '../rows.js';

// Citibanamex (MiCuenta / débito). Multi-line movements: the merchant name is on
// the date row ("16 FEB AMAZON..."), reference detail spans following rows, and
// the amount lands on a trailing row. Columns via x-coords:
//   x~25 day + x~42 month
//   x~82 concept / detail
//   x~355 RETIRO   ← egreso
//   x~445 DEPÓSITO ← ingreso
//   x~525 SALDO (running) ← IGNORE
const AMOUNT_MIN_X = 340;
const AMOUNT_MAX_X = 500;
const RET_DEP_SPLIT = 410;
const CONCEPT_MIN_X = 78;

const MONTHS = { ENE: '01', FEB: '02', MAR: '03', ABR: '04', MAY: '05', JUN: '06', JUL: '07', AGO: '08', SEP: '09', OCT: '10', NOV: '11', DIC: '12' };

function num(str) {
    return Number(String(str).replace(/[^0-9.]/g, '')) || 0;
}

export function parseBanamexDebito(pages, fullText) {
    const year = Number((fullText.match(/del\s+(20\d{2})/i) || [])[1]) || new Date().getFullYear();
    const movimientos = [];
    let pend = null; // { fecha, concepto } awaiting its amount row

    const emit = (fecha, concepto, cell) => {
        const monto = parseAmount(cell.str).value;
        if (monto <= 0 || !concepto) return;
        const tipo = cell.x < RET_DEP_SPLIT ? 'egreso' : 'ingreso';
        movimientos.push({ fecha, concepto: concepto.slice(0, 80), monto, tipo });
    };

    for (const pg of pages) {
        const rows = clusterRows(pg.items, 3);
        for (const row of rows) {
            const c = row.cells;
            const amountCell = c.find(cell => isAmount(cell.str) && cell.x >= AMOUNT_MIN_X && cell.x < AMOUNT_MAX_X);
            const dayCell = c[0];
            const isDate = dayCell && dayCell.x < 35 && /^\d{1,2}$/.test(dayCell.str) && c[1] && MONTHS[c[1].str.toUpperCase()];

            if (isDate) {
                const fecha = `${year}-${MONTHS[c[1].str.toUpperCase()]}-${dayCell.str.padStart(2, '0')}`;
                const concepto = c
                    .filter(cell => cell.x >= CONCEPT_MIN_X && cell.x < AMOUNT_MIN_X && !isAmount(cell.str))
                    .map(cell => cell.str).join(' ').replace(/\s+/g, ' ').trim();
                if (amountCell) { emit(fecha, concepto, amountCell); pend = null; }
                else pend = { fecha, concepto };
            } else if (amountCell && pend) {
                emit(pend.fecha, pend.concepto, amountCell);
                pend = null;
            }
        }
    }

    const mCa = fullText.match(/\(-\)\s*\d*\s*Retiros\/Otros cargos\s+([\d,]+\.\d{2})/i);
    const mAb = fullText.match(/\(\+\)\s*\d*\s*Dep[oó]sitos\s+([\d,]+\.\d{2})/i);
    const mAnt = fullText.match(/Saldo anterior\s+(?:En pesos M\.N\.\s+)?([\d,]+\.\d{2})/i);
    const mFin = fullText.match(/Saldo al Corte\s+([\d,]+\.\d{2})/i);
    const mPer = fullText.match(/Per[ií]odo\s+(del[^\n]+?20\d{2})/i);

    return {
        banco: 'Citibanamex',
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
