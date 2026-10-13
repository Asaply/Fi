// Pair an outflow in one of the user's accounts with an inflow of the same
// amount in another of their accounts (e.g. paying the credit card from debit).
// Prefer missing a pair over linking the wrong one: any ambiguity → no link.
import { TRANSFER_WINDOW_DAYS } from './constants.js';

const HINT = /\b(pago|spei|traspaso|transf|tdc)/i;
const DAY_MS = 86400000;

const sameAmount = (a, b) => Math.abs(Number(a) - Number(b)) < 0.005;
const withinWindow = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) / DAY_MS <= TRANSFER_WINDOW_DAYS;

function matches(o, i) {
    return o.bank_account_id && i.bank_account_id && o.bank_account_id !== i.bank_account_id
        && sameAmount(o.amount, i.amount)
        && withinWindow(o.date, i.date)
        && (HINT.test(o.concept || '') || HINT.test(i.concept || ''));
}

export function findOwnTransferPairs(rows) {
    const free = rows.filter((r) => !r.transfer_group_id);
    const outs = free.filter((r) => r.type === 'Egreso');
    const ins = free.filter((r) => r.type === 'Ingreso' || r.type === 'Transferencia');
    const pairs = [];
    const used = new Set();
    for (const o of outs) {
        const candidates = ins.filter((i) => !used.has(i.key) && matches(o, i));
        if (candidates.length !== 1) continue;
        const [i] = candidates;
        const rivals = outs.filter((o2) => o2 !== o && matches(o2, i));
        if (rivals.length) continue;
        used.add(i.key);
        pairs.push([o.key, i.key]);
    }
    return pairs;
}
