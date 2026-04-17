# fix-finanzas-import-categorias.md

## Objetivo
1. Fix error al importar estado de cuenta CSV
2. Agregar campo "categoría" al formulario de nueva transacción
3. Categorizar automáticamente transacciones por descripción (restaurantes, comida, transporte, etc.)
4. Quitar el botón "+ Nuevo" del header principal (es confuso, cada sección tiene su propio botón)

---

## Fix 1: Error al importar estado de cuenta

### El problema
El error viene de `src/app/finanzas/page.js` línea 269 — el catch está recibiendo un objeto vacío `{}`. Esto significa que el insert a Supabase está fallando silenciosamente o el CSV no tiene el formato esperado.

### Diagnóstico y fix

En `src/app/finanzas/page.tsx` (o page.js), buscar la función `handleConfirmImport` y agregar logging detallado:

```typescript
async function handleConfirmImport(transacciones: any[]) {
  setIsImporting(true)
  try {
    // Agregar user_id a cada transacción antes de insertar
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) throw new Error('No hay sesión activa')
    
    const transaccionesConUser = transacciones.map(t => ({
      ...t,
      user_id: user.id,
      // Asegurarse que los campos obligatorios existen
      fecha: t.fecha || new Date().toISOString().split('T')[0],
      monto: Number(t.monto) || 0,
      tipo: t.tipo || 'Egreso',
      concepto: t.concepto || t.descripcion || 'Sin descripción',
    }))
    
    const { data, error } = await supabase
      .from('transacciones')
      .insert(transaccionesConUser)
    
    if (error) {
      console.error('Supabase error:', JSON.stringify(error, null, 2))
      throw error
    }
    
    await fetchData()
    setImportResult({ ok: true, count: transaccionesConUser.length })
  } catch (e) {
    console.error('Import error completo:', e)
    console.error('Tipo:', typeof e)
    console.error('Keys:', Object.keys(e as any))
    setImportResult({ ok: false, count: 0 })
  } finally {
    setIsImporting(false)
  }
}
```

### Fix del parser CSV
Buscar la función que parsea el CSV (probablemente en `src/lib/csvParser.ts` o dentro de la misma page). El parser debe ser robusto ante diferentes formatos de bancos mexicanos (BBVA, Banorte, Santander).

Reemplazar o actualizar el parser:

```typescript
export function parseCSVBancario(csvText: string): TransaccionImport[] {
  const lines = csvText.split('\n').filter(l => l.trim())
  
  // Detectar el separador (coma o punto y coma)
  const separator = lines[0].includes(';') ? ';' : ','
  
  // Buscar la línea de headers (primera línea con más de 2 columnas)
  const headerLine = lines.find(l => l.split(separator).length >= 3)
  if (!headerLine) throw new Error('CSV sin headers válidos')
  
  const headers = headerLine.split(separator).map(h => 
    h.trim().toLowerCase().replace(/['"]/g, '')
  )
  
  const headerIndex = lines.indexOf(headerLine)
  const dataLines = lines.slice(headerIndex + 1).filter(l => l.trim())
  
  return dataLines.map(line => {
    const cols = line.split(separator).map(c => c.trim().replace(/['"]/g, ''))
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = cols[i] || '' })
    
    // Mapear campos comunes de bancos mexicanos
    const fecha = row['fecha'] || row['date'] || row['fecha operacion'] || ''
    const concepto = row['concepto'] || row['descripcion'] || row['description'] || row['referencia'] || ''
    const cargoStr = row['cargo'] || row['retiro'] || row['debito'] || row['monto'] || '0'
    const abonoStr = row['abono'] || row['deposito'] || row['credito'] || '0'
    
    const cargo = parseFloat(cargoStr.replace(/[$,]/g, '')) || 0
    const abono = parseFloat(abonoStr.replace(/[$,]/g, '')) || 0
    
    const monto = cargo > 0 ? cargo : abono
    const tipo = cargo > 0 ? 'Egreso' : 'Ingreso'
    
    return {
      fecha: normalizarFecha(fecha),
      concepto: concepto || 'Sin descripción',
      monto,
      tipo,
      categoria: inferirCategoria(concepto),
    }
  }).filter(t => t.monto > 0 && t.fecha)
}

function normalizarFecha(fecha: string): string {
  // Manejar formatos: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD
  if (!fecha) return new Date().toISOString().split('T')[0]
  
  const partes = fecha.split(/[\/\-]/)
  if (partes.length !== 3) return new Date().toISOString().split('T')[0]
  
  // Si el año está primero (YYYY-MM-DD)
  if (partes[0].length === 4) return `${partes[0]}-${partes[1].padStart(2,'0')}-${partes[2].padStart(2,'0')}`
  
  // Asumir DD/MM/YYYY (formato mexicano)
  return `${partes[2]}-${partes[1].padStart(2,'0')}-${partes[0].padStart(2,'0')}`
}
```

