
```markdown
# Fix: Parser específico para estado de cuenta Nu (y formato similar)

## PROBLEMA
El parser actual solo detecta 2 transacciones porque los patrones regex
no coinciden con el formato real del PDF de Nu México.

## FORMATO REAL DEL PDF DE NU
Las transacciones vienen así en el texto extraído:
```

30 MAR 2026 Blanca Cardenas Airbnb -$1,000.00 28 MAR 2026 REST HECHO CON AMOR Compra -$185.00 28 MAR 2026 ABRAHAM PEREZ PENA hospedaje +$1,300.00 27 MAR 2026 GASOL RELIZ Compra -$500.00

````

Patrón de fecha: `DD MMM YYYY` donde MMM es ENE, FEB, MAR, ABR, MAY, JUN,
JUL, AGO, SEP, OCT, NOV, DIC (en mayúsculas o mixto).

Patrón de monto: `+$X,XXX.XX` o `-$X,XXX.XX` al final de la línea de título.
El signo `+` = ingreso, signo `-` = egreso.

Cada transacción tiene:
- Línea principal: FECHA | CONCEPTO | MONTO (con + o -)
- Líneas de detalle opcionales debajo (ignorar para el parsing)

## REESCRIBIR EL PARSER COMPLETO

Reemplazar la función de parsing en src/app/api/parse-statement/route.js
con esta lógica:

```js
const MESES = {
  'ENE': '01', 'FEB': '02', 'MAR': '03', 'ABR': '04',
  'MAY': '05', 'JUN': '06', 'JUL': '07', 'AGO': '08',
  'SEP': '09', 'OCT': '10', 'NOV': '11', 'DIC': '12'
}

// Regex para línea principal de transacción Nu:
// "30 MAR 2026 Blanca Cardenas Airbnb -$1,000.00"
const REGEX_LINEA = /^(\d{1,2})\s+(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)\s+(\d{4})\s+(.+?)\s+([+\-]\$[\d,]+\.\d{2})$/i

function parsearNu(texto) {
  const lineas = texto.split('\n').map(l => l.trim()).filter(Boolean)
  const transacciones = []

  for (const linea of lineas) {
    const match = linea.match(REGEX_LINEA)
    if (!match) continue

    const [, dia, mes, anio, concepto, montoStr] = match
    const mes2 = MESES[mes.toUpperCase()]
    const fecha = `${anio}-${mes2}-${dia.padStart(2, '0')}`
    const monto = parseFloat(montoStr.replace(/[$,]/g, ''))
    const tipo = monto >= 0 ? 'ingreso' : 'egreso'
    const montoAbs = Math.abs(monto)

    // Ignorar movimientos internos de cajitas (son transferencias internas Nu)
    if (/cajita/i.test(concepto)) continue

    transacciones.push({
      fecha,
      concepto: concepto.trim(),
      monto: montoAbs,
      tipo,
      categoria: categorizarNu(concepto)
    })
  }

  return transacciones
}

function categorizarNu(concepto) {
  const t = concepto.toLowerCase()

  if (/netflix|spotify|disney|hbo|apple|youtube|openai|claude|netlify|porkbun|vercel/i.test(t))
    return 'Suscripciones'
  if (/oxxo|walmart|chedraui|soriana|costco|alsuper|seven|super/i.test(t))
    return 'Supermercado'
  if (/restaur|rest |taqueria|paleteria|little caesar|wendys|mcdonalds|burger|pizza|comida|hambur/i.test(t))
    return 'Comida'
  if (/gasol|gasolinera|pemex|autozone|estacionamiento|caseta/i.test(t))
    return 'Transporte'
  if (/telmex|telcel|att|izzi|totalplay|cfe|gas natural|predial/i.test(t))
    return 'Servicios'
  if (/farmacia|benavides|doctor|hospital|laboratorio|similares/i.test(t))
    return 'Salud'
  if (/barbershop|salon|spa|peluqueria/i.test(t))
    return 'Higiene'
  if (/cine|teatro|bar |antro|steam|juego/i.test(t))
    return 'Ocio'
  if (/office depot|papeleria|libreria/i.test(t))
    return 'Papelería'
  if (/airbnb|hospedaje|hosedaje|hotel/i.test(t))
    return 'Airbnb / Hospedaje'
  if (/spei|transferencia|deposito|depósito|pago a|envio/i.test(t))
    return 'Transferencias'

  return 'Otros'
}
```

## RESULTADO ESPERADO CON EL PDF DE MARZO 2026

El parser debe detectar aproximadamente 40-50 transacciones incluyendo:
- Egresos: REST HECHO CON AMOR, OXXO JERONIMO, LITTLE CAESAR, GASOL RELIZ,
  ALSUPER, BARBERSHOP, NETLIFY, OPENAI, PORKBUN.COM, AUTOZONE, etc.
- Ingresos: ABRAHAM PEREZ PENA hospedaje (múltiples),
  BLANCA ESTELA CARDENAS RODRIGUEZ (múltiples transferencias)
- Ignorar: "Retiro de Cajita" y "Depósito en Cajita" (son movimientos internos)

## TAMBIÉN VERIFICAR

1. Que el modal de vista previa muestre TODAS las transacciones con scroll
   (actualmente puede estar limitando la vista)
2. Que la columna "Concepto" no se corte — usar text-overflow o truncate con tooltip
3. Que el botón "Importar X transacciones" refleje el número real detectado

Muéstrame el route actual antes de cambiar nada. Luego aplica el fix.
````