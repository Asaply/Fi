# Generador de layouts — Claude describe, el motor ejecuta, la reconciliación juzga

Claude NO genera código JS. Recibe los `items{x,y,w,str}` de un PDF de layout
desconocido y devuelve un **`layout.json`** candidato. El motor lo ejecuta y la
**doble validación** decide si se persiste. Así Claude Vision deja de ser el
procesador principal y se vuelve un "maestro" que interviene una vez por formato.

## Cuándo se dispara

```
PDF → extractItems → fingerprint → ¿layout conocido (trusted)?
   NO  → GENERADOR
   SÍ (provisional) pero falla validación → GENERADOR (posible v-bump)
```

## Entrada a Claude

- Los `items` de las **páginas con tabla de movimientos** (no todo el PDF: recorta
  para ahorrar tokens). Heurística de recorte: páginas cuyo cluster de filas tiene
  ≥N filas con forma `fecha + monto`.
- El texto del header (para keywords/totales).
- El **schema objetivo** (`LayoutSchema.v1`) como contrato de salida.

## Prompt del generador (esqueleto)

```
Eres un generador de reglas de extracción para estados de cuenta mexicanos.
Recibes las celdas de texto de un PDF con sus coordenadas {x, y, w, str} y el
texto del encabezado. NO extraigas los movimientos. Devuelve ÚNICAMENTE un JSON
que cumpla LayoutSchema v1 describiendo CÓMO leer este formato:

1. detect.keywords: 2-4 frases del encabezado que identifiquen este formato.
2. date: en qué banda x está la fecha y su formato (DD_SLASH_MMM | MMM_DD |
   DD_MMM_YYYY | DD_DASH_MMM_YYYY | DAY_PLUS_MONTHCELL).
3. strategy: elige UNA:
   - columnBands: hay columnas separadas de cargo y abono + una(s) de SALDO.
   - signedSingleColumn: una sola columna de monto con signo +/−.
   - multilineBuffer: el monto aparece en una fila posterior al concepto.
4. amount: las bandas x (usa el BORDE DERECHO, x+w, porque los montos se alinean
   a la derecha) y qué tipo es cada banda; y a partir de qué x empieza el SALDO
   (que se ignora). Si es signedSingleColumn, indica qué signo es ingreso/egreso.
5. totals: regex para total_cargos, total_abonos, saldos (para reconciliar).
6. skipRows / exclude: conceptos o secciones que NO son movimientos
   (ej. "diferidos a meses", "cajitas", "BALANCE INICIAL").

Reglas: el monto NUNCA es una columna de SALDO. Cada movimiento tiene UN importe.
Responde solo el JSON, sin texto adicional.
```

## Loop de doble validación (el guardián)

```
candidate = Claude(items, header, schema)
result    = runLayout(pdf, candidate)          // motor v2 ejecuta el candidato
conf      = score(result, declaredTotals)      // ver confidence.md

if (conf.vetoes.all && conf.regime == 'declared' && conf.confidence >= 0.99):
    persist(candidate, maturity='provisional', validationCount=1)   // aún NO trusted
elif (conf.vetoes.all && conf.regime == 'undeclared' && conf.confidence >= 0.97):
    persist(candidate, maturity='provisional', validationCount=1)
else:
    // el candidato no se prueba a sí mismo → NO se guarda
    fallbackClaudeVision(pdf)                    // extrae este PDF por IA directa
    log(layout_failures, candidate, conf)        // para análisis/reintento
```

### Promoción de madurez (data-driven, no manual)

```
provisional  → trusted   cuando un 2º estado del MISMO fingerprint reconcilia
                          (validationCount ≥ 2, independientes)
trusted      → curated   revisión humana + entra al repo como layout_*.json
```

### Deriva / versionado (data-driven)

```
Un PDF matchea fingerprint de layout_X (trusted) pero FALLA validación con la
versión activa:
   → correr GENERADOR
   → si el candidato regenerado reconcilia → layout_X v(n+1) (provisional)
   → conservar v(n) para reprocesar/depurar documentos antiguos
   → registrar en layout_failures el patrón que rompió (banco cambió formato)
```

## Por qué es seguro

- Claude propone; **la reconciliación dispone**. Un candidato que no reconcilia
  jamás se persiste como confiable.
- Vetos duros (unknownRows==0, balance) impiden "cuadrar por suerte".
- Estado `provisional` evita contaminar la biblioteca con un solo estado.
- Todo lo generado es **datos** (JSON), auditable y reversible — no código.
