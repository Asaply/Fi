# FNCE — Claude Code Context

## Proyecto
App de finanzas personales. Next.js 15, App Router, React 19, Supabase, Tailwind CSS, dark theme.
- **Local:** http://localhost:3005
- **Prod:** https://finanzas-integraweb.vercel.app
- **Supabase project:** rdmvynbidxfesvdkuqga
- **Tablas:** transactions, trading_operations, portfolio_assets, clients, prospects

## Secciones
- `/dashboard` — resumen fijo, 3 secciones, gasto por categoría, filtro temporal
- `/finanzas` — ingresos/egresos, import CSV, categorías
- `/trading` — P&L, win rate, calendario
- `/portfolio` — precios en tiempo real vía Yahoo Finance + CoinGecko

## Workflow
Este proyecto usa **TASKS.md** como cola de tareas activa.

Al iniciar una sesión:
```
Lee CLAUDE.md y TASKS.md, luego implementa todas las tareas pendientes en orden.
```

Al terminar cada tarea, márcala como `✅` en TASKS.md antes de continuar con la siguiente.

## APIs externas
- **Yahoo Finance:** requiere proxy via API route de Next.js (CORS), cachear respuestas
- **CoinGecko:** free tier, sin API key, respetar rate limits, cachear respuestas

## Reglas
- No modificar lógica ni routing a menos que la tarea lo indique explícitamente
- Cambios de diseño/CSS: solo Tailwind classes y CSS variables, no inline styles
- Siempre correr `npm run build` al final para verificar que no hay errores de TypeScript
- Si hay ambigüedad en una tarea, implementa la interpretación más conservadora
