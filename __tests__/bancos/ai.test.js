import { describe, it, expect, vi } from 'vitest';
import { createAnthropicClassifier, parseCategories, AI_MODEL } from '../../supabase/functions/_shared/bancos/ai.js';

const okResponse = (text) => ({ ok: true, json: async () => ({ content: [{ type: 'text', text }] }) });

describe('parseCategories', () => {
    it('lee el arreglo JSON aunque venga con texto alrededor', () => {
        expect(parseCategories('Aquí: ["Transporte","Salud"] listo', 2)).toEqual(['Transporte', 'Salud']);
    });
    it('valida contra la lista y rellena a n', () => {
        expect(parseCategories('["Transporte","Inventada"]', 3)).toEqual(['Transporte', 'Otros', 'Otros']);
    });
    it('basura → todo Otros', () => {
        expect(parseCategories('no sé', 2)).toEqual(['Otros', 'Otros']);
    });
});

describe('createAnthropicClassifier', () => {
    it('sin api key → null', () => {
        expect(createAnthropicClassifier({ apiKey: '' })).toBe(null);
    });
    it('llama a la API con el modelo y parte en lotes de 50', async () => {
        const fetchImpl = vi.fn(async (_url, init) => {
            const n = JSON.parse(init.body).messages[0].content.match(/^\d+\./gm).length;
            return okResponse(JSON.stringify(Array(n).fill('Transporte')));
        });
        const classify = createAnthropicClassifier({ apiKey: 'k', fetchImpl });
        const items = Array.from({ length: 51 }, (_, i) => ({ concept: `X${i}`, merchant: null, amount: 1, type: 'Egreso' }));
        const out = await classify(items);
        expect(out).toHaveLength(51);
        expect(fetchImpl).toHaveBeenCalledTimes(2);
        const [url, init] = fetchImpl.mock.calls[0];
        expect(url).toBe('https://api.anthropic.com/v1/messages');
        expect(init.headers['x-api-key']).toBe('k');
        expect(JSON.parse(init.body).model).toBe(AI_MODEL);
        expect(AI_MODEL).toBe('claude-haiku-5-5');
    });
    it('error HTTP → lanza (el pipeline lo atrapa)', async () => {
        const classify = createAnthropicClassifier({ apiKey: 'k', fetchImpl: async () => ({ ok: false, status: 529 }) });
        await expect(classify([{ concept: 'X', amount: 1, type: 'Egreso' }])).rejects.toThrow('529');
    });
});
