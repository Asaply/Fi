# LayoutSchema v1

Un layout describe **cómo leer un formato de estado de cuenta** como datos, no
como código. El motor lo interpreta. Un layout NO es un banco: un banco puede
tener varios layouts (débito, crédito, empresarial).

## Estructura raíz

```jsonc
{
  "schemaVersion": 1,                // versión del SCHEMA (no del layout). Permite migrar
                                     //   la biblioteca cuando el formato de reglas cambie.
  "id": "inbursa-debito",           // slug estable
  "version": 1,                      // versión del LAYOUT; sube ante deriva de formato
  "maturity": "curated",             // provisional | trusted | curated
  "validationCount": 12,             // nº de estados independientes que reconciliaron
  "bank": "Inbursa",                 // etiqueta informativa (NO decide el dispatch)
  "tipo_cuenta": "debito",           // debito | credito

  "supports": {                      // CAPABILITIES: qué sabe hacer el layout.
                                     //   El motor deja de INFERIR y sabe qué validar/esperar.
    "debit": true, "credit": false,
    "runningBalance": true,          // ¿hay columna de SALDO corrido a ignorar?
    "declaredTotals": true,          // ¿declara total_cargos/abonos? (define régimen)
    "movementCount": false,          // ¿declara nº de movimientos? (habilita countMatch)
    "foreignCurrency": false,        // ¿hay líneas de moneda extranjera a ignorar?
    "multilineConcept": true         // ¿el concepto abarca varias líneas?
  },

  "detect": {                        // → fingerprint (ver §Fingerprint)
    "keywords": ["INBURSA", "DETALLE DE MOVIMIENTOS", "SALDO ANTERIOR"],
    "keywordsAll": true,             // true = deben aparecer todas
    "excludeKeywords": []            // si aparece alguna, NO es este layout
  },

  "date": { ... },                   // cómo leer la fecha de cada fila
  "concept": { ... },                // banda de texto del concepto
  "strategy": "columnBands",         // columnBands | signedSingleColumn | multilineBuffer
  "amount": { ... },                 // depende de strategy
  "totals": { ... },                 // regex para los totales declarados (reconciliación)
  "skipRows": ["BALANCE INICIAL"],   // conceptos que NO son movimiento
  "flatHeaderForTotals": false       // true si el header viene con glifos espaciados (Scotia)
}
```

## `date`

```jsonc
"date": {
  "colXMax": 40,          // la fecha vive en la primera celda con x < colXMax
  "format": "MMM_DD",     // ver formatos abajo
  "yearFrom": "period",   // "period" = tomar el año del periodo del documento
  "yearRegex": "al\\s+\\d{1,2}\\s+[A-Za-z]{3}\\s+(\\d{4})"  // opcional, override
}
```

Formatos soportados (mapeados a helpers deterministas existentes):

| format | ejemplo | banco |
|--------|---------|-------|
| `DD_SLASH_MMM` | `05/MAR` | BBVA débito |
| `MMM_DD` | `MAY 01` | Inbursa |
| `DD_MMM_YYYY` | `30 MAR 2026` | Nu |
| `DD_DASH_MMM_YYYY` | `08-abr-2026` | BBVA crédito |
| `DAY_PLUS_MONTHCELL` | `20` + celda `MAY` | Scotia, Banamex |

Con periodos que cruzan año (dic→ene) el motor usa `startMonth/startYear` del
periodo para desambiguar (igual que `ddMmmToISO` hoy).

## `concept`

```jsonc
"concept": {
  "xMin": 90,
  "xMax": 360,           // texto entre estas x, excluyendo celdas que son montos
  "stripSuffix": "MX",   // opcional, limpia sufijo de columna
  "source": "sameRow"    // sameRow | dateRow | lookback  (ver estrategias)
}
```

## Estrategias

### `columnBands` (BBVA débito, Inbursa, Scotia, Banamex simple)

El monto vive en una de varias bandas x; cada banda define su `tipo`. Todo lo que
esté más allá de `ignoreBeyondX` es SALDO acumulado → se ignora.

