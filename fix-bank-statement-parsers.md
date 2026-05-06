# Fix Bank Statement Parsers — Rewrite Completo

Read CONTEXT.md then implement all changes below.

## Problema raíz diagnosticado

Después de extraer el texto real de cada PDF:

- **HSBC**: encoding corrupto con pdftotext/pdfplumber → necesita **OCR con pytesseract + PyMuPDF**
- **Inbursa**: columnas en líneas **separadas** (fecha+ref en línea 1, concepto en línea 2, monto en línea 3) → el regex anterior no matcheaba nada
- **Santander**: PDF completamente de imagen (174 bloques tipo imagen, 0 texto) → necesita **OCR obligatorio**
- **Banamex**: día y mes en líneas separadas (`"16\nFEB"`), depósitos con espacio trailing (`"2,500.00 "`) → parser anterior fallaba en detección
- **BBVA**: `+ $X` = **cargo al usuario** (gasto), `- $X` = **abono/pago** (ingreso) — lógica invertida en parser anterior

---

## Dependencias a instalar

```bash
npm install pdf-parse
npm install --save-dev @types/pdf-parse
# En el servidor también necesitamos python para OCR (si se usa API route server-side)
# Alternativa: usar pdf2json que funciona sin python
npm install pdf2json
```

Para el OCR de HSBC y Santander, el approach es **renderizar a imagen en el cliente
y usar la API de Claude Vision** (evita dependencia de pytesseract en servidor Next.js).
Ver sección "Estrategia de extracción" abajo.

---

## Estrategia de extracción por banco

```
HSBC      → OCR (imagen) vía Claude Vision API
Inbursa   → pdfplumber / pdf-parse texto digital (funciona bien)
Santander → OCR (imagen) vía Claude Vision API
Banamex   → pdf-parse texto digital (funciona bien)
BBVA      → pdf-parse texto digital (funciona bien)
```

---

## Archivos a REEMPLAZAR completamente

### 1. `/lib/parsers/bank-statement-parser.ts`

```typescript
export interface ParsedTransaction {
  date: string        // ISO: "2025-08-01"
  description: string
  amount: number      // positivo siempre; usar `type` para dirección
  type: 'income' | 'expense'
  bank: string
  category?: string
}

export interface ParseResult {
  bank: string
  accountNumber: string
  period: string
  transactions: ParsedTransaction[]
  summary: {
    openingBalance: number
    closingBalance: number
    totalDeposits: number
    totalCharges: number
  }
  requiresOCR?: boolean  // true si el PDF necesita procesamiento de imagen
}

export type BankId = 'hsbc' | 'inbursa' | 'santander' | 'banamex' | 'bbva'

/**
 * Detecta el banco a partir del texto extraído del PDF.
 * Para PDFs de imagen (Santander, HSBC con encoding roto),
 * el texto puede estar vacío o ser ilegible.
 */
export function detectBank(text: string, filename?: string): BankId | null {
  const t = text.toLowerCase()
  const f = (filename ?? '').toLowerCase()

  // Detección por contenido de texto
  if (/nomina flexible hsbc|hsbc.*estado de cuenta/i.test(text)) return 'hsbc'
  if (/banco inbursa|cuentaefe|inbursa.*estado de cuenta/i.test(text)) return 'inbursa'
  if (/banco santander|super nomina.*santander|estado de cuenta nómina.*santander/i.test(text)) return 'santander'
  if (/banamex|micuenta|banco nacional de méxico/i.test(text)) return 'banamex'
  if (/bbva mexico|tarjeta oro bbva|bbva.*estado de cuenta/i.test(text)) return 'bbva'

  // Si el texto está vacío o es ilegible (PDF de imagen), intentar por nombre de archivo
  if (!text.trim() || text.trim().length < 50) {
    if (f.includes('hsbc')) return 'hsbc'
    if (f.includes('inbursa')) return 'inbursa'
    if (f.includes('santander')) return 'santander'
    if (f.includes('banamex')) return 'banamex'
    if (f.includes('bbva')) return 'bbva'
  }

  return null
}

/**
 * Detecta si un PDF necesita OCR (es imagen o tiene encoding roto).
 * Criterio: texto extraído muy corto O contiene muchos caracteres no-ASCII sospechosos.
 */
export function needsOCR(text: string): boolean {
  if (!text || text.trim().length < 100) return true
  // HSBC: muchos caracteres como Õ Ö Ô É Á @ Æ Ó Å — encoding corrupto
  const nonAsciiRatio = (text.match(/[^\x00-\x7F]/g) ?? []).length / text.length
  return nonAsciiRatio > 0.3
}
```

---

### 2. `/lib/parsers/inbursa-parser.ts`

**Formato real extraído (pdfplumber text):**
```
DETALLE DE MOVIMIENTOS
FECHA
REFERENCIA
CONCEPTO
CARGOS
ABONOS
SALDO
MAY 01
BALANCE INICIAL
96,434.97
MAY 01 2969869111
COSTCO CHIHUAHUA MX
807.00
95,627.97
MAY 06 2975324467
TRASPASO ENTRE CUENTAS
TRASPASO DE (SANBORNS)...
9,000.00     ← este es ABONO (saldo sube)
101,214.90
MAY 31 3004927063
INTERESES GANADOS
364.31       ← ABONO
90,316.69
```

**Clave de parsing**: los valores son siempre positivos. Para distinguir cargo/abono,
comparar el saldo con el saldo anterior: si saldo sube → abono; si baja → cargo.

