# Sincronización bancaria — backend (parte independiente del proveedor) — Plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDO: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para ejecutar este plan tarea por tarea. Los pasos usan checkbox (`- [ ]`).

**Objetivo:** construir todo el backend de la sincronización bancaria que **no depende del proveedor**: tablas con RLS, pipeline de sincronización (mapeo, categorización con memoria/reglas/IA, transferencias propias, pendientes), las 5 Edge Functions y un proveedor simulado. El adaptador del proveedor real (Syncfy) se agrega después, en otro plan.

**Arquitectura:**
- Toda la lógica vive en `supabase/functions/_shared/` como **JS puro** (ESM, imports relativos con `.js`, sin `@/` ni paquetes), así corre igual en Deno (Edge Functions), Node (vitest) y Next (la app).
- Las Edge Functions (`supabase/functions/bank-*/index.ts`) solo conectan dependencias: cliente de Supabase, proveedor, clasificador de IA.
- Los handlers reciben sus dependencias inyectadas (`db`, `provider`, `classify`, `now`, `runInBackground`), así se prueban con dobles en memoria.
- Sin `BANK_PROVIDER` configurado, las funciones responden **503 `provider_unavailable`**: se pueden desplegar sin riesgo.

**Stack:** Supabase (Postgres + Edge Functions/Deno), supabase-js 2, Next.js 15 (JS), vitest.

**Spec:** `docs/superpowers/specs/2026-10-12-sincronizacion-bancaria-design.md`

## Restricciones globales

- Código en `supabase/functions/_shared/**`: JS puro ESM; imports relativos **con extensión `.js`**; **prohibido** `@/`, `npm:`, `node:` y paquetes. Debe importarse en Node ESM sin errores.
- Nombres exactos: tablas `bank_links`, `bank_accounts`; columnas `provider_link_id`, `provider_account_id`, `bank_status` (`pending`|`processed`), `categoria_origen` (`usuario`|`memoria`|`regla`|`ia`), `transfer_group_id`, `merchant`, `source` (`manual`|`banco`), `last_manual_sync_at`; funciones `bank-connect-token`, `bank-register-link`, `bank-sync`, `bank-disconnect`, `bank-webhook`.
- Estados de link: `syncing`, `valid`, `token_required`, `invalid`, `disconnected`.
- Constantes: `MAX_LINKS_PER_USER = 5`, `SYNC_COOLDOWN_SECONDS = 600`, `OVERLAP_DAYS = 3`, `INITIAL_HISTORY_DAYS = 365`, `TRANSFER_WINDOW_DAYS = 3`, `TRANSFER_CATEGORY = 'Transferencia entre tus cuentas'`.
- Montos positivos en pesos (`numeric`); fechas `YYYY-MM-DD`.
- **Nunca** se sobrescribe una categoría con `categoria_origen = 'usuario'`.
- IA: modelo `claude-haiku-5-5`, lotes de 50, respuesta validada contra `CATEGORIAS_ALL`.
- **Prohibido en este plan:** desplegar (`supabase functions deploy`, `supabase db push`), `supabase link`, `supabase secrets set`, correr SQL contra cualquier base, push o merge. El despliegue es un runbook para Leonardo (Task 11).
- No instalar dependencias.
- Verificar con: `npx vitest run`, `npx eslint <archivos>`, `npm run build`.
- Commits en español, estilo `feat(bancos): …`, con trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `supabase/functions/_shared/categorias.js` | Mover desde `src/lib/categorias.js` (+1 categoría) | Reglas, memoria, listas de categorías |
| `supabase/functions/_shared/access.js` | Mover desde `src/lib/access.js` | Acceso pagado (`userHasAccess`…) |
| `src/lib/categorias.js`, `src/lib/access.js` | Reescribir | Re-exportan lo de `_shared` (la app no cambia) |
| `supabase/config.toml` | Crear | `bank-webhook` sin verificación de JWT |
| `supabase/migrations/20261013000000_bank_sync_core.sql` | Crear | Tablas, columnas, RLS |
| `_shared/bancos/constants.js` | Crear | Constantes del dominio |
| `_shared/bancos/mapping.js` | Crear | Proveedor normalizado → filas |
| `_shared/bancos/transfers.js` | Crear | Detección de transferencias propias |
| `_shared/bancos/pending.js` | Crear | Pendientes que el proveedor ya no devuelve |
| `_shared/bancos/categorize.js` | Crear | Memoria → reglas → IA |
| `_shared/bancos/ai.js` | Crear | Clasificador por lotes con Anthropic |
| `_shared/bancos/provider/index.js`, `provider/mock.js` | Crear | Selección de proveedor + proveedor simulado |
| `_shared/bancos/db.js` | Crear | Acceso a datos sobre un cliente supabase-js |
| `_shared/bancos/sync.js` | Crear | Orquesta una sincronización |
| `_shared/bancos/handlers.js` | Crear | Lógica de las 5 funciones + borrar links al borrar cuenta |
| `_shared/bancos/serve.js` | Crear | Adaptador HTTP (CORS, auth, deps) |
| `supabase/functions/bank-*/index.ts` | Crear (5) | Entradas Deno |
| `src/lib/bancos/mock.js`, `src/lib/bancos/client.js` | Modificar | Constante compartida; código `unavailable` (503) |
| `src/app/api/account/route.js` | Modificar | Borrar links del proveedor antes del usuario |
| `eslint.config.mjs` | Modificar | Ignorar entradas Deno |
| `docs/BANCOS_BACKEND.md` | Crear | Runbook de despliegue |
| `__tests__/bancos/*.test.js`, `__tests__/helpers/fakeBankDb.js` | Crear | Pruebas |

---

### Task 0: Rama

- [ ] **Step 1**

```bash
git checkout main && git pull
git checkout -b feature/bancos-backend
npx vitest run
```

Esperado: todo en verde (80 tests).

---

### Task 1: Código compartido en `_shared` y configuración de Supabase

**Files:**
- Move: `src/lib/categorias.js` → `supabase/functions/_shared/categorias.js`
- Move: `src/lib/access.js` → `supabase/functions/_shared/access.js`
- Create: `src/lib/categorias.js`, `src/lib/access.js` (re-exports)
- Create: `supabase/config.toml`
- Modify: `eslint.config.mjs`
- Test: `__tests__/bancos/sharedImports.test.js`

**Interfaces:**
- Produce: `supabase/functions/_shared/categorias.js` y `.../access.js` con las mismas exportaciones de hoy, más `'Transferencia entre tus cuentas'` en `CATEGORIAS_EGRESO`.

- [ ] **Step 1: Test de importación en Node puro (falla)**

`__tests__/bancos/sharedImports.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..', '..');
const sharedDir = path.join(root, 'supabase', 'functions', '_shared');

function jsFiles(dir) {
    return readdirSync(dir).flatMap((f) => {
        const p = path.join(dir, f);
        return statSync(p).isDirectory() ? jsFiles(p) : p.endsWith('.js') ? [p] : [];
    });
}

describe('_shared es JS puro portable a Deno', () => {
    it('cada archivo se importa en Node ESM sin alias ni paquetes', () => {
        for (const file of jsFiles(sharedDir)) {
            const rel = './' + path.relative(root, file).split(path.sep).join('/');
            execFileSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(rel)})`], { cwd: root });
        }
    });

    it('ningún import usa @/, npm:, node: ni rutas sin .js', () => {
        for (const file of jsFiles(sharedDir)) {
            const src = readFileSync(file, 'utf8');
            const specs = [...src.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
            for (const s of specs) {
                expect(s.startsWith('./') || s.startsWith('../'), `${file}: ${s}`).toBe(true);
                expect(s.endsWith('.js'), `${file}: ${s}`).toBe(true);
            }
        }
    });

    it('la app sigue viendo las mismas exportaciones', async () => {
        const viaApp = await import('../../src/lib/categorias.js');
        expect(viaApp.CATEGORIAS_EGRESO).toContain('Transferencia entre tus cuentas');
        expect(typeof viaApp.claveComercio).toBe('function');
        const access = await import('../../src/lib/access.js');
        expect(typeof access.userHasAccess).toBe('function');
    });
});
```

Run: `npx vitest run __tests__/bancos/sharedImports.test.js` → FAIL (no existe `_shared`).

- [ ] **Step 2: Mover y re-exportar**

```bash
mkdir -p supabase/functions/_shared
git mv src/lib/categorias.js supabase/functions/_shared/categorias.js
git mv src/lib/access.js supabase/functions/_shared/access.js
```

`src/lib/categorias.js`:

```js
// Lives in supabase/functions/_shared so Edge Functions (Deno) and the app share one copy.
export * from '../../supabase/functions/_shared/categorias.js';
```

`src/lib/access.js`:

```js
// Lives in supabase/functions/_shared so Edge Functions (Deno) and the app share one copy.
export * from '../../supabase/functions/_shared/access.js';
```

En `supabase/functions/_shared/categorias.js`, dentro de `CATEGORIAS_EGRESO`, agregar después de `'Transferencias',`:

```js
    'Transferencia entre tus cuentas',
```

- [ ] **Step 3: Configuración de Supabase y ESLint**

`supabase/config.toml`:

```toml
# Supabase CLI config. Only what this repo needs; the CLI fills the rest with defaults.
project_id = "nva"

# Provider webhooks don't carry a Supabase JWT; the function checks its own secret.
[functions.bank-webhook]
verify_jwt = false
```

`eslint.config.mjs`: reemplazar

```js
const eslintConfig = [
  ...compat.extends("next/core-web-vitals"),
];
```

por

```js
const eslintConfig = [
  // Deno entrypoints for Supabase Edge Functions (Deno globals, npm: imports).
  { ignores: ["supabase/functions/**/index.ts"] },
  ...compat.extends("next/core-web-vitals"),
];
```

- [ ] **Step 4: Verificar**

Run: `npx vitest run && npm run build`
Esperado: todo en verde (83 tests) y build OK.

- [ ] **Step 5: Commit**

```bash
git add -A supabase src/lib/categorias.js src/lib/access.js eslint.config.mjs __tests__/bancos
git commit -m "feat(bancos): código compartido con Edge Functions en supabase/functions/_shared"
```

---

### Task 2: Migración de base de datos

**Files:**
- Create: `supabase/migrations/20261013000000_bank_sync_core.sql`

- [ ] **Step 1: Escribir la migración**

```sql
-- Bank sync core: provider links, accounts and bank columns on transactions.
-- Additive and idempotent: safe to run before any code that uses it.

create table if not exists public.bank_links (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    provider_link_id text not null unique,
    institution_name text,
    institution_code text,
    status text not null default 'syncing'
        check (status in ('syncing', 'valid', 'token_required', 'invalid', 'disconnected')),
    last_synced_at timestamptz,
    last_manual_sync_at timestamptz,
    last_error text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists bank_links_user_id_idx on public.bank_links(user_id);

create table if not exists public.bank_accounts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    link_id uuid not null references public.bank_links(id) on delete cascade,
    provider_account_id text not null unique,
    name text,
    number_masked text,
    account_type text not null check (account_type in ('debito', 'credito')),
    currency text not null default 'MXN',
    balance_current numeric,
    balance_available numeric,
    credit_limit numeric,
    cutoff_date date,
    payment_due_date date,
    minimum_payment numeric,
    no_interest_payment numeric,
    connected boolean not null default true,
    updated_at timestamptz not null default now()
);
create index if not exists bank_accounts_link_id_idx on public.bank_accounts(link_id);
create index if not exists bank_accounts_user_id_idx on public.bank_accounts(user_id);

alter table public.transactions
    add column if not exists source text not null default 'manual',
    add column if not exists external_id text,
    add column if not exists bank_account_id uuid references public.bank_accounts(id) on delete set null,
    add column if not exists bank_status text,
    add column if not exists categoria_origen text,
    add column if not exists transfer_group_id uuid,
    add column if not exists merchant text;

-- One row per provider transaction per user. NULL external_id (manual rows) never conflicts.
do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'transactions_user_external_key') then
        alter table public.transactions
            add constraint transactions_user_external_key unique (user_id, external_id);
    end if;
end $$;
create index if not exists transactions_transfer_group_idx
    on public.transactions(transfer_group_id) where transfer_group_id is not null;
create index if not exists transactions_bank_account_date_idx
    on public.transactions(bank_account_id, date) where bank_account_id is not null;

-- Users read their own links/accounts; only Edge Functions (service role) write.
alter table public.bank_links enable row level security;
alter table public.bank_accounts enable row level security;

