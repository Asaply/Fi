# Nuevo modelo de acceso — Plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDO: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para ejecutar este plan tarea por tarea. Los pasos usan checkbox (`- [ ]`).

**Objetivo:** reemplazar el análisis gratis y los 150 lugares por una prueba de 7 días, con el acceso guardado en `app_metadata` (solo el servidor puede escribirlo).

**Arquitectura:**
- `src/lib/access.js` concentra quién tiene acceso (`userHasAccess`), a dónde va el usuario (`postAuthDestination`) y cómo se escriben los metadatos (`accessMetadata`).
- Los webhooks de Stripe y Apple escriben `app_metadata` y además `user_metadata` como espejo para builds viejos de iOS.
- Todos los lectores (middleware, login, paywall, onboarding, `/api/analyze`) usan solo `app_metadata`.
- Un script, que se puede correr las veces que haga falta, migra a los usuarios existentes desde `subscriptions` y `free_grants`.

**Stack:** Next.js 15 (App Router, JS), Supabase (`@supabase/ssr`, `@supabase/supabase-js`), Stripe 22, vitest.

**Spec:** `docs/superpowers/specs/2026-10-12-modelo-acceso-design.md`

## Restricciones globales

- Prueba: **7 días**, solo para quien **nunca** tuvo fila en `subscriptions`.
- Precio sin cambios: **$99 MXN/mes** (`STRIPE_PRICE_ID` y producto de Apple actuales).
- Usuarios con `subscription_status: 'free'` conservan acceso de por vida.
- Ninguna validación de acceso puede leer `user_metadata`. `user_metadata` solo guarda `onboarded`, `display_name` y el espejo de acceso.
- Los archivos que prueba vitest **no pueden usar el alias `@/`** (vitest no lo resuelve): solo imports relativos o de paquetes.
- ESLint de este repo **ignora `.jsx`**: los archivos nuevos van en `.js`.
- No instalar dependencias. No hacer push ni commit fuera de los pasos indicados.
- Verificar con: `npx vitest run`, `npx eslint <archivos>`, `npm run build`.

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/lib/access.js` | Modificar | `hasAccess` + nuevos `getAccessMeta`, `userHasAccess`, `postAuthDestination`, `accessMetadata` |
| `src/lib/stripeSync.js`, `src/lib/appleIap.js` | Modificar | Escribir `app_metadata` + espejo |
| `src/lib/trial.js` | Crear | `TRIAL_DAYS`, `trialDaysFor()` (servidor, puro) |
| `src/lib/trialEligibility.js` | Crear | `isTrialEligible(userId)` (cliente, consulta `subscriptions`) |
| `src/lib/onboardingResume.js` | Crear | `STEP`, `onboardingStartStep(user)` |
| `src/lib/finanzas/analysisRows.js` | Mover desde `src/lib/pendingAnalysis.js` | `analysisToTransactionRows()` |
| `src/lib/accessMigration.js` | Crear | `accessFromRecords()` (puro) |
| `scripts/migrate-access-to-app-metadata.mjs` | Crear | Migración con `--dry-run` / `--apply` |
| `supabase/sql/anon-rate-limits.sql` | Modificar | Agregar RLS |
| Páginas y rutas | Modificar/borrar | Ver cada tarea |

---

### Task 0: Preparar ramas

**Files:** ninguno (git/GitHub).

- [ ] **Step 1: Cerrar el PR #4 y apuntar el #5 a la limpieza**

```bash
gh pr close 4 -c "Ya no aplica: el análisis gratis se elimina en el nuevo modelo de acceso (ver docs/superpowers/specs/2026-10-12-modelo-acceso-design.md). Su mapeo se reutiliza en el onboarding."
gh pr edit 5 --base chore/limpieza
```

El #5 ahora incluye el commit del fix (`fix: guardar el análisis gratis…`). No pasa nada: la Task 6 borra el hook y conserva el mapeo.

- [ ] **Step 2: Crear la rama de trabajo**

```bash
git checkout refactor/finanzas-page
git checkout -b feature/modelo-acceso
git merge --no-edit docs/spec-modelo-acceso   # trae el spec y este plan
npx vitest run __tests__/csvImport.test.js __tests__/pendingAnalysis.test.js
```

Esperado: `Tests  22 passed`.

---

### Task 1: Helpers de acceso

**Files:**
- Modify: `src/lib/access.js` (agregar al final)
- Test: `__tests__/access.test.js`

**Interfaces:**
- Produce:
  - `getAccessMeta(user) → object|null`
  - `userHasAccess(user, now?: number) → boolean`
  - `postAuthDestination(user) → '/onboarding'|'/paywall'|'/finanzas'`
  - `accessMetadata({ status, source, expiresAt }) → { subscription_status, subscription_source, subscription_expires_at }`

- [ ] **Step 1: Escribir el test que falla**

`__tests__/access.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { hasAccess, getAccessMeta, userHasAccess, postAuthDestination, accessMetadata } from '../src/lib/access';

const NOW = Date.parse('2026-10-12T12:00:00Z');
const future = '2026-11-12T00:00:00Z';
const past = '2026-09-01T00:00:00Z';

describe('hasAccess (sin cambios)', () => {
    it('free nunca vence', () => {
        expect(hasAccess({ subscription_status: 'free' }, NOW)).toBe(true);
    });
    it('active con vencimiento futuro', () => {
        expect(hasAccess({ subscription_status: 'active', subscription_expires_at: future }, NOW)).toBe(true);
    });
    it('active vencido hace más de 24 h', () => {
        expect(hasAccess({ subscription_status: 'active', subscription_expires_at: past }, NOW)).toBe(false);
    });
    it('active sin vencimiento (legacy)', () => {
        expect(hasAccess({ subscription_status: 'active', subscription_expires_at: null }, NOW)).toBe(true);
    });
    it('expired o vacío', () => {
        expect(hasAccess({ subscription_status: 'expired' }, NOW)).toBe(false);
        expect(hasAccess(null, NOW)).toBe(false);
    });
});

describe('userHasAccess lee SOLO app_metadata', () => {
    it('da acceso por app_metadata', () => {
        const user = { app_metadata: { subscription_status: 'free' }, user_metadata: {} };
        expect(userHasAccess(user, NOW)).toBe(true);
    });
    it('ignora user_metadata aunque diga free (escalada del cliente)', () => {
        const user = { app_metadata: {}, user_metadata: { subscription_status: 'free' } };
        expect(userHasAccess(user, NOW)).toBe(false);
    });
    it('sin usuario no hay acceso', () => {
        expect(userHasAccess(null, NOW)).toBe(false);
        expect(getAccessMeta(undefined)).toBe(null);
    });
});

describe('postAuthDestination', () => {
    const paid = { subscription_status: 'free' };
    it('sin onboarding → /onboarding', () => {
        expect(postAuthDestination({ app_metadata: paid, user_metadata: {} })).toBe('/onboarding');
    });
    it('onboarded sin acceso → /paywall', () => {
        expect(postAuthDestination({ app_metadata: {}, user_metadata: { onboarded: true } })).toBe('/paywall');
    });
    it('onboarded con acceso → /finanzas', () => {
        expect(postAuthDestination({ app_metadata: paid, user_metadata: { onboarded: true } })).toBe('/finanzas');
    });
});

