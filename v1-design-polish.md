# v1-design-polish.md

## Objetivo
Rediseño visual completo de la app para que se vea moderna, limpia y profesional.
Atacar: sidebar, header, cards, tipografía, espaciado y micro-detalles en todas las secciones.

---

## Contexto visual actual (observado)
- Sidebar: íconos desalineados, item activo con fondo azul demasiado sólido
- Header: solo texto plano, sin separador del contenido
- Cards: bordes muy sutiles casi invisibles, padding inconsistente
- Tipografía: labels de cards en mayúsculas pequeñas (bien) pero tamaños mezclados
- Colores: paleta verde/rojo/azul correcta pero sin refinamiento
- Fondo: negro puro #000 o #0d0d0d sin profundidad

---

## 1. Tokens de diseño — crear `src/styles/tokens.css` o en `globals.css`

Agregar estas variables CSS globales:

```css
:root {
  /* Backgrounds */
  --bg-base: #0a0a0a;          /* fondo de toda la app */
  --bg-surface: #141414;       /* cards, modales */
  --bg-elevated: #1c1c1c;      /* hover states, inputs */
  --bg-border: #242424;        /* bordes de cards */
  --bg-border-subtle: #1a1a1a; /* separadores */

  /* Brand */
  --brand: #2563eb;            /* azul principal */
  --brand-hover: #1d4ed8;

  /* Semánticos */
  --positive: #22c55e;         /* verde — ganancias, ingresos */
  --negative: #ef4444;         /* rojo — pérdidas, egresos */
  --warning: #f59e0b;          /* amarillo — por cobrar, neutro */
  --info: #3b82f6;             /* azul claro — inversiones */

  /* Texto */
  --text-primary: #f5f5f5;
  --text-secondary: #a1a1aa;
  --text-muted: #52525b;

  /* Espaciado */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
}
```

Reemplazar todos los valores hardcodeados de colores en los componentes por estas variables.

---

## 2. Sidebar — rediseño completo

Archivo: `src/components/sidebar/Sidebar.tsx` (o equivalente)

### Logo
```tsx
// Logo FNCE arriba: ícono + texto más refinado
<div className="flex items-center gap-2.5 px-4 py-5">
  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
    <span className="text-white font-bold text-sm">$</span>
  </div>
  <span className="text-white font-semibold text-base tracking-tight">FNCE</span>
</div>
```

### Items de navegación
Cambiar el estilo del item activo: en lugar del fondo azul sólido, usar un fondo sutil con acento de borde izquierdo:

```tsx
// Item activo
const activeClass = "bg-[#1c1c1c] text-white border-l-2 border-blue-500 pl-[calc(1rem-2px)]"
// Item inactivo
const inactiveClass = "text-zinc-400 hover:text-zinc-200 hover:bg-[#161616] border-l-2 border-transparent pl-[calc(1rem-2px)]"

// Estructura de cada item:
<Link
  href={href}
  className={`flex items-center gap-3 py-2.5 pr-4 rounded-r-lg mr-2 transition-all duration-150 text-sm font-medium ${isActive ? activeClass : inactiveClass}`}
>
  <Icon size={16} className="flex-shrink-0" />
  <span>{label}</span>
</Link>
```

### Separador visual entre nav y footer del sidebar
```tsx
<div className="mt-auto pt-4 border-t border-[#1a1a1a] mx-4 pb-4">
  {/* avatar del usuario aquí si aplica */}
</div>
```

---

## 3. Header — refinamiento

Archivo: `src/components/layout/Header.tsx` (o equivalente)

```tsx
// Header con separador inferior sutil
<header className="h-14 flex items-center justify-between px-6 border-b border-[#1a1a1a] bg-[#0a0a0a]">
  <h1 className="text-sm font-medium text-zinc-400">{sectionName}</h1>
  <div className="flex items-center gap-3">
    {/* avatar */}
    <img 
      src={user?.user_metadata?.avatar_url || '/default-avatar.png'} 
      className="w-8 h-8 rounded-full object-cover ring-1 ring-white/10"
    />
  </div>
</header>
```

---

## 4. Cards — componente unificado

Actualizar todas las cards en Finanzas, Trading, Portfolio y Dashboard para usar este patrón:

```tsx
// Card base — fondo ligeramente más claro que el bg de la app
// bg-[#141414] + borde sutil + radius consistente
<div className="bg-[#141414] rounded-xl border border-[#242424] p-5">
  
  {/* Label de la card */}
  <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-3">
    Total Ingresos
  </p>
  
  {/* Valor principal — tamaño según contexto */}
  <p className="text-2xl font-bold text-green-400 tabular-nums">
    $155,000.00
  </p>
  
  {/* Valor secundario opcional */}
  <p className="text-xs text-zinc-500 mt-1">Este mes</p>
  
</div>
```