drop policy if exists "bank_links_select_own" on public.bank_links;
create policy "bank_links_select_own" on public.bank_links
    for select to authenticated using (auth.uid() = user_id);

drop policy if exists "bank_accounts_select_own" on public.bank_accounts;
create policy "bank_accounts_select_own" on public.bank_accounts
    for select to authenticated using (auth.uid() = user_id);

revoke insert, update, delete on public.bank_links, public.bank_accounts from anon, authenticated;
```

- [ ] **Step 2: Revisión estática**

No hay base local (Docker no corre en esta máquina). Revisar a mano que: todos los `create` usen `if not exists`, el bloque `do $$` sea idempotente, y no haya `drop table`/`drop column`. **No ejecutar el SQL.**

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations
git commit -m "feat(bancos): migración de tablas de sincronización bancaria con RLS"
```

---

### Task 3: Constantes y mapeo

**Files:**
- Create: `supabase/functions/_shared/bancos/constants.js`, `.../mapping.js`
- Modify: `src/lib/bancos/mock.js` (usar la constante compartida)
- Test: `__tests__/bancos/mapping.test.js`

**Interfaces — formatos normalizados del proveedor** (todo adaptador los produce):
- `ProviderAccount`: `{ id, name, numberMasked, kind: 'debit'|'credit', currency, balanceCurrent, balanceAvailable, credit: { limit, cutoffDate, paymentDueDate, minimumPayment, noInterestPayment } | null }`
- `ProviderTransaction`: `{ id, accountId, date: 'YYYY-MM-DD', description, merchant: string|null, amount: number>0, direction: 'in'|'out', status: 'pending'|'processed', currency }`
- Produce: `mapAccount(pa, { userId, linkId }) → bank_accounts row`, `mapTransaction(pt, { userId, account, bankName }) → transactions row` (`account` = fila de `bank_accounts` con `id`, `account_type`).

- [ ] **Step 1: Test (falla)**

`__tests__/bancos/mapping.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { mapAccount, mapTransaction } from '../../supabase/functions/_shared/bancos/mapping.js';
import { MAX_LINKS_PER_USER, TRANSFER_CATEGORY } from '../../supabase/functions/_shared/bancos/constants.js';

const credit = {
    id: 'pa-2', name: 'Tarjeta Azul', numberMasked: '•••• 9034', kind: 'credit', currency: 'MXN',
    balanceCurrent: '7350.00', balanceAvailable: 22650, credit: { limit: 30000, cutoffDate: '2026-10-20', paymentDueDate: '2026-11-09', minimumPayment: 650, noInterestPayment: 7350 },
};

describe('constantes', () => {
    it('valores del spec', () => {
        expect(MAX_LINKS_PER_USER).toBe(5);
        expect(TRANSFER_CATEGORY).toBe('Transferencia entre tus cuentas');
    });
});

describe('mapAccount', () => {
    it('tarjeta → credito con datos de crédito numéricos', () => {
        expect(mapAccount(credit, { userId: 'u1', linkId: 'l1' })).toEqual({
            user_id: 'u1', link_id: 'l1', provider_account_id: 'pa-2', name: 'Tarjeta Azul', number_masked: '•••• 9034',
            account_type: 'credito', currency: 'MXN', balance_current: 7350, balance_available: 22650,
            credit_limit: 30000, cutoff_date: '2026-10-20', payment_due_date: '2026-11-09', minimum_payment: 650, no_interest_payment: 7350,
            connected: true,
        });
    });
    it('débito → sin datos de crédito y MXN por defecto', () => {
        const row = mapAccount({ id: 'pa-1', name: 'Cuenta', kind: 'debit', balanceCurrent: 10, credit: { limit: 1 } }, { userId: 'u1', linkId: 'l1' });
        expect(row).toMatchObject({ account_type: 'debito', currency: 'MXN', credit_limit: null, cutoff_date: null, balance_available: null });
    });
});

describe('mapTransaction', () => {
    const debitAcc = { id: 'acc-1', account_type: 'debito' };
    const creditAcc = { id: 'acc-2', account_type: 'credito' };
    const base = { id: 'pt-1', accountId: 'pa-1', date: '2026-10-01', description: '  OXXO REFORMA  ', merchant: 'OXXO', amount: -89.5, direction: 'out', status: 'processed', currency: 'MXN' };

    it('salida → Egreso con columnas de la app y del banco', () => {
        expect(mapTransaction(base, { userId: 'u1', account: debitAcc, bankName: 'BBVA' })).toEqual({
            user_id: 'u1', source: 'banco', external_id: 'pt-1', bank_account_id: 'acc-1', date: '2026-10-01',
            concept: 'OXXO REFORMA', merchant: 'OXXO', amount: 89.5, type: 'Egreso', account_type: 'debito', bank: 'BBVA',
            client: 'N/A', bank_status: 'processed', categoria: null, categoria_origen: null, transfer_group_id: null,
        });
    });
    it('entrada en débito → Ingreso; entrada en crédito (pago) → Transferencia', () => {
        expect(mapTransaction({ ...base, direction: 'in' }, { userId: 'u1', account: debitAcc, bankName: 'B' }).type).toBe('Ingreso');
        expect(mapTransaction({ ...base, direction: 'in' }, { userId: 'u1', account: creditAcc, bankName: 'B' }).type).toBe('Transferencia');
    });
    it('pendiente, concepto vacío y sin banco', () => {
        const r = mapTransaction({ ...base, status: 'pending', description: '', merchant: undefined }, { userId: 'u1', account: debitAcc });
        expect(r).toMatchObject({ bank_status: 'pending', concept: 'Movimiento', merchant: null, bank: 'Banco' });
    });
});
```

Run: `npx vitest run __tests__/bancos/mapping.test.js` → FAIL.

- [ ] **Step 2: Implementar**

`supabase/functions/_shared/bancos/constants.js`:

```js
// Domain constants for bank sync. Shared by Edge Functions, the app and tests.
export const MAX_LINKS_PER_USER = 5;
export const SYNC_COOLDOWN_SECONDS = 600;
export const OVERLAP_DAYS = 3;
export const INITIAL_HISTORY_DAYS = 365;
export const TRANSFER_WINDOW_DAYS = 3;
export const TRANSFER_CATEGORY = 'Transferencia entre tus cuentas';

export const LINK_STATUS = Object.freeze({
    SYNCING: 'syncing',
    VALID: 'valid',
    TOKEN_REQUIRED: 'token_required',
    INVALID: 'invalid',
    DISCONNECTED: 'disconnected',
});
```

`supabase/functions/_shared/bancos/mapping.js`:

```js
// Normalized provider data → rows for bank_accounts / transactions.
// Provider adapters must emit ProviderAccount / ProviderTransaction (see plan Task 3).

function numOrNull(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

export function mapAccount(pa, { userId, linkId }) {
    const credit = pa.kind === 'credit' ? (pa.credit || {}) : null;
    return {
        user_id: userId,
        link_id: linkId,
        provider_account_id: pa.id,
        name: pa.name ?? null,
        number_masked: pa.numberMasked ?? null,
        account_type: pa.kind === 'credit' ? 'credito' : 'debito',
        currency: pa.currency || 'MXN',
        balance_current: numOrNull(pa.balanceCurrent),
        balance_available: numOrNull(pa.balanceAvailable),
        credit_limit: credit ? numOrNull(credit.limit) : null,
        cutoff_date: credit?.cutoffDate ?? null,
        payment_due_date: credit?.paymentDueDate ?? null,
        minimum_payment: credit ? numOrNull(credit.minimumPayment) : null,
        no_interest_payment: credit ? numOrNull(credit.noInterestPayment) : null,
        connected: true,
    };
}

// A payment into a credit card is 'Transferencia' — same convention the CSV
// import already uses for credit statements.
export function mapTransaction(pt, { userId, account, bankName }) {
    const isCredit = account.account_type === 'credito';
    const type = pt.direction === 'in' ? (isCredit ? 'Transferencia' : 'Ingreso') : 'Egreso';
    return {
        user_id: userId,
        source: 'banco',
        external_id: pt.id,
        bank_account_id: account.id,
        date: pt.date,
        concept: String(pt.description || '').trim().slice(0, 200) || 'Movimiento',
        merchant: pt.merchant || null,
        amount: Math.abs(Number(pt.amount) || 0),
        type,
        account_type: account.account_type,
        bank: bankName || 'Banco',
        client: 'N/A',
        bank_status: pt.status === 'pending' ? 'pending' : 'processed',
        categoria: null,
        categoria_origen: null,
        transfer_group_id: null,
    };
}
```

En `src/lib/bancos/mock.js` reemplazar `export const MAX_LINKS_PER_USER = 5;` por:

```js
export { MAX_LINKS_PER_USER } from '../../../supabase/functions/_shared/bancos/constants.js';
import { MAX_LINKS_PER_USER } from '../../../supabase/functions/_shared/bancos/constants.js';
```

(los `import` se mueven arriba del archivo si ESLint lo exige: `import/first`).

- [ ] **Step 3: Verificar**

Run: `npx vitest run __tests__/bancos __tests__/bancosMock.test.js` → PASS.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/_shared/bancos src/lib/bancos/mock.js __tests__/bancos/mapping.test.js
git commit -m "feat(bancos): constantes y mapeo de datos del proveedor"
```

---

### Task 4: Transferencias propias y pendientes

**Files:**
- Create: `supabase/functions/_shared/bancos/transfers.js`, `.../pending.js`
- Test: `__tests__/bancos/transfers.test.js`, `__tests__/bancos/pending.test.js`

**Interfaces:**
- Produce: `findOwnTransferPairs(rows) → Array<[keyOut, keyIn]>` (rows con `key`, `bank_account_id`, `date`, `amount`, `type`, `concept`, `transfer_group_id`); `stalePendingExternalIds(existing, fetchedIds, { from, to }) → string[]`.

- [ ] **Step 1: Tests (fallan)**

`__tests__/bancos/transfers.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { findOwnTransferPairs } from '../../supabase/functions/_shared/bancos/transfers.js';

const out = (key, acc, date, amount, concept = 'PAGO TDC 9034 SPEI') => ({ key, bank_account_id: acc, date, amount, type: 'Egreso', concept, transfer_group_id: null });
const inn = (key, acc, date, amount, concept = 'SU PAGO GRACIAS', type = 'Transferencia') => ({ key, bank_account_id: acc, date, amount, type, concept, transfer_group_id: null });

describe('findOwnTransferPairs', () => {
    it('liga un pago claro de débito a tarjeta', () => {
        expect(findOwnTransferPairs([out('o1', 'deb', '2026-10-05', 5000), inn('i1', 'tdc', '2026-10-06', 5000)])).toEqual([['o1', 'i1']]);
    });
    it('no liga montos distintos', () => {
        expect(findOwnTransferPairs([out('o1', 'deb', '2026-10-05', 5000), inn('i1', 'tdc', '2026-10-05', 4999)])).toEqual([]);
    });
    it('no liga fuera de la ventana de 3 días', () => {
        expect(findOwnTransferPairs([out('o1', 'deb', '2026-10-01', 5000), inn('i1', 'tdc', '2026-10-05', 5000)])).toEqual([]);
    });
    it('no liga dentro de la misma cuenta', () => {
        expect(findOwnTransferPairs([out('o1', 'deb', '2026-10-05', 5000), inn('i1', 'deb', '2026-10-05', 5000)])).toEqual([]);
    });
    it('no liga sin pista de pago/transferencia en ningún concepto', () => {
        expect(findOwnTransferPairs([out('o1', 'deb', '2026-10-05', 300, 'OXXO'), inn('i1', 'nu', '2026-10-05', 300, 'DEPOSITO EFECTIVO', 'Ingreso')])).toEqual([]);
    });
    it('ambiguo (dos entradas candidatas) → no liga', () => {
        expect(findOwnTransferPairs([out('o1', 'deb', '2026-10-05', 1000), inn('i1', 'tdc', '2026-10-05', 1000), inn('i2', 'nu', '2026-10-05', 1000, 'SPEI RECIBIDO', 'Ingreso')])).toEqual([]);
    });
    it('ambiguo (dos salidas candidatas) → no liga', () => {
        expect(findOwnTransferPairs([out('o1', 'deb', '2026-10-05', 1000), out('o2', 'nu', '2026-10-05', 1000), inn('i1', 'tdc', '2026-10-05', 1000)])).toEqual([]);
    });
    it('ignora filas ya ligadas', () => {
        const o = { ...out('o1', 'deb', '2026-10-05', 5000), transfer_group_id: 'g' };
        expect(findOwnTransferPairs([o, inn('i1', 'tdc', '2026-10-05', 5000)])).toEqual([]);
    });
});
```

`__tests__/bancos/pending.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { stalePendingExternalIds } from '../../supabase/functions/_shared/bancos/pending.js';

