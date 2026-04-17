# v1-sprint4-design.md

## Objetivo
Pulir la UI para que la app se vea terminada, limpia y confiable. Atacar los 5 problemas visuales que más afectan la percepción de calidad: estados vacíos, estados de carga, consistencia de cards, jerarquía tipográfica y colores semánticos.

---

## 1. Empty States — cuando no hay datos

### Problema
Actualmente cuando no hay datos se muestran $0.00 en las cards y tablas vacías, lo que parece un bug, no un estado normal.

### Fix — crear componente EmptyState reutilizable

Crear `src/components/ui/EmptyState.tsx`:

```tsx
interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-gray-600 mb-4 opacity-50">
        {icon}
      </div>
      <h3 className="text-gray-300 font-medium mb-1">{title}</h3>
      <p className="text-gray-500 text-sm mb-6 max-w-xs">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
```

### Aplicar en cada sección:

**Finanzas — tabla de transacciones vacía:**
```tsx
{transacciones.length === 0 && (
  <EmptyState
    icon={<ReceiptIcon size={48} />}
    title="Sin transacciones este mes"
    description="Registra tu primer ingreso o egreso para empezar a ver tu balance."
    action={{ label: "+ Nueva Transacción", onClick: () => setModalOpen(true) }}
  />
)}
```

**Trading — sin trades:**
```tsx
{trades.length === 0 && (
  <EmptyState
    icon={<TrendingUpIcon size={48} />}
    title="Sin trades registrados"
    description="Agrega tu primer trade para empezar a rastrear tu rendimiento."
    action={{ label: "+ Nuevo Trade", onClick: () => setModalOpen(true) }}
  />
)}
```

**Portfolio — sin activos:**
```tsx
{activos.length === 0 && (
  <EmptyState
    icon={<PieChartIcon size={48} />}
    title="Tu portafolio está vacío"
    description="Agrega acciones, crypto o ETFs para ver el valor en tiempo real."
    action={{ label: "+ Agregar Activo", onClick: () => setModalOpen(true) }}
  />
)}
```

---

## 2. Skeleton Loaders — mientras carga Supabase

### Problema
Al cargar la página hay un flash de $0.00 antes de que lleguen los datos reales. Esto parece un bug.

### Fix — crear componente Skeleton

Crear `src/components/ui/Skeleton.tsx`:

```tsx
export function SkeletonCard() {
  return (
    <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] p-6 animate-pulse">
      <div className="h-3 bg-[#2a2a2a] rounded w-24 mb-4" />
      <div className="h-8 bg-[#2a2a2a] rounded w-36 mb-2" />
      <div className="h-3 bg-[#2a2a2a] rounded w-20" />
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div className="flex gap-4 py-3 animate-pulse">
      <div className="h-4 bg-[#2a2a2a] rounded w-16" />
      <div className="h-4 bg-[#2a2a2a] rounded w-24" />
      <div className="h-4 bg-[#2a2a2a] rounded w-20 ml-auto" />
    </div>
  )
}
```

### Aplicar
En cada sección, agregar estado `isLoading` y mostrar skeletons mientras se espera Supabase:

```tsx
const [isLoading, setIsLoading] = useState(true)

// En el render:
{isLoading ? (
  <div className="grid grid-cols-3 gap-4">
    <SkeletonCard /><SkeletonCard /><SkeletonCard />
  </div>
) : (
  <div className="grid grid-cols-3 gap-4">
    {/* cards reales */}
  </div>
)}
```

---

## 3. Cards — padding y estructura consistente

### Problema
Las cards en distintas secciones tienen padding y estructura ligeramente distinta. Algunas tienen borde visible, otras no.

### Fix — crear componente Card base

Crear `src/components/ui/Card.tsx`:

```tsx
interface CardProps {
  children: React.ReactNode
  className?: string
  highlighted?: boolean // para la card con borde azul (Inversiones)
}

export function Card({ children, className = '', highlighted = false }: CardProps) {
  return (
    <div className={`
      bg-[#1a1a1a] rounded-xl p-6
      ${highlighted 
        ? 'border border-blue-500/40' 
        : 'border border-[#2a2a2a]'
      }
      ${className}
    `}>
      {children}
    </div>
  )
}

export function CardLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">{children}</p>
}

export function CardValue({ children, color = 'white' }: { children: React.ReactNode, color?: 'white' | 'green' | 'red' | 'blue' }) {
  const colors = {
    white: 'text-white',
    green: 'text-green-400',
    red: 'text-red-400',
    blue: 'text-blue-400',
  }
  return <p className={`text-2xl font-bold ${colors[color]}`}>{children}</p>
}
```

Reemplazar cards hardcodeadas en Finanzas, Trading y Portfolio por este componente.

---

## 4. Tipografía — jerarquía clara

### Reglas a aplicar en toda la app:

```
Títulos de página (h1):     text-2xl font-bold text-white
Títulos de sección (h2):    text-lg font-semibold text-white  
Labels de card:             text-xs font-medium text-gray-500 uppercase tracking-wider
Valores numéricos grandes:  text-2xl font-bold (color según semántica)
Valores secundarios:        text-sm text-gray-400
Body / descripciones:       text-sm text-gray-400
```

Buscar y corregir donde el tamaño de fuente no sigue esta jerarquía. En particular:
- Los subtítulos de página como "Registro y bitácora de operaciones" deben ser `text-sm text-gray-400`
- Los labels de cards como "Total Egresos" deben ser `text-xs uppercase tracking-wider text-gray-500`
- Los valores monetarios grandes deben ser siempre `text-2xl font-bold`

---

## 5. Colores semánticos — auditoría completa

### Regla única:
- **Verde** (`text-green-400`) → SOLO para: ingresos, ganancias, P&L positivo, win rate alto
- **Rojo** (`text-red-400`) → SOLO para: egresos, pérdidas, P&L negativo
- **Azul** (`text-blue-400` o `text-blue-600`) → SOLO para: inversiones, botones primarios, links
- **Gris** (`text-gray-400`, `text-gray-500`) → labels, texto secundario, valores neutros

### Casos a corregir que se vieron en la app:
1. "Total Egresos" valor en rojo ✅ — correcto, mantener
2. "Ganancia Neta" valor en blanco — cambiar a verde cuando > 0, rojo cuando < 0
3. "Inversiones" valor en azul ✅ — correcto, mantener
4. Win Rate en Trading: el número debe ser verde si > 60%, amarillo si 40-60%, rojo si < 40%
5. P&L en Portfolio: ya está correcto (verde/rojo)

### Fix para Win Rate dinámico:
```tsx
function getWinRateColor(rate: number): string {
  if (rate >= 60) return 'text-green-400'
  if (rate >= 40) return 'text-yellow-400'
  return 'text-red-400'
}

// En el JSX:
<span className={getWinRateColor(winRate)}>{winRate.toFixed(1)}%</span>
```

---

## 6. Header — limpiar breadcrumb

### Problema
El header muestra "Dashboard / Abril" hardcodeado en todas las páginas.

### Fix
El header debe leer la ruta actual y mostrar el nombre de la sección activa:

```tsx
// En src/components/layout/Header.tsx
import { usePathname } from 'next/navigation'

const sectionNames: Record<string, string> = {
  '/finanzas': 'Finanzas',
  '/trading': 'Trading',
  '/portfolio': 'Portfolio Health',
  '/dashboard': 'Dashboard',
}

export function Header() {
  const pathname = usePathname()
  const sectionName = sectionNames[pathname] ?? 'FNCE'
  
  return (
    <header className="...">
      <h1 className="text-sm font-medium text-gray-400">{sectionName}</h1>
      {/* resto del header */}
    </header>
  )
}
```

---

## Archivos a crear
- `src/components/ui/EmptyState.tsx`
- `src/components/ui/Skeleton.tsx`
- `src/components/ui/Card.tsx`

## Archivos a modificar
- `src/app/finanzas/page.tsx` — empty state + skeleton + Card component
- `src/app/trading/page.tsx` — empty state + skeleton + win rate color
- `src/app/portfolio/page.tsx` — empty state + skeleton
- `src/components/layout/Header.tsx` — breadcrumb dinámico
