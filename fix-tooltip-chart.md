fix-tooltip-chart.md
# Fix: Tooltip blanco en gráfica de Reporte Mensual

## Problema
El tooltip de la gráfica BarChart en el dashboard muestra fondo blanco,
rompiendo la armonía del dark theme.

## Fix
En el componente del Reporte Mensual, agregar contentStyle al Tooltip de Recharts:

```jsx
<Tooltip
  contentStyle={{
    backgroundColor: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
    color: '#ffffff',
  }}
  labelStyle={{ color: '#aaaaaa', marginBottom: '4px' }}
  formatter={(value, name) => [
    `$${value.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
    name === 'ingresos' ? 'Ingresos' : 'Egresos'
  ]}
  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
/>
```

El `cursor` también se ve blanco/gris al hover — el `fill` con opacidad baja
lo convierte en un highlight sutil oscuro.

Aplicar el mismo fix a TODOS los tooltips de Recharts en el proyecto
(BarChart, PieChart, LineChart) que no tengan contentStyle definido.