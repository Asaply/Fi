Eres un parser de estados de cuenta bancarios mexicanos.
Extrae TODOS los movimientos del siguiente texto de estado de cuenta.

Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin markdown:
{
  "banco": "nombre del banco detectado",
  "periodo": { "inicio": "YYYY-MM-DD", "fin": "YYYY-MM-DD" },
  "cuenta": "últimos 4 dígitos si están disponibles",
  "tipo_cuenta": "debito|credito",
  "movimientos": [
    {
      "fecha": "YYYY-MM-DD",
      "descripcion": "descripción limpia",
      "monto": 123.45,
      "tipo": "cargo|abono",
      "saldo": 1234.56
    }
  ]
}

REGLAS:
- tipo "cargo" = retiro/gasto/cargo (número positivo)
- tipo "abono" = depósito/ingreso (número positivo)
- Excluye líneas de saldo inicial, saldo final, totales y encabezados
- Para BBVA TDC: los pagos recibidos son abonos, los demás son cargos
- Para HSBC: excluye transferencias internas tipo "Cajita"
- Fechas siempre en formato YYYY-MM-DD

TEXTO DEL ESTADO DE CUENTA:
[TEXTO AQUÍ]

# fix-parser-universal.md

## Objetivo
Reemplazar el parser actual de estados de cuenta con uno universal 
basado en Claude AI que soporte todos los bancos mexicanos.

## Archivo a modificar
`src/app/api/parse-statement/route.js` (o .ts)

## Implementación completa

```javascript
import { NextResponse } from 'next/server'
import pdfParse from 'pdf-parse/lib/pdf-parse.js'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

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
- Si la fecha solo tiene día y mes, usa el año del periodo`

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    
    if (!file) {
      return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const pdfData = await pdfParse(buffer)
    const text = pdfData.text

    if (!text || text.trim().length < 100) {
      return NextResponse.json({ 
        error: 'No se pudo extraer texto del PDF. El PDF puede estar escaneado.' 
      }, { status: 400 })
    }

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `${PARSER_PROMPT}\n\nTEXTO:\n${text.substring(0, 15000)}`
      }]
    })

    const rawText = response.content[0].text.trim()
    
    // Limpiar posibles backticks si Claude los incluye
    const jsonText = rawText.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    const parsed = JSON.parse(jsonText)

    return NextResponse.json({ 
      success: true, 
      data: parsed,
      tokens_used: response.usage.input_tokens + response.usage.output_tokens
    })

  } catch (error) {
    console.error('Error parsing statement:', error)
    return NextResponse.json({ 
      error: error.message || 'Error procesando el estado de cuenta'
    }, { status: 500 })
  }
}
```

## Variables de entorno requeridas
Asegúrate de que `ANTHROPIC_API_KEY` esté en `.env.local`

## Sin cambios en
- UI de importación
- Lógica de Supabase
- Categorización
- Routing