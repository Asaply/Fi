// Category for each new bank movement: user's memory → keyword rules → AI batch.
// Rows still in "Otros" keep categoria_origen = null so the next sync retries them.
import { construirMemoriaCategorias, claveComercio, inferirCategoria, CATEGORIAS_EGRESO, CATEGORIAS_INGRESO } from '../categorias.js';
import { TRANSFER_CATEGORY } from './constants.js';

export function buildMemory(userCategorizedRows) {
    return construirMemoriaCategorias(userCategorizedRows);
}

// Memory → rules, no network. Returns copies; rows still in "Otros" keep
// categoria_origen = null (candidates for the AI, retried every sync).
export function categorizeLocally(rows, { memoria }) {
    const out = rows.map((r) => ({ ...r }));
    for (const r of out) {
        const fromMemory = memoria?.size ? memoria.get(claveComercio(r.concept)) : null;
        if (fromMemory) {
            r.categoria = fromMemory;
            r.categoria_origen = 'memoria';
            continue;
        }
        const fromRules = inferirCategoria(r.concept, r.type);
        if (fromRules && fromRules !== 'Otros') {
            r.categoria = fromRules;
            r.categoria_origen = 'regla';
            continue;
        }
        r.categoria = 'Otros';
        r.categoria_origen = null;
    }
    return out;
}

// Asks the AI about `rows` (all unresolved) and updates them in place with the
// valid answers. Returns the rows that got a category. Throws if `classify` throws.
export async function applyAiCategories(rows, classify) {
    const cats = await classify(rows.map(({ concept, merchant, amount, type }) => ({ concept, merchant, amount, type })));
    const resolved = [];
    rows.forEach((r, i) => {
        const c = cats?.[i];
        const permitidas = r.type === 'Ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO;
        if (c && c !== 'Otros' && c !== TRANSFER_CATEGORY && permitidas.includes(c)) {
            r.categoria = c;
            r.categoria_origen = 'ia';
            resolved.push(r);
        }
    });
    return resolved;
}

export async function categorizeRows(rows, { memoria, classify }) {
    const out = categorizeLocally(rows, { memoria });
    const unresolved = out.filter((r) => !r.categoria_origen);
    if (unresolved.length && classify) {
        try {
            await applyAiCategories(unresolved, classify);
        } catch {
            // AI unavailable: rows stay in "Otros" and are retried next sync.
        }
    }
    return out;
}
