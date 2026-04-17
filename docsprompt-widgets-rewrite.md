# Reescritura completa del sistema de widgets del dashboard

## Contexto
- Stack: Next.js 15, App Router, React 19, react-grid-layout, Tailwind, Supabase
- Puerto local: 3005
- Dashboard page: src/app/dashboards/[id]/page.js
- Widgets actuales en: src/components/widgets/
- CSS: src/components/widgets/Widgets.css
- Los dashboards se guardan en localStorage con key: fnce_custom_dashboards
- 3 tipos de widget en uso: revenue, expenses, summary

## Problema central
Los widgets muestran espacio negro vacío debajo del contenido porque react-grid-layout
les asigna una altura (h) mayor a la que necesitan. El resize tampoco funciona bien.

## Objetivo
Widgets con tamaño exacto al contenido, sin espacio sobrante, sin resize manual.
Referencia visual: widgets de iOS/Apple — tamaño fijo, compacto, limpio.

---

## PASO 1: Cambiar config del grid en page.js

En src/app/dashboards/[id]/page.js, actualizar la config de ReactGridLayout:

```js
const GRID_CONFIG = {
  cols: 12,
  rowHeight: 10,        // granularidad fina de 10px
  margin: [8, 8],
  isDraggable: true,
  isResizable: false,   // sin resize manual
  compactType: 'vertical', // widgets se compactan hacia arriba automáticamente
  draggableHandle: '.widget-drag-handle',
};
```

Con rowHeight=10, un widget de 280px de alto necesita h=28.
Fórmula: h = Math.ceil(contenidoPx / 18)  (rowHeight 10 + margin 8)

---

## PASO 2: Reescribir los 3 widgets desde cero

### 2a. RevenueWidget — src/components/widgets/RevenueWidget.js

Datos que muestra (leer de Supabase igual que antes, no cambiar lógica de datos):
- Ingresos del período seleccionado
- Egresos del período seleccionado
- Balance Neto = Ingresos - Egresos
- Selector de período: Este mes / Últimos 3 meses / Este año

```jsx
'use client';
import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Settings, Trash2, GripHorizontal } from 'lucide-react';

export default function RevenueWidget({ instanceId, onDelete, onConfigure, supabaseData }) {
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState({ ingresos: 0, egresos: 0 });

  // Calcular ingresos/egresos del período desde supabaseData
  useEffect(() => {
    if (!supabaseData) return;
    // usar la misma lógica de filtrado por período que tenía el widget anterior
    const filtered = filterByPeriod(supabaseData, period);
    setData({
      ingresos: filtered.reduce((s, t) => t.tipo === 'ingreso' ? s + t.monto : s, 0),
      egresos: filtered.reduce((s, t) => t.tipo === 'egreso' ? s + t.monto : s, 0),
    });
  }, [supabaseData, period]);

  const balance = data.ingresos - data.egresos;
  const fmt = (n) => `$${Math.abs(n).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

  return (
    <div className="fnce-widget">
      <div className="fnce-widget-header widget-drag-handle">
        <span className="fnce-widget-title">Ingresos vs Egresos</span>
        <span className="fnce-live-badge">LIVE</span>
        <button onClick={onConfigure} className="fnce-widget-btn"><Settings size={13} /></button>
        <button onClick={onDelete} className="fnce-widget-btn"><Trash2 size={13} /></button>
      </div>

      <div className="fnce-widget-body">
        <select
          className="fnce-period-select"
          value={period}
          onChange={e => setPeriod(e.target.value)}
        >
          <option value="month">Este mes</option>
          <option value="3months">Últimos 3 meses</option>
          <option value="ytd">Este año</option>
        </select>

        <div className="fnce-metric-row">
          <TrendingUp size={14} className="text-green-400" />
          <span className="fnce-metric-label">Ingresos</span>
          <span className="fnce-metric-value positive">{fmt(data.ingresos)}</span>
        </div>

        <div className="fnce-divider" />

        <div className="fnce-metric-row">
          <TrendingDown size={14} className="text-red-400" />
          <span className="fnce-metric-label">Egresos</span>
          <span className="fnce-metric-value negative">{fmt(data.egresos)}</span>
        </div>

        <div className="fnce-divider dashed" />

        <div className="fnce-metric-row">
          <DollarSign size={14} className="text-gray-400" />
          <span className="fnce-metric-label font-semibold">Balance Neto</span>
          <span className={`fnce-metric-value ${balance >= 0 ? 'positive' : 'negative'}`}>
            {balance < 0 ? '-' : ''}{fmt(balance)}
          </span>
        </div>
      </div>
    </div>
  );
}
```

Tamaño en el grid: `{ w: 3, h: 28, minH: 28, maxH: 28 }`

---

### 2b. ExpensesWidget — src/components/widgets/ExpensesWidget.js

Datos que muestra:
- Donut chart con distribución de egresos por categoría
- Estado vacío si no hay egresos

```jsx
'use client';
import { useEffect, useRef } from 'react';
import { Settings, Trash2 } from 'lucide-react';
import Chart from 'chart.js/auto';

