# FNCE — CONTEXT.md
**Última actualización:** Abril 2026  
**Stack:** Next.js 15, App Router, React 19, Supabase, Tailwind CSS, puerto 3005  
**Workflow:** Obsidian → ~/Documents/FNCE → Claude Code con: `Read CONTEXT.md and [archivo].md, then implement all fixes`

---

## Estado de secciones

### ✅ TERMINADO / FUNCIONAL
- **Finanzas** — Cards de métricas, gráfica ingresos/egresos, filtros por tipo (Ingreso, Egreso, Gasto Personal, Inversión), formulario de nueva transacción, importar CSV. Bug conocido: Total Egresos muestra $0.00 (pendiente fix).
- **Trading** — Cards P&L realizado, Win Rate, Trades abiertos. Calendario P&L. Bug: Win Rate puede ser inconsistente con datos mixtos.
- **Portfolio Health** — Funcional con Yahoo Finance + CoinGecko. Cards de valor total, P&L, mejor/peor activo. Tabla de activos con precio en tiempo real. Botón Agregar Activo.

### 🔴 OCULTAR EN V1 (no eliminar código)
- **Clientes** — Visible en sidebar pero debe ocultarse para v1
- **Prospectos** — Visible en sidebar pero debe ocultarse para v1  
- **Airbnb** — Visible en sidebar pero debe ocultarse para v1

### 🔄 EN REDISEÑO
- **Dashboards** — react-grid-layout con bugs de espaciado. Plan: reemplazar por dashboard fijo no customizable para v1. Los dashboards "prueba financero", "prueba 2", "prueba 3" son de prueba y deben eliminarse. La sección "MIS DASHBOARDS" del sidebar se reemplaza por un solo link "Dashboard" que va a una vista fija.

---

## Bugs críticos pendientes
1. Total Egresos $0.00 en Finanzas (datos existen pero no suma correctamente)
2. Win Rate inconsistente en Trading cuando hay trades mixtos
3. Dashboard personalizable con espacios negros muertos (react-grid-layout h values)
4. Sidebar muestra secciones que deben estar ocultas en v1 (Clientes, Prospectos, Airbnb)
5. "MIS DASHBOARDS" muestra dashboards de prueba con nombres de testing

---

## Roadmap V1 — Sprints

### SPRINT 1 — Sidebar + Navegación limpia
Archivo: `v1-sprint1-sidebar.md`
- Ocultar Clientes, Prospectos, Airbnb del sidebar (condición `SHOW_V1_ONLY`)
- Eliminar sección "MIS DASHBOARDS" con prueba-1/2/3
- Agregar link "Dashboard" único en sidebar que apunta a `/dashboard`
- Limpiar títulos del sidebar

### SPRINT 2 — Dashboard fijo (reemplaza react-grid-layout)
Archivo: `v1-sprint2-dashboard-fijo.md`
- Eliminar react-grid-layout completamente
- Crear `/dashboard` con layout fijo CSS Grid: resumen de Finanzas + Trading + Portfolio
- 3 secciones: Resumen Financiero (ingresos/egresos del mes), Resumen Trading (P&L + Win Rate), Resumen Portfolio (valor total + P&L)
- Sin drag, sin resize, sin customización

### SPRINT 3 — Bugs críticos Finanzas + Trading
Archivo: `v1-sprint3-bugs.md`
- Fix Total Egresos $0.00
- Fix Win Rate inconsistente
- Agregar categoría en formulario de transacción (actualmente falta)
- Formato de moneda consistente en toda la app (MXN vs USD)

### SPRINT 4 — Design System + UI Polish
Archivo: `v1-sprint4-design.md`
- Tokens de diseño unificados (colores, tipografía, espaciado)
- Empty states en Finanzas, Trading y Portfolio cuando no hay datos
- Estados de carga (skeleton loaders) consistentes
- Sidebar: solo mostrar secciones activas en v1
- Header limpio sin "Dashboard / Abril" hardcodeado

### SPRINT 5 — Auth + Onboarding
Archivo: `v1-sprint5-auth.md`
- Login con email + Google (Supabase Auth)
- Pantalla de onboarding al primer login
- Datos separados por usuario (Row Level Security en Supabase)
- Ruta protegida: redirect a /login si no hay sesión

---

## Estructura de archivos clave
```
~/Documents/FNCE/
├── CONTEXT.md              ← este archivo
├── src/
│   ├── app/
│   │   ├── finanzas/
│   │   ├── trading/
│   │   ├── portfolio/
│   │   ├── dashboard/      ← nuevo (sprint 2)
│   │   └── dashboards/     ← deprecar en v1
│   ├── components/
│   │   ├── sidebar/
│   │   ├── widgets/        ← deprecar en v1
│   │   └── ui/
│   └── lib/
│       └── supabase.ts
```

---

## Decisiones técnicas tomadas
- **react-grid-layout:** Se elimina en v1. Demasiados bugs para el valor que aporta.
- **Dashboard:** Vista fija CSS Grid en v1. Customizable en v2.
- **Moneda:** Definir si la app es MXN o USD y ser consistente. Actualmente mezclado.
- **Supabase:** Backend principal. Auth en sprint 5.
- **Yahoo Finance + CoinGecko:** APIs gratuitas para Portfolio. Sin API key requerida. CORS fix via Next.js API routes.
