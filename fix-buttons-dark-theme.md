# Fix: Botones con fondo blanco en Finanzas y otras páginas

## Problema

Los botones de acción (Importar CSV, Nueva Transacción), los filtros de tiempo (Este mes, 3 meses, etc.) y los filtros de categoría aparecen con fondo blanco/gris claro (`rgb(239,239,239)`) y texto negro. Las clases Tailwind con valores arbitrarios como `bg-[#7c3aed]`, `border-[#222222]`, `text-[#888888]`, etc., **no existen en los stylesheets generados** — Tailwind JIT no puede detectar clases construidas con template literals o concatenación dinámica.

## Root cause

Cualquier clase Tailwind escrita así NO funciona:
```tsx
// ❌ Tailwind no puede parsear esto en build time
const color = '#7c3aed';
<button className={`bg-[${color}]`}>...</button>

// ❌ Tampoco esto
const cls = active ? 'bg-[#111111] text-[#f5f5f5]' : 'text-[#555555]';
```

## Fix

### 1. `tailwind.config.ts` — Extender el theme con los colores del proyecto

Abre `tailwind.config.ts` y agrega los colores custom en `theme.extend.colors`:

```ts
theme: {
  extend: {
    colors: {
      brand: {
        purple: '#7c3aed',
        'purple-hover': '#8b5cf6',
      },
      dark: {
        bg: '#0a0a0a',
        card: '#111111',
        border: '#222222',
        muted: '#333333',
      },
      text: {
        primary: '#f5f5f5',
        secondary: '#888888',
        muted: '#555555',
      },
    },
  },
},
```

### 2. Buscar y reemplazar clases arbitrarias en todos los componentes

Ejecuta este grep para encontrar todos los archivos afectados:

```bash
grep -r "bg-\[#" app/ components/ --include="*.tsx" -l
grep -r "text-\[#" app/ components/ --include="*.tsx" -l
grep -r "border-\[#" app/ components/ --include="*.tsx" -l
```

### 3. Reemplazos principales

| Clase arbitraria actual | Reemplazar por |
|---|---|
| `bg-[#7c3aed]` | `bg-brand-purple` |
| `hover:bg-[#8b5cf6]` | `hover:bg-brand-purple-hover` |
| `bg-[#111111]` | `bg-dark-card` |
| `bg-[#0a0a0a]` | `bg-dark-bg` |
| `border-[#222222]` | `border-dark-border` |
| `text-[#f5f5f5]` | `text-text-primary` |
| `text-[#888888]` | `text-text-secondary` |
| `text-[#555555]` | `text-text-muted` |
| `hover:text-[#f5f5f5]` | `hover:text-text-primary` |
| `hover:text-[#888888]` | `hover:text-text-secondary` |

### 4. Alternativa rápida — safelist en tailwind.config.ts

Si hay demasiados archivos afectados, agrega un safelist temporal para forzar la generación de las clases más usadas:

```ts
safelist: [
  'bg-[#7c3aed]',
  'bg-[#8b5cf6]',
  'bg-[#111111]',
  'bg-[#0a0a0a]',
  'border-[#222222]',
  'text-[#f5f5f5]',
  'text-[#888888]',
  'text-[#555555]',
  'hover:bg-[#8b5cf6]',
  'hover:text-[#f5f5f5]',
  'hover:text-[#888888]',
],
```

**Usa el safelist como fix inmediato**, luego migra a clases con nombre en un sprint siguiente.

### 5. Verificar en global CSS

Revisa `app/globals.css`. Si hay alguna regla que resetee estilos de `button` más allá de `font-family: inherit`, puede estar causando conflicto. El único reset de button debe ser:

```css
button {
  font-family: inherit;
}
```

No debe haber `background`, `color`, ni `border` en el reset de `button`.

## Archivos a modificar

- `tailwind.config.ts` — Agregar safelist (fix inmediato) y/o extender colors
- Todos los `.tsx` que usen clases arbitrarias con valores hex
- `app/globals.css` — Verificar que no haya resets de button que interfieran

## Comando para Claude Code

```
Read CONTEXT.md and fix-buttons-dark-theme.md, then implement all fixes.
```