```typescript
import { ParseResult, ParsedTransaction } from './bank-statement-parser'

const MONTH_MAP: Record<string, string> = {
  ENE: '01', FEB: '02', MAR: '03', ABR: '04',
  MAY: '05', JUN: '06', JUL: '07', AGO: '08',
  SEP: '09', OCT: '10', NOV: '11', DIC: '12'
}

function parseAmt(s?: string): number {
  if (!s) return 0
  return parseFloat(s.replace(/,/g, '').trim()) || 0
}

export function parseInbursa(text: string): ParseResult {
  // Extraer metadatos
  const accountMatch = text.match(/CUENTA\s+(\d{10,})/i)
  const accountNumber = accountMatch?.[1] ?? ''

  const periodMatch = text.match(/Del\s+(\d{2}\s+\w+\s+\d{4})\s+al\s+(\d{2}\s+\w+\s+\d{4})/i)
  const period = periodMatch ? `${periodMatch[1]} - ${periodMatch[2]}` : ''

  // Año: tomarlo del periodo
  const yearMatch = text.match(/\b(20\d{2})\b/)
  const year = yearMatch?.[1] ?? new Date().getFullYear().toString()

  const openingBalance = parseAmt(text.match(/SALDO ANTERIOR\s+([\d,]+\.\d{2})/i)?.[1])
  const closingBalance  = parseAmt(text.match(/SALDO ACTUAL\s+([\d,]+\.\d{2})/i)?.[1])
  const totalDeposits   = parseAmt(text.match(/ABONOS\s+([\d,]+\.\d{2})/i)?.[1])
  const totalCharges    = parseAmt(text.match('/CARGOS\s+([\d,]+\.\d{2})/i)?.[1])

  // Encontrar sección de detalle
  const detailStart = text.indexOf('DETALLE DE MOVIMIENTOS')
  const detailText = detailStart >= 0 ? text.slice(detailStart) : text

  // Parsear línea por línea
  // Patrón: "MES DD [REF]\nDESCRIPCION\nMONTO\nSALDO"
  const lines = detailText.split('\n').map(l => l.trim()).filter(Boolean)

  const transactions: ParsedTransaction[] = []
  let prevSaldo = openingBalance
  let i = 0

  // Saltarse el header
  while (i < lines.length && !lines[i].match(/^(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)/)) {
    i++
  }

  while (i < lines.length) {
    const line = lines[i]

    // Detectar línea de fecha: "MAY 01" o "MAY 01 2969869111"
    const dateMatch = line.match(/^(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)\s+(\d{2})(?:\s+\d+)?$/)
    if (!dateMatch) { i++; continue }

    const monthNum = MONTH_MAP[dateMatch[1]] ?? '01'
    const day = dateMatch[2].padStart(2, '0')
    const isoDate = `${year}-${monthNum}-${day}`

    i++
    // Siguiente línea(s) = descripción (puede ser multilínea hasta llegar al monto)
    const descLines: string[] = []
    while (i < lines.length && !lines[i].match(/^[\d,]+\.\d{2}$/) && !lines[i].match(/^(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)/)) {
      descLines.push(lines[i])
      i++
    }
    const description = descLines.join(' ').slice(0, 120)

    // Siguiente línea = monto
    if (i >= lines.length) break
    const montoStr = lines[i]
    const montoMatch = montoStr.match(/^([\d,]+\.\d{2})$/)
    if (!montoMatch) continue
    i++

    // Siguiente línea = saldo
    if (i >= lines.length) break
    const saldoStr = lines[i]
    const saldoMatch = saldoStr.match(/^([\d,]+\.\d{2})$/)
    if (!saldoMatch) { /* saldo podría estar en misma línea, continuar */ }
    else i++

    const monto = parseAmt(montoMatch[1])
    const saldo = saldoMatch ? parseAmt(saldoMatch[1]) : 0

    if (monto === 0) continue
    if (description.includes('BALANCE INICIAL')) { prevSaldo = monto; continue }

    // Determinar tipo comparando saldo
    const isIncome = saldoMatch ? (saldo > prevSaldo - 1) : false
    if (saldoMatch) prevSaldo = saldo

    // Palabras clave adicionales para casos ambiguos
    const incomeKeywords = /INTERESES GANADOS|TRASPASO.*RECIB|ABONO|RENDIMIENTO/i
    const expenseKeywords = /COSTCO|GASOL|OXXO|FARMACIA|CASINO|SEARS|ALSUPER|COPPEL|CASETAS|PIZZERIA|MERCADO/i

    let type: 'income' | 'expense' = isIncome ? 'income' : 'expense'
    if (incomeKeywords.test(description)) type = 'income'
    if (expenseKeywords.test(description)) type = 'expense'

    transactions.push({
      date: isoDate,
      description: description || 'Sin descripción',
      amount: monto,
      type,
      bank: 'Inbursa',
      category: categorize(description, type)
    })
  }

  return {
    bank: 'Inbursa',
    accountNumber,
    period,
    transactions,
    summary: { openingBalance, closingBalance, totalDeposits, totalCharges }
  }
}
```

---

### 3. `/lib/parsers/banamex-parser.ts`

**Formato real extraído:**
```
FECHA      CONCEPTO                           RETIROS    DEPÓSITOS   SALDO
               SALDO ANTERIOR                                        23,221.52
16 FEB         PAGO INTERBANCARIO A NU MEXICO
               AL BENEF. DEREK
               ...
               REF. 0130226 pago MISMO DIA    10,000.00              13,221.52
23 FEB         PAGO RECIBIDO DE BBVA MEXICO
               ...
                                                          2,500.00   10,404.53
```

**Con pymupdf get_text('text') el texto sale así:**
```
16
FEB
PAGO INTERBANCARIO A NU MEXICO
AL BENEF. DEREK
...
REF. 0130226 pago MISMO DIA
10,000.00
13,221.52
23 FEB
PAGO RECIBIDO DE BBVA MEXICO
...
2,500.00 
10,404.53
```

