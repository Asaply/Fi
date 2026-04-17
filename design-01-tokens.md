# FNCE Design — 01: Tokens & Consistencia Visual

## Target files
- `src/app/globals.css`
- `src/components/ui/` (todos los archivos)
- `src/app/finanzas/page.tsx`
- `src/app/trading/page.tsx`
- `src/app/dashboard/page.tsx`
- `src/components/sidebar/Sidebar.tsx` (o equivalente)

## Problemas a resolver
1. Cards sin altura mínima consistente — algunas son altas, otras compactas
2. Labels de métricas en ALL CAPS pero sin tracking uniforme
3. Fondo del sidebar (`#0a0a0a`) vs fondo del contenido (`#111`) — diferencia sin intención
4. Gráfica de barras en Trading vacía (`$0.00`, `0%`) no tiene empty state
5. Header top bar repite el título de página que ya está en el h1 del contenido — redundante
6. Botón "Nueva Transacción" en azul vibrante contrasta con "Importar CSV" en gris — está bien, pero el azul no es el mismo que el del logo FNCE (que es más saturado/violeta)

## Cambios

### 1. CSS Variables — agregar en `globals.css`
```css
:root {
  /* Backgrounds */
  --bg-base: #0c0c0e;
  --bg-surface: #141416;
  --bg-surface-hover: #1a1a1e;
  --bg-border: #242428;

  /* Texto */
  --text-primary: #f0f0f2;
  --text-secondary: #8a8a9a;
  --text-muted: #4a4a5a;

  /* Acento único */
  --accent: #6366f1;         /* indigo — reemplaza el azul mezclado actual */
  --accent-hover: #4f51d8;

  /* Semánticos */
  --color-gain: #22c55e;
  --color-loss: #ef4444;
  --color-warning: #f59e0b;
  --color-neutral: #6366f1;

  /* Tipografía */
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* Espaciado de cards */
  --card-padding: 1.5rem;
  --card-radius: 12px;
  --card-border: 1px solid var(--bg-border);
}
```

### 2. Unificar cards de métricas
Crear clase `.metric-card` en globals.css:
```css
.metric-card {
  background: var(--bg-surface);
  border: var(--card-border);
  border-radius: var(--card-radius);
  padding: var(--card-padding);
  min-height: 120px;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.metric-card .label {
  font-size: 0.65rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-secondary);
  font-weight: 500;
}

.metric-card .value {
  font-size: 1.75rem;
  font-weight: 700;
  font-family: var(--font-mono);
  line-height: 1;
}
```

Aplicar `.metric-card` a todas las cards de métricas en Finanzas, Trading y Dashboard.

### 3. Sidebar
- Fondo: `var(--bg-base)` — ligeramente más oscuro que el contenido
- Item activo: borde izquierdo `3px solid var(--accent)` + background `var(--bg-surface)`
- Texto items: `var(--text-secondary)` en reposo, `var(--text-primary)` activo
- Logo FNCE: color `var(--accent)`
- Eliminar el borde rojo/naranja que aparece en el borde derecho del sidebar (parece un artifact de border)

### 4. Botones CTA
- `.btn-primary`: `background: var(--accent)`, hover: `var(--accent-hover)`, border-radius: 8px
- `.btn-secondary`: `background: transparent`, `border: var(--card-border)`, hover: `var(--bg-surface-hover)`
- Aplicar consistentemente en Finanzas (Nueva Transacción, Importar CSV) y Trading (Nuevo Trade)

### 5. Eliminar header top bar duplicado
El header superior que solo muestra "Finanzas" / "Trading" / "Dashboard" es redundante con el h1 dentro de cada página. Convertirlo en una barra minimalista que solo muestre el avatar/perfil de usuario a la derecha. Sin título.

### 6. Empty states para Trading
Cuando P&L = $0.00 y Win Rate = 0%, agregar debajo de cada card un texto muted:
```
Sin operaciones en este período
```
No cambiar los números, solo agregar el sub-texto con `color: var(--text-muted)`.

## Notas
- NO instalar fuentes nuevas ahora — usar las actuales con las variables
- NO cambiar layouts, solo tokens y clases
- Prioridad: consistencia antes que creatividad
