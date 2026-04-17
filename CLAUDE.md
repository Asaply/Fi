# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start dev server on port 3005

# Build & Production
npm run build        # Build for production
npm run start        # Start production server

# Linting
npm run lint         # Run ESLint
```

> The dev server runs on **port 3005** (configured in `package.json` with `next dev --port 3005`).

## Environment

Requires a `.env.local` file with:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Architecture

**Stack:** Next.js 15 (App Router) + React 19 + Supabase (PostgreSQL)

All pages use `'use client'` and query Supabase directly from the browser via `@supabase/supabase-js`. There is no server-side data fetching layer — API routes exist only as proxies for external APIs (CoinGecko, Yahoo Finance) to avoid CORS and expose secrets.

**Path alias:** `@/*` → `./src/*`

### Key structural patterns

- `src/app/layout.js` — Root layout wraps everything in `TopbarContext`, renders `<Sidebar>` and `<Topbar>`
- `src/components/TopbarContext.js` — Global React context holding custom dashboards list and profile picture (persisted in `localStorage`)
- `src/lib/supabaseClient.js` — Single Supabase client instance imported everywhere

### Routes

| Route | Purpose |
|---|---|
| `/finanzas` | Income/expense/investment transaction log with monthly charts |
| `/clientes` | Client Kanban pipeline (5 stages) |
| `/prospectos` | Sales funnel (6 stages) with probability-weighted budgets |
| `/trading` | Trade journal (Long/Short) with P&L and win rate |
| `/portfolio` | Asset tracker with real-time prices (stocks via Yahoo Finance, crypto via CoinGecko) |
| `/airbnb` | Rental reservation management |
| `/perfil` | User profile and regional preferences |
| `/configuracion` | App settings, module visibility, data export |
| `/dashboards/[id]` | Custom widget-based dashboards (stored in `localStorage`) |

### API Routes

- `GET /api/crypto?ticker=BTC&range=7d` — Proxies CoinGecko for crypto price/history
- `GET /api/price?ticker=AAPL&range=1y` — Proxies Yahoo Finance for stock/ETF OHLC data

### Custom Dashboards (widgets)

9 widget types live in `src/components/widgets/`. The dashboard at `/dashboards/[id]` uses `react-grid-layout` for drag-to-resize/reorder. Widget configs and dashboard metadata are serialized to `localStorage` under the key `fnce_custom_dashboards`.

### Supabase tables

`transactions`, `clients`, `prospects`, `trading_operations`, `portfolio_assets`, `airbnb_reservations`

All tables use `id` (uuid), timestamps (`created_at`), and are queried client-side. Pages fall back to empty arrays if a table doesn't exist yet.

### Styling

Per-page CSS files co-located with each route (`Finanzas.css`, `Clientes.css`, etc.). Global base styles in `src/app/globals.css`. Dark theme using CSS custom properties. Key colors: success `#34c759`, danger `#ff3b30`, brand blue `#0A84FF`.
