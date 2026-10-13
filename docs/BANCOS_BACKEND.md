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

   **También en Vercel** (`finanzas-integraweb` → Environment Variables, solo Production): `BANK_PROVIDER` y las credenciales del proveedor. La ruta `/api/account` (borrar cuenta) usa el adaptador para borrar los links del usuario en el proveedor; sin esto, un usuario con bancos conectados no puede borrar su cuenta (responde error y la cuenta queda intacta).
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

## Requisitos para el adaptador del proveedor real

- `deleteLink` debe ser idempotente: si el proveedor responde 404, se considera borrado (borrar cuenta puede reintentarse).
- `parseWebhook` debe comparar el secreto en tiempo constante y rechazar si falta.
- Emitir los formatos normalizados `ProviderAccount` / `ProviderTransaction` (ver `supabase/functions/_shared/bancos/mapping.js` y el plan, Task 3).
- Errores de red/5xx del proveedor se lanzan como excepciones; el pipeline guarda `last_error` y el link conserva su estado.
