# NVA — Documentación Técnica y Funcional Completa
### Para auditoría de cumplimiento con las App Store Review Guidelines

> Documento autocontenido. Asume que el lector nunca ha visto el proyecto.
> Estado al momento de redacción: versión **1.0**, build **10** en revisión de Apple.
> Bundle ID: **lat.nva.app**. Producto en App Store Connect: **NVA Finanzas Personales**.

---

## 1. Descripción general

**Objetivo.** NVA es una app de finanzas personales para México. Permite al usuario entender su situación financiera (gastos, ingresos, inversiones, patrimonio) subiendo sus estados de cuenta bancarios (PDF/CSV) o conectando su banco, y obteniendo análisis y categorización automática mediante inteligencia artificial.

**Problema que resuelve.** Las personas no tienen una visión consolidada de su dinero: sus movimientos están repartidos entre varios bancos y apps. NVA centraliza esa información, la categoriza automáticamente, detecta patrones de gasto ("fugas de dinero") y presenta métricas claras (ingresos/egresos, gasto por categoría, P&L de trading, valor de portafolio).

**Público objetivo.** Usuarios mexicanos de banca personal (Nu, BBVA, Banorte, Santander, HSBC, Citibanamex, Spin, Mercado Pago, Hey Banco, etc.), incluyendo personas que invierten/tradean y quieren seguimiento de portafolio.

**Funciones principales.**
- Importación y análisis de estados de cuenta (PDF/CSV) con IA.
- Categorización automática de transacciones.
- Conexión bancaria vía proveedor de open banking (Belvo).
- Dashboard financiero (resumen, gasto por categoría, filtros temporales).
- Sección de finanzas (ingresos/egresos, importación CSV, categorías).
- Sección de trading (P&L, win rate, calendario).
- Portafolio con precios en tiempo real (Yahoo Finance + CoinGecko).
- Presupuestos y recordatorios.
- Suscripción mensual de pago + tier gratuito limitado.

---

## 2. Arquitectura

**Modelo híbrido (clave para entender todo el proyecto).** Existe **un solo** código base Next.js que se despliega de **dos formas**:

1. **Web** — desplegado en Vercel en `https://www.nva.lat` (y apex `https://nva.lat`). Renderizado con SSR + middleware; las rutas API corren como funciones serverless en Vercel.
2. **App nativa iOS** — el mismo proyecto se compila como **export estático** (`next build` con `output: export`, salida en `out/`) y se empaqueta dentro de un contenedor **Capacitor** (WKWebView). El bundle web vive localmente en el dispositivo (`capacitor://localhost`); **las llamadas a API NO corren en el dispositivo** — apuntan al backend remoto en Vercel (`https://www.nva.lat`) vía `API_BASE` / URLs absolutas.

Esto implica que en nativo las rutas API del repo no se ejecutan localmente; sirven solo en Vercel. El script `scripts/build-capacitor.js` "stubbea" temporalmente las rutas API dinámicas que romperían el export estático (las reemplaza por stubs `force-static` 503 durante el build y las restaura después).

**Stack tecnológico completo.**
- **Framework:** Next.js 15.5 (App Router) + React 19.2.
- **Lenguaje:** JavaScript (la mayoría) + TypeScript (`middleware.ts`).
- **Native wrapper:** Capacitor 8.3 (`@capacitor/core`, `@capacitor/ios`, `@capacitor/cli`).
- **Plugins Capacitor:** `@capacitor/app` (deep links), `@capacitor/haptics`, `@capacitor/keyboard`, `@capacitor/splash-screen`, `@capacitor/status-bar`, `@capacitor-community/apple-sign-in`.
- **Backend / DB / Auth:** Supabase (proyecto `rdmvynbidxfesvdkuqga`).
- **Hosting web + API serverless:** Vercel.
- **IA:** Anthropic Claude vía `@anthropic-ai/sdk` (modelos `claude-sonnet-4-6` y `claude-haiku-4-5-20251001`).
- **Open banking:** Belvo (`belvo` npm + widget JS `cdn.belvo.io`).
- **Pagos:** Stripe (web) + Apple StoreKit IAP (nativo) verificado con `@apple/app-store-server-library`.
- **PDF:** `pdf-parse`, `pdfjs-dist`, `jspdf`, `jspdf-autotable` (export de datos).
- **UI / gráficas:** `recharts`, `lucide-react`, `sonner` (toasts), `swr` (data fetching), `@vercel/analytics`.
- **Precios mercado:** Yahoo Finance + CoinGecko (vía rutas proxy `/api/price`, `/api/crypto`).

