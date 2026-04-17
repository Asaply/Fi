````markdown
# Fix: Importar PDF + Categorización inteligente de gastos

## PROBLEMA ACTUAL
El modal "Importar Estado de Cuenta" da error al procesar el PDF.
Hay que arreglar el parser y agregar categorización automática de gastos.

---

## PASO 1 — DIAGNOSTICAR Y ARREGLAR EL ERROR

Lee estos archivos:
- src/app/api/parse-statement/route.js (o route.ts)
- El componente del modal de importación en el frontend
- Los logs del servidor al momento del error

Revisa:
1. Si pdfjs-dist está instalado correctamente (package.json)
2. Si el API route recibe el archivo correctamente desde FormData
3. Si hay errores de importación de pdfjs-dist en entorno Next.js App Router
   (común: pdfjs-dist necesita configuración especial en Next.js 15)

Fix para Next.js 15 App Router — en el API route usar:
```js
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
// NO usar workerSrc en entorno Node.js server-side, simplemente omitirlo
// o configurar: GlobalWorkerOptions.workerSrc = false
```

Si pdfjs-dist sigue dando problemas en el servidor, cambiar a `pdf-parse`:
````

npm install pdf-parse import pdfParse from 'pdf-parse' const data = await pdfParse(buffer) const text = data.text

````

---

## PASO 2 — CATEGORIZACIÓN AUTOMÁTICA DE GASTOS

Después de extraer el texto del PDF, clasificar cada transacción automáticamente
según palabras clave en la descripción/concepto:

```js
const CATEGORIAS = {
  'Suscripciones':  ['netflix', 'spotify', 'disney', 'amazon prime', 'apple', 'hbo', 'youtube', 'openai', 'claude'],
  'Comida':         ['oxxo', 'walmart', 'chedraui', 'soriana', 'costco', 'restaurante', 'mcdonalds', 'starbucks', 'uber eats', 'rappi', 'didi food', 'dominos', 'pizza'],
  'Transporte':     ['uber', 'didi', 'cabify', 'gasolina', 'pemex', 'estacionamiento', 'caseta', 'autobus'],
  'Servicios':      ['telmex', 'telcel', 'att', 'izzi', 'totalplay', 'cfe', 'gas natural', 'agua', 'predial'],
  'Salud':          ['farmacia', 'benavides', 'guadalajara', 'doctor', 'hospital', 'clinica', 'laboratorio', 'similares'],
  'Higiene':        ['higiene', 'perfumeria', 'drogueria', 'salon', 'peluqueria', 'spa'],
  'Ocio':           ['cine', 'cinepolis', 'cinemex', 'teatro', 'concierto', 'bar', 'antro', 'videojuego', 'steam'],
  'Ropa':           ['zara', 'h&m', 'liverpool', 'palacio', 'suburbia', 'shein', 'ropa', 'zapatos'],
  'Educación':      ['udemy', 'coursera', 'escuela', 'colegio', 'universidad', 'libros'],
  'Transferencias': ['spei', 'transferencia', 'envio', 'pago a'],
  'Otros':          [] // fallback
}

function categorizarTransaccion(concepto) {
  const texto = concepto.toLowerCase()
  for (const [categoria, keywords] of Object.entries(CATEGORIAS)) {
    if (keywords.some(k => texto.includes(k))) return categoria
  }
  return 'Otros'
}
```

Agregar el campo `categoria` a cada transacción parseada:
`{ fecha, concepto, monto, tipo, categoria }`

---

## PASO 3 — VISTA PREVIA MEJORADA ANTES DE IMPORTAR

En el modal de vista previa mostrar:
1. Tabla con columnas: Fecha | Concepto | Monto | Tipo | Categoría
2. La categoría debe ser editable (dropdown) por si la detección automática falla
3. Resumen en la parte superior del modal:
   - Total ingresos detectados
   - Total egresos detectados
   - Número de transacciones

---

## PASO 4 — SECCIÓN DE ANÁLISIS DE GASTOS

Después de importar, en la página /finanzas agregar una nueva sección
debajo de las cards actuales llamada "Análisis de Gastos".

Mostrar:
1. GRÁFICA DE DONA (Chart.js o Recharts)
   - Distribución de egresos por categoría en %
   - Cada categoría con su color único
   - Leyenda con nombre + monto + porcentaje

2. TABLA DE CATEGORÍAS
   Columnas: Categoría | Gasto Total | % del Total | # Transacciones
   - Ordenada de mayor a menor gasto
   - Barra de progreso visual por fila (ancho = % del total)

3. REPORTE RESUMEN (card al fondo)
   Mostrar texto generado dinámicamente:
   - "Este mes gastaste $X en total"
   - "Tu mayor gasto fue en [Categoría] con $X ([%]%)"
   - "Tus ingresos fueron $X, tus egresos $X — [ahorraste / tuviste déficit de] $X"
   - Top 3 categorías de gasto

---

## PASO 5 — GUARDAR CATEGORÍA EN SUPABASE

En la tabla de transacciones en Supabase, agregar columna `categoria` (text).
Al confirmar la importación, guardar el campo categoria junto con cada transacción.
Si la columna no existe, crearla con:
ALTER TABLE transacciones ADD COLUMN IF NOT EXISTS categoria text DEFAULT 'Otros';

---

Muéstrame los archivos del API route y del modal antes de cambiar nada.
Luego implementa todo en orden: fix del error → categorización → vista previa → sección de análisis.
````