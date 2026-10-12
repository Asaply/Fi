# NVA — Visión Completa del Proyecto
### Documento maestro para análisis por IA (producto, UX, técnico, crecimiento, cumplimiento)

> Documento autocontenido. Explica **todo**: qué es la app, cómo se ve, cómo funciona,
> su arquitectura, su etapa actual y sus pendientes. Pensado para que otra IA pueda
> auditar/analizar cualquier dimensión sin haber visto el código.
> App: **NVA — Finanzas Personales**. Bundle iOS: **lat.nva.app**. Web: **https://www.nva.lat**.

---

## 0. Etapa actual del proyecto (dónde estamos hoy)

- **APROBADA por Apple.** La app pasó App Review (versión **1.0**, build **10**) tras varios rechazos ya resueltos:
  - Guideline 4.0 (Sign in with Apple pedía nombre/email) → resuelto.
  - Guideline 3.1.1 (compra fuera de In-App Purchase) → resuelto: nativo usa solo StoreKit.
  - Guideline 3.1.2(c) (faltaban links a EULA/privacidad y EULA en metadata) → resuelto: links en el paywall + EULA personalizado en App Store Connect.
- **Web** desplegada en Vercel (`nva.lat`). **App iOS** publicada/aprobada.
- Trabajo post-aprobación reciente (en `main`, aún sin necesariamente estar en un build nuevo):
  - Borrado de cuenta completo (elimina también el usuario auth) en web y nativo.
  - Eliminación de la ruta de pruebas `/dev/reset-onboarding`.
  - Disclaimer de IA visible.
  - Limpieza de CORS (dominio viejo).
  - Conexión bancaria (Belvo) dejada **inactiva** pero preservada y documentada.
- **Pendiente de validar en producción:** el flujo core (subir estado de cuenta → análisis IA → dashboard) con estados de cuenta reales de distintos bancos.
- **Próximo build (11):** incluiría los cambios post-aprobación cuando se publique una actualización.

---

## 1. Qué es NVA (producto)

**Pitch.** App de finanzas personales para México. El usuario sube su estado de cuenta bancario (PDF/CSV) y una IA lo analiza: extrae movimientos, los categoriza, calcula ingresos/egresos, detecta "fugas de dinero" y muestra un dashboard claro. Incluye seguimiento de trading y portafolio.

**Problema.** La gente no tiene una visión unificada de su dinero (repartido entre bancos y apps). NVA lo centraliza y lo explica en segundos.

**Público.** Usuarios de banca personal en México (Nu, BBVA, Banorte, Santander, HSBC, Citibanamex, Spin, Mercado Pago, Hey Banco…), incluidos quienes invierten/tradean.

**Propuesta de valor (copy real de la app):**
- "Análisis ilimitados de estados de cuenta"
- "Categorización automática con IA"
- "Detección de fugas de dinero"
- "Dashboard financiero completo"
- "Portfolio y trading tracker"
- "Actualizaciones incluidas para siempre"

**Modelo de negocio.** Suscripción mensual **$99 MXN/mes** (auto-renovable) + tier gratuito de por vida para los **primeros 150 usuarios**.

---

## 2. Cómo se ve la app (identidad visual + pantallas)

**Identidad visual.**
- **Tema oscuro** (fondo negro `#000`), estética premium/minimalista.
- **Color de acento naranja** (`#FF6600` / `#FF8700`), usado en botones primarios, iconos y highlights.
- **Botón primario** naranja (onboarding) o **blanco** (CTAs como "Comenzar", "Ir a mi dashboard").
- **Logo:** cuadrado negro redondeado con "NVA" — la "A" en naranja.
- Tipografía sans (Inter) + mono (Geist Mono). Tarjetas redondeadas, mucho espacio negativo, checkmarks naranjas en listas.
- Idioma: español (México). Moneda: MXN.