export default function ExpensesWidget({ instanceId, onDelete, onConfigure, supabaseData }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  const categories = buildCategories(supabaseData); // agrupar egresos por categoría
  const hasData = categories.length > 0;

  useEffect(() => {
    if (!hasData || !canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();

    chartRef.current = new Chart(canvasRef.current, {
      type: 'doughnut',
      data: {
        labels: categories.map(c => c.nombre),
        datasets: [{ data: categories.map(c => c.total), backgroundColor: CHART_COLORS }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: '#aaa', font: { size: 11 } } } },
        cutout: '65%',
      },
    });

    return () => chartRef.current?.destroy();
  }, [supabaseData]);

  return (
    <div className="fnce-widget">
      <div className="fnce-widget-header widget-drag-handle">
        <span className="fnce-widget-title">Distribución de Egresos</span>
        <span className="fnce-live-badge">LIVE</span>
        <button onClick={onConfigure} className="fnce-widget-btn"><Settings size={13} /></button>
        <button onClick={onDelete} className="fnce-widget-btn"><Trash2 size={13} /></button>
      </div>

      <div className="fnce-widget-body">
        {hasData ? (
          <div style={{ height: '160px', position: 'relative' }}>
            <canvas ref={canvasRef} />
          </div>
        ) : (
          <div className="fnce-empty-state">
            Sin egresos en este período.<br />
            Agrega transacciones en Finanzas.
          </div>
        )}
      </div>
    </div>
  );
}

const CHART_COLORS = ['#4ade80','#f87171','#60a5fa','#fb923c','#a78bfa','#34d399'];
```

Tamaño en el grid:
- Con datos (chart): `{ w: 4, h: 26, minH: 26, maxH: 26 }`
- Sin datos (empty): `{ w: 4, h: 16, minH: 16, maxH: 16 }`
- Usar h: 16 como default; cuando lleguen datos el componente puede notificar al padre para actualizar h (opcional, si es complejo usar h: 26 siempre)

---

### 2c. SummaryWidget — src/components/widgets/SummaryWidget.js

Datos que muestra:
- Capital Neto
- Margen %
- Total Ingresos
- Cuentas por Cobrar

```jsx
'use client';
import { Settings, Trash2, Activity } from 'lucide-react';

export default function SummaryWidget({ instanceId, onDelete, onConfigure, supabaseData }) {
  const metrics = buildSummaryMetrics(supabaseData); // misma lógica que antes

  const fmt = (n) => `$${(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
  const fmtPct = (n) => `${(n || 0).toFixed(1)}%`;

  return (
    <div className="fnce-widget">
      <div className="fnce-widget-header widget-drag-handle">
        <span className="fnce-widget-title">Resumen Financiero</span>
        <span className="fnce-live-badge">LIVE</span>
        <button onClick={onConfigure} className="fnce-widget-btn"><Settings size={13} /></button>
        <button onClick={onDelete} className="fnce-widget-btn"><Trash2 size={13} /></button>
      </div>

      <div className="fnce-widget-body">
        <div className="fnce-metrics-grid">
          <div className="fnce-metric-card">
            <span className="fnce-metric-card-label">Capital Neto</span>
            <span className="fnce-metric-card-value">{fmt(metrics.capitalNeto)}</span>
          </div>
          <div className="fnce-metric-card">
            <Activity size={12} className="fnce-metric-card-icon" />
            <span className="fnce-metric-card-label">Margen</span>
            <span className="fnce-metric-card-value">{fmtPct(metrics.margen)}</span>
          </div>
          <div className="fnce-metric-card">
            <span className="fnce-metric-card-label">Total Ingresos</span>
            <span className="fnce-metric-card-value">{fmt(metrics.totalIngresos)}</span>
          </div>
          <div className="fnce-metric-card">
            <span className="fnce-metric-card-label">C. por Cobrar</span>
            <span className="fnce-metric-card-value accent">{fmt(metrics.cuentasPorCobrar)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

Tamaño en el grid: `{ w: 4, h: 28, minH: 28, maxH: 28 }`

---

## PASO 3: CSS unificado — reemplazar Widgets.css completamente

```css
/* ============================================
   FNCE Widget System — Widgets.css
   Sistema limpio. Sin alturas fijas en px.
   El contenido define la altura del widget.
   ============================================ */

/* --- Base del widget --- */
.fnce-widget {
  background: #161616;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 14px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  /* NO hay height: 100% aquí — el contenido manda */
}

/* --- Header (también es el drag handle) --- */
.fnce-widget-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 14px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  cursor: grab;
  flex-shrink: 0;
  user-select: none;
}

.fnce-widget-header:active {
  cursor: grabbing;
}

.fnce-widget-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  flex: 1;
}

.fnce-live-badge {
  font-size: 9px;
  font-weight: 700;
  color: #00d4aa;
  background: rgba(0, 212, 170, 0.12);
  border: 1px solid rgba(0, 212, 170, 0.2);
  padding: 2px 5px;
  border-radius: 4px;
  letter-spacing: 0.6px;
}

.fnce-widget-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.3);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  flex-shrink: 0;
}