describe('stalePendingExternalIds', () => {
    const existing = [
        { external_id: 'p1', bank_status: 'pending', date: '2026-10-10' },
        { external_id: 'p2', bank_status: 'pending', date: '2026-10-11' },
        { external_id: 'x1', bank_status: 'processed', date: '2026-10-10' },
        { external_id: 'old', bank_status: 'pending', date: '2026-09-01' },
    ];
    it('marca pendientes del rango que el proveedor ya no devuelve', () => {
        expect(stalePendingExternalIds(existing, ['p2', 'x1'], { from: '2026-10-01', to: '2026-10-12' })).toEqual(['p1']);
    });
    it('no toca procesados ni pendientes fuera del rango', () => {
        expect(stalePendingExternalIds(existing, [], { from: '2026-10-01', to: '2026-10-12' })).toEqual(['p1', 'p2']);
    });
});
```

Run: `npx vitest run __tests__/bancos/transfers.test.js __tests__/bancos/pending.test.js` → FAIL.

- [ ] **Step 2: Implementar**

`supabase/functions/_shared/bancos/transfers.js`:

```js
// Pair an outflow in one of the user's accounts with an inflow of the same
// amount in another of their accounts (e.g. paying the credit card from debit).
// Prefer missing a pair over linking the wrong one: any ambiguity → no link.
import { TRANSFER_WINDOW_DAYS } from './constants.js';

const HINT = /\b(pago|spei|traspaso|transf|tdc)/i;
const DAY_MS = 86400000;

const sameAmount = (a, b) => Math.abs(Number(a) - Number(b)) < 0.005;
const withinWindow = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) / DAY_MS <= TRANSFER_WINDOW_DAYS;

function matches(o, i) {
    return o.bank_account_id && i.bank_account_id && o.bank_account_id !== i.bank_account_id
        && sameAmount(o.amount, i.amount)
        && withinWindow(o.date, i.date)
        && (HINT.test(o.concept || '') || HINT.test(i.concept || ''));
}

export function findOwnTransferPairs(rows) {
    const free = rows.filter((r) => !r.transfer_group_id);
    const outs = free.filter((r) => r.type === 'Egreso');
    const ins = free.filter((r) => r.type === 'Ingreso' || r.type === 'Transferencia');
    const pairs = [];
    const used = new Set();
    for (const o of outs) {
        const candidates = ins.filter((i) => !used.has(i.key) && matches(o, i));
        if (candidates.length !== 1) continue;
        const [i] = candidates;
        const rivals = outs.filter((o2) => o2 !== o && matches(o2, i));
        if (rivals.length) continue;
        used.add(i.key);
        pairs.push([o.key, i.key]);
    }
    return pairs;
}
```

`supabase/functions/_shared/bancos/pending.js`:

```js
// Providers may re-issue a pending movement under a new id once it settles.
// Within the synced range, a pending row the provider no longer returns is stale.
export function stalePendingExternalIds(existing, fetchedIds, { from, to }) {
    const fetched = new Set(fetchedIds);
    return existing
        .filter((r) => r.bank_status === 'pending' && r.date >= from && r.date <= to && !fetched.has(r.external_id))
        .map((r) => r.external_id);
}
```

- [ ] **Step 3: Verificar y commit**

Run: `npx vitest run __tests__/bancos` → PASS.

```bash
git add supabase/functions/_shared/bancos/transfers.js supabase/functions/_shared/bancos/pending.js __tests__/bancos/transfers.test.js __tests__/bancos/pending.test.js
git commit -m "feat(bancos): detección de transferencias propias y pendientes obsoletos"
```

---

### Task 5: Categorización e IA

**Files:**
- Create: `supabase/functions/_shared/bancos/categorize.js`, `.../ai.js`
- Test: `__tests__/bancos/categorize.test.js`, `__tests__/bancos/ai.test.js`

**Interfaces:**
- Consume: `construirMemoriaCategorias`, `claveComercio`, `inferirCategoria`, `CATEGORIAS_ALL` de `../categorias.js`.
- Produce: `buildMemory(rows) → Map`; `categorizeRows(rows, { memoria, classify }) → Promise<rows>` (copias con `categoria`/`categoria_origen`; las que quedan en "Otros" llevan `categoria_origen: null` para reintentar); `createAnthropicClassifier({ apiKey, fetchImpl?, model? }) → classify | null` donde `classify(items) → Promise<string[]>` (`items`: `{ concept, merchant, amount, type }`); `parseCategories(text, n) → string[]`.

- [ ] **Step 1: Tests (fallan)**

`__tests__/bancos/categorize.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { buildMemory, categorizeRows } from '../../supabase/functions/_shared/bancos/categorize.js';

const row = (concept, type = 'Egreso', merchant = null) => ({ concept, merchant, type, amount: 100, categoria: null, categoria_origen: null });

describe('categorizeRows', () => {
    it('la memoria del usuario gana a las reglas', async () => {
        const memoria = buildMemory([{ concept: 'UBER *TRIP', categoria: 'Viaje / Hospedaje' }]);
        const [r] = await categorizeRows([row('UBER *TRIP 123')], { memoria });
        expect(r).toMatchObject({ categoria: 'Viaje / Hospedaje', categoria_origen: 'memoria' });
    });
    it('las reglas resuelven lo conocido sin llamar a la IA', async () => {
        const classify = vi.fn();
        const [r] = await categorizeRows([row('NETFLIX.COM')], { memoria: new Map(), classify });
        expect(r.categoria_origen).toBe('regla');
        expect(classify).not.toHaveBeenCalled();
    });
    it('lo que queda en Otros va a la IA en un solo lote', async () => {
        const classify = vi.fn().mockResolvedValue(['Entretenimiento', 'Otros']);
        const out = await categorizeRows([row('ZZQX 1'), row('ZZQX 2')], { memoria: new Map(), classify });
        expect(classify).toHaveBeenCalledTimes(1);
        expect(out[0]).toMatchObject({ categoria: 'Entretenimiento', categoria_origen: 'ia' });
        expect(out[1]).toMatchObject({ categoria: 'Otros', categoria_origen: null });
    });
    it('categoría inventada por la IA → Otros', async () => {
        const [r] = await categorizeRows([row('ZZQX')], { memoria: new Map(), classify: async () => ['Criptogatos'] });
        expect(r).toMatchObject({ categoria: 'Otros', categoria_origen: null });
    });
    it('si la IA falla quedan en Otros para reintentar', async () => {
        const [r] = await categorizeRows([row('ZZQX')], { memoria: new Map(), classify: async () => { throw new Error('down'); } });
        expect(r).toMatchObject({ categoria: 'Otros', categoria_origen: null });
    });
    it('sin clasificador no falla', async () => {
        const [r] = await categorizeRows([row('ZZQX')], { memoria: new Map(), classify: null });
        expect(r.categoria).toBe('Otros');
    });
    it('no modifica las filas de entrada', async () => {
        const input = [row('NETFLIX.COM')];
        await categorizeRows(input, { memoria: new Map() });
        expect(input[0].categoria).toBe(null);
    });
});
```

`__tests__/bancos/ai.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { createAnthropicClassifier, parseCategories, AI_MODEL } from '../../supabase/functions/_shared/bancos/ai.js';

const okResponse = (text) => ({ ok: true, json: async () => ({ content: [{ type: 'text', text }] }) });

describe('parseCategories', () => {
    it('lee el arreglo JSON aunque venga con texto alrededor', () => {
        expect(parseCategories('Aquí: ["Transporte","Salud"] listo', 2)).toEqual(['Transporte', 'Salud']);
    });
    it('valida contra la lista y rellena a n', () => {
        expect(parseCategories('["Transporte","Inventada"]', 3)).toEqual(['Transporte', 'Otros', 'Otros']);
    });
    it('basura → todo Otros', () => {
        expect(parseCategories('no sé', 2)).toEqual(['Otros', 'Otros']);
    });
});

describe('createAnthropicClassifier', () => {
    it('sin api key → null', () => {
        expect(createAnthropicClassifier({ apiKey: '' })).toBe(null);
    });
    it('llama a la API con el modelo y parte en lotes de 50', async () => {
        const fetchImpl = vi.fn(async (_url, init) => {
            const n = JSON.parse(init.body).messages[0].content.match(/^\d+\./gm).length;
            return okResponse(JSON.stringify(Array(n).fill('Transporte')));
        });
        const classify = createAnthropicClassifier({ apiKey: 'k', fetchImpl });
        const items = Array.from({ length: 51 }, (_, i) => ({ concept: `X${i}`, merchant: null, amount: 1, type: 'Egreso' }));
        const out = await classify(items);
        expect(out).toHaveLength(51);
        expect(fetchImpl).toHaveBeenCalledTimes(2);
        const [url, init] = fetchImpl.mock.calls[0];
        expect(url).toBe('https://api.anthropic.com/v1/messages');
        expect(init.headers['x-api-key']).toBe('k');
        expect(JSON.parse(init.body).model).toBe(AI_MODEL);
        expect(AI_MODEL).toBe('claude-haiku-5-5');
    });
    it('error HTTP → lanza (el pipeline lo atrapa)', async () => {
        const classify = createAnthropicClassifier({ apiKey: 'k', fetchImpl: async () => ({ ok: false, status: 529 }) });
        await expect(classify([{ concept: 'X', amount: 1, type: 'Egreso' }])).rejects.toThrow('529');
    });
});
```

Run: `npx vitest run __tests__/bancos/categorize.test.js __tests__/bancos/ai.test.js` → FAIL.

- [ ] **Step 2: Implementar**

`supabase/functions/_shared/bancos/categorize.js`:

```js
// Category for each new bank movement: user's memory → keyword rules → AI batch.
// Rows still in "Otros" keep categoria_origen = null so the next sync retries them.
import { construirMemoriaCategorias, claveComercio, inferirCategoria, CATEGORIAS_ALL } from '../categorias.js';

export function buildMemory(userCategorizedRows) {
    return construirMemoriaCategorias(userCategorizedRows);
}

export async function categorizeRows(rows, { memoria, classify }) {
    const out = rows.map((r) => ({ ...r }));
    const unresolved = [];
    for (const r of out) {
        const fromMemory = memoria?.size ? memoria.get(claveComercio(r.concept)) : null;
        if (fromMemory) {
            r.categoria = fromMemory;
            r.categoria_origen = 'memoria';
            continue;
        }
        const fromRules = inferirCategoria(r.concept, r.type);
        if (fromRules && fromRules !== 'Otros') {
            r.categoria = fromRules;
            r.categoria_origen = 'regla';
            continue;
        }
        r.categoria = 'Otros';
        r.categoria_origen = null;
        unresolved.push(r);
    }
    if (unresolved.length && classify) {
        try {
            const cats = await classify(unresolved.map(({ concept, merchant, amount, type }) => ({ concept, merchant, amount, type })));
            unresolved.forEach((r, i) => {
                const c = cats?.[i];
                if (c && c !== 'Otros' && CATEGORIAS_ALL.includes(c)) {
                    r.categoria = c;
                    r.categoria_origen = 'ia';
                }
            });
        } catch {
            // AI unavailable: rows stay in "Otros" and are retried next sync.
        }
    }
    return out;
}
```

`supabase/functions/_shared/bancos/ai.js`:

```js
// Batch category suggestions from Claude for movements the rules couldn't place.
// Output is validated against our category list; anything else becomes "Otros".
import { CATEGORIAS_ALL } from '../categorias.js';

export const AI_MODEL = 'claude-haiku-5-5';
export const AI_BATCH_SIZE = 50;

export function buildPrompt(items) {
    const lines = items.map((it, i) => `${i + 1}. ${it.type} · $${it.amount} · ${it.merchant ? `${it.merchant} · ` : ''}${it.concept}`);
    return [
        'Eres un clasificador de movimientos bancarios de México.',
        'Para cada movimiento elige exactamente una categoría de esta lista:',
        CATEGORIAS_ALL.join(' | '),
        'Si no estás seguro, usa "Otros".',
        `Responde SOLO un arreglo JSON de ${items.length} strings, en el mismo orden.`,
        '',
        ...lines,
    ].join('\n');
}