```typescript
import { ParseResult, ParsedTransaction } from './bank-statement-parser'

const MONTH_MAP: Record<string, string> = {
  ENE: '01', FEB: '02', MAR: '03', ABR: '04',
  MAY: '05', JUN: '06', JUL: '07', AGO: '08',
  SEP: '09', OCT: '10', NOV: '11', DIC: '12'
}

function parseAmt(s?: string): number {
  if (!s) return 0
  return parseFloat(s.replace(/,/g, '').trim()) || 0
}

export function parseBanamex(text: string): ParseResult {
  const accountMatch = text.match(/Número de cuenta de cheques\s+(\d+)/i)
    ?? text.match(/Número de contrato\s+(\d+)/i)
  const accountNumber = accountMatch?.[1] ?? ''

  const periodMatch = text.match(/del\s+(\d+)\s+de\s+(\w+)\s+al\s+\d+\s+de\s+(\w+)\s+del\s+(\d{4})/i)
  const period = periodMatch ? `${periodMatch[1]} ${periodMatch[2]} - ${periodMatch[3]} ${periodMatch[4]}` : ''
  const year = periodMatch?.[4] ?? text.match(/\b(20\d{2})\b/)?.[1] ?? new Date().getFullYear().toString()

  const openingBalance = parseAmt(text.match(/Saldo anterior\s+En pesos M\.N\.\s+([\d,]+\.\d{2})/i)?.[1])
  const closingBalance  = parseAmt(text.match(/Saldo al Corte\s+([\d,]+\.\d{2})/i)?.[1])
  const totalDeposits   = parseAmt(text.match(/\(\+\)\s+\d+\s+Depósitos\s+([\d,]+\.\d{2})/i)?.[1])
  const totalCharges    = parseAmt(text.match(/\(-\)\s+\d+\s+Retiros\/Otros cargos\s+([\d,]+\.\d{2})/i)?.[1])

  const detailStart = text.indexOf('Detalle de Operaciones')
  const detailText = detailStart >= 0 ? text.slice(detailStart) : text

  const lines = detailText.split('\n').map(l => l.trim()).filter(Boolean)
  const transactions: ParsedTransaction[] = []

  // Estado del parser
  let currentDay = ''
  let currentMonth = ''
  let currentDescLines: string[] = []
  let state: 'idle' | 'collecting_desc' = 'idle'

  // Keywords que indican ingresos
  const INCOME_KEYWORDS = /PAGO RECIBIDO|ABONO|DEPOSITO CANALES|SPIN BY OXXO|TRANSFERENCIA.*RECIB|NÓMINA|NOMINA/i
  const EXPENSE_KEYWORDS = /PAGO INTERBANCARIO A|AMAZON|APPLE\.COM|CARGO|NAYAXX|HTECH|COMISION/i

  const flush = () => {
    if (!currentDay || currentDescLines.length === 0) return

    const description = currentDescLines
      .filter(l => !l.match(/^\d{8}\s/) && !l.match(/^\d{4}\/\d{4}/))  // filtrar líneas técnicas
      .join(' ')
      .replace(/\s+/g, ' ')
      .slice(0, 150)

    // El monto está en la última línea que sea solo número
    // y el saldo en la penúltima o la que va antes
    // Encontrar montos al final de currentDescLines
    const amountLines: number[] = []
    for (let j = currentDescLines.length - 1; j >= 0; j--) {
      const m = currentDescLines[j].match(/^([\d,]+\.\d{2})\s*$/)
      if (m) amountLines.unshift(parseAmt(m[1]))
      else break
    }

    if (amountLines.length < 1) return

    // Si hay 2 números: primero = monto (retiro o depósito), segundo = saldo
    // Si hay 1 número: es el saldo (sin monto explícito, caso raro) o monto sin saldo
    // Banamex: depósitos a veces tienen trailing space: "2,500.00 "
    // Retiros no tienen trailing space

    // La descripción puede ayudar
    const isIncome = INCOME_KEYWORDS.test(description)
    const isExpense = EXPENSE_KEYWORDS.test(description)

    const monto = amountLines[0]
    if (monto === 0 || description.includes('SALDO ANTERIOR')) return

    const type: 'income' | 'expense' = isIncome ? 'income' : (isExpense ? 'expense' : 'expense')
    const monthNum = MONTH_MAP[currentMonth.toUpperCase()] ?? '01'

    transactions.push({
      date: `${year}-${monthNum}-${currentDay}`,
      description,
      amount: monto,
      type,
      bank: 'Banamex',
      category: categorize(description, type)
    })
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Detectar inicio de transacción — puede ser "16 FEB" en una línea o "16" y "FEB" separados
    const dateOneLine = line.match(/^(\d{1,2})\s+(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)$/i)
    const dayOnly = line.match(/^(\d{1,2})$/)
    const nextIsMonth = i + 1 < lines.length && lines[i + 1].match(/^(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)$/i)

    if (dateOneLine) {
      flush()
      currentDay = dateOneLine[1].padStart(2, '0')
      currentMonth = dateOneLine[2]
      currentDescLines = []
      state = 'collecting_desc'
    } else if (dayOnly && nextIsMonth) {
      flush()
      currentDay = dayOnly[1].padStart(2, '0')
      currentMonth = lines[i + 1]
      i++ // skip month line
      currentDescLines = []
      state = 'collecting_desc'
    } else if (state === 'collecting_desc') {
      currentDescLines.push(line)
    }
  }
  flush()

  return {
    bank: 'Banamex',
    accountNumber,
    period,
    transactions,
    summary: { openingBalance, closingBalance, totalDeposits, totalCharges }
  }
}
```

---

### 4. `/lib/parsers/bbva-parser.ts`

**Formato real (pymupdf text):**
```
08-abr-2026
09-abr-2026
NETFLIX COM 1
+ $329.00
13-abr-2026
13-abr-2026
PGO SPEI RECIB/0187338163
- $115,000.00
```

**Regla**: `+ $X` = cargo al usuario (expense), `- $X` = pago/abono a la deuda (income para flujo de caja = no es ingreso real, es pago de tarjeta)

Para BBVA crédito, todos los `+` son **gastos** y los `-` son **pagos** (tratarlos como `income` en el sistema para que cuadre el flujo).

