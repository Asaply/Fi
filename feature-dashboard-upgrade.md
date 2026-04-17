feature-dashboard-upgrade.md
# Feature: Dashboard upgrade completo

## Stack
Next.js 15, App Router, React 19, Supabase, Tailwind, puerto 3005.

Lee todos los archivos relevantes antes de cambiar cualquier cosa:
- src/app/finanzas/page.js
- src/app/dashboard/page.js (o donde esté el dashboard principal)
- src/app/trading/page.js
- src/app/portfolio-health/page.js (o la ruta equivalente)
- src/components/ (cualquier componente de gráficas o resumen)

---

## 1. FILTRO TEMPORAL EN FINANZAS, TRADING Y PORTFOLIO HEALTH

En cada una de estas tres secciones agregar un selector de período visible
en la parte superior de la página, junto a los botones existentes:

Opciones:
- Este mes
- Últimos 3 meses
- Últimos 6 meses
- Este año

Comportamiento:
- Al cambiar el período, todos los datos de la página se filtran: totales,
  tabla de transacciones/operaciones, gráficas.
- El filtro por defecto es "Este mes".
- En Finanzas filtrar por columna `date` de `transactions`.
- En Trading filtrar por columna de fecha de `trading_operations`.
- En Portfolio Health el filtro aplica al rendimiento (P&L) calculado,
  no a los activos en sí (los activos siempre se muestran todos).

---

## 2. INGRESOS DE TRADING SUMADOS A TOTAL INGRESOS EN FINANZAS

En la sección Finanzas, el card "TOTAL INGRESOS" debe incluir las ganancias
netas positivas del período seleccionado en Trading.

Lógica:
```js
// Traer P&L neto de trading del período
const { data: tradingOps } = await supabase
  .from('trading_operations')
  .select('resultado') // o el campo que tenga la ganancia/pérdida por operación
  .eq('user_id', user.id)
  .gte('fecha', startDate)

const tradingIncome = tradingOps
  .filter(op => op.resultado > 0)
  .reduce((sum, op) => sum + op.resultado, 0)

totalIngresos = ingresosTransactions + tradingIncome
```
$7,790.00 transacciones + $1,200.00 trading

---

## 3. PORTFOLIO HEALTH → CONECTAR A "INVERSIONES" EN TODA LA APP

El valor total del portafolio (suma de `current_value` de `portfolio_assets`)
debe alimentar el card "INVERSIONES" en Finanzas que actualmente muestra $0.00.

En Finanzas, el card INVERSIONES debe mostrar:
- Valor actual total del portafolio
- P&L total en verde/rojo debajo

Traer el dato así:
```js
const { data: assets } = await supabase
  .from('portfolio_assets')
  .select('current_value, cost_basis')
  .eq('user_id', user.id)

const totalPortfolioValue = assets.reduce((s, a) => s + (a.current_value || 0), 0)
const totalCostBasis = assets.reduce((s, a) => s + (a.cost_basis || 0), 0)
const portfolioPnL = totalPortfolioValue - totalCostBasis
```

---

## 4. GASTOS POR CATEGORÍA — REDISEÑO + GRÁFICA DE DONA CON TOOLTIP

Rediseñar la sección "GASTOS POR CATEGORÍA" para que tenga el mismo estilo
visual que "RESUMEN PORTFOLIO HEALTH" (card oscuro, bordes redondeados,
layout con título grande).

Usar una gráfica de dona (Recharts `PieChart` con `innerRadius`) que muestre
cada categoría de egreso como segmento.

Las categorías deben venir del campo `categoria` de la tabla `transactions`
donde `tipo = 'egreso'`. Si `categoria` es null, agrupar como "Otros".

Categorías esperadas: Inversiones, Restaurantes, Transporte, Comida,
Transferencias, Suscripciones, Otros. Usar cualquier valor distinto que
exista en la tabla.

**Tooltip al hacer hover sobre cada segmento:**
```jsx
<Tooltip
  formatter={(value, name) => [
    `$${value.toFixed(2)} (${((value / totalEgresos) * 100).toFixed(1)}%)`,
    name
  ]}
/>
```

Mostrar debajo de la dona una leyenda con:
- Color del segmento
- Nombre de categoría
- Monto
- Porcentaje

Layout del card:
[Título: GASTOS POR CATEGORÍA]     [Total: $11,976.76]
[Dona a la izquierda]  [Leyenda a la derecha con lista de categorías]

---

## 5. FILTRO TEMPORAL EN EL DASHBOARD PRINCIPAL

En `/dashboard`, agregar el mismo selector de período (Este mes / 3 meses /
6 meses / Año) que afecte todos los widgets/cards del dashboard:
- Resumen Finanzas
- Resumen Trading
- Resumen Portfolio Health
- Gastos por categoría

---

## Notas generales
- Mantener el dark theme existente en todos los componentes nuevos.
- Usar Recharts para todas las gráficas (ya está instalado).
- Si algún campo de fecha o resultado en `trading_operations` tiene nombre
  diferente al usado aquí, leer el schema de Supabase primero y ajustar.
- No romper funcionalidad existente.

Mostrar debajo del total un desglose pequeño: