feature-finanzas-v2.md
# Feature: Finanzas v2 — múltiples mejoras

## Lee primero estos archivos antes de cambiar nada:
- src/app/finanzas/page.js
- src/app/trading/page.js
- src/lib/supabaseClient.js
- Revisa el schema de Supabase para las tablas: transactions, trading_operations,
  y cualquier tabla de configuración de usuario que exista.

---

## 1. AGREGAR user_id A trading_operations

Ejecuta este SQL en Supabase antes de cualquier cambio de código:
```sql
ALTER TABLE trading_operations ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS idx_trading_operations_user_id ON trading_operations(user_id);
```

En el fetchData de src/app/trading/page.js, agregar filtro:
```js
const { data: { user } } = await supabase.auth.getUser()
const { data, error } = await supabase
  .from('trading_operations')
  .select('*')
  .eq('user_id', user?.id)
  .order('fecha', { ascending: false })
```

---

## 2. ELIMINAR BOTÓN "TODOS LOS CLIENTES" EN FINANZAS

En src/app/finanzas/page.js, en la sección de "Transacciones Recientes",
eliminar únicamente el dropdown/select de "Todos los clientes".
Dejar intacto el selector de mes/fecha.

---

## 3. SELECTOR DE MES — TODOS LOS MESES DEL AÑO

El selector de fecha en Transacciones Recientes actualmente solo muestra
enero y febrero. Cambiar para que muestre todos los meses del año actual
más los meses disponibles del año anterior si hay transacciones.

Generarlo dinámicamente así:
```js
const meses = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]
// Generar opciones para el año actual y anterior
const opciones = []
const hoy = new Date()
for (let anio = hoy.getFullYear(); anio >= hoy.getFullYear() - 1; anio--) {
  meses.forEach((mes, i) => {
    opciones.push({ label: `${mes} ${anio}`, value: `${anio}-${String(i+1).padStart(2,'0')}` })
  })
}
```

---

## 4. CARD "POR COBRAR" → CONCEPTO PERSONALIZABLE POR USUARIO

### SQL a ejecutar en Supabase:
```sql
CREATE TABLE IF NOT EXISTS user_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) UNIQUE NOT NULL,
  concepto_custom_label TEXT DEFAULT 'Por Cobrar',
  concepto_custom_total NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Comportamiento del card:
- El título del card muestra el valor de `concepto_custom_label` (ej: "Ahorro",
  "Por Cobrar", "Por Pagar", "Meta", etc.)
- El monto muestra `concepto_custom_total`
- En la esquina del card hay un ícono de lápiz (✏️) para editar
- Al hacer clic en el lápiz, aparece un pequeño modal/popover con:
  - Input de texto: "Nombre del concepto" (ej: Ahorro)
  - Input numérico: "Monto"
  - Botón Guardar
- Al guardar, actualiza la tabla `user_config` en Supabase con upsert:
```js
await supabase.from('user_config').upsert({
  user_id: user.id,
  concepto_custom_label: nuevoLabel,
  concepto_custom_total: nuevoMonto
}, { onConflict: 'user_id' })
```

### En el formulario "Nueva Transacción":
- Agregar opción de tipo: el label personalizado del usuario (ej: "Ahorro")
  junto a los tipos existentes (Ingreso, Egreso, Inversión)
- Si el usuario elige ese tipo, la transacción se guarda con
  `tipo = concepto_custom_label` en la tabla transactions

---

## 5. MEMORIA DE FILTRO TEMPORAL (PERSISTENCIA AL NAVEGAR)

El filtro de período seleccionado en cada sección debe persistir al navegar
entre páginas. Usar `localStorage` para esto.

Implementar un helper:
```js
// src/lib/filterMemory.js
export const getFilter = (section) =>
  localStorage.getItem(`fnce_filter_${section}`) || 'mes'

export const setFilter = (section, value) =>
  localStorage.setItem(`fnce_filter_${section}`, value)
```

Secciones: `finanzas`, `trading`, `portfolio`, `dashboard`

En cada página, al montar:
```js
const [periodo, setPeriodo] = useState(() => getFilter('finanzas'))
```

Al cambiar:
```js
setFilter('finanzas', nuevoPeriodo)
setPeriodo(nuevoPeriodo)
```

---

## Notas
- Mantener dark theme en todos los componentes nuevos.
- No romper funcionalidad existente.
- Si alguna columna de fecha en trading_operations tiene nombre diferente
  a `fecha`, leer el schema primero y ajustar.
- El SQL de user_config y el de trading_operations hay que ejecutarlos
  manualmente en Supabase antes de correr este prompt.