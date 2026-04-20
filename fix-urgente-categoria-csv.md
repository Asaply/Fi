# FNCE — fix-urgente-categoria-csv.md

## Target files
- `src/app/api/import-csv/route.ts` (o donde esté el parser CSV)
- `src/lib/csv-parser.ts` (si existe)
- `src/app/finanzas/components/ImportCSV.tsx` (o equivalente)
- `src/app/dashboard/page.tsx`

## Problema 1: CSV import no asigna categoría
Al importar CSV de BBVA/Banorte/Santander, las transacciones se crean sin `categoria`.
La columna `categoria` ya existe en la tabla `transactions` — no recrear.

### Fix
En el parser CSV, después de mapear cada fila, agregar lógica de auto-categorización por descripción:

```ts
function inferCategoria(descripcion: string): string {
  const d = descripcion.toLowerCase()
  if (d.includes('oxxo') || d.includes('walmart') || d.includes('chedraui') || d.includes('soriana')) return 'Supermercado'
  if (d.includes('uber') || d.includes('didi') || d.includes('cabify')) return 'Transporte'
  if (d.includes('netflix') || d.includes('spotify') || d.includes('disney') || d.includes('apple')) return 'Suscripciones'
  if (d.includes('restaurante') || d.includes('taqueria') || d.includes('pizza') || d.includes('burger')) return 'Restaurantes'
  if (d.includes('gasolinera') || d.includes('pemex') || d.includes('bp ') || d.includes('shell')) return 'Gasolina'
  if (d.includes('farmacia') || d.includes('hospital') || d.includes('clinica') || d.includes('doctor')) return 'Salud'
  if (d.includes('transferencia') || d.includes('spei') || d.includes('envio')) return 'Transferencias'
  if (d.includes('nomina') || d.includes('sueldo') || d.includes('pago de ')) return 'Ingreso'
  return 'Otros'
}
```

Aplicar `inferCategoria(row.descripcion)` al campo `categoria` antes del INSERT.

Asegurarse que el INSERT incluye `user_id` del usuario autenticado:
```ts
// Obtener user_id del request auth
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

// Incluir en cada row del CSV
{ ...parsedRow, user_id: user.id, categoria: inferCategoria(parsedRow.descripcion) }
```

## Problema 2: Botón de egreso rápido en Dashboard
Si existe un botón o acceso rápido de "Nuevo Egreso" en el Dashboard, eliminarlo.
El Dashboard es solo lectura — no debe tener acciones de creación.
Las acciones van en `/finanzas` (Nueva Transacción) y `/trading` (Nuevo Trade).

Buscar en `src/app/dashboard/page.tsx` cualquier botón con texto que incluya "Egreso", "Gasto" o "Nueva" y eliminarlo.

## Notas
- No cambiar el diseño del formulario de importación
- No modificar el schema de la tabla
- El campo `categoria` debe llegar como string, no como array
