# Fix Banamex Parser — Código Exacto Probado

Read CONTEXT.md then implement ONLY the changes below. No interpretes, copia exactamente.

## Problema
El parser de Banamex devuelve 3 transacciones todas de "Cargo para recarga T" porque el código actual no implementa el algoritmo correcto.

## Regla de oro (100% verificada contra el PDF real)

El texto extraído de Banamex tiene:
- `'2,500.00 '` con espacio al final → DEPÓSITO (ingreso)  
- `'2,500.00'` sin espacio → RETIRO (egreso)

Esta es la ÚNICA distinción necesaria. No se necesitan keywords ni comparar saldos.

## REEMPLAZAR COMPLETO: `/lib/parsers/banamex-parser.ts`

```typescript
import { ParseResult, ParsedTransaction } from './bank-statement-parser'
import { categorize } from './categories'

const MONTHS = new Set(['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'])

const MONTH_MAP: Record<string, string> = {
  ENE:'01', FEB:'02', MAR:'03', ABR:'04', MAY:'05', JUN:'06',
  JUL:'07', AGO:'08', SEP:'09', OCT:'10', NOV:'11', DIC:'12'
}

// Líneas de ruido — headers de página inyectados entre transacciones
const NOISE_EXACT = new Set([
  'FECHA','CONCEPTO','RETIROS','DEPÓSITOS','SALDO','SALDO ANTERIOR',
  'Centro de Atención Telefónica',
  'Ciudad de México: 55 1226 2639',
  "Resto del país: 800 021 2345",
  'SUC. 4109 PACHECO, CHIHUAHUA,',
  'AVENIDA CARLOS PACHECO VILLA SN',
  'POPULAR', 'POPULAR ',
  'DEREK ARMANDO VALENZUELA MACIAS',
  'Detalle de Operaciones  En pesos Moneda Nacional',
  '0003909', '000190.B26INDA020.AR.0313.01',
  'Resumen Operaciones Tarjeta',
])

const NOISE_PREFIXES = [
  'Página ','TARJETA ','TOTAL','AHORRO FACIL','**La GAT','MiCuenta',
  'Resumen','Número de contrato','Saldo anterior','(+)','(-)',
  'Intereses','Saldo al','En el período','Saldo promedio','Días del',
  'Tasa de interés','Impuesto','* Expresada','Estado de Cuenta',
  'Período del','Número de sucursal','Número de cuenta',
  'Número de Tarjeta','CLABE','AHORRO','Periodo','GAT Nominal',
  'GAT Real','Número de Contrato','Número de cliente','RFC ',
]

// Fecha en una línea: "16 FEB" o "02 MAR"
const DATE_ONE_LINE = /^(\d{1,2})\s+(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)$/i
// Solo número: "16" (el mes viene en la siguiente línea)
const DATE_NUM_ONLY = /^(\d{1,2})$/
// Línea de monto: dígitos + comas + punto decimal + espacio opcional al final
// El espacio al final distingue depósito (con espacio) de retiro (sin espacio)
const AMOUNT_LINE   = /^([\d,]+\.\d{2})( ?)$/

function isNoise(line: string): boolean {
  const s = line.trim()
  if (!s) return true
  if (NOISE_EXACT.has(s) || NOISE_EXACT.has(line)) return true
  if (NOISE_PREFIXES.some(p => s.startsWith(p))) return true
  if (/^Página\s+\d+/.test(s)) return true
  // Líneas de referencia técnica de tarjeta: "20260218 75064956047001025192098 683519"
  if (/^\d{8}\s+\d{10,}/.test(s)) return true
  // Strings numéricos largos (CLABE, números de cuenta)
  if (/^\d{10,}$/.test(s)) return true
  // Códigos de referencia como "000190.B26INDA020.AR.0313.01"
  if (/^\d{6}\.[A-Z0-9.]+$/.test(s)) return true
  // Líneas de solo referencia técnica como "9000/0012" o "9001/0011"
  if (/^\d{4}\/\d{4}$/.test(s)) return true
  return false
}

function parseAmt(s: string): number {
  return parseFloat(s.replace(/,/g, '')) || 0
}

export function parseBanamex(text: string): ParseResult {
  // ── Metadatos ─────────────────────────────────────────────────────────
  const accountMatch = text.match(/Número de cuenta de cheques\s+(\d+)/i)
    ?? text.match(/Número de contrato\s+(\d+)/i)
  const accountNumber = accountMatch?.[1] ?? ''

  const yearMatch = text.match(/del\s+\d+\s+de\s+\w+\s+al\s+\d+\s+de\s+\w+\s+del\s+(\d{4})/i)
  const year = yearMatch?.[1] ?? String(new Date().getFullYear())

  const periodFull = text.match(/Período del\s+(.+?)(?:\n|$)/i)?.[1]?.trim() ?? ''

  const openingBalance = parseAmt(
    text.match(/Saldo anterior En pesos M\.N\.\s+([\d,]+\.\d{2})/i)?.[1] ?? '0'
  )
  const closingBalance = parseAmt(
    text.match(/Saldo al Corte\s+([\d,]+\.\d{2})/i)?.[1] ?? '0'
  )
  const totalDeposits = parseAmt(
    text.match(/\(\+\)\s+\d+\s+Depósitos\s+([\d,]+\.\d{2})/i)?.[1] ?? '0'
  )
  const totalCharges = parseAmt(
    text.match(/\(-\)\s+\d+\s+Retiros\/Otros cargos\s+([\d,]+\.\d{2})/i)?.[1] ?? '0'
  )

  // ── Extraer TODAS las secciones de detalle (una por página) ───────────
  const allLines: string[] = []
  let searchFrom = 0
  while (true) {
    const idx = text.indexOf('Detalle de Operaciones', searchFrom)
    if (idx < 0) break
    const section = text.slice(idx)
    allLines.push(...section.split('\n'))
    searchFrom = idx + 1
  }

  // Filtrar ruido
  const lines = allLines.filter(line => !isNoise(line))

  // ── Máquina de estados ────────────────────────────────────────────────
  const transactions: ParsedTransaction[] = []
  let currentDate = ''
  let currentLines: string[] = []

  function flushTransaction(): void {
    if (!currentDate || currentLines.length === 0) return

    // Encontrar los índices de todas las líneas que son montos
    const amountIdxs: number[] = []
    for (let j = 0; j < currentLines.length; j++) {
      if (AMOUNT_LINE.test(currentLines[j])) {
        amountIdxs.push(j)
      }
    }

    // Necesitamos al menos 2: [monto, saldo]
    if (amountIdxs.length < 2) return

    // El monto es el penúltimo número, el saldo es el último
    const montoIdx = amountIdxs[amountIdxs.length - 2]
    const montoLine = currentLines[montoIdx]
    const montoMatch = AMOUNT_LINE.exec(montoLine)
    if (!montoMatch) return

    // *** LA REGLA CLAVE: trailing space = depósito ***
    const isDeposit = montoMatch[2] === ' '
    const amount = parseAmt(montoMatch[1])

    if (amount === 0) return

    // Descripción = todas las líneas antes del monto, limpiadas
    const descLines = currentLines
      .slice(0, montoIdx)
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .filter(l => !/^\d{8}/.test(l))      // quitar referencias de tarjeta
      .filter(l => !/^\d{10,}/.test(l))    // quitar números largos
      .filter(l => !/^\d{4}\/\d{4}$/.test(l)) // quitar "9000/0012"
      .filter(l => !l.startsWith('RASTREO'))   // quitar líneas de rastreo
      .filter(l => !l.startsWith('CTA.BENEFICIARIO')) // quitar datos técnicos

    const description = descLines
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 150)

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

    // Caso 1: fecha en una línea "16 FEB" o "02 MAR"
    const oneLineMatch = DATE_ONE_LINE.exec(s)
    if (oneLineMatch) {
      flushTransaction()
      const day = oneLineMatch[1].padStart(2, '0')
      const mon = oneLineMatch[2].toUpperCase()
      currentDate = `${year}-${MONTH_MAP[mon]}-${day}`
      currentLines = []
      i++
      continue
    }

    // Caso 2: día solo "16", mes en siguiente línea "FEB"
    const numOnlyMatch = DATE_NUM_ONLY.exec(s)
    const nextLineStr = i + 1 < lines.length ? lines[i + 1].trim().toUpperCase() : ''
    if (numOnlyMatch && MONTHS.has(nextLineStr)) {
      flushTransaction()
      const day = numOnlyMatch[1].padStart(2, '0')
      currentDate = `${year}-${MONTH_MAP[nextLineStr]}-${day}`
      currentLines = []
      i += 2  // saltar día Y mes
      continue
    }

    // Acumular línea en buffer de transacción actual
    if (currentDate) {
      currentLines.push(line)
    }
    i++
  }
  // Flush última transacción
  flushTransaction()

  return {
    bank: 'Banamex',
    accountNumber,
    period: periodFull,
    transactions,
    summary: {
      openingBalance,
      closingBalance,
      totalDeposits,
      totalCharges,
    },
  }
}
```

