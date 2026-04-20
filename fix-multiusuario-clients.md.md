# Fix: Multiusuario — clients query + RLS + limpiar código

## Contexto

La app tiene multiusuario implementado correctamente en `transactions`, `trading_operations`, `portfolio_assets` y `user_config`. Sin embargo:

1. La query de `clients` no filtra por `user_id` — todos los usuarios ven los mismos clientes
2. Las tablas `clients`, `prospects`, `airbnb_reservations` y `reminders` no están en uso en la app (sin rutas ni UI habilitada)
3. `user_config` tiene RLS deshabilitado en Supabase

## Tareas

### 1. Buscar y corregir todas las queries de `clients`

Busca en todo el proyecto cualquier query a la tabla `clients`:

bash

```bash
grep -r "clients" app/ components/ lib/ --include="*.tsx" --include="*.ts" -n
```

Para cada query encontrada que NO tenga `user_id`, agrega el filtro. Ejemplo:

ts

```ts
// ❌ Antes
const { data } = await supabase
  .from('clients')
  .select('id, name, total_price, status')

// ✅ Después
const { data: { user } } = await supabase.auth.getUser()

const { data } = await supabase
  .from('clients')
  .select('id, name, total_price, status')
  .eq('user_id', user.id)
```

Asegúrate de que el `user` esté disponible en el contexto donde se hace la query (puede ya estar disponible como prop o hook).

### 2. Verificar columna `user_id` en tabla `clients`

Antes de agregar el filtro, confirma que la tabla `clients` tiene columna `user_id`. Si no la tiene, **NO agregues el filtro** — en su lugar, elimina completamente las referencias a `clients` del código (ver tarea 3).

Para verificar, busca en el código si hay algún INSERT a `clients` que incluya `user_id`:

bash

```bash
grep -r "clients" app/ components/ lib/ --include="*.tsx" --include="*.ts" -A5 | grep "user_id"
```

### 3. Eliminar del código las referencias a tablas no usadas

Las siguientes tablas NO tienen rutas ni UI activa en la app. Elimina cualquier import, query, tipo o referencia a ellas:

- `clients` — si NO tiene columna `user_id`, eliminar completamente
- `prospects`
- `airbnb_reservations`
- `reminders`

Busca referencias:

bash

```bash
grep -r "prospects\|airbnb_reservations\|reminders" app/ components/ lib/ --include="*.tsx" --include="*.ts" -l
```

Para cada archivo encontrado, elimina solo el código relacionado con esas tablas. No toques lógica de otras funcionalidades.