**Base de datos (tablas Supabase/Postgres identificadas en el código):**
`transactions`, `trading_operations`, `portfolio_assets`, `clients`, `prospects`, `budgets`, `reminders`, `subscriptions`, `audit_logs`, `anon_rate_limits`, `free_grants`. RLS por `user_id`; operaciones administrativas usan `SUPABASE_SERVICE_ROLE_KEY`.

**Autenticación.** Supabase Auth (detallado en §6).

**APIs externas / servicios:** Supabase, Anthropic (Claude), Belvo, Stripe, Apple App Store Server API/StoreKit, Yahoo Finance, CoinGecko, Vercel Analytics.

> Nota: **NO** se usa RevenueCat ni Plaid. La conexión bancaria es **Belvo**; las compras nativas son **StoreKit directo** (sin intermediario tipo RevenueCat).

---

## 3. Flujo completo del usuario

**Splash.** Nativo: `LaunchScreen` (Capacitor splash). El landing web (`/`) renderiza un "gate" negro a pantalla completa que se mantiene hasta que JS decide: en nativo `NativeRedirect` redirige a `/login`; en web elimina el gate y muestra la landing de marketing.

**Onboarding (solo cuentas nuevas).** Tras crear cuenta, el usuario entra a `/onboarding`, un flujo multipaso:
1. Pantalla de bienvenida ("Entiende a dónde va tu dinero").
2. Selección de objetivo principal (ahorrar / controlar gastos / invertir / mejorar finanzas) — opcional, "Saltar".
3. Pantalla de seguridad ("Tus datos están 100% protegidos").
4. "Sube tu primer estado de cuenta" (selección de PDF; "Más tarde" disponible).
5. **Paywall** ("Activa NVA al 100%") con tier gratis + suscripción.
6. Pantalla final ("¡Bienvenido a NVA!" → "Ir a mi dashboard").

El gating de onboarding se basa **únicamente** en `user_metadata.onboarded`. Al llegar al paso del paywall se marca `onboarded: true` (en segundo plano) y se carga el conteo de cupos gratis.

**Permisos.** La app solicita Cámara y Fotos **solo** cuando el usuario elige tomar/elegir foto de perfil. No solicita ubicación, contactos, ni notificaciones push.

**Registro.** En `/login`, modo "Nueva cuenta": email + contraseña (con validación de fuerza: mayúscula + número + 8 caracteres) + checkbox de aceptación de Términos y Política de privacidad. `supabase.auth.signUp` con `emailRedirectTo` condicional: **nativo** → `nvaapp://auth/callback`; **web** → `${origin}/auth/callback`. Se muestra pantalla "verifica tu correo".

**Inicio de sesión.** `supabase.auth.signInWithPassword`. Redirige según estado (onboarding → paywall → finanzas). Soporta MFA TOTP (challenge/verify) si el usuario lo tiene activado.

**Continuar con Apple.** Nativo: genera nonce, dispara el plugin nativo (vía `document.title = '__nvaAppleSignIn:<hash>'`), recibe el identity token y hace `supabase.auth.signInWithIdToken({ provider: 'apple', token, nonce })`. Web: `supabase.auth.signInWithOAuth({ provider: 'apple', redirectTo: ${origin}/auth/callback })`. **No** se pide nombre/email después (cumplimiento Guideline 4.0 — el flujo de onboarding salta el paso de nombre para usuarios de Apple).

**Continuar con Google.** Nativo: cliente Supabase basado en localStorage, `signInWithOAuth({ provider: 'google', redirectTo: 'nvaapp://auth/callback', skipBrowserRedirect: true })`; el Swift bridge abre `ASWebAuthenticationSession` con la URL y devuelve los tokens vía `window.__nvaHandleOAuthTokens(access, refresh)` → `setSession`. Web: OAuth estándar a `/auth/callback`.

**Recuperación de contraseña.** `supabase.auth.resetPasswordForEmail(email, { redirectTo: ${origin}/auth/callback?next=/auth/reset-password })`; pantalla `/auth/reset-password`.

**Logout.** `supabase.auth.signOut()` → redirige a `/login`. El middleware impide volver a rutas protegidas sin sesión (el "botón atrás" del WebView llevaría a `/login`).

**Eliminar cuenta.** En `/configuracion` → modal de confirmación → `DELETE /api/account`. La ruta autentica vía Bearer (nativo) o cookie (web) mediante `getAuthUser`, borra todas las tablas del usuario y elimina el usuario auth con la service role (eliminación completa en ambas plataformas).

