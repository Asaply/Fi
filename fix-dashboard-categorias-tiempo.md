# fix-dashboard-categorias-tiempo.md

## Objetivo
1. Dashboard con vista de gastos por categoría (cuánto se gastó y qué % representa)
2. Botón para registrar egresos directamente desde el Dashboard
3. Filtro de temporalidad en las cards del Dashboard (Este mes / 3 meses / 6 meses / 1 año)
4. Quitar el botón "nuevo dashboard" — ya no aplica con dashboard fijo

---

## Estructura del Dashboard fijo actualizada

El Dashboard en `src/app/dashboard/page.tsx` debe tener este layout:

```
┌─────────────────────────────────────────────────────┐
│  [filtro: Este mes ▾]            [+ Registrar Egreso]│
├──────────────────────┬──────────────────────────────┤
│  Resumen Finanzas    │  Resumen Trading              │
│  Ingresos / Egresos  │  P&L / Win Rate               │
│  Balance neto        │  Trades del período           │
├──────────────────────┴──────────────────────────────┤
│  Gastos por Categoría                                │
│  [Restaurantes ████████ $4,200  34%]                 │
│  [Transporte   █████    $2,100  17%]                 │
│  [Suscripciones███      $890    7%]                  │
│  ...                                                 │
├─────────────────────────────────────────────────────┤
│  Resumen Portfolio Health                            │
│  Valor total / P&L / Distribución donut              │
└─────────────────────────────────────────────────────┘
```

---

## Implementación

### 1. Selector de período global

En la parte superior del dashboard, agregar un selector que controla TODOS los cards:

```tsx
'use client'
import { useState, useEffect } from 'react'

type Periodo = '1m' | '3m' | '6m' | '1y'

const PERIODOS: { value: Periodo; label: string }[] = [
  { value: '1m', label: 'Este mes' },
  { value: '3m', label: '3 meses' },
  { value: '6m', label: '6 meses' },
  { value: '1y', label: '1 año' },
]

// Helper para calcular fecha de inicio según período
function getFechaInicio(periodo: Periodo): string {
  const now = new Date()
  switch (periodo) {
    case '1m':
      return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    case '3m':
      return new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split('T')[0]
    case '6m':
      return new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString().split('T')[0]
    case '1y':
      return new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString().split('T')[0]
  }
}
```

El selector de período en el JSX:
```tsx
<div className="flex items-center justify-between mb-6">
  <div className="flex bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-1 gap-1">
    {PERIODOS.map(p => (
      <button
        key={p.value}
        onClick={() => setPeriodo(p.value)}
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          periodo === p.value 
            ? 'bg-[#2a2a2a] text-white' 
            : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        {p.label}
      </button>
    ))}
  </div>
  
  <button
    onClick={() => setModalEgresoOpen(true)}
    className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
  >
    <span>+</span> Registrar Egreso
  </button>
</div>
```

### 2. Fetch de datos según período

```typescript
async function fetchDashboardData(periodo: Periodo) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  
  const fechaInicio = getFechaInicio(periodo)
  
  // Transacciones del período
  const { data: transacciones } = await supabase
    .from('transacciones')
    .select('*')
    .eq('user_id', user.id)
    .gte('fecha', fechaInicio)
    .order('fecha', { ascending: false })
  
  // Trades del período
  const { data: trades } = await supabase
    .from('trades')
    .select('*')
    .eq('user_id', user.id)
    .gte('fecha_cierre', fechaInicio)
  
  // Activos del portafolio (siempre todos, no filtrado por período)
  const { data: activos } = await supabase
    .from('activos')
    .select('*')
    .eq('user_id', user.id)
  
  return { transacciones: transacciones || [], trades: trades || [], activos: activos || [] }
}

// Recalcular cuando cambie el período
useEffect(() => {
  fetchDashboardData(periodo).then(data => {
    if (data) setDashboardData(data)
  })
}, [periodo])
```

### 3. Card "Gastos por Categoría"

```tsx
function CardGastosCategorias({ transacciones }: { transacciones: Transaccion[] }) {
  // Solo egresos
  const egresos = transacciones.filter(t => 
    ['Egreso', 'Gasto Personal'].includes(t.tipo)
  )
  
  const totalEgresos = egresos.reduce((sum, t) => sum + Number(t.monto), 0)
  
  // Agrupar por categoría
  const porCategoria = egresos.reduce((acc, t) => {
    const cat = t.categoria || 'Otros'
    acc[cat] = (acc[cat] || 0) + Number(t.monto)
    return acc
  }, {} as Record<string, number>)
  
  // Ordenar por monto descendente
  const categorias = Object.entries(porCategoria)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8) // Top 8 categorías
  
  if (categorias.length === 0) {
    return (
      <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] p-6">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
          Gastos por Categoría
        </h2>
        <p className="text-gray-600 text-sm text-center py-8">Sin egresos en este período</p>
      </div>
    )
  }
  
  const maxMonto = categorias[0][1]
  
  // Colores por categoría
  const COLORES: Record<string, string> = {
    'Restaurantes': 'bg-orange-500',
    'Comida y Abarrotes': 'bg-yellow-500',
    'Transporte': 'bg-blue-500',
    'Suscripciones': 'bg-purple-500',
    'Transferencias': 'bg-gray-500',
    'Salud': 'bg-red-500',
    'Entretenimiento': 'bg-pink-500',
    'Ropa y Accesorios': 'bg-teal-500',
    'Servicios (luz, agua, internet)': 'bg-cyan-500',
    'Educación': 'bg-green-500',
    'Otros': 'bg-gray-600',
  }
  
  return (
    <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
          Gastos por Categoría
        </h2>
        <span className="text-xs text-gray-500">
          Total: {formatMXN(totalEgresos)}
        </span>
      </div>
      
      <div className="space-y-3">
        {categorias.map(([categoria, monto]) => {
          const porcentaje = totalEgresos > 0 ? (monto / totalEgresos) * 100 : 0
          const barWidth = maxMonto > 0 ? (monto / maxMonto) * 100 : 0
          const color = COLORES[categoria] || 'bg-gray-500'
          
          return (
            <div key={categoria}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-300">{categoria}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-white">{formatMXN(monto)}</span>
                  <span className="text-xs text-gray-500 w-10 text-right">{porcentaje.toFixed(1)}%</span>
                </div>
              </div>
              <div className="h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
                <div 
                  className={`h-full ${color} rounded-full transition-all duration-500`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

### 4. Modal para registrar egreso desde Dashboard

Agregar estado y modal en `src/app/dashboard/page.tsx`:

```tsx
const [modalEgresoOpen, setModalEgresoOpen] = useState(false)