export function parseCategories(text, n) {
    try {
        const start = text.indexOf('[');
        const end = text.lastIndexOf(']');
        const arr = JSON.parse(text.slice(start, end + 1));
        return Array.from({ length: n }, (_, i) => (CATEGORIAS_ALL.includes(arr[i]) ? arr[i] : 'Otros'));
    } catch {
        return Array(n).fill('Otros');
    }
}

export function createAnthropicClassifier({ apiKey, fetchImpl = fetch, model = AI_MODEL } = {}) {
    if (!apiKey) return null;

    async function classifyBatch(batch) {
        const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
            body: JSON.stringify({ model, max_tokens: 1024, messages: [{ role: 'user', content: buildPrompt(batch) }] }),
        });
        if (!res.ok) throw new Error(`anthropic ${res.status}`);
        const json = await res.json();
        const text = (json?.content || []).find((c) => c.type === 'text')?.text ?? '';
        return parseCategories(text, batch.length);
    }

    return async function classify(items) {
        const out = [];
        for (let i = 0; i < items.length; i += AI_BATCH_SIZE) {
            out.push(...await classifyBatch(items.slice(i, i + AI_BATCH_SIZE)));
        }
        return out;
    };
}
```

- [ ] **Step 3: Verificar y commit**

Run: `npx vitest run __tests__/bancos` → PASS.

```bash
git add supabase/functions/_shared/bancos/categorize.js supabase/functions/_shared/bancos/ai.js __tests__/bancos/categorize.test.js __tests__/bancos/ai.test.js
git commit -m "feat(bancos): categorización con memoria, reglas e IA por lotes"
```

---

### Task 6: Proveedor (selección + simulado)

**Files:**
- Create: `supabase/functions/_shared/bancos/provider/index.js`, `.../provider/mock.js`
- Test: `__tests__/bancos/provider.test.js`

**Interfaces (adaptador — spec, sección *Adaptador de proveedor*):**
- `createConnectToken({ userId, providerLinkId? }) → Promise<{ token }>`
- `getLink(providerLinkId) → Promise<{ id, externalUserId, institutionCode, institutionName, recurrent } | null>`
- `listAccounts(providerLinkId) → Promise<ProviderAccount[]>`
- `listTransactions(providerLinkId, { from, to }) → Promise<ProviderTransaction[]>`
- `deleteLink(providerLinkId) → Promise<void>` (no lanza si ya no existe)
- `parseWebhook(request, secret) → Promise<{ authorized: false } | { authorized: true, event: { kind, providerLinkId, message? } | null }>`; `kind ∈ 'accounts_ready'|'transactions_ready'|'new_transactions'|'link_invalid'|'link_token_required'|'ignored'`
- `getProvider(env) → provider | null` (`env.BANK_PROVIDER === 'mock'` → simulado; cualquier otro valor o vacío → `null`).
- Simulado, extra para pruebas/desarrollo: `createMockProvider({ now? })`, con `provider.simulateConnect({ userId, institutionName? }) → providerLinkId`.

- [ ] **Step 1: Test (falla)**

`__tests__/bancos/provider.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { getProvider } from '../../supabase/functions/_shared/bancos/provider/index.js';
import { createMockProvider } from '../../supabase/functions/_shared/bancos/provider/mock.js';

const req = (headers, body) => new Request('https://x/bank-webhook', { method: 'POST', headers, body: JSON.stringify(body) });

describe('getProvider', () => {
    it('sin configurar → null; mock → simulado', () => {
        expect(getProvider({})).toBe(null);
        expect(getProvider({ BANK_PROVIDER: 'syncfy' })).toBe(null);
        expect(typeof getProvider({ BANK_PROVIDER: 'mock' }).getLink).toBe('function');
    });
});

describe('proveedor simulado', () => {
    const now = new Date('2026-10-13T12:00:00Z');

    it('conectar crea un link recurrente del usuario', async () => {
        const p = createMockProvider({ now });
        const id = p.simulateConnect({ userId: 'u1', institutionName: 'BBVA' });
        expect(await p.getLink(id)).toEqual({ id, externalUserId: 'u1', institutionCode: 'mock_bank', institutionName: 'BBVA', recurrent: true });
        expect(await p.getLink('nope')).toBe(null);
        expect((await p.createConnectToken({ userId: 'u1' })).token).toMatch(/^mock-/);
    });

    it('cuentas y movimientos con el formato normalizado, filtrados por fecha', async () => {
        const p = createMockProvider({ now });
        const id = p.simulateConnect({ userId: 'u1' });
        const accounts = await p.listAccounts(id);
        expect(accounts.map((a) => a.kind).sort()).toEqual(['credit', 'debit']);
        const all = await p.listTransactions(id, { from: '2025-10-13', to: '2026-10-13' });
        expect(all.length).toBeGreaterThan(5);
        for (const t of all) {
            expect(t.amount).toBeGreaterThan(0);
            expect(['in', 'out']).toContain(t.direction);
            expect(accounts.map((a) => a.id)).toContain(t.accountId);
        }
        expect(all.some((t) => t.status === 'pending')).toBe(true);
        const recent = await p.listTransactions(id, { from: '2026-10-12', to: '2026-10-13' });
        expect(recent.length).toBeLessThan(all.length);
    });

    it('borrar link no falla aunque no exista', async () => {
        const p = createMockProvider({ now });
        const id = p.simulateConnect({ userId: 'u1' });
        await p.deleteLink(id);
        await p.deleteLink(id);
        expect(await p.getLink(id)).toBe(null);
    });

    it('webhook: secreto requerido y evento normalizado', async () => {
        const p = createMockProvider({ now });
        expect(await p.parseWebhook(req({ 'x-webhook-secret': 'bad' }, {}), 's3cret')).toEqual({ authorized: false });
        expect(await p.parseWebhook(req({ 'x-webhook-secret': 's3cret' }, { kind: 'new_transactions', providerLinkId: 'L1' }), 's3cret'))
            .toEqual({ authorized: true, event: { kind: 'new_transactions', providerLinkId: 'L1', message: null } });
        expect((await p.parseWebhook(req({ 'x-webhook-secret': 's3cret' }, { kind: 'raro' }), 's3cret')).event.kind).toBe('ignored');
    });
});
```

Run → FAIL.

- [ ] **Step 2: Implementar**

`supabase/functions/_shared/bancos/provider/index.js`:

```js
// Picks the bank data provider from BANK_PROVIDER. Unknown or unset → null, and
// the handlers answer 503 provider_unavailable. Real adapters (e.g. syncfy.js)
// are added here when integrated.
import { createMockProvider } from './mock.js';

export function getProvider(env) {
    switch (env?.BANK_PROVIDER) {
        case 'mock': return createMockProvider();
        default: return null;
    }
}
```

`supabase/functions/_shared/bancos/provider/mock.js`:

```js
// In-memory provider with realistic Mexican data. Used by tests and to exercise
// the whole backend before a real provider is integrated. Never set it in production.

const KINDS = new Set(['accounts_ready', 'transactions_ready', 'new_transactions', 'link_invalid', 'link_token_required']);

function isoDaysAgo(now, n) {
    return new Date(now.getTime() - n * 86400000).toISOString().slice(0, 10);
}

export function createMockProvider({ now = new Date() } = {}) {
    const links = new Map();
    let seq = 0;

    function txFor(linkId) {
        const d = (n) => isoDaysAgo(now, n);
        const deb = `${linkId}-deb`;
        const tdc = `${linkId}-tdc`;
        const t = (id, accountId, date, description, merchant, amount, direction, status = 'processed') =>
            ({ id: `${linkId}-${id}`, accountId, date, description, merchant, amount, direction, status, currency: 'MXN' });
        return [
            t('t1', deb, d(1), 'OXXO REFORMA 22', 'OXXO', 89.5, 'out'),
            t('t2', deb, d(2), 'NOMINA EMPRESA SA DE CV', null, 24500, 'in'),
            t('t3', tdc, d(3), 'UBER *TRIP', 'Uber', 142.3, 'out'),
            t('t4', tdc, d(4), 'ZZQX COMERCIO RARO', null, 560, 'out'),
            t('t5', tdc, d(0), 'NETFLIX.COM', 'Netflix', 299, 'out', 'pending'),
            t('t6', deb, d(5), 'PAGO TDC 9034 SPEI', null, 5000, 'out'),
            t('t7', tdc, d(5), 'SU PAGO GRACIAS', null, 5000, 'in'),
            t('t8', deb, d(40), 'COMPRA WALMART EXPRESS', 'Walmart', 734.9, 'out'),
            t('t9', deb, d(200), 'CFE SUMINISTRADOR', 'CFE', 612, 'out'),
        ];
    }

    return {
        name: 'mock',

        simulateConnect({ userId, institutionName = 'Banco de prueba' }) {
            const id = `mock-link-${++seq}`;
            links.set(id, { id, externalUserId: userId, institutionCode: 'mock_bank', institutionName, recurrent: true });
            return id;
        },

        async createConnectToken({ userId, providerLinkId } = {}) {
            return { token: `mock-${userId}-${providerLinkId || 'new'}` };
        },

        async getLink(providerLinkId) {
            return links.get(providerLinkId) || null;
        },

        async listAccounts(providerLinkId) {
            if (!links.has(providerLinkId)) return [];
            return [
                { id: `${providerLinkId}-deb`, name: 'Cuenta de prueba', numberMasked: '•••• 4821', kind: 'debit', currency: 'MXN', balanceCurrent: 18420.55, balanceAvailable: 18420.55, credit: null },
                { id: `${providerLinkId}-tdc`, name: 'Tarjeta de prueba', numberMasked: '•••• 9034', kind: 'credit', currency: 'MXN', balanceCurrent: 7350, balanceAvailable: 22650,
                  credit: { limit: 30000, cutoffDate: isoDaysAgo(now, -12), paymentDueDate: isoDaysAgo(now, -32), minimumPayment: 650, noInterestPayment: 7350 } },
            ];
        },

        async listTransactions(providerLinkId, { from, to }) {
            if (!links.has(providerLinkId)) return [];
            return txFor(providerLinkId).filter((t) => t.date >= from && t.date <= to);
        },

        async deleteLink(providerLinkId) {
            links.delete(providerLinkId);
        },

        async parseWebhook(request, secret) {
            if (!secret || request.headers.get('x-webhook-secret') !== secret) return { authorized: false };
            let body = {};
            try { body = await request.json(); } catch { body = {}; }
            const kind = KINDS.has(body.kind) ? body.kind : 'ignored';
            return { authorized: true, event: { kind, providerLinkId: body.providerLinkId ?? null, message: body.message ?? null } };
        },
    };
}
```

- [ ] **Step 3: Verificar y commit**

Run: `npx vitest run __tests__/bancos` → PASS.

```bash
git add supabase/functions/_shared/bancos/provider __tests__/bancos/provider.test.js
git commit -m "feat(bancos): selección de proveedor y proveedor simulado"
```

---

### Task 7: Capa de datos (`db.js`) y doble en memoria

**Files:**
- Create: `supabase/functions/_shared/bancos/db.js`
- Create: `__tests__/helpers/fakeBankDb.js`
- Test: `__tests__/bancos/db.test.js`

**Interfaces — `createDb(supabaseClient)` devuelve** (el doble `createFakeBankDb()` implementa lo mismo en memoria):

| Método | Devuelve |
|---|---|
| `countActiveLinks(userId)` | `number` (status ≠ `disconnected`) |
| `getLinkById(id)` / `getLinkByProviderId(providerLinkId)` | fila o `null` |
| `insertLink(row)` | fila insertada (con `id`) |
| `updateLink(id, patch)` | `void` |
| `listUserLinks(userId, { includeDisconnected = false })` | filas |
| `upsertAccounts(rows)` | filas con `id` (conflicto en `provider_account_id`) |
| `setAccountsConnected(linkId, connected)` | `void` |
| `getTransactionsByExternalIds(userId, externalIds)` | `{ external_id, categoria, categoria_origen, transfer_group_id }[]` |
| `listUserCategorized(userId)` | `{ concept, categoria }[]` con `categoria_origen = 'usuario'` |
| `upsertTransactions(rows)` | `void` (conflicto en `user_id,external_id`) |
| `listBankTransactionsInRange(userId, accountIds, { from, to })` | `{ external_id, bank_status, date }[]` |
| `deleteTransactionsByExternalIds(userId, externalIds)` | `void` |
| `listRecentBankTransactions(userId, sinceDate)` | `{ external_id, bank_account_id, date, amount, type, concept, transfer_group_id }[]` (`source = 'banco'`) |
| `setTransferGroup(userId, externalIds, groupId)` | `void`; pone `transfer_group_id` y, salvo filas `usuario`, `categoria = TRANSFER_CATEGORY`, `categoria_origen = 'regla'` |

- [ ] **Step 1: Doble en memoria**

`__tests__/helpers/fakeBankDb.js`:

```js
// In-memory implementation of the db.js interface for handler/sync tests.
import { TRANSFER_CATEGORY } from '../../supabase/functions/_shared/bancos/constants.js';

