import { describe, it, expect, vi } from 'vitest';
import { createAnthropicClassifier, parseCategories, buildPrompt, AI_MODEL } from '../../supabase/functions/_shared/bancos/ai.js';

const okResponse = (text, stop_reason = 'end_turn') => ({ ok: true, json: async () => ({ stop_reason, content: [{ type: 'text', text }] }) });

describe('parseCategories', () => {
    it('lee el arreglo JSON aunque venga con texto alrededor', () => {
        expect(parseCategories('Aquí: ["Transporte","Salud"] listo', 2)).toEqual(['Transporte', 'Salud']);
    });
    it('valida contra la lista; longitud distinta de n → todo Otros', () => {
        expect(parseCategories('["Transporte","Inventada"]', 3)).toEqual(['Otros', 'Otros', 'Otros']);
        expect(parseCategories('["Transporte","Inventada"]', 2)).toEqual(['Transporte', 'Otros']);
        expect(parseCategories('["Transporte"]', 2)).toEqual(['Otros', 'Otros']);
        expect(parseCategories('["Transporte","Salud","Otros"]', 2)).toEqual(['Otros', 'Otros']);
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
    it('la petición lleva signal de timeout', async () => {
        const fetchImpl = vi.fn(async () => okResponse('["Salud"]'));
        const classify = createAnthropicClassifier({ apiKey: 'k', fetchImpl });
        await classify([{ concept: 'X', amount: 1, type: 'Egreso' }]);
        expect(fetchImpl.mock.calls[0][1].signal).toBeDefined();
    });
    it('pide max_tokens 4096 y sin thinking', async () => {
        const fetchImpl = vi.fn(async () => okResponse('["Salud"]'));
        await createAnthropicClassifier({ apiKey: 'k', fetchImpl })([{ concept: 'X', amount: 1, type: 'Egreso' }]);
        const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
        expect(body.max_tokens).toBe(4096);
        expect(body.thinking).toEqual({ type: 'disabled' });
    });
    it('una respuesta que no terminó en end_turn lanza en vez de devolver Otros', async () => {
        for (const reason of ['max_tokens', 'refusal', null]) {
            const classify = createAnthropicClassifier({ apiKey: 'k', fetchImpl: async () => okResponse('["Salud"', reason) });
            await expect(classify([{ concept: 'X', amount: 1, type: 'Egreso' }])).rejects.toThrow('stop_reason');
        }
    });
    it('error HTTP → lanza (el pipeline lo atrapa)', async () => {
        const classify = createAnthropicClassifier({ apiKey: 'k', fetchImpl: async () => ({ ok: false, status: 529 }) });
        await expect(classify([{ concept: 'X', amount: 1, type: 'Egreso' }])).rejects.toThrow('529');
    });
});

describe('buildPrompt', () => {
    it('un concepto con saltos de línea no crea líneas numeradas extra', () => {
        const items = [{ concept: 'PAGO\n2. fake', merchant: null, amount: 1, type: 'Egreso' }, { concept: 'B', merchant: null, amount: 1, type: 'Egreso' }];
        const numbered = buildPrompt(items).split('\n').filter((l) => /^\d+\./.test(l));
        expect(numbered).toHaveLength(2);
    });
    it('trunca concepto y comercio a 120 caracteres', () => {
        const long = 'A'.repeat(500);
        const prompt = buildPrompt([{ concept: long, merchant: long, amount: 1, type: 'Egreso' }]);
        expect(prompt).toContain('A'.repeat(120));
        expect(prompt).not.toContain('A'.repeat(121));
    });
});
