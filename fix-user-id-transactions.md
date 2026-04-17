fix-user-id-transactions.md
# Fix: user_id en tabla transactions

## Problema
El código intenta insertar `user_id` en la tabla `transactions` pero la columna
no existe en Supabase, causando error PGRST204 al importar estados de cuenta.

## Solución

### 1. Agregar columna en Supabase
Ejecuta este SQL en el SQL Editor de Supabase
(https://supabase.com/dashboard/project/rdmvynbidxfesvdkuqga/sql):

```sql
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
```

### 2. Verificar que el payload incluye user_id correctamente
En `src/app/finanzas/page.js`, busca donde se construye el payload antes del insert.
Debe verse así:

```js
const { data: { user } } = await supabase.auth.getUser();

const payload = transaccionesParaImportar.map(t => ({
  ...t,
  user_id: user?.id ?? null,
}));
```

Si `user_id` se asigna en otro lugar o de otra forma, ajústalo para que use
`user?.id` del resultado de `supabase.auth.getUser()`.

### 3. Verificar fetchData filtra por user_id
La función que carga transacciones debe filtrar por el usuario actual:

```js
const { data: { user } } = await supabase.auth.getUser();
const { data, error } = await supabase
  .from('transactions')
  .select('*')
  .eq('user_id', user?.id)
  .order('date', { ascending: false });
```

Si actualmente no filtra por `user_id`, agregar el `.eq('user_id', user?.id)`.

### 4. Probar
- Iniciar sesión en la app
- Intentar importar un estado de cuenta
- Verificar que las transacciones aparecen en la tabla