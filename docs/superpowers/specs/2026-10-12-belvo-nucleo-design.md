# Subproyecto — Belvo como núcleo de NVA

**Fecha:** 2026-10-12 · **Estado:** aprobado en diseño, pendiente de plan
**Dueños:** backend — Leonardo · frontend/UX — Alan

## Contexto y objetivo

NVA deja de depender de que el usuario suba estados de cuenta. El usuario **conecta su banco una vez** con
Belvo; sus cuentas y movimientos llegan solos todos los días y NVA los categoriza. Es la función principal de la app.

La app pasa a ser **solo móvil** (iOS primero, Android después). Por eso este subproyecto se construye **directo
en Supabase** (Edge Functions + tablas con RLS), no en Vercel.

**Éxito =** en el simulador de iOS, con el sandbox de Belvo: un usuario con suscripción conecta un banco de
prueba, ve sus cuentas y 12 meses de movimientos categorizados, recibe movimientos nuevos sin hacer nada, puede
reconectar, desconectar y borrar su cuenta sin dejar links vivos en Belvo.

## Fuera de alcance

- Acceso a producción de Belvo (trámite de Leonardo con Belvo: KYB, contrato, precio por link).
- Retirar el import PDF/CSV, `/api/analyze` y los parsers (subproyecto aparte, cuando Belvo esté en producción).
- Dejar la web, quitar Stripe, apagar Vercel, Android (subproyectos aparte).
- Rediseño general de la UX (Alan, en paralelo, sobre este contrato).

## Decisiones

| Tema | Decisión |
|---|---|
| Dónde vive | Supabase: Edge Functions + tablas con RLS. Nada nuevo en Vercel |
| Tipo de link | **Recurrente** (`access_mode: recurrent`): Belvo refresca a diario y avisa por webhook |
| Historia inicial | Lo que Belvo traiga en su actualización histórica (hasta 12 meses) |
| Datos existentes | No hay usuarios reales con imports: no se concilia nada con movimientos manuales |
| Categorización | Corrección previa del usuario (memoria) → reglas de `categorias.js` → IA (Claude Haiku) en lote solo para lo que quede en "Otros". Cada corrección del usuario se aprende |
| Pagos entre cuentas propias | Se detectan y se ligan; **no cuentan** como gasto ni como ingreso |
| Desconectar | Se borra el link en Belvo; los movimientos se quedan |
| Borrar cuenta | Primero se borran los links en Belvo, luego el usuario |
| Quién puede conectar | Solo usuarios con acceso (`userHasAccess`, modelo de acceso del subproyecto 1) |
| Límite | 5 bancos conectados por usuario (constante `MAX_LINKS_PER_USER`) |

## Arquitectura

```
App (Capacitor)                         Supabase                                   Belvo
──────────────                          ────────                                   ─────
Botón "Conectar banco" ──invoke──▶ belvo-connect-token ──────────── token ────────▶ /api/token/
Widget de Belvo (en la app) ◀─────── access token ─┘
   └─ onSuccess(link_id) ──invoke──▶ belvo-register-link ── GET link ─────────────▶ /api/links/{id}
                                          └─ insert bank_links
                                                                 ◀── webhook ────── historical_update /
                                     belvo-webhook ──────────── GET accounts/txns ─▶ new_transactions_available /
                                          └─ upsert bank_accounts, transactions        link status
                                          └─ categorizar (memoria → reglas → IA)
Botón "Actualizar" ──invoke──▶ belvo-sync (mismo pipeline, con límite)
Botón "Desconectar" ─invoke──▶ belvo-disconnect ── DELETE link ───────────────────▶ /api/links/{id}
Pantallas ──select (RLS)──▶ bank_links, bank_accounts, transactions
```

**La lógica pura vive en `src/lib/belvo/`** (JS sin dependencias de Supabase, probada con vitest):
mapeo de cuentas y movimientos, categorización, detección de transferencias propias, limpieza de pendientes.
Las Edge Functions solo hacen I/O (auth, Belvo, base de datos) y llaman a esa lógica. La app también puede importar
`src/lib/belvo/` (por ejemplo para los datos de prueba de Alan).

> **Verificar en la primera tarea:** que el bundler de Supabase Functions resuelva imports relativos fuera de
> `supabase/functions/` (`../../../src/lib/belvo/*.js`). Si no, la lógica pura se mueve a
> `supabase/functions/_shared/` y la app la importa desde ahí. Un solo lugar, nunca copias.

### Esquema de base de datos

Primera migración versionada del proyecto: `supabase/migrations/<timestamp>_belvo_core.sql`.

