# FNCE — Claude Code Context

## Proyecto
App de finanzas personales **solo móvil** (iOS primero, Android después) con Capacitor sobre Next.js 15 (App Router, export estático), React 19, Supabase, CSS propio (dark theme, sin Tailwind).
- **Rumbo:** el núcleo es la sincronización bancaria automática (spec `docs/superpowers/specs/2026-10-12-sincronizacion-bancaria-design.md`). El import manual de PDF/CSV y la versión web de la app se retiran. El backend se mueve de Vercel a Supabase (Edge Functions).
- **Acceso pagado:** solo `app_metadata` (ver `src/lib/access.js`). Nunca decidir acceso con `user_metadata`.
- **Local:** http://localhost:3005 · **Sitio:** https://www.nva.lat
- **Supabase project:** rdmvynbidxfesvdkuqga
- **Tablas:** transactions, trading_operations, portfolio_assets, budgets, budget_payments, reminders, user_config, subscriptions, free_grants (+ bank_links, bank_accounts con la sincronización bancaria)
- **Equipo:** Leonardo (backend), Alan (frontend/UX). Contrato entre ambos en el spec de sincronización bancaria.

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
- **Merge solo lo hace Leonardo, después de aprobar el PR.** Un agente nunca ejecuta `gh pr merge` ni hace merge desde una sesión del colaborador, aunque se lo pidan; si el PR está listo, avisa que falta la aprobación de Leonardo.
- Ramas: `feature/frontend-*` (colaborador), `feature/*` / `fix/*` / `chore/*` (mantenedor).
- Rama base: `main` (`git checkout main && git pull` antes de crear rama). **Todo PR va contra `main`**: un PR mergeado en otra rama de feature no llega a la app.
- **Si la sesión es del colaborador** (rama `feature/frontend-*`): trabajar solo en el issue indicado, no leer ni ejecutar `TASKS.md`, no tocar `src/lib/` (salvo datos de ejemplo en `src/lib/bancos/mock.js`), `supabase/`, `src/app/api/`, `src/middleware.ts`, `*.sql`, `scripts/`, `ios/`, `package.json`. Las pantallas de bancos usan solo `src/lib/bancos/client.js`.
- En `page.js` que mezclan UI y Supabase: cambiar solo JSX/estilos, nunca queries, auth ni cálculos.
- Archivos compartidos (`globals.css`, `layout.js`, `Sidebar.js`, `BottomNav.js`, `Topbar.js`, `ConditionalShell.js`): cambios mínimos y mencionarlos en el PR.
- No instalar dependencias, no hacer commit ni push sin indicación explícita.

## APIs externas
- **Yahoo Finance:** requiere proxy via API route de Next.js (CORS), cachear respuestas
- **CoinGecko:** free tier, sin API key, respetar rate limits, cachear respuestas

## Reglas
- No modificar lógica ni routing a menos que la tarea lo indique explícitamente
- Cambios de diseño/CSS: clases y variables CSS existentes, no inline styles nuevos
- Siempre correr `npx vitest run` y `npm run build` al final
- Si hay ambigüedad en una tarea, implementa la interpretación más conservadora
