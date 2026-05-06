# bbva-credit-card-parser.md

## Objetivo
Implementar un parser para estados de cuenta de tarjeta de crédito BBVA México (PDF), que extraiga y normalice todas las transacciones al esquema de `transactions` de Supabase que ya usa FNCE.

---

## Contexto del formato BBVA

El PDF tiene estas secciones en orden:

1. **Encabezado / resumen del periodo** — datos de la tarjeta y montos de pago
2. **Compras y cargos diferidos a meses sin intereses (MSI)** — tabla separada con saldo pendiente y pagos requeridos
3. **Cargos, compras y abonos regulares (NO A MESES)** — lista principal de movimientos
4. **Tarjeta digital `***8950`** — al final de la sección regular, mismas columnas pero con sufijo en descripción

---

## Patrones reales extraídos del PDF de ejemplo

### Encabezado
```
Periodo: 23-mar-2026 al 22-abr-2026
Fecha de corte: 22-abr-2026
Fecha límite de pago: martes, 12-may-2026
Pago para no generar intereses: $94,805.72
Pago mínimo: $6,162.37
Límite de crédito: $235,000.00
Saldo deudor total: $104,111.62
Crédito disponible: $130,888.38
```

### Transacciones regulares — casos a manejar

**Compra normal MXN:**
```
23-mar-2026  23-mar-2026  MERPAGO*CARNESMAJOS  + $258.65
```

**Pago SPEI (monto negativo):**
```
13-abr-2026  13-abr-2026  PGO SPEI RECIB/0187338163  - $115,000.00
```

**Compra en USD con tipo de cambio embedido en línea siguiente:**
```
28-mar-2026  30-mar-2026  WM SUPERCENTER N1015  + $254.02
                          USD $13.99 TIPO DE CAMBIO $18.16
```

**Compra en USD con MXP explícito:**
```
24-mar-2026  26-mar-2026  SMILE INTIMATES ; Tarjeta Digital ***8950  + $22,597.15
                          USD $1264.75 TIPO DE CAMBIO $17.87
```

**Devolución / abono parcial:**
```
08-abr-2026  09-abr-2026  EBANX 1*TEMU2 ; Tarjeta Digital ***8950  - $1,717.76
```

**Compra que origina MSI (aparece en ambas secciones — ver regla de deduplicación):**
```
23-mar-2026  23-mar-2026  FAR GUAD 1725 A 03 MESES S/I  + $836.56
08-abr-2026  09-abr-2026  FAR GUAD 1725 A 03 MESES S/I  + $754.76
```

**Mensualidades de MSI reflejadas en cargos regulares al corte:**
```
22-abr-2026  23-abr-2026  04 DE 06 MERPAGO*MPARRAL1  + $2,707.00
22-abr-2026  23-abr-2026  01 DE 03 FAR GUAD 1725  + $279.00
```

### Sección MSI — campos disponibles
```
Fecha op. | Descripción | Monto original | Saldo pendiente | Pago requerido | Núm. pago | Tasa
03-ene-2026 | MERPAGO*MPARRAL1 | $16,241.99 | $5,413.99 | $2,707.00 | 4 de 6 | 0.00%
15-ene-2026 | QUALITAS POLIZAS | $8,503.59 | $2,831.59 | $1,418.00 | 4 de 6 | 0.00%
22-mar-2026 | FAR GUAD 1725 | $836.56 | $557.56 | $279.00 | 1 de 3 | 0.00%
08-abr-2026 | FAR GUAD 1725 | $754.76 | $502.76 | $252.00 | 1 de 3 | 0.00%
```

---

## Reglas de clasificación (CRÍTICAS)

### 1. Tipo de transacción
| Condición | `tipo` asignado |
|---|---|
| Monto negativo + descripción contiene `SPEI` o `PGO SPEI` | `pago` |
| Monto negativo + descripción contiene `DEVOLUCION` o es abono de merchant | `devolucion` |
| Descripción contiene `INTERES` | `interes` |
| Descripción contiene `COMISION` o `ANUALIDAD` | `comision` |
| Descripción contiene `X DE Y` (ej. `04 DE 06`) al inicio | `mensualidad_msi` |
| Descripción contiene `A 0X MESES S/I` | `compra_msi_origen` — ver deduplicación |
| Resto | `compra` |

### 2. Deduplicación de MSI
Las compras que generan MSI aparecen DOS veces en el PDF:
- Una vez en la sección MSI (con saldo pendiente y pago requerido)
- Una vez en la sección regular con descripción `FAR GUAD 1725 A 03 MESES S/I`

