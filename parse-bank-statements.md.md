````markdown
# Parse Bank Statements — CSV Import Enhancement

Read CONTEXT.md then implement all changes below.

## Objetivo
Agregar soporte de parsing para 5 bancos mexicanos en la función de importación
manual de estados de cuenta PDF. Los parsers deben extraer transacciones y
retornar el formato estándar que ya usa el sistema.

---

## Archivos a crear/modificar

### 1. CREAR `/lib/parsers/bank-statement-parser.ts`

Parser principal que detecta el banco y delega al parser específico.

```typescript
import { parseHSBC } from './hsbc-parser'
import { parseInbursa } from './inbursa-parser'
import { parseSantander } from './santander-parser'
import { parseBanamex } from './banamex-parser'
import { parseBBVA } from './bbva-parser'

export interface ParsedTransaction {
  date: string        // ISO: "2025-08-01"
  description: string
  amount: number      // negativo = cargo, positivo = abono
  type: 'income' | 'expense'
  bank: string
  rawText: string
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
}

export function detectBank(text: string): string | null {
  if (/NOMINA FLEXIBLE HSBC|HSBC/i.test(text)) return 'hsbc'
  if (/BANCO INBURSA|Cuentaefe|INBURSA/i.test(text)) return 'inbursa'
  if (/Banco Santander|SUPER NOMINA.*Santander|ESTADO DE CUENTA NÓMINA.*Santander/i.test(text)) return 'santander'
  if (/Banamex|MiCuenta|BANCO NACIONAL DE MÉXICO/i.test(text)) return 'banamex'
  if (/BBVA|TARJETA ORO BBVA|BBVA MEXICO/i.test(text)) return 'bbva'
  return null
}

export function parseBankStatement(text: string): ParseResult | null {
  const bank = detectBank(text)
  if (!bank) return null

  switch (bank) {
    case 'hsbc':      return parseHSBC(text)
    case 'inbursa':   return parseInbursa(text)
    case 'santander': return parseSantander(text)
    case 'banamex':   return parseBanamex(text)
    case 'bbva':      return parseBBVA(text)
    default:          return null
  }
}
```

---

### 2. CREAR `/lib/parsers/hsbc-parser.ts`

