# Cuentas de prueba

**Una cuenta por tester, no una compartida.** Cada una tiene su propio `user_id`,
así que las políticas RLS las aíslan por completo: quien importe, edite o borre
todo solo toca su propia copia. Nadie puede dejar sin datos al resto.

Hay dos caminos al mismo dataset:

| | iOS / TestFlight | Web |
|---|---|---|
| Cómo entra el tester | Email + contraseña en el login normal | Abre `nva.lat/demo?code=…` |
| Requiere build nuevo | **No** — funciona en el build que ya tienen | No |
| Cuándo expira | Nunca (se retiran a mano) | `DEMO_TTL_HOURS` (72 h) |
| Se crean con | `scripts/seed/create-demo-accounts.mjs` | `/api/demo`, al vuelo |

El grupo de prueba en iPhone usa el primero. El bundle nativo es un export
estático y las cuentas pre-creadas no necesitan API: el formulario de
email/password que ya está en la app las acepta tal cual, y como traen
`onboarded: true` caen directo en `/finanzas`, sin onboarding ni paywall.

## Repartir cuentas al grupo de prueba

```bash
node scripts/seed/create-demo-accounts.mjs --count 15
```

Imprime y guarda en `demo-accounts.csv` (gitignored) algo así:

```
cuenta,email,password
tester01,tester01@demo.nva.lat,mesa-tigre-nube
tester02,tester02@demo.nva.lat,faro-cedro-ola
```

Las contraseñas son tres palabras con guiones — se dictan por teléfono y se
escriben sin pelear con el teclado del iPhone. Reparte una por persona.

Necesita `SUPABASE_SERVICE_ROLE_KEY` en `.env.local` o en el entorno (el script
lee `.env.local` solo). **Esa key salta RLS: nunca la subas al repo ni al bundle.**

Otros comandos:

```bash
node scripts/seed/create-demo-accounts.mjs --list             # cuentas vivas y último acceso
node scripts/seed/create-demo-accounts.mjs --reset tester03   # regenera datos, misma contraseña
node scripts/seed/create-demo-accounts.mjs --reset all
node scripts/seed/create-demo-accounts.mjs --delete all --yes # retira la ronda de pruebas
node scripts/seed/create-demo-accounts.mjs --count 5          # agrega 5 más sin tocar las existentes
```

`--reset` es la vía cuando alguien destroza sus datos y quiere volver a empezar:
borra sus filas y las siembra otra vez, sin cambiar la contraseña.

Las contraseñas **no se pueden recuperar** después (Supabase guarda solo el
hash). Si se pierde el CSV, borra y vuelve a crear las cuentas.

## Qué trae cada cuenta

| Sección | Contenido |
|---|---|
| Finanzas / Dashboard | 516 movimientos reales anonimizados — BBVA débito y crédito, Nu, Citibanamex, Inbursa, Scotiabank. ~25 meses, ambos tipos de cuenta, 19 categorías. |
| Portfolio | 11 posiciones (crypto, stocks, ETF, bono, REIT), precios en vivo de Yahoo/CoinGecko. |
| Presupuestos | 4 metas de ahorro, ninguna completada, con sus pagos parciales. |
| Recordatorios | 8: próximos y vencidos, mensuales, uno enlazado a una meta. |

Trading queda vacío a propósito.

Las fechas se **rebasan sobre el día del alta**: el movimiento más reciente
siempre cae hoy, así que los filtros del dashboard (Este mes / 3 meses) nunca
salen vacíos por más viejo que sea el seed.

`subscription_status: 'free'` satisface `hasAccess()` sin consumir slots de la
promo `free_grants`.

## Setup (una vez)

1. Correr [`supabase-demo.sql`](../supabase-demo.sql) en el SQL Editor de Supabase.
   Agrega `budgets.icon`, que el selector de emoji ya escribe pero
   [`supabase-budgets.sql`](../supabase-budgets.sql) nunca creó.
2. `SUPABASE_SERVICE_ROLE_KEY` disponible en local para correr el script.

Para el flujo web (`/demo`), además:

| Variable | Requerida | Default | Para qué |
|---|---|---|---|
| `DEMO_ACCESS_CODE` | sí | — | Código del link. **Sin ella `/api/demo` responde 503 y el demo web queda apagado.** |
| `CRON_SECRET` | sí | — | Autentica el cron de `/api/demo/cleanup`. |
| `DEMO_MAX_PER_IP` | no | `5` | Altas por IP cada 24 h. |
| `DEMO_TTL_HOURS` | no | `72` | Edad a la que expira una demo web. |

`vercel.json` corre `/api/demo/cleanup` diario a las 08:00 UTC. Solo borra
cuentas con email `@demo.nva.lat`, `is_demo: true` y **sin** `demo_persistent`
— las del grupo de prueba nunca las toca.

A mano:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://www.nva.lat/api/demo/cleanup
```

## Regenerar los datos de ejemplo

Los PDFs fuente viven en `Estados de cuenta statement/` y están gitignored:
solo se leen al generar el seed, en local. Nunca se publican.

```bash
node scripts/seed/build-demo-seed.mjs   # → src/lib/demo/seed-transactions.js
npx vitest run __tests__/demoSeed.test.js
```

El script corre los parsers deterministas de `src/lib/statementParser`, anonimiza
cada concepto y guarda el resultado como módulo `.js` (no `.json`, para que
`create-demo-accounts.mjs` lo importe desde node sin import attributes).

La anonimización:

- reemplaza nombres de persona por ficticios con mapeo estable — el mismo nombre
  real siempre da el mismo ficticio, así el historial de transferencias sigue
  siendo coherente;
- cubre nombres pegados por el procesador (`MERPAGO*CARLOSEDUARDO`);
- respeta razones sociales vía `MERCHANT_TOKENS`, para no destrozar
  `SUPER FYC GUTIERREZ` ni `FERRE CASA SERGIO MORE`;
- borra CLABEs, tarjetas, RFC y referencias largas.

`__tests__/demoSeed.test.js` verifica la forma del seed y que no reaparezca PII.
Portfolio, metas y recordatorios se editan a mano en `src/lib/demo/seed.js`.

Después de regenerar, `--reset all` propaga los datos nuevos a las cuentas ya
repartidas sin cambiar contraseñas.

### Bancos que faltan

`HSBC debito.pdf`, `Santander debito.pdf` y `Santander credito pdf.pdf` son PDFs
escaneados, sin capa de texto, y no hay parser determinista para ellos: quedan
fuera del seed. Entran solos si algún día se les escribe parser.

## Nota para el build nativo

`/api/demo` y `/api/demo/cleanup` están en `FILES_TO_STUB` de
[`scripts/build-capacitor.js`](../scripts/build-capacitor.js). Son rutas
dinámicas y `output: export` las rechaza; viven en Vercel y el nativo las
llamaría vía `API_BASE`. Sin ese stub, `npm run build:native` falla.
