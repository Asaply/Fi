# Fix Banamex Parser — Rewrite Total

Read CONTEXT.md then implement all changes below.

## Diagnóstico exacto

El parser anterior fallaba porque:
1. Buscaba fecha+monto en la **misma línea** — en realidad cada campo está en su **propia línea**
2. No detectaba la diferencia entre ingreso y egreso
3. No filtraba los **headers de página** que se inyectan en medio del texto

## La regla de oro (100% confiable)

El texto extraído con PyMuPDF/pdf-parse de Banamex tiene este patrón exacto:

```
'2,500.00 '   ← con trailing space = DEPÓSITO (ingreso)
'2,500.00'    ← sin trailing space  = RETIRO (egreso)
```

Esto es lo único necesario para distinguir tipo. No se necesitan keywords.

## Estructura real del texto extraído

```
'16'                              ← día (puede ser separado del mes)
'FEB'                             ← mes
'PAGO INTERBANCARIO A NU MEXICO'  ← descripción línea 1
'AL BENEF. DEREK'                 ← descripción línea 2
...
'REF. 0130226   pago MISMO DIA'   ← descripción última
'10,000.00'                       ← MONTO (sin space = retiro)
'13,221.52'                       ← saldo

'23 FEB'                          ← fecha en una sola línea (también ocurre)
'PAGO RECIBIDO DE BBVA MEXICO'
...
'MBAN01002602240079089440'
'2,500.00 '                       ← MONTO (con space = depósito)
'10,404.53'                       ← saldo
```

Headers de página que aparecen **en medio** del texto y deben filtrarse:
```
'SUC. 4109 PACHECO, CHIHUAHUA,'
'AVENIDA CARLOS PACHECO VILLA SN'
'POPULAR '
'DEREK ARMANDO VALENZUELA MACIAS'
'Página 3 de 11  '
'0003909'
'000190.B26INDA020.AR.0313.01'
'Detalle de Operaciones  En pesos Moneda Nacional'
'FECHA'
'CONCEPTO'
'RETIROS'
'DEPÓSITOS'
'SALDO'
'Centro de Atención Telefónica'
'Ciudad de México: 55 1226 2639'
'Resto del país: 800 021 2345'
```

## Archivo a REEMPLAZAR: `/lib/parsers/banamex-parser.ts`