**Agregar banco / Sincronizar cuentas.** Componente `BankConnectWidget`: carga el widget de Belvo (`cdn.belvo.io/belvo-widget-1-stable.js`), obtiene token seguro de `GET /api/belvo/token`, abre el widget, y al completar recibe un `link_id`. Con ese `link_id` se llama `POST /api/belvo/transactions` para traer y mapear movimientos (últimos 90 días por defecto).

**Actualizar datos.** Las transacciones se re-consultan a Belvo por `link_id` o se re-importa un estado de cuenta. Precios de portafolio se refrescan vía `/api/price` (Yahoo) y `/api/crypto` (CoinGecko), cacheados.

**Perfil (`/perfil`).** Datos de usuario, estado de suscripción, exportar datos (PDF), suscribir/restaurar, MFA, cerrar sesión.

**Configuración (`/configuracion`).** PIN de bloqueo (PinLock), eliminar cuenta, ajustes varios.

**Suscripciones.** Paywall (§11). Nativo usa StoreKit; web usa Stripe.

---

## 4. Todas las pantallas

> Rutas bajo `src/app`. Las marcadas "web" no son alcanzables en nativo (el WebView redirige). Las protegidas requieren sesión + (según el caso) onboarding y suscripción, aplicado por `middleware.ts`.

1. **`/` Landing (web).** Marketing. Botones: Blog, Iniciar sesión, "Empezar gratis" → `/analyze`. En nativo redirige a `/login`. Banner "Próximamente en App Store y Google Play". Sin llamadas backend autenticadas.
2. **`/login` Autenticación.** Modos: landing/login/register/registered/verify. Email+password, Sign in with Apple, Google, recuperación. Backend: `supabase.auth.*`. Errores: credenciales inválidas, email ya registrado, contraseña débil, fallo OAuth, fallo de red. Traducción de errores de Supabase a español.
3. **`/auth/reset-password` Restablecer contraseña.** Form de nueva contraseña tras el link del correo. Backend: `supabase.auth.updateUser`.
4. **`/onboarding` Onboarding.** Flujo multipaso (§3). Backend: `getUser`, `updateUser({onboarded})`, `getRemainingSlots` (`/api/access/claim`), claim/compra. Errores: sin cupos gratis, fallo de claim, fallo de compra. Muestra "Configurando tu cuenta" mientras resuelve estado (sin pantalla negra).
5. **`/paywall` Paywall.** Título, "Suscripción mensual", precio $99 MXN/mes, lista de beneficios, botón "Comenzar gratis — quedan X de 150" (si hay cupos), "Suscribirme — $99 MXN/mes", "Restaurar compras" (nativo), links a Términos (EULA) y Política de privacidad. Backend: nativo `nativePurchase`/`nativeRestore` → `/api/iap/verify`; web `/api/stripe/create-checkout`; gratis `/api/access/claim`. Errores: compra cancelada, fallo de verificación, fallo de red, cupos agotados.
6. **`/paywall/success` Éxito de pago (web/Stripe).** Verificación de sesión Stripe (`/api/stripe/verify-session`).
7. **`/dashboard` Dashboard.** Resumen financiero, gasto por categoría, filtro temporal. Backend: lecturas de `transactions`/`trading_operations`/`portfolio_assets`.
8. **`/finanzas` Finanzas.** Ingresos/egresos, importación CSV, categorías, "Gastos hormiga". Backend: `transactions`, `/api/analyze` (subir estado de cuenta).
9. **`/analyze` Analizar (web, también landing CTA).** Subida de estado de cuenta y análisis. Puede usarse anónimo en web con rate limit anónimo. Backend: `POST /api/analyze`.
10. **`/analyze/results` Resultados de análisis.** Muestra insights, categorías, fugas, recomendación.
11. **`/trading` Trading.** P&L, win rate, calendario (PLCalendar). Backend: `trading_operations`.
12. **`/portfolio` Portafolio.** Activos + precios en tiempo real. Backend: `portfolio_assets`, `/api/price`, `/api/crypto`.
13. **`/budgets` Presupuestos.** CRUD de presupuestos. Backend: `budgets`.
14. **`/perfil` Perfil.** Datos, suscripción, exportar PDF, MFA, suscribir/restaurar, logout. Backend: `supabase.auth.*`, IAP/Stripe.
15. **`/configuracion` Configuración.** PIN de bloqueo, eliminar cuenta. Backend: `DELETE /api/account`.
16. **`/soporte` Soporte.** Información de contacto/ayuda.
17. **`/terms` Términos y Condiciones.** Documento legal (también en `https://www.nva.lat/terms`).
18. **`/privacy` Política de Privacidad.** Documento legal (también en `https://www.nva.lat/privacy`). Referencia eliminación de cuenta desde Perfil/Configuración.
19. **`/blog` y `/blog/[slug]` Blog (web).** Contenido MDX (`gray-matter`, `next-mdx-remote`).
20. **`/dev/reset-onboarding` Herramienta de desarrollo.** Resetea flags de onboarding/suscripción del usuario actual. **Ruta interna de pruebas** (ver §14).

