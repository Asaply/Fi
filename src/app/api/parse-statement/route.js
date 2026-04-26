import { NextResponse } from 'next/server';
import pdfParse from 'pdf-parse';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const PARSER_PROMPT = `Eres un parser de estados de cuenta bancarios mexicanos.
Extrae TODOS los movimientos del siguiente texto de estado de cuenta.

Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin backticks, sin markdown:
{
  "banco": "nombre del banco",
  "periodo": { "inicio": "YYYY-MM-DD", "fin": "YYYY-MM-DD" },
  "cuenta": "últimos 4 dígitos",
  "tipo_cuenta": "debito|credito",
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
        const formData = await request.formData();
        const file = formData.get('file');
        const rawTextInput = formData.get('rawText');

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
                content: `${PARSER_PROMPT}\n\nTEXTO:\n${text.substring(0, 15000)}`,
            }],
        });

        const rawText = response.content[0].text.trim();
        const jsonText = rawText.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
        const parsed = JSON.parse(jsonText);

        // Map movimientos → transactions format compatible with finanzas page
        const transactions = (parsed.movimientos ?? []).map(m => ({
            fecha: m.fecha,
            concepto: m.descripcion,
            monto: Math.abs(Number(m.monto) || 0),
            tipo: m.tipo === 'abono' ? 'ingreso' : 'egreso',
            categoria: 'Otros',
        })).filter(t => t.monto > 0 && t.fecha);

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