export function createFakeBankDb() {
    const state = { links: [], accounts: [], transactions: [] };
    let seq = 0;
    const id = (p) => `${p}-${++seq}`;

    return {
        state,
        async countActiveLinks(userId) {
            return state.links.filter((l) => l.user_id === userId && l.status !== 'disconnected').length;
        },
        async getLinkById(linkId) { return state.links.find((l) => l.id === linkId) || null; },
        async getLinkByProviderId(pid) { return state.links.find((l) => l.provider_link_id === pid) || null; },
        async insertLink(row) { const r = { id: id('link'), ...row }; state.links.push(r); return r; },
        async updateLink(linkId, patch) { Object.assign(state.links.find((l) => l.id === linkId), patch); },
        async listUserLinks(userId, { includeDisconnected = false } = {}) {
            return state.links.filter((l) => l.user_id === userId && (includeDisconnected || l.status !== 'disconnected'));
        },
        async upsertAccounts(rows) {
            return rows.map((row) => {
                const existing = state.accounts.find((a) => a.provider_account_id === row.provider_account_id);
                if (existing) return Object.assign(existing, row);
                const r = { id: id('acc'), ...row };
                state.accounts.push(r);
                return r;
            });
        },
        async setAccountsConnected(linkId, connected) {
            state.accounts.filter((a) => a.link_id === linkId).forEach((a) => { a.connected = connected; });
        },
        async getTransactionsByExternalIds(userId, ids) {
            return state.transactions
                .filter((t) => t.user_id === userId && ids.includes(t.external_id))
                .map(({ external_id, categoria, categoria_origen, transfer_group_id }) => ({ external_id, categoria, categoria_origen, transfer_group_id }));
        },
        async listUserCategorized(userId) {
            return state.transactions.filter((t) => t.user_id === userId && t.categoria_origen === 'usuario').map(({ concept, categoria }) => ({ concept, categoria }));
        },
        async upsertTransactions(rows) {
            for (const row of rows) {
                const existing = state.transactions.find((t) => t.user_id === row.user_id && t.external_id === row.external_id);
                if (existing) Object.assign(existing, row);
                else state.transactions.push({ id: id('tx'), ...row });
            }
        },
        async listBankTransactionsInRange(userId, accountIds, { from, to }) {
            return state.transactions
                .filter((t) => t.user_id === userId && accountIds.includes(t.bank_account_id) && t.date >= from && t.date <= to)
                .map(({ external_id, bank_status, date }) => ({ external_id, bank_status, date }));
        },
        async deleteTransactionsByExternalIds(userId, ids) {
            state.transactions = state.transactions.filter((t) => !(t.user_id === userId && ids.includes(t.external_id)));
        },
        async listRecentBankTransactions(userId, since) {
            return state.transactions
                .filter((t) => t.user_id === userId && t.source === 'banco' && t.date >= since)
                .map(({ external_id, bank_account_id, date, amount, type, concept, transfer_group_id }) => ({ external_id, bank_account_id, date, amount, type, concept, transfer_group_id }));
        },
        async setTransferGroup(userId, ids, groupId) {
            for (const t of state.transactions) {
                if (t.user_id !== userId || !ids.includes(t.external_id)) continue;
                t.transfer_group_id = groupId;
                if (t.categoria_origen !== 'usuario') { t.categoria = TRANSFER_CATEGORY; t.categoria_origen = 'regla'; }
            }
        },
    };
}
```

- [ ] **Step 2: Test de `db.js` con un cliente que registra las llamadas (falla)**

`__tests__/bancos/db.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createDb } from '../../supabase/functions/_shared/bancos/db.js';

// Minimal supabase-js stand-in: records every builder call and resolves to `result`.
function recordingClient(result = { data: [], error: null, count: 0 }) {
    const calls = [];
    const client = {
        calls,
        from(table) {
            const chain = [['from', table]];
            calls.push(chain);
            const builder = new Proxy({}, {
                get(_t, prop) {
                    if (prop === 'then') return (res, rej) => Promise.resolve(result).then(res, rej);
                    return (...args) => { chain.push([prop, ...args]); return builder; };
                },
            });
            return builder;
        },
    };
    return client;
}

describe('createDb', () => {
    it('upsert de transacciones usa el conflicto (user_id, external_id) y parte en lotes de 500', async () => {
        const sb = recordingClient();
        await createDb(sb).upsertTransactions(Array.from({ length: 501 }, (_, i) => ({ external_id: `e${i}` })));
        const upserts = sb.calls.filter((c) => c[0][1] === 'transactions');
        expect(upserts).toHaveLength(2);
        expect(upserts[0].find((c) => c[0] === 'upsert')[2]).toEqual({ onConflict: 'user_id,external_id' });
    });
    it('upsert de cuentas usa provider_account_id', async () => {
        const sb = recordingClient({ data: [{ id: 'a' }], error: null });
        await createDb(sb).upsertAccounts([{ provider_account_id: 'p' }]);
        expect(sb.calls[0].find((c) => c[0] === 'upsert')[2]).toEqual({ onConflict: 'provider_account_id' });
    });
    it('cuenta links activos excluyendo desconectados', async () => {
        const sb = recordingClient({ data: null, error: null, count: 3 });
        expect(await createDb(sb).countActiveLinks('u1')).toBe(3);
        expect(sb.calls[0]).toContainEqual(['neq', 'status', 'disconnected']);
        expect(sb.calls[0]).toContainEqual(['eq', 'user_id', 'u1']);
    });
    it('errores de Supabase se lanzan', async () => {
        const sb = recordingClient({ data: null, error: { message: 'boom' } });
        await expect(createDb(sb).getLinkById('x')).rejects.toThrow('boom');
    });
    it('setTransferGroup no pisa categorías del usuario', async () => {
        const sb = recordingClient();
        await createDb(sb).setTransferGroup('u1', ['a', 'b'], 'g1');
        const second = sb.calls[1];
        expect(second).toContainEqual(['update', { categoria: 'Transferencia entre tus cuentas', categoria_origen: 'regla' }]);
        expect(second).toContainEqual(['or', 'categoria_origen.is.null,categoria_origen.neq.usuario']);
    });
});
```

Run → FAIL.

- [ ] **Step 3: Implementar `db.js`**

`supabase/functions/_shared/bancos/db.js`:

```js
// Data access for bank sync on top of a supabase-js client (service role in
// Edge Functions). The client is injected so this file has no imports of its own
// besides constants, and tests can pass a fake.
import { TRANSFER_CATEGORY } from './constants.js';