**Regla:** Si una transacción de la sección regular tiene descripción que termina en `A 0X MESES S/I` y existe una entrada en MSI con la misma descripción base y misma fecha operación → marcar como `compra_msi_origen` y NO duplicar como `compra` independiente.

### 3. Moneda y tipo de cambio
- Si la línea siguiente a la descripción contiene `USD $X TIPO DE CAMBIO $Y` → registrar:
  - `monto_mxn`: el monto ya convertido que aparece en la columna principal
  - `monto_original`: el monto en USD
  - `moneda_original`: `USD`
  - `tipo_cambio`: el valor Y
- Si dice `MXP $X TIPO DE CAMBIO $1.00` → moneda base MXN, no hay conversión real

### 4. Tarjeta digital
Si la descripción contiene `; Tarjeta Digital ***8950` → extraer nombre limpio sin el sufijo y marcar `tarjeta_digital: true`.

### 5. Pagos SPEI
La descripción `PGO SPEI RECIB/0187338163` incluye detalles en líneas siguientes:
```
IVA: $0.00  Interes: $0.00  Comisiones: $0.00  Capital: $115,000.00
```
→ Extraer `capital`, `interes` y `comision` del pago si están disponibles.

---

## Estructura de datos a generar

### `credit_card_statement` (metadata del periodo)
```typescript
{
  banco: 'BBVA',
  tipo_producto: 'TDC',
  numero_tarjeta_ultimos4: '5036',
  titular: string,
  periodo_inicio: Date,
  periodo_fin: Date,         // fecha de corte
  fecha_limite_pago: Date,
  pago_sin_intereses: number,
  pago_minimo: number,
  limite_credito: number,
  saldo_deudor_total: number,
  credito_disponible: number,
  adeudo_periodo_anterior: number,
  total_cargos_regulares: number,
  total_cargos_msi_capital: number,
  total_pagos: number,
}
```

### `credit_card_transaction` (cada movimiento)
```typescript
{
  // Identificación
  id: string,                        // hash(banco + numero_tarjeta + fecha_operacion + descripcion + monto)
  statement_id: string,              // FK al estado de cuenta

  // Fechas
  fecha_operacion: Date,
  fecha_cargo: Date,

  // Descripción
  descripcion_raw: string,           // texto exacto del PDF
  descripcion_limpia: string,        // sin sufijos de tarjeta digital, sin "A 03 MESES S/I"
  tarjeta_digital: boolean,

  // Clasificación
  tipo: 'compra' | 'pago' | 'devolucion' | 'interes' | 'comision' | 'mensualidad_msi' | 'compra_msi_origen',
  categoria: string | null,          // auto-clasificar con lógica existente de FNCE

  // Montos
  monto_mxn: number,                 // siempre en MXN, negativo si es abono/pago
  monto_original: number | null,     // si es moneda extranjera
  moneda_original: 'USD' | 'EUR' | 'MXN' | null,
  tipo_cambio: number | null,

  // MSI (solo si tipo === 'compra_msi_origen' o 'mensualidad_msi')
  msi_plazo_total: number | null,    // ej. 6
  msi_num_pago: number | null,       // ej. 4
  msi_monto_original: number | null,
  msi_saldo_pendiente: number | null,
  msi_pago_requerido: number | null,

  // Pago SPEI (solo si tipo === 'pago')
  spei_referencia: string | null,
  spei_capital: number | null,
  spei_interes: number | null,
  spei_comision: number | null,
}
```

### Mapeo a `transactions` de Supabase
Al insertar en la tabla existente de FNCE:
```typescript
{
  id: credit_card_transaction.id,
  user_id: current_user_id,
  date: fecha_operacion,
  description: descripcion_limpia,
  amount: Math.abs(monto_mxn),
  type: tipo === 'pago' || tipo === 'devolucion' ? 'income' : 'expense',
  category: categoria ?? categorizarConLogicaFNCE(descripcion_limpia),
  source: 'bbva_tdc_pdf',
  raw_description: descripcion_raw,
  metadata: {
    banco: 'BBVA',
    tipo_transaccion_tdc: tipo,
    tarjeta_digital,
    moneda_original,
    tipo_cambio,
    msi: tipo.includes('msi') ? { ...campos_msi } : null,
  }
}
```

---

## Categorías sugeridas para auto-clasificar (basadas en merchants del estado)

