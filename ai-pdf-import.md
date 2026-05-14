# AI PDF Import — Extracción con Claude Vision

Read CONTEXT.md then implement all changes below.

## Concepto

En lugar de parsear el PDF con regex (frágil, se rompe con cada variante de formato),
renderizar cada página del PDF como imagen y enviarla a Claude Vision API para que
extraiga las transacciones como JSON estructurado.

**Ventajas:**
- Funciona con CUALQUIER banco sin escribir un parser específico
- Funciona con PDFs escaneados (Santander, HSBC con encoding roto)
- Nunca falla por cambios de formato del banco
- Detecta automáticamente ingresos vs egresos leyendo las columnas visualmente

**Flujo:**
1. Usuario sube PDF
2. Frontend renderiza cada página como imagen (usando `pdfjs-dist`)
3. Imágenes se envían a Claude Vision API (`/v1/messages`)
4. Claude devuelve JSON con transacciones
5. Se muestra preview → usuario confirma → se inserta en Supabase

---

## Dependencias

```bash
npm install pdfjs-dist
```

---

## Archivo 1: CREAR `/lib/parsers/ai-statement-parser.ts`

```typescript
export interface AITransaction {
  date: string         // "2026-02-16"
  description: string
  amount: number       // siempre positivo
  type: 'income' | 'expense'
  category?: string
}

export interface AIParseResult {
  bank: string
  transactions: AITransaction[]
  summary: {
    totalIncome: number
    totalExpense: number
    transactionCount: number
  }
  rawResponse?: string
}

const SYSTEM_PROMPT = `Eres un experto en extracción de datos de estados de cuenta bancarios mexicanos.
Tu tarea es extraer transacciones y devolverlas como JSON válido.
Responde SOLO con el JSON, sin explicaciones, sin markdown, sin bloques de código.`

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
- Para BBVA tarjeta de crédito: "+" = cargo (expense), "-" = pago (income)`

/**
 * Parsea un estado de cuenta usando Claude Vision API.
 * Recibe un array de imágenes en base64 (una por página del PDF).
 */
export async function parseStatementWithAI(
  pagesBase64: string[],
  mediaType: 'image/png' | 'image/jpeg' = 'image/png'
): Promise<AIParseResult> {
  
  // Construir contenido del mensaje: imágenes + prompt
  const imageContent = pagesBase64.map(b64 => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: mediaType,
      data: b64,
    }
  }))

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // No se pasa x-api-key aquí — lo maneja el proxy de claude.ai
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          ...imageContent,
          { type: 'text', text: USER_PROMPT }
        ]
      }]
    })
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Claude API error ${response.status}: ${err}`)
  }

  const data = await response.json()
  const rawText = data.content?.[0]?.text ?? ''

  // Parsear JSON de la respuesta
  let parsed: any
  try {
    // Claude a veces añade ```json ... ``` aunque le pedimos que no
    const clean = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()
    parsed = JSON.parse(clean)
  } catch {
    throw new Error(`No se pudo parsear la respuesta de Claude: ${rawText.slice(0, 200)}`)
  }

  const transactions: AITransaction[] = (parsed.transactions ?? []).map((tx: any) => ({
    date: tx.date ?? '',
    description: String(tx.description ?? '').trim().slice(0, 150),
    amount: Math.abs(Number(tx.amount) || 0),
    type: tx.type === 'income' ? 'income' : 'expense',
    category: categorizeAI(String(tx.description ?? ''), tx.type),
  })).filter((tx: AITransaction) => tx.amount > 0 && tx.date)

  const totalIncome  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  return {
    bank: parsed.bank ?? 'Desconocido',
    transactions,
    summary: {
      totalIncome,
      totalExpense,
      transactionCount: transactions.length,
    },
    rawResponse: rawText,
  }
}

function categorizeAI(description: string, type: string): string {
  if (type === 'income') {
    if (/nomina|nómina|sueldo|salario/i.test(description)) return 'Salario'
    if (/intereses/i.test(description)) return 'Intereses'
    if (/deposito canales/i.test(description)) return 'Depósito'
    return 'Transferencias recibidas'
  }
  if (/oxxo|seven|alsuper|costco|walmart|soriana|chedraui|abarr/i.test(description)) return 'Supermercado'
  if (/restaurant|delipollo|burger|mcdonald|pizza|cafet|cafe |taco|pollo/i.test(description)) return 'Restaurantes'
  if (/gasol|gasolina|pemex|combustible/i.test(description)) return 'Gasolina'
  if (/casetas|autopista/i.test(description)) return 'Casetas'
  if (/uber|didi|cabify/i.test(description)) return 'Transporte'
  if (/netflix|spotify|apple\.com|amazon prime|disney|paddle/i.test(description)) return 'Suscripciones'
  if (/telcel|telmex|totalplay|izzi|megacable|recarga/i.test(description)) return 'Telefonía'
  if (/cfe|luz y fuerza/i.test(description)) return 'Servicios del hogar'
  if (/farmacia|farma|similar|benavides|medica|hospital/i.test(description)) return 'Salud'
  if (/amazon|mercadopago|merpago|paypal|temu/i.test(description)) return 'Compras online'
  if (/qualitas|allianz|seguros|seguro/i.test(description)) return 'Seguros'
  if (/comision|administracion renta|iva cobrado/i.test(description)) return 'Comisiones bancarias'
  if (/retiro cajero|cajero|atm|disp atm/i.test(description)) return 'Retiro efectivo'
  if (/pago interbancario a|transferencia a|pago a/i.test(description)) return 'Transferencias enviadas'
  return 'Otros gastos'
}
```