```typescript
import { ParseResult, ParsedTransaction } from './bank-statement-parser'

/*
  HSBC Nómina Flexible
  Formato de movimiento:
    DÍA  DESCRIPCIÓN  REF/SERIAL  RETIRO/CARGO  DEPÓSITO/ABONO  SALDO
  
  Fechas: periodo "01/08/2025 al 31/08/2025"
  Cuenta: "NÚMERO DE CUENTA  6622023477"
*/

export function parseHSBC(text: string): ParseResult {
  // Extraer número de cuenta
  const accountMatch = text.match(/NÚMERO DE CUENTA\s+(\d+)/i)
  const accountNumber = accountMatch?.[1] ?? ''

  // Extraer periodo
  const periodMatch = text.match(/(\d{2}\/\d{2}\/\d{4})\s+al\s+(\d{2}\/\d{2}\/\d{4})/)
  const period = periodMatch ? `${periodMatch[1]} - ${periodMatch[2]}` : ''
  const year = periodMatch?.[2]?.split('/')?.[2] ?? new Date().getFullYear().toString()
  const month = periodMatch?.[1]?.split('/')?.[1] ?? ''

  // Extraer resumen
  const openingBalance = parseAmount(text.match(/Saldo Inicial del\s+Periodo\s+\$?([\d,]+\.\d{2})/i)?.[1])
  const closingBalance = parseAmount(text.match(/Saldo Final del\s+Periodo\s+\$?([\d,]+\.\d{2})/i)?.[1])
  const totalDeposits = parseAmount(text.match(/Depósitos\/\s*Abonos\s+\$?([\d,]+\.\d{2})/i)?.[1])
  const totalCharges = parseAmount(text.match(/Retiros\/Cargos\s+\$?([\d,]+\.\d{2})/i)?.[1])

  // Parsear movimientos
  // Línea típica: "01  5213009006____APPLE.COM/BILL US  11771645\n12084  $ 49.00  $ 1,117.03"
  const transactions: ParsedTransaction[] = []
  
  const lines = text.split('\n')
  const movementPattern = /^(\d{2})\s+(.+?)\s+(\d{6,})\s*\n?\s*(\d+)?\s*\$\s*([\d,]+\.\d{2})?\s*\$?\s*([\d,]+\.\d{2})?\s*\$\s*([\d,]+\.\d{2})/

  // Approach: buscar bloques del detalle de movimientos
  const detailStart = text.indexOf('DETALLE MOVIMIENTOS NOMINA FLEXIBLE')
  const detailText = detailStart >= 0 ? text.slice(detailStart) : text

  // Regex para líneas con cargo o abono
  // Día (2 dígitos) + descripción + ref + [retiro] + [abono] + saldo
  const txRegex = /^(\d{2})\s+(.{10,80?}?)\s{2,}([\d,]+\.\d{2})\s+([\d,]+\.\d{2})/gm
  let match: RegExpExecArray | null
  
  while ((match = txRegex.exec(detailText)) !== null) {
    const day = match[1].padStart(2, '0')
    const description = match[2].trim().replace(/\s+/g, ' ')
    const col3 = parseAmount(match[3])
    const col4 = parseAmount(match[4])

    // col3 podría ser cargo o saldo; necesitamos distinguir
    // En HSBC: Retiro/Cargo aparece antes que Depósito/Abono
    // Heurística: si col4 es el saldo (mayor o cercano al saldo inicial), col3 es el monto
    const amount = col3
    const isCharge = description.match(/TRANSFERENCIA|RETIRO|COMISION|IVA|APPLE|PADDLE|OXXO|TELCEL|PAYPAL/i)
    
    const isoDate = `${year}-${month}-${day}`
    
    transactions.push({
      date: isoDate,
      description,
      amount: isCharge ? -Math.abs(amount) : Math.abs(amount),
      type: isCharge ? 'expense' : 'income',
      bank: 'HSBC',
      rawText: match[0]
    })
  }

  // Fallback: método línea por línea más simple
  if (transactions.length === 0) {
    parseHSBCLineByLine(detailText, year, month, transactions)
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
  text: string,
  year: string,
  month: string,
  transactions: ParsedTransaction[]
) {
  const lines = text.split('\n')
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    // Buscar línea que empiece con día (01-31)
    const dayMatch = line.match(/^(\d{2})\s+(.+)/)
    if (!dayMatch) continue
    
    const day = dayMatch[1]
    if (parseInt(day) < 1 || parseInt(day) > 31) continue
    
    const rest = dayMatch[2]
    
    // Buscar montos: $ XX,XXX.XX
    const amounts = rest.match(/\$\s*([\d,]+\.\d{2})/g)
    if (!amounts || amounts.length < 1) continue
    
    const description = rest.replace(/\$[\s\d,.]+/g, '').trim()
    const firstAmount = parseAmount(amounts[0].replace('$', ''))
    
    // Determinar si es cargo o abono buscando en la línea siguiente o por contexto
    const nextLine = lines[i + 1]?.trim() ?? ''
    const isDeposit = line.includes('TRANSFERENCIA BPI') && amounts.length === 1
    
    transactions.push({
      date: `${year}-${month}-${day}`,
      description: description.slice(0, 100),
      amount: isDeposit ? firstAmount : -firstAmount,
      type: isDeposit ? 'income' : 'expense',
      bank: 'HSBC',
      rawText: line
    })
  }
}

function parseAmount(str?: string): number {
  if (!str) return 0
  return parseFloat(str.replace(/,/g, '')) || 0
}
```

---

### 3. CREAR `/lib/parsers/inbursa-parser.ts`

