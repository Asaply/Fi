# Objeto de confianza — vetos duros + score continuo

El motor no debe solo "leer": debe **saber cuándo está equivocado**. Este objeto
es ese saber. Dos capas: **vetos** (gatean el auto-guardado) y **score continuo**
(rankea, monitorea, decide ruta a Claude).

> Regla de oro: **un promedio ponderado NUNCA aprueba lo que un veto reprueba.**
> Un layout con totales y balance perfectos pero 15% de `unknownRows` está tirando
> movimientos en silencio — el veto lo detiene aunque el score sea alto.

## Régimen (define qué tan fiable es todo lo demás)

```
regime = "declared"    si el documento declara total_cargos/total_abonos (o count)
       = "undeclared"  si no declara nada contra qué reconciliar
```

En `undeclared` NO se puede fingir confianza alta. Se cae a señales
independientes (balance, unknownRows, monotonía de fechas) y se marca provisional.

## El objeto

```jsonc
{
  "regime": "declared",

  // ── VETOS (booleanos duros; cualquiera en false ⇒ NO auto-guardar) ──
  "vetoes": {
    "unknownRows":      true,   // == 0 filas con forma-de-movimiento sin asignar
    "balanceIdentity":  true,   // saldo_ant + ingresos − egresos == saldo_final (si hay saldos)
    "noNegativeAmounts": true,  // ningún monto <= 0 tras parseo
    "datesInPeriod":    true    // todas las fechas caen dentro del periodo declarado
  },

  // ── SCORE CONTINUO (0..1; para ranking/monitoreo, NO reemplaza vetos) ──
  "scores": {
    "reconciliation": 1.0,   // 1 − min(1, |sumCargos−declCargos|+|sumAbonos−declAbonos| / declTotal)
    "balance":        1.0,   // 1 si balance cuadra dentro de tolerancia
    "countMatch":     1.0,   // 1 si n_extraído == n_declarado  (solo declared)
    "dateCoverage":   1.0,   // fracción de filas con fecha válida
    "amountCoverage": 0.99,  // fracción de filas-movimiento con monto asignado
    "unknownRows":    0.0    // fracción de filas ambiguas (menor = mejor)
  },

  // ── AGREGADO ponderado POR RÉGIMEN ──
  "confidence": 0.996
}
```

### Pesos del agregado (dependen del régimen)

```
declared:    reconciliation 40 · balance 30 · countMatch 15 · unknownRows 15
undeclared:  balance 45 · unknownRows 35 · dateCoverage 10 · amountCoverage 10
```

`unknownRows` pesa alto en ambos porque es la única señal fuerte que **no
requiere totales declarados**. Es el mejor detector de deriva de layout.

## Ruta de decisión

```
TODOS los vetos == true:
    regime == "declared"    & confidence ≥ 0.99   → TRUSTED  (auto-usar, +validationCount)
    regime == "undeclared"  & confidence ≥ 0.97   → PROVISIONAL (usar, esperar 2ª confirmación)

Algún veto == false OR confidence en [0.90, umbral):
    → Claude (revisión: manda solo las páginas/filas dudosas si se puede)

confidence < 0.90:
    → Claude completo
```

## Métricas a registrar por procesamiento (día 1)

Van a `layout_usage` / `layout_failures` (ver DDL):

- `layout_id`, `layout_version`, `regime`
- `n_expected` (declarado), `n_extracted`
- `delta_cargos`, `delta_abonos` (absolutos)
- `confidence`, `unknownRows`
- `route` (`v2_trusted` | `v2_provisional` | `claude_partial` | `claude_full`)
- `processing_ms`
- `user_corrected` — **separando** los dos tipos:
  - `corrected_amount_date_tipo`  ← error REAL del parser (señal de entrenamiento)
  - `corrected_categoria`         ← gusto del usuario, NO es error del parser
```
```

> El punto de oro: una corrección de **monto/fecha/tipo** antes de confirmar es la
> señal más valiosa de que el layout falló — dispara re-validación / candidato a
> v-bump. Una corrección de **categoría** es ruido para esta métrica; no la mezcles.
