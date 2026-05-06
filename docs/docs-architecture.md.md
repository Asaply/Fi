```markdown
# NVA Architecture (estable)

## Stack
- Next.js 15 (App Router) + React 19
- Supabase (PostgreSQL + Auth)
- Tailwind CSS + CSS Modules
- Recharts, react-grid-layout
- Vercel (deploy) en intweb.mx
- Local: localhost:3005

## Estructura de rutas
- `/` → landing pública (no auth)
- `/analyze` → upload público (1 análisis gratis sin login)
- `/analyze/results` → wow moment (lee de sessionStorage)
- `/login` → auth (estilo World App)
- `/dashboard` → app autenticada
- `/finanzas`, `/trading`, `/portfolio` → secciones internas

## Flujo MVP
```

landing → /analyze → upload → /api/analyze (parsers reales) → sessionStorage → /analyze/results → "Crear cuenta" → /login → signup → claim hook lee sessionStorage → insert en transactions → /dashboard

```

## Parsers existentes (NO modificar lógica)
- `src/lib/parsers/bbva-parser.js` (PDF/CSV BBVA)
- `src/lib/parsers/bbva-credit-card-parser.md` (BBVA TDC)
- `src/lib/parsers/ai-statement-parser.js` (fallback genérico)
- Pendiente: Nu, Spin (verificar si existen)

## Supabase
- Project ID: `rdmvynbidxfesvdxuqga`
- Tablas clave: `transactions`, `trading_operations`, `portfolio_assets`, `clients`, `prospects`
- Auth: email + Google OAuth (pendiente config)

## Persistencia análisis pre-registro
- `sessionStorage["nva_pending_analysis"]` → datos del análisis temporal
- `localStorage["nva_free_analysis_used"]` → flag de gating (1 análisis gratis)
- Hook `useClaimPendingAnalysis(userId)` reclama y limpia tras signup

## Branding
- Naranja primario: `#FF8700` (color de la "A" del logo)
- Naranja secundario / fondo: `#FF6600`
- Background app: `linear-gradient(180deg, #FF6600 0%, #000 50%, #000 100%)`
- Logo files: `/public/nva-logo.svg`, `/public/nva-icon.svg`
```