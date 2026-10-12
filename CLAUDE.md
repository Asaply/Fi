# FNCE — Claude Code Context

## Proyecto
App de finanzas personales. Next.js 15, App Router, React 19, Supabase, Tailwind CSS, dark theme.
- **Local:** http://localhost:3005
- **Prod:** https://www.nva.lat
- **Supabase project:** rdmvynbidxfesvdkuqga
- **Tablas:** transactions, trading_operations, portfolio_assets, clients, prospects

## Secciones
- `/dashboard` — resumen fijo, 3 secciones, gasto por categoría, filtro temporal
- `/finanzas` — ingresos/egresos, import CSV, categorías
- `/trading` — P&L, win rate, calendario
- `/portfolio` — precios en tiempo real vía Yahoo Finance + CoinGecko

## Workflow
**TASKS.md** es la cola de tareas del mantenedor (no del colaborador — ver Colaboración).

Al iniciar una sesión:
```
Lee CLAUDE.md y TASKS.md, luego implementa todas las tareas pendientes en orden.
```

Al terminar cada tarea, márcala como `✅` en TASKS.md antes de continuar con la siguiente.

## Colaboración (dos personas en el repo)
Guía completa: `docs/COLABORACION.md`.
- **Nunca trabajar ni hacer push en `main`.** Todo entra por rama + Pull Request.
- Ramas: `feature/frontend-*` (colaborador), `feature/*` / `fix/*` / `chore/*` (mantenedor).
- Antes de empezar: `git checkout main && git pull`, luego crear rama.
- **Si la sesión es del colaborador** (rama `feature/frontend-*`): trabajar solo en el issue indicado, no leer ni ejecutar `TASKS.md`, no tocar `src/lib/`, `src/app/api/`, `src/middleware.ts`, `*.sql`, `scripts/`, `ios/`, `package.json`.
- En `page.js` que mezclan UI y Supabase: cambiar solo JSX/estilos, nunca queries, auth ni cálculos.
- Archivos compartidos (`globals.css`, `layout.js`, `Sidebar.js`, `BottomNav.js`, `Topbar.js`, `ConditionalShell.js`): cambios mínimos y mencionarlos en el PR.
- No instalar dependencias, no hacer commit ni push sin indicación explícita.

## APIs externas
- **Yahoo Finance:** requiere proxy via API route de Next.js (CORS), cachear respuestas
- **CoinGecko:** free tier, sin API key, respetar rate limits, cachear respuestas

## Reglas
- No modificar lógica ni routing a menos que la tarea lo indique explícitamente
- Cambios de diseño/CSS: solo Tailwind classes y CSS variables, no inline styles
- Siempre correr `npm run build` al final para verificar que no hay errores de TypeScript
- Si hay ambigüedad en una tarea, implementa la interpretación más conservadora