```typescript
import { ParseResult, ParsedTransaction } from './bank-statement-parser'

const MONTH_MAP: Record<string, string> = {
  ene: '01', feb: '02', mar: '03', abr: '04',
  may: '05', jun: '06', jul: '07', ago: '08',
  sep: '09', oct: '10', nov: '11', dic: '12'
}

function bbvaDateToISO(d: string): string {
  const p = d.split('-')
  if (p.length !== 3) return d
  return `${p[2]}-${MONTH_MAP[p[1].toLowerCase()] ?? '01'}-${p[0].padStart(2, '0')}`
}

function parseAmt(s?: string): number {
  if (!s) return 0
  return parseFloat(s.replace(/[$,]/g, '').trim()) || 0
}

export function parseBBVA(text: string): ParseResult {
  const cardMatch = text.match(/Número de tarjeta[:\s]+([\d\s]+)/i)
  const accountNumber = cardMatch ? `****${cardMatch[1].replace(/\s/g, '').slice(-4)}` : ''

  const periodMatch = text.match(/Periodo[:\s]+([\d\w-]+)\s+al\s+([\d\w-]+)/i)
  const period = periodMatch ? `${periodMatch[1]} - ${periodMatch[2]}` : ''

  const openingBalance = parseAmt(text.match(/Adeudo del periodo anterior\s+\$?([\d,]+\.\d{2})/i)?.[1])
  const closingBalance  = parseAmt(text.match(/PAGO PARA NO GENERAR INTERESES[²\d]?\s+\$?([\d,]+\.\d{2})/i)?.[1])
  const totalDeposits   = parseAmt(text.match(/Pagos y abonos\s+-\s+\$?([\d,]+\.\d{2})/i)?.[1])
  const totalCharges    = parseAmt(text.match(/Cargos regulares \(no a meses\)\s+\+\s+\$?([\d,]+\.\d{2})/i)?.[1])

  const transactions: ParsedTransaction[] = []
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  // El formato de pymupdf separa cada campo en línea:
  // fecha_op → fecha_cargo → descripcion → "+ $monto" o "- $monto"
  const dateRegex = /^\d{2}-(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)-\d{4}$/i

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    if (!dateRegex.test(line)) { i++; continue }

    const fechaOp = line
    i++

    // La siguiente línea puede ser otra fecha (fecha de cargo) o descripción
    let fechaCargo = ''
    if (i < lines.length && dateRegex.test(lines[i])) {
      fechaCargo = lines[i]
      i++
    }

    // Descripción (puede ser multilínea hasta encontrar el monto)
    const descLines: string[] = []
    while (i < lines.length && !lines[i].match(/^[+-]\s*\$[\d,]+\.\d{2}$/)) {
      if (dateRegex.test(lines[i])) break  // siguiente transacción
      descLines.push(lines[i])
      i++
    }

    if (i >= lines.length) break

    const montoLine = lines[i]
    const montoMatch = montoLine.match(/^([+-])\s*\$\s*([\d,]+\.\d{2})$/)
    if (!montoMatch) continue
    i++

    const sign = montoMatch[1]
    const amount = parseAmt(montoMatch[2])
    const description = descLines.join(' ').replace(/\s+/g, ' ').slice(0, 150)

    if (amount === 0) continue

    // En BBVA tarjeta de crédito:
    // "+" = cargo/compra = GASTO del usuario
    // "-" = pago a la tarjeta = tratarlo como pago (no es ingreso real pero equilibra flujo)
    const type: 'income' | 'expense' = sign === '-' ? 'income' : 'expense'

    transactions.push({
      date: bbvaDateToISO(fechaOp),
      description,
      amount,
      type,
      bank: 'BBVA',
      category: categorize(description, type)
    })
  }

  // Parsear también compras a meses
  // Formato: "DD-mes-YYYY\nDESCRIPCION\n$X.XX\n$X.XX\n$X.XX\nN de M\n0.00%"
  const mesesSection = text.indexOf('COMPRAS Y CARGOS DIFERIDOS A MESES')
  if (mesesSection >= 0) {
    const mesesText = text.slice(mesesSection, text.indexOf('CARGOS,COMPRAS Y ABONOS REGULARES'))
    const mesesLines = mesesText.split('\n').map(l => l.trim()).filter(Boolean)
    let j = 0
    while (j < mesesLines.length) {
      if (!dateRegex.test(mesesLines[j])) { j++; continue }
      const fecha = mesesLines[j]; j++
      const desc = mesesLines[j] ?? ''; j++
      // Next few: monto original, saldo pendiente, pago requerido
      const amounts: number[] = []
      while (j < mesesLines.length && mesesLines[j].match(/^\$[\d,]+\.\d{2}$/)) {
        amounts.push(parseAmt(mesesLines[j]))
        j++
      }
      // Skip "N de M" and "0.00%"
      while (j < mesesLines.length && (mesesLines[j].match(/^\d+ de \d+$/) || mesesLines[j] === '0.00%')) j++

      const pagoRequerido = amounts[2] ?? amounts[0] ?? 0
      if (pagoRequerido > 0) {
        transactions.push({
          date: bbvaDateToISO(fecha),
          description: `[MSI] ${desc}`,
          amount: pagoRequerido,
          type: 'expense',
          bank: 'BBVA',
          category: categorize(desc, 'expense')
        })
      }
    }
  }

  return {
    bank: 'BBVA',
    accountNumber,
    period,
    transactions,
    summary: { openingBalance, closingBalance, totalDeposits, totalCharges }
  }
}
```

---

### 5. `/lib/parsers/hsbc-parser.ts` y `/lib/parsers/santander-parser.ts`

Estos dos bancos requieren OCR. El parser recibe el **texto ya procesado por OCR**
(la API route se encarga de llamar a Claude Vision o pytesseract antes de llamar al parser).

**HSBC — Formato OCR real:**
```
Día  Descripción                    Referencia/  Retiro/Cargo  Depósito/Abono  Saldo
                                    Serial
01   5213009006___APPLE.COM/BILL US 11771645     $49.00                         $1,117.03
                                    12084
04   TRANSFERENCIA BPI DESDE...     13651011                    $1,600.00        $2,499.18
```