describe('accessMetadata', () => {
    it('arma las tres claves', () => {
        expect(accessMetadata({ status: 'active', source: 'stripe', expiresAt: future })).toEqual({
            subscription_status: 'active',
            subscription_source: 'stripe',
            subscription_expires_at: future,
        });
    });
    it('expiresAt ausente → null', () => {
        expect(accessMetadata({ status: 'free', source: 'free' }).subscription_expires_at).toBe(null);
    });
});
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `npx vitest run __tests__/access.test.js`
Esperado: FAIL, `getAccessMeta is not a function` (o similar).

- [ ] **Step 3: Implementar**

Agregar al final de `src/lib/access.js`:

```js
// Access lives in app_metadata, which only the server (service role) can write.
// user_metadata is editable by the user from the browser, so it must never
// decide access.
export function getAccessMeta(user) {
    return user?.app_metadata || null;
}

export function userHasAccess(user, now = Date.now()) {
    return hasAccess(getAccessMeta(user), now);
}

// Where a signed-in user belongs: onboarding first, then paywall, then the app.
export function postAuthDestination(user) {
    if (!user?.user_metadata?.onboarded) return '/onboarding';
    if (!userHasAccess(user)) return '/paywall';
    return '/finanzas';
}

// Shape written to app_metadata (and mirrored to user_metadata for old iOS builds).
export function accessMetadata({ status, source, expiresAt }) {
    return {
        subscription_status: status,
        subscription_source: source,
        subscription_expires_at: expiresAt ?? null,
    };
}
```

Actualizar el comentario del inicio de `access.js`: donde dice `// user_metadata shape:` cambiar a `// app_metadata shape:`.

- [ ] **Step 4: Correrlo y ver que pasa**