**Recorrido visual, pantalla por pantalla (nativo):**
1. **Splash** (LaunchScreen de Capacitor) → logo NVA sobre fondo negro.
2. **Login / bienvenida** — logo NVA, título "Tus finanzas personales, en un solo lugar", checkbox "Acepto los Términos y Condiciones y la Política de Privacidad" (con links subrayados), y dos tarjetas: **"Nueva cuenta"** y **"Cuenta existente"** (con flechita ↗). Ofrece también Continuar con Apple / Google.
3. **Configurando tu cuenta** — logo con anillo naranja animado, "Configurando tu cuenta / Un momento, preparamos todo para ti".
4. **¡Cuenta creada!** — check verde grande, "Tu cuenta ha sido creada exitosamente".
5. **Onboarding paso 1** — "Entiende a dónde va tu dinero" con 3 bullets (analizamos estados de cuenta / detectamos patrones / insights reales), botón blanco "Comenzar", indicador de progreso (dots naranjas).
6. **Onboarding paso 2** — "¿Cuál es tu objetivo principal?": 4 opciones (Ahorrar más / Controlar mis gastos / Invertir mi dinero / Mejorar mis finanzas), "Continuar" y "Saltar".
7. **Onboarding paso 3 (seguridad)** — "Tus datos están 100% protegidos": Cifrado 256-bit, Solo lectura, Estándares bancarios, Tu privacidad es primero.
8. **Onboarding paso 4** — "Sube tu primer estado de cuenta": zona punteada "Toca para seleccionar tu PDF (PDF · Máx. 20MB · Solo lectura)", "Analizar estado de cuenta", "¿No lo tienes a mano? Más tarde". Lista bancos compatibles.
9. **Paywall** — "ÚLTIMO PASO / Activa NVA al 100%", "Suscripción mensual · Cancela cuando quieras", lista de beneficios con checks naranjas, bloque de precio grande "$99 MXN/mes / Se renueva automáticamente · Gestiona en Ajustes", botón naranja **"Comenzar gratis — quedan X de 150"**, botón "Suscribirme — $99 MXN/mes", "Restaurar compras", y al pie **links "Términos de uso (EULA) · Política de privacidad"**.
10. **¡Bienvenido a NVA!** — logo, "Estás listo para tomar el control de tu dinero", botón blanco "Ir a mi dashboard".
11. **Dashboard / Finanzas / Trading / Portafolio** — vistas con tarjetas oscuras, gráficas (recharts), donut de gasto por categoría, calendario P&L, listas de transacciones recientes, saldos por banco. Navegación por barra inferior/sidebar.
12. **Términos / Privacidad** — páginas de documento legal, fondo oscuro, "← NVA" para volver, con "Lector disponible" del sistema.

---

## 3. Arquitectura técnica

**Modelo híbrido (lo más importante).** Un solo código base Next.js desplegado de dos formas:
1. **Web** — Vercel (`www.nva.lat`), SSR + middleware + rutas API serverless.
2. **iOS nativo** — el mismo proyecto compilado como **export estático** (`out/`) y empaquetado en **Capacitor** (WKWebView). El bundle vive en el dispositivo (`capacitor://localhost`); **las llamadas API apuntan al backend remoto** (`www.nva.lat`) vía `API_BASE`. El script `scripts/build-capacitor.js` stubbea rutas dinámicas para no romper el export estático.

**Stack.**
- Next.js 15.5 (App Router), React 19.2, JS + TS (`middleware.ts`).
- Capacitor 8.3 (`core`, `ios`, `cli`) + plugins: `app` (deep links), `haptics`, `keyboard`, `splash-screen`, `status-bar`, `apple-sign-in`.
- Supabase (auth + Postgres + storage). Proyecto `rdmvynbidxfesvdkuqga`.
- IA: Anthropic Claude vía `@anthropic-ai/sdk` — `claude-sonnet-4-6` (PDF/visión) y `claude-haiku-4-5-20251001` (CSV/texto).
- Pagos: **Stripe** (web) + **Apple StoreKit IAP** (nativo), verificado con `@apple/app-store-server-library` (JWS).
- Open banking: **Belvo** (INACTIVO, ver §9).
- PDF: `pdf-parse`, `pdfjs-dist`; export `jspdf`.
- UI: `recharts`, `lucide-react`, `sonner`, `swr`, `@vercel/analytics`.
- Precios mercado: Yahoo Finance (`/api/price`) + CoinGecko (`/api/crypto`).

**Puente JS ↔ Swift nativo.** El código web dispara comandos escribiendo en `document.title` (observado por `CustomBridgeViewController`): `__nvaPurchase`, `__nvaRestorePurchases`, `__nvaAppleSignIn:<nonce>`, `__nvaOAuth:<url>`, `__nvaUpload:<token>`. El nativo responde vía funciones globales (`window.__nvaPurchaseResult`, `__nvaHandleOAuthTokens`, etc.). OAuth usa **ASWebAuthenticationSession** y regresa por el scheme `nvaapp://`.