```typescript
import { ParseResult, ParsedTransaction } from './bank-statement-parser'
import { categorize } from './categories'

const MONTHS = new Set(['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'])
const MONTH_MAP: Record<string, string> = {
  ENE:'01', FEB:'02', MAR:'03', ABR:'04', MAY:'05', JUN:'06',
  JUL:'07', AGO:'08', SEP:'09', OCT:'10', NOV:'11', DIC:'12'
}

// Lines that are page headers / noise injected between transactions
const NOISE_EXACT = new Set([
  'FECHA','CONCEPTO','RETIROS','DEPÓSITOS','SALDO','SALDO ANTERIOR',
  'Centro de Atención Telefónica','Ciudad de México: 55 1226 2639',
  "Resto del país: 800 021 2345",'SUC. 4109 PACHECO, CHIHUAHUA,',
  'AVENIDA CARLOS PACHECO VILLA SN','POPULAR','POPULAR ',
  'DEREK ARMANDO VALENZUELA MACIAS',
  'Detalle de Operaciones  En pesos Moneda Nacional',
  '0003909','000190.B26INDA020.AR.0313.01',
  'Resumen Operaciones Tarjeta',
])
const NOISE_PREFIXES = [
  'Página ','TARJETA ','CONCEPTO','CONSUMOS','IMPORTE',
  'VARIOS','TOTAL','AHORRO FACIL','**La GAT','MiCuenta',
  'Resumen','Número de contrato','Saldo anterior','(+)','(-)',
  'Intereses','Saldo al','En el período','Saldo promedio','Días del',
  'Tasa de interés','Impuesto','* Expresada','Estado de Cuenta',
  'AHORRO','Periodo','GAT Nominal','GAT Real','Número de Contrato',
]

// Regex patterns
const DATE_ONE_LINE = /^(\d{1,2})\s+(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)$/i
const DATE_NUM_ONLY  = /^(\d{1,2})$/
// Amount line: digits, commas, decimal — with optional single trailing space
const AMOUNT_LINE    = /^([\d,]+\.\d{2})( ?)$/

function isNoise(line: string): boolean {
  const s = line.trim()
  if (!s) return true
  if (NOISE_EXACT.has(s) || NOISE_EXACT.has(line)) return true
  if (NOISE_PREFIXES.some(p => s.startsWith(p))) return true
  // Page numbers like "Página 3 de 11  "
  if (/^Página\s+\d+/.test(s)) return true
  // Long numeric reference lines from card transactions e.g. "20260218 75064956047001025192098 683519"
  if (/^\d{8}\s+\d{10,}/.test(s)) return true
  // Pure long numeric strings (account numbers, CLABE, etc)
  if (/^\d{10,}$/.test(s)) return true
  // Lines that are just a reference code like "000190.B26INDA020.AR.0313.01"
  if (/^\d{6}\.[A-Z0-9.]+$/.test(s)) return true
  return false
}

function parseAmt(s: string): number {
  return parseFloat(s.replace(/,/g, '')) || 0
}

interface TxBuffer {
  date: string
  lines: string[]  // raw lines between date and amounts
}

export function parseBanamex(text: string): ParseResult {
  // ── Metadata ──────────────────────────────────────────────────────────
  const accountMatch = text.match(/Número de cuenta de cheques\s+(\d+)/i)
    ?? text.match(/Número de contrato\s+(\d+)/i)
  const accountNumber = accountMatch?.[1] ?? ''

  const periodMatch = text.match(/del\s+\d+\s+de\s+\w+\s+al\s+\d+\s+de\s+\w+\s+del\s+(\d{4})/i)
  const year = periodMatch?.[1] ?? text.match(/\b(20\d{2})\b/)?.[1] ?? String(new Date().getFullYear())

  const periodFull = text.match(/Período del (.+?)(?:\n|$)/i)?.[1]?.trim() ?? ''

  const openingBalance = parseAmt(text.match(/Saldo anterior En pesos M\.N\.\s+([\d,]+\.\d{2})/i)?.[1] ?? '0')
  const closingBalance  = parseAmt(text.match(/Saldo al Corte\s+([\d,]+\.\d{2})/i)?.[1] ?? '0')
  const totalDeposits   = parseAmt(text.match(/\(\+\)\s+\d+\s+Depósitos\s+([\d,]+\.\d{2})/i)?.[1] ?? '0')
  const totalCharges    = parseAmt(text.match(/\(-\)\s+\d+\s+Retiros\/Otros cargos\s+([\d,]+\.\d{2})/i)?.[1] ?? '0')

  // ── Extract all "Detalle" sections (one per page) ─────────────────────
  const detailSections: string[] = []
  let searchFrom = 0
  while (true) {
    const idx = text.indexOf('Detalle de Operaciones', searchFrom)
    if (idx < 0) break
    detailSections.push(text.slice(idx))
    searchFrom = idx + 1
  }

  const rawLines: string[] = []
  for (const section of detailSections) {
    rawLines.push(...section.split('\n'))
  }

  // Filter noise
  const lines = rawLines.filter(l => !isNoise(l))

  // ── State machine ─────────────────────────────────────────────────────
  const transactions: ParsedTransaction[] = []
  let currentDate = ''
  let currentLines: string[] = []

  function flushTx() {
    if (!currentDate || currentLines.length === 0) return

    // Find the last two AMOUNT_LINE matches → [monto, saldo]
    const amountIdxs: number[] = []
    for (let j = 0; j < currentLines.length; j++) {
      if (AMOUNT_LINE.test(currentLines[j])) amountIdxs.push(j)
    }

    if (amountIdxs.length < 2) return  // need at least monto + saldo

    const montoIdx = amountIdxs[amountIdxs.length - 2]
    const montoLine = currentLines[montoIdx]
    const montoMatch = AMOUNT_LINE.exec(montoLine)!
    const isDeposit = montoMatch[2] === ' '  // trailing space = deposit
    const amount = parseAmt(montoMatch[1])

    if (amount === 0) return

    // Description = all lines before the monto, cleaned
    const descLines = currentLines
      .slice(0, montoIdx)
      .map(l => l.trim())
      .filter(l => l.length > 0)
      // Remove pure long numeric reference lines kept after first filter
      .filter(l => !/^\d{8}/.test(l) && !/^\d{10,}/.test(l))
      // Remove lines that are just tech codes like "9000/0012"
      .filter(l => !/^\d{4}\/\d{4}$/.test(l))
      // Remove RASTREO/CLAVE lines (keep REF lines for context)
      .filter(l => !l.startsWith('RASTREO') && !l.startsWith('CTA.BENEFICIARIO'))

    const description = descLines.join(' ').replace(/\s+/g, ' ').trim().slice(0, 150)
    if (!description) return

    const type: 'income' | 'expense' = isDeposit ? 'income' : 'expense'

    transactions.push({
      date: currentDate,
      description,
      amount,
      type,
      bank: 'Banamex',
      category: categorize(description, type),
    })
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const s = line.trim()

    // Try "DD MES" on one line
    const oneLineMatch = DATE_ONE_LINE.exec(s)
    if (oneLineMatch) {
      flushTx()
      const day = oneLineMatch[1].padStart(2, '0')
      const mon = oneLineMatch[2].toUpperCase()
      currentDate = `${year}-${MONTH_MAP[mon]}-${day}`
      currentLines = []
      i++
      continue
    }

    // Try "DD" on one line, "MES" on next
    const numOnly = DATE_NUM_ONLY.exec(s)
    const nextLine = i + 1 < lines.length ? lines[i + 1].trim().toUpperCase() : ''
    if (numOnly && MONTHS.has(nextLine)) {
      flushTx()
      const day = numOnly[1].padStart(2, '0')
      currentDate = `${year}-${MONTH_MAP[nextLine]}-${day}`
      currentLines = []
      i += 2
      continue
    }

    // Collect into current transaction buffer
    if (currentDate) {
      currentLines.push(line)
    }
    i++
  }
  flushTx()

  return {
    bank: 'Banamex',
    accountNumber,
    period: periodFull,
    transactions,
    summary: { openingBalance, closingBalance, totalDeposits, totalCharges },
  }
}
```

