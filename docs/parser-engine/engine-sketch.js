// Parser Engine v2 — SKETCH (pseudocódigo, propuesta). No es código de producción.
// Un solo motor interpreta cualquier layout.json. Reusa los helpers deterministas
// que ya existen: extractItems, clusterRows, parseAmount, y los parsers de fecha.

import { extractItems } from '../../src/lib/statementParser/extractItems.js';
import { clusterRows, isAmount, parseAmount } from '../../src/lib/statementParser/rows.js';
// import { parseDate } from './dateFormats.js'  // mapea date.format -> ISO

const num = (s) => Number(String(s).replace(/[^0-9.]/g, '')) || 0;
const rightEdge = (cell) => (cell.w ? cell.x + cell.w : cell.x); // borde derecho estable

// ── Dispatcher por estrategia ────────────────────────────────────────────────
const STRATEGIES = {
    columnBands: runColumnBands,
    signedSingleColumn: runSignedSingleColumn,
    multilineBuffer: runMultilineBuffer,
};

export async function runLayout(buffer, layout) {
    const { fullText, pages } = await extractItems(buffer);
    const ctx = { year: resolveYear(fullText, layout) };
    const movimientos = STRATEGIES[layout.strategy](pages, layout, ctx);
    const totals = readTotals(fullText, layout);
    return { ...meta(layout, totals), movimientos, _engine: 'v2', _layout: layout.id };
}

// ── Estrategia: bandas de columna ────────────────────────────────────────────
function runColumnBands(pages, layout, ctx) {
    const out = [];
    for (const pg of pages) {
        for (const row of clusterRows(pg.items, 3)) {
            const first = row.cells[0];
            if (!first || first.x > layout.date.colXMax) continue;
            const fecha = parseRowDate(row, layout, ctx);
            if (!fecha) continue;

            const concepto = readConcept(row, layout);
            if (!concepto || matchesAny(concepto, layout.skipRows)) continue;

            const cell = pickBandCell(row.cells, layout.amount);   // ignora SALDO por posición
            if (!cell) continue;
            const monto = parseAmount(cell.str).value;
            if (monto <= 0) continue;
            out.push({ fecha, concepto, monto, tipo: bandTipo(cell, layout.amount) });
        }
    }
    return out;
}

// ── Estrategia: columna única con signo ──────────────────────────────────────
function runSignedSingleColumn(pages, layout, ctx) {
    const a = layout.amount, out = [];
    let lastDate = null, prevConcept = '';
    const skipDetail = a.skipDetailRegex ? new RegExp(a.skipDetailRegex, 'i') : null;
    const inSkipSection = sectionSkipper(layout.skipSections);

    for (const pg of pages) {
        for (const row of clusterRows(pg.items, 3)) {
            const joined = row.cells.map(c => c.str).join(' ');
            if (inSkipSection(joined)) continue;

            const d = firstDateCell(row, layout);
            if (d) lastDate = parseDateStr(d.str, layout, ctx);

            let concept = readConcept(row, layout);
            if (skipDetail && skipDetail.test(concept)) concept = '';
            const amountCell = row.cells.find(c => c.x >= a.colXMin && new RegExp(a.signedRegex).test(c.str.trim()));

            if (concept && !amountCell && layout.concept.source === 'lookback') prevConcept = concept;

            if (amountCell && lastDate) {
                let concepto = (concept || prevConcept || '').trim();
                if (a.stripTypeWordRegex)  concepto = concepto.replace(new RegExp(a.stripTypeWordRegex, 'i'), '').trim();
                if (a.stripInstallmentMarkerRegex) concepto = concepto.replace(new RegExp(a.stripInstallmentMarkerRegex, 'i'), '').trim();
                prevConcept = '';
                if (matchesAny(concepto, a.exclude) || matchesAny(joined, a.exclude)) continue;
                const negative = amountCell.str.trim().startsWith('-');
                const monto = num(amountCell.str);
                if (monto > 0 && concepto)
                    out.push({ fecha: lastDate, concepto, monto, tipo: negative ? a.negativeTipo : a.positiveTipo });
            }
        }
    }
    return out;
}

// ── Estrategia: buffer multilínea (monto en fila trailing) ───────────────────
function runMultilineBuffer(pages, layout, ctx) {
    const out = [];
    let pend = null;
    const emit = (fecha, concepto, cell) => {
        const monto = parseAmount(cell.str).value;
        if (monto > 0 && concepto)
            out.push({ fecha, concepto: concepto.slice(0, 80), monto, tipo: bandTipo(cell, layout.amount) });
    };
    for (const pg of pages) {
        for (const row of clusterRows(pg.items, 3)) {
            const cell = pickBandCell(row.cells, layout.amount);
            const d = firstDateCell(row, layout);
            if (d) {
                const fecha = parseDateStr(d.str, layout, ctx, row);
                const concepto = readConcept(row, layout);
                if (cell) { emit(fecha, concepto, cell); pend = null; }
                else pend = { fecha, concepto };
            } else if (cell && pend) {
                emit(pend.fecha, pend.concepto, cell);
                pend = null;
            }
        }
    }
    return out;
}

// ── Helpers de banda (borde derecho = estable) ───────────────────────────────
function pickBandCell(cells, amount) {
    return cells.find(c => {
        if (!isAmount(c.str)) return false;
        const pos = amount.edge === 'right' ? rightEdge(c) : c.x;
        if (pos >= amount.ignoreBeyondX) return false;            // SALDO → fuera
        return amount.bands.some(b => pos >= b.xMin && pos < b.xMax);
    });
}
function bandTipo(cell, amount) {
    const pos = amount.edge === 'right' ? rightEdge(cell) : cell.x;
    return amount.bands.find(b => pos >= b.xMin && pos < b.xMax)?.tipo || 'egreso';
}

// readConcept / readTotals / parseRowDate / resolveYear / matchesAny /
// sectionSkipper / meta  → wrappers finos sobre lo que ya hace cada parser hoy.
