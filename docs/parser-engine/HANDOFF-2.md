# HANDOFF 2 — Sesión de fixes UI + parsers (retomar en chat nuevo)

> Fecha: 2026-07-14. Leer este archivo + `docs/parser-engine/HANDOFF.md` (contexto original).
> Repo: /Users/leonardo/Documents/Fi · Prod: nva.lat (Vercel Hobby) · iOS Capacitor.

## Cómo retomar (pega esto en el chat nuevo)
> Lee `docs/parser-engine/HANDOFF-2.md`. Estamos en build iOS 19 (v1.0.1) pendiente de
> archivar en Xcode. Los fixes de parser son server-side y ya están live en Vercel.
> Continuamos desde ahí.

---

## ⚠️ PENDIENTE INMEDIATO
**Archivar el Build 19 en Xcode** (yo no puedo, es manual):
1. Xcode → `ios/App/App.xcworkspace` → destino "Any iOS Device (arm64)"
2. Product → Archive → Distribute → App Store Connect → Upload
- pbxproj ya en `CURRENT_PROJECT_VERSION = 19`, `MARKETING_VERSION = 1.0.1`
- Assets nativos sincronizados (out/ fresco). TestFlight actual: build 17.
- El build 19 junta TODOS los fixes de UI de esta sesión (ver abajo).

## Reparto de trabajo
- **Server-side** (parsers en `src/lib/statementParser/`, `/api/analyze`): se activa con
  `git push` → deploy Vercel, SIN build nativo. Ya todo pusheado a origin/main.
- **UI** (componentes React/CSS): necesita `npm run build:native && npx cap sync ios` +
  Archive. Ya sincronizado localmente, falta el Archive.

---

## Lo hecho en esta sesión (todo commiteado + pusheado)

### Parsers (server-side, LIVE en prod)
1. **Banamex débito layout MiCuenta** (`banks/banamexDebito.js`): depósitos "PAGO RECIBIDO
   DE SU REF." vienen SIN fecha → ahora se emiten con la última fecha vista (solo banda
   depósito). Totales/saldos con prefijo `$` y formato "(-) N Retiros $..." / "SALDO AL
   20 DE ABRIL DE 2026 $...". Verificado: 16 retiros $25,565.96 + 3 dep $24,907.24.
2. **BBVA crédito layout "DESGLOSE DE MOVIMIENTOS"** (`banks/bbvaCredito.js`): dos columnas
   de fecha (operación/cargo), montos "+ $78.00"/"- $6,535.99" con signo posiblemente en
   celda aparte. Reescrito: detecta monto = valor con signo explícito más a la derecha;
   excluye 2ª fecha, líneas "IVA :$..." y FX "USD $... TIPO DE CAMBIO".
3. **BBVA crédito reconciliación con comisiones**: BBVA lista "DISPOSICION CRED.EFEC.CAJERO"
   como movimientos pero las EXCLUYE de TOTAL CARGOS (van en "Monto de comisiones"). Fix:
   `total_cargos = TOTAL CARGOS + Monto de comisiones`. Sirve para ambos (viejo comisiones=0).
4. **Separar tarjetas del mismo banco por últimos 4** (bbvaCredito + route.js): parser extrae
   `card_last4`; en crédito route.js etiqueta `banco = "BBVA ·6560"`. Cada tarjeta = su tab.
   Débito sin cambios. **Falta que el usuario confirme en la app tras deploy.**

**Corpus de test local** (gitignored, PII, NO commitear):
`Estados de cuenta statement/bbva-credito-2.pdf` (TARJETA PLATINUM, layout nuevo).
Scripts de prueba en `/tmp/testrecon.mjs`, `/tmp/testci.mjs`, `/tmp/last4.mjs`, etc.
Correr: `node /tmp/testrecon.mjs "Estados de cuenta statement/<pdf>"`.

Bancos con parser determinista (reconcilian exacto): BBVA déb+créd, Nu, Banamex(2 layouts),
Inbursa, Scotia. HSBC + Santander = escaneados → IA fallback.

### UI (necesita Build 19 para verse en el device)
- **Reporte Mensual rediseñado** (`ReporteMensual.jsx` + `.css`): hero con balance del mes,
  selector de mes con opción **"Todo"** (global), barras pill, tooltip flotante, 3 stat cards
  con % vs mes anterior. Números de tarjetas sin truncar (formato compacto $K/$M >100k).
- **Gastos/Ingresos por categoría móvil**: apilado mobile-first (donut arriba, leyenda full-
  width). Tooltips de TODAS las gráficas de pie fijados arriba (`position={{y:0}}`) → no se
  empalman con el centro. (`GastosPorCategoria`, `IngresosPorCategoria`, `CardPortfolio`,
  `CardGastosCategorias`, `ExpensesWidget`, `portfolio/page.js`).
- **Header con continuidad**: `.main-content::before` sticky pinta el mismo fondo fijo
  (`var(--bg-image)`, background-attachment:fixed) y se desvanece con mask → sin corte, sin
  banda negra en dark, sin línea en light. Topbar bajado a **48px**.
- **Miss-clicks iOS resueltos**: se quitó el `-webkit-mask-image` del scroll container (rompía
  el hit-testing) → ahora el fade es un `::before` sticky. `touch-action: manipulation` en
  interactivos. (`globals.css`)
- **Teclado iOS**: `resize:none` en `capacitor.config.ts` (no reajusta webview). Modal
  (`Modal.js`) escucha `keyboardWillShow/Hide` y sube el sheet + limita alto → scroll sobre
  el teclado.
- **Revisión de import densificada** (`finanzas/page.js` + `Finanzas.css`): fecha+concepto en
  una línea, selects `flex:1 1 0; width:0` (no desbordan en WebKit), lista 58vh.
- **InfoTips** en métricas de crédito (utilización, deuda revolvente, comprometido, disponible,
  pago sin intereses).
- **Recuérdame sin flash**: login gatea con `checkingSession` + decide con `getSession()`
  (local, sin red) → directo al dashboard, sin flash de login. (`login/page.js`)
- **Crédito**: parser extrae límite/disponible/saldo al corte/pago sin intereses/fechas/CAT →
  `credito_info`; la respuesta manda `saldo_al_corte` como `saldo_final` para que el build
  instalado muestre la deuda real sin recompilar.

---

## Próximos pasos sugeridos (elegir en el chat nuevo)
1. **Archivar Build 19** (pendiente inmediato).
2. Confirmar en la app que la separación de tarjetas por últimos-4 funciona.
3. Más parsers de crédito/débito según los estados que fallen (pedir el PDF → guardarlo en
   `Estados de cuenta statement/` → medir coords → ajustar). Santander/HSBC escaneados
   necesitarían OCR (no hay aún).
4. Parser Engine v2 (RFC congelado en `docs/parser-engine/`) — no empezado.

## Notas de entorno
- ANTHROPIC_API_KEY solo en Vercel → /api/analyze no se prueba local, PERO el parser
  determinista SÍ (no usa IA). Los fixes de parser se validan con los scripts /tmp + los PDFs
  locales.
- Push a main directo (el repo trabaja así). Deploy Vercel automático desde main.
- `nva/` es un dir untracked ajeno, ignorar.