## Resultado esperado

Para `Estado_de_cuenta.pdf` (Derek Armando Valenzuela, feb-mar 2026):
- **34 transacciones** totales
- **9 ingresos**: $12,340.00 total
- **25 egresos**: $34,610.99 total

Los 3 "Cargo para recarga T" que aparecían antes SÍ son correctos como egresos — eran los únicos que el parser anterior lograba parsear porque son transacciones de línea única simple. El problema era que ignoraba todas las demás.

## TAMBIÉN VERIFICAR: que `categories.ts` exporte la función `categorize`

Si no existe `/lib/parsers/categories.ts`, crear con este contenido mínimo:

```typescript
const INCOME_KEYWORDS = /PAGO RECIBIDO|ABONO|DEPOSITO CANALES|SPIN BY OXXO|NÓMINA|NOMINA|INTERESES GANADOS/i
const TRANSFER_OUT = /PAGO INTERBANCARIO A|TRANSFERENCIA A/i

export function categorize(description: string, type: 'income' | 'expense'): string {
  if (type === 'income') {
    if (/NOMINA|NÓMINA|SUELDO|SALARIO/i.test(description)) return 'Salario'
    if (/INTERESES/i.test(description)) return 'Intereses'
    if (/DEPOSITO CANALES/i.test(description)) return 'Depósito'
    return 'Transferencias recibidas'
  }
  // Egresos
  if (/OXXO|SEVEN|ALSUPER|COSTCO|WALMART|SORIANA|CHEDRAUI|ABARR/i.test(description)) return 'Supermercado'
  if (/RESTAURANT|DELIPOLLO|BURGER|MCDONALD|PIZZA|CAFET|CAFE|TACO|POLLO/i.test(description)) return 'Restaurantes'
  if (/GASOL|GAS ESTAC|GASOLINA|PEMEX|COMBUSTIBLE/i.test(description)) return 'Gasolina'
  if (/CASETAS|AUTOPISTA/i.test(description)) return 'Casetas'
  if (/UBER|DIDI|CABIFY/i.test(description)) return 'Transporte'
  if (/NETFLIX|SPOTIFY|APPLE\.COM|AMAZON PRIME|DISNEY/i.test(description)) return 'Suscripciones'
  if (/TELCEL|TELMEX|TOTALPLAY|IZZI|MEGACABLE|RECARGA/i.test(description)) return 'Telefonía'
  if (/CFE|LUZ Y FUERZA/i.test(description)) return 'Servicios del hogar'
  if (/FARMACIA|FARMA|SIMILAR|BENAVIDES|MEDICA|HOSPITAL/i.test(description)) return 'Salud'
  if (/AMAZON|MERCADOPAGO|MERPAGO|PAYPAL|TEMU/i.test(description)) return 'Compras online'
  if (/COMISION|ADMINISTRACION RENTA|IVA COBRADO/i.test(description)) return 'Comisiones bancarias'
  if (/RETIRO CAJERO|CAJERO|ATM|DISP ATM/i.test(description)) return 'Retiro efectivo'
  if (TRANSFER_OUT.test(description)) return 'Transferencias enviadas'
  return 'Otros gastos'
}
```
