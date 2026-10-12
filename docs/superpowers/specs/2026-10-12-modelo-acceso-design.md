# Subproyecto 1 — Nuevo modelo de acceso

**Fecha:** 2026-10-12 · **Estado:** aprobado · plan: `docs/superpowers/plans/2026-10-12-modelo-acceso.md`

Forma parte de la reestructura de NVA. Orden de los subproyectos: **1. modelo de acceso** →
2. colaborador frontend → 3. Belvo como fuente principal → 4. import PDF/CSV como secundario.

## Objetivo

1. Quitar el análisis gratis sin cuenta (`/analyze`).
2. Dejar de dar lugares gratis de por vida (los 150), respetando a quien ya tiene uno.
3. Entrada única: **prueba gratis de 7 días** y luego suscripción mensual.
4. Cerrar dos hoyos de seguridad:
   - **Paywall evitable:** el acceso se lee de `user_metadata`, que cualquier usuario puede
     modificar con `supabase.auth.updateUser`.
   - **IA sin pagar:** `/api/analyze` acepta a cualquier usuario logueado, haya pagado o no, y también a anónimos.

## Fuera de alcance

Belvo, cambios de UX más allá de textos y CTAs, precios nuevos y el colaborador. Cada uno va
en su subproyecto.

## Decisiones

| Tema | Decisión |
|---|---|
| Entrada de usuarios nuevos | Prueba de 7 días con todas las funciones |
| Tarjeta en web | Sí. Stripe Checkout con `subscription_data.trial_period_days: 7`; al terminar cobra solo |
| Quién recibe la prueba | Solo quien nunca tuvo fila en `subscriptions`. Quien cancela y vuelve paga desde el día 1 |
| Onboarding | Planes **antes** de importar: … → Seguridad → **Planes** → Importar → Insights → Listo |
| Prueba en iOS | Oferta introductoria de 7 días configurada en App Store Connect (sin cambios de código) |
| Usuarios con lugar free | Conservan acceso de por vida (`status: 'free'`, sin vencimiento) |
| Dónde vive el acceso | `app_metadata`, que solo el servidor (service role) puede escribir |
| Precio | Sin cambios (`STRIPE_PRICE_ID` y producto de Apple actuales) |

Alternativas descartadas para guardar el acceso:
- **La tabla `subscriptions` como fuente en cada request:** el middleware consultaría la base en
  cada navegación desde el edge. Es más lento y agrega un punto de falla.
- **Custom claims con Auth Hook:** agrega una función en Postgres y configuración del hook sin
  beneficio real sobre `app_metadata`.

## Modelo de acceso

`app_metadata` lleva las mismas claves que hoy usa `user_metadata`:

```
subscription_status:     'active' | 'free' | 'expired'
subscription_source:     'stripe' | 'apple' | 'free' | 'stripe_legacy'
subscription_expires_at: ISO string | null   // null = no vence
```

| Estado | Quién | Acceso |
|---|---|---|
| `active` con `expires_at` | Suscriptores Stripe/Apple, incluida la prueba (Stripe `trialing` → `active`) | Hasta `expires_at` + 24 h de gracia |
| `active` sin `expires_at` | Pagos únicos legacy (`stripe_legacy`) | Siempre |
| `free` | Quien ya tiene uno de los 150 lugares | Siempre |
| `expired` / sin estado | Todos los demás | Paywall |

`hasAccess()` (`src/lib/access.js`) conserva su lógica; solo cambia de dónde se lee.
`user_metadata` queda para datos del perfil que el usuario sí puede editar (`onboarded`, `display_name`).

## Cambios

### Se borra
- Páginas `src/app/analyze/` (análisis y resultados).
- `src/lib/freeTier.js` y `src/app/api/access/claim/route.js`.
- La sección "quedan X de 150" en onboarding y paywall.
- El camino anónimo de `/api/analyze`, incluido `checkAnonRateLimit` (`src/lib/rateLimitAnon.js`).
- Las referencias a `/analyze` en `middleware.ts`, `ConditionalShell.js` y `sitemap.js`, y el mensaje
  `free_analysis_used` en `login/page.js`.
- `src/lib/hooks/useClaimPendingAnalysis.js` y la clave de `sessionStorage`. El **PR #4 se cierra sin hacer
  merge**. Su mapeo con tests (`analysisToTransactionRows`) se conserva, movido a `src/lib/finanzas/analysisRows.js`,
  y lo usa el onboarding.

### Se modifica
- **Lectura de acceso:** todas las llamadas a `hasAccess` que hoy reciben `user_metadata` pasan a
  `app_metadata`: `middleware.ts`, `login/page.js` (3), `paywall/page.js`, `paywall/success/page.js` (2),
  `onboarding/page.js` y `NativeAuthDeepLink.js`. `perfil/page.js` ya lee de `subscriptions` y no cambia.
- **Escritura de acceso:** `applyStripeSubscription` (`stripeSync.js`) y
  `applyAppleSubscription` (`appleIap.js`) escriben `app_metadata` **y** siguen escribiendo
  `user_metadata` como espejo (ver *Compatibilidad iOS*).
- **Stripe Checkout** (`api/stripe/create-checkout`): agrega `trial_period_days: 7`.
- **`/api/analyze`:** exige sesión y `hasAccess(app_metadata)`; si no, responde 401/402. Se conserva el
  rate limit por usuario (10/min).