---

## 5. Navegación

**Modelo.** No hay UINavigationController/UITabBarController nativos: la navegación es **web routing** dentro del WKWebView (Next.js App Router + `next/navigation`). La barra inferior/sidebar son componentes web (`BottomNav`, `Sidebar`, `Topbar`).

**Protección de rutas (`middleware.ts`).** Rutas públicas: `/`, `/login`, `/analyze`, `/auth/*`, `/terms`, `/privacy`, `/paywall`, `/api/stripe/webhook`, `/api/iap/notifications`. Lógica de "destino inteligente": no-onboarded → `/onboarding`; onboarded sin pago → `/paywall`; onboarded + pago → `/finanzas`. Las API con `Authorization: Bearer` pasan al handler (auth nativo); sin Bearer y sin cookie → 401.

**Esquema personalizado (URL Scheme).** `nvaapp://` registrado en `Info.plist` (`CFBundleURLTypes`, nombre `lat.nva.app`). Usado para:
- `nvaapp://auth/callback` — verificación de email y callbacks OAuth en nativo.

**Deep links.** `NativeAuthDeepLink` (montado en el layout raíz) registra `App.addListener('appUrlOpen')` (plugin `@capacitor/app`). Al recibir una URL con `auth/callback`, extrae la sesión (tokens en el hash para flujo implícito, o `code` para PKCE), llama `setSession`/`exchangeCodeForSession` y enruta a onboarding/paywall/finanzas. Esto permite que el link de verificación de correo **regrese a la app nativa** logueado.

**Universal Links / Associated Domains.** **No** configurados (no hay `applinks:` ni archivo AASA). El regreso a la app se hace por custom scheme, no por universal links.

**Safari / SFSafariViewController / ASWebAuthenticationSession.** Los flujos OAuth (Google, Apple web) y la apertura de links externos usan **ASWebAuthenticationSession** gestionado por el Swift bridge (`CustomBridgeViewController`), que devuelve el control a la app vía el scheme `nvaapp`. Los links de Términos/Privacidad en el paywall son `<a target="_blank">` (abren el visor del sistema y permiten volver).

**Puente JS ↔ Swift.** El código web dispara comandos al nativo escribiendo en `document.title` (observado por `CustomBridgeViewController`):
- `__nvaPurchase` → compra StoreKit.
- `__nvaRestorePurchases` → restaurar compras.
- `__nvaAppleSignIn:<hashedNonce>` → Sign in with Apple nativo.
- `__nvaOAuth:<url>` → abre ASWebAuthenticationSession para OAuth.
El nativo responde llamando funciones globales: `window.__nvaPurchaseResult/Error`, `__nvaRestoreResult/Error`, `__nvaHandleAppleToken`, `__nvaHandleOAuthTokens`, etc.

**URLs utilizadas.** `https://www.nva.lat` (backend/API en nativo, hardcoded en `iap.js` como `VERIFY_URL`), `https://nva.lat`, `nvaapp://auth/callback`, endpoints Supabase, `cdn.belvo.io`.

---

## 6. Autenticación

**Proveedor:** Supabase Auth.

**Clientes Supabase (importante).** `src/lib/supabaseClient.js` selecciona el cliente según plataforma:
- **Nativo (Capacitor):** `createClient` (supabase-js) basado en **localStorage** (las cookies no funcionan en `capacitor://localhost`). Flujo **implícito** (tokens en el hash de la URL de retorno).
- **Web:** `createBrowserClient` (`@supabase/ssr`) basado en **cookies**, legible por el middleware para proteger rutas. Flujo **PKCE** (`?code=` → `/auth/callback`).