```typescript
import { ParseResult, ParsedTransaction } from './bank-statement-parser'

/*
  Banco Inbursa — Cuentaefe
  Formato:
    FECHA  REFERENCIA  CONCEPTO  CARGOS  ABONOS  SALDO
    "MAY 01  2969869111  COSTCO CHIHUAHUA MX  807.00    95,627.97"
  
  Mes textual: MAY, JUN, etc.
  Año en header: "Del 01 May 2024 al 31 May 2024"
*/

const MONTH_MAP: Record = {
  ENE: '01', FEB: '02', MAR: '03', ABR: '04',
  MAY: '05', JUN: '06', JUL: '07', AGO: '08',
  SEP: '09', OCT: '10', NOV: '11', DIC: '12'
}

export function parseInbursa(text: string): ParseResult {
  const accountMatch = text.match(/CUENTA\s+(\d+)/i)
  const accountNumber = accountMatch?.[1] ?? ''

  const periodMatch = text.match(/Del\s+(\d{2}\s+\w+\s+\d{4})\s+al\s+(\d{2}\s+\w+\s+\d{4})/i)
  const period = periodMatch ? `${periodMatch[1]} - ${periodMatch[2]}` : ''
  
  // Extraer año del periodo
  const yearMatch = text.match(/\d{4}/)
  const year = yearMatch?.[0] ?? new Date().getFullYear().toString()

  const openingBalance = parseAmount(text.match(/SALDO ANTERIOR\s+([\d,]+\.\d{2})/i)?.[1])
  const closingBalance = parseAmount(text.match(/SALDO ACTUAL\s+([\d,]+\.\d{2})/i)?.[1])
  const totalDeposits = parseAmount(text.match(/ABONOS\s+([\d,]+\.\d{2})/i)?.[1])
  const totalCharges = parseAmount(text.match(/CARGOS\s+([\d,]+\.\d{2})/i)?.[1])

  const transactions: ParsedTransaction[] = []

  // Formato: "MAY 01  2969869111  COSTCO CHIHUAHUA MX  807.00  [abono]  95,627.97"
  // La columna de cargos y abonos son opcionales (una de las dos está vacía)
  const txRegex = /^(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)\s+(\d{2})\s+(\d+)\s+(.{5,60}?)\s{2,}([\d,]+\.\d{2})?\s*([\d,]+\.\d{2})?\s+([\d,]+\.\d{2})\s*$/gm

  let match: RegExpExecArray | null
  while ((match = txRegex.exec(text)) !== null) {
    const monthStr = match[1]
    const day = match[2]
    const description = match[4].trim()
    const cargoStr = match[5]
    const abonoStr = match[6]
    // match[7] es saldo

    const monthNum = MONTH_MAP[monthStr] ?? '01'
    const isoDate = `${year}-${monthNum}-${day}`

    if (cargoStr) {
      transactions.push({
        date: isoDate,
        description,
        amount: -parseAmount(cargoStr),
        type: 'expense',
        bank: 'Inbursa',
        rawText: match[0]
      })
    } else if (abonoStr) {
      transactions.push({
        date: isoDate,
        description,
        amount: parseAmount(abonoStr),
        type: 'income',
        bank: 'Inbursa',
        rawText: match[0]
      })
    }
  }

  // Fallback: regex más permisivo
  if (transactions.length === 0) {
    const simpleRegex = /^(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)\s+(\d{2})\s+.{6,10}\s+(.{5,50})\s+([\d,]+\.\d{2})\s*([\d,]+\.\d{2})?\s*([\d,]+\.\d{2})/gm
    while ((match = simpleRegex.exec(text)) !== null) {
      const monthNum = MONTH_MAP[match[1]] ?? '01'
      const isoDate = `${year}-${monthNum}-${match[2]}`
      const description = match[3].trim()
      const val1 = parseAmount(match[4])
      const val2 = match[5] ? parseAmount(match[5]) : null
      const saldo = parseAmount(match[6] ?? match[5] ?? '0')

      // Si hay dos valores antes del saldo: cargo y abono
      if (val2 !== null) {
        if (val1 > 0) {
          transactions.push({ date: isoDate, description, amount: -val1, type: 'expense', bank: 'Inbursa', rawText: match[0] })
        } else {
          transactions.push({ date: isoDate, description, amount: val2, type: 'income', bank: 'Inbursa', rawText: match[0] })
        }
      } else {
        transactions.push({ date: isoDate, description, amount: -val1, type: 'expense', bank: 'Inbursa', rawText: match[0] })
      }
    }
  }

  return {
    bank: 'Inbursa',
    accountNumber,
    period,
    transactions,
    summary: { openingBalance, closingBalance, totalDeposits, totalCharges }
  }
}

function parseAmount(str?: string): number {
  if (!str) return 0
  return parseFloat(str.replace(/,/g, '')) || 0
}
```