- **Onboarding:**
  - Nuevo orden de pasos: Planes (6) → Importar (7) → Insights (8) → Listo (9). Saltar el import lleva a Listo.
  - `onboarded: true` se escribe **solo al final** (`complete()`), ya no al llegar a Planes.
  - **Retomar:** al abrir `/onboarding`, si el usuario ya tiene acceso → salta a Importar. Si no tiene acceso pero
    ya tiene `display_name` (pasó el paso del nombre) → salta a Planes. Si no, empieza desde el principio. Esto
    cubre el regreso desde Stripe en web (`/paywall/success` → `/onboarding`) y a quien cerró la app en Planes.
  - El import manda `Authorization: Bearer` (hoy va anónimo) y mapea con `analysisToTransactionRows`,
    con lo que se corrige el bug actual de tipos (`'egreso'` en minúsculas) y del `account_type` crudo.
- **Middleware:** `/paywall/success` se permite a usuarios sin onboarding, para que la verificación del pago
  termine antes de regresar al onboarding.
- **Landing y blog:** los CTA "Empezar gratis" → `/login`, con el texto "Prueba 7 días gratis".
- **Paywall:** un solo plan, "7 días gratis, luego $X/mes" (precio actual).
- **Privacidad** (`privacy/page.js`): "Dirección IP (para límites de uso en análisis gratuitos)" pasa a
  "Dirección IP (para seguridad y límites de uso)", porque la IP se sigue registrando en `audit_logs`. Se quita
  "Resultados de análisis temporales (se eliminan al cerrar el navegador)".
- **`anon_rate_limits`:** `enable row level security` sin políticas; solo la service role puede acceder.
  Se conserva porque `checkRateLimit` la usa para usuarios logueados.

### Se conserva
- La tabla `free_grants`, como registro de quién tiene un lugar free. Ya no recibe filas nuevas.
- La RPC `claim_free_slot` queda sin uso; se puede borrar en una limpieza posterior de la base.

## Migración

La fuente de verdad son las tablas `subscriptions` y `free_grants`, no los metadatos. Así el
script se puede correr las veces que haga falta y siempre da el estado correcto.

**Script** `scripts/migrate-access-to-app-metadata.mjs` (service role, lee `.env.local`):
- Por cada usuario de `auth.users`:
  - Si tiene fila en `subscriptions`, usa `status`, `source` y `current_period_end` → `expires_at`.
  - Si no, pero está en `free_grants`, usa `status: 'free'`, `source: 'free'` y `expires_at: null`.
  - Si no tiene ninguna, pero `user_metadata.subscription_source === 'stripe_legacy'`, copia ese estado
    (los pagos únicos anteriores al sistema de suscripciones no siempre tienen fila en `subscriptions`).
  - Si no tiene nada de lo anterior, no lo toca.
- `--dry-run` por defecto: imprime conteos por estado y los usuarios cuyo resultado difiere de su
  `user_metadata` actual. `--apply` escribe.

**Orden de despliegue**
1. Correr el script con `--dry-run`, revisar los conteos y luego correrlo con `--apply`. Nada lee `app_metadata`
   todavía, así que es inofensivo.
2. Deploy del código nuevo.
3. Volver a correr el script con `--apply` justo después, para capturar renovaciones que llegaron entre los pasos 1 y 2.

**Reversa:** revertir el deploy. `user_metadata` sigue escrito (espejo), así que el código viejo funciona.

## Compatibilidad iOS

El build de iOS que ya está en la App Store decide el acceso en el cliente leyendo `user_metadata`. Si
dejamos de escribirlo, los suscriptores de iOS perderían acceso hasta actualizar. Por eso los webhooks
siguen escribiendo ambos campos. Mantener el espejo no reabre el hoyo, porque ninguna validación del servidor
(middleware, `/api/analyze`, Belvo) lo lee. Se quita cuando ya no haya usuarios en builds anteriores
a este cambio.

## Errores y casos límite

- **Prueba cancelada antes del día 7:** Stripe manda `customer.subscription.deleted`, que ya se mapea a `expired`.
- **Cobro fallido al terminar la prueba:** `past_due` sigue mapeado a `active` hasta `expires_at` + gracia
  (comportamiento actual).
- **Usuario free que además compra:** gana la fila de `subscriptions`. En el script, `subscriptions`
  tiene prioridad sobre `free_grants`. Si su suscripción vence, el script lo regresaría a `free`, y está bien.
- **Pantalla `/paywall/success` antes del webhook:** ya verifica la sesión con `verify-session`, que ahora
  escribe `app_metadata` vía `applyStripeSubscription`.

## Pruebas

- **Unitarias (vitest):** `hasAccess` con cada estado de la tabla; mapeo `subscriptions`/`free_grants` →
  `app_metadata` del script (función pura extraída); `mapStripeSubscription` con `trialing`.
- **Seguridad:** con un usuario de prueba y la anon key, `updateUser({ data: { subscription_status: 'free' } })`
  no da acceso. El middleware redirige a `/paywall` y `/api/analyze` responde 402.
- **En el preview (Stripe en modo test):**
  - Cuenta nueva → paywall → checkout con trial → acceso → `/finanzas`.
  - Usuario free migrado conserva el acceso.
  - Sin sesión, `/analyze` da 404 y `/api/analyze` responde 401.
- `npm run build` y lint sin errores nuevos.

## Pendientes fuera de código (dueño: Leonardo)

- Configurar en App Store Connect la oferta introductoria gratis de 7 días.
- Confirmar el texto de precio del paywall.
- Revisar el texto final de Privacidad después de los cambios (Términos no menciona el análisis gratis).