**`bank_links`**

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid pk | |
| `user_id` | uuid not null → `auth.users(id)` **on delete cascade** | |
| `belvo_link_id` | text not null **unique** | |
| `institution_name` | text | Nombre visible del banco |
| `institution_code` | text | Código de Belvo |
| `status` | text not null | `syncing` · `valid` · `token_required` · `invalid` · `disconnected` |
| `last_synced_at` | timestamptz | null mientras `syncing` |
| `last_error` | text | Último error visible para soporte |
| `created_at`, `updated_at` | timestamptz | |

**`bank_accounts`**

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid pk | |
| `user_id` | uuid not null → `auth.users` on delete cascade | |
| `link_id` | uuid not null → `bank_links(id)` on delete cascade | |
| `belvo_account_id` | text not null **unique** | |
| `name` | text | "Cuenta Libretón", "Tarjeta Oro" |
| `number_masked` | text | Últimos 4 dígitos |
| `account_type` | text not null | `debito` · `credito` (mapeado de la categoría de Belvo) |
| `currency` | text | `MXN` por defecto |
| `balance_current`, `balance_available` | numeric | Pesos, como el resto de la app |
| `credit_limit`, `cutoff_date`, `payment_due_date`, `minimum_payment`, `no_interest_payment` | numeric / date | Solo tarjetas |
| `connected` | boolean not null default true | false tras desconectar |
| `updated_at` | timestamptz | |

**`transactions` (existente) — columnas nuevas**

| Columna | Tipo | Notas |
|---|---|---|
| `source` | text not null default `'manual'` | `manual` · `belvo` |
| `external_id` | text | Id de Belvo. **Unique (`user_id`, `external_id`)** |
| `bank_account_id` | uuid → `bank_accounts(id)` on delete set null | |
| `belvo_status` | text | `processed` · `pending` |
| `categoria_origen` | text | `usuario` · `memoria` · `regla` · `ia` |
| `transfer_group_id` | uuid | Igual en los dos lados de un pago entre cuentas propias |
| `merchant` | text | Nombre de comercio si Belvo lo trae (mejora la memoria) |

Los movimientos de Belvo llenan también las columnas que ya usa la app (`date`, `concept`, `amount` positivo,
`type`, `categoria`, `account_type`, `bank`, `client = 'N/A'`, `user_id`), así las pantallas actuales los muestran sin cambios.

**RLS:**
- `bank_links` y `bank_accounts`: el usuario solo puede hacer `select` de sus filas. Escriben únicamente las Edge
  Functions (service role).
- `transactions`: sigue igual. El usuario puede actualizar `categoria`; al hacerlo, la app pone
  `categoria_origen = 'usuario'`.

### Edge Functions

Todas validan la sesión con el JWT de Supabase (`Authorization: Bearer`), salvo `belvo-webhook`.
Las que crean costo en Belvo exigen además `userHasAccess(user)`.

| Función | Método | Requiere | Hace |
|---|---|---|---|
| `belvo-connect-token` | POST | sesión + acceso | Pide a Belvo un access token del widget. Si recibe `link_id` (nuestro uuid), lo pide en **modo actualización** para ese link (reconectar). Rechaza si el usuario ya tiene `MAX_LINKS_PER_USER` links activos (salvo en modo actualización) |
| `belvo-register-link` | POST | sesión + acceso | Con el `belvo_link_id` que devolvió el widget: lo consulta en Belvo, exige `external_id === user.id`, `access_mode === 'recurrent'` y que no esté registrado por nadie. Inserta `bank_links` con `status: 'syncing'` y lanza una primera sincronización en segundo plano. En modo actualización solo pone `status: 'syncing'` y sincroniza |
| `belvo-webhook` | POST | header secreto | Valida el header de autorización configurado en Belvo. Ignora links que no estén en `bank_links`. Responde **200 de inmediato** y procesa en segundo plano (`EdgeRuntime.waitUntil`) |
| `belvo-sync` | POST | sesión + acceso | Sincronización manual de un link del usuario. **Límite:** 1 cada 10 min por link (429 con `retry_after`) |
| `belvo-disconnect` | POST | sesión | `DELETE` del link en Belvo (si Belvo responde 404, se considera borrado). `status: 'disconnected'`, cuentas `connected: false`. Movimientos intactos |

El widget se inicializa en la app con `external_id = user.id`. `belvo-register-link` es quien lo hace cumplir:
un link con otro `external_id` se rechaza con 403. **Verificar en sandbox** si Belvo permite fijar el
`external_id` desde el servidor al pedir el token; si sí, se fija ahí y la verificación queda como segunda barrera.

**Secretos de las funciones** (`supabase secrets set`): `BELVO_SECRET_ID`, `BELVO_SECRET_PASSWORD`,
`BELVO_ENV` (`sandbox` | `production`), `BELVO_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`.
Nunca en la app ni en el repo.

