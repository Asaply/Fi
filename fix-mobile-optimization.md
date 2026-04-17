fix-mobile-optimization.md
# Fix: Optimización mobile + tooltip dona sobreposición

## Lee primero:
- src/app/finanzas/page.js
- src/app/dashboard/page.js
- src/components/GastosPorCategoria.jsx
- Todos los archivos CSS globales y de cada sección

---

## 1. FIX TOOLTIP DONA — TEXTO SOBREPUESTO

El tooltip del PieChart se sobrepone al label central de la dona.
Dos fixes necesarios:

**A) Quitar el label central cuando hay hover activo:**
```jsx
// En el PieChart, usar estado para controlar si hay segmento activo
const [activeIndex, setActiveIndex] = useState(null)

<Pie
  onMouseEnter={(_, index) => setActiveIndex(index)}
  onMouseLeave={() => setActiveIndex(null)}
  ...
>
  <Label
    content={() => activeIndex !== null ? null : (
      
        
          ${total.toLocaleString('es-MX', {minimumFractionDigits:2})}
        
        100%
      
    )}
  />

```

**B) Posicionar tooltip fuera de la dona:**
```jsx

```

---

## 2. OPTIMIZACIÓN MOBILE COMPLETA

### Breakpoints a usar:
- Mobile: < 768px
- Tablet: 768px - 1024px  
- Desktop: > 1024px

### A) Layout general — sidebar en mobile
En mobile el sidebar debe estar oculto por defecto con un botón hamburguesa.
Si ya existe esta lógica, verificar que funciona correctamente.
Si no existe, agregar:

```css
/* Mobile: sidebar oculto */
@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: -100%;
    top: 0;
    height: 100vh;
    z-index: 1000;
    transition: left 0.3s ease;
  }
  .sidebar.open {
    left: 0;
  }
  .main-content {
    margin-left: 0 !important;
    padding: 16px !important;
  }
}
```

### B) Cards de métricas — stack vertical en mobile
```css
@media (max-width: 768px) {
  /* Cards de totales (ingresos, egresos, neto) */
  .metrics-grid,
  .cards-row,
  [class*="grid-cols-3"],
  [class*="grid-cols-2"] {
    grid-template-columns: 1fr !important;
  }
  
  /* Cards individuales */
  .metric-card,
  .summary-card {
    width: 100% !important;
  }
}
```

### C) Gráfica de dona — layout vertical en mobile
```css
@media (max-width: 768px) {
  /* El layout dona+leyenda pasa de horizontal a vertical */
  .gastos-categoria-container,
  .donut-layout {
    flex-direction: column !important;
    align-items: center !important;
  }
  
  /* La dona ocupa todo el ancho */
  .donut-chart-wrapper {
    width: 100% !important;
    display: flex;
    justify-content: center;
  }
  
  /* La leyenda debajo */
  .donut-legend {
    width: 100% !important;
    margin-top: 16px;
  }
}
```

### D) Tabla de transacciones — scroll horizontal en mobile
```css
@media (max-width: 768px) {
  .transactions-table-wrapper,
  .table-container {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  
  table {
    min-width: 600px;
  }
}
```

### E) Tipografía y espaciado en mobile
```css
@media (max-width: 768px) {
  /* Reducir tamaños de fuente en métricas grandes */
  .metric-value,
  .total-amount {
    font-size: 1.5rem !important;
  }
  
  /* Padding de página */
  .page-container {
    padding: 12px !important;
  }
  
  /* Selector de período — scroll horizontal si no caben */
  .periodo-selector {
    overflow-x: auto;
    white-space: nowrap;
    padding-bottom: 4px;
  }
}
```

### F) Portfolio Health — tabla de activos en mobile
```css
@media (max-width: 768px) {
  /* Ocultar columnas menos importantes */
  .portfolio-table .col-cost-basis,
  .portfolio-table .col-date {
    display: none;
  }
}
```

### G) Dashboard — cards de resumen en mobile
```css
@media (max-width: 768px) {
  .dashboard-summary-grid {
    grid-template-columns: 1fr !important;
    gap: 12px !important;
  }
  
  .dashboard-card {
    padding: 16px !important;
  }
}
```

---

## 3. META VIEWPORT — verificar que existe

En src/app/layout.js verificar que el metadata incluye viewport:
```js
export const metadata = {
  // ...existing
  viewport: 'width=device-width, initial-scale=1',
}
```

O si usa el nuevo formato de Next.js 15:
```js
export const viewport = {
  width: 'device-width',
  initialScale: 1,
}
```

---

## Notas
- Mantener dark theme en todos los breakpoints.
- No romper layout desktop al agregar estilos mobile.
- Usar clases CSS específicas, no inline styles, para los overrides mobile.
- Probar en viewport 375px (iPhone SE), 390px (iPhone 14), 768px (iPad).