# Explainability — traza de decisión del motor

Cada procesamiento emite una **traza** que explica por qué el motor decidió lo que
decidió. El día que un usuario diga "NVA leyó mal mi estado", no se mira el código:
se abre el log. Va junto a las métricas de `layout_usage`.

## Formato

```jsonc
{
  "decision": {
    "layout": "bbva-debito",
    "layoutVersion": 4,
    "schemaVersion": 1,
    "strategy": "columnBands",
    "regime": "declared",
    "route": "v2_trusted",

    "fingerprint": {
      "score": 0.97,
      "matched": ["keywordHash", "columnSignature", "fontStats"],
      "competing": [ { "layout": "bbva-credito", "score": 0.41 } ]  // 2º más cercano
    },

    "rulesApplied": ["dateColumn", "conceptBand", "amountBand:cargo", "amountBand:abono", "saldoIgnored"],

    "rowStats": { "total": 512, "movements": 40, "skipped": 468, "unknown": 0 },

    // filas con forma de movimiento que NO se pudieron asignar (la señal de oro)
    "unknownRows": [
      // { "page": 3, "y": 214, "reason": "amount_outside_bands", "cells": ["10 MAY", "...", "500.00", "199.84"] }
    ],

    // por qué se descartó cada fila candidata (muestra acotada)
    "rejected": [
      { "page": 2, "y": 326, "reason": "skipRow:BALANCE INICIAL" },
      { "page": 2, "y": 480, "reason": "amount_beyond_ignoreX (SALDO)" }
    ]
  },

  "confidence": { /* ver confidence.md */ }
}
```

## Campos que importan al depurar

- **`unknownRows`** — lo primero que se mira. Vacío = el motor asignó todo. No
  vacío = deriva de layout o banda mal calibrada. Cada entrada dice `page`, `y`,
  `reason` y las celdas crudas → se ve al instante qué fila y por qué.
- **`rejected[].reason`** — por qué una fila no se volvió movimiento. Razones
  estándar: `skipRow:<X>`, `amount_beyond_ignoreX`, `no_amount_in_bands`,
  `date_out_of_period`, `excluded:<pattern>`, `detail_line`.
- **`fingerprint.competing`** — si el 2º layout está cerca en score, hay riesgo de
  colisión de layouts (mismo banco, productos parecidos). Bandera para revisar.
- **`route`** — `v2_trusted` | `v2_provisional` | `claude_partial` | `claude_full`.

## Estadísticas por REGLA (futuro, no v1)

Además de por layout, acumular tasa de acierto **por regla** en `layout_usage`
(o tabla derivada). Con el tiempo revela qué regla genera más errores:

```
rule_dateColumn    99.98%
rule_amountBand    99.12%
rule_skipMSI       97.40%   ← candidata a mejorar
```

> No v1. Se habilita cuando el motor ya esté en producción y haya volumen.