### Webhooks de Belvo que se procesan

| `webhook_type` / `webhook_code` | Acción |
|---|---|
| `ACCOUNTS` / `historical_update` | Upsert de cuentas del link |
| `TRANSACTIONS` / `historical_update` | Upsert de cuentas + todos los movimientos del periodo, categorizar, `status: 'valid'`, `last_synced_at` |
| `TRANSACTIONS` / `new_transactions_available` | Movimientos desde `last_synced_at − 3 días` (el traslape recupera fallos previos; el upsert es idempotente) |
| Estado del link: credenciales inválidas | `status: 'invalid'`, `last_error` |
| Estado del link: pide token / MFA | `status: 'token_required'` |
| Cualquier otro | Se registra y se ignora |

> Los nombres exactos de `webhook_code` para estado del link se confirman contra la documentación y el sandbox de
> Belvo en la primera tarea de webhooks; el diseño solo depende de poder distinguir "credenciales inválidas" de
> "pide token".

### Pipeline de sincronización (una función pura por paso, en `src/lib/belvo/`)

1. **Traer** cuentas y movimientos del link desde Belvo (paginado, por rango de fechas).
2. **Mapear cuenta** → `bank_accounts`: categoría de tarjeta de crédito → `credito`; cuentas de cheques/ahorro → `debito`.
   Datos de crédito de Belvo → `credit_limit`, `cutoff_date`, `payment_due_date`, `minimum_payment`, `no_interest_payment`.
3. **Mapear movimiento** → fila de `transactions`:
   - `amount = abs(monto)`, `date` = fecha valor (o contable si falta), `concept` = descripción, `merchant` si existe.
   - `type`: entrada → `Ingreso`; salida → `Egreso`; **en tarjeta de crédito, una entrada (pago) → `Transferencia`**
     (misma convención que hoy usa el import CSV de crédito).
   - `belvo_status`: `pending` | `processed`.
4. **Pendientes:** dentro del rango sincronizado, se borran los movimientos `belvo_status = 'pending'` de esa cuenta
   cuyo `external_id` ya no viene en la respuesta (Belvo puede reemitir el movimiento confirmado con otro id).
   **Verificar en sandbox**; si Belvo conserva el id, este paso no borra nada.
5. **Categorizar** solo filas nuevas o sin `categoria_origen = 'usuario'`:
   1. Memoria del usuario (`construirMemoriaCategorias` sobre sus movimientos con `categoria_origen = 'usuario'`) → `memoria`.
   2. Reglas (`inferirCategoria`) → `regla` si da algo distinto de "Otros".
   3. Las que siguen en "Otros": **una llamada por lote** a Claude Haiku con concepto, comercio, monto y tipo,
      pidiendo una categoría de `CATEGORIAS_ALL` (respuesta validada contra la lista; inválida → "Otros") → `ia`.
      Si la IA falla o no hay `ANTHROPIC_API_KEY`, se quedan en "Otros" y se reintentan en la próxima sincronización.
   - **Nunca** se sobrescribe una categoría con `categoria_origen = 'usuario'`.
6. **Transferencias propias:** se ligan pares del mismo usuario donde una salida de una cuenta y una entrada de otra
   cuenta suya tienen el mismo monto y fechas a ±3 días, y al menos uno de los dos conceptos parece pago o
   transferencia (`PAGO`, `SPEI`, `TRASPASO`, `TRANSF`, `TDC`). Ambos lados reciben el mismo `transfer_group_id` y
   categoría `Transferencia entre tus cuentas` (se agrega a `categorias.js`). Ante dos candidatos, no se liga
   ninguno: preferimos no ligar a ligar mal.
7. **Guardar** con upsert por (`user_id`, `external_id`); actualizar `bank_links.last_synced_at` y `status: 'valid'`.

## Contrato para el frontend (Alan)

Alan construye las pantallas contra este contrato con **datos de prueba** (`src/lib/belvo/mock.js`, mismo formato)
mientras el backend se hace. Cambiar el contrato requiere actualizar esta sección y avisar al otro.

### Lecturas (cliente de Supabase, protegidas por RLS)

```js
// Bancos conectados
supabase.from('bank_links')
  .select('id, institution_name, status, last_synced_at, last_error')
  .neq('status', 'disconnected')
// → [{ id, institution_name, status: 'syncing'|'valid'|'token_required'|'invalid', last_synced_at, last_error }]

// Cuentas de un banco
supabase.from('bank_accounts')
  .select('id, link_id, name, number_masked, account_type, currency, balance_current, balance_available, credit_limit, cutoff_date, payment_due_date, minimum_payment, no_interest_payment, connected')
  .eq('link_id', linkId)

// Movimientos: la misma consulta de hoy; columnas nuevas disponibles:
// source, bank_account_id, belvo_status, categoria_origen, transfer_group_id, merchant
```