---

## Archivo 2: CREAR `/lib/parsers/pdf-to-images.ts`

Convierte páginas de un PDF a imágenes base64 en el browser usando pdfjs-dist.

```typescript
/**
 * Renderiza todas las páginas de un PDF como imágenes PNG en base64.
 * Usa pdfjs-dist que corre en el browser.
 * Solo procesa páginas relevantes (no portada, no glosario).
 */
export async function pdfToImages(
  file: File,
  options: {
    scale?: number          // 2.0 = ~144dpi, suficiente para OCR
    maxPages?: number       // máx páginas a procesar
    skipFirst?: boolean     // saltar portada
  } = {}
): Promise<string[]> {
  const { scale = 2.0, maxPages = 15, skipFirst = true } = options

  // Importar pdfjs dinámicamente (solo en el browser)
  const pdfjsLib = await import('pdfjs-dist')
  
  // Worker necesario para pdfjs en Next.js
  pdfjsLib.GlobalWorkerOptions.workerSrc = 
    `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const images: string[] = []
  const startPage = skipFirst ? 2 : 1  // saltar portada
  const endPage   = Math.min(pdf.numPages, startPage + maxPages - 1)

  for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
    const page    = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale })

    // Crear canvas offscreen
    const canvas  = document.createElement('canvas')
    canvas.width  = viewport.width
    canvas.height = viewport.height
    const ctx     = canvas.getContext('2d')!

    await page.render({ canvasContext: ctx, viewport }).promise

    // Convertir a base64 PNG
    const dataUrl = canvas.toDataURL('image/png')
    images.push(dataUrl.split(',')[1])  // solo la parte base64
  }

  return images
}

/**
 * Estima cuántas páginas tiene el PDF para mostrar progreso.
 */
export async function getPDFPageCount(file: File): Promise<number> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  return pdf.numPages
}
```

---

## Archivo 3: MODIFICAR el componente de importación existente

Busca el componente donde se sube el PDF para importar (probablemente en
`/app/(dashboard)/finanzas/` o en el componente modal de importación).

**Reemplaza la función de procesamiento con:**

```tsx
'use client'
import { useState, useCallback } from 'react'
import { pdfToImages } from '@/lib/parsers/pdf-to-images'
import { parseStatementWithAI, AITransaction } from '@/lib/parsers/ai-statement-parser'
import { createClient } from '@/lib/supabase/client'
import { useDropzone } from 'react-dropzone'  // si ya está instalado

interface ImportState {
  status: 'idle' | 'rendering' | 'analyzing' | 'preview' | 'importing' | 'done' | 'error'
  progress: string
  result?: ReturnType<typeof parseStatementWithAI> extends Promise<infer T> ? T : never
  error?: string
}

