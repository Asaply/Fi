# Finanzas: Tipo de transacción + Importar PDF

Lee estos archivos antes de cambiar nada:
- src/app/finanzas/page.js (o .tsx)
- El componente del modal de nueva transacción (busca "Registrar Nuevo Ingreso" o "NuevaTransaccion")
- El handler de "Importar CSV"
- El esquema de transacciones en Supabase (busca el tipo/enum del campo tipo)

## CAMBIO 1 — TIPO EN NUEVA TRANSACCIÓN

1. Cambiar título del modal a "Nueva Transacción"
2. Agregar campo "Tipo" como primer campo del form, con botones toggle visuales:
   - Ingreso → verde (#22c55e)
   - Egreso → rojo (#ef4444)
   - Inversión → azul (#3b82f6)
   - Por Cobrar → naranja (#f97316)
   Mismos colores que los tabs de la página.
3. Al guardar, persistir el tipo seleccionado en Supabase.
4. Si el campo tipo en Supabase tiene constraint que incluye "gasto_personal",
   actualizar registros existentes: "gasto_personal" → "egreso",
   luego eliminar "gasto_personal" del constraint/enum.
5. Eliminar el tab/filtro "Gasto Personal" de la página.
   Los registros con ese tipo deben aparecer bajo "Egreso".

## CAMBIO 2 — IMPORTAR PDF EN VEZ DE CSV

1. Renombrar el botón a "Importar Estado de Cuenta"
2. Aceptar archivos .pdf (mantener .csv como fallback si ya funciona)
3. Crear API route: src/app/api/parse-statement/route.js
   - Recibe el archivo como FormData (campo "file")
   - Instalar: npm install pdfjs-dist
   - Usar pdfjs-dist para extraer texto del PDF

4. Lógica de parsing para bancos mexicanos:
   Buscar líneas con:
   - Fecha: dd/mm/yyyy o dd-MMM-YYYY (ABR, ENE, FEB, MAR, etc.)
   - Monto: número con comas (1,500.00) — negativo = cargo, positivo = abono
   - Palabras clave de cargo: "CARGO", "RETIRO", "DÉBITO", "COMPRA", "PAGO"
   - Palabras clave de abono: "ABONO", "DEPÓSITO", "TRANSFERENCIA RECIBIDA"
   Retornar: [{ fecha, concepto, monto, tipo: "ingreso"|"egreso" }]

5. Frontend — vista previa antes de importar:
   - Tabla con las transacciones detectadas
   - Cada fila permite cambiar el tipo manualmente
   - Botón "Confirmar importación" guarda todo en Supabase
   - Toast: "X transacciones importadas"

6. Import en el API route:
   import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
   pdfjsLib.GlobalWorkerOptions.workerSrc = ''

Muéstrame los archivos clave antes de cambiar nada. Luego implementa ambos cambios en orden.