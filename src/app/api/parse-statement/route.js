import { NextResponse } from 'next/server';

export const runtime = 'nodejs'; // Fix para Vercel (evita fallos de dependencias nativas de pdf-parse)

const getParserPrompt = (isCreditCard) => `Eres un parser de estados de cuenta bancarios mexicanos.
Extrae TODOS los movimientos del siguiente texto de estado de cuenta.

Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin backticks, sin markdown:
{
  "banco": "nombre del banco",
  "periodo": { "inicio": "YYYY-MM-DD", "fin": "YYYY-MM-DD" },
  "cuenta": "últimos 4 dígitos",
  "tipo_cuenta": "${isCreditCard ? 'credito' : 'debito'}",
  "movimientos": [
    {
      "fecha": "YYYY-MM-DD",
      "descripcion": "descripción limpia",
      "monto": 0.00,
      "tipo": "cargo|abono",
      "saldo": 0.00
    }
  ]
}

REGLAS:
${isCreditCard ? '- cargo = retiro/gasto/compra (monto positivo)\n- abono = PAGO DE TARJETA / abono recibido (monto positivo, se registrará como Transferencia interna)' : '- cargo = retiro/gasto/compra (monto positivo)\n- abono = depósito/ingreso/pago recibido (monto positivo)'}
- cargo = retiro/gasto/compra (monto positivo)
- abono = depósito/ingreso/pago recibido (monto positivo)
- Excluye: saldo inicial, saldo final, totales, encabezados de columna
- HSBC: excluye transferencias internas "Cajita"
- BBVA TDC: pagos recibidos = abono, compras = cargo
- Santander: RETIRO = cargo, DEPOSITO = abono
- Banamex: RETIROS = cargo, DEPÓSITOS = abono
- Fechas siempre YYYY-MM-DD
- Si la fecha solo tiene día y mes, usa el año del periodo`;

export async function POST(request) {
    try {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: 'ANTHROPIC_API_KEY no configurada. Agrégala en .env.local y en Vercel → Settings → Environment Variables.' },
                { status: 503 }
            );
        }

        // Dynamic import para evitar problemas de worker en Vercel/NextJS Edge
        const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default || (await import('pdf-parse')).default;
        const Anthropic = (await import('@anthropic-ai/sdk')).default;

        const client = new Anthropic({ apiKey });

        const formData = await request.formData();
        const file = formData.get('file');
        const rawTextInput = formData.get('rawText');
        const isCreditCard = formData.get('isCreditCard') === 'true';

        let text;

        if (rawTextInput) {
            text = rawTextInput;
        } else {
            if (!file) {
                return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 });
            }

            const buffer = Buffer.from(await file.arrayBuffer());
            const password = formData.get('password') || '';

            try {
                const pdfData = await pdfParse(buffer, password ? { password } : undefined);
                text = pdfData.text;
            } catch (err) {
                if (/password/i.test(err.message)) {
                    return NextResponse.json(
                        { error: 'Este PDF está protegido con contraseña.', code: 'PASSWORD_REQUIRED' },
                        { status: 422 }
                    );
                }
                throw err;
            }
        }

        if (!text || text.trim().length < 100) {
            return NextResponse.json(
                { error: 'No se pudo extraer texto del PDF. El PDF puede estar escaneado.' },
                { status: 400 }
            );
        }

        const response = await client.messages.create({
            model: 'claude-opus-4-5',
            max_tokens: 4096,
            messages: [{
                role: 'user',
                content: `${getParserPrompt(isCreditCard)}\n\nTEXTO:\n${text.substring(0, 15000)}`,
            }],
        });

        const rawText = response.content[0].text.trim();
        const jsonText = rawText.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
        const parsed = JSON.parse(jsonText);

        // Map movimientos → transactions format compatible with finanzas page
        const transactions = (parsed.movimientos ?? []).map(m => {
            let tipo = m.tipo === 'abono' ? 'ingreso' : 'egreso';
            if (isCreditCard && m.tipo === 'abono') {
                tipo = 'Transferencia'; // Movimiento interno, pago de tarjeta
            }
            return {
                fecha: m.fecha,
                concepto: m.descripcion,
                monto: Math.abs(Number(m.monto) || 0),
                tipo,
                categoria: 'Otros',
            };
        }).filter(t => t.monto > 0 && t.fecha);

        return NextResponse.json({
            transactions,
            success: true,
            data: parsed,
            tokens_used: response.usage.input_tokens + response.usage.output_tokens,
        });

    } catch (error) {
        console.error('[parse-statement]', error);
        return NextResponse.json(
            { error: error.message || 'Error procesando el estado de cuenta' },
            { status: 500 }
        );
    }
}