---

### 4. CREAR `/lib/parsers/santander-parser.ts`

```typescript
import { ParseResult, ParsedTransaction } from './bank-statement-parser'

/*
  Santander — Super Nómina / Cuenta de Cheques
  Formato movimiento:
    FECHA         FOLIO   DESCRIPCION                        DEPOSITO  RETIRO   SALDO
    "16-ABR-2024  7902325 ABONO TRANSFERENCIA SPEI...        1,005.02           9,363.04"
    "16-ABR-2024  0095577 CONSUMO LOCAL AJENO...                        78.00   9,285.04"
  
  Año y mes en header: "PERIODO 16-ABR-2024 AL 15-MAY-2024"
*/

const MONTH_MAP: Record = {
  ENE: '01', FEB: '02', MAR: '03', ABR: '04',
  MAY: '05', JUN: '06', JUL: '07', AGO: '08',
  SEP: '09', OCT: '10', NOV: '11', DIC: '12'
}

function santanderDateToISO(dateStr: string): string {
  // "16-ABR-2024" → "2024-04-16"
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  const day = parts[0].padStart(2, '0')
  const month = MONTH_MAP[parts[1].toUpperCase()] ?? '01'
  const year = parts[2]
  return `${year}-${month}-${day}`
}

export function parseSantander(text: string): ParseResult {
  const accountMatch = text.match(/(\d{2}-\d{8,}-\d)/i) 
    ?? text.match(/SUPER NOMINA\s+([\d-]+)/i)
  const accountNumber = accountMatch?.[1] ?? ''

  const periodMatch = text.match(/PERIODO\s+([\d\w-]+)\s+AL\s+([\d\w-]+)/i)
  const period = periodMatch ? `${periodMatch[1]} - ${periodMatch[2]}` : ''

  const openingBalance = parseAmount(text.match(/Saldo inicial\s+[\d,]+\.\d{2}\s*\n.*?([\d,]+\.\d{2})/)?.[1]
    ?? text.match(/\+\s*Saldo inicial\s+([\d,]+\.\d{2})/)?.[1])
  
  // Del resumen de la cuenta de cheques
  const closingBalance = parseAmount(text.match(/=\s*Saldo final\s+([\d,]+\.\d{2})/i)?.[1])
  const totalDeposits = parseAmount(text.match(/\+\s*Depósitos\s+([\d,]+\.\d{2})/i)?.[1])
  const totalCharges = parseAmount(text.match(/-\s*Retiros\s+([\d,]+\.\d{2})/i)?.[1])

  const transactions: ParsedTransaction[] = []

  // Línea: "DD-MES-YYYY  FOLIO  DESCRIPCION  [deposito]  [retiro]  saldo"
  // El folio puede ser 7 dígitos. Deposito y retiro son mutuamente excluyentes.
  const txRegex = /^(\d{2}-(?:ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)-\d{4})\s+(\d{4,10})\s+(.{10,}?)\s{2,}([\d,]+\.\d{2})?\s*([\d,]+\.\d{2})?\s+([\d,]+\.\d{2})\s*$/gim

  let match: RegExpExecArray | null
  while ((match = txRegex.exec(text)) !== null) {
    const isoDate = santanderDateToISO(match[1])
    // match[3] = descripción (puede incluir líneas adicionales)
    let description = match[3].trim().replace(/\s+/g, ' ').slice(0, 100)
    const col4 = match[4] ? parseAmount(match[4]) : null
    const col5 = match[5] ? parseAmount(match[5]) : null
    // match[6] = saldo

    // Santander: DEPOSITO aparece antes que RETIRO en la tabla
    // Si solo col4 tiene valor → depósito
    // Si solo col5 tiene valor → retiro
    // Si col4 y no col5 → depósito; si col5 y no col4 → retiro
    if (col4 !== null && col5 === null) {
      transactions.push({
        date: isoDate, description, amount: col4,
        type: 'income', bank: 'Santander', rawText: match[0]
      })
    } else if (col5 !== null && col4 === null) {
      transactions.push({
        date: isoDate, description, amount: -col5,
        type: 'expense', bank: 'Santander', rawText: match[0]
      })
    } else if (col4 !== null && col5 !== null) {
      // Ambas columnas con valor: asumir col4=deposito, col5=retiro (raro)
      if (col4 > 0) transactions.push({ date: isoDate, description, amount: col4, type: 'income', bank: 'Santander', rawText: match[0] })
      if (col5 > 0) transactions.push({ date: isoDate, description, amount: -col5, type: 'expense', bank: 'Santander', rawText: match[0] })
    }
  }

  return {
    bank: 'Santander',
    accountNumber,
    period,
    transactions,
    summary: { openingBalance, closingBalance, totalDeposits, totalCharges }
  }
}

function parseAmount(str?: string): number {
  if (!str) return 0
  return parseFloat(str.replace(/,/g, '')) || 0
}
```