**Rutas API (12):** `/api/analyze`, `/api/account`, `/api/access/claim`, `/api/iap/verify`, `/api/iap/notifications`, `/api/stripe/create-checkout`, `/api/stripe/verify-session`, `/api/stripe/webhook`, `/api/belvo/token` (dormido), `/api/belvo/transactions` (dormido), `/api/price`, `/api/crypto`.

---

## 4. Modelo de datos (Supabase/Postgres)

Tablas: `transactions`, `trading_operations`, `portfolio_assets`, `clients`, `prospects`, `budgets`, `budget_payments`, `reminders`, `user_config`, `hormiga_patterns`, `subscriptions`, `audit_logs`, `anon_rate_limits`, `free_grants`. RLS por `user_id`; operaciones admin con `SUPABASE_SERVICE_ROLE_KEY`.

**`transactions` (columnas usadas):** `user_id`, `date`, `concept`, `amount`, `type` ("Ingreso"/"Egreso"/"Ajuste"), `account_type` ("debito"/"credito"), `bank`, `categoria`, `external_id` (para Belvo). El dashboard normaliza `type.toLowerCase()` al leer.

**Estado de suscripción** (en `user_metadata` de Supabase Auth): `subscription_status` ∈ {active, free, expired, none}, `subscription_source` ∈ {apple, stripe, free}, `subscription_expires_at` (ISO o null). El modelo `hasAccess()` aplica 24h de gracia tras expiración. `onboarded` (bool) controla el gating de onboarding.

---

## 5. Funcionalidades a detalle

- **Análisis de estado de cuenta (core).** `POST /api/analyze`: recibe PDF (visión) o CSV (texto), llama a Claude con un prompt estricto que devuelve JSON (banco, tipo_cuenta, saldos, credito_info, movimientos). Robusto: 3 fallbacks de parseo JSON, protección contra inyección de prompt, categorización local (`categorias.js`), construcción de insights (top categorías, fugas, recomendación). Rate limit: 10/min (autenticado), 1/día por IP (anónimo web).
- **Importación en finanzas.** Sube archivo → llama analyze → mapea a columnas BD → **revisión de 2 pasos** → inserta en `transactions`. Detecta crédito vs débito, autollena config de tarjeta (límite, corte, pago, CAT), guarda saldos por banco (localStorage) para el dashboard.
- **Dashboard.** Ingresos/egresos por periodo, gasto por categoría (donut), deuda/saldo por banco, filtros temporales.
- **Trading.** P&L, win rate, calendario de operaciones.
- **Portafolio.** Activos + precios en tiempo real (Yahoo/CoinGecko, cacheados).
- **Presupuestos y recordatorios.** CRUD, pagos de presupuesto.
- **Gastos hormiga.** Detección de patrones de micro-gasto recurrente.
- **Perfil / Configuración.** Datos, suscripción, exportar PDF, MFA (TOTP), PIN de bloqueo local, eliminar cuenta.

---

## 6. Flujos completos

- **Registro:** `/login` → email+password (validación de fuerza) + aceptar términos → `signUp` con `emailRedirectTo` condicional (nativo `nvaapp://auth/callback`, web `${origin}/auth/callback`) → "verifica tu correo".
- **Verificación de correo:** el link regresa a la app; en nativo `NativeAuthDeepLink` (listener `appUrlOpen`) extrae la sesión y enruta a onboarding.
- **Login:** `signInWithPassword` (+ MFA opcional) → destino inteligente (onboarding → paywall → finanzas), aplicado por middleware.
- **Apple/Google:** nativo vía bridge + ASWebAuthenticationSession; web vía OAuth. No se re-pide nombre (Guideline 4).
- **Compra:** nativo `nativePurchase` → StoreKit → JWS → `/api/iap/verify` (verificación oficial Apple, prueba prod y sandbox) → activa suscripción. Web: Stripe checkout.
- **Restaurar compras:** `nativeRestore` → mismo verify.
- **Eliminar cuenta:** Configuración → `DELETE /api/account` (Bearer nativo / cookie web) → borra tablas + usuario auth.
- **Logout:** `signOut` → `/login`; middleware bloquea volver atrás.

---

## 7. Monetización