**Apple Sign In.** Entitlement `com.apple.developer.applesignin = Default`. Nativo: plugin `@capacitor-community/apple-sign-in` + nonce → `signInWithIdToken`. Web: OAuth. No re-solicita nombre/email (Guideline 4.0).

**Google Sign In.** Nativo: `signInWithOAuth(redirectTo: nvaapp://auth/callback, skipBrowserRedirect)` + ASWebAuthenticationSession + `setSession`. Web: OAuth estándar.

**Access / Refresh tokens.** Gestionados por Supabase. Nativo: persistidos en localStorage; web: en cookies. Tras operaciones que cambian metadata (compra, claim, restore) se llama `refreshSession()` para que el JWT refleje el nuevo `subscription_status`.

**Sesiones / persistencia.** Persisten entre aperturas (localStorage nativo / cookies web). Logout limpia la sesión.

**Callback / Redirect URLs.** Configuradas en el dashboard de Supabase (Authentication → URL Configuration): Site URL `https://www.nva.lat`; Redirect URLs permitidas: `https://www.nva.lat/auth/callback`, `https://nva.lat/auth/callback`, `nvaapp://auth/callback`. Sin la entrada `nvaapp://`, el link de verificación nativo caería al Site URL web.

**Manejo de expiración.** El modelo de acceso (`hasAccess`) aplica una ventana de gracia de 24h tras `subscription_expires_at` para cubrir el lapso entre el fin del período y la llegada del webhook de renovación (Apple/Stripe).

**MFA.** TOTP opcional (`supabase.auth.mfa.enroll/challenge/verify`).

---

## 7. Conexión bancaria

**Proveedor:** **Belvo** (open banking para México/LatAm). SDK npm `belvo` (servidor) + widget JS del lado cliente.

**Cómo se conecta un banco.**
1. Cliente solicita token: `GET /api/belvo/token` (autenticado). El servidor crea un `widgetToken` con `BELVO_SECRET_ID`/`BELVO_SECRET_PASSWORD` y `BELVO_ENVIRONMENT` (por defecto `sandbox`).
2. `BankConnectWidget` carga `belvo-widget-1-stable.js` y abre el widget con ese token.
3. El usuario autentica con su banco **dentro del widget de Belvo** (las credenciales bancarias nunca pasan por NVA).
4. Al éxito, el widget entrega un `link_id`.

**Datos que se leen / actualizan.** `POST /api/belvo/transactions` con el `link_id` recupera transacciones (por defecto últimos 90 días) y las mapea a: `external_id`, `date`, `concept`, `amount`, `type` (Ingreso/Egreso), `status` (pending/completed), `bank_name`, `currency`. Se persisten con `saveData: true`.

**Permisos.** Solo lectura de movimientos/cuentas vía Belvo. NVA **no** mueve dinero ni inicia pagos.

**Qué nunca se almacena.** Las credenciales bancarias del usuario (las gestiona Belvo, no NVA).

**Fallo de sincronización.** Los handlers devuelven errores controlados (`serverError`) y la UI muestra toasts ("Error obteniendo el token seguro de Belvo", etc.). El widget reporta errores vía su callback de eventos.

> Nota de cumplimiento: en código `BELVO_ENVIRONMENT` por defecto es `sandbox`; en producción debe configurarse el entorno y credenciales reales de Belvo.

---

## 8. Seguridad

- **HTTPS/TLS:** todo el tráfico de backend va por `https://` (Vercel + Supabase + Belvo + Apple + Anthropic). No hay endpoints HTTP en claro (`http://localhost` solo en desarrollo y en la allowlist de CORS).
- **ATS:** sin excepciones de App Transport Security en `Info.plist` (no se añadieron `NSAllowsArbitraryLoads` ni dominios inseguros).
- **Tokens/JWT:** Supabase JWT. En nativo se envían como `Authorization: Bearer <access_token>`; `getAuthUser` valida el token contra Supabase. La verificación StoreKit usa la librería oficial de Apple (`@apple/app-store-server-library`) con cadena de certificados anclada en las **Apple Root CAs** (en `./apple-certs` o variable `APPLE_ROOT_CAS`).
- **Secrets / variables de entorno:** `SUPABASE_SERVICE_ROLE_KEY`, `BELVO_SECRET_*`, `STRIPE_*`, `ANTHROPIC_API_KEY`, `APPLE_*`. Solo en el servidor (Vercel); nunca embebidos en el bundle nativo (las llamadas sensibles van al backend remoto).
- **Almacenamiento local:** sesión en localStorage (nativo) / cookies httpOnly-compatibles (web). PIN de bloqueo local (`PinLock`/`pinAuth`).
- **Rate limiting:** distribuido vía tabla `anon_rate_limits` (`checkRateLimit`/`checkAnonRateLimit`) para endpoints sensibles como análisis y verificación.
- **Auditoría:** `audit_logs` registra eventos (`analysis.completed`, `iap.verified`, `free.granted`, etc.) con service role.
- **CORS:** allowlist explícita (`src/lib/cors.js` + middleware) para orígenes `nva.lat`, `www.nva.lat`, `capacitor://localhost`, localhost.

