# FNCE — v1-design-polish.md
> Mejoras estéticas globales para toda la app. Aplica a todas las páginas: /dashboard, /finanzas, /trading, /portfolio.

---

## Objetivo
Elevar la calidad visual de la app sin cambiar funcionalidad. Referencia estética: apps fintech premium (Robinhood, Mercury, Revolut). Dark mode refinado, jerarquía clara, espaciado consistente.

---

## 1. TOKENS GLOBALES — `globals.css` o `tailwind.config`

Definir y usar estas variables CSS en toda la app:

```css
:root {
  --bg-base: #0a0a0a;         /* fondo de página */
  --bg-card: #111111;         /* cards principales */
  --bg-card-hover: #161616;   /* hover en cards */
  --bg-subtle: #1a1a1a;       /* inputs, pills secundarias */
  --border: #222222;          /* bordes de cards */
  --border-subtle: #1c1c1c;   /* divisores internos */

  --text-primary: #f5f5f5;
  --text-secondary: #888888;
  --text-tertiary: #555555;

  --green: #22c55e;
  --green-muted: #16a34a22;
  --red: #ef4444;
  --red-muted: #dc262622;
  --purple: #7c3aed;
  --purple-light: #8b5cf6;
  --amber: #f59e0b;

  --radius-sm: 8px;
  --radius-md: 14px;
  --radius-lg: 20px;

  --font-mono: 'SF Mono', 'Fira Code', monospace;
}
```

**Aplicar `--bg-base` como fondo de `body` y todas las páginas** (actualmente el fondo es negro puro `#000`, reemplazar por `#0a0a0a`).

---

## 2. CARDS — Estilo unificado

Todos los cards de la app deben seguir este patrón:

```css
.fnce-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 20px;
}
```

- **Eliminar** fondos `bg-gray-900`, `bg-zinc-900`, `bg-neutral-900` inconsistentes
- **No usar** `shadow` en dark mode — usar `border` en su lugar
- El label del card (ej. "RESUMEN FINANZAS", "TOTAL P&L") debe ser: `text-[11px] font-semibold tracking-widest text-[--text-tertiary] uppercase`

---

## 3. MÉTRICAS EN GRID — No cards apilados

**Problema actual:** Ingresos, Egresos y Neto son 3 cards apilados verticalmente, desperdician espacio.

**Fix:** Ponerlos en un grid 3 columnas en todas las páginas donde aparezcan:

```jsx
<div className="grid grid-cols-3 gap-3">
  <MetricCard label="Ingresos" value="$138,529" color="green" />
  <MetricCard label="Egresos" value="$22,976" color="red" />
  <MetricCard label="Neto" value="+$115,552" color="green" />
</div>
```

Cada MetricCard: fondo `--bg-card`, border `--border`, padding `16px`, label pequeño arriba, número grande abajo con color semántico.

Aplicar el mismo patrón en:
- `/finanzas` — Ingresos / Egresos / Neto
- `/dashboard` — dentro de RESUMEN FINANZAS
- `/trading` — P&L / Win Rate / Trades Abiertos (actualmente son 3 cards separados — convertir a grid)

---

## 4. BOTTOM NAV — Agregar labels

**Problema:** El bottom nav solo tiene íconos, no está claro qué es cada uno.

**Fix:** Agregar label debajo de cada ícono:

```jsx
// Estructura de cada item del nav:
<NavItem icon={<WalletIcon />} label="Finanzas" href="/finanzas" />
<NavItem icon={<TrendingUpIcon />} label="Trading" href="/trading" />
<NavItem icon={<ActivityIcon />} label="Portfolio" href="/portfolio" />
<NavItem icon={<GridIcon />} label="Dashboard" href="/dashboard" />
```

Estilo del nav activo: ícono + label en `--purple-light`, con una línea/dot indicador arriba del ícono activo.
Nav inactivo: `--text-tertiary`.
Altura del bottom nav: `64px`.

---

## 5. PAGE HEADER — Simplificar

**Problema actual:** El header de cada página tiene título + subtítulo + "¿Cómo usar esta sección?" que ocupa mucho espacio.

**Fix:**
- Mantener el título (`Dashboard`, `Finanzas`, etc.) en `text-2xl font-bold`
- Eliminar el subtítulo descriptivo (ej. "Control de ingresos y egresos") — es redundante
- Mover o eliminar el link "¿Cómo usar esta sección?" — si se mantiene, como ícono `?` pequeño junto al título, no como texto suelto

