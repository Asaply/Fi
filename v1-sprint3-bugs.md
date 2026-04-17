# v1-sprint3-bugs.md

## Objetivo
Corregir los 3 bugs críticos que afectan la confiabilidad de los datos: Total Egresos $0, Win Rate inconsistente, y formato de moneda mezclado.

---

## Bug 1: Total Egresos $0.00 en Finanzas

### Diagnóstico
El card "Total Egresos" muestra $0.00 aunque hay transacciones registradas. La causa probable es que el query filtra por `tipo === 'Egreso'` pero los datos en Supabase tienen una capitalización o valor distinto (ej: 'egreso', 'EGRESO', 'egresos').

### Fix
En el archivo de la página de Finanzas (probablemente `src/app/finanzas/page.tsx` o el hook de datos), buscar el cálculo de egresos y aplicar normalización:

```typescript
// ANTES (posible causa del bug)
const totalEgresos = transacciones
  .filter(t => t.tipo === 'Egreso')
  .reduce((sum, t) => sum + t.monto, 0)

// DESPUÉS — normalizar capitalización
const totalEgresos = transacciones
  .filter(t => t.tipo?.toLowerCase().trim() === 'egreso')
  .reduce((sum, t) => sum + (Number(t.monto) || 0), 0)
```

También verificar que el query de Supabase no tenga un filtro incorrecto. Si hay un `.eq('tipo', 'Egreso')` en el query, cambiarlo por `.ilike('tipo', 'egreso')` para ser case-insensitive.

### Verificación
Agregar un console.log temporal para ver los valores:
```typescript
console.log('Tipos únicos:', [...new Set(transacciones.map(t => t.tipo))])
```
Esto muestra exactamente qué strings llegan de Supabase.

---

## Bug 2: Win Rate inconsistente en Trading

### Diagnóstico
Win Rate muestra 100% con "W:1 L:0" pero puede no reflejar todos los trades correctamente cuando hay trades con P&L = 0 o trades con resultado null.

### Fix
En el componente de Trading, corregir el cálculo de Win Rate:

```typescript
// Obtener solo trades cerrados
const tradesCerrados = trades.filter(t => 
  t.estado?.toLowerCase() === 'cerrado' || t.estado?.toLowerCase() === 'closed'
)

// Win = P&L estrictamente positivo
const wins = tradesCerrados.filter(t => Number(t.pl_realizado) > 0)
const losses = tradesCerrados.filter(t => Number(t.pl_realizado) < 0)
// Trades con P&L = 0 son "breakeven", no cuentan como win ni loss

const winRate = tradesCerrados.length > 0 
  ? (wins.length / tradesCerrados.length) * 100 
  : 0

// Mostrar en UI
// W: {wins.length}  L: {losses.length}  BE: {tradesCerrados.length - wins.length - losses.length}
```

Si la columna se llama distinto (ej: `resultado`, `ganancia`, `pnl`), ajustar el nombre del campo.

---

## Bug 3: Formato de moneda inconsistente

### Diagnóstico
La app mezcla "USD" (Portfolio Health usa USD) con "$" implícito en Finanzas y Trading. Hay que definir una convención y aplicarla en toda la app.

### Decisión
**Finanzas y Trading → MXN (pesos mexicanos)**  
**Portfolio Health → USD (dólares, porque los activos cotizan en USD)**

### Fix — crear helper de formato

Crear `src/lib/formatCurrency.ts`:

```typescript
export function formatMXN(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
  // Resultado: "$155,000.00"
}

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
  // Resultado: "$2,239.63"
}

export function formatPercent(value: number, decimals = 1): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

export function formatCompact(amount: number): string {
  // Para números grandes en cards pequeñas: $155k, $1.2M
  if (Math.abs(amount) >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`
  if (Math.abs(amount) >= 1_000) return `$${(amount / 1_000).toFixed(1)}k`
  return `$${amount.toFixed(2)}`
}
```

### Aplicar el helper
Buscar todos los lugares donde se hace `$${numero}` o `.toFixed(2)` directamente en el JSX y reemplazar con `formatMXN(numero)` o `formatUSD(numero)` según corresponda.

Secciones a auditar:
- `src/app/finanzas/` → usar `formatMXN`
- `src/app/trading/` → usar `formatMXN`
- `src/app/portfolio/` → ya usa USD, verificar que sea consistente con `formatUSD`
- `src/app/dashboard/` (nuevo) → usar el formato de cada sección

---

## Archivos a modificar
- `src/app/finanzas/page.tsx` — fix bug egresos
- `src/app/trading/page.tsx` — fix win rate
- `src/lib/formatCurrency.ts` — crear nuevo
- Todos los componentes que muestran montos — usar helpers