---

## 9. Manejo de datos

**Datos personales:** email, contraseña (hash gestionado por Supabase Auth), nombre/alias (voluntario), foto de perfil (opcional, almacenada localmente en el dispositivo).

**Datos financieros:** transacciones extraídas de estados de cuenta subidos (fecha, concepto, monto, categoría) y/o movimientos traídos vía Belvo; operaciones de trading; activos de portafolio.

**Dónde se almacenan:** Supabase (Postgres) bajo `user_id` con RLS. La foto de perfil permanece local en el dispositivo.

**Durante cuánto tiempo:** mientras la cuenta exista; se eliminan al borrar la cuenta.

**Cómo se eliminan:** `DELETE /api/account` borra todas las tablas del usuario (`transactions`, `trading_operations`, `portfolio_assets`, `clients`, `prospects`, `budgets`, `reminders`) y elimina el usuario auth con la service role. Accesible desde Configuración (in-app).

**Qué se envía al backend:** el PDF/CSV del estado de cuenta se procesa en el servidor (`/api/analyze`) con Anthropic Claude para extracción/categorización; las transacciones resultantes se guardan en Supabase. Datos de Belvo se obtienen vía backend.

**Qué permanece local:** foto de perfil, PIN de bloqueo, flags de onboarding (`localStorage`), preferencias de filtros (`filterMemory`).

---

## 10. Notificaciones

- **Push:** **no implementadas** (no hay plugin de push ni APNs configurado).
- **Locales (sistema):** no hay notificaciones locales del SO.
- **Recordatorios:** existe funcionalidad de recordatorios **dentro de la app** (tabla `reminders`, componente `Recordatorios`), pero son entradas in-app, no notificaciones push del sistema.

---

## 11. Suscripciones

- **No** se usa RevenueCat. Nativo: **Apple StoreKit IAP directo**. Web: **Stripe**.
- **Producto:** `lat.nva.app.sub.monthly` — suscripción auto-renovable mensual, **$99 MXN/mes** (grupo de suscripción "NVA", nombre en pantalla "NVA Premium").
- **Tier gratuito:** primeros 150 usuarios obtienen acceso de por vida (`/api/access/claim`, tabla `free_grants`); botón "Comenzar gratis — quedan X de 150".
- **Paywall:** muestra título, duración, precio, beneficios, "Suscribirme", "Restaurar compras" (nativo) y **links funcionales a Términos de uso (EULA) y Política de privacidad** (Guideline 3.1.2(c)).
- **Compra (nativo):** `nativePurchase()` dispara StoreKit vía el bridge; el JWS firmado se verifica en `POST /api/iap/verify` con la librería oficial de Apple (prueba entorno producción y luego sandbox); al validar se actualiza `subscriptions` + `user_metadata`.
- **Restauración:** `nativeRestore()` → mismo flujo de verificación (botón obligatorio de Apple presente).
- **Notificaciones servidor Apple:** `POST /api/iap/notifications` (público) procesa eventos (REFUND/REVOKE/EXPIRED/GRACE_PERIOD_EXPIRED fuerzan estado inactivo).
- **Cancelación:** gestionada por Apple (Ajustes del Apple ID) / Stripe (portal). La app no cancela directamente.
- **Periodo de prueba:** no configurado (no hay oferta introductoria activa).
- **Modelo de acceso:** `user_metadata.subscription_status` ∈ {active, free, expired, none} + `subscription_source` {apple, stripe, free} + `subscription_expires_at`. `hasAccess()` con gracia de 24h.

---

## 12. Errores conocidos