```typescript
const BBVA_CATEGORIA_MAP: Record<string, string> = {
  // Supermercados
  'ALSUPERPLUS': 'supermercado',
  'WAL MART': 'supermercado',
  'WALMART': 'supermercado',
  'ABARR': 'supermercado',
  'SUPERETTE': 'supermercado',
  'ALSUPER': 'supermercado',
  'WM SUPERCENTER': 'supermercado',

  // Gasolina
  'GASOL': 'gasolina',
  'GAS CARVEL': 'gasolina',
  'MI GASOLINA': 'gasolina',

  // Restaurantes / comida
  'DELIPOLLO': 'restaurante',
  'BURGER KING': 'restaurante',
  'MCDONALD': 'restaurante',
  'WENDYS': 'restaurante',
  'PIZZERIA': 'restaurante',
  'TORTILLERIA': 'restaurante',
  'BURRITOS': 'restaurante',
  'TARAHUMARA': 'restaurante',
  'POPEYE': 'restaurante',
  'LAS GORDITAS': 'restaurante',
  'MONKEY EXPRESS': 'restaurante',
  'PALET Y NEVERIA': 'restaurante',
  'TAMTAMALES': 'restaurante',

  // Conveniencia
  'OXXO': 'conveniencia',
  'CIRCLE K': 'conveniencia',

  // Carnicerías / abarrotes
  'MERPAGO*CARNESMAJOS': 'abarrotes',
  'CARNICE': 'abarrotes',
  'PAG*CARN': 'abarrotes',

  // CFE (luz)
  'CFEDC': 'servicios_publicos',

  // Streaming / suscripciones
  'NETFLIX': 'entretenimiento',
  'APPLE.COM': 'suscripcion',
  'TELMEX': 'telecomunicaciones',
  'TELCEL': 'telecomunicaciones',

  // Seguros
  'QUALITAS': 'seguro',
  'ALLIANZ': 'seguro',
  'BBVA SEGUROS': 'seguro',

  // Casetas
  'CASETAS': 'transporte',

  // Farmacia
  'FAR GUAD': 'farmacia',

  // Ropa / moda
  'VICTORIA S SECRET': 'ropa',
  'SMILE INTIMATES': 'ropa',
  'BURLINGTON': 'ropa',
  'MISS ACC': 'ropa',

  // Marketplace
  'MERPAGO': 'marketplace',
  'AMAZON': 'marketplace',
  'TEMU': 'marketplace',

  // Entretenimiento
  'WHISKEY PRODUCCIONES': 'entretenimiento',

  // Pagos / transferencias
  'PGO SPEI': 'pago_tarjeta',

  // Veterinaria
  'VETERINARIA': 'mascotas',
}
```

---

## Archivo a crear

**`src/lib/parsers/bbva-tdc-parser.ts`**

Debe exportar:

```typescript
// Parsea el texto extraído del PDF y devuelve datos estructurados
export async function parseBBVATDCStatement(pdfText: string): Promise<{
  statement: CreditCardStatement
  transactions: CreditCardTransaction[]
  msi_items: MSIItem[]
  errors: string[]   // líneas que no se pudieron parsear
}>

// Convierte CreditCardTransaction[] al formato transactions de Supabase
export function mapToFNCETransactions(
  transactions: CreditCardTransaction[],
  userId: string,
  statementId: string
): FNCETransaction[]
```

---

## Reglas de implementación

1. **No modificar** la tabla `transactions` existente — solo agregar al campo `metadata` (jsonb) lo que no tenga columna propia.
2. **Idempotencia obligatoria**: el `id` de cada transacción debe ser un hash determinista. Usar `crypto.createHash('sha256')` con `banco + tarjeta_ultimos4 + fecha_operacion + descripcion_raw + monto_mxn`. Si el registro ya existe en Supabase → skip (no update, no error).
3. **No romper el flujo existente de importación**: el parser debe poder llamarse desde el componente de importación CSV/PDF que ya existe, siguiendo el mismo patrón de retorno.
4. **Solo lógica de parsing y mapeo** — sin cambios a UI, routing ni queries de Supabase existentes.
5. **Extraer texto del PDF** usando la librería que ya esté instalada en el proyecto (verificar `package.json`). Si no hay ninguna, usar `pdf-parse` (ya compatible con Next.js).
6. **Manejar el caso multi-página**: las transacciones están distribuidas en páginas 3–7 del PDF; el parser debe concatenar el texto completo antes de procesar.

---

## Comando para ejecutar en Claude Code

```bash
cd ~/Documents/FNCE.md && claude "Read CONTEXT.md and bbva-credit-card-parser.md, then implement all the code described. Do not modify any existing files except to call the new parser from the existing import flow if a natural integration point exists."
```