- Producto Apple: `lat.nva.app.sub.monthly`, grupo "NVA" (display "NVA Premium"), **$99 MXN/mes** auto-renovable.
- Tier gratuito: primeros 150 (`free_grants`, `/api/access/claim`).
- Notificaciones servidor Apple: `/api/iap/notifications` (REFUND/REVOKE/EXPIRED/GRACE_PERIOD_EXPIRED → inactivo).
- Cancelación: gestionada por Apple/Stripe. Sin periodo de prueba configurado.

---

## 8. Seguridad y privacidad

- HTTPS/TLS en todo; sin excepciones ATS. CORS con allowlist explícita.
- Secrets solo en servidor (Vercel): `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `BELVO_*`, `STRIPE_*`, `APPLE_*`. Nunca en el bundle nativo.
- Verificación criptográfica de transacciones Apple (Apple Root CAs).
- Rate limiting distribuido (`anon_rate_limits`) + auditoría (`audit_logs`).
- Datos personales: email, contraseña (hash Supabase), nombre (voluntario), foto de perfil (local en el dispositivo). Datos financieros: transacciones extraídas de estados de cuenta / movimientos. Almacenados en Supabase con RLS; se borran al eliminar la cuenta.
- Disclaimer de IA visible: "Análisis y categorías generados por IA — pueden contener errores y no constituyen asesoría financiera."

---

## 9. Estado de features (activas / inactivas / pendientes)

**Activas:** análisis PDF/CSV con IA, dashboard, finanzas, trading, portafolio, presupuestos, recordatorios, gastos hormiga, perfil, configuración, PIN, MFA, suscripción StoreKit/Stripe, tier gratis, eliminar cuenta, exportar PDF.

**Inactiva (dormida) — Belvo (conexión bancaria):** el componente `BankConnectWidget.jsx` y las rutas `/api/belvo/*` existen pero **no están cableados a la UI** ni son alcanzables. Documentado en `BELVO_INTEGRATION.md` (cómo reactivar). `BELVO_ENVIRONMENT` por defecto `sandbox` → debe ser `production` al activar.

**Pendientes/roadmap:** validar core con estados de cuenta reales de varios bancos; mover el paso "sube tu estado de cuenta" a después del paywall (decisión de producto); publicar build 11 con los cambios post-aprobación; considerar migrar sesión de localStorage a Keychain (no requerido).

---

## 10. Deuda técnica y notas conocidas

- `@capacitor-community/apple-sign-in` no tiene versión Capacitor 8; se aplica parche en `postinstall` (`scripts/patch-apple-signin.js`) subiendo su dep `capacitor-swift-pm` a 8.x.
- El build nativo requiere `scripts/build-capacitor.js` (stub de rutas dinámicas) — NO `next build` a secas.
- Precios de portafolio dependen de Yahoo/CoinGecko (free tier, cachear y respetar rate limits).
- Los saldos por banco y config de crédito se guardan en `localStorage` (no en BD) — no sincronizan entre dispositivos.

---

## 11. Configuración iOS / App Store

- Bundle `lat.nva.app`; display "NVA"; iOS 15+; orientaciones retrato+paisaje.
- Entitlements: **Sign in with Apple**; capability **In-App Purchase**.
- URL scheme: `nvaapp`. Sin Associated Domains, Background Modes, Keychain Sharing ni Push.
- Permisos: Cámara + Fotos (solo para foto de perfil).
- App Store Connect: versión 1.0, build 10 aprobado. EULA personalizado + Privacy Policy URL configurados. Categoría Finanzas (secundaria Productividad). Cuenta demo para revisión (`demo@nva.lat`).
- Revisión de Apple se realiza en iPad Air 11" (M3).

---

## 12. Qué puede analizar otra IA con este documento

- **Producto/UX:** claridad del onboarding, orden del paso de subir estado vs. paywall, fricción de conversión, jerarquía del paywall (free-first).
- **Crecimiento/monetización:** pricing $99/mes, tier de 150 gratis, retención, oferta de prueba ausente.
- **Técnico:** robustez del pipeline de análisis IA, manejo de errores/estados vacíos, deuda técnica (localStorage vs BD, parche SPM), rendimiento en iPad.
- **Cumplimiento:** privacidad (declaración App Privacy), disclaimers financieros, seguridad de datos sensibles, feature dormida (Belvo) sin exponer.
- **Riesgos:** dependencia de un solo proveedor de IA, precisión de extracción por banco, ausencia de conexión bancaria activa.

> Documento complementario centrado en cumplimiento App Store: `COMPLIANCE_AUDIT.md`.