Run: `npx vitest run __tests__/access.test.js`
Esperado: PASS (14 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/access.js __tests__/access.test.js
git commit -m "feat(access): leer acceso solo de app_metadata"
```

---

### Task 2: Escritores de Stripe y Apple

**Files:**
- Modify: `src/lib/stripeSync.js` (bloque `updateUserById` dentro de `applyStripeSubscription`)
- Modify: `src/lib/appleIap.js` (bloque `updateUserById` dentro de `applyAppleSubscription`)
- Test: `__tests__/stripeSync.test.js`

**Interfaces:**
- Consume: `accessMetadata` (Task 1)
- Produce: sin cambios de firma. `applyStripeSubscription(admin, userId, sub)` y `applyAppleSubscription(admin, userId, {...})` ahora escriben `app_metadata` y `user_metadata`.

- [ ] **Step 1: Escribir el test que falla**

`__tests__/stripeSync.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { mapStripeSubscription, applyStripeSubscription } from '../src/lib/stripeSync';

const periodEnd = Date.parse('2026-10-19T00:00:00Z') / 1000;

describe('mapStripeSubscription', () => {
    it('trialing da acceso hasta el fin de la prueba', () => {
        expect(mapStripeSubscription({ status: 'trialing', current_period_end: periodEnd })).toEqual({
            status: 'active',
            expiresAt: '2026-10-19T00:00:00.000Z',
        });
    });
    it('canceled expira', () => {
        expect(mapStripeSubscription({ status: 'canceled', current_period_end: periodEnd }).status).toBe('expired');
    });
});

describe('applyStripeSubscription', () => {
    it('escribe app_metadata y el espejo en user_metadata', async () => {
        const updateUserById = vi.fn().mockResolvedValue({ error: null });
        const admin = {
            from: () => ({ upsert: () => Promise.resolve({ error: null }) }),
            auth: { admin: { updateUserById } },
        };
        await applyStripeSubscription(admin, 'user-1', {
            id: 'sub_1', customer: 'cus_1', status: 'trialing', current_period_end: periodEnd,
        });
        const expected = {
            subscription_status: 'active',
            subscription_source: 'stripe',
            subscription_expires_at: '2026-10-19T00:00:00.000Z',
        };
        expect(updateUserById).toHaveBeenCalledWith('user-1', { app_metadata: expected, user_metadata: expected });
    });
});
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `npx vitest run __tests__/stripeSync.test.js`
Esperado: los 2 tests de `mapStripeSubscription` pasan (ya funciona); el de `applyStripeSubscription` FALLA (hoy solo manda `user_metadata`).

- [ ] **Step 3: Implementar en `stripeSync.js`**

Agregar debajo de `import { createClient } from '@supabase/supabase-js';`:

```js
import { accessMetadata } from './access';
```

Reemplazar:

```js
    const { error: metaErr } = await admin.auth.admin.updateUserById(userId, {
        user_metadata: {
            subscription_status: status,
            subscription_source: 'stripe',
            subscription_expires_at: expiresAt,
        },
    });
```

por:

```js
    const access = accessMetadata({ status, source: 'stripe', expiresAt });
    const { error: metaErr } = await admin.auth.admin.updateUserById(userId, {
        app_metadata: access,
        // Mirror for iOS builds already in the App Store, which read access from
        // user_metadata on the client. No server-side check trusts this copy.
        user_metadata: access,
    });
```

Cambiar el comentario `// Persist subscription state for a user: subscriptions row + user_metadata.` a `// Persist subscription state for a user: subscriptions row + app_metadata (+ mirror).`

- [ ] **Step 4: Implementar en `appleIap.js`**

Agregar a los imports:

```js
import { accessMetadata } from './access';
```

Reemplazar:

```js
    const { error: metaErr } = await admin.auth.admin.updateUserById(userId, {
        user_metadata: {
            subscription_status: status,
            subscription_source: 'apple',
            subscription_expires_at: expiresAt,
        },
    });
```

por:

```js
    const access = accessMetadata({ status, source: 'apple', expiresAt });
    const { error: metaErr } = await admin.auth.admin.updateUserById(userId, {
        app_metadata: access,
        // Mirror for iOS builds already in the App Store (see stripeSync.js).
        user_metadata: access,
    });
```

Cambiar el comentario `// Persist Apple subscription state: subscriptions row + user_metadata.` a `// Persist Apple subscription state: subscriptions row + app_metadata (+ mirror).`

- [ ] **Step 5: Correr tests y lint**

Run: `npx vitest run __tests__/stripeSync.test.js __tests__/access.test.js && npx eslint src/lib/stripeSync.js src/lib/appleIap.js`
Esperado: PASS; lint sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/lib/stripeSync.js src/lib/appleIap.js __tests__/stripeSync.test.js
git commit -m "feat(access): Stripe y Apple escriben app_metadata (user_metadata queda de espejo)"
```

---

### Task 3: Lectores de acceso

**Files:**
- Modify: `src/middleware.ts:4,52-57,72,80-84,94-97`
- Modify: `src/app/login/page.js` (import y 3 redirecciones)
- Modify: `src/components/NativeAuthDeepLink.js` (`routeAfterAuth`)
- Modify: `src/app/paywall/page.js` (import y `useEffect`)
- Modify: `src/app/paywall/success/page.js` (import y 3 checks)
- Modify: `src/app/onboarding/page.js` (import y `StepPlans`)

**Interfaces:**
- Consume: `userHasAccess`, `postAuthDestination` (Task 1)

- [ ] **Step 1: Middleware**

En `src/middleware.ts`:

Reemplazar `import { hasAccess } from '@/lib/access'` por:

```ts
import { userHasAccess, postAuthDestination } from '@/lib/access'
```

Reemplazar el bloque `isPublic` por (quita `/analyze`):

```ts
  const isPublic = pathname === '/' || pathname === '/login' ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/terms') || pathname.startsWith('/privacy') ||
    pathname.startsWith('/paywall') ||
    pathname.startsWith('/api/stripe/webhook') ||
    pathname.startsWith('/api/iap/notifications')
```

Reemplazar `const isPaid = hasAccess(user.user_metadata)` por:

```ts
  const isPaid = userHasAccess(user)
```

Reemplazar la función `getSmartDest` completa por:

```ts
  function getSmartDest() {
    return postAuthDestination(user)
  }
```

Reemplazar:

```ts
  // Not onboarded → must complete onboarding first (paywall is inside onboarding)
  if (!isOnboarded && !isOnboardingRoute) {
```

por:

```ts
  // Not onboarded → must complete onboarding first (paywall is inside onboarding).
  // /paywall/success is the exception: it finishes verifying a Stripe payment and
  // then sends the user back to onboarding itself.
  if (!isOnboarded && !isOnboardingRoute && !pathname.startsWith('/paywall/success')) {
```

- [ ] **Step 2: Login**

En `src/app/login/page.js`:

Reemplazar `import { hasAccess } from '@/lib/access';` por:

```js
import { postAuthDestination } from '@/lib/access';
```

Reemplazar:

```js
            const m = session.user?.user_metadata || {};
            if (!m.onboarded) router.replace('/onboarding');
            else if (!hasAccess(m)) router.replace('/paywall');
            else router.replace('/finanzas');
```

por:

```js
            router.replace(postAuthDestination(session.user));
```

Reemplazar **las dos** apariciones (Apple Sign In y deep link de Google) de:

```js
                        const isOnboarded = !!user?.user_metadata?.onboarded;
                        const isPaid = hasAccess(user?.user_metadata);
                        if (!isOnboarded) router.push('/onboarding');
                        else if (!isPaid) router.push('/paywall');
                        else router.push('/finanzas');
```

y

```js
                            const isOnboarded = !!user?.user_metadata?.onboarded;
                            const isPaid = hasAccess(user?.user_metadata);
                            if (!isOnboarded) router.push('/onboarding');
                            else if (!isPaid) router.push('/paywall');
                            else router.push('/finanzas');
```

por, respectivamente:

```js
                        router.push(postAuthDestination(user));
```

```js
                            router.push(postAuthDestination(user));
```

- [ ] **Step 3: Deep link nativo**

En `src/components/NativeAuthDeepLink.js`:

Reemplazar `import { hasAccess } from '@/lib/access';` por `import { postAuthDestination } from '@/lib/access';` y la función `routeAfterAuth` completa por:

```js
function routeAfterAuth(router, user) {
    router.replace(postAuthDestination(user));
}
```

- [ ] **Step 4: Paywall y success**

En `src/app/paywall/page.js`: reemplazar `import { hasAccess } from '@/lib/access';` por `import { userHasAccess } from '@/lib/access';` y `if (hasAccess(session.user?.user_metadata)) {` por `if (userHasAccess(session.user)) {`.

En `src/app/paywall/success/page.js`: reemplazar `import { hasAccess } from '@/lib/access';` por `import { userHasAccess } from '@/lib/access';` y las **dos** apariciones de `hasAccess(user?.user_metadata)` por `userHasAccess(user)`.

- [ ] **Step 5: Onboarding (StepPlans)**

En `src/app/onboarding/page.js`: reemplazar `import { hasAccess } from '@/lib/access';` por `import { userHasAccess } from '@/lib/access';` y `if (hasAccess(data?.user?.user_metadata)) { onDone(); return; }` por:

```js
            if (userHasAccess(data?.user)) { onDone(); return; }
```

- [ ] **Step 6: Verificar que ya nada decide acceso con user_metadata**

Run: `git grep -nE "hasAccess\([^)]*user_metadata|hasAccess\(m\)" -- src`
Esperado: sin resultados.

Run: `npx eslint --rule 'no-undef: error' src/middleware.ts src/app/login/page.js src/components/NativeAuthDeepLink.js src/app/paywall src/app/onboarding/page.js && npm run build`
Esperado: 0 errores; `✓ Compiled successfully`.

- [ ] **Step 7: Commit**

```bash
git add src/middleware.ts src/app/login/page.js src/components/NativeAuthDeepLink.js src/app/paywall src/app/onboarding/page.js
git commit -m "fix(security): middleware y pantallas deciden acceso con app_metadata"
```

---

### Task 4: Prueba de 7 días y fin de los 150 lugares

**Files:**
- Create: `src/lib/trial.js`, `src/lib/trialEligibility.js`
- Test: `__tests__/trial.test.js`
- Modify: `src/app/api/stripe/create-checkout/route.js`
- Modify: `src/app/paywall/page.js`, `src/app/onboarding/page.js` (`StepPlans`)
- Delete: `src/lib/freeTier.js`, `src/app/api/access/claim/route.js`

**Interfaces:**
- Produce:
  - `TRIAL_DAYS = 7`
  - `trialDaysFor(priorSubscription: object|null) → number`
  - `isTrialEligible(userId: string) → Promise<boolean>` (cliente)

- [ ] **Step 1: Escribir el test que falla**

`__tests__/trial.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { TRIAL_DAYS, trialDaysFor } from '../src/lib/trial';

describe('trialDaysFor', () => {
    it('la prueba dura 7 días', () => {
        expect(TRIAL_DAYS).toBe(7);
    });
    it('sin suscripción previa → 7 días', () => {
        expect(trialDaysFor(null)).toBe(7);
        expect(trialDaysFor(undefined)).toBe(7);
    });
    it('con cualquier suscripción previa → 0', () => {
        expect(trialDaysFor({ user_id: 'u', status: 'expired' })).toBe(0);
    });
});
```

Run: `npx vitest run __tests__/trial.test.js` → FAIL (`Cannot find module '../src/lib/trial'`).

- [ ] **Step 2: Implementar**

`src/lib/trial.js`:

```js
// Free trial for new subscribers. Anyone who ever had a subscription row pays
// from day one, so cancelling and re-subscribing doesn't grant another trial.
export const TRIAL_DAYS = 7;

export function trialDaysFor(priorSubscription) {
    return priorSubscription ? 0 : TRIAL_DAYS;
}
```

`src/lib/trialEligibility.js`:

```js
// Client-side: decides whether the paywall can promise the free trial.
// RLS lets a user read only their own subscriptions row.
import { supabase } from '@/lib/supabaseClient';

export async function isTrialEligible(userId) {
    if (!userId) return true;
    const { data } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();
    return !data;
}
```

Run: `npx vitest run __tests__/trial.test.js` → PASS.

- [ ] **Step 3: Checkout con prueba**

En `src/app/api/stripe/create-checkout/route.js`, agregar imports:

```js
import { getAdminClient } from '@/lib/stripeSync';
import { trialDaysFor } from '@/lib/trial';
```

Dentro del `try`, antes de `const session = await getStripe().checkout.sessions.create({`, agregar:

```js
        const { data: prior } = await getAdminClient()
            .from('subscriptions')
            .select('user_id')
            .eq('user_id', user.id)
            .maybeSingle();
        const trialDays = trialDaysFor(prior);
```

Reemplazar:

```js
            subscription_data: { metadata: { user_id: user.id } },
```

por:

```js
            subscription_data: {
                metadata: { user_id: user.id },
                ...(trialDays > 0 ? { trial_period_days: trialDays } : {}),
            },
```

- [ ] **Step 4: Paywall sin lugares gratis y con prueba**

En `src/app/paywall/page.js`:

1. Reemplazar `import { getRemainingSlots, claimFreeSlot } from '@/lib/freeTier';` por:

```js
import { isTrialEligible } from '@/lib/trialEligibility';
import { TRIAL_DAYS } from '@/lib/trial';
```

2. Reemplazar `const [remaining, setRemaining] = useState(null);` por `const [trialEligible, setTrialEligible] = useState(true);`

3. Reemplazar `getRemainingSlots().then((s) => setRemaining(s?.remaining ?? 0));` por:

```js
            isTrialEligible(session.user?.id).then(setTrialEligible);
```

4. Borrar la función `handleFree` completa (desde `async function handleFree() {` hasta su `}` de cierre, antes de `async function handlePay() {`).

5. **Bloque nativo:** reemplazar desde `{remaining > 0 && (` hasta el cierre del botón `Suscribirme — $99 MXN/mes` (inclusive) por:

```jsx
                    <button
                        className={styles.payBtn}
                        onClick={handleNativePurchase}
                        disabled={loading}
                    >
                        {loading ? 'Procesando...' : 'Suscribirme — $99 MXN/mes'}
                    </button>
```

Y reemplazar `Se renueva automáticamente · Gestiona en Ajustes de tu Apple ID` por:

```jsx
                        Nuevos suscriptores: {TRIAL_DAYS} días gratis · Se renueva automáticamente · Gestiona en Ajustes de tu Apple ID
```

6. **Bloque web:** reemplazar desde `{remaining > 0 && (` hasta el cierre del botón `Redirigiendo... / Suscribirme` (inclusive) por:

```jsx
                <button
                    className={styles.payBtn}
                    onClick={handlePay}
                    disabled={loading}
                >
                    {loading
                        ? 'Redirigiendo...'
                        : trialEligible ? `Probar ${TRIAL_DAYS} días gratis` : 'Suscribirme — $99 MXN/mes'}
                </button>
```

Y reemplazar `Pago seguro vía Stripe · Cancela cuando quieras` por:

```jsx
                    {trialEligible
                        ? `${TRIAL_DAYS} días gratis, luego $99 MXN/mes · Pago seguro vía Stripe · Cancela cuando quieras`
                        : 'Pago seguro vía Stripe · Cancela cuando quieras'}
```

- [ ] **Step 5: StepPlans del onboarding sin lugares gratis y con prueba**

En `src/app/onboarding/page.js`:

1. Reemplazar `import { getRemainingSlots, claimFreeSlot } from '@/lib/freeTier';` por:

```js
import { isTrialEligible } from '@/lib/trialEligibility';
import { TRIAL_DAYS } from '@/lib/trial';
```

2. En `StepPlans`, reemplazar `const [remaining, setRemaining] = useState(null); // free slots left (null = unknown)` por `const [trialEligible, setTrialEligible] = useState(true);`

3. Reemplazar:

```js
            getRemainingSlots().then((slots) => {
                if (!cancelled) setRemaining(slots?.remaining ?? 0);
            });
```

por:

```js
            isTrialEligible(data?.user?.id).then((ok) => { if (!cancelled) setTrialEligible(ok); });
```

4. Borrar la función `handleFree` completa.

5. Borrar la línea `const freeAvailable = remaining > 0;`.

6. Reemplazar `{native ? 'Se renueva automáticamente · Gestiona en Ajustes' : 'Pago seguro vía Stripe · Cancela cuando quieras'}` por:

```jsx
                    {native
                        ? `Nuevos suscriptores: ${TRIAL_DAYS} días gratis · Se renueva automáticamente`
                        : trialEligible
                            ? `${TRIAL_DAYS} días gratis, luego $99 MXN/mes · Cancela cuando quieras`
                            : 'Pago seguro vía Stripe · Cancela cuando quieras'}
```

7. Reemplazar desde `{freeAvailable && (` hasta el cierre del botón `Procesando... / Suscribirme` (inclusive) por:

```jsx
                <button
                    className="ob-btn-pay"
                    onClick={native ? handleNativePurchase : handleWebPay}
                    disabled={loading}
                >
                    {loading
                        ? 'Procesando...'
                        : !native && trialEligible ? `Probar ${TRIAL_DAYS} días gratis` : 'Suscribirme — $99 MXN/mes'}
                </button>
```

- [ ] **Step 6: Borrar los lugares gratis**

```bash
git rm src/lib/freeTier.js src/app/api/access/claim/route.js
git grep -nE "freeTier|claimFreeSlot|getRemainingSlots|api/access/claim|de 150" -- src
```

Esperado: el grep no devuelve nada.

- [ ] **Step 7: Verificar**

Run: `npx vitest run && npx eslint --rule 'no-undef: error' src/app/paywall src/app/onboarding/page.js src/app/api/stripe/create-checkout/route.js src/lib/trial.js src/lib/trialEligibility.js && npm run build`
Esperado: tests en verde salvo `statementParser.test.js` (falla desde antes, ver Task 10); 0 errores de lint; build OK.

- [ ] **Step 8: Commit**

```bash
git add -A src/lib/trial.js src/lib/trialEligibility.js __tests__/trial.test.js src/app/api/stripe/create-checkout/route.js src/app/paywall/page.js src/app/onboarding/page.js
git commit -m "feat(paywall): prueba de 7 días para nuevos y fin de los 150 lugares gratis"
```

---

### Task 5: `/api/analyze` solo con acceso

**Files:**
- Modify: `src/app/api/analyze/route.js:3-6,338-361`
- Modify: `src/app/privacy/page.js:42,93`
- Delete: `src/lib/rateLimitAnon.js`

- [ ] **Step 1: Reemplazar la puerta de entrada**

En `src/app/api/analyze/route.js`:

Reemplazar `import { checkAnonRateLimit } from '@/lib/rateLimitAnon';` por `import { userHasAccess } from '@/lib/access';`.

Reemplazar el bloque desde `    const user = await getAuthUser();` hasta el `}` que cierra el `else` del rate limit anónimo (justo antes de la línea en blanco y el `try {` interno), es decir:

```js
    const user = await getAuthUser();

    const ip = getIp(request);

    if (user) {
        // Authenticated — rate limit per user: 10 req/min
        const rl = await checkRateLimit(user.id, { maxRequests: 10, windowMs: 60_000 });
        if (!rl.allowed) {
            auditLog({ userId: user.id, event: 'analysis.rate_limited', ip });
            return NextResponse.json(
                { error: 'Demasiadas solicitudes. Espera un momento antes de intentar de nuevo.' },
                { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
            );
        }
    } else {
        // Anonymous free-tier — 1 analysis per IP per day (distributed via Supabase)
        const rl = await checkAnonRateLimit(`anon:${ip}`, 1, 24 * 60 * 60_000);
        if (!rl.allowed) {
            auditLog({ userId: null, event: 'analysis.anon_rate_limited', ip });
            return NextResponse.json(
                { error: 'Ya usaste tu análisis gratuito. Crea una cuenta para acceso completo.', limitReached: true },
                { status: 429 }
            );
        }
    }
```

por:

```js
    const user = await getAuthUser();
    if (!user) return unauthorized();
    if (!userHasAccess(user)) {
        return NextResponse.json(
            { error: 'Necesitas una suscripción activa para analizar estados de cuenta.' },
            { status: 402 }
        );
    }

    const ip = getIp(request);

    // Rate limit per user: 10 req/min
    const rl = await checkRateLimit(user.id, { maxRequests: 10, windowMs: 60_000 });
    if (!rl.allowed) {
        auditLog({ userId: user.id, event: 'analysis.rate_limited', ip });
        return NextResponse.json(
            { error: 'Demasiadas solicitudes. Espera un momento antes de intentar de nuevo.' },
            { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
        );
    }
```

- [ ] **Step 2: Borrar el limitador anónimo**

```bash
git rm src/lib/rateLimitAnon.js
git grep -n "rateLimitAnon\|checkAnonRateLimit" -- src
```

Esperado: sin resultados.

- [ ] **Step 3: Privacidad**

En `src/app/privacy/page.js`:
- Reemplazar `Dirección IP (para límites de uso en análisis gratuitos).` por `Dirección IP (para seguridad y límites de uso).`
- Borrar la línea completa `<li className={styles.li}>Resultados de análisis temporales (se eliminan al cerrar el navegador).</li>`.

- [ ] **Step 4: Verificar**

Run: `npx eslint --rule 'no-undef: error' src/app/api/analyze/route.js src/app/privacy/page.js && npm run build`
Esperado: 0 errores; build OK.

- [ ] **Step 5: Commit**

```bash
git add -A src/app/api/analyze/route.js src/lib/rateLimitAnon.js src/app/privacy/page.js
git commit -m "fix(security): /api/analyze exige sesión y suscripción"
```

---

### Task 6: Quitar el embudo `/analyze`

**Files:**
- Delete: `src/app/analyze/` (completo), `src/lib/hooks/useClaimPendingAnalysis.js`
- Move: `src/lib/pendingAnalysis.js` → `src/lib/finanzas/analysisRows.js`; `__tests__/pendingAnalysis.test.js` → `__tests__/analysisRows.test.js`
- Modify: `src/app/finanzas/page.js`, `src/app/page.js`, `src/app/blog/page.js`, `src/app/blog/[slug]/page.js`, `src/app/sitemap.js`, `src/components/ConditionalShell.js`, `src/app/login/page.js`

**Interfaces:**
- Produce: `analysisToTransactionRows(analysis, userId, memoria?) → Row[]` y `tipoCuentaDe(analysis) → 'credito'|'debito'` desde `src/lib/finanzas/analysisRows.js` (mismas firmas que hoy en `pendingAnalysis.js`).

- [ ] **Step 1: Mover el mapeo y su test**

```bash
git mv src/lib/pendingAnalysis.js src/lib/finanzas/analysisRows.js
git mv __tests__/pendingAnalysis.test.js __tests__/analysisRows.test.js
```

En `src/lib/finanzas/analysisRows.js`, reemplazar las líneas de encabezado:

```js
// The free analysis at /analyze runs before the user has an account, so its
// result is parked in sessionStorage until they sign up and land on /finanzas.
import { resolverCategoria } from './categorias';

export const PENDING_ANALYSIS_KEY = 'nva_pending_analysis';
```

por:

```js
// Turn a POST /api/analyze response into rows for the `transactions` table.
import { resolverCategoria } from '../categorias';
```

En `__tests__/analysisRows.test.js` reemplazar `from '../src/lib/pendingAnalysis'` por `from '../src/lib/finanzas/analysisRows'`.

Run: `npx vitest run __tests__/analysisRows.test.js` → PASS (6).

- [ ] **Step 2: Quitar el hook de `/finanzas`**

```bash
git rm src/lib/hooks/useClaimPendingAnalysis.js
```

En `src/app/finanzas/page.js` borrar:
- La línea `import { useClaimPendingAnalysis } from "@/lib/hooks/useClaimPendingAnalysis";`
- La línea `    const [userId, setUserId] = useState(null);`
- La línea `            setUserId(user.id);`
- El bloque:

```js
    // Free analysis done at /analyze before signing up → save it now.
    useClaimPendingAnalysis(userId, (count) => {
        toast.success(`Guardamos tu análisis: ${count} movimientos`);
        fetchData();
    });

```

- [ ] **Step 3: Borrar las páginas**

```bash
git rm -r src/app/analyze
```

- [ ] **Step 4: Landing y blog**

En `src/app/page.js`:
- `<Link href="/analyze" className={styles.navCta}>Empezar gratis</Link>` → `<Link href="/login" className={styles.navCta}>Prueba 7 días gratis</Link>`
- El bloque:

```jsx
          <Link href="/analyze" className={styles.cta}>
            Analizar mi estado de cuenta
          </Link>
```

→

```jsx
          <Link href="/login" className={styles.cta}>
            Prueba 7 días gratis
          </Link>
```

- El bloque:

```jsx
        <Link href="/analyze" className={styles.cta}>
          Empezar gratis ahora
        </Link>
        <p className={styles.ctaNote}>Sin registro · 100% privado · Tus datos no se guardan</p>
```

→

```jsx
        <Link href="/login" className={styles.cta}>
          Prueba 7 días gratis
        </Link>
        <p className={styles.ctaNote}>7 días gratis · Luego $99 MXN/mes · Cancela cuando quieras</p>
```

En `src/app/blog/page.js` y `src/app/blog/[slug]/page.js`: reemplazar cada `href="/analyze"` por `href="/login"` y cada texto `Empezar gratis` por `Prueba 7 días gratis`.

- [ ] **Step 5: Sitemap, shell y login**

- `src/app/sitemap.js`: borrar la línea `{ url: \`${base}/analyze\`,  lastModified: now, changeFrequency: 'monthly', priority: 0.9 },`.
- `src/components/ConditionalShell.js`: reemplazar `pathname.startsWith('/analyze') || pathname.startsWith('/auth/') ||` por `pathname.startsWith('/auth/') ||`.
- `src/app/login/page.js`: borrar la función `LoginBanner` completa (de `function LoginBanner({ reason }) {` a su `}` de cierre), la línea `    const reason = searchParams.get('reason');` y la línea `            <LoginBanner reason={reason} />`.

- [ ] **Step 6: Verificar que no quedan referencias**

Run: `git grep -nE "[\"'=]/analyze|nva_pending_analysis|nva_free_analysis|pendingAnalysis|useClaimPendingAnalysis|LoginBanner" -- src`
Esperado: sin resultados. El patrón exige comilla o `=` justo antes de `/analyze`, así que las llamadas a `/api/analyze` no coinciden.

Run: `git grep -n "api/analyze" -- src` → solo `finanzas/page.js` y `onboarding/page.js`.

Run: `npx vitest run && npx eslint --rule 'no-undef: error' src/app/finanzas/page.js src/app/page.js src/app/blog src/app/sitemap.js src/components/ConditionalShell.js src/app/login/page.js && npm run build`
Esperado: tests OK (salvo `statementParser.test.js`), 0 errores, build OK sin la ruta `/analyze` en la lista.

- [ ] **Step 7: Commit**

```bash
git add -A src __tests__
git commit -m "feat: quitar el análisis gratis sin cuenta (/analyze)"
```

---

### Task 7: Onboarding — Planes antes de importar, y retomar

**Files:**
- Create: `src/lib/onboardingResume.js`
- Test: `__tests__/onboardingResume.test.js`
- Modify: `src/app/onboarding/page.js` (comentario de pasos, `useEffect` inicial, render de pasos, `StepImport.handleUpload`, efecto de `StepPlans`)

**Interfaces:**
- Consume: `userHasAccess` (Task 1), `analysisToTransactionRows` (Task 6)
- Produce: `STEP = { START: 0, SECURITY: 5, PLANS: 6, IMPORT: 7, INSIGHTS: 8, DONE: 9 }`, `onboardingStartStep(user, now?) → number`

- [ ] **Step 1: Escribir el test que falla**

`__tests__/onboardingResume.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { STEP, onboardingStartStep } from '../src/lib/onboardingResume';

describe('onboardingStartStep', () => {
    it('usuario nuevo empieza desde el principio', () => {
        expect(onboardingStartStep({ app_metadata: {}, user_metadata: {} })).toBe(STEP.START);
    });
    it('ya puso su nombre pero no pagó → Planes', () => {
        expect(onboardingStartStep({ app_metadata: {}, user_metadata: { display_name: 'Ana' } })).toBe(STEP.PLANS);
    });
    it('ya tiene acceso (regresó de Stripe) → Importar', () => {
        expect(onboardingStartStep({ app_metadata: { subscription_status: 'free' }, user_metadata: {} })).toBe(STEP.IMPORT);
    });
    it('el orden nuevo pone Planes antes de Importar', () => {
        expect(STEP.PLANS).toBeLessThan(STEP.IMPORT);
        expect(STEP.IMPORT).toBeLessThan(STEP.INSIGHTS);
        expect(STEP.INSIGHTS).toBeLessThan(STEP.DONE);
    });
});
```

Run: `npx vitest run __tests__/onboardingResume.test.js` → FAIL (módulo no existe).

- [ ] **Step 2: Implementar**

`src/lib/onboardingResume.js`:

```js
// Onboarding step numbers and where a returning user picks up. Plans come
// before Import so no statement is analyzed (with paid AI) before the user
// starts the trial.
import { userHasAccess } from './access';

export const STEP = { START: 0, SECURITY: 5, PLANS: 6, IMPORT: 7, INSIGHTS: 8, DONE: 9 };

// Web checkout leaves the app; when Stripe sends the user back they land here
// again, as does anyone who closed the app on the plans screen.
export function onboardingStartStep(user, now = Date.now()) {
    if (userHasAccess(user, now)) return STEP.IMPORT;
    if (user?.user_metadata?.display_name) return STEP.PLANS;
    return STEP.START;
}
```

Run: `npx vitest run __tests__/onboardingResume.test.js` → PASS (4).

- [ ] **Step 3: Página — imports y comentario**

En `src/app/onboarding/page.js` agregar a los imports:

```js
import { STEP, onboardingStartStep } from '@/lib/onboardingResume';
import { analysisToTransactionRows } from '@/lib/finanzas/analysisRows';
```

Reemplazar el comentario de pasos:

```js
// 6 = Import CTA
// 7 = Analysis insights (post-import)
// 8 = Plans / payment (paywall)
// 9 = Done
```

por:

```js
// 6 = Plans / payment (paywall) — starts the 7-day trial
// 7 = Import CTA
// 8 = Analysis insights (post-import)
// 9 = Done
```

- [ ] **Step 4: Página — retomar al abrir**

Reemplazar:

```js
        supabase.auth.getUser().then(({ data }) => {
            if (data?.user?.user_metadata?.onboarded) {
                router.replace('/finanzas');
            }
        });
```

por:

```js
        supabase.auth.getUser().then(({ data }) => {
            const user = data?.user;
            if (user?.user_metadata?.onboarded) {
                router.replace('/finanzas');
                return;
            }
            const start = onboardingStartStep(user);
            if (start !== STEP.START) setStep(start);
        });
```

- [ ] **Step 5: Página — nuevo orden de pasos**

Reemplazar el bloque desde `{step === 5 && <StepSecurity onNext={() => advance(6)} />}` hasta `{step === 9 && <StepDone onFinish={() => complete('/finanzas')} />}` (inclusive) por:

```jsx
                {step === STEP.SECURITY && <StepSecurity onNext={() => advance(STEP.PLANS)} />}
                {step === STEP.PLANS && (
                    <StepPlans
                        selectedGoal={selectedGoal}
                        onDone={() => advance(STEP.IMPORT)}
                    />
                )}
                {step === STEP.IMPORT && (
                    <StepImport
                        onImportComplete={(data) => { setAnalysisData(data); advance(STEP.INSIGHTS); }}
                        onSkip={() => advance(STEP.DONE)}
                    />
                )}
                {step === STEP.INSIGHTS && (
                    <StepInsights
                        data={analysisData}
                        onNext={() => advance(STEP.DONE)}
                    />
                )}
                {step === STEP.DONE && <StepDone onFinish={() => complete('/finanzas')} />}
```

- [ ] **Step 6: StepPlans — ya no marca `onboarded`**

En el efecto de `StepPlans`, reemplazar:

```js
            if (selectedGoal) localStorage.setItem('fnce_primary_use', selectedGoal);
            localStorage.setItem(ONBOARDING_KEY, '1');
            supabase.auth.updateUser({ data: { onboarded: true } }).catch(() => {});
```

por:

```js
            // Keep the goal across the Stripe redirect; `onboarded` is set only by
            // complete() at the end, so a returning user resumes at Import.
            if (selectedGoal) localStorage.setItem('fnce_primary_use', selectedGoal);
```

Y actualizar el comentario de arriba del efecto. Cambiar:

```js
    // On reaching this step: if the user already has access, skip. Otherwise
    // mark onboarding complete and show the plans screen with both the free-tier
    // claim and the paid subscription (so Apple can review the IAP).
```

por:

```js
    // On reaching this step: if the user already has access, skip. Otherwise
    // show the plans screen (trial + subscription; Apple reviews the IAP here).
```

Y el comentario:

```js
            // Show the plans screen immediately; persisting `onboarded` and
            // loading the free-slot count are non-blocking so we don't sit on a
            // black screen for ~3s waiting on sequential network calls.
```

por:

```js
            // Show the plans screen immediately; the trial check is non-blocking.
```

- [ ] **Step 7: StepImport — con token y mapeo correcto**

En `handleUpload` de `StepImport`, reemplazar:

```js
            setStatusMsg('Detectando banco y transacciones...');
            const res = await fetch(`${API_BASE}/api/analyze`, { method: 'POST', body: fd });
```

por:

```js
            setStatusMsg('Detectando banco y transacciones...');
            const { data: { session } } = await supabase.auth.getSession();
            const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
            const res = await fetch(`${API_BASE}/api/analyze`, { method: 'POST', body: fd, headers });
```

Reemplazar desde `            const { data: { user } } = await supabase.auth.getUser();` hasta el `}));` que cierra el `payload` (inclusive), es decir:

```js
            const { data: { user } } = await supabase.auth.getUser();
            const banco = data.bank || 'Desconocido';
            const accountType = data.tipo_cuenta || 'debito';

            const payload = (data.transactions || []).map(t => ({
                date: t.fecha,
                concept: t.concepto,
                amount: t.monto,
                type: t.tipo === 'ajuste' ? 'egreso' : t.tipo,
                client: 'N/A',
                categoria: t.categoria || 'Otros',
                bank: banco,
                account_type: accountType,
                user_id: user.id,
            }));
```

por:

```js
            // Same mapping as the /finanzas import ('Egreso'/'Ingreso', debito/credito).
            const payload = analysisToTransactionRows(data, session.user.id);
```

- [ ] **Step 8: Verificar**

Run: `npx vitest run && npx eslint --rule 'no-undef: error' --rule 'no-unused-vars: warn' src/app/onboarding/page.js src/lib/onboardingResume.js && npm run build`
Esperado: tests OK (salvo `statementParser.test.js`); 0 errores de `no-undef`. Si aparece `ONBOARDING_KEY` como no usado, no pasa nada: lo sigue usando `complete()`.

- [ ] **Step 9: Commit**

```bash
git add src/lib/onboardingResume.js __tests__/onboardingResume.test.js src/app/onboarding/page.js
git commit -m "feat(onboarding): planes antes de importar, retomar tras Stripe y mapeo correcto"
```

---

### Task 8: RLS en `anon_rate_limits`

**Files:**
- Modify: `supabase/sql/anon-rate-limits.sql`

- [ ] **Step 1: Agregar RLS al SQL versionado**

Reemplazar la línea `-- No RLS — only accessed via service role from API routes` por:

```sql
-- RLS on with no policies: only the service role (API routes) can read or
-- write. Without it, anyone with the anon key could delete rows and reset
-- their own rate limit.
alter table public.anon_rate_limits enable row level security;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/sql/anon-rate-limits.sql
git commit -m "fix(security): RLS en anon_rate_limits"
```

- [ ] **Step 3: Aplicar en prod (Leonardo, en el SQL Editor de Supabase)**

```sql
alter table public.anon_rate_limits enable row level security;
-- Verificación: debe devolver rowsecurity = true
select relname, relrowsecurity from pg_class where relname = 'anon_rate_limits';
```

---

### Task 9: Script de migración

**Files:**
- Create: `src/lib/accessMigration.js`
- Test: `__tests__/accessMigration.test.js`
- Create: `scripts/migrate-access-to-app-metadata.mjs`

**Interfaces:**
- Consume: `accessMetadata` (Task 1)
- Produce: `accessFromRecords({ subscription, freeGrant, userMetadata }) → accessMeta|null`

- [ ] **Step 1: Escribir el test que falla**

`__tests__/accessMigration.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { accessFromRecords } from '../src/lib/accessMigration';

describe('accessFromRecords', () => {
    it('la fila de subscriptions tiene prioridad', () => {
        expect(accessFromRecords({
            subscription: { status: 'active', source: 'stripe', current_period_end: '2026-11-01T00:00:00Z' },
            freeGrant: { user_id: 'u' },
            userMetadata: {},
        })).toEqual({
            subscription_status: 'active',
            subscription_source: 'stripe',
            subscription_expires_at: '2026-11-01T00:00:00Z',
        });
    });
    it('free con suscripción vencida regresa a free', () => {
        expect(accessFromRecords({
            subscription: { status: 'expired', source: 'stripe', current_period_end: '2026-01-01T00:00:00Z' },
            freeGrant: { user_id: 'u' },
            userMetadata: {},
        }).subscription_status).toBe('free');
    });
    it('solo free_grants → free de por vida', () => {
        expect(accessFromRecords({ subscription: null, freeGrant: { user_id: 'u' }, userMetadata: {} })).toEqual({
            subscription_status: 'free',
            subscription_source: 'free',
            subscription_expires_at: null,
        });
    });
    it('pago único legacy sin fila se copia de user_metadata', () => {
        expect(accessFromRecords({
            subscription: null,
            freeGrant: null,
            userMetadata: { subscription_status: 'active', subscription_source: 'stripe_legacy', subscription_expires_at: null },
        })).toEqual({
            subscription_status: 'active',
            subscription_source: 'stripe_legacy',
            subscription_expires_at: null,
        });
    });
    it('sin nada → null (no se toca)', () => {
        expect(accessFromRecords({ subscription: null, freeGrant: null, userMetadata: { subscription_status: 'free' } })).toBe(null);
    });
});
```

Run: `npx vitest run __tests__/accessMigration.test.js` → FAIL (módulo no existe).

- [ ] **Step 2: Implementar la función**

`src/lib/accessMigration.js`:

```js
// Derive a user's app_metadata access from the source-of-truth tables, for the
// one-time move off user_metadata. Safe to re-run: same inputs, same output.
import { accessMetadata } from './access';

export function accessFromRecords({ subscription, freeGrant, userMetadata }) {
    const subscriptionActive = subscription?.status === 'active';
    if (subscription && (subscriptionActive || !freeGrant)) {
        return accessMetadata({
            status: subscription.status,
            source: subscription.source,
            expiresAt: subscription.current_period_end,
        });
    }
    if (freeGrant) {
        return accessMetadata({ status: 'free', source: 'free', expiresAt: null });
    }
    // One-time payers from before subscriptions existed may have no row.
    if (userMetadata?.subscription_source === 'stripe_legacy') {
        return accessMetadata({
            status: userMetadata.subscription_status,
            source: 'stripe_legacy',
            expiresAt: userMetadata.subscription_expires_at,
        });
    }
    return null;
}
```

Run: `npx vitest run __tests__/accessMigration.test.js` → PASS (5).

- [ ] **Step 3: Escribir el script**

`scripts/migrate-access-to-app-metadata.mjs`:

```js
#!/usr/bin/env node
// Copy each user's access into app_metadata from `subscriptions` + `free_grants`.
// Dry-run by default; pass --apply to write. Safe to re-run.
//   node scripts/migrate-access-to-app-metadata.mjs
//   node scripts/migrate-access-to-app-metadata.mjs --apply
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { accessFromRecords } from '../src/lib/accessMigration.js';

function loadEnvLocal() {
    if (!fs.existsSync('.env.local')) return;
    for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
}

loadEnvLocal();
const apply = process.argv.includes('--apply');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
    console.error('Faltan NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
}
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function allUsers() {
    const users = [];
    for (let page = 1; ; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        users.push(...data.users);
        if (data.users.length < 1000) return users;
    }
}

const [{ data: subs, error: subsErr }, { data: grants, error: grantsErr }] = await Promise.all([
    admin.from('subscriptions').select('user_id, status, source, current_period_end'),
    admin.from('free_grants').select('user_id'),
]);
if (subsErr) throw subsErr;
if (grantsErr) throw grantsErr;
const subByUser = new Map(subs.map((s) => [s.user_id, s]));
const grantByUser = new Map(grants.map((g) => [g.user_id, g]));

const users = await allUsers();
const counts = {};
const changed = [];
for (const user of users) {
    const access = accessFromRecords({
        subscription: subByUser.get(user.id) || null,
        freeGrant: grantByUser.get(user.id) || null,
        userMetadata: user.user_metadata || {},
    });
    const label = access ? `${access.subscription_status}/${access.subscription_source}` : 'sin acceso';
    counts[label] = (counts[label] || 0) + 1;
    if (!access) continue;

    const current = user.app_metadata || {};
    const same = current.subscription_status === access.subscription_status &&
        current.subscription_source === access.subscription_source &&
        (current.subscription_expires_at ?? null) === access.subscription_expires_at;
    if (same) continue;

    const um = user.user_metadata || {};
    if (um.subscription_status !== access.subscription_status) {
        changed.push(`${user.email}: user_metadata=${um.subscription_status ?? '—'} → ${access.subscription_status}`);
    }
    if (apply) {
        const { error } = await admin.auth.admin.updateUserById(user.id, { app_metadata: access });
        if (error) console.error(`✗ ${user.email}: ${error.message}`);
    }
}

console.log(`Usuarios: ${users.length}`);
console.table(counts);
if (changed.length) {
    console.log('Difieren de su user_metadata actual (revisar):');
    for (const line of changed) console.log('  ' + line);
}
console.log(apply ? '✓ app_metadata escrito.' : 'Dry-run: no se escribió nada. Usa --apply para escribir.');
```

- [ ] **Step 4: Verificar sintaxis sin tocar la base**

Run: `node --check scripts/migrate-access-to-app-metadata.mjs && npx vitest run __tests__/accessMigration.test.js`
Esperado: sin errores; PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/accessMigration.js __tests__/accessMigration.test.js scripts/migrate-access-to-app-metadata.mjs
git commit -m "feat(access): script de migración a app_metadata desde subscriptions y free_grants"
```

---

### Task 10: Verificación final y despliegue

**Files:**
- Modify: `__tests__/statementParser.test.js` (borrar; falla desde antes, ver abajo)

- [ ] **Step 1: Test viejo roto**

`__tests__/statementParser.test.js` importa `parseStatementText`, que ya no existe desde la reescritura del parser. Falla también en `main`.

```bash
git rm __tests__/statementParser.test.js
git commit -m "test: borrar test de parseStatementText (función eliminada en la reescritura del parser)"
```

- [ ] **Step 2: Suite completa**

Run: `npx vitest run && npx eslint src && npm run build`
Esperado: todos los tests en verde; 0 errores de lint (los warnings previos de `MESES` y `password` siguen); build OK.

- [ ] **Step 3: Revisión de seguridad por grep**

```bash
git grep -nE "hasAccess\([^)]*user_metadata" -- src           # nada
git grep -nE "user_metadata" -- src/middleware.ts src/app/api  # solo .onboarded en middleware
git grep -nE "checkAnonRateLimit|freeTier|[\"'=]/analyze" -- src  # nada
```

- [ ] **Step 4: Push y PR**

```bash
git push -u origin feature/modelo-acceso
gh pr create --base main --title "feat: nuevo modelo de acceso (prueba 7 días, app_metadata)" --body-file - <<'EOF'
Implementa docs/superpowers/specs/2026-10-12-modelo-acceso-design.md (plan: docs/superpowers/plans/2026-10-12-modelo-acceso.md).

**Orden de despliegue (obligatorio):** ver "Despliegue" en el plan. El script de migración se corre ANTES y DESPUÉS del deploy.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

- [ ] **Step 5: Despliegue (Leonardo + Claude, en este orden)**

1. Merge de este PR a main (ya incluye el refactor de finanzas que no llegó a main), **sin** promover a producción todavía. Si Vercel despliega `main` automáticamente, hacer los pasos 2 y 3 antes del merge.
2. Correr `alter table … enable row level security` (Task 8, Step 3) en el SQL Editor.
3. `node scripts/migrate-access-to-app-metadata.mjs` (dry-run). Revisar el conteo: el número de `free/free` debe coincidir con las filas de `free_grants`. Revisar la lista de usuarios que difieren.
   - Si el dry-run lista usuarios en PERDERÍA ACCESO, reconciliarlos a mano (verificar pago en Stripe/Apple e insertar fila en subscriptions) y repetir el dry-run hasta que la lista esté vacía.
   - Verificar: `select count(*) from subscriptions where source='stripe' and current_period_end is null;` — si > 0, re-sincronizar esas suscripciones antes del deploy.
4. `node scripts/migrate-access-to-app-metadata.mjs --apply`.
5. Deploy a producción (promover el deploy de `main`).
6. Justo después: `node scripts/migrate-access-to-app-metadata.mjs --apply` otra vez. Nota: esta corrida puede competir con un webhook que llegue a mitad de la corrida y dejar un dato viejo (raro); volver a correrla lo resuelve.
7. Verificar en prod:
   - Un usuario free entra a `/finanzas`.
   - Cuenta nueva → onboarding → Planes → Stripe (modo test en preview) → regresa a Importar.
   - En la consola de una cuenta sin pago: `supabase.auth.updateUser({ data: { subscription_status: 'free' } })` y recargar → sigue en `/paywall`.
   - `curl -X POST https://www.nva.lat/api/analyze` → 401.
8. App Store Connect: oferta introductoria gratis de 7 días en el producto de suscripción.

**Reversa:** revertir el merge. `user_metadata` sigue escrito (espejo), así que el código anterior funciona sin cambios.
