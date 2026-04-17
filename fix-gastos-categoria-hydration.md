fix-gastos-categoria-hydration.md
# Fix: Hydration error + Gastos por categoría sin datos

## Lee primero:
- src/app/dashboard/page.js
- src/app/finanzas/page.js
- src/components/GastosPorCategoria.jsx (si existe)
- src/lib/filterMemory.js (si existe)

---

## 1. FIX HYDRATION ERROR — localStorage en SSR

El error ocurre porque `getFilter('dashboard')` lee localStorage durante
el render del servidor donde no existe.

En TODOS los archivos que usen `getFilter` del filterMemory, cambiar:

```js
// MAL — causa hydration mismatch
const [periodo, setPeriodo] = useState(() => getFilter('finanzas'))

// BIEN — leer localStorage solo en el cliente
const [periodo, setPeriodo] = useState('mes')

useEffect(() => {
  const saved = getFilter('dashboard') // o 'finanzas', 'trading', etc.
  if (saved) setPeriodo(saved)
}, [])
```

Aplicar este patrón en dashboard/page.js, finanzas/page.js, trading/page.js
y cualquier otro archivo que use getFilter para inicializar estado.

---

## 2. FIX GASTOS POR CATEGORÍA — conectar a transacciones reales

### Problema
Las transacciones no tienen el campo `categoria` poblado, por eso todo
aparece como "Otros". Hay que:
1. Asegurarse de que la query trae el campo `categoria` correctamente
2. Agregar lógica de categorización automática por palabras clave como fallback
3. Mostrar en el formulario de nueva transacción el campo categoría

### Fix en GastosPorCategoria.jsx (o donde esté la query)

La query debe traer todas las transacciones de tipo egreso con su categoria:
```js
const { data } = await supabase
  .from('transactions')
  .select('categoria, amount, description')
  .eq('user_id', user.id)
  .eq('tipo', 'egreso')
  .gte('date', startDate)
  .lte('date', endDate)
```

Agregar función de categorización automática por palabras clave para
transacciones sin categoría:
```js
const categorizarAutomatico = (descripcion = '') => {
  const d = descripcion.toLowerCase()
  if (/spotify|netflix|disney|hbo|apple|suscri/i.test(d)) return 'Suscripciones'
  if (/uber eats|rappi|didi food|restaurant|café|cafe|taco|pizza/i.test(d)) return 'Restaurantes'
  if (/uber|didi|cabify|gasolina|gasolinera|oxxo gas|transporte/i.test(d)) return 'Transporte'
  if (/walmart|soriana|chedraui|superama|mercado|tianguis|costco/i.test(d)) return 'Comida'
  if (/spei|transferencia|envio|envío|depósito|deposito/i.test(d)) return 'Transferencias'
  if (/inversion|inversión|bursanet|gbm|cetes|fondos/i.test(d)) return 'Inversiones'
  return 'Otros'
}

// Al procesar cada transacción:
const cat = t.categoria || categorizarAutomatico(t.description || t.descripcion || '')
```

### Fix en formulario Nueva Transacción (finanzas/page.js)

En el modal/form de agregar transacción, agregar campo de categoría
solo cuando el tipo sea "egreso":

```jsx
{tipo === 'egreso' && (
  <select
    value={categoria}
    onChange={e => setCategoria(e.target.value)}
    style={{ /* mismo estilo que los otros inputs */ }}
  >
    <option value="">Sin categoría</option>
    <option value="Suscripciones">Suscripciones</option>
    <option value="Restaurantes">Restaurantes</option>
    <option value="Transporte">Transporte</option>
    <option value="Comida">Comida</option>
    <option value="Transferencias">Transferencias</option>
    <option value="Inversiones">Inversiones</option>
    <option value="Otros">Otros</option>
  </select>
)}
```

Asegurarse de que `categoria` se incluye en el objeto que se inserta
en Supabase al guardar la transacción.

### Fix en importación CSV

En la función que procesa el CSV e importa transacciones, aplicar
la misma función `categorizarAutomatico` para asignar categoría
automáticamente basada en la descripción/concepto de cada fila del CSV.

---

## 3. VERIFICAR CAMPO categoria EN SUPABASE

Verificar que la columna `categoria` existe en la tabla `transactions`.
Si no existe:
```sql
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS categoria TEXT;
```

Ejecutar este SQL en Supabase si la columna no existe.

---

## Notas
- No romper funcionalidad existente.
- Mantener dark theme.
- El componente GastosPorCategoria debe funcionar igual en /finanzas y /dashboard.