# FNCE — design-onboarding.md

> Ejecutar después de v1-design-polish.md

## Target files — CREAR
- `src/hooks/useOnboarding.ts`
- `src/components/onboarding/OnboardingTour.tsx`

## Target files — MODIFICAR
- `src/app/dashboard/page.tsx`
- `src/app/finanzas/page.tsx`
- `src/app/trading/page.tsx`
- `src/app/portfolio/page.tsx`

---

## 1. Hook: `src/hooks/useOnboarding.ts`

```ts
'use client'
import { useState, useEffect } from 'react'

type Section = 'dashboard' | 'finanzas' | 'trading' | 'portfolio'
const STORAGE_KEY = 'fnce_tours_completed'

export function useOnboarding(section: Section) {
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    try {
      const completed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      if (!completed[section]) setIsActive(true)
    } catch { setIsActive(true) }
  }, [section])

  function complete() {
    try {
      const completed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      completed[section] = true
      localStorage.setItem(STORAGE_KEY, JSON.stringify(completed))
    } catch {}
    setIsActive(false)
  }

  function reset() {
    try {
      const completed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      delete completed[section]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(completed))
    } catch {}
    setIsActive(true)
  }

  return { isActive, complete, skip: complete, reset }
}
```

---

## 2. Componente: `src/components/onboarding/OnboardingTour.tsx`

```tsx
'use client'
import { useState, useEffect, useRef } from 'react'

export interface TourStep {
  target: string
  title: string
  description: string
  position?: 'top' | 'bottom' | 'left' | 'right'
}

interface Props {
  steps: TourStep[]
  isActive: boolean
  onComplete: () => void
  onSkip: () => void
}

export default function OnboardingTour({ steps, isActive, onComplete, onSkip }: Props) {
  const [current, setCurrent] = useState(0)
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({})
  const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties>({})

  useEffect(() => {
    if (!isActive) { setCurrent(0); return }
    positionTooltip(current)
  }, [isActive, current])

  function positionTooltip(index: number) {
    const step = steps[index]
    const el = document.querySelector(step.target) as HTMLElement
    if (!el) return

    const rect = el.getBoundingClientRect()
    const pos = step.position || 'bottom'
    const gap = 12

    setHighlightStyle({
      position: 'fixed',
      top: rect.top - 6,
      left: rect.left - 6,
      width: rect.width + 12,
      height: rect.height + 12,
      borderRadius: 8,
      boxShadow: '0 0 0 9999px rgba(0,0,0,0.75)',
      zIndex: 9998,
      pointerEvents: 'none',
    })

    const tooltipW = 280
    let top = 0, left = 0

    if (pos === 'bottom') { top = rect.bottom + gap; left = rect.left + rect.width / 2 - tooltipW / 2 }
    if (pos === 'top') { top = rect.top - gap - 140; left = rect.left + rect.width / 2 - tooltipW / 2 }
    if (pos === 'right') { top = rect.top + rect.height / 2 - 70; left = rect.right + gap }
    if (pos === 'left') { top = rect.top + rect.height / 2 - 70; left = rect.left - tooltipW - gap }

    // Keep within viewport
    left = Math.max(12, Math.min(left, window.innerWidth - tooltipW - 12))
    top = Math.max(12, Math.min(top, window.innerHeight - 160))

    setTooltipStyle({ position: 'fixed', top, left, width: tooltipW, zIndex: 9999 })
  }

  if (!isActive || steps.length === 0) return null

  const step = steps[current]
  const isLast = current === steps.length - 1

  return (
    <>
      {/* Highlight cutout */}
      <div style={highlightStyle} />

      {/* Tooltip */}
      <div style={{
        ...tooltipStyle,
        background: '#1a1a1e',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: '1.25rem',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}>
        {/* Step indicator */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.7rem', color: '#6366f1', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {current + 1} / {steps.length}
          </span>
          <button onClick={onSkip} style={{ fontSize: '0.7rem', color: '#4a4a5a', cursor: 'pointer', background: 'none', border: 'none' }}>
            Saltar tour
          </button>
        </div>

        <p style={{ fontWeight: 700, color: '#f0f0f2', marginBottom: '0.4rem', fontSize: '0.95rem' }}>
          {step.title}
        </p>
        <p style={{ fontSize: '0.8rem', color: '#8a8a9a', lineHeight: 1.5, marginBottom: '1rem' }}>
          {step.description}
        </p>

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 4, marginBottom: '1rem' }}>
          {steps.map((_, i) => (
            <div key={i} style={{
              width: i === current ? 16 : 6, height: 6,
              borderRadius: 3,
              background: i === current ? '#6366f1' : '#2a2a2e',
              transition: 'all 0.2s',
            }} />
          ))}
        </div>

        <button
          onClick={() => isLast ? onComplete() : setCurrent(c => c + 1)}
          style={{
            width: '100%', padding: '0.6rem',
            background: '#6366f1', color: 'white',
            borderRadius: 8, fontWeight: 600,
            fontSize: '0.85rem', border: 'none', cursor: 'pointer',
          }}
        >
          {isLast ? '¡Entendido!' : 'Siguiente →'}
        </button>
      </div>
    </>
  )
}
```