function chunks(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

function must({ data, error }) {
    if (error) throw new Error(error.message);
    return data;
}

export function createDb(sb) {
    return {
        async countActiveLinks(userId) {
            const { count, error } = await sb.from('bank_links').select('id', { count: 'exact', head: true })
                .eq('user_id', userId).neq('status', 'disconnected');
            if (error) throw new Error(error.message);
            return count || 0;
        },
        async getLinkById(id) {
            return must(await sb.from('bank_links').select('*').eq('id', id).maybeSingle());
        },
        async getLinkByProviderId(providerLinkId) {
            return must(await sb.from('bank_links').select('*').eq('provider_link_id', providerLinkId).maybeSingle());
        },
        async insertLink(row) {
            return must(await sb.from('bank_links').insert(row).select().single());
        },
        async updateLink(id, patch) {
            must(await sb.from('bank_links').update(patch).eq('id', id));
        },
        async listUserLinks(userId, { includeDisconnected = false } = {}) {
            let q = sb.from('bank_links').select('*').eq('user_id', userId);
            if (!includeDisconnected) q = q.neq('status', 'disconnected');
            return must(await q) || [];
        },
        async upsertAccounts(rows) {
            if (!rows.length) return [];
            const stamped = rows.map((r) => ({ ...r, updated_at: new Date().toISOString() }));
            return must(await sb.from('bank_accounts').upsert(stamped, { onConflict: 'provider_account_id' }).select()) || [];
        },
        async setAccountsConnected(linkId, connected) {
            must(await sb.from('bank_accounts').update({ connected }).eq('link_id', linkId));
        },
        async getTransactionsByExternalIds(userId, externalIds) {
            const out = [];
            for (const part of chunks(externalIds, 200)) {
                out.push(...(must(await sb.from('transactions')
                    .select('external_id, categoria, categoria_origen, transfer_group_id')
                    .eq('user_id', userId).in('external_id', part)) || []));
            }
            return out;
        },
        async listUserCategorized(userId) {
            return must(await sb.from('transactions').select('concept, categoria')
                .eq('user_id', userId).eq('categoria_origen', 'usuario').limit(5000)) || [];
        },
        async upsertTransactions(rows) {
            for (const part of chunks(rows, 500)) {
                must(await sb.from('transactions').upsert(part, { onConflict: 'user_id,external_id' }));
            }
        },
        async listBankTransactionsInRange(userId, accountIds, { from, to }) {
            if (!accountIds.length) return [];
            return must(await sb.from('transactions').select('external_id, bank_status, date')
                .eq('user_id', userId).in('bank_account_id', accountIds).gte('date', from).lte('date', to)) || [];
        },
        async deleteTransactionsByExternalIds(userId, externalIds) {
            for (const part of chunks(externalIds, 200)) {
                must(await sb.from('transactions').delete().eq('user_id', userId).in('external_id', part));
            }
        },
        async listRecentBankTransactions(userId, since) {
            return must(await sb.from('transactions')
                .select('external_id, bank_account_id, date, amount, type, concept, transfer_group_id')
                .eq('user_id', userId).eq('source', 'banco').gte('date', since)) || [];
        },
        async setTransferGroup(userId, externalIds, groupId) {
            must(await sb.from('transactions').update({ transfer_group_id: groupId })
                .eq('user_id', userId).in('external_id', externalIds));
            must(await sb.from('transactions').update({ categoria: TRANSFER_CATEGORY, categoria_origen: 'regla' })
                .eq('user_id', userId).in('external_id', externalIds)
                .or('categoria_origen.is.null,categoria_origen.neq.usuario'));
        },
    };
}
```

- [ ] **Step 4: Verificar y commit**

Run: `npx vitest run __tests__/bancos` → PASS.

```bash
git add supabase/functions/_shared/bancos/db.js __tests__/helpers/fakeBankDb.js __tests__/bancos/db.test.js
git commit -m "feat(bancos): capa de datos sobre supabase-js y doble en memoria"
```

---

### Task 8: Sincronización (`sync.js`)

**Files:**
- Create: `supabase/functions/_shared/bancos/sync.js`
- Test: `__tests__/bancos/sync.test.js`

**Interfaces:**
- Consume: `mapAccount`, `mapTransaction` (T3); `findOwnTransferPairs` (T4); `stalePendingExternalIds` (T4); `buildMemory`, `categorizeRows` (T5); interfaz db (T7); interfaz de proveedor (T6).
- Produce: `syncWindow(link, now) → { from, to }`; `syncLink({ db, provider, classify, link, from, to, now, newId }) → { accounts, transactions, removedPending, transfersLinked }`.

- [ ] **Step 1: Test (falla)**

`__tests__/bancos/sync.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { syncLink, syncWindow } from '../../supabase/functions/_shared/bancos/sync.js';
import { createMockProvider } from '../../supabase/functions/_shared/bancos/provider/mock.js';
import { createFakeBankDb } from '../helpers/fakeBankDb.js';

const now = new Date('2026-10-13T12:00:00Z');

// Fake AI: answers per concept, so the result doesn't depend on how many rows the rules leave unresolved.
const fakeAi = async (items) => items.map((i) => (i.concept.includes('ZZQX') ? 'Ropa y Accesorios' : 'Entretenimiento'));

async function setup() {
    const db = createFakeBankDb();
    const provider = createMockProvider({ now });
    const pid = provider.simulateConnect({ userId: 'u1', institutionName: 'BBVA' });
    const link = await db.insertLink({ user_id: 'u1', provider_link_id: pid, institution_name: 'BBVA', status: 'syncing', last_synced_at: null });
    let n = 0;
    return { db, provider, link, newId: () => `g${++n}` };
}

describe('syncWindow', () => {
    it('primera vez: 365 días; después: desde la última menos 3 días', () => {
        expect(syncWindow({ last_synced_at: null }, now)).toEqual({ from: '2025-10-13', to: '2026-10-13' });
        expect(syncWindow({ last_synced_at: '2026-10-10T08:00:00Z' }, now)).toEqual({ from: '2026-10-07', to: '2026-10-13' });
    });
});

describe('syncLink', () => {
    it('primera sincronización: cuentas, movimientos categorizados, transferencia ligada y link al día', async () => {
        const { db, provider, link, newId } = await setup();
        const classify = vi.fn(fakeAi);
        const { from, to } = syncWindow(link, now);
        const res = await syncLink({ db, provider, classify, link, from, to, now, newId });

        expect(res).toMatchObject({ accounts: 2, transactions: 9, transfersLinked: 1 });
        expect(db.state.accounts.map((a) => a.account_type).sort()).toEqual(['credito', 'debito']);
        const tx = Object.fromEntries(db.state.transactions.map((t) => [t.external_id.split('-').pop(), t]));
        expect(tx.t5.bank_status).toBe('pending');
        expect(tx.t4).toMatchObject({ categoria: 'Ropa y Accesorios', categoria_origen: 'ia' });
        expect(tx.t6.transfer_group_id).toBe('g1');
        expect(tx.t7.transfer_group_id).toBe('g1');
        expect(tx.t7.categoria).toBe('Transferencia entre tus cuentas');
        expect(db.state.links[0]).toMatchObject({ status: 'valid', last_synced_at: now.toISOString(), last_error: null });
    });

    it('re-sincronizar no duplica, no re-llama a la IA para lo ya categorizado y respeta al usuario', async () => {
        const { db, provider, link, newId } = await setup();
        const classify = vi.fn(fakeAi);
        await syncLink({ db, provider, classify, link, ...syncWindow(link, now), now, newId });
        const uber = db.state.transactions.find((t) => t.external_id.endsWith('-t3'));
        uber.categoria = 'Viaje / Hospedaje';
        uber.categoria_origen = 'usuario';
        classify.mockClear();

        await syncLink({ db, provider, classify, link, from: '2025-10-13', to: '2026-10-13', now, newId });
        expect(db.state.transactions).toHaveLength(9);
        expect(classify).not.toHaveBeenCalled();
        expect(uber).toMatchObject({ categoria: 'Viaje / Hospedaje', categoria_origen: 'usuario' });
        expect(db.state.transactions.filter((t) => t.transfer_group_id)).toHaveLength(2);
    });

    it('la memoria del usuario se aplica a movimientos nuevos del mismo comercio', async () => {
        const { db, provider, link, newId } = await setup();
        await db.upsertTransactions([{ user_id: 'u1', external_id: 'manual-1', concept: 'OXXO REFORMA 22', categoria: 'Restaurantes', categoria_origen: 'usuario', source: 'manual', date: '2026-01-01' }]);
        await syncLink({ db, provider, classify: null, link, ...syncWindow(link, now), now, newId });
        const oxxo = db.state.transactions.find((t) => t.external_id.endsWith('-t1'));
        expect(oxxo).toMatchObject({ categoria: 'Restaurantes', categoria_origen: 'memoria' });
    });

    it('borra pendientes que el proveedor ya no devuelve dentro del rango', async () => {
        const { db, provider, link, newId } = await setup();
        await syncLink({ db, provider, classify: null, link, ...syncWindow(link, now), now, newId });
        const acc = db.state.accounts.find((a) => a.account_type === 'credito');
        await db.upsertTransactions([{ user_id: 'u1', external_id: 'old-pending', bank_account_id: acc.id, bank_status: 'pending', date: '2026-10-12', source: 'banco', concept: 'X', amount: 1, type: 'Egreso' }]);
        const res = await syncLink({ db, provider, classify: null, link, from: '2026-10-07', to: '2026-10-13', now, newId });
        expect(res.removedPending).toBe(1);
        expect(db.state.transactions.some((t) => t.external_id === 'old-pending')).toBe(false);
    });
});
```

Run → FAIL.

- [ ] **Step 2: Implementar**

`supabase/functions/_shared/bancos/sync.js`:

```js
// One sync of a link: accounts → movements → categories → stale pendings →
// own-transfer pairs → link marked up to date. Idempotent: re-running over the
// same range neither duplicates rows nor re-categorizes settled ones.
import { INITIAL_HISTORY_DAYS, OVERLAP_DAYS, TRANSFER_WINDOW_DAYS, LINK_STATUS } from './constants.js';
import { mapAccount, mapTransaction } from './mapping.js';
import { buildMemory, categorizeRows } from './categorize.js';
import { stalePendingExternalIds } from './pending.js';
import { findOwnTransferPairs } from './transfers.js';

const DAY_MS = 86400000;
const isoDate = (d) => d.toISOString().slice(0, 10);
const addDays = (isoDay, n) => isoDate(new Date(Date.parse(isoDay) + n * DAY_MS));

export function syncWindow(link, now) {
    const to = isoDate(now);
    if (!link.last_synced_at) return { from: addDays(to, -INITIAL_HISTORY_DAYS), to };
    return { from: addDays(isoDate(new Date(link.last_synced_at)), -OVERLAP_DAYS), to };
}

export async function syncLink({ db, provider, classify, link, from, to, now = new Date(), newId = () => crypto.randomUUID() }) {
    const userId = link.user_id;

    const providerAccounts = await provider.listAccounts(link.provider_link_id);
    const accounts = await db.upsertAccounts(providerAccounts.map((pa) => mapAccount(pa, { userId, linkId: link.id })));
    const accountByProviderId = new Map(accounts.map((a) => [a.provider_account_id, a]));

    const providerTx = await provider.listTransactions(link.provider_link_id, { from, to });
    const mapped = providerTx
        .map((pt) => {
            const account = accountByProviderId.get(pt.accountId);
            return account ? mapTransaction(pt, { userId, account, bankName: link.institution_name }) : null;
        })
        .filter((r) => r && r.amount > 0 && r.date);

    const existing = new Map((await db.getTransactionsByExternalIds(userId, mapped.map((r) => r.external_id)))
        .map((e) => [e.external_id, e]));
    const settled = [];
    const fresh = [];
    for (const r of mapped) {
        const e = existing.get(r.external_id);
        if (e?.categoria_origen) {
            settled.push({ ...r, categoria: e.categoria, categoria_origen: e.categoria_origen, transfer_group_id: e.transfer_group_id });
        } else {
            fresh.push({ ...r, transfer_group_id: e?.transfer_group_id ?? null });
        }
    }
    const memoria = buildMemory(await db.listUserCategorized(userId));
    const categorized = await categorizeRows(fresh, { memoria, classify });
    const rows = [...settled, ...categorized];
    if (rows.length) await db.upsertTransactions(rows);

    const inRange = await db.listBankTransactionsInRange(userId, accounts.map((a) => a.id), { from, to });
    const stale = stalePendingExternalIds(inRange, mapped.map((r) => r.external_id), { from, to });
    if (stale.length) await db.deleteTransactionsByExternalIds(userId, stale);

    const recent = await db.listRecentBankTransactions(userId, addDays(from, -TRANSFER_WINDOW_DAYS));
    const pairs = findOwnTransferPairs(recent.map((t) => ({ ...t, key: t.external_id })));
    for (const pair of pairs) await db.setTransferGroup(userId, pair, newId());

    await db.updateLink(link.id, {
        status: LINK_STATUS.VALID,
        last_synced_at: now.toISOString(),
        last_error: null,
        updated_at: now.toISOString(),
    });

    return { accounts: accounts.length, transactions: rows.length, removedPending: stale.length, transfersLinked: pairs.length };
}
```

- [ ] **Step 3: Verificar y commit**

Run: `npx vitest run __tests__/bancos` → PASS.

```bash
git add supabase/functions/_shared/bancos/sync.js __tests__/bancos/sync.test.js
git commit -m "feat(bancos): sincronización idempotente de un link"
```

---

### Task 9: Handlers de las funciones

**Files:**
- Create: `supabase/functions/_shared/bancos/handlers.js`
- Test: `__tests__/bancos/handlers.test.js`

**Interfaces:**
- Consume: `syncLink`, `syncWindow` (T8); constantes (T3); interfaz db (T7) y proveedor (T6).
- `deps = { db, provider, classify, now: () => Date, runInBackground: (Promise) => void, userHasAccess: (user) => boolean, webhookSecret }`
- Produce: `handleConnectToken({ user, body }, deps)`, `handleRegisterLink`, `handleSync`, `handleDisconnect`, `handleWebhook({ request }, deps)` → `{ status, body }`; `runSync(link, deps) → Promise<void>` (nunca lanza); `deleteAllUserLinks({ userId }, deps) → number` (lanza si hay links y no hay proveedor).
- Errores (`body.error`): `no_session` 401, `no_subscription` 402, `provider_unavailable` 503, `not_found` 404, `max_links` 409, `conflict` 409, `forbidden` 403, `invalid_link` 400, `not_recurrent` 400, `rate_limited` 429 (+ `retry_after`), `unauthorized` 401 (webhook).

- [ ] **Step 1: Test (falla)**

`__tests__/bancos/handlers.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import {
    handleConnectToken, handleRegisterLink, handleSync, handleDisconnect, handleWebhook, deleteAllUserLinks,
} from '../../supabase/functions/_shared/bancos/handlers.js';
import { createMockProvider } from '../../supabase/functions/_shared/bancos/provider/mock.js';
import { createFakeBankDb } from '../helpers/fakeBankDb.js';

const user = { id: 'u1' };
const other = { id: 'u2' };

function makeDeps(over = {}) {
    let clock = new Date('2026-10-13T12:00:00Z');
    const background = [];
    const deps = {
        db: createFakeBankDb(),
        provider: createMockProvider({ now: clock }),
        classify: null,
        now: () => clock,
        runInBackground: (p) => background.push(p),
        userHasAccess: (u) => u?.id !== 'no-access',
        webhookSecret: 's3cret',
        ...over,
    };
    return { deps, background, advance: (sec) => { clock = new Date(clock.getTime() + sec * 1000); } };
}

const flush = (bg) => Promise.all(bg);
const hook = (body, secret = 's3cret') => new Request('https://x', { method: 'POST', headers: { 'x-webhook-secret': secret }, body: JSON.stringify(body) });

describe('guardas comunes', () => {
    it('sin sesión 401, sin acceso 402, sin proveedor 503', async () => {
        const { deps } = makeDeps();
        expect((await handleConnectToken({ user: null, body: {} }, deps)).status).toBe(401);
        expect((await handleConnectToken({ user: { id: 'no-access' }, body: {} }, deps)).status).toBe(402);
        const none = makeDeps({ provider: null }).deps;
        expect(await handleConnectToken({ user, body: {} }, none)).toEqual({ status: 503, body: { error: 'provider_unavailable' } });
    });
});

describe('conectar y registrar', () => {
    it('token, registro, sincronización en segundo plano', async () => {
        const { deps, background } = makeDeps();
        expect((await handleConnectToken({ user, body: {} }, deps)).body.token).toMatch(/^mock-/);
        const pid = deps.provider.simulateConnect({ userId: 'u1', institutionName: 'BBVA' });
        const res = await handleRegisterLink({ user, body: { provider_link_id: pid } }, deps);
        expect(res.status).toBe(200);
        expect(res.body.link).toMatchObject({ institution_name: 'BBVA', status: 'syncing' });
        await flush(background);
        expect(deps.db.state.links[0].status).toBe('valid');
        expect(deps.db.state.transactions.length).toBeGreaterThan(0);
    });

    it('link de otro usuario → 403; ya registrado → 409; inexistente → 400', async () => {
        const { deps, background } = makeDeps();
        const pid = deps.provider.simulateConnect({ userId: 'u1' });
        expect((await handleRegisterLink({ user: other, body: { provider_link_id: pid } }, deps)).status).toBe(403);
        await handleRegisterLink({ user, body: { provider_link_id: pid } }, deps);
        await flush(background);
        expect((await handleRegisterLink({ user, body: { provider_link_id: pid } }, deps)).body.error).toBe('conflict');
        expect((await handleRegisterLink({ user, body: { provider_link_id: 'nope' } }, deps)).body.error).toBe('invalid_link');
        expect((await handleRegisterLink({ user, body: {} }, deps)).body.error).toBe('invalid_link');
    });

    it('límite de 5 bancos; reconectar uno existente sí se permite', async () => {
        const { deps } = makeDeps();
        for (let i = 0; i < 5; i++) {
            const pid = deps.provider.simulateConnect({ userId: 'u1' });
            await handleRegisterLink({ user, body: { provider_link_id: pid } }, deps);
        }
        expect((await handleConnectToken({ user, body: {} }, deps)).body.error).toBe('max_links');
        const linkId = deps.db.state.links[0].id;
        expect((await handleConnectToken({ user, body: { link_id: linkId } }, deps)).status).toBe(200);
        expect((await handleConnectToken({ user: other, body: { link_id: linkId } }, deps)).status).toBe(404);
    });

    it('re-registrar un link con token_required lo vuelve a sincronizar', async () => {
        const { deps, background } = makeDeps();
        const pid = deps.provider.simulateConnect({ userId: 'u1' });
        await handleRegisterLink({ user, body: { provider_link_id: pid } }, deps);
        await flush(background);
        deps.db.state.links[0].status = 'token_required';
        const res = await handleRegisterLink({ user, body: { provider_link_id: pid } }, deps);
        expect(res.status).toBe(200);
        await flush(background);
        expect(deps.db.state.links[0].status).toBe('valid');
    });
});

describe('sincronizar manualmente', () => {
    it('202 y luego 429 con retry_after durante 10 minutos', async () => {
        const { deps, advance } = makeDeps();
        const pid = deps.provider.simulateConnect({ userId: 'u1' });
        const { body } = await handleRegisterLink({ user, body: { provider_link_id: pid } }, deps);
        expect((await handleSync({ user, body: { link_id: body.link.id } }, deps)).status).toBe(202);
        const limited = await handleSync({ user, body: { link_id: body.link.id } }, deps);
        expect(limited.status).toBe(429);
        expect(limited.body.retry_after).toBe(600);
        advance(601);
        expect((await handleSync({ user, body: { link_id: body.link.id } }, deps)).status).toBe(202);
        expect((await handleSync({ user: other, body: { link_id: body.link.id } }, deps)).status).toBe(404);
    });
});

describe('desconectar', () => {
    it('borra en el proveedor, marca link y cuentas; los movimientos se quedan', async () => {
        const { deps, background } = makeDeps();
        const pid = deps.provider.simulateConnect({ userId: 'u1' });
        const { body } = await handleRegisterLink({ user, body: { provider_link_id: pid } }, deps);
        await flush(background);
        const before = deps.db.state.transactions.length;
        expect((await handleDisconnect({ user, body: { link_id: body.link.id } }, deps)).body).toEqual({ ok: true });
        expect(await deps.provider.getLink(pid)).toBe(null);
        expect(deps.db.state.links[0].status).toBe('disconnected');
        expect(deps.db.state.accounts.every((a) => a.connected === false)).toBe(true);
        expect(deps.db.state.transactions).toHaveLength(before);
    });
});

describe('webhook', () => {
    it('secreto incorrecto → 401', async () => {
        const { deps } = makeDeps();
        expect((await handleWebhook({ request: hook({}, 'bad') }, deps)).status).toBe(401);
    });
    it('link desconocido → 200 ignorado', async () => {
        const { deps, background } = makeDeps();
        const res = await handleWebhook({ request: hook({ kind: 'new_transactions', providerLinkId: 'nope' }) }, deps);
        expect(res).toEqual({ status: 200, body: { received: true, ignored: true } });
        expect(background).toHaveLength(0);
    });
    it('movimientos nuevos → sincroniza; estados del link → actualiza', async () => {
        const { deps, background } = makeDeps();
        const pid = deps.provider.simulateConnect({ userId: 'u1' });
        await handleRegisterLink({ user, body: { provider_link_id: pid } }, deps);
        await flush(background);
        background.length = 0;
        await handleWebhook({ request: hook({ kind: 'new_transactions', providerLinkId: pid }) }, deps);
        expect(background).toHaveLength(1);
        await handleWebhook({ request: hook({ kind: 'link_token_required', providerLinkId: pid, message: 'token' }) }, deps);
        expect(deps.db.state.links[0]).toMatchObject({ status: 'token_required', last_error: 'token' });
        await handleWebhook({ request: hook({ kind: 'link_invalid', providerLinkId: pid }) }, deps);
        expect(deps.db.state.links[0].status).toBe('invalid');
    });
});

describe('errores de sincronización en segundo plano', () => {
    it('se guardan en last_error y no rompen', async () => {
        const provider = createMockProvider();
        const pid = provider.simulateConnect({ userId: 'u1' });
        provider.listAccounts = vi.fn().mockRejectedValue(new Error('banco caído'));
        const { deps, background } = makeDeps({ provider });
        await handleRegisterLink({ user, body: { provider_link_id: pid } }, deps);
        await flush(background);
        expect(deps.db.state.links[0]).toMatchObject({ status: 'syncing', last_error: 'banco caído' });
    });
});

describe('deleteAllUserLinks', () => {
    it('borra todos los links activos del usuario en el proveedor', async () => {
        const { deps } = makeDeps();
        const p1 = deps.provider.simulateConnect({ userId: 'u1' });
        const p2 = deps.provider.simulateConnect({ userId: 'u1' });
        await handleRegisterLink({ user, body: { provider_link_id: p1 } }, deps);
        await handleRegisterLink({ user, body: { provider_link_id: p2 } }, deps);
        expect(await deleteAllUserLinks({ userId: 'u1' }, deps)).toBe(2);
        expect(await deps.provider.getLink(p1)).toBe(null);
    });
    it('sin links no necesita proveedor; con links y sin proveedor lanza', async () => {
        const { deps } = makeDeps({ provider: null });
        expect(await deleteAllUserLinks({ userId: 'u1' }, deps)).toBe(0);
        await deps.db.insertLink({ user_id: 'u1', provider_link_id: 'x', status: 'valid' });
        await expect(deleteAllUserLinks({ userId: 'u1' }, deps)).rejects.toThrow('provider_unavailable');
    });
});
```

Run → FAIL.

- [ ] **Step 2: Implementar**

`supabase/functions/_shared/bancos/handlers.js`:

```js
// Request logic for the bank-* Edge Functions. Pure: everything external comes in
// `deps` ({ db, provider, classify, now, runInBackground, userHasAccess, webhookSecret }).
import { MAX_LINKS_PER_USER, SYNC_COOLDOWN_SECONDS, LINK_STATUS } from './constants.js';
import { syncLink, syncWindow } from './sync.js';

const ok = (body, status = 200) => ({ status, body });
const fail = (status, error, extra = {}) => ({ status, body: { error, ...extra } });

function guard(user, deps, { needsAccess = true } = {}) {
    if (!user) return fail(401, 'no_session');
    if (needsAccess && !deps.userHasAccess(user)) return fail(402, 'no_subscription');
    if (!deps.provider) return fail(503, 'provider_unavailable');
    return null;
}

async function ownLink(user, linkId, deps) {
    if (!linkId) return null;
    const link = await deps.db.getLinkById(linkId);
    if (!link || link.user_id !== user.id || link.status === LINK_STATUS.DISCONNECTED) return null;
    return link;
}

// Never throws: failures are stored on the link so the app can show them.
export async function runSync(link, deps) {
    try {
        const now = deps.now();
        const { from, to } = syncWindow(link, now);
        await syncLink({ db: deps.db, provider: deps.provider, classify: deps.classify, link, from, to, now });
    } catch (e) {
        try {
            await deps.db.updateLink(link.id, {
                last_error: String(e?.message || e).slice(0, 500),
                status: link.last_synced_at ? LINK_STATUS.VALID : LINK_STATUS.SYNCING,
                updated_at: deps.now().toISOString(),
            });
        } catch {
            // nothing else to do; the next webhook or manual sync retries
        }
    }
}

export async function handleConnectToken({ user, body }, deps) {
    const blocked = guard(user, deps);
    if (blocked) return blocked;
    let providerLinkId;
    if (body?.link_id) {
        const link = await ownLink(user, body.link_id, deps);
        if (!link) return fail(404, 'not_found');
        providerLinkId = link.provider_link_id;
    } else if (await deps.db.countActiveLinks(user.id) >= MAX_LINKS_PER_USER) {
        return fail(409, 'max_links');
    }
    const { token } = await deps.provider.createConnectToken({ userId: user.id, providerLinkId });
    return ok({ token });
}

export async function handleRegisterLink({ user, body }, deps) {
    const blocked = guard(user, deps);
    if (blocked) return blocked;
    const providerLinkId = body?.provider_link_id;
    if (typeof providerLinkId !== 'string' || !providerLinkId || providerLinkId.length > 200) return fail(400, 'invalid_link');

    const remote = await deps.provider.getLink(providerLinkId);
    if (!remote) return fail(400, 'invalid_link');
    if (remote.externalUserId !== user.id) return fail(403, 'forbidden');
    if (!remote.recurrent) return fail(400, 'not_recurrent');

    const nowIso = deps.now().toISOString();
    const existing = await deps.db.getLinkByProviderId(providerLinkId);
    let link;
    if (existing) {
        if (existing.user_id !== user.id) return fail(403, 'forbidden');
        if (existing.status === LINK_STATUS.VALID || existing.status === LINK_STATUS.SYNCING) return fail(409, 'conflict');
        if (existing.status === LINK_STATUS.DISCONNECTED && await deps.db.countActiveLinks(user.id) >= MAX_LINKS_PER_USER) {
            return fail(409, 'max_links');
        }
        await deps.db.updateLink(existing.id, { status: LINK_STATUS.SYNCING, last_error: null, updated_at: nowIso });
        link = { ...existing, status: LINK_STATUS.SYNCING };
    } else {
        if (await deps.db.countActiveLinks(user.id) >= MAX_LINKS_PER_USER) return fail(409, 'max_links');
        link = await deps.db.insertLink({
            user_id: user.id,
            provider_link_id: providerLinkId,
            institution_name: remote.institutionName,
            institution_code: remote.institutionCode,
            status: LINK_STATUS.SYNCING,
            created_at: nowIso,
            updated_at: nowIso,
        });
    }
    deps.runInBackground(runSync(link, deps));
    return ok({ link: { id: link.id, institution_name: link.institution_name, status: LINK_STATUS.SYNCING } });
}

export async function handleSync({ user, body }, deps) {
    const blocked = guard(user, deps);
    if (blocked) return blocked;
    const link = await ownLink(user, body?.link_id, deps);
    if (!link) return fail(404, 'not_found');

    const now = deps.now();
    const last = link.last_manual_sync_at ? Date.parse(link.last_manual_sync_at) : 0;
    const elapsed = (now.getTime() - last) / 1000;
    if (elapsed < SYNC_COOLDOWN_SECONDS) {
        return fail(429, 'rate_limited', { retry_after: Math.ceil(SYNC_COOLDOWN_SECONDS - elapsed) });
    }
    await deps.db.updateLink(link.id, { status: LINK_STATUS.SYNCING, last_manual_sync_at: now.toISOString(), updated_at: now.toISOString() });
    deps.runInBackground(runSync(link, deps));
    return ok({ status: LINK_STATUS.SYNCING }, 202);
}

export async function handleDisconnect({ user, body }, deps) {
    const blocked = guard(user, deps, { needsAccess: false });
    if (blocked) return blocked;
    const link = await ownLink(user, body?.link_id, deps);
    if (!link) return fail(404, 'not_found');
    await deps.provider.deleteLink(link.provider_link_id);
    await deps.db.updateLink(link.id, { status: LINK_STATUS.DISCONNECTED, updated_at: deps.now().toISOString() });
    await deps.db.setAccountsConnected(link.id, false);
    return ok({ ok: true });
}

export async function handleWebhook({ request }, deps) {
    if (!deps.provider) return fail(503, 'provider_unavailable');
    const parsed = await deps.provider.parseWebhook(request, deps.webhookSecret);
    if (!parsed.authorized) return fail(401, 'unauthorized');
    const event = parsed.event;
    if (!event || event.kind === 'ignored' || !event.providerLinkId) return ok({ received: true });

    const link = await deps.db.getLinkByProviderId(event.providerLinkId);
    if (!link || link.status === LINK_STATUS.DISCONNECTED) return ok({ received: true, ignored: true });

    const nowIso = deps.now().toISOString();
    switch (event.kind) {
        case 'accounts_ready':
        case 'transactions_ready':
        case 'new_transactions':
            deps.runInBackground(runSync(link, deps));
            break;
        case 'link_invalid':
            await deps.db.updateLink(link.id, { status: LINK_STATUS.INVALID, last_error: event.message ?? null, updated_at: nowIso });
            break;
        case 'link_token_required':
            await deps.db.updateLink(link.id, { status: LINK_STATUS.TOKEN_REQUIRED, last_error: event.message ?? null, updated_at: nowIso });
            break;
        default:
            break;
    }
    return ok({ received: true });
}

// Account deletion: stop provider billing before the user disappears.
export async function deleteAllUserLinks({ userId }, deps) {
    const links = await deps.db.listUserLinks(userId, { includeDisconnected: false });
    if (!links.length) return 0;
    if (!deps.provider) throw new Error('provider_unavailable');
    for (const link of links) await deps.provider.deleteLink(link.provider_link_id);
    return links.length;
}
```

- [ ] **Step 3: Verificar y commit**

Run: `npx vitest run __tests__/bancos` → PASS.

```bash
git add supabase/functions/_shared/bancos/handlers.js __tests__/bancos/handlers.test.js
git commit -m "feat(bancos): lógica de las funciones bank-* con dependencias inyectadas"
```

---

### Task 10: Adaptador HTTP, entradas Deno y cambios en la app

**Files:**
- Create: `supabase/functions/_shared/bancos/serve.js`
- Create: `supabase/functions/bank-connect-token/index.ts`, `bank-register-link/index.ts`, `bank-sync/index.ts`, `bank-disconnect/index.ts`, `bank-webhook/index.ts`
- Modify: `src/lib/bancos/client.js` (503 → `unavailable`), `src/lib/bancos/mock.js` (comentario de códigos)
- Modify: `src/app/api/account/route.js` (borrar links antes del usuario)
- Test: `__tests__/bancos/serve.test.js`

**Interfaces:**
- Produce: `createServe({ createClient, env, waitUntil }) → serve(handler, { auth = true }) → (Request) => Promise<Response>`. Con `auth`, el handler recibe `{ user, body }`; sin `auth`, `{ request }`.

- [ ] **Step 1: Test (falla)**

`__tests__/bancos/serve.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { createServe } from '../../supabase/functions/_shared/bancos/serve.js';

function fakeCreateClient(userForToken) {
    return vi.fn(() => ({
        auth: { getUser: vi.fn(async (token) => ({ data: { user: token === 'good' ? userForToken : null } })) },
        from: () => { throw new Error('db not used in this test'); },
    }));
}
const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'srv', BANK_PROVIDER: 'mock', BANK_WEBHOOK_SECRET: 's' };