```typescript
import { ParseResult, ParsedTransaction } from './bank-statement-parser'

function parseAmt(s?: string): number {
  if (!s) return 0
  return parseFloat(s.replace(/[$,\s]/g, '')) || 0
}

export function parseHSBC(ocrText: string): ParseResult {
  // Metadatos
  const accountMatch = ocrText.match(/NÚMERO DE CUENTA\s+(\d+)/i)
    ?? ocrText.match(/Número de cuenta[:\s]+(\d+)/i)
  const accountNumber = accountMatch?.[1] ?? ''

  const periodMatch = ocrText.match(/(\d{2}\/\d{2}\/\d{4})\s+al\s+(\d{2}\/\d{2}\/\d{4})/)
    ?? ocrText.match(/Período del\s+(\d{2}\/\d{2}\/\d{4})\s+al\s+(\d{2}\/\d{2}\/\d{4})/)
  const period = periodMatch ? `${periodMatch[1]} - ${periodMatch[2]}` : ''

  // Extraer año y mes del periodo "01/08/2025 al 31/08/2025"
  const yearMonthMatch = periodMatch?.[1]?.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  const year = yearMonthMatch?.[3] ?? new Date().getFullYear().toString()
  const baseMonth = yearMonthMatch?.[2] ?? '01'

  const openingBalance = parseAmt(ocrText.match(/Saldo Inicial del\s*\nPeriodo\s+([\d,]+\.\d{2})/i)?.[1]
    ?? ocrText.match(/Saldo Inicial[^\n]*\n.*?\$([\d,]+\.\d{2})/i)?.[1])
  const closingBalance  = parseAmt(ocrText.match(/Saldo Final del\s*\nPeriodo\s+([\d,]+\.\d{2})/i)?.[1])
  const totalDeposits   = parseAmt(ocrText.match(/Depósitos\/\s*\nAbonos\s+\$\s*([\d,]+\.\d{2})/i)?.[1])
  const totalCharges    = parseAmt(ocrText.match(/Retiros\/Cargos\s+\$\s*([\d,]+\.\d{2})/i)?.[1])

  const transactions: ParsedTransaction[] = []

  // El OCR del estado HSBC produce líneas como:
  // "01   5213009006___APPLE.COM/BILL US   11771645     $49.00              $1,117.03"
  // "04   TRANSFERENCIA BPI DESDE LA CUENTA 0282   13651011         $ 1,600.00   $ 2,499.18"
  //
  // Regex: día (1-2 dígitos) + descripción + [retiro $X.XX] + [depósito $X.XX] + saldo $X.XX
  const txRegex = /^(\d{1,2})\s{2,}(.+?)\s{2,}(?:\d+\s+)?(\$[\s\d,.]+)?\s*(\$[\s\d,.]+)?\s*(\$[\s\d,.]+)\s*$/gm

  let match: RegExpExecArray | null
  const detailStart = ocrText.indexOf('DETALLE MOVIMIENTOS')
  const detailText  = detailStart >= 0 ? ocrText.slice(detailStart) : ocrText

  while ((match = txRegex.exec(detailText)) !== null) {
    const day = match[1].padStart(2, '0')
    const rawDesc = match[2].trim()
    const col3 = match[3] ? parseAmt(match[3]) : 0
    const col4 = match[4] ? parseAmt(match[4]) : 0
    const col5 = match[5] ? parseAmt(match[5]) : 0  // saldo

    if (rawDesc.includes('Día') || rawDesc.includes('Descripción')) continue

    // Limpiar descripción (quitar referencias numéricas al inicio)
    const description = rawDesc.replace(/^\d{10,}\s*/, '').replace(/_{3,}/g, '').trim().slice(0, 120)

    // Si col3 > 0 y col4 = 0 → retiro/cargo
    // Si col3 = 0 y col4 > 0 → depósito/abono  
    // Si col3 > 0 y col4 > 0 → determinar por keyword
    let amount = 0
    let type: 'income' | 'expense' = 'expense'

    if (col3 > 0 && col4 === 0) {
      amount = col3; type = 'expense'
    } else if (col4 > 0 && col3 === 0) {
      amount = col4; type = 'income'
    } else if (col3 > 0 && col4 > 0) {
      // Ambos presentes: el mayor suele ser el monto real
      const isDeposit = /TRANSFERENCIA BPI|ABONO|DEPOSITO/i.test(description)
      if (isDeposit) { amount = Math.max(col3, col4); type = 'income' }
      else { amount = Math.min(col3, col4); type = 'expense' }
    } else {
      continue
    }

    if (amount === 0) continue

    transactions.push({
      date: `${year}-${baseMonth}-${day}`,
      description,
      amount,
      type,
      bank: 'HSBC',
      category: categorize(description, type)
    })
  }

  // Fallback: si no se encontró nada con regex multi-col, usar approach línea a línea
  if (transactions.length === 0) {
    parseHSBCLineByLine(detailText, year, baseMonth, transactions)
  }

  return {
    bank: 'HSBC',
    accountNumber,
    period,
    transactions,
    summary: { openingBalance, closingBalance, totalDeposits, totalCharges }
  }
}

function parseHSBCLineByLine(
  text: string, year: string, month: string,
  transactions: ParsedTransaction[]
) {
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const m = line.match(/^(\d{2})\s+(.+?)\s+\$\s*([\d,]+\.\d{2})/)
    if (!m) continue
    const day = m[1]; const desc = m[2].trim(); const amount = parseFloat(m[3].replace(/,/g, ''))
    if (isNaN(amount) || amount === 0) continue
    const isIncome = /TRANSFERENCIA BPI|ABONO|DEPOSITO/i.test(desc)
    transactions.push({
      date: `${year}-${month}-${day}`,
      description: desc.slice(0, 120),
      amount,
      type: isIncome ? 'income' : 'expense',
      bank: 'HSBC',
      category: categorize(desc, isIncome ? 'income' : 'expense')
    })
  }
}
```

**Santander — Formato OCR real:**
```
FECHA        FOLIO    DESCRIPCION                                      DEPOSITO  RETIRO   SALDO
16-ABR-2024  7902325  ABONO TRANSFERENCIA SPEI HORA 04:18:12           1,005.02           9,363.04
16-ABR-2024  0095577  CONSUMO LOCAL AJENO TERMINACION 3217 16ABR24               78.00   9,285.04
```

