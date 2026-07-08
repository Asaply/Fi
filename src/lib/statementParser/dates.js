// Shared date helpers for the deterministic bank parsers.

const MONTHS = {
    ENE: '01', FEB: '02', MAR: '03', ABR: '04', MAY: '05', JUN: '06',
    JUL: '07', AGO: '08', SEP: '09', OCT: '10', NOV: '11', DIC: '12',
};

/** Guess the statement's year(s) from its periodo string, e.g.
 * "DEL 03/03/2026 AL 02/04/2026" → { year: 2026, startMonth: 3 }. */
export function periodYear(fullText) {
    const m = fullText.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4}).*?(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/s);
    if (m) return { year: Number(m[6]), startYear: Number(m[3]), startMonth: Number(m[2]) };
    const y = fullText.match(/\b(20\d{2})\b/);
    return { year: y ? Number(y[1]) : new Date().getFullYear() };
}

/** "05/MAR" or "05 MAR" + a year context → "2026-03-05". Handles Dec→Jan
 * wrap when a statement period straddles the new year. */
export function ddMmmToISO(str, ctx = {}) {
    const m = str.trim().match(/^(\d{1,2})[\/\s]([A-Za-z]{3})/);
    if (!m) return null;
    const day = m[1].padStart(2, '0');
    const mon = MONTHS[m[2].toUpperCase()];
    if (!mon) return null;
    let year = ctx.year || new Date().getFullYear();
    // period like DEL .../12/2025 AL .../01/2026: a January movement belongs to
    // the end year, a December one to the start year.
    if (ctx.startMonth && ctx.startYear && ctx.startYear !== ctx.year) {
        const mn = Number(mon);
        year = mn >= ctx.startMonth ? ctx.startYear : ctx.year;
    }
    return `${year}-${mon}-${day}`;
}

/** "16 FEB" style used by Banamex. */
export const isDdMmm = (s) => /^\d{1,2}[\/\s][A-Za-z]{3}\b/.test(s.trim());

/** "08-abr-2026" (BBVA crédito style) → "2026-04-08". */
export function ddMmmDashToISO(str) {
    const m = str.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})/);
    if (!m) return null;
    const mon = MONTHS[m[2].toUpperCase()];
    if (!mon) return null;
    return `${m[3]}-${mon}-${m[1].padStart(2, '0')}`;
}

/** "MAY 01" (Inbursa style, month first) + a year → "2024-05-01". */
export function mmmDdToISO(str, year) {
    const m = str.trim().match(/^([A-Za-z]{3})\s+(\d{1,2})/);
    if (!m) return null;
    const mon = MONTHS[m[1].toUpperCase()];
    if (!mon) return null;
    return `${year}-${mon}-${m[2].padStart(2, '0')}`;
}

/** "30 MAR 2026" (Nu style) → "2026-03-30". */
export function ddMmmYyyyToISO(str) {
    const m = str.trim().match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
    if (!m) return null;
    const mon = MONTHS[m[2].toUpperCase()];
    if (!mon) return null;
    return `${m[3]}-${mon}-${m[1].padStart(2, '0')}`;
}
