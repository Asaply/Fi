// Group page text items into visual rows by their y coordinate (baseline),
// tolerating the small vertical jitter pdfjs reports for glyphs that belong to
// the same printed line. Rows come back ordered top-to-bottom; within each row
// the cells are ordered left-to-right and keep their x so a parser can map
// them to columns.

/**
 * @param {Array<{x:number,y:number,w:number,str:string}>} items
 * @param {number} yTol  vertical tolerance in px to treat items as same row
 * @returns {Array<{y:number, cells:Array<{x:number,w:number,str:string}>}>}
 */
export function clusterRows(items, yTol = 3) {
    const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
    const rows = [];
    for (const it of sorted) {
        const row = rows.find(r => Math.abs(r.y - it.y) <= yTol);
        if (row) {
            row.cells.push({ x: it.x, w: it.w, str: it.str });
            // keep the row anchored near its first (topmost) baseline
            row.y = (row.y * (row.cells.length - 1) + it.y) / row.cells.length;
        } else {
            rows.push({ y: it.y, cells: [{ x: it.x, w: it.w, str: it.str }] });
        }
    }
    rows.sort((a, b) => b.y - a.y);
    for (const r of rows) r.cells.sort((a, b) => a.x - b.x);
    return rows;
}

const AMOUNT_RE = /^\$?-?\(?\d{1,3}(?:,\d{3})*(?:\.\d{2})\)?$/;

/** True if a cell string is a money amount (e.g. "1,234.56", "$99.00", "-50.00"). */
export function isAmount(str) {
    return AMOUNT_RE.test(str.trim());
}

/** Parse a money string to a positive number (sign/parens stripped). */
export function parseAmount(str) {
    const neg = /^-|\(.*\)$/.test(str.trim());
    const n = Number(str.replace(/[^0-9.]/g, ''));
    return { value: Number.isFinite(n) ? n : 0, negative: neg };
}

/** Concatenate the non-amount cells of a row into a concept string. */
export function rowText(row) {
    return row.cells.map(c => c.str).join(' ').replace(/\s+/g, ' ').trim();
}
