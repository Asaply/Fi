import { clusterRows, isAmount, parseAmount } from '../rows.js';

// Citibanamex (MiCuenta / débito). Multi-line movements: the merchant name is on
// the date row ("23 MAR SORIANA..."), reference/FX detail spans following rows,
// and the peso amount lands on a trailing row. Some deposits ("PAGO RECIBIDO DE
// SU REF.") appear on their OWN row with NO date. Columns via x-coords:
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

// First regex that matches wins; returns the captured number or 0.
function grabNum(text, patterns) {
    for (const re of patterns) {
        const m = text.match(re);
        if (m) return num(m[1]);
    }
    return 0;
}

export function parseBanamexDebito(pages, fullText) {
    const year = Number((fullText.match(/AL\s+\d{1,2}\s+DE\s+[A-Za-zÁÉÍÓÚáéíóú]+\s+DE\s+(20\d{2})/i)
        || fullText.match(/\bdel?\s+.*?(20\d{2})/i)
        || fullText.match(/(20\d{2})/) || [])[1]) || new Date().getFullYear();

    const movimientos = [];
    let pend = null;       // { fecha, concepto } from a date row awaiting its amount
    let lastFecha = null;  // most recent date seen (for no-date deposit rows)

    const conceptOf = (cells) => cells
        .filter(cell => cell.x >= CONCEPT_MIN_X && cell.x < AMOUNT_MIN_X && !isAmount(cell.str))
        .map(cell => cell.str).join(' ').replace(/\s+/g, ' ').trim();

    const emit = (fecha, concepto, cell) => {
        const monto = parseAmount(cell.str).value;
        if (monto <= 0 || !concepto || !fecha) return;
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
                lastFecha = fecha;
                const concepto = conceptOf(c);
                if (amountCell) { emit(fecha, concepto, amountCell); pend = null; }
                else pend = { fecha, concepto };
            } else if (amountCell) {
                if (pend) {
                    // Trailing amount row of a multi-line (FX / detail) movement.
                    emit(pend.fecha, pend.concepto, amountCell);
                    pend = null;
                } else if (amountCell.x >= RET_DEP_SPLIT) {
                    // Standalone DEPOSIT with no date of its own ("PAGO RECIBIDO DE
                    // SU REF."). Attribute it to the most recent date. Restricted to
                    // the deposit band so stray detail lines aren't mis-emitted.
                    const concepto = conceptOf(c) || 'Depósito';
                    emit(lastFecha, concepto, amountCell);
                }
            }
        }
    }

    // Declared totals / saldos — support both the current MiCuenta layout
    // ("(-) 16 Retiros $25,565.96", "SALDO AL 20 DE ABRIL DE 2026 $3,053.94") and
    // older ones ("Retiros/Otros cargos", "Saldo al Corte").
    const total_cargos = grabNum(fullText, [
        /\(-\)\s*\d+\s*Retiros(?:\s*\/\s*Otros cargos)?\s+\$?([\d,]+\.\d{2})/i,
    ]);
    const total_abonos = grabNum(fullText, [
        /\(\+\)\s*\d+\s*Dep[oó]sitos\s+\$?([\d,]+\.\d{2})/i,
    ]);
    const saldo_anterior = grabNum(fullText, [
        /Saldo anterior\s+(?:En pesos M\.N\.\s+)?\$?([\d,]+\.\d{2})/i,
    ]);
    const saldo_final = grabNum(fullText, [
        /SALDO AL\s+\d{1,2}\s+DE\s+[A-Za-zÁÉÍÓÚáéíóú]+\s+DE\s+20\d{2}\s+\$?([\d,]+\.\d{2})/i,
        /Saldo al Corte\s+\$?([\d,]+\.\d{2})/i,
    ]);
    const mPer = fullText.match(/RESUMEN DEL\s+([\d]{1,2}\/[A-Za-z]{3}\/20\d{2}\s+AL\s+[\d]{1,2}\/[A-Za-z]{3}\/20\d{2})/i)
        || fullText.match(/Per[ií]odo\s+(del[^\n]+?20\d{2})/i);

    return {
        banco: 'Citibanamex',
        tipo_cuenta: 'debito',
        periodo: mPer ? mPer[1].trim() : '',
        saldo_anterior,
        saldo_final,
        total_cargos,
        total_abonos,
        num_movimientos: 0,
        movimientos,
    };
}