// Formulario simplificado (solo campos esenciales para un egreso rápido)
const [nuevoEgreso, setNuevoEgreso] = useState({
  concepto: '',
  monto: '',
  categoria: 'Restaurantes',
  fecha: new Date().toISOString().split('T')[0],
})

async function handleGuardarEgreso() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !nuevoEgreso.concepto || !nuevoEgreso.monto) return
  
  const { error } = await supabase.from('transacciones').insert({
    concepto: nuevoEgreso.concepto,
    monto: Number(nuevoEgreso.monto),
    tipo: 'Egreso',
    categoria: nuevoEgreso.categoria,
    fecha: nuevoEgreso.fecha,
    user_id: user.id,
  })
  
  if (!error) {
    setModalEgresoOpen(false)
    setNuevoEgreso({ concepto: '', monto: '', categoria: 'Restaurantes', fecha: new Date().toISOString().split('T')[0] })
    fetchDashboardData(periodo)
  }
}
```

El modal JSX (agregar al final del return del dashboard):
```tsx
{modalEgresoOpen && (
  <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-sm">
      <h3 className="text-white font-semibold text-lg mb-5">Registrar Egreso</h3>
      
      <div className="space-y-3">
        <input
          type="date"
          value={nuevoEgreso.fecha}
          onChange={e => setNuevoEgreso(p => ({ ...p, fecha: e.target.value }))}
          className="w-full bg-[#0d0d0d] border border-[#2a2a2a] text-white rounded-lg px-4 py-3 text-sm outline-none focus:border-blue-500"
        />
        <input
          type="text"
          placeholder="Concepto (ej. Uber, Walmart...)"
          value={nuevoEgreso.concepto}
          onChange={e => setNuevoEgreso(p => ({ ...p, concepto: e.target.value }))}
          className="w-full bg-[#0d0d0d] border border-[#2a2a2a] text-white rounded-lg px-4 py-3 text-sm outline-none focus:border-blue-500"
        />
        <input
          type="number"
          placeholder="Monto"
          value={nuevoEgreso.monto}
          onChange={e => setNuevoEgreso(p => ({ ...p, monto: e.target.value }))}
          className="w-full bg-[#0d0d0d] border border-[#2a2a2a] text-white rounded-lg px-4 py-3 text-sm outline-none focus:border-blue-500"
        />
        <select
          value={nuevoEgreso.categoria}
          onChange={e => setNuevoEgreso(p => ({ ...p, categoria: e.target.value }))}
          className="w-full bg-[#0d0d0d] border border-[#2a2a2a] text-white rounded-lg px-4 py-3 text-sm outline-none focus:border-blue-500"
        >
          {CATEGORIAS_EGRESO.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      
      <div className="flex gap-3 mt-5">
        <button
          onClick={() => setModalEgresoOpen(false)}
          className="flex-1 bg-[#2a2a2a] text-gray-300 rounded-lg py-3 text-sm font-medium hover:bg-[#333]"
        >
          Cancelar
        </button>
        <button
          onClick={handleGuardarEgreso}
          className="flex-1 bg-blue-600 text-white rounded-lg py-3 text-sm font-medium hover:bg-blue-700"
        >
          Guardar
        </button>
      </div>
    </div>
  </div>
)}
```

### 5. Quitar botón "nuevo dashboard" del sidebar/layout

Buscar en el sidebar o en `src/app/dashboards/` el botón que dice "+ nuevo dashboard" o "+" al lado de "MIS DASHBOARDS" y eliminarlo completamente. Ya no aplica porque el dashboard es fijo.

---

## Archivos a modificar
- `src/app/dashboard/page.tsx` — selector período, card categorías, modal egreso
- `src/components/sidebar/Sidebar.tsx` — eliminar botón + nuevo dashboard

## SQL a ejecutar en Supabase (si no se ejecutó en el sprint anterior)
```sql
ALTER TABLE transacciones ADD COLUMN IF NOT EXISTS categoria text DEFAULT 'Otros';
```