export function StatementImporter() {
  const [state, setState] = use<ImportState>({ status: 'idle', progress: '' })
  const supabase = createClient()

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setState({ status: 'error', progress: '', error: 'Solo se aceptan archivos PDF' })
      return
    }

    try {
      // Paso 1: Renderizar PDF como imágenes
      setState({ status: 'rendering', progress: 'Renderizando páginas del PDF...' })
      const images = await pdfToImages(file, { scale: 2.0, maxPages: 12, skipFirst: true })
      
      // Paso 2: Enviar a Claude Vision
      setState({ 
        status: 'analyzing', 
        progress: `Analizando ${images.length} páginas con IA...` 
      })
      const result = await parseStatementWithAI(images)

      if (result.transactions.length === 0) {
        throw new Error('No se encontraron transacciones. Verifica que el PDF sea un estado de cuenta bancario.')
      }

      // Paso 3: Mostrar preview
      setState({ status: 'preview', progress: '', result })

    } catch (err: any) {
      setState({ 
        status: 'error', 
        progress: '', 
        error: err.message ?? 'Error al procesar el PDF' 
      })
    }
  }, [])

  const handleImport = async () => {
    if (!state.result) return
    setState(s => ({ ...s, status: 'importing', progress: 'Guardando transacciones...' }))

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const rows = state.result.transactions.map(tx => ({
        user_id: user.id,
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        type: tx.type,
        category: tx.category ?? 'Sin categoría',
        bank: state.result!.bank,
        source: 'pdf_import_ai',
      }))

      const { error } = await supabase
        .from('transactions')
        .insert(rows)

      if (error) throw error

      setState({ status: 'done', progress: `✓ ${rows.length} transacciones importadas` })
    } catch (err: any) {
      setState({ status: 'error', progress: '', error: err.message })
    }
  }

  // ── UI ─────────────────────────────────────────────────────────────────

  if (state.status === 'idle' || state.status === 'error') {
    return (
      <div className="space-y-4">
        {/* Drop zone */}
        <div
          className="border-2 border-dashed border-zinc-600 rounded-xl p-8 text-center cursor-pointer hover:border-violet-500 transition-colors"
          onClick={() => document.getElementById('pdf-input')?.click()}
        >
          <div className="text-4xl mb-3">🏦</div>
          <p className="text-zinc-300 font-medium">Arrastra tu estado de cuenta aquí</p>
          <p className="text-zinc-500 text-sm mt-1">Banamex, HSBC, BBVA, Santander, Inbursa · PDF</p>
          <p className="text-violet-400 text-xs mt-3">✨ Powered by IA — extracción automática</p>
          <input
            id="pdf-input"
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>

        {state.status === 'error' && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-300 text-sm">
            {state.error}
          </div>
        )}
      </div>
    )
  }

  if (state.status === 'rendering' || state.status === 'analyzing' || state.status === 'importing') {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-zinc-300 text-sm text-center">{state.progress}</p>
        {state.status === 'analyzing' && (
          <p className="text-zinc-500 text-xs">Esto toma 10-20 segundos...</p>
        )}
      </div>
    )
  }

  if (state.status === 'preview' && state.result) {
    const { result } = state
    const incomeTotal  = result.summary.totalIncome
    const expenseTotal = result.summary.totalExpense
    const count        = result.summary.transactionCount

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-zinc-400 text-xs">Banco detectado</p>
            <p className="text-white font-semibold">{result.bank}</p>
          </div>
          <div className="text-right">
            <p className="text-zinc-400 text-xs">{count} transacciones</p>
            <p className="text-emerald-400 text-sm">+${incomeTotal.toLocaleString('es-MX', {minimumFractionDigits:2})}</p>
            <p className="text-red-400 text-sm">-${expenseTotal.toLocaleString('es-MX', {minimumFractionDigits:2})}</p>
          </div>
        </div>

        {/* Lista preview */}
        <div className="max-h-72 overflow-y-auto space-y-1">
          {result.transactions.map((tx, i) => (
            <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-zinc-800/50">
              <div className="min-w-0 flex-1">
                <p className="text-white text-xs truncate">{tx.description}</p>
                <p className="text-zinc-500 text-xs">{tx.date} · {tx.category}</p>
              </div>
              <span className={`ml-3 text-sm font-medium shrink-0 ${
                tx.type === 'income' ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {tx.type === 'income' ? '+' : '-'}${tx.amount.toLocaleString('es-MX', {minimumFractionDigits:2})}
              </span>
            </div>
          ))}
        </div>

        {/* Botones */}
        <div className="flex gap-3">
          <button
            onClick={() => setState({ status: 'idle', progress: '' })}
            className="flex-1 py-3 rounded-xl border border-zinc-700 text-zinc-300 text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={handleImport}
            className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-colors"
          >
            Importar {count} transacciones
          </button>
        </div>
      </div>
    )
  }

  if (state.status === 'done') {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-3">
        <div className="text-5xl">✅</div>
        <p className="text-emerald-400 font-semibold">{state.progress}</p>
        <button
          onClick={() => setState({ status: 'idle', progress: '' })}
          className="text-zinc-400 text-sm hover:text-white"
        >
          Importar otro
        </button>
      </div>
    )
  }

  return null
}
```

---

## Resumen de archivos

| Archivo | Acción |
|---------|--------|
| `lib/parsers/ai-statement-parser.ts` | Crear — llama a Claude Vision API |
| `lib/parsers/pdf-to-images.ts` | Crear — renderiza PDF a imágenes con pdfjs-dist |
| Componente de importación existente | Modificar — reemplazar lógica con AI flow |

## Notas importantes

1. **Sin API key en el cliente** — el componente corre en Next.js y los requests a `api.anthropic.com` se manejan como en los artifacts de Claude (la key se inyecta en el proxy). Si en producción necesitas tu propia key, crea un API route `/app/api/parse-ai/route.ts` que agregue `x-api-key: process.env.ANTHROPIC_API_KEY`.

2. **pdfjs-dist en Next.js** — requiere configuración del worker. Si hay problemas, agregar en `next.config.js`:
   ```js
   webpack: (config) => {
     config.resolve.alias.canvas = false
     return config
   }
   ```

3. **Costo por estado de cuenta** — ~5 páginas de imágenes × ~1000 tokens/imagen ≈ 5000 tokens de entrada. Con Claude Sonnet: ~$0.015 USD por estado de cuenta. Muy económico para el valor que da.

4. **Velocidad** — 10-20 segundos por estado de cuenta. Muéstrale al usuario el spinner con mensaje.
