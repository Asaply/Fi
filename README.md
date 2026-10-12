# NVA

App de finanzas personales: importa estados de cuenta de bancos mexicanos, categoriza gastos y
muestra resumen, presupuestos, trading y portafolio. Web en [nva.lat](https://www.nva.lat) y app iOS
(Capacitor).

**Stack:** Next.js 15 (App Router) · React 19 · Supabase · Stripe / Apple IAP · Capacitor 8 · Vercel

## Desarrollo

```bash
npm ci                 # Node 22.x
npm run dev            # http://localhost:3005
npm test               # vitest
npm run lint
npm run build
```

`.env.local` necesita al menos `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
Las demás variables (Stripe, Anthropic, Apple, Belvo, `SUPABASE_SERVICE_ROLE_KEY`) solo hacen
falta para las rutas de servidor que las usan.

## iOS

```bash
npm run cap:ios        # export estático + cap sync + abre Xcode
```

El paquete `ios/App/CapApp-SPM` resuelve los plugins desde `node_modules`. Si falta,
Xcode marca "Missing package product 'CapApp-SPM'": corre `npm ci`.

## Estructura

```
src/app/            páginas y API routes (src/app/api/)
src/components/     componentes compartidos
src/lib/            lógica: parsers de estados de cuenta, pagos, auth, rate limits
supabase/sql/       scripts SQL aplicados a mano en Supabase
__tests__/          tests (vitest)
scripts/            build de Capacitor y utilidades
docs/               arquitectura, cumplimiento App Store, motor de parsers
content/posts/      blog (MDX)
ios/                proyecto Xcode
```

Contexto para agentes: `CLAUDE.md` / `AGENTS.md`. Cola de tareas: `TASKS.md`.