---

### 5. CREAR `/lib/parsers/banamex-parser.ts`

```typescript
import { ParseResult, ParsedTransaction } from './bank-statement-parser'

/*
  Banamex — MiCuenta
  Formato movimiento:
    FECHA      CONCEPTO                           RETIROS    DEPÓSITOS   SALDO
    "16 FEB    PAGO INTERBANCARIO A NU MEXICO...  10,000.00              13,221.52"
    "23 FEB    PAGO RECIBIDO DE BBVA MEXICO...               2,500.00   10,404.53"
  
  Header: "del 16 de febrero al 15 de marzo del 2026"
*/

const MONTH_MAP: Record = {
  enero: '01', febrero: '02', marzo: '03', abril: '04',
  mayo: '05', junio: '06', julio: '07', agosto: '08',
  septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12'
}

const MONTH_ABR: Record = {
  ENE: '01', FEB: '02', MAR: '03', ABR: '04',
  MAY: '05', JUN: '06', JUL: '07', AGO: '08',
  SEP: '09', OCT: '10', NOV: '11', DIC: '12'
}

export function parseBanamex(text: string): ParseResult {
  const accountMatch = text.match(/Número de cuenta de cheques\s+(\d+)/i)
    ?? text.match(/Número de contrato\s+(\d+)/i)
  const accountNumber = accountMatch?.[1] ?? ''

  const periodMatch = text.match(/del\s+(\d+)\s+de\s+(\w+)\s+al\s+\d+\s+de\s+(\w+)\s+del\s+(\d{4})/i)
  const period = periodMatch ? `${periodMatch[1]} ${periodMatch[2]} - ${periodMatch[3]} ${periodMatch[4]}` : ''
  const year = periodMatch?.[4] ?? text.match(/\d{4}/)?.[0] ?? new Date().getFullYear().toString()

  const openingBalance = parseAmount(text.match(/Saldo anterior\s+En pesos M\.N\.\s+([\d,]+\.\d{2})/i)?.[1])
  const closingBalance = parseAmount(text.match(/Saldo al Corte\s+([\d,]+\.\d{2})/i)?.[1])
  const totalDeposits = parseAmount(text.match(/\(\+\)\s+\d+\s+Depósitos\s+([\d,]+\.\d{2})/i)?.[1])
  const totalCharges = parseAmount(text.match(/\(-\)\s+\d+\s+Retiros\/Otros cargos\s+([\d,]+\.\d{2})/i)?.[1])

  const transactions: ParsedTransaction[] = []

  // Línea: "DD MES  DESCRIPCION LARGA  [retiro]  [deposito]  saldo"
  // mes abreviado en inglés o español: FEB, MAR, etc.
  const txRegex = /^(\d{2})\s+(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)\s+(.{10,100}?)\s{2,}([\d,]+\.\d{2})?\s*([\d,]+\.\d{2})?\s+([\d,]+\.\d{2})\s*$/gim

  let match: RegExpExecArray | null
  while ((match = txRegex.exec(text)) !== null) {
    const day = match[1].padStart(2, '0')
    const monthNum = MONTH_ABR[match[2].toUpperCase()] ?? '01'
    const isoDate = `${year}-${monthNum}-${day}`
    const description = match[3].trim().replace(/\s+/g, ' ').slice(0, 100)
    const col4 = match[4] ? parseAmount(match[4]) : null  // retiro
    const col5 = match[5] ? parseAmount(match[5]) : null  // depósito

    if (col4 !== null && col5 === null) {
      // retiro
      transactions.push({ date: isoDate, description, amount: -col4, type: 'expense', bank: 'Banamex', rawText: match[0] })
    } else if (col5 !== null && col4 === null) {
      // depósito
      transactions.push({ date: isoDate, description, amount: col5, type: 'income', bank: 'Banamex', rawText: match[0] })
    } else if (col4 !== null && col5 !== null) {
      // Determinar por monto: generalmente retiro > 0 y depósito > 0 no ocurre en la misma línea
      // Usar el contexto de la descripción
      const isDeposit = /PAGO RECIBIDO|ABONO|DEPOSITO CANALES|SPIN BY OXXO/i.test(description)
      if (isDeposit) {
        transactions.push({ date: isoDate, description, amount: Math.max(col4, col5), type: 'income', bank: 'Banamex', rawText: match[0] })
      } else {
        transactions.push({ date: isoDate, description, amount: -Math.max(col4, col5), type: 'expense', bank: 'Banamex', rawText: match[0] })
      }
    }
  }

  return {
    bank: 'Banamex',
    accountNumber,
    period,
    transactions,
    summary: { openingBalance, closingBalance, totalDeposits, totalCharges }
  }
}

function parseAmount(str?: string): number {
  if (!str) return 0
  return parseFloat(str.replace(/,/g, '')) || 0
}
```

