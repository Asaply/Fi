# FNCE — CONTEXT.md
**Stack:** Next.js 15 · App Router · React 19 · Supabase · Tailwind CSS · Puerto 3005  
**Workflow:** `Read CONTEXT.md and [archivo].md, then implement all fixes.`  
**Obsidian vault:** `~/Documents/FNCE.md/`

---

## Estructura de archivos clave
```
src/
├── app/
│   ├── finanzas/
│   ├── trading/
│   ├── portfolio/
│   ├── dashboard/         ← layout fijo CSS Grid (v1)
│   └── dashboards/        ← DEPRECADO, no tocar
├── components/
│   ├── sidebar/
│   └── ui/
└── lib/
    └── supabase.ts
```

## Convenciones
- Dark theme Tailwind en toda la app
- Moneda: MXN (ser consistente, actualmente mezclado con USD)
- No usar `react-grid-layout` — eliminado en v1
- Dashboard `/dashboard` es fijo, sin drag/resize
- Clientes, Prospectos, Airbnb: ocultos en v1 (no eliminar código)

---

## Supabase
**Project ID:** `rdmvynbidxfesvdkuqga`  
**Tablas:** `transactions` · `trading_operations` · `portfolio_assets` · `clients` · `prospects`  
**Schema crítico:** `transactions` tiene columna `categoria` (ya existe, no recrear)

> Para tareas con DB usa también `CONTEXT-DB.md`  
> Para tareas de auth usa también `CONTEXT-AUTH.md`
