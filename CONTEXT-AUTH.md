# FNCE — CONTEXT-AUTH.md
> Cargar junto a CONTEXT.md solo en tareas de autenticación (Sprint 5+).

---

## Estado actual
- Auth con email: implementado parcialmente
- Google OAuth: pendiente — falta configurar en Google Cloud Console y activar provider en Supabase dashboard

## Flujo objetivo
1. `/login` — email+pass o Google OAuth
2. On first login → onboarding screen
3. Todas las rutas protegidas → redirect a `/login` si no hay sesión
4. Datos separados por `user_id` con RLS en Supabase

## Configuración pendiente (manual, no código)
- [ ] Google Cloud Console: crear OAuth client ID para dominio de producción
- [ ] Supabase Dashboard → Auth → Providers → Google: pegar client ID + secret
- [ ] Agregar redirect URL: `https://rdmvynbidxfesvdkuqga.supabase.co/auth/v1/callback`

## Archivos relevantes
- `src/lib/supabase.ts` — cliente Supabase
- `src/app/login/` — página de login
- `src/middleware.ts` — protección de rutas (crear si no existe)
