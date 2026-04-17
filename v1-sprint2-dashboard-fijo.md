# v1-sprint2-dashboard-fijo.md

## Objetivo
Eliminar react-grid-layout y reemplazar los dashboards personalizables por un único Dashboard fijo en `/dashboard`. Layout con CSS Grid nativo, sin drag, sin resize, 100% funcional.

---

## Paso 1: Eliminar react-grid-layout

Desinstalar el paquete:
```bash
npm uninstall react-grid-layout
```

Eliminar o mover a `/src/_deprecated/`:
- Todos los archivos de widgets (`RevenueWidget`, `ExpensesWidget`, `SummaryWidget`, etc.)
- Archivos CSS de widgets (`Widgets.css`, cualquier archivo con clases `fnce-*`)
- El componente de dashboard personalizable

---

## Paso 2: Crear ruta `/dashboard`

Crear `src/app/dashboard/page.tsx`.

El dashboard fijo tiene 3 secciones en un grid de 2 columnas:

```
┌─────────────────────┬─────────────────────┐
│   Resumen Finanzas  │  Resumen Trading     │
│   (columna 1)       │  (columna 2)         │
├─────────────────────┴─────────────────────┤
│         Resumen Portfolio Health           │
│         (ancho completo)                   │
└───────────────────────────────────────────┘
```

### Sección 1: Resumen Finanzas
Datos del mes actual de Supabase. Mostrar:
- Total Ingresos del mes (verde)
- Total Egresos del mes (rojo)
- Ganancia Neta = Ingresos - Egresos (color dinámico)
- Mini gráfica de barras últimos 3 meses (Recharts BarChart, altura 120px)

### Sección 2: Resumen Trading
Datos de Supabase. Mostrar:
- P&L Total realizado (verde/rojo)
- Win Rate % 
- Número de trades del mes
- Mejor trade del mes (ticker + P&L)

### Sección 3: Resumen Portfolio Health
Datos de Supabase + precios actuales. Mostrar:
- Valor total del portafolio
- P&L total en $ y %
- Distribución por categoría (mini donut chart, altura 140px, Recharts PieChart)
- Top 3 activos por valor

---

## Paso 3: Estilo del dashboard

Usar clases Tailwind del dark theme existente en la app. El patrón de cards que ya existe:

```tsx
// Card container (replicar el estilo de las cards en Finanzas)
<div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] p-6">
  <h2 className="text-sm font-medium text-gray-400 mb-4">Resumen Finanzas</h2>
  {/* contenido */}
</div>
```

El grid principal:
```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-6">
  <CardFinanzas />
  <CardTrading />
  <div className="lg:col-span-2">
    <CardPortfolio />
  </div>
</div>
```

---

## Paso 4: Datos reales

Cada card hace su propio fetch a Supabase al montar:

**Card Finanzas** — query:
```sql
SELECT tipo, SUM(monto) as total 
FROM transacciones 
WHERE DATE_TRUNC('month', fecha) = DATE_TRUNC('month', NOW())
GROUP BY tipo
```

**Card Trading** — query:
```sql
SELECT 
  SUM(pl_realizado) as total_pl,
  COUNT(*) FILTER (WHERE resultado = 'ganancia') as wins,
  COUNT(*) as total
FROM trades
WHERE estado = 'cerrado'
```

**Card Portfolio** — usar los datos ya funcionales del módulo `/portfolio` (reusar el hook/service existente).

---

## Paso 5: Eliminar rutas de dashboards personalizables

Eliminar o redirigir:
- `src/app/dashboards/[nombre]/` → redirect a `/dashboard`
- Limpiar en Supabase la tabla de dashboards personalizados si existe (o simplemente dejar de usarla)

---

## Archivos a crear
- `src/app/dashboard/page.tsx`
- `src/app/dashboard/components/CardFinanzas.tsx`
- `src/app/dashboard/components/CardTrading.tsx`
- `src/app/dashboard/components/CardPortfolio.tsx`

## Archivos a eliminar
- `src/app/dashboards/` (carpeta completa) — o mover a `_deprecated`
- `src/components/widgets/` (carpeta completa) — o mover a `_deprecated`

## Verificación
1. `/dashboard` carga sin errores
2. Los 3 cards muestran datos reales de Supabase
3. No hay imports de `react-grid-layout` en ningún archivo activo
4. Las rutas `/dashboards/*` redirigen a `/dashboard`