```typescript
import { ParseResult, ParsedTransaction } from './bank-statement-parser'

const MONTH_ES: Record<string, string> = {
  ENE: '01', FEB: '02', MAR: '03', ABR: '04',
  MAY: '05', JUN: '06', JUL: '07', AGO: '08',
  SEP: '09', OCT: '10', NOV: '11', DIC: '12'
}

function santanderDate(s: string): string {
  const p = s.split('-')
  if (p.length !== 3) return s
  return `${p[2]}-${MONTH_ES[p[1].toUpperCase()] ?? '01'}-${p[0].padStart(2, '0')}`
}

function parseAmt(s?: string): number {
  if (!s) return 0
  return parseFloat(s.replace(/,/g, '').trim()) || 0
}

export function parseSantander(ocrText: string): ParseResult {
  // Extraer número de cuenta
  const accountMatch = ocrText.match(/(\d{2}-\d{8,}-\d)/i)
    ?? ocrText.match(/SUPER NOMINA\s*([\d-]+)/i)
  const accountNumber = accountMatch?.[1] ?? ''

  const periodMatch = ocrText.match(/PERIODO\s+([\d\w-]+)\s+AL\s+([\d\w-]+)/i)
  const period = periodMatch ? `${periodMatch[1]} - ${periodMatch[2]}` : ''

  const openingBalance = parseAmt(ocrText.match(/SALDO FINAL DEL PERIODO ANTERIOR[!:]?\s*\$?\s*([\d,]+\.\d{2})/i)?.[1])
  const closingBalance  = parseAmt(ocrText.match(/SALDO FINAL DEL PERIODO[:\s]+\$?\s*([\d,]+\.\d{2})(?!\s+ANTERIOR)/i)?.[1])
  const totalDeposits   = parseAmt(ocrText.match(/Saldo inicial.*?\n.*?\+ Depósitos\s+([\d,]+\.\d{2})/i)?.[1])
  const totalCharges    = parseAmt(ocrText.match(/- Retiros\s+([\d,]+\.\d{2})/i)?.[1])

  const transactions: ParsedTransaction[] = []

  // Formato OCR real de Santander:
  // "DD-MES-YYYY  FOLIO  DESCRIPCION_LARGA  [deposito]  [retiro]  SALDO"
  // Las columnas pueden estar separadas por múltiples espacios
  // La descripción puede continuar en la siguiente línea (sin fecha)
  const datePattern = /\d{2}-(?:ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)-\d{4}/i

  const lines = ocrText.split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const dateMatch = line.match(/((\d{2})-(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)-(\d{4}))/i)
    if (!dateMatch) { i++; continue }

    const isoDate = santanderDate(dateMatch[1])
    const rest = line.slice(line.indexOf(dateMatch[1]) + dateMatch[1].length).trim()

    // Quitar folio (7 dígitos) al inicio
    const restNoFolio = rest.replace(/^\d{4,10}\s+/, '')

    // Buscar montos al final de la línea
    // Santander: columnas DEPOSITO RETIRO SALDO — los montos al final
    // Formato: "DESCRIPCION   1,005.02           9,363.04"  (deposito + saldo)
    //          "DESCRIPCION             78.00   9,285.04"  (retiro + saldo)

    // Acumular descripción (puede continuar en líneas sin fecha)
    let fullDesc = restNoFolio
    i++
    while (i < lines.length && !lines[i].match(datePattern) && !lines[i].match(/TOTAL\s+DEPOSITOS|SALDO FINAL DEL PERIODO:/i)) {
      const nextLine = lines[i].trim()
      // Si la siguiente línea solo tiene números, es parte de los montos de esta tx
      if (!nextLine.match(/^[\d,. ]+$/) && nextLine.length > 3) {
        fullDesc += ' ' + nextLine
        i++
      } else {
        break
      }
    }

    // Extraer montos de fullDesc/line — los últimos 2-3 números son [deposito?] [retiro?] [saldo]
    const amounts = fullDesc.match(/[\d,]+\.\d{2}/g) ?? []
    const description = fullDesc.replace(/[\d,]+\.\d{2}/g, '').replace(/\s+/g, ' ').trim().slice(0, 150)

    if (amounts.length < 1) continue

    // Lógica:
    // - 1 monto: es el saldo (sin transacción de dinero, ej. balance inicial)
    // - 2 montos: [monto_tx, saldo]
    // - 3 montos: [deposito, retiro, saldo] — uno de deposito/retiro es 0 (o ausente)
    let amount = 0
    let type: 'income' | 'expense' = 'expense'

    if (amounts.length === 1) continue  // solo saldo, sin movimiento
    if (amounts.length === 2) {
      amount = parseAmt(amounts[0])
      // Determinar por keywords
      const isIncome = /ABONO|RECIBIDO|TRANSFERENCIA.*SPEI.*\n|NÓMINA|NOMINA|DEVOLUC/i.test(description)
      type = isIncome ? 'income' : 'expense'
    } else if (amounts.length >= 3) {
      // [deposito, retiro, saldo] — el que NO sea 0 o sea más pequeño que el saldo
      const v1 = parseAmt(amounts[0])
      const v2 = parseAmt(amounts[1])
      if (v1 > 0 && v2 === 0) { amount = v1; type = 'income' }
      else if (v2 > 0 && v1 === 0) { amount = v2; type = 'expense' }
      else { amount = v1; type = 'income' }  // fallback
    }

    if (amount === 0) continue
    if (description.length < 2) continue

    transactions.push({
      date: isoDate,
      description,
      amount,
      type,
      bank: 'Santander',
      category: categorize(description, type)
    })
  }

  return {
    bank: 'Santander',
    accountNumber,
    period,
    transactions,
    summary: { openingBalance, closingBalance, totalDeposits, totalCharges }
  }
}
```

---

### 6. `/lib/parsers/categories.ts` — Categorización automática