- **`src/lib/cors.js`** mantiene un origen heredado del dominio anterior (`https://finanzas-integraweb.vercel.app`) en la allowlist de CORS. No es visible al usuario ni causa rechazo, pero es residuo a limpiar.
- **Build 10 vs. fix de borrado de cuenta:** la mejora que hace que el borrado nativo elimine también el usuario auth (no solo los datos) se realizó **después** de subir el build en revisión; el build 10 podría llevar el comportamiento anterior (borra datos + signOut, dejaba el usuario auth vacío). Pendiente de incluir en el siguiente build.
- **Defaults de entorno:** `BELVO_ENVIRONMENT` por defecto `sandbox`; debe forzarse producción en release.
- **`@capacitor-community/apple-sign-in`** no tiene versión para Capacitor 8; se aplica un parche en `postinstall` (`scripts/patch-apple-signin.js`) que sube su dependencia `capacitor-swift-pm` a 8.x para resolver el grafo SPM.

---

## 13. Funciones pendientes

- Mover el paso "sube tu primer estado de cuenta" a después del paywall (decisión de producto pospuesta hasta aprobación).
- Incluir el fix de borrado completo de cuenta en el próximo build.
- Confirmar configuración de Belvo en producción (entorno + credenciales reales).

---

## 14. Funciones deshabilitadas / internas

- **`/dev/reset-onboarding`:** herramienta interna de desarrollo que resetea `onboarded` y el estado de suscripción del usuario. No está enlazada desde la UI de producción, pero es una ruta alcanzable por usuarios autenticados (el middleware deja pasar `/dev/*`). Recomendado bloquear/eliminar en builds de producción.
- **Stripe en nativo:** deshabilitado por diseño — en la app nativa los caminos de pago usan exclusivamente StoreKit; los handlers de Stripe no se invocan en nativo (Guideline 3.1.1). Stripe permanece activo solo en la web.

---

## 15. Configuración de iOS

- **Bundle Identifier:** `lat.nva.app`.
- **Display Name:** NVA.
- **Versión (CFBundleShortVersionString):** 1.0. **Build (CFBundleVersion):** 10 (en revisión).
- **Deployment target:** iOS 15.0.
- **Capabilities / Entitlements:** **Sign in with Apple** (`com.apple.developer.applesignin = Default`). En Xcode también figura **In-App Purchase**.
- **Associated Domains:** ninguno.
- **URL Schemes:** `nvaapp` (`CFBundleURLTypes`, nombre `lat.nva.app`).
- **Background Modes:** ninguno.
- **Keychain Sharing:** no configurado.
- **Permisos (Info.plist):** `NSCameraUsageDescription` y `NSPhotoLibraryUsageDescription` (ambos para foto de perfil). No se piden ubicación, contactos, micrófono ni notificaciones.
- **Orientaciones:** retrato + paisajes (iPhone) / todas (iPad). La revisión se hace en iPad Air 11" (M3).
- **Plugins Capacitor incluidos:** app, haptics, keyboard, splash-screen, status-bar, apple-sign-in.
- **Bridge nativo:** `AppDelegate.swift` + `CustomBridgeViewController.swift` (observa `document.title` y gestiona StoreKit / ASWebAuthenticationSession / Apple Sign In).

---

## 16. Configuración de App Store Connect

- **App:** NVA Finanzas Personales (Apple ID de app `6772263360`). Categoría: Finanzas (secundaria Productividad).
- **Versión:** 1.0. **Build actual:** 10.
- **Suscripción:** grupo "NVA", producto `lat.nva.app.sub.monthly`, $99 MXN/mes, estado "Listo para enviar"/adjunto a la versión.
- **TestFlight:** build probado por tester interno; compra StoreKit verificada en sandbox.
- **Privacidad:** URL de política de privacidad `https://www.nva.lat/privacy` (campo App Privacy). Términos (EULA) `https://www.nva.lat/terms` añadido en la Descripción.
- **Información para revisión / cuenta demo:** se proporciona cuenta de prueba (ej. `demo@nva.lat`) con credenciales en las notas de revisión; se indican bancos compatibles (PDF/CSV).
- **Historial de revisión:** rechazos previos resueltos — 4.0 (Sign in with Apple pedía nombre), 3.1.1 (compra fuera de IAP), 3.1.2(c) (faltaban links EULA/privacidad en el flujo de compra). El reenvío incluye grabación de pantalla mostrando los links funcionando.

---

## 17. Dependencias

