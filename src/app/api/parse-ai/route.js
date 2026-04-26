import { NextResponse } from 'next/server';

const SYSTEM_PROMPT = `Eres un experto en extracción de datos de estados de cuenta bancarios mexicanos.
Tu tarea es extraer transacciones y devolverlas como JSON válido.
Responde SOLO con el JSON, sin explicaciones, sin markdown, sin bloques de código.`;

const USER_PROMPT = `Extrae TODAS las transacciones de este estado de cuenta bancario.

Devuelve ÚNICAMENTE un JSON con este formato:
{
  "bank": "nombre del banco (Banamex/HSBC/BBVA/Santander/Inbursa/etc)",
  "transactions": [
    {
      "date": "2026-02-16",
      "description": "descripción limpia y concisa de la transacción",
      "amount": 10000.00,
      "type": "expense"
    }
  ]
}

Reglas estrictas:
- type "income": dinero que ENTRA a la cuenta (columna Depósitos/Abonos, pagos recibidos)
- type "expense": dinero que SALE de la cuenta (columna Retiros/Cargos, pagos realizados)
- amount: siempre número positivo, nunca negativo
- date: formato YYYY-MM-DD
- description: texto descriptivo limpio (sin números de referencia largos, sin CLABEs)
- Incluye TODAS las transacciones de TODAS las páginas
- NO incluyas el "Saldo Anterior" como transacción
- NO incluyas comisiones exentas (monto $0.00)
- Para BBVA tarjeta de crédito: "+" = cargo (expense), "-" = pago (income)`;

export async function POST(req) {
    try {
        const { images, mediaType = 'image/png' } = await req.json();

        if (!images?.length) {
            return NextResponse.json({ error: 'No images provided' }, { status: 400 });
        }

        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
        }

        const imageContent = images.map(b64 => ({
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: b64 },
        }));

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-6',
                max_tokens: 8000,
                system: SYSTEM_PROMPT,
                messages: [{
                    role: 'user',
                    content: [...imageContent, { type: 'text', text: USER_PROMPT }],
                }],
            }),
        });

        if (!response.ok) {
            const err = await response.text();
            return NextResponse.json(
                { error: `Claude API error ${response.status}: ${err}` },
                { status: 502 }
            );
        }

        const data = await response.json();
        const rawText = data.content?.[0]?.text ?? '';

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
                { error: `No se pudo parsear la respuesta de Claude: ${rawText.slice(0, 300)}` },
                { status: 422 }
            );
        }

        return NextResponse.json(parsed);

    } catch (err) {
        console.error('[parse-ai]', err);
        return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 });
    }
}