## Resultado esperado para este estado de cuenta

- **34 transacciones** en total
- **9 ingresos** (depósitos): $12,340.00 total
- **25 egresos** (retiros): $34,610.99 total
- Saldo inicial: $23,221.52 → Saldo final: $950.53

Transacciones de ingreso detectadas correctamente:
| Fecha | Descripción | Monto |
|-------|-------------|-------|
| 23-FEB | PAGO RECIBIDO DE BBVA MEXICO (Daniel Valenzuela) | $2,500.00 |
| 25-FEB | PAGO RECIBIDO DE BBVA MEXICO (Daniel Eduardo Chavez) | $120.00 |
| 25-FEB | PAGO RECIBIDO DE BBVA MEXICO (Glaed Estrada) | $120.00 |
| 25-FEB | PAGO RECIBIDO DE BBVA MEXICO (Andrea Moreno) | $120.00 |
| 25-FEB | PAGO RECIBIDO DE SANTANDER (Ricardo Santiago Torres) | $120.00 |
| 02-MAR | PAGO RECIBIDO DE SPIN BY OXXO (Ivan Gutierrez) | $3,000.00 |
| 09-MAR | DEPOSITO CANALES DE SERVICIO | $2,500.00 |
| 09-MAR | PAGO RECIBIDO DE NU MEXICO (Oscar Emilio Martinez) | $960.00 |
| 10-MAR | DEPOSITO CANALES DE SERVICIO | $2,900.00 |