.fnce-widget-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.7);
}

/* --- Body del widget --- */
.fnce-widget-body {
  padding: 10px 14px 14px;
  flex-shrink: 0; /* NO flex:1 — el body solo ocupa lo que necesita */
}

/* --- Métricas (revenue widget) --- */
.fnce-period-select {
  width: 100%;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 7px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 11px;
  padding: 4px 8px;
  margin-bottom: 10px;
  cursor: pointer;
  outline: none;
}

.fnce-metric-row {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 0;
}

.fnce-metric-label {
  flex: 1;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.fnce-metric-value {
  font-size: 14px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.fnce-metric-value.positive { color: #4ade80; }
.fnce-metric-value.negative { color: #f87171; }

.fnce-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.06);
  margin: 1px 0;
}

.fnce-divider.dashed {
  background: none;
  border-top: 1px dashed rgba(255, 255, 255, 0.1);
}

/* --- Grid 2x2 (summary widget) --- */
.fnce-metrics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
}

.fnce-metric-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 9px;
  padding: 9px 11px;
}

.fnce-metric-card-icon {
  color: rgba(255, 255, 255, 0.3);
  margin-bottom: 2px;
}

.fnce-metric-card-label {
  display: block;
  font-size: 9px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.35);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 3px;
}

.fnce-metric-card-value {
  display: block;
  font-size: 15px;
  font-weight: 700;
  color: #4ade80;
  font-variant-numeric: tabular-nums;
}

.fnce-metric-card-value.accent {
  color: #60a5fa;
}

/* --- Estado vacío --- */
.fnce-empty-state {
  text-align: center;
  padding: 18px 12px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.28);
  line-height: 1.6;
}

/* --- Ocultar resize handle de react-grid-layout --- */
.react-resizable-handle {
  display: none !important;
}

/* --- Drag handle bar (el que estaba separado) ya no se usa --- */
/* El header del widget ES el drag handle ahora */
.drag-handle-bar {
  display: none;
}
```

---

## PASO 4: Actualizar WIDGET_TYPES / DEFAULT_SIZES

Busca el archivo de definición de tipos de widget (puede llamarse widgetConfig.js,
widgetTypes.js, constants.js o estar inline en page.js).

Actualizar a:

```js
export const WIDGET_TYPES = [
  {
    typeId: 'revenue',
    name: 'Ingresos vs Egresos',
    description: 'Resumen de ingresos, egresos y balance del período',
    icon: 'TrendingUp',
    defaultLayout: { w: 3, h: 28, minH: 28, maxH: 28 },
  },
  {
    typeId: 'expenses',
    name: 'Distribución de Egresos',
    description: 'Desglose de egresos por categoría',
    icon: 'PieChart',
    defaultLayout: { w: 4, h: 26, minH: 26, maxH: 26 },
  },
  {
    typeId: 'summary',
    name: 'Resumen Financiero',
    description: 'Capital neto, margen, ingresos y cuentas por cobrar',
    icon: 'BarChart2',
    defaultLayout: { w: 4, h: 28, minH: 28, maxH: 28 },
  },
];

// Para normalizar widgets guardados en localStorage
export const WIDGET_FIXED_H = {
  revenue: 28,
  expenses: 26,
  summary: 28,
};
```

---

## PASO 5: Normalizar localStorage al cargar

En page.js, donde se lee el dashboard de localStorage, agregar:

```js
import { WIDGET_FIXED_H } from '@/components/widgets/widgetTypes';

// Al leer el dashboard:
const normalizedWidgets = dashboard.widgets.map(w => ({
  ...w,
  h:    WIDGET_FIXED_H[w.typeId] ?? w.h,
  minH: WIDGET_FIXED_H[w.typeId] ?? w.h,
  maxH: WIDGET_FIXED_H[w.typeId] ?? w.h,
}));

// Guardar de vuelta para que persista
const updatedDashboard = { ...dashboard, widgets: normalizedWidgets };
localStorage.setItem('fnce_custom_dashboards', JSON.stringify(
  allDashboards.map(d => d.id === dashboard.id ? updatedDashboard : d)
));
```

---

## PASO 6: Pasar props a los widgets desde page.js

En el render de cada widget, asegurarse de pasar:

```jsx
<WidgetComponent
  key={widget.instanceId}
  instanceId={widget.instanceId}
  supabaseData={supabaseData}   // los datos de Supabase que ya se fetching
  onDelete={() => handleDeleteWidget(widget.instanceId)}
  onConfigure={() => handleConfigureWidget(widget.instanceId)}
/>
```

---

## Entregable esperado

1. RevenueWidget.js reescrito
2. ExpensesWidget.js reescrito  
3. SummaryWidget.js reescrito
4. Widgets.css reemplazado
5. page.js actualizado: rowHeight=10, isResizable=false, compactType='vertical', draggableHandle='.widget-drag-handle'
6. WIDGET_TYPES / DEFAULT_SIZES actualizados con h en unidades de 10px
7. Normalización de localStorage al cargar el dashboard
8. Resultado: widgets compactos, sin espacio negro, el header es el área de arrastre