describe('serve', () => {
    it('OPTIONS responde CORS', async () => {
        const serve = createServe({ createClient: fakeCreateClient(), env, waitUntil: () => {} });
        const res = await serve(async () => ({ status: 200, body: {} }))(new Request('https://f', { method: 'OPTIONS' }));
        expect(res.status).toBe(204);
        expect(res.headers.get('access-control-allow-origin')).toBe('*');
    });

    it('resuelve el usuario del Bearer y pasa body y deps al handler', async () => {
        const serve = createServe({ createClient: fakeCreateClient({ id: 'u1' }), env, waitUntil: () => {} });
        const handler = vi.fn(async ({ user, body }, deps) => ({ status: 200, body: { user: user?.id, body, hasProvider: !!deps.provider } }));
        const res = await serve(handler)(new Request('https://f', { method: 'POST', headers: { Authorization: 'Bearer good' }, body: JSON.stringify({ a: 1 }) }));
        expect(await res.json()).toEqual({ user: 'u1', body: { a: 1 }, hasProvider: true });
        expect(res.headers.get('content-type')).toContain('application/json');
    });

    it('token inválido → user null; sin auth → recibe request', async () => {
        const serve = createServe({ createClient: fakeCreateClient({ id: 'u1' }), env, waitUntil: () => {} });
        const res = await serve(async ({ user }) => ({ status: 200, body: { user } }))(new Request('https://f', { method: 'POST', headers: { Authorization: 'Bearer bad' } }));
        expect(await res.json()).toEqual({ user: null });
        const res2 = await serve(async ({ request }) => ({ status: 200, body: { isReq: request instanceof Request } }), { auth: false })(new Request('https://f', { method: 'POST' }));
        expect(await res2.json()).toEqual({ isReq: true });
    });

    it('excepción del handler → 500 sin detalles', async () => {
        const serve = createServe({ createClient: fakeCreateClient(), env, waitUntil: () => {} });
        const res = await serve(async () => { throw new Error('secret detail'); })(new Request('https://f', { method: 'POST' }));
        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({ error: 'internal' });
    });

    it('runInBackground usa waitUntil', async () => {
        const waitUntil = vi.fn();
        const serve = createServe({ createClient: fakeCreateClient(), env, waitUntil });
        await serve(async (_ctx, deps) => { deps.runInBackground(Promise.resolve()); return { status: 200, body: {} }; })(new Request('https://f', { method: 'POST' }));
        expect(waitUntil).toHaveBeenCalledTimes(1);
    });
});
```

Run → FAIL.

- [ ] **Step 2: Implementar `serve.js`**

`supabase/functions/_shared/bancos/serve.js`:

```js
// HTTP glue for the bank-* Edge Functions: CORS, JSON, Supabase auth and deps.
// createClient / env / waitUntil are injected by each Deno entrypoint, so this
// file stays runtime-agnostic and testable in Node.
import { userHasAccess } from '../access.js';
import { createDb } from './db.js';
import { getProvider } from './provider/index.js';
import { createAnthropicClassifier } from './ai.js';

