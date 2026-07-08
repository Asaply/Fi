# HANDOFF — Parser Engine + lectura de estados de cuenta

> Para retomar en otro chat sin perder contexto. Leer este archivo + todo
> `docs/parser-engine/`. Fecha: 2026-07-08.

## Cómo retomar (pega esto en el chat nuevo)

> Lee `docs/parser-engine/HANDOFF.md` y toda la carpeta `docs/parser-engine/`.
> Ya está el parser híbrido determinista (6 bancos) funcionando en `src/lib/statementParser/`
> y el RFC v2 congelado. Continuamos desde ahí.

---

## Estado actual (qué YA está hecho y commiteado)

### 1. Parser híbrido determinista — LIVE en el código, funcionando
Ubicación: `src/lib/statementParser/`
- `extractItems.js` — pdfjs-dist saca texto + coords `{x,y,w,str}`
- `rows.js` — `clusterRows` (agrupa por y), `isAmount`, `parseAmount`
- `dates.js` — parsers de fecha por formato
- `index.js` — `detectBank` (registro BANKS) + `tryDeterministicParse` + fallback
- `banks/` — 6 parsers: bbvaDebito, bbvaCredito, nuDebito, inbursaDebito, scotiaDebito, banamexDebito

**Los 6 reconcilian EXACTO contra PDFs reales** (totales declarados == suma extraída):
| Banco | movs | cargos/abonos |
|-------|------|---------------|
| BBVA débito | 23 | 9611.84 / 9977.08 |
| BBVA crédito | 161 | 96632.08 / 116717.76 |
| Nu | 53 | 12392.26 / 11690.00 |
| Banamex | 35 | 34610.99 / 12340.00 |
| Inbursa | 40 | 15482.59 / 9364.31 |
| Scotiabank | 93 | 49517.12 / 45695.77 |

HSBC + Santander (créd y déb) → escaneados/fuente rota → **fallback IA** (correcto).

### 2. Integración en el endpoint
`src/app/api/analyze/route.js`:
- Antes de Claude Vision: `tryDeterministicParse` → si reconcilia, usa (instantáneo, $0). Si no, IA.
- `maxDuration = 60` (Vercel Hobby, tope duro 60s — dato clave)
- Retry con presupuesto de tiempo (no reintenta si no cabe en 60s)
- PDF va como `type:'document'` base64 a `claude-sonnet-4-6`, max_tokens 16384. NO se convierte a imágenes.

### 3. Cliente robusto
`src/app/finanzas/page.js`: maneja respuesta no-JSON sin crashear (antes: `Unexpected token 'A'... is not valid JSON` = timeout de Vercel).

### 4. Build iOS
`CURRENT_PROJECT_VERSION = 14`, `MARKETING_VERSION = 1.0.1`. Assets nativos sincronizados (`npm run build:native` + `npx cap sync ios` ya corridos).

### 5. RFC v2 — CONGELADO (propuesta, no implementado)
`docs/parser-engine/` — diseño para migrar de 6 parsers JS a **layouts declarativos + motor + validación + auto-aprendizaje**. STATUS: FROZEN. NO entra a Build 14.

---

## Contexto clave (por qué se hizo esto)

- El punto principal de NVA es leer estados de cuenta y "nunca fallar".
- Bug original: parser leía columna SALDO como monto → totales inflados ($161k vs $97k reales).
- Vercel Hobby topa en **60s**; estados grandes generan 10-12k tokens → timeout. Opus empeora (más lento). Belvo cuesta $ + aprobación. Chunking = 90-95% (insuficiente).
- Solución elegida: **parser determinista por coordenadas x** (bulletproof contra la trampa SALDO, instantáneo, $0) + IA solo como fallback para escaneados.

---

## RFC v2 — resumen de decisiones (todo en docs/parser-engine/)

- **3 estrategias, no DSL:** `columnBands` · `signedSingleColumn` · `multilineBuffer`
- **Borde derecho (x+w)** para clasificar montos alineados a la derecha
- **Vetos duros + score continuo:** el promedio NUNCA aprueba lo que un veto reprueba (unknownRows==0, balance identity)
- **Doble validación:** totales declarados + identidad de balance → gatea auto-guardado
- **Fingerprint compuesto** keyword-dominante (45%) + geometría, x normalizado por ancho de página
- **Régimen declared vs undeclared** — confianza ponderada por régimen
- **Madurez 3 estados** + validationCount: provisional → trusted → curated
- **Generador:** Claude describe items → emite `layout.json` (NO código JS) → validación decide si persiste. Vision se vuelve "maestro" one-time por formato.
- **Persistencia:** repo (curados) + Supabase 4 tablas (definition/versions/usage/failures)
- **Corpus:** `expected.json` en git (sin PII) · PDFs fuera de git · regresión determinista offline en CI
- **schemaVersion + supports/capabilities + explainability** (traza de decisión)
- Diferido a RFC v3: stats por-regla, métrica por-transacción, OCR ligero, auto-recorte de páginas

Archivos: README, LayoutSchema.v1, layouts/*.json (6), engine-sketch.js, confidence, explainability, generator-spec, supabase-ddl.

---

## Próximos pasos (elegir en el chat nuevo)

### Camino A — enviar Build 14 (lo pendiente de producto)
El parser actual ya entrega valor. Falta el batch de UI:
- **Más InfoTips** en funciones de crédito (utilización, deuda revolvente, comprometido próx mes, pago sin intereses, métricas portfolio beta/sharpe/drawdown). Patrón: `<InfoTip title="…" text="…" />` (componente en `src/components/InfoTip.jsx`)
- Verificar lectura de crédito post-deploy
- Luego: `npm run build:native && npx cap sync ios` → Xcode Archive build 14 → subir → ASC v1.0.1 + Novedades + submit

### Camino B — implementar Parser Engine v2 (en paralelo, NO bloquea Build 14)
Criterio de salida del freeze: motor v2 produce **el MISMO JSON exacto** que los 6 parsers sobre el Golden Dataset.
1. Implementar motor (3 estrategias) desde `engine-sketch.js`
2. Migrar 6 layouts (ya escritos en `layouts/*.json`)
3. Golden Dataset → comparar con parser actual → paridad exacta
4. Si paridad → recién ahí, generador + auto-aprendizaje
5. Antes: capturar `fontName/fontSize/left/right/center` en extractItems (hoy solo x,y,w,str) para el fingerprint

---

## Notas de entorno
- Local :3005 · Prod nva.lat (Vercel **Hobby**) · Supabase rdmvynbidxfesvdkuqga
- App híbrida: web (Vercel SSR) + iOS (Capacitor export estático → API remota a nva.lat)
- Cambios de server (/api/*) se activan con **push/deploy** SIN build nativo. Cambios de UI necesitan Archive.
- App YA APROBADA por Apple (build 10 live, v1.0). Armando build 14 / v1.0.1.
- `ANTHROPIC_API_KEY` solo en Vercel, NO en `.env.local` → no se puede probar /api/analyze localmente (pero el parser determinista SÍ, no usa IA).
- Estados de cuenta reales están en `Estados de cuenta statement/` (local, con PII — NO commitear).