---

### 6. CREAR `/lib/parsers/bbva-parser.ts`

```typescript
import { ParseResult, ParsedTransaction } from './bank-statement-parser'

/*
  BBVA — Tarjeta de Crédito Oro
  Formato movimiento:
    FECHA OP.   FECHA CARGO   DESCRIPCIÓN                   MONTO
    "23-mar-2026  23-mar-2026  MERPAGO*CARNESMAJOS           + $258.65"
    "13-abr-2026  13-abr-2026  PGO SPEI RECIB/...            - $115,000.00"
  
  También tiene sección de compras a meses con formato diferente.
  Tipo: tarjeta de crédito (todos los cargos son "expense", pagos son "income")
*/

const MONTH_MAP: Record = {
  ene: '01', feb: '02', mar: '03', abr: '04',
  may: '05', jun: '06', jul: '07', ago: '08',
  sep: '09', oct: '10', nov: '11', dic: '12'
}

function bbvaDateToISO(dateStr: string): string {
  // "23-mar-2026" → "2026-03-23"
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  const day = parts[0].padStart(2, '0')
  const month = MONTH_MAP[parts[1].toLowerCase()] ?? '01'
  const year = parts[2]
  return `${year}-${month}-${day}`
}

export function parseBBVA(text: string): ParseResult {
  const accountMatch = text.match(/Número de tarjeta[:\s]+([\d\s]+)/i)
  const accountNumber = (accountMatch?.[1] ?? '').replace(/\s/g, '').slice(-4)
    ? `****${(accountMatch?.[1] ?? '').replace(/\s/g, '').slice(-4)}` : ''

  const periodMatch = text.match(/Periodo[:\s]+([\d\w-]+)\s+al\s+([\d\w-]+)/i)
  const period = periodMatch ? `${periodMatch[1]} - ${periodMatch[2]}` : ''

  const openingBalance = parseAmount(text.match(/Adeudo del periodo anterior\s+\$?([\d,]+\.\d{2})/i)?.[1])
  const closingBalance = parseAmount(text.match(/PAGO PARA NO GENERAR INTERESES[²]?\s+\$?([\d,]+\.\d{2})/i)?.[1])
  const totalDeposits = parseAmount(text.match(/Pagos y abonos\s+-\s+\$?([\d,]+\.\d{2})/i)?.[1])
  const totalCharges = parseAmount(text.match(/Cargos regulares \(no a meses\)\s+\+\s+\$?([\d,]+\.\d{2})/i)?.[1])

  const transactions: ParsedTransaction[] = []

  // Sección principal: CARGOS,COMPRAS Y ABONOS REGULARES
  // Formato: "DD-mes-YYYY  DD-mes-YYYY  DESCRIPCION  + $X,XXX.XX"
  const txRegex = /^(\d{2}-(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)-\d{4})\s+(\d{2}-(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)-\d{4})\s+(.{5,80}?)\s+([+-])\s+\$\s*([\d,]+\.\d{2})/gim

  let match: RegExpExecArray | null
  while ((match = txRegex.exec(text)) !== null) {
    const isoDate = bbvaDateToISO(match[1])  // fecha de operación
    let description = match[3].trim().replace(/\s+/g, ' ').slice(0, 100)
    const sign = match[4]  // "+" o "-"
    const amount = parseAmount(match[5])

    // En TDC BBVA: "+" = cargo al cliente, "-" = abono/pago
    const isPayment = sign === '-' || /PGO SPEI|PAGO/i.test(description)

    transactions.push({
      date: isoDate,
      description,
      amount: isPayment ? amount : -amount,  // pagos son positivos, cargos negativos
      type: isPayment ? 'income' : 'expense',
      bank: 'BBVA',
      rawText: match[0]
    })
  }

  // Sección compras a meses: "DD-mes-YYYY  DESCRIPCION  $X.XX  $X.XX  $X.XX  N de M  0.00%"
  const mesesRegex = /^(\d{2}-(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)-\d{4})\s+(.{5,80}?)\s+\$\s*([\d,]+\.\d{2})\s+\$\s*([\d,]+\.\d{2})\s+\$\s*([\d,]+\.\d{2})\s+(\d+)\s+de\s+(\d+)\s+0\.00%/gim

  while ((match = mesesRegex.exec(text)) !== null) {
    const isoDate = bbvaDateToISO(match[1])
    const description = `[${match[6]}/${match[7]} meses] ${match[2].trim()}`
    const monthlyPayment = parseAmount(match[5])  // "Pago requerido"

    transactions.push({
      date: isoDate,
      description,
      amount: -monthlyPayment,
      type: 'expense',
      bank: 'BBVA',
      rawText: match[0]
    })
  }

  return {
    bank: 'BBVA',
    accountNumber,
    period,
    transactions,
    summary: { openingBalance, closingBalance, totalDeposits, totalCharges }
  }
}

function parseAmount(str?: string): number {
  if (!str) return 0
  return parseFloat(str.replace(/,/g, '')) || 0
}
```

