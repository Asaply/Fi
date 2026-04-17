# fix-urgente-categoria-csv.md

## Problema
La importación de estado de cuenta falla con:
`"Could not find the 'categoria' column of 'transactions' in the schema cache"`

La columna `categoria` fue agregada al código pero NO existe en la tabla de Supabase todavía.
El nombre real de la tabla en Supabase es `transactions` (no `transacciones`).

---

## Fix 1: Quitar `categoria` del payload de importación (fix inmediato)

Mientras no exista la columna en Supabase, el código NO debe enviar el campo `categoria` al insertar.

En `src/app/finanzas/page.tsx`, buscar la función `handleConfirmImport` y el lugar donde se construye el payload antes del insert.

Encontrar donde se arma el objeto a insertar y asegurarse de que `categoria` NO se incluye en el insert a Supabase hasta que la columna exista:

```typescript
// En handleConfirmImport, al construir el payload para el insert:
const payload = transaccionesParseadas.map(t => ({
  fecha: t.fecha,
  concepto: t.concepto || t.descripcion || 'Sin descripción',
  monto: Number(t.monto) || 0,
  tipo: t.tipo || 'Egreso',
  user_id: user.id,
  // NO incluir 'categoria' aquí — columna no existe en Supabase aún
}))
```

Buscar cualquier referencia a `categoria` en el flujo de importación y comentarla temporalmente:
```typescript
// categoria: t.categoria,  // <- comentar hasta crear la columna en Supabase
```

---

## Fix 2: Agregar columna categoria en Supabase

Ejecutar este SQL en Supabase Dashboard → SQL Editor:

```sql
-- La tabla real se llama 'transactions' (verificar nombre exacto primero)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS categoria text DEFAULT 'Otros';
```

Si la tabla se llama diferente, verificar con:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Después de ejecutar el SQL, ir a Supabase → Settings → API → y hacer click en **"Reload schema"** (o esperar unos minutos para que se actualice el schema cache).

---

## Fix 3: Hacer el parser CSV más robusto

El parser actual falla con estados de cuenta reales. Reemplazar completamente la lógica de parsing en `src/app/finanzas/page.tsx` o en `src/lib/csvParser.ts` (donde esté).

La nueva función debe:

```typescript
export function parseCSVBancario(csvText: string) {
  // Limpiar BOM y caracteres extraños
  const clean = csvText.replace(/^\uFEFF/, '').trim()
  const lines = clean.split(/\r?\n/).filter(l => l.trim())
  
  if (lines.length < 2) throw new Error('Archivo CSV vacío o inválido')
  
  // Detectar separador automáticamente
  const sep = lines[0].includes(';') ? ';' : ','
  
  // Parsear headers — normalizar a minúsculas sin espacios extras ni comillas
  const rawHeaders = lines[0].split(sep).map(h => 
    h.trim().toLowerCase().replace(/['"]/g, '').replace(/\s+/g, ' ')
  )
  
  const resultados = []
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    
    // Manejar valores con comas dentro de comillas
    const cols: string[] = []
    let inQuotes = false
    let current = ''
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes }
      else if (char === sep && !inQuotes) { cols.push(current.trim()); current = '' }
      else { current += char }
    }
    cols.push(current.trim())
    
    const row: Record<string, string> = {}
    rawHeaders.forEach((h, idx) => { row[h] = (cols[idx] || '').replace(/['"]/g, '').trim() })
    
    // Mapear campos — buscar por múltiples nombres posibles
    const fecha = row['fecha'] || row['date'] || row['fecha operacion'] || row['fecha valor'] || ''
    const concepto = row['concepto'] || row['descripcion'] || row['description'] || 
                     row['referencia'] || row['detalle'] || row['movimiento'] || ''
    
    // Monto: puede estar en columna cargo/abono separadas o en una sola columna monto
    const cargoRaw = row['cargo'] || row['retiro'] || row['debito'] || row['cargos'] || ''
    const abonoRaw = row['abono'] || row['deposito'] || row['credito'] || row['depositos'] || ''
    const montoRaw = row['monto'] || row['importe'] || row['amount'] || ''
    
    const parseMonto = (s: string) => Math.abs(parseFloat(s.replace(/[$,\s]/g, '')) || 0)
    
    const cargo = parseMonto(cargoRaw)
    const abono = parseMonto(abonoRaw)
    const montoDirecto = parseMonto(montoRaw)
    
    let monto = 0
    let tipo = 'Egreso'
    
    if (cargo > 0) { monto = cargo; tipo = 'Egreso' }
    else if (abono > 0) { monto = abono; tipo = 'Ingreso' }
    else if (montoDirecto > 0) {
      // Si hay una sola columna monto, determinar tipo por signo o por columna adicional
      const tipoRaw = (row['tipo'] || row['type'] || '').toLowerCase()
      if (tipoRaw.includes('abono') || tipoRaw.includes('deposito') || tipoRaw.includes('credito')) {
        tipo = 'Ingreso'
      }
      monto = montoDirecto
    }
    
    if (monto === 0) continue // Saltar filas sin monto
    
    // Normalizar fecha a YYYY-MM-DD
    let fechaNorm = ''
    if (fecha) {
      const partes = fecha.split(/[\/\-\.]/)
      if (partes.length === 3) {
        if (partes[0].length === 4) {
          // YYYY-MM-DD
          fechaNorm = `${partes[0]}-${partes[1].padStart(2,'0')}-${partes[2].padStart(2,'0')}`
        } else {
          // DD/MM/YYYY (formato mexicano)
          fechaNorm = `${partes[2]}-${partes[1].padStart(2,'0')}-${partes[0].padStart(2,'0')}`
        }
      }
    }
    if (!fechaNorm) fechaNorm = new Date().toISOString().split('T')[0]
    
    resultados.push({
      fecha: fechaNorm,
      concepto: concepto || 'Sin descripción',
      monto,
      tipo,
    })
  }
  
  if (resultados.length === 0) throw new Error('No se encontraron transacciones válidas en el archivo')
  
  return resultados
}
```

---

## Fix 4: Quitar botón "Registrar Egreso" del Dashboard

En `src/app/dashboard/page.tsx`, buscar y eliminar:
- El botón `+ Registrar Egreso` del header del dashboard
- El estado `modalEgresoOpen` y `nuevoEgreso` si solo se usaban para ese botón
- El modal de egreso rápido

El registro de egresos debe hacerse desde la sección Finanzas, no desde el Dashboard.

---

## Orden de ejecución
1. Primero ejecutar el SQL en Supabase Dashboard para agregar la columna `categoria`
2. Hacer Reload schema en Supabase → Settings → API
3. Luego ejecutar este prompt en Claude Code

## Archivos a modificar
- `src/app/finanzas/page.tsx` — fix payload import + parser CSV
- `src/lib/csvParser.ts` — si existe, reemplazar función de parsing
- `src/app/dashboard/page.tsx` — eliminar botón y modal de egreso rápido