---

## 6. FILTROS DE PERÍODO — Estilo pill consistente

**Problema:** Los filtros (Este mes / 3 meses / 6 meses / Este año) tienen estilos distintos entre páginas.

**Fix único para toda la app:**

```jsx
// Contenedor
<div className="flex gap-1 bg-[--bg-subtle] p-1 rounded-full w-fit">
  {periods.map(p => (
    <button
      key={p}
      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all
        ${active === p
          ? 'bg-[--bg-card] text-[--text-primary] shadow-sm'
          : 'text-[--text-tertiary] hover:text-[--text-secondary]'
        }`}
    >
      {p}
    </button>
  ))}
</div>
```

---

## 7. BOTONES PRIMARIOS — Consistencia

El botón primario (+ Nueva Transacción, + Nuevo Trade, + Agregar Activo) debe ser igual en toda la app:

```jsx
<button className="flex items-center gap-2 bg-[--purple] hover:bg-[--purple-light] 
  text-white text-sm font-semibold px-4 py-2.5 rounded-full transition-colors">
  <PlusIcon size={16} />
  Texto del botón
</button>
```

El botón secundario (Importar CSV):
```jsx
<button className="flex items-center gap-2 border border-[--border] 
  text-[--text-secondary] hover:text-[--text-primary] hover:border-[--border-subtle]
  text-sm font-medium px-4 py-2.5 rounded-full transition-colors">
```

---

## 8. TABLA DE TRANSACCIONES / ACTIVOS — Refinamiento

En `/finanzas` la lista de transacciones y en `/portfolio` la tabla de activos:

- Fondo de fila hover: `bg-[--bg-card-hover]`
- Separadores entre filas: `border-b border-[--border-subtle]`
- Labels de categoría/tipo (pills): `bg-[--bg-subtle] text-[--text-secondary] text-xs px-2.5 py-0.5 rounded-full`
- Columnas de monto: usar `font-mono` (`--font-mono`) para alinear números
- En mobile, las columnas menos importantes (COSTO PROMEDIO en portfolio) pueden ocultarse con `hidden sm:table-cell`

---

## 9. SECCIÓN "POR COBRAR" — Fix visual

**Problema:** El card "Por Cobrar" tiene un borde naranja izquierdo que se ve inconsistente.

**Fix:** Usar el mismo estilo `fnce-card` pero con un tinte sutil:

```jsx
<div className="fnce-card border-l-2 border-l-[--amber]">
  <span className="text-[11px] font-semibold tracking-widest text-[--amber] uppercase">Por Cobrar</span>
  <p className="text-2xl font-bold text-[--amber] mt-1">$7,500.00</p>
</div>
```

---

## 10. PORTFOLIO — Mejor presentación de stats

En `/portfolio`, el bloque de "Mejor activo / Peor activo / Capital invertido / Número de activos" está en una grid 4 columnas sin separación visual.

**Fix:** Separar con `border-r border-[--border-subtle]` entre columnas, y agregar ícono pequeño a cada stat:
- Mejor activo → ícono flecha arriba verde
- Peor activo → ícono flecha abajo roja
- Capital invertido → ícono billetera
- Número de activos → ícono grid

---

## 11. TRADING — Cards de métricas en grid

**Problema:** P&L Realizado, Win Rate y Trades Abiertos son 3 cards apilados uno por uno.

**Fix:** Grid 1x3 igual que en Finanzas (ver punto 3). Dentro de cada card, el ícono del label debe ser más pequeño y discreto (`text-[--text-tertiary]`).

---

## Archivos a modificar (aproximado)

- `src/app/globals.css` — agregar variables CSS
- `src/components/layout/BottomNav.tsx` — agregar labels
- `src/app/dashboard/page.tsx` — grid métricas, header simplificado
- `src/app/finanzas/page.tsx` — grid métricas, pills período, header
- `src/app/trading/page.tsx` — grid métricas, cards unificados
- `src/app/portfolio/page.tsx` — stats con íconos, tabla refinada
- Cualquier componente compartido de cards, botones o filtros

## Importante
- NO cambiar lógica, queries a Supabase ni estructuras de datos
- NO cambiar rutas ni nombres de componentes
- SOLO cambios de CSS/Tailwind/JSX visual
- Mantener dark mode en todo momento
- No introducir nuevas dependencias