---

### 7. CREAR `/lib/parsers/pdf-extractor.ts`

Extrae texto de un PDF usando pdf-parse (ya disponible en el proyecto o instalarlo).

```typescript
// Wrapper para extraer texto de PDF en el servidor
// Usado desde el API route de importación

export async function extractTextFromPDF(buffer: Buffer): Promise {
  try {
    // Intentar con pdf-parse
    const pdfParse = await import('pdf-parse')
    const data = await pdfParse.default(buffer)
    return data.text
  } catch {
    throw new Error('No se pudo extraer texto del PDF. Verifica que el archivo no esté protegido.')
  }
}
```

---

### 8. CREAR O MODIFICAR `/app/api/import-statement/route.ts`

API route que recibe el PDF, extrae texto y parsea transacciones.

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { extractTextFromPDF } from '@/lib/parsers/pdf-extractor'
import { parseBankStatement, detectBank } from '@/lib/parsers/bank-statement-parser'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })
    }

    if (!file.name.endsWith('.pdf')) {
      return NextResponse.json({ error: 'Solo se aceptan archivos PDF' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const text = await extractTextFromPDF(buffer)
    
    const bank = detectBank(text)
    if (!bank) {
      return NextResponse.json({
        error: 'Banco no reconocido. Bancos soportados: HSBC, Inbursa, Santander, Banamex, BBVA'
      }, { status: 422 })
    }

    const result = parseBankStatement(text)
    if (!result) {
      return NextResponse.json({ error: 'No se pudieron extraer transacciones' }, { status: 422 })
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

### 9. INSTALAR dependencia si no existe

```bash
npm install pdf-parse
npm install --save-dev @types/pdf-parse
```

---

### 10. MODIFICAR la UI de importación existente

Busca el componente actual de importación CSV/manual (probablemente en
`/app/(dashboard)/finanzas/` o similar) y agrega una opción para PDF:

```tsx
// Añadir al componente existente de importación:

const [importing, setImporting] = useState(false)
const [importResult, setImportResult] = useState(null)

async function handlePDFImport(file: File) {
  setImporting(true)
  try {
    const formData = new FormData()
    formData.append('file', file)
    
    const res = await fetch('/api/import-statement', {
      method: 'POST',
      body: formData
    })
    
    const data = await res.json()
    
    if (!res.ok) throw new Error(data.error)
    
    setImportResult(data)
    // Mostrar preview de transacciones antes de confirmar inserción
  } catch (err: any) {
    toast.error(err.message)
  } finally {
    setImporting(false)
  }
}

async function confirmImport(transactions: ParsedTransaction[]) {
  // Insertar en Supabase tabla `transactions`
  const { error } = await supabase
    .from('transactions')
    .insert(transactions.map(tx => ({
      date: tx.date,
      description: tx.description,
      amount: Math.abs(tx.amount),
      type: tx.type,
      category: 'Sin categoría',  // usuario categoriza después
      bank: tx.bank,
      source: 'pdf_import'
    })))
  
  if (error) throw error
  toast.success(`${transactions.length} transacciones importadas`)
}
```

---

## Estructura final de archivos
````

lib/ parsers/ bank-statement-parser.ts ← detector + orquestador hsbc-parser.ts inbursa-parser.ts santander-parser.ts banamex-parser.ts bbva-parser.ts pdf-extractor.ts app/ api/ import-statement/ route.ts

```

---

## Notas de implementación

- Los parsers usan **regex sobre texto plano** extraído del PDF. Los PDFs de
  estados de cuenta mexicanos son digitales (no scaneados), por lo que
  pdf-parse funciona bien.
- Cada parser tiene un **fallback** más permisivo por si el formato exacto varía.
- Las transacciones se marcan con `source: 'pdf_import'` en Supabase para
  poder filtrarlas/auditarlas.
- El flujo es: **subir PDF → preview de transacciones → el usuario confirma → insertar**.
  No insertar automáticamente sin confirmación.
- El campo `category` se deja como `'Sin categoría'` para que el usuario
  categorice después con el sistema existente.
- BBVA en este caso es tarjeta de crédito, no débito: los "cargos" son gastos
  del usuario y los "pagos" son abonos a la deuda.
```