Extraer la función `categorize` a un archivo separado e importarla en todos los parsers.

```typescript
// Mapa de palabras clave → categoría
const CATEGORY_RULES: Array<{ keywords: RegExp; category: string; type?: 'income' | 'expense' }> = [
  // Ingresos
  { keywords: /TRANSFERENCIA BPI|ABONO.*NOMINA|NOMINA|NÓMINA|SUELDO|SALARIO/i, category: 'Salario', type: 'income' },
  { keywords: /INTERESES GANADOS|RENDIMIENTO/i, category: 'Intereses', type: 'income' },
  { keywords: /TRASPASO.*RECIB|PAGO RECIBIDO|DEPOSITO CANALES|SPIN BY OXXO/i, category: 'Transferencias', type: 'income' },
  { keywords: /DEVOLUC/i, category: 'Devoluciones', type: 'income' },

  // Gastos - Alimentación
  { keywords: /OXXO|SEVEN|7-ELEVEN|TIENDA|ALSUPER|COSTCO|WALMART|WAL-MART|SAMS|CHEDRAUI|SORIANA|LA COMER|SUPERETTE|ABARR|MERCS POPULARES/i, category: 'Supermercado' },
  { keywords: /RESTAURANT|REST |DELIPOLLO|BURGER|MCDONALD|KFC|PIZZA|CAFET|CAFE |COFFEE|TACO|BURRITOS|POLLO|CARNES|CARNICERIAS|CARNECE/i, category: 'Restaurantes' },
  { keywords: /DOMINOS|PIZZA HUT/i, category: 'Restaurantes' },

  // Transporte
  { keywords: /GASOL|GAS ESTAC|GASOLINA|PEMEX|SHELL|BP |COMBUSTIBLE/i, category: 'Gasolina' },
  { keywords: /CASETAS|CUOTA|AUTOPISTA/i, category: 'Casetas' },
  { keywords: /UBER|DIDI|CABIFY|INDRIVER/i, category: 'Transporte' },

  // Servicios digitales / Suscripciones
  { keywords: /NETFLIX|SPOTIFY|DISNEY|HBO|APPLE\.COM|APPLE COM|APPLE\.COMÍBILL|AMAZON PRIME|YOUTUBE/i, category: 'Suscripciones' },
  { keywords: /PADDLE|SETGB/i, category: 'Suscripciones' },

  // Telefonía / Internet
  { keywords: /TELCEL|AT&T|TELMEX|TOTALPLAY|IZZI|MEGACABLE|MOVISTAR|RECARGA/i, category: 'Telefonía' },
  { keywords: /CFE|LUZ Y FUERZA|AGUA|MUNICIPIO/i, category: 'Servicios del hogar' },

  // Salud
  { keywords: /FARMACIA|FARMA|SIMILAR|BENAVIDES|GUADALAJARA|MEDICA|HOSPITAL|CLINICA|DENTISTA|OPTICA/i, category: 'Salud' },
  { keywords: /ORTHOMEDICA/i, category: 'Salud' },

  // Moda y ropa
  { keywords: /SEARS|LIVERPOOL|PALACIO|ZARA|H&M|COPPEL|FAMA BOUT|MAKEDICLO|SMILE INTIMATES|VICTORIA.*SECRET/i, category: 'Ropa' },
  { keywords: /MINISO/i, category: 'Ropa' },

  // Educación
  { keywords: /COLEGIO|ESCUELA|UNIVERSIDAD|UVM|ITESM|CLIP.*CLASES|CLASES|INGLES/i, category: 'Educación' },

  // Entretenimiento
  { keywords: /CASINO|CINE|TICKETMASTER|CINEMA|BOLICHE|PARQUE/i, category: 'Entretenimiento' },

  // Compras online
  { keywords: /AMAZON|MERCADOPAGO|MERPAGO|PAYPAL|TEMU|EBANX/i, category: 'Compras online' },

  // Seguros
  { keywords: /QUALITAS|ALLIANZ|SEGUROS|SEGURO|GNP|MAPFRE/i, category: 'Seguros' },

  // Servicios financieros
  { keywords: /COMISION|ADMINISTRACION RENTA|IVA|ISR|INTERESES|BBVA SEGUROS/i, category: 'Comisiones bancarias' },
  { keywords: /RETIRO CAJERO|CAJERO|ATM|DISP ATM/i, category: 'Retiro efectivo' },
  { keywords: /TRANSFERENCIA|PAGO INTERBANCARIO|SPEI/i, category: 'Transferencias' },

  // Hogar
  { keywords: /FERRE|FERRETERIA|HOME DEPOT|TRUPER|CONSTRURAMA/i, category: 'Hogar' },
  { keywords: /VETERINAR/i, category: 'Mascotas' },
]

export function categorize(description: string, type: 'income' | 'expense'): string {
  for (const rule of CATEGORY_RULES) {
    if (rule.type && rule.type !== type) continue
    if (rule.keywords.test(description)) return rule.category
  }
  return type === 'income' ? 'Otros ingresos' : 'Otros gastos'
}
```

---

### 7. `/app/api/import-statement/route.ts` — Reescritura con OCR

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { detectBank, needsOCR } from '@/lib/parsers/bank-statement-parser'
import { parseInbursa } from '@/lib/parsers/inbursa-parser'
import { parseBanamex } from '@/lib/parsers/banamex-parser'
import { parseBBVA } from '@/lib/parsers/bbva-parser'
import { parseHSBC } from '@/lib/parsers/hsbc-parser'
import { parseSantander } from '@/lib/parsers/santander-parser'