---

## Fix 2: Campo categoría en formulario de nueva transacción

### Agregar campo categoría al schema de Supabase
Si la tabla `transacciones` no tiene columna `categoria`, agregarla en Supabase:
```sql
ALTER TABLE transacciones ADD COLUMN IF NOT EXISTS categoria text DEFAULT 'Otros';
```

### Actualizar formulario en `src/app/finanzas/page.tsx`
Agregar campo categoría al modal de nueva transacción. Las categorías dependen del tipo:

```typescript
const CATEGORIAS_EGRESO = [
  'Restaurantes',
  'Comida y Abarrotes', 
  'Transporte',
  'Suscripciones',
  'Transferencias',
  'Salud',
  'Entretenimiento',
  'Ropa y Accesorios',
  'Servicios (luz, agua, internet)',
  'Educación',
  'Otros',
]

const CATEGORIAS_INGRESO = [
  'Sueldo',
  'Freelance',
  'Transferencia recibida',
  'Inversión',
  'Venta',
  'Otros',
]
```

En el form del modal, agregar después del campo "Concepto":
```tsx
<div>
  <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">Categoría</label>
  <select
    value={formData.categoria}
    onChange={e => setFormData(prev => ({ ...prev, categoria: e.target.value }))}
    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-lg px-4 py-3 text-sm outline-none focus:border-blue-500"
  >
    {(formData.tipo === 'Egreso' || formData.tipo === 'Gasto Personal' 
      ? CATEGORIAS_EGRESO 
      : CATEGORIAS_INGRESO
    ).map(cat => (
      <option key={cat} value={cat}>{cat}</option>
    ))}
  </select>
</div>
```

---

## Fix 3: inferirCategoria para importación CSV

Crear o actualizar `src/lib/categorias.ts`:

```typescript
export function inferirCategoria(concepto: string): string {
  const texto = concepto.toLowerCase()
  
  const reglas: [string[], string][] = [
    [['restaurante', 'restaurant', 'mcdonalds', 'burger', 'pizza', 'sushi', 'taco', 'subway', 'kfc', 'dominos', 'starbucks', 'cafe', 'coffee', 'oxxo comida'], 'Restaurantes'],
    [['walmart', 'chedraui', 'soriana', 'costco', 'superama', 'la comer', 'mercado', 'abarrotes', 'bodega', 'sam\'s'], 'Comida y Abarrotes'],
    [['uber', 'didi', 'cabify', 'taxi', 'gasolina', 'pemex', 'estacionamiento', 'caseta', 'metro', 'autobus', 'camion'], 'Transporte'],
    [['netflix', 'spotify', 'amazon prime', 'disney', 'apple', 'youtube premium', 'suscripcion', 'subscription', 'membresía'], 'Suscripciones'],
    [['transferencia', 'spei', 'transfer', 'envio', 'pago a'], 'Transferencias'],
    [['farmacia', 'medico', 'doctor', 'hospital', 'clinica', 'benavides', 'guadalajara', 'cruz verde'], 'Salud'],
    [['cinepolis', 'cinemex', 'teatro', 'concierto', 'evento', 'entretenimiento', 'bar', 'antro'], 'Entretenimiento'],
    [['zara', 'h&m', 'liverpool', 'palacio', 'ropa', 'zapatos', 'moda'], 'Ropa y Accesorios'],
    [['telmex', 'telcel', 'att', 'movistar', 'izzi', 'megacable', 'cfe', 'agua', 'gas', 'internet', 'telefono'], 'Servicios (luz, agua, internet)'],
    [['colegio', 'universidad', 'escuela', 'colegiatura', 'libro', 'curso', 'udemy', 'platzi'], 'Educación'],
  ]
  
  for (const [palabras, categoria] of reglas) {
    if (palabras.some(p => texto.includes(p))) return categoria
  }
  
  return 'Otros'
}
```

---

## Fix 4: Quitar botón "+ Nuevo" del header global

El botón "+ Nuevo" en el header superior es confuso porque cada sección ya tiene su propio botón de acción ("+Nueva Transacción", "+Nuevo Trade", "+Agregar Activo").

En `src/components/layout/Header.tsx` (o donde esté el header), buscar y eliminar el botón "+ Nuevo":

```tsx
// ELIMINAR este botón del header:
// <button className="...">+ Nuevo</button>
```

El header debe quedar solo con el nombre de la sección y el avatar del usuario.

---

## Archivos a crear/modificar
- `src/lib/categorias.ts` — crear
- `src/lib/csvParser.ts` — actualizar con parser robusto
- `src/app/finanzas/page.tsx` — campo categoría en form, fix handleConfirmImport
- `src/components/layout/Header.tsx` — eliminar botón "+ Nuevo"

## SQL a ejecutar en Supabase
```sql
ALTER TABLE transacciones ADD COLUMN IF NOT EXISTS categoria text DEFAULT 'Otros';
```
