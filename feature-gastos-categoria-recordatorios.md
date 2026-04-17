feature-gastos-categoria-recordatorios.md
# Feature: Gastos por categoría + Recordatorios con calendario

## Lee primero estos archivos antes de cambiar nada:
- src/app/finanzas/page.js
- src/app/dashboard/page.js (o donde esté el dashboard principal)
- src/components/ (todos los componentes relacionados a dashboard y finanzas)
- Revisa el schema de Supabase para la tabla transactions

---

## 1. SECCIÓN "GASTOS POR CATEGORÍA" — REDISEÑO COMPLETO

### Ubicación
En la página de Finanzas (`/finanzas`), reemplazar la sección actual de
gastos por categoría con el nuevo diseño.

### Diseño del card (basado en el mockup):
[GASTOS POR CATEGORÍA]                    [$22,976.76 total]
[Dona izquierda]   [Leyenda derecha con categorías y montos]

Layout interno:
- Izquierda (40%): gráfica de dona con Recharts `PieChart` + `innerRadius`
  - Al hacer hover sobre un segmento: tooltip con nombre, monto y porcentaje
  - Label flotante encima de la dona: muestra el segmento activo con
    "X cantidad" y "X%"
- Derecha (60%): lista de categorías
  - Cada fila: `[punto de color] [Nombre categoría]: $X,XXX.XX`
  - Al final de la lista: total `$XX,XXX.XX  100.0%`

### Colores por categoría (usar exactamente estos):
```js
const CATEGORY_COLORS = {
  'Suscripciones': '#EC4899',   // rosa
  'Comida': '#EAB308',          // amarillo
  'Transporte': '#22C55E',      // verde
  'Transferencias': '#A855F7',  // morado
  'Restaurantes': '#F97316',    // naranja
  'Inversiones': '#3B82F6',     // azul
  'Otros': '#6B7280',           // gris
}
```

### Lógica de datos:
```js
// Traer egresos del período seleccionado, agrupados por categoría
const { data } = await supabase
  .from('transactions')
  .select('categoria, amount')
  .eq('user_id', user.id)
  .eq('tipo', 'egreso')
  .gte('date', startDate)
  .lte('date', endDate)

// Agrupar por categoría
const grouped = data.reduce((acc, t) => {
  const cat = t.categoria || 'Otros'
  acc[cat] = (acc[cat] || 0) + Math.abs(t.amount)
  return acc
}, {})

// Convertir a array para Recharts
const chartData = Object.entries(grouped)
  .map(([name, value]) => ({ name, value }))
  .sort((a, b) => b.value - a.value)
```

### Tooltip de Recharts:
```jsx
<Tooltip
  content={({ active, payload }) => {
    if (!active || !payload?.length) return null
    const { name, value } = payload[0].payload
    const pct = ((value / totalEgresos) * 100).toFixed(1)
    return (
      <div style={{
        background: '#1a1a1a', border: '1px solid #333',
        borderRadius: 8, padding: '8px 12px'
      }}>
        <p style={{ color: CATEGORY_COLORS[name] || '#fff', margin: 0 }}>{name}</p>
        <p style={{ color: '#fff', margin: 0 }}>${value.toFixed(2)}</p>
        <p style={{ color: '#aaa', margin: 0 }}>{pct}%</p>
      </div>
    )
  }}
/>
```

---

## 2. MISMA GRÁFICA EN EL DASHBOARD

En el dashboard principal (`/dashboard`), dentro de la sección de Finanzas
o debajo de ella, agregar la misma gráfica de dona de gastos por categoría.

- Debe respetar el filtro temporal del dashboard (este mes / 3 meses / etc.)
- Mismo diseño visual que en /finanzas
- Extraer la lógica a un componente reutilizable:
  `src/components/GastosPorCategoria.jsx`
  que reciba como props: `userId`, `startDate`, `endDate`
  y sea usado tanto en /finanzas como en /dashboard

---

## 3. SISTEMA DE RECORDATORIOS CON CALENDARIO EN DASHBOARD

### Ubicación
Debajo del card "RESUMEN PORTFOLIO HEALTH" en el dashboard principal.

### SQL a ejecutar en Supabase:
```sql
CREATE TABLE IF NOT EXISTS reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  time TIME,
  completed BOOLEAN DEFAULT false,
  color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reminders_user_date ON reminders(user_id, date);
```

### Diseño del componente:
Card oscuro con título "RECORDATORIOS" en la parte superior derecha botón `+ Agregar`.

Layout de dos columnas:
- Izquierda: mini calendario mensual
  - Navegar entre meses con `<` `>`
  - Días con recordatorios tienen un punto de color debajo del número
  - Al hacer clic en un día, el panel derecho muestra los recordatorios de ese día
- Derecha: lista de recordatorios del día seleccionado
  - Cada recordatorio: `[checkbox] [título] [hora si existe]`
  - Al marcar checkbox, actualiza `completed = true` en Supabase
  - Botón de eliminar (ícono de basura) en cada recordatorio

### Modal "Agregar recordatorio":
Campos:
- Título (requerido)
- Descripción (opcional)
- Fecha (date picker)
- Hora (opcional)
- Color (selector de 5 colores predefinidos)

Al guardar:
```js
await supabase.from('reminders').insert({
  user_id: user.id,
  title,
  description,
  date,
  time,
  color
})
```

### Mini calendario — implementar sin librerías externas:
```js
// Generar días del mes actual
const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate()
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay()
```

---

## Notas
- El SQL de `reminders` hay que ejecutarlo manualmente en Supabase.
- Mantener dark theme en todos los componentes.
- Usar Recharts para la dona (ya instalado).
- No romper funcionalidad existente.
- Extraer GastosPorCategoria como componente reutilizable.