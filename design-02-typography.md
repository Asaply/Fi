# FNCE Design — 02: Tipografía, Jerarquía y Polish

> Ejecutar DESPUÉS de design-01-tokens.md

## Target files
- `src/app/finanzas/page.tsx`
- `src/app/trading/page.tsx`
- `src/app/portfolio/page.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/globals.css`
- `next.config.js` o `layout.tsx` (para importar fuente)

## Cambios

### 1. Fuente — instalar GeistMono para números
En `layout.tsx`:
```tsx
import { Geist, Geist_Mono } from 'next/font/google'

const geistSans = Geist({ subsets: ['latin'], variable: '--font-sans' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' })
```
Aplicar `--font-mono` a todos los valores numéricos (importes, porcentajes, P&L).
Aplicar `--font-sans` al resto.

### 2. Jerarquía de página — patrón consistente en todas las secciones
Cada página debe tener exactamente esta estructura de encabezado:
```tsx
<div className="page-header">
  <div>
    <h1 className="page-title">{título}</h1>
    <p className="page-subtitle">{descripción corta}</p>
  </div>
  <div className="page-actions">
    {/* botones CTA */}
  </div>
</div>
```

CSS:
```css
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}
.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}
.page-subtitle {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-top: 0.25rem;
}
```

### 3. Filtros de tiempo — estilo unificado
Los botones de filtro (Este mes / 3 meses / 6 meses / 1 año) actualmente tienen estilos distintos entre Finanzas, Trading y Dashboard. Unificar:
```css
.time-filter-group {
  display: flex;
  gap: 2px;
  background: var(--bg-surface);
  border: var(--card-border);
  border-radius: 8px;
  padding: 3px;
}
.time-filter-btn {
  padding: 0.4rem 0.875rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-secondary);
  transition: all 0.15s;
}
.time-filter-btn.active {
  background: var(--bg-surface-hover);
  color: var(--text-primary);
}
```

### 4. Dashboard — sección "Resumen Finanzas"
La barra chart está bien pero los valores numéricos grandes (`$293,529.00`) necesitan:
- Usar `font-family: var(--font-mono)`
- Reducir a `1.5rem` (actualmente parece más grande y desequilibra el card)
- Agregar sub-label debajo de cada métrica con variación vs período anterior (puede ser estática por ahora: `vs período anterior`)

### 5. Portfolio Health — aplicar mismo sistema de cards
Verificar que las cards de Portfolio (Valor Total, P&L, Mejor Activo, Peor Activo) usen `.metric-card` del sprint anterior.

### 6. Tabla de transacciones (Finanzas)
- Header de tabla: `font-size: 0.7rem`, `letter-spacing: 0.08em`, `text-transform: uppercase`, `color: var(--text-muted)`
- Filas: `border-bottom: 1px solid var(--bg-border)`, hover: `background: var(--bg-surface-hover)`
- Montos positivos: `color: var(--color-gain)`, negativos: `color: var(--color-loss)`
- Chips de categoría: `background: var(--bg-surface-hover)`, `border-radius: 4px`, `padding: 2px 8px`, `font-size: 0.7rem`

### 7. P&L Calendar en Trading
- Celdas con valor positivo: `background: rgba(34, 197, 94, 0.12)`, texto `var(--color-gain)`
- Celdas con valor negativo: `background: rgba(239, 68, 68, 0.12)`, texto `var(--color-loss)`
- Celdas `--` (sin datos): `color: var(--text-muted)`
- Día actual: `border: 1px solid var(--accent)`

## Notas
- NO cambiar lógica ni datos
- Solo CSS + estructura JSX de encabezados
