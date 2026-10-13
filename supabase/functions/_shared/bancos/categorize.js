// Category for each new bank movement: user's memory → keyword rules → AI batch.
// Rows still in "Otros" keep categoria_origen = null so the next sync retries them.
import { construirMemoriaCategorias, claveComercio, inferirCategoria, CATEGORIAS_ALL } from '../categorias.js';

export function buildMemory(userCategorizedRows) {
    return construirMemoriaCategorias(userCategorizedRows);
}

export async function categorizeRows(rows, { memoria, classify }) {
    const out = rows.map((r) => ({ ...r }));
    const unresolved = [];
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
        unresolved.push(r);
    }
    if (unresolved.length && classify) {
        try {
            const cats = await classify(unresolved.map(({ concept, merchant, amount, type }) => ({ concept, merchant, amount, type })));
            unresolved.forEach((r, i) => {
                const c = cats?.[i];
                if (c && c !== 'Otros' && CATEGORIAS_ALL.includes(c)) {
                    r.categoria = c;
                    r.categoria_origen = 'ia';
                }
            });
        } catch {
            // AI unavailable: rows stay in "Otros" and are retried next sync.
        }
    }
    return out;
}