```jsonc
"amount": {
  "strategy": "columnBands",
  "edge": "right",              // right = clasificar por (x+w). CLAVE: los números
                                //   están alineados a la derecha; el borde izquierdo
                                //   se corre con la cantidad de dígitos.
  "bands": [
    { "xMin": 360, "xMax": 430, "tipo": "egreso" },   // CARGO
    { "xMin": 430, "xMax": 500, "tipo": "ingreso" }   // ABONO
  ],
  "ignoreBeyondX": 500          // SALDO → nunca es monto
}
```

> Nota: `edge: "right"` usa `x + w` (borde derecho, estable) en vez de `x`
> (borde izquierdo, deriva). El motor cae a `x` si `w` no está disponible.

### `signedSingleColumn` (Nu, BBVA crédito, Santander crédito)

Una sola columna de monto con **signo explícito** (`+`/`-`). El signo decide el
tipo. No hay columna SALDO que confundir.

```jsonc
"amount": {
  "strategy": "signedSingleColumn",
  "colXMin": 440,                  // la celda del monto empieza aquí
  "signedRegex": "^[+\\-]\\s*\\$?[\\d,]+\\.\\d{2}$",
  "positiveTipo": "ingreso",       // Nu: + = ingreso
  "negativeTipo": "egreso",
  "exclude": ["Cajita"],           // filas cuyo concepto/fila matchea → se omiten
  "skipDetailRegex": "^(Dep[oó]sito SPEI|Transferencia SPEI|Clave de rastreo)",
  "stripInstallmentMarker": true   // BBVA créd: quita "04 DE 06 " del concepto
}
```

> BBVA/Santander crédito invierten: `positiveTipo: "egreso"` (cargo/compra),
> `negativeTipo: "ingreso"` (pago). La tabla "diferidos a meses" se excluye sola:
> no tiene monto con signo en esa columna.

### `multilineBuffer` (Banamex)

El concepto (nombre del comercio) está en la fila de la fecha, pero el **monto
aparece en una fila posterior** del mismo bloque (tras líneas de referencia).

```jsonc
"amount": {
  "strategy": "multilineBuffer",
  "conceptSource": "dateRow",      // el concepto se toma de la fila de fecha
  "bands": [
    { "xMin": 340, "xMax": 410, "tipo": "egreso" },   // RETIRO
    { "xMin": 410, "xMax": 500, "tipo": "ingreso" }   // DEPÓSITO
  ],
  "ignoreBeyondX": 500
}
```

Comportamiento del motor: mantiene `pend = {fecha, concepto}` de la fila de fecha;
al ver una fila con monto en banda → emite y limpia. Si la fila de fecha ya trae
monto, emite en el acto.

## `totals` (para reconciliación — el juez)

```jsonc
"totals": {
  "cargos": "CARGOS\\s+([\\d,]+\\.\\d{2})",
  "abonos": "ABONOS\\s+([\\d,]+\\.\\d{2})",
  "numMovimientos": null,                 // regex o null si no se declara
  "saldoAnterior": "SALDO ANTERIOR\\s+([\\d,]+\\.\\d{2})",
  "saldoFinal": "SALDO ACTUAL\\s+([\\d,]+\\.\\d{2})"
}
```

Si `cargos`/`abonos` son null → el documento es **régimen `undeclared`**; la
validación cae a identidad de balance + `unknownRows` (ver `confidence.md`).

## Fingerprint (índice del layout)

No es una sola firma. Es un score compuesto; ningún componente decide solo:

```
fingerprint =
    keywordHash            (45%)   // keywords del header — estable
  + pageGeometry           (20%)   // ancho/alto normalizados
  + normalizedColumnBands  (15%)   // firma de columnas / pageWidth
  + headerStructure        (10%)   // orden de bloques del encabezado
  + fontStats              (10%)   // fontName+fontSize dominantes
```

- `keywordHash` es el índice barato que reduce el espacio de búsqueda.
- La geometría desempata entre layouts del mismo banco.
- Todo x se **normaliza por ancho de página** antes de firmar (evita deriva por
  tamaño de página / variante de producto).
