// Batch category suggestions from Claude for movements the rules couldn't place.
// Output is validated against our category list; anything else becomes "Otros".
import { CATEGORIAS_ALL } from '../categorias.js';

export const AI_MODEL = 'claude-haiku-5-5';
export const AI_BATCH_SIZE = 50;

// Collapses whitespace (incl. newlines) and caps length so user text cannot inject extra lines.
function sanear(texto) {
    return String(texto ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

// Account numbers, CLABEs, card numbers, references: no need for the AI to see them.
function enmascarar(texto) {
    return sanear(texto).replace(/\d{6,}/g, '######');
}

export function buildPrompt(items) {
    const lines = items.map((it, i) => `${i + 1}. ${it.type} · $${it.amount} · ${it.merchant ? `${enmascarar(it.merchant)} · ` : ''}${enmascarar(it.concept)}`);
    return [
        'Eres un clasificador de movimientos bancarios de México.',
        'Para cada movimiento elige exactamente una categoría de esta lista:',
        CATEGORIAS_ALL.join(' | '),
        'Si no estás seguro, usa "Otros".',
        `Responde SOLO un arreglo JSON de ${items.length} strings, en el mismo orden.`,
        '',
        ...lines,
    ].join('\n');
}

export function parseCategories(text, n) {
    try {
        const start = text.indexOf('[');
        const end = text.lastIndexOf(']');
        const arr = JSON.parse(text.slice(start, end + 1));
        if (!Array.isArray(arr) || arr.length !== n) return Array(n).fill('Otros');
        return arr.map((c) => (CATEGORIAS_ALL.includes(c) ? c : 'Otros'));
    } catch {
        return Array(n).fill('Otros');
    }
}

export function createAnthropicClassifier({ apiKey, fetchImpl = fetch, model = AI_MODEL } = {}) {
    if (!apiKey) return null;

    async function classifyBatch(batch) {
        const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
            // Thinking off (Haiku 5.5 accepts it at its default effort) and room for 50 answers:
            // a truncated reply would silently turn the whole batch into "Otros".
            body: JSON.stringify({
                model,
                max_tokens: 4096,
                thinking: { type: 'disabled' },
                messages: [{ role: 'user', content: buildPrompt(batch) }],
            }),
            signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) throw new Error(`anthropic ${res.status}`);
        const json = await res.json();
        // max_tokens / refusal / anything but a finished answer: fail so the rows are retried.
        if (json?.stop_reason !== 'end_turn') throw new Error(`anthropic stop_reason ${json?.stop_reason}`);
        const text = (json?.content || []).find((c) => c.type === 'text')?.text ?? '';
        return parseCategories(text, batch.length);
    }

    return async function classify(items) {
        const out = [];
        for (let i = 0; i < items.length; i += AI_BATCH_SIZE) {
            out.push(...await classifyBatch(items.slice(i, i + AI_BATCH_SIZE)));
        }
        return out;
    };
}
