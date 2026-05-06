# PLAN: Fix analyze flow end-to-end

## Objetivo
Convertir `/analyze` en un flujo real que: procesa archivo del usuario con parsers existentes, persiste insights pre-auth, los reclama al registrarse, y bloquea bypass del paywall.

## Bugs origen (verificados con MCP)
1. Layout dropzone roto (`display: inline` en label)
2. API `/api/analyze` no existe → upload no procesa nada
3. `/analyze/results` con datos hardcodeados
4. No hay claim hook → análisis se pierde al registrarse
5. Botón "analizar otro" permite usos ilimitados gratis

## Steps (ver exec.md para detalle)
1. Fix CSS dropzone
2. Crear `/api/analyze` que use parsers reales
3. Conectar `/analyze` al API + sessionStorage
4. `/analyze/results` lee sessionStorage real
5. Hook `useClaimPendingAnalysis` + integrar en dashboard
6. Gating: bloquear `/analyze` si `nva_free_analysis_used` existe

## Criterio de éxito
- Subir un PDF de nu → ver insights reales (NO mock)
- Registrarse → análisis aparece como transacciones en dashboard
- Volver a `/analyze` sin login → redirige a `/login?reason=free_analysis_used`