### Acciones (`supabase.functions.invoke(nombre, { body })`)

| Función | `body` | Éxito | Errores |
|---|---|---|---|
| `belvo-connect-token` | `{}` o `{ link_id }` (reconectar) | `{ access: string }` | 401 sin sesión · 402 sin suscripción · 409 `{ error: 'max_links' }` |
| `belvo-register-link` | `{ belvo_link_id }` | `{ link: { id, institution_name, status: 'syncing' } }` | 400 · 402 · 403 link ajeno · 409 ya registrado |
| `belvo-sync` | `{ link_id }` | 202 `{ status: 'syncing' }` | 404 · 429 `{ retry_after: segundos }` |
| `belvo-disconnect` | `{ link_id }` | `{ ok: true }` | 404 |

`link_id` siempre es **nuestro** `bank_links.id`, nunca el id de Belvo (salvo en `belvo-register-link`).

### Reglas de UI que dependen del backend

- **Totales:** gastos, ingresos, gráficas y presupuestos **excluyen** filas con `transfer_group_id` no nulo.
  Hoy las pantallas suman por `type`; hay que agregar este filtro en los cálculos de dashboard, finanzas y presupuestos.
- **Estado del banco:** `syncing` → "Sincronizando…" (refrescar la lista cada ~10 s mientras haya alguno);
  `valid` → "Al día · hace X"; `token_required` / `invalid` → botón "Reconectar" (abre el widget en modo actualización).
- **Cambiar categoría:** `update({ categoria, categoria_origen: 'usuario' })` sobre la fila.
- **Movimientos pendientes:** mostrarlos con una marca "pendiente" (`belvo_status = 'pending'`).
- **Widget:** se carga el SDK de Belvo dentro de la app (como `BankConnectWidget.jsx` hoy), con `external_id = user.id`,
  `locale: 'es'` y el `access` de `belvo-connect-token`.

## Errores y casos límite

- **Webhook antes de que termine el registro** (carrera): un webhook de un link aún no registrado se ignora; la
  actualización histórica se vuelve a traer con `belvo-sync` o el siguiente `new_transactions_available`. Además,
  `belvo-register-link` lanza una primera sincronización en segundo plano.
- **Belvo caído / 5xx:** el link conserva su estado, `last_error` guarda el mensaje; la siguiente sincronización reintenta.
- **Usuario pierde la suscripción:** sus links siguen (los movimientos son suyos) pero `belvo-sync` y conectar
  responden 402. **Decisión pendiente para producción:** si se desconectan los links tras N días sin suscripción
  (Belvo cobra por link activo). En sandbox no aplica.
- **Moneda distinta de MXN:** se guarda tal cual con su `currency`; las sumas en MXN la excluyen (nota para Alan).
- **Borrar cuenta** (`/api/account` hoy, Edge Function después): lista los `belvo_link_id` del usuario, los borra en
  Belvo (404 = ya borrado), y solo entonces borra el usuario. Si Belvo falla, **no** se borra el usuario y se responde error.

## Pruebas

- **Unitarias (vitest) sobre `src/lib/belvo/`:** mapeo de cuentas (débito/crédito, datos de crédito), mapeo de
  movimientos (tipos, pago de tarjeta → `Transferencia`, montos, fechas), categorización (memoria gana a reglas,
  reglas ganan a IA, nunca pisa `usuario`, respuesta inválida de IA → "Otros"), transferencias propias (par
  claro se liga, ambiguo no, montos distintos no), limpieza de pendientes.
- **Funciones:** pruebas con Belvo y Anthropic simulados (fetch inyectado) para: link ajeno → 403, duplicado → 409,
  sin acceso → 402, webhook sin secreto → 401, webhook de link desconocido → ignorado, límite de `belvo-sync` → 429.
- **Sandbox de Belvo + simulador iOS (manual, guion en el plan):** conectar banco de prueba → histórico → categorías;
  forzar movimientos nuevos; forzar credenciales inválidas → reconectar; desconectar; borrar cuenta y comprobar en el
  dashboard de Belvo que no quedan links.

## Pendientes fuera de código (Leonardo)

- Solicitar a Belvo acceso a producción (KYB, contrato, precio por link activo) — en paralelo, desde ya.
- Registrar el webhook en el dashboard de Belvo apuntando a `belvo-webhook`, con el header secreto.
- Definir la política de links de usuarios sin suscripción antes de producción.
