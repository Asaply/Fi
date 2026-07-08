import { clusterRows, parseAmount } from '../rows.js';
import { ddMmmYyyyToISO } from '../dates.js';

// Nu (cuenta débito). Layout verified via x-coordinates:
//   x~56  date "DD MMM YYYY"
//   x~136 concept + a type word (Compra / Deposito / Transferencia)
//   x~485 signed amount "+$1,300.00" / "-$185.00"  ← sign IS the direction
// No running-balance column, so there is no SALDO trap. Concepts occasionally
// wrap onto the line above the amount, so we buffer concept text and flush it
// when the signed amount row appears.
const AMOUNT_MIN_X = 440;
const CONCEPT_MIN_X = 120;
const SIGNED_AMOUNT = /^[+\-]\$\d/;

function num(str) {
    return Number(String(str).replace(/[^0-9.]/g, '')) || 0;
}

// Nu prints an expandable SPEI detail paragraph under some movements; skip it so
// it doesn't pollute the concept.
const DETAIL_START = /^(Dep[oó]sito SPEI|Transferencia SPEI|Clave de rastreo|Hora:|Al cliente|Del cliente|A la cuenta|De la cuenta|por concepto)/i;

export function parseNuDebito(pages, fullText) {
    const movimientos = [];
    let lastDate = null;
    let prevConcept = '';

    for (const pg of pages) {
        const rows = clusterRows(pg.items, 3);
        for (const row of rows) {
            const cells = row.cells;
            const joined = cells.map(c => c.str).join(' ');
            if (/^FECHA\b/i.test(cells[0]?.str || '') || /MONTO EN PESOS/i.test(joined)) continue;

            const dateCell = cells.find(c => c.x < 110 && /^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}/.test(c.str));
            if (dateCell) lastDate = ddMmmYyyyToISO(dateCell.str);

            const amountCell = cells.find(c => c.x >= AMOUNT_MIN_X && SIGNED_AMOUNT.test(c.str.trim()));

            // concept = short merchant text on this row (drop detail paragraphs)
            let conceptHere = cells
                .filter(c => c.x >= CONCEPT_MIN_X && c.x < AMOUNT_MIN_X && !SIGNED_AMOUNT.test(c.str.trim()))
                .map(c => c.str).join(' ').replace(/\s+/g, ' ').trim();
            if (DETAIL_START.test(conceptHere)) conceptHere = '';
            if (conceptHere && !amountCell) prevConcept = conceptHere;

            if (amountCell && lastDate) {
                const { value, negative } = parseAmount(amountCell.str);
                let concepto = (conceptHere || prevConcept || '').trim();
                concepto = concepto.replace(/\s*(Compra|Dep[oó]sito|Transferencia(?:\s+electr[oó]nica)?)\s*$/i, '').trim() || concepto;
                prevConcept = '';
                // Cajitas are internal savings transfers Nu excludes from its
                // declared Depósitos/Gastos totals — skip to keep sums honest.
                const isCajita = /Cajita/i.test(concepto) || /Cajita/i.test(joined);
                if (value > 0 && !isCajita) {
                    movimientos.push({ fecha: lastDate, concepto, monto: value, tipo: negative ? 'egreso' : 'ingreso' });
                }
            }
        }
    }

    const mDep = fullText.match(/Dep[oó]sitos\s*\+\$([\d,]+\.\d{2})/i);
    const mGas = fullText.match(/Gastos\s*-\$([\d,]+\.\d{2})/i);
    const mIni = fullText.match(/Saldo inicial\s*\$([\d,]+\.\d{2})/i);
    const mFin = fullText.match(/Saldo al generar este estado de cuenta\s*\$([\d,]+\.\d{2})/i);
    const mPer = fullText.match(/Periodo:\s*(del[^\n]+?20\d{2})/i);

    return {
        banco: 'Nu',
        tipo_cuenta: 'debito',
        periodo: mPer ? mPer[1].trim() : '',
        saldo_anterior: mIni ? num(mIni[1]) : 0,
        saldo_final: mFin ? num(mFin[1]) : 0,
        total_cargos: mGas ? num(mGas[1]) : 0,
        total_abonos: mDep ? num(mDep[1]) : 0,
        num_movimientos: 0, // Nu doesn't declare a movement count
        movimientos,
    };
}