// Extrae texto de PDF usando pdf-parse
async function extractPDFText(buffer: Buffer): Promise<string> {
  try {
    const pdfParse = (await import('pdf-parse')).default
    const data = await pdfParse(buffer)
    return data.text
  } catch {
    return ''
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    // ocrText: enviado desde el cliente cuando el PDF requiere OCR (procesado con Claude Vision)
    const ocrTextInput = formData.get('ocrText') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const filename = file.name

    // Intentar extraer texto digital primero
    let text = await extractPDFText(buffer)

    // Si viene ocrText del cliente (para HSBC/Santander procesados con Claude Vision)
    if (ocrTextInput && ocrTextInput.length > 100) {
      text = ocrTextInput
    }

    const bank = detectBank(text, filename)

    // Si no se detectó banco con texto digital o el texto está corrupto,
    // indicar al cliente que necesita OCR
    if (!bank || needsOCR(text)) {
      // Intentar detectar por filename para dar instrucción específica
      const bankFromFile = detectBank('', filename)
      return NextResponse.json({
        requiresOCR: true,
        bank: bankFromFile,
        message: bankFromFile
          ? `El PDF de ${bankFromFile.toUpperCase()} requiere procesamiento de imagen. Enviando a OCR...`
          : 'No se pudo detectar el banco. Verifica que el archivo sea un estado de cuenta válido.'
      }, { status: needsOCR(text) && bankFromFile ? 200 : 422 })
    }

    // Parsear según banco
    let result
    switch (bank) {
      case 'inbursa':   result = parseInbursa(text); break
      case 'banamex':   result = parseBanamex(text); break
      case 'bbva':      result = parseBBVA(text); break
      case 'hsbc':      result = parseHSBC(text); break      // solo si llegó ocrText
      case 'santander': result = parseSantander(text); break  // solo si llegó ocrText
      default:
        return NextResponse.json({ error: `Banco "${bank}" no soportado` }, { status: 422 })
    }

    if (!result || result.transactions.length === 0) {
      return NextResponse.json({
        error: 'No se encontraron transacciones. El formato del PDF puede haber cambiado.',
        bank: bank,
        debug: { textLength: text.length, textSample: text.slice(0, 200) }
      }, { status: 422 })
    }

    return NextResponse.json({
      bank: result.bank,
      accountNumber: result.accountNumber,
      period: result.period,
      transactionCount: result.transactions.length,
      summary: result.summary,
      transactions: result.transactions
    })

  } catch (err: any) {
    console.error('import-statement error:', err)
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 })
  }
}
```

---

### 8. Componente UI — Manejar flujo OCR para HSBC y Santander

En el componente de importación existente, agregar el flujo de 2 pasos para bancos que requieren OCR:

```tsx
// En el componente de importación de estados de cuenta

async function handleFileSelect(file: File) {
  setImporting(true)
  setError(null)

  try {
    // Paso 1: intentar importación directa
    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('/api/import-statement', {
      method: 'POST',
      body: formData
    })

    const data = await res.json()

    if (data.requiresOCR) {
      // Paso 2: PDF necesita OCR → usar Claude Vision API
      toast.info(`Procesando ${data.bank?.toUpperCase() ?? 'PDF'} con OCR...`)
      const ocrText = await processWithOCR(file, data.bank)

      // Paso 2b: reenviar con texto OCR
      const formData2 = new FormData()
      formData2.append('file', file)
      formData2.append('ocrText', ocrText)

      const res2 = await fetch('/api/import-statement', {
        method: 'POST',
        body: formData2
      })

      const data2 = await res2.json()
      if (!res2.ok) throw new Error(data2.error)
      setImportResult(data2)

    } else if (!res.ok) {
      throw new Error(data.error)
    } else {
      setImportResult(data)
    }

  } catch (err: any) {
    setError(err.message)
    toast.error(err.message)
  } finally {
    setImporting(false)
  }
}

/**
 * Usa la API de Anthropic para extraer texto de un PDF de imagen.
 * Procesa página por página y concatena el resultado.
 */
async function processWithOCR(file: File, bank: string | null): Promise<string> {
  // Convertir PDF a imágenes en el cliente es complejo sin bibliotecas pesadas.
  // Approach simplificado: enviar el PDF como base64 a Claude Vision directamente.
  const base64 = await fileToBase64(file)

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 }
          },
          {
            type: 'text',
            text: `Extrae TODO el texto de este estado de cuenta bancario ${bank ? `de ${bank.toUpperCase()}` : ''}.
Incluye TODOS los movimientos/transacciones con sus fechas, descripciones y montos exactos.
Preserva el formato tabular lo más posible.
Responde SOLO con el texto extraído, sin explicaciones adicionales.`
          }
        ]
      }]
    })
  })

  const result = await response.json()
  return result.content?.[0]?.text ?? ''
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      resolve(dataUrl.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
```

---

## Resumen de cambios

| Archivo | Acción |
|---------|--------|
| `lib/parsers/bank-statement-parser.ts` | Reemplazar — agregar `needsOCR()` |
| `lib/parsers/categories.ts` | Crear nuevo — 30+ reglas de categorización |
| `lib/parsers/inbursa-parser.ts` | Reemplazar — parser línea por línea |
| `lib/parsers/banamex-parser.ts` | Reemplazar — maneja día/mes en líneas separadas |
| `lib/parsers/bbva-parser.ts` | Reemplazar — lógica `+`/`-` corregida |
| `lib/parsers/hsbc-parser.ts` | Reemplazar — recibe texto OCR |
| `lib/parsers/santander-parser.ts` | Reemplazar — recibe texto OCR |
| `app/api/import-statement/route.ts` | Reemplazar — flujo con detección OCR |
| Componente UI de importación | Modificar — agregar flujo OCR de 2 pasos |

## Notas importantes

1. **Inbursa**: la diferencia cargo/abono se determina **comparando saldo anterior vs nuevo**. Keywords son solo respaldo.
2. **BBVA**: es **tarjeta de crédito**, no débito. `+ $` = gasto del usuario. `- $` = pago a la deuda.
3. **Santander y HSBC**: el OCR se hace en el **cliente** (no en el servidor) enviando el PDF a Claude Vision, para no requerir pytesseract en el servidor de Next.js.
4. **Banamex**: el día y el mes aparecen en **líneas separadas** en el texto extraído por pymupdf/pdf-parse.
5. Todos los parsers importan `categorize` desde `categories.ts` para categorización automática.
