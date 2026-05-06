# EXEC: analyze-flow fix

Pre-condiciones: leer `docs/architecture.md`, `docs/rules.md`, `docs/context.md`. Ejecutar pasos en orden. NO replanificar.

## STEP 1 — Fix dropzone CSS

Archivo: `src/app/analyze/page.module.css` (clase `.dropzone`).

Reemplazar la regla por:

```css
.dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  width: 100%;
  max-width: 520px;
  margin: 0 auto;
  border: 2px dashed rgba(255,255,255,0.15);
  border-radius: 16px;
  padding: 48px 32px;
  cursor: pointer;
  background: rgba(255,255,255,0.02);
  transition: all .2s ease;
}
.dropzone:hover { border-color: #FF8700; background: rgba(255,135,0,0.05); }
.dropzoneIcon {
  width: 64px; height: 64px; border-radius: 50%;
  background: rgba(255,255,255,0.05);
  display: flex; align-items: center; justify-content: center;
}
```

En `src/app/analyze/page.tsx`, reemplazar `<div className={styles.dropzoneIcon}>📄</div>` por SVG upload icon (24x24 stroke white).

Container `.container`: `min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center;`.

## STEP 2 — Crear /api/analyze

Verificar primero: `ls src/lib/parsers/` y reportar parsers disponibles. Adaptar imports al resultado.

Crear `src/app/api/analyze/route.ts`:
- POST con `formData` (campo `file`)
- Detectar banco por nombre/contenido
- Llamar parser correspondiente; fallback `ai-statement-parser`
- Devolver `{ success, bank, transactionCount, transactions, insights }`
- `insights` = `{ mainInsight: {category, amount, percentage}, topLeaks: [{name, amount}*3], recommendation: {action, savings}, categories: [{name, amount, color}*≤6], totalIncome, totalExpenses }`
- Lógica de insights: top categoría por monto, top 3 merchants por monto, recommendation = top1.amount * 0.3
- `runtime = 'nodejs'`, `maxDuration = 60`

## STEP 3 — Conectar /analyze al API

En `src/app/analyze/page.tsx` función `handleAnalyze`:
- `FormData` con file → `fetch('/api/analyze', POST)`
- Mostrar mensajes de loading mientras espera (no fake setTimeout)
- En éxito: `sessionStorage.setItem('nva_pending_analysis', JSON.stringify(data))` + `localStorage.setItem('nva_free_analysis_used', new Date().toISOString())` → `router.push('/analyze/results')`
- En error: mostrar mensaje, `setLoading(false)`

## STEP 4 — /analyze/results lee real

En `src/app/analyze/results/page.tsx`:
- ELIMINAR const `insights = {...mock...}`
- `useEffect`: leer `sessionStorage.getItem('nva_pending_analysis')` → setState
- Si null → `router.push('/analyze')`
- Si insights.mainInsight es null → mostrar fallback "no pudimos analizar"
- Renderizar todo desde state, no hardcoded

Cambiar texto del CTA secundario:
- ANTES: "O analizar otro estado de cuenta" → `/analyze`
- DESPUÉS: "¿Más estados de cuenta? Crea tu cuenta para análisis ilimitados" → `/login?reason=more_analyses`

## STEP 5 — Hook claim + dashboard

Crear `src/lib/hooks/useClaimPendingAnalysis.ts`:
- Lee `sessionStorage["nva_pending_analysis"]`
- Si existe + `userId` válido: insert en `transactions` con `user_id`, `amount`, `description`, `merchant`, `category`, `date`, `source: bank`, `imported_from: 'free_analysis'`
- En éxito: `sessionStorage.removeItem('nva_pending_analysis')`

Integrar en componente que monta tras login (probablemente `src/app/(app)/dashboard/page.tsx` o layout autenticado). Llamar con `user?.id`.

## STEP 6 — Gating

En `src/app/analyze/page.tsx` (al inicio del componente):
- `useEffect` async:
  - Si `supabase.auth.getUser()` retorna user → `router.replace('/dashboard')`
  - Si no user + `localStorage["nva_free_analysis_used"]` existe → `router.replace('/login?reason=free_analysis_used')`
  - Mientras: `setChecking(true)` → spinner

En `src/app/login/page.tsx`:
- Leer `useSearchParams().get('reason')`
- Si `reason === 'free_analysis_used'` o `'more_analyses'` → mostrar banner naranja con mensaje correspondiente arriba del form

## REPORTAR
Al terminar: ✅/❌ por step, archivos modificados, parsers que sí encontraste y cuáles no.