**Producción:** `@anthropic-ai/sdk`, `@apple/app-store-server-library`, `@capacitor-community/apple-sign-in`, `@capacitor/app`, `@capacitor/cli`, `@capacitor/core`, `@capacitor/haptics`, `@capacitor/ios`, `@capacitor/keyboard`, `@capacitor/splash-screen`, `@capacitor/status-bar`, `@supabase/ssr`, `@supabase/supabase-js`, `@vercel/analytics`, `belvo`, `gray-matter`, `jspdf`, `jspdf-autotable`, `lodash`, `lucide-react`, `next` (15.5), `next-mdx-remote`, `pdf-parse`, `pdfjs-dist`, `react` (19.2), `react-dom`, `recharts`, `sonner`, `stripe`, `swr`.

**Desarrollo:** `eslint`, `eslint-config-next`, `vitest`, `@vitest/ui`. (`patch-package` se removió a favor de un postinstall propio.)

**SDKs cargados en runtime (no npm):** Belvo Widget JS (`cdn.belvo.io`).

---

## 18. Experiencia del usuario (recorrido)

Al abrir la app nativa: splash → (si no hay sesión) `/login`. El usuario crea cuenta (email+password / Apple / Google), acepta Términos y Privacidad, verifica su correo (el link `nvaapp://` regresa a la app logueado). Entra al onboarding: bienvenida → objetivo → seguridad → subir estado de cuenta (o "Más tarde") → paywall (elige tier gratis o suscripción $99/mes vía Apple) → bienvenida final → dashboard. Ya dentro, navega entre Dashboard, Finanzas, Trading, Portafolio y Presupuestos mediante la barra inferior/sidebar. Puede subir estados de cuenta para análisis con IA, conectar su banco con Belvo, ver categorías y fugas de gasto, gestionar perfil/configuración (incluido eliminar cuenta y PIN), y cerrar sesión.

---

## 19. Casos de error

- **Sin internet:** las llamadas (`fetch`/Supabase) fallan y la UI muestra toasts ("Error de conexión", "Intenta de nuevo"). El paywall y login muestran mensajes de error en pantalla.
- **Falla el banco (Belvo):** error controlado del endpoint + toast; el widget reporta el fallo por su callback.
- **Sesión expirada:** `hasAccess`/middleware redirigen a `/login` o `/paywall`; en nativo el deep-link/refresh recupera la sesión si es posible. Tras logout, el "atrás" no reingresa a rutas protegidas.
- **500 del servidor:** los handlers responden con error genérico (`serverError` → "Error interno del servidor") sin filtrar detalles; la UI muestra mensaje útil, no "Unknown error".
- **Falla el login:** mensaje traducido (credenciales inválidas, email ya registrado, contraseña débil).
- **Falla el callback (OAuth/verificación):** si el deep-link llega malformado, `NativeAuthDeepLink` lo ignora sin crashear; el `/auth/callback` web sin `code` redirige a `/login`.
- **Usuario cancela el login/compra:** se trata el caso `cancelled` sin mostrar error (solo se detiene el loading).

---

## 20. Información relevante adicional

- **Arquitectura híbrida** es el punto más importante para una auditoría: el mismo código sirve web (Vercel, SSR + API serverless) y nativo (Capacitor, export estático + API remota). Por eso hay dobles caminos (cliente cookie vs. localStorage, Stripe vs. StoreKit, redirect web vs. `nvaapp://`).
- **Sin WebView "disfrazada":** aunque es Capacitor, la app tiene flujos nativos reales (Sign in with Apple nativo, StoreKit, deep links, haptics, status bar) y no abre Safari para funciones internas (OAuth usa ASWebAuthenticationSession y regresa solo).
- **Cumplimiento financiero:** datos sensibles vía HTTPS/TLS, RLS por usuario, service role solo en servidor, verificación criptográfica de transacciones Apple, rate limiting y auditoría. La conexión bancaria es solo-lectura vía proveedor autorizado (Belvo); NVA no mueve dinero.
- **IA:** el análisis usa Anthropic Claude (`claude-sonnet-4-6` y `claude-haiku-4-5`). La app debe comunicar que la categorización por IA puede equivocarse y no constituye asesoría financiera (revisar copy para Guideline de apps financieras).
- **Proyecto Supabase:** `rdmvynbidxfesvdkuqga`. **Dominios:** prod `https://www.nva.lat`, dev `http://localhost:3005`.
- **Puntos de mayor riesgo para aprobación:** (1) borrado de cuenta completo en el build enviado; (2) ruta `/dev/*` accesible; (3) declaración exacta en App Privacy de ASC; (4) que todos los flujos (registro, login, conexión bancaria, categorización, logout) funcionen sin pantallas en blanco ni crashes en iPad; (5) regreso correcto a la app tras OAuth/verificación sin dejar al usuario en Safari.
