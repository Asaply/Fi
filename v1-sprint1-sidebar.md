# v1-sprint1-sidebar.md

## Objetivo
Limpiar el sidebar para la v1: ocultar secciones no incluidas, eliminar dashboards de prueba, dejar solo Finanzas, Trading, Portfolio Health y un Dashboard fijo.

---

## Cambios requeridos

### 1. Sidebar — ocultar secciones v1
En el componente del sidebar (probablemente `src/components/sidebar/Sidebar.tsx` o similar), modificar la lista de navegación:

**MANTENER:**
- Finanzas → `/finanzas`
- Trading → `/trading`
- Portfolio Health → `/portfolio`
- Dashboard → `/dashboard` (nuevo link, ver Sprint 2)

**OCULTAR (no eliminar el código, solo no renderizar):**
- Clientes
- Prospectos
- Airbnb

Envolver los items a ocultar en una condición:
```tsx
{process.env.NEXT_PUBLIC_SHOW_BETA_FEATURES === 'true' && (
  <SidebarItem href="/clientes" label="Clientes" icon={...} />
)}
```

Agregar en `.env.local`:
```
NEXT_PUBLIC_SHOW_BETA_FEATURES=false
```

### 2. Sidebar — eliminar sección "MIS DASHBOARDS"
Eliminar completamente el bloque que renderiza la lista de dashboards personalizados ("prueba financero", "prueba 2", "prueba 3") del sidebar.

Reemplazar por un único item estático:
```tsx
<SidebarItem href="/dashboard" label="Dashboard" icon={LayoutDashboard} />
```

### 3. Sidebar — orden final
El orden del sidebar debe quedar:
1. Finanzas
2. Trading  
3. Portfolio Health
4. Dashboard

Sin separadores intermedios, sin labels de sección como "MIS DASHBOARDS".

### 4. Header — breadcrumb
El header actualmente muestra "Dashboard / Abril" hardcodeado. Cambiar para que muestre el nombre de la sección activa basado en la ruta:
- `/finanzas` → "Finanzas"
- `/trading` → "Trading"
- `/portfolio` → "Portfolio Health"
- `/dashboard` → "Dashboard"

---

## Archivos a modificar
- `src/components/sidebar/Sidebar.tsx` (o donde esté el sidebar)
- `src/components/layout/Header.tsx` (o donde esté el header)
- `.env.local` — agregar `NEXT_PUBLIC_SHOW_BETA_FEATURES=false`

## Verificación
Al terminar, el sidebar debe verse así:
```
[FNCE logo]

• Finanzas       ← activo resaltado en azul
• Trading
• Portfolio Health
• Dashboard
```
Sin más items. Sin secciones de dashboards. Sin Clientes/Prospectos/Airbnb.
