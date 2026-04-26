import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `Eres un experto en extracción de datos de estados de cuenta bancarios mexicanos.
Tu tarea es extraer transacciones y devolverlas como JSON válido.
Responde SOLO con el JSON, sin explicaciones, sin markdown, sin bloques de código.`;

const USER_PROMPT = `Extrae TODAS las transacciones de este estado de cuenta bancario.

Devuelve ÚNICAMENTE un JSON con este formato exacto:
{
  "bank": "nombre del banco (Banamex/HSBC/BBVA/Santander/Inbursa/Nu/Banorte/Scotiabank/etc)",
  "transactions": [
    {
      "date": "2026-02-16",
      "description": "descripción limpia y concisa",
      "amount": 10000.00,
      "type": "expense"
    }
  ]
}

Reglas:
- type "income": dinero que ENTRA (Depósitos/Abonos/Pagos recibidos)
- type "expense": dinero que SALE (Retiros/Cargos/Compras)
- amount: siempre positivo
- date: YYYY-MM-DD
- description: sin números de referencia largos, sin CLABEs
- NO incluyas Saldo Anterior, totales ni encabezados
- NO incluyas montos $0.00
- BBVA TDC: "+" = cargo (expense), "-" = pago (income)
- Nu: signo negativo = gasto (expense), positivo = ingreso (income)`;

const MAX_IMAGES = 8; // Limit to avoid oversized requests (each page ~1-2MB)

export async function POST(req) {
    try {
        const { images, mediaType = 'image/png' } = await req.json();

        if (!images?.length) {
            return NextResponse.json({ error: 'No images provided' }, { status: 400 });
        }

        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        // Limit pages to avoid exceeding request/token limits
        const pagesToProcess = images.slice(0, MAX_IMAGES);

        const imageContent = pagesToProcess.map(b64 => ({
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: b64 },
        }));

        const response = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 8000,
            system: SYSTEM_PROMPT,
            messages: [{
                role: 'user',
                content: [...imageContent, { type: 'text', text: USER_PROMPT }],
            }],
        });

        const rawText = response.content[0]?.text?.trim() ?? '';

        let parsed;
        try {
            const clean = rawText
                .replace(/^```json\s*/i, '')
                .replace(/^```\s*/i, '')
                .replace(/```\s*$/i, '')
                .trim();
            parsed = JSON.parse(clean);
        } catch {
            return NextResponse.json(
                { error: `Claude devolvió respuesta no parseable: ${rawText.slice(0, 200)}` },
                { status: 422 }
            );
        }

        return NextResponse.json(parsed);

    } catch (err) {
        console.error('[parse-ai]', err?.message ?? err);

        if (err?.status === 401 || err?.message?.includes('API key')) {
            return NextResponse.json(
                { error: 'ANTHROPIC_API_KEY inválida o no configurada. Configúrala en Vercel → Settings → Environment Variables.' },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { error: err.message ?? 'Error interno en parse-ai' },
            { status: 500 }
        );
    }
}
