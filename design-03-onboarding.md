# FNCE Design — 03: Tutorial Onboarding (Primer Uso)

## Target files
- `src/components/onboarding/OnboardingTour.tsx` ← CREAR
- `src/hooks/useOnboarding.ts` ← CREAR
- `src/app/finanzas/page.tsx` ← integrar tour
- `src/app/trading/page.tsx` ← integrar tour
- `src/app/portfolio/page.tsx` ← integrar tour
- `src/app/dashboard/page.tsx` ← integrar tour

## Descripción
Tutorial tipo "tooltip spotlight" que aparece la primera vez que el usuario entra a la app. Funciona sección por sección: al entrar a cada sección por primera vez, aparece el tour de esa sección. Se guarda en `localStorage` para no repetirse.

NO usar librerías externas. Implementar desde cero con React + Tailwind + CSS.

---

## Hook: `useOnboarding.ts`

```ts
// Guarda en localStorage qué tours ya se completaron
// Key: 'fnce_tour_completed' → objeto { finanzas: bool, trading: bool, portfolio: bool, dashboard: bool }

export function useOnboarding(section: 'finanzas' | 'trading' | 'portfolio' | 'dashboard') {
  // Retorna: { isActive, currentStep, totalSteps, next, skip, complete }
  // isActive: true si el tour de esta sección no se ha completado
  // Al llamar complete() o skip() → marca en localStorage y cierra
}
```

---

## Componente: `OnboardingTour.tsx`

### Props
```ts
interface TourStep {
  target: string        // selector CSS del elemento a destacar (e.g. '.metric-card:first-child')
  title: string
  description: string
  position: 'top' | 'bottom' | 'left' | 'right'
}

interface OnboardingTourProps {
  steps: TourStep[]
  isActive: boolean
  onComplete: () => void
  onSkip: () => void
}
```

### Comportamiento
1. Overlay semi-transparente sobre toda la pantalla (`rgba(0,0,0,0.7)`)
2. "Recorte" (cutout) en el elemento target — hace que el elemento brille/resalte. Implementar con `box-shadow: 0 0 0 9999px rgba(0,0,0,0.7)` en el elemento o con `clip-path` + `mix-blend-mode`
3. Tooltip flotante junto al elemento resaltado con:
   - Título bold
   - Descripción en texto secundario
   - Indicador de paso: `2 / 4`
   - Botón "Siguiente" (accent) + link "Saltar tour" (muted)
4. Animación de entrada del tooltip: `fade-in` + `translateY(4px → 0)`, 200ms
5. Al llegar al último paso: botón cambia a "¡Entendido!" y llama `onComplete()`

### Estilo del tooltip
```css
.tour-tooltip {
  position: fixed;
  z-index: 9999;
  background: var(--bg-surface);
  border: var(--card-border);
  border-radius: 12px;
  padding: 1.25rem;
  width: 280px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}
.tour-tooltip::before {
  /* flecha apuntando al elemento */
  content: '';
  position: absolute;
  border: 6px solid transparent;
}
```

---

## Steps por sección

### Dashboard (`/dashboard`)
```ts
[
  {
    target: '.time-filter-group',
    title: 'Filtra por período',
    description: 'Cambia el rango de tiempo para ver tus datos por mes, trimestre o año.',
    position: 'bottom'
  },
  {
    target: '[data-tour="resumen-finanzas"]',
    title: 'Resumen de Finanzas',
    description: 'Aquí ves tus ingresos, egresos y ganancia neta del período seleccionado.',
    position: 'bottom'
  },
  {
    target: '[data-tour="resumen-trading"]',
    title: 'Resumen de Trading',
    description: 'Tu P&L total y win rate de operaciones cerradas en el período.',
    position: 'bottom'
  },
  {
    target: '[data-tour="gastos-categoria"]',
    title: 'Gastos por categoría',
    description: 'Visualiza en qué estás gastando y en qué proporción.',
    position: 'top'
  }
]
```

### Finanzas (`/finanzas`)
```ts
[
  {
    target: '[data-tour="btn-nueva-transaccion"]',
    title: 'Registra una transacción',
    description: 'Agrega ingresos, egresos o inversiones manualmente.',
    position: 'bottom'
  },
  {
    target: '[data-tour="btn-importar-csv"]',
    title: 'Importa tu estado de cuenta',
    description: 'Soporta CSV de BBVA, Banorte y Santander. Tus transacciones se clasifican automáticamente.',
    position: 'bottom'
  },
  {
    target: '[data-tour="filtros-tipo"]',
    title: 'Filtra por tipo',
    description: 'Separa entre Ingresos, Egresos, Inversiones o lo que está por cobrar.',
    position: 'bottom'
  }
]
```

### Trading (`/trading`)
```ts
[
  {
    target: '[data-tour="btn-nuevo-trade"]',
    title: 'Registra un trade',
    description: 'Agrega operaciones long o short. Cuando cierres la posición, FNCE calcula tu P&L automáticamente.',
    position: 'bottom'
  },
  {
    target: '[data-tour="card-winrate"]',
    title: 'Win Rate',
    description: 'Porcentaje de trades ganadores sobre el total de operaciones cerradas.',
    position: 'bottom'
  },
  {
    target: '[data-tour="pl-calendar"]',
    title: 'Calendario P&L',
    description: 'Vista día a día de tus resultados. Verde = día ganador, rojo = día perdedor.',
    position: 'top'
  }
]
```

### Portfolio Health (`/portfolio`)
```ts
[
  {
    target: '[data-tour="btn-agregar-activo"]',
    title: 'Agrega tus inversiones',
    description: 'Registra acciones, ETFs o crypto con tu precio de compra promedio.',
    position: 'bottom'
  },
  {
    target: '[data-tour="tabla-activos"]',
    title: 'Precio en tiempo real',
    description: 'Los precios se actualizan via Yahoo Finance y CoinGecko. El P&L se calcula automáticamente.',
    position: 'top'
  }
]
```

---

## Integración en cada página

En cada `page.tsx`, agregar los atributos `data-tour` a los elementos correspondientes y montar el componente:

```tsx
import OnboardingTour from '@/components/onboarding/OnboardingTour'
import { useOnboarding } from '@/hooks/useOnboarding'

// dentro del componente:
const { isActive, complete, skip } = useOnboarding('finanzas')

// en el JSX:
<OnboardingTour
  steps={FINANZAS_STEPS}
  isActive={isActive}
  onComplete={complete}
  onSkip={skip}
/>
```

---

## Botón "Ver tutorial de nuevo"
Agregar en cada página, debajo del page-header, un link discreto:
```tsx
<button onClick={resetTour} className="text-xs text-muted hover:text-secondary">
  ¿Cómo usar esta sección?
</button>
```
`resetTour()` borra la clave de localStorage de esa sección y activa el tour nuevamente.

---

## Notas
- NO instalar `react-joyride` ni ninguna librería de tour — implementar desde cero
- El tour NO debe bloquear la app si localStorage no está disponible
- Mobile: si `window.innerWidth < 768`, simplificar el tour a un modal centered en lugar de tooltips posicionados
