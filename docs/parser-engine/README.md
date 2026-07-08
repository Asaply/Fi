# Parser Engine v2 — RFC (layouts declarativos + motor + validación)

> ## STATUS: **FROZEN — RFC v1** ❄️
> Aprobado para implementación. **No se agregan funcionalidades nuevas al v1.**
> Cualquier idea nueva va a un `RFC v2`. Esto evita analysis-paralysis: en este
> punto el riesgo ya no es falta de arquitectura, es no empezar.
>
> No modifica el parser actual (`src/lib/statementParser/`). **No entra a Build 14.**
>
> **Criterio de salida del freeze → empezar a implementar:** el motor v2 debe
> producir **exactamente el mismo JSON** que los 6 parsers actuales sobre el
> Golden Dataset. Hasta lograr esa paridad, no se toca ni el parser vivo ni Claude.

## Por qué

Hoy hay 6 parsers JS por banco. Funcionan y reconcilian exacto. Pero a 30-50
bancos serían 30-50 archivos, y cada cambio de formato rompe uno. El 99% de
exactitud no sale de escribir más parsers: sale de un sistema que **sabe cuándo
NO confiar en sí mismo** y que **reutiliza layouts** sin código nuevo por banco.

## Arquitectura convergida

```
PDF
 → extractItems { x, y, w, left, right, center, fontName, fontSize, page }
 → fingerprint compuesto (keyword 45% + geometría 35% + headerStruct 20%) → layoutId
 → ¿layout conocido (trusted)?
      SÍ → motor(estrategia) → validación
      NO → Claude describe items → layout candidato → validación
 → VALIDACIÓN = vetos duros (unknownRows==0, balance) + score continuo
      vetos ok & régimen 'declared'   → trusted   (o v-bump si es deriva)
      vetos ok & régimen 'undeclared' → provisional (espera 2ª confirmación)
      veto falla                       → Claude (parcial/completo) + log layout_failures
```

- **Motor:** 3 estrategias reutilizables — `columnBands`, `signedSingleColumn`,
  `multilineBuffer`. Cubren ~80-90% de bancos MX sin DSL infinito.
- **Fingerprint:** score compuesto; ningún componente decide solo. keyword es el
  índice estable (barato), geometría desempata.
- **Validación:** híbrida. Vetos duros gatean el auto-guardado; score continuo
  rankea/monitorea. Un promedio ponderado NUNCA aprueba lo que un veto reprueba.
- **Madurez:** 3 estados + contador — `provisional` → `trusted` → `curated`.
- **Persistencia:** repo (curados) + Supabase (aprendidos). 4 tablas.
- **Generador:** Claude emite `layout.json` (no código JS), gateado por doble
  validación (totales **+** identidad de balance) antes de persistir.
- **Corpus:** `expected.json` en git (sin PII) · PDFs fuera de git · regresión
  determinista en CI **offline** (sin API key).

## Contenido de esta carpeta

| Archivo | Qué es |
|---------|--------|
| `LayoutSchema.v1.md` | Spec del JSON de layout + las 3 estrategias |
| `layouts/*.json` | Los 6 bancos actuales migrados a reglas declarativas |
| `engine-sketch.js` | Pseudocódigo del motor que interpreta el schema |
| `confidence.md` | Objeto de confianza: vetos + score + dos regímenes |
| `explainability.md` | Traza de decisión del motor (depuración por log, no por código) |
| `generator-spec.md` | Prompt del generador + loop de doble validación + madurez |
| `supabase-ddl.sql` | DDL de las 4 tablas (definition/versions/usage/failures) |

## RFC v1 — alcance CONGELADO

Incluido: 3 estrategias · vetos+score · fingerprint compuesto · `schemaVersion` ·
`supports/capabilities` · explainability · madurez (3 estados) · corpus · 4 tablas.
Diferido a **RFC v2**: estadísticas por-regla · métrica por-transacción · OCR
ligero para escaneados · auto-recorte de páginas para Claude.

## Qué NO cambia

- El parser actual sigue vivo y es la fuente de verdad hasta que el motor v2
  pase la regresión contra el corpus con paridad exacta.
- Claude Vision sigue como último fallback para escaneados sin texto
  (HSBC, Santander escaneados).