### Grid de cards en Finanzas — 3 columnas limpias
```tsx
<div className="grid grid-cols-3 gap-3">
  <Card label="Total Ingresos" value={formatMXN(totalIngresos)} color="positive" />
  <Card label="Total Egresos" value={formatMXN(totalEgresos)} color="negative" />
  <Card label="Ganancia Neta" value={formatMXN(neta)} color={neta >= 0 ? 'positive' : 'negative'} />
</div>
```

Eliminar las cards de "Por Cobrar" e "Inversiones" del grid principal de Finanzas — son datos secundarios. Moverlas a una fila inferior más pequeña o quitarlas del todo en la vista de Finanzas (ya aparecen en el Dashboard).

---

## 5. Tipografía — jerarquía clara

Aplicar en toda la app:

```
Títulos de página:    text-xl font-semibold text-white           (ej: "Finanzas", "Trading")
Subtítulos:           text-sm text-zinc-500                      (ej: "Registro y bitácora")
Labels de card:       text-xs font-medium text-zinc-500 uppercase tracking-widest
Valores grandes:      text-2xl font-bold tabular-nums            (con color semántico)
Valores secundarios:  text-sm text-zinc-400 tabular-nums
Body texto:           text-sm text-zinc-400
```

`tabular-nums` es importante para números — evita que cambien de ancho al actualizar.

---

## 6. Sección Finanzas — limpieza de layout

En `src/app/finanzas/page.tsx`:

### Header de la sección
```tsx
<div className="flex items-center justify-between mb-6">
  <div>
    <h1 className="text-xl font-semibold text-white">Finanzas</h1>
    <p className="text-sm text-zinc-500 mt-0.5">Control de ingresos y egresos</p>
  </div>
  <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
    + Nueva Transacción
  </button>
</div>
```

### Filtros de tipo (tabs)
Los tabs actuales (Todos, Ingreso, Egreso...) tienen demasiado espacio. Compactarlos:
```tsx
<div className="flex gap-1 mb-5 overflow-x-auto pb-1">
  {TIPOS.map(tipo => (
    <button
      key={tipo.value}
      onClick={() => setFiltro(tipo.value)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
        filtro === tipo.value 
          ? 'bg-[#1c1c1c] text-white border border-[#333]' 
          : 'text-zinc-500 hover:text-zinc-300'
      }`}
    >
      {tipo.label}
      {tipo.count > 0 && (
        <span className="bg-[#2a2a2a] text-zinc-400 px-1.5 py-0.5 rounded text-xs">{tipo.count}</span>
      )}
    </button>
  ))}
</div>
```

---

## 7. Sección Trading — limpieza

El layout actual de Trading está bien estructuralmente. Aplicar:
- Mismo header pattern que Finanzas
- Cards con el nuevo estilo unificado
- El P&L Calendar mantenerlo — es un feature valioso, solo ajustar colores a la paleta

---

## 8. Dashboard — refinamiento visual

El Dashboard actual tiene buena estructura. Ajustes:

```tsx
// Selector de período — más refinado
<div className="inline-flex bg-[#141414] border border-[#242424] rounded-lg p-0.5 gap-0.5">
  {PERIODOS.map(p => (
    <button
      key={p.value}
      onClick={() => setPeriodo(p.value)}
      className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
        periodo === p.value 
          ? 'bg-[#242424] text-white shadow-sm' 
          : 'text-zinc-500 hover:text-zinc-300'
      }`}
    >
      {p.label}
    </button>
  ))}
</div>
```

Los labels de las secciones ("RESUMEN FINANZAS", "RESUMEN TRADING") — cambiar de todo mayúsculas a case normal con color más sutil:
```tsx
<h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">
  Resumen Finanzas
</h2>
```

---

## 9. Tabla de transacciones en Finanzas

```tsx
// Header de tabla
<thead>
  <tr className="border-b border-[#1a1a1a]">
    <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-widest pb-3 pr-4">
      Fecha
    </th>
    {/* etc */}
  </tr>
</thead>

// Filas
<tbody>
  {transacciones.map(t => (
    <tr key={t.id} className="border-b border-[#141414] hover:bg-[#141414] transition-colors group">
      <td className="py-3 pr-4 text-sm text-zinc-400">{formatFecha(t.fecha)}</td>
      <td className="py-3 pr-4 text-sm text-white">{t.concepto}</td>
      <td className={`py-3 text-sm font-medium tabular-nums text-right ${
        t.tipo === 'Ingreso' ? 'text-green-400' : 'text-red-400'
      }`}>
        {t.tipo === 'Ingreso' ? '+' : '-'}{formatMXN(t.monto)}
      </td>
    </tr>
  ))}
</tbody>
```

---

## Archivos a modificar
- `src/styles/globals.css` — agregar tokens CSS
- `src/components/sidebar/Sidebar.tsx` — rediseño completo
- `src/components/layout/Header.tsx` — refinamiento
- `src/app/finanzas/page.tsx` — header, tabs, tabla
- `src/app/trading/page.tsx` — header, cards
- `src/app/portfolio/page.tsx` — header, cards
- `src/app/dashboard/page.tsx` — selector período, labels