const CORS = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
};

function json(status, body) {
    return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });
}

export function createServe({ createClient, env, waitUntil }) {
    return function serve(handler, { auth = true } = {}) {
        return async (req) => {
            if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
            if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

            const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
                auth: { persistSession: false, autoRefreshToken: false },
            });
            const deps = {
                db: createDb(admin),
                provider: getProvider(env),
                classify: createAnthropicClassifier({ apiKey: env.ANTHROPIC_API_KEY }),
                now: () => new Date(),
                runInBackground: (p) => waitUntil(Promise.resolve(p).catch((e) => console.error('[bancos] background', e))),
                userHasAccess,
                webhookSecret: env.BANK_WEBHOOK_SECRET,
            };

            try {
                let ctx;
                if (auth) {
                    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
                    let user = null;
                    if (token) {
                        const { data } = await admin.auth.getUser(token);
                        user = data?.user ?? null;
                    }
                    let body = {};
                    try { body = await req.json(); } catch { body = {}; }
                    ctx = { user, body };
                } else {
                    ctx = { request: req };
                }
                const { status, body } = await handler(ctx, deps);
                return json(status, body);
            } catch (e) {
                console.error('[bancos]', e);
                return json(500, { error: 'internal' });
            }
        };
    };
}
```

- [ ] **Step 3: Entradas Deno (5 archivos)**

`supabase/functions/bank-connect-token/index.ts`:

```ts
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createServe } from '../_shared/bancos/serve.js';
import { handleConnectToken } from '../_shared/bancos/handlers.js';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const serve = createServe({ createClient, env: Deno.env.toObject(), waitUntil: (p) => EdgeRuntime.waitUntil(p) });
Deno.serve(serve(handleConnectToken));
```

`supabase/functions/bank-register-link/index.ts`: idéntico, importando y sirviendo `handleRegisterLink`.

`supabase/functions/bank-sync/index.ts`: idéntico, con `handleSync`.

`supabase/functions/bank-disconnect/index.ts`: idéntico, con `handleDisconnect`.

`supabase/functions/bank-webhook/index.ts`: idéntico, con `handleWebhook` y la última línea `Deno.serve(serve(handleWebhook, { auth: false }));`.

(Cada archivo se escribe completo, con su import y su handler; no compartir código entre entradas.)

- [ ] **Step 4: App — código `unavailable` y borrado de cuenta**

En `src/lib/bancos/client.js` reemplazar:

```js
const STATUS_TO_CODE = { 401: 'no_session', 402: 'no_subscription', 403: 'forbidden', 404: 'not_found', 429: 'rate_limited' };
```

por:

```js
const STATUS_TO_CODE = { 401: 'no_session', 402: 'no_subscription', 403: 'forbidden', 404: 'not_found', 429: 'rate_limited', 503: 'unavailable' };
```

En `src/lib/bancos/mock.js`, en el comentario de `BancosError`, agregar `| 'unavailable'` a la lista de códigos.

En `src/app/api/account/route.js`:

1. Agregar imports:

```js
import { createDb } from '../../../../supabase/functions/_shared/bancos/db.js'
import { getProvider } from '../../../../supabase/functions/_shared/bancos/provider/index.js'
import { deleteAllUserLinks } from '../../../../supabase/functions/_shared/bancos/handlers.js'
```

2. Justo después de crear `adminClient` y antes del bucle de `tables`, agregar:

```js
        // Stop provider billing before deleting anything: if this fails, the
        // account stays intact and the user can retry.
        await deleteAllUserLinks({ userId }, {
            db: createDb(adminClient),
            provider: getProvider(process.env),
        })
```

- [ ] **Step 5: Verificar**

Run: `npx vitest run && npx eslint --rule 'no-undef: error' src/lib/bancos src/app/api/account supabase/functions/_shared && npm run build`
Esperado: todo en verde; 0 errores; build OK.

Run: `git grep -n "from '@/" -- supabase/functions` → sin resultados.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions src/lib/bancos src/app/api/account/route.js __tests__/bancos/serve.test.js
git commit -m "feat(bancos): Edge Functions bank-* y borrado de links al eliminar la cuenta"
```

---

### Task 11: Runbook de despliegue y verificación final

**Files:**
- Create: `docs/BANCOS_BACKEND.md`

- [ ] **Step 1: Runbook**

`docs/BANCOS_BACKEND.md`:

````markdown
# Backend de sincronización bancaria — despliegue

Código: `supabase/functions/_shared/bancos/` (lógica) y `supabase/functions/bank-*/` (entradas).
Spec: `docs/superpowers/specs/2026-10-12-sincronizacion-bancaria-design.md`.

## Orden (cada paso es seguro sin el siguiente)

1. **Migración** (aditiva; no rompe nada aunque no haya funciones):
   Supabase → SQL Editor → pegar `supabase/migrations/20261013000000_bank_sync_core.sql` → Run.
   Verificar: `select count(*) from public.bank_links;` responde 0 sin error.
2. **Funciones** (sin `BANK_PROVIDER` responden 503 `provider_unavailable`, así que publicarlas no expone nada):
   ```bash
   supabase login
   supabase link --project-ref rdmvynbidxfesvdkuqga
   supabase functions deploy bank-connect-token bank-register-link bank-sync bank-disconnect bank-webhook
   ```
3. **Secretos** — solo cuando el proveedor real esté integrado y probado en sandbox:
   ```bash
   supabase secrets set BANK_PROVIDER=<proveedor> BANK_WEBHOOK_SECRET=<aleatorio> ANTHROPIC_API_KEY=<llave>
   # + credenciales del proveedor
   ```
   **Nunca** `BANK_PROVIDER=mock` en producción.
4. **Webhook** en el panel del proveedor → `https://rdmvynbidxfesvdkuqga.supabase.co/functions/v1/bank-webhook`
   con el secreto del paso 3.
5. **App:** quitar `NEXT_PUBLIC_BANCOS_MOCK` de los builds de producción.

## Variables que usan las funciones

| Variable | Origen |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Las inyecta Supabase |
| `BANK_PROVIDER` | Secreto. Vacío → 503 |
| `BANK_WEBHOOK_SECRET` | Secreto |
| `ANTHROPIC_API_KEY` | Secreto. Vacío → sin IA (quedan en "Otros") |
````

- [ ] **Step 2: Verificación final**

Run: `npx vitest run && npx eslint src supabase/functions/_shared && npm run build`
Esperado: tests en verde; solo los errores de lint que ya existían en `main` (budgets, privacy, soporte, terms); build OK.

Run:
```bash
git grep -n "user_metadata" -- supabase/functions        # nada
git grep -nE "BANK_PROVIDER\s*=\s*['\"]?mock" -- supabase docs   # solo la advertencia del runbook
```

- [ ] **Step 3: Commit**

```bash
git add docs/BANCOS_BACKEND.md
git commit -m "docs(bancos): runbook de despliegue del backend de sincronización"
```

- [ ] **Step 4: PR (lo abre el controlador, no el implementador)**

PR contra **`main`**. Nada de este PR requiere pasos previos al deploy: la app no llama a las funciones (Alan usa el modo de prueba) y la migración no está aplicada. El PR solo agrega código y archivos.