---

## 3. Steps por sección

Crear archivo `src/components/onboarding/tourSteps.ts`:

```ts
import type { TourStep } from './OnboardingTour'

export const DASHBOARD_STEPS: TourStep[] = [
  { target: '[data-tour="time-filter"]', title: 'Filtra por período', description: 'Cambia el rango de tiempo para ver tus datos por mes, trimestre o año.', position: 'bottom' },
  { target: '[data-tour="resumen-finanzas"]', title: 'Resumen de Finanzas', description: 'Ingresos, egresos y ganancia neta del período seleccionado.', position: 'bottom' },
  { target: '[data-tour="resumen-trading"]', title: 'Resumen de Trading', description: 'Tu P&L total y win rate de operaciones cerradas.', position: 'bottom' },
  { target: '[data-tour="gastos-categoria"]', title: 'Gastos por categoría', description: 'Visualiza en qué estás gastando y en qué proporción.', position: 'top' },
]

export const FINANZAS_STEPS: TourStep[] = [
  { target: '[data-tour="btn-nueva-transaccion"]', title: 'Registra una transacción', description: 'Agrega ingresos, egresos o inversiones manualmente.', position: 'bottom' },
  { target: '[data-tour="btn-importar-csv"]', title: 'Importa tu estado de cuenta', description: 'Soporta CSV de BBVA, Banorte y Santander. Las transacciones se categorizan automáticamente.', position: 'bottom' },
  { target: '[data-tour="filtros-tipo"]', title: 'Filtra por tipo', description: 'Separa entre Ingresos, Egresos, Inversiones o lo que está por cobrar.', position: 'bottom' },
]

export const TRADING_STEPS: TourStep[] = [
  { target: '[data-tour="btn-nuevo-trade"]', title: 'Registra un trade', description: 'Agrega operaciones long o short. Al cerrar la posición, FNCE calcula tu P&L automáticamente.', position: 'bottom' },
  { target: '[data-tour="card-winrate"]', title: 'Win Rate', description: 'Porcentaje de trades ganadores sobre el total de operaciones cerradas.', position: 'bottom' },
  { target: '[data-tour="pl-calendar"]', title: 'Calendario P&L', description: 'Vista día a día de tus resultados. Verde = ganador, rojo = perdedor.', position: 'top' },
]

export const PORTFOLIO_STEPS: TourStep[] = [
  { target: '[data-tour="btn-agregar-activo"]', title: 'Agrega tus inversiones', description: 'Registra acciones, ETFs o crypto con tu precio de compra promedio.', position: 'bottom' },
  { target: '[data-tour="tabla-activos"]', title: 'Precio en tiempo real', description: 'Los precios se actualizan vía Yahoo Finance y CoinGecko. El P&L se calcula automáticamente.', position: 'top' },
]
```

---

## 4. Integración en cada página

### Patrón a aplicar en los 4 page.tsx:

```tsx
// Agregar imports
import { useOnboarding } from '@/hooks/useOnboarding'
import OnboardingTour from '@/components/onboarding/OnboardingTour'
import { DASHBOARD_STEPS } from '@/components/onboarding/tourSteps' // cambiar por sección

// Dentro del componente
const { isActive, complete, skip, reset } = useOnboarding('dashboard') // cambiar sección

// Agregar atributos data-tour a los elementos target:
// En el filtro de tiempo: data-tour="time-filter"
// En Resumen Finanzas card: data-tour="resumen-finanzas"
// En Resumen Trading card: data-tour="resumen-trading"
// En Gastos por Categoría: data-tour="gastos-categoria"
// En botón Nueva Transacción: data-tour="btn-nueva-transaccion"
// En botón Importar CSV: data-tour="btn-importar-csv"
// En filtros Todos/Ingreso/Egreso: data-tour="filtros-tipo"
// En botón Nuevo Trade: data-tour="btn-nuevo-trade"
// En card Win Rate: data-tour="card-winrate"
// En el calendario: data-tour="pl-calendar"
// En botón Agregar Activo: data-tour="btn-agregar-activo"
// En tabla de activos: data-tour="tabla-activos"

// Al final del JSX, antes del cierre del return:
<OnboardingTour
  steps={DASHBOARD_STEPS}
  isActive={isActive}
  onComplete={complete}
  onSkip={skip}
/>

// Botón para reactivar — agregar debajo del page-header:
<button
  onClick={reset}
  style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
>
  ¿Cómo usar esta sección?
</button>
```

---

## Notas
- Mobile (< 768px): el tour debe centrarse como modal en lugar de posicionarse relativo al elemento. Agregar condición: `if (window.innerWidth < 768) { setTooltipStyle({ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }) }`
- NO instalar librerías externas de tour
- Si `document.querySelector(step.target)` retorna null, saltar el step silenciosamente
