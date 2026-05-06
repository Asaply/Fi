```markdown
# Estado actual NVA (vivo, actualizar)

_Última actualización: 2026-05-04_

## Sprint actual
**Fix MVP analyze flow** — convertir el flujo público en algo que funcione end-to-end.

## Estado por sección

### Landing `/`
- ✅ Layout funcionando
- ✅ Logo NVA real (rectángulo negro con A naranja)
- ⚠️ Dock "N" flotante todavía visible (debería excluirse de rutas públicas)

### `/analyze`
- ✅ Logo NVA correcto
- ❌ Dropzone con borde dashed roto (label tiene `display: inline`)
- ❌ El upload NO procesa el archivo — todo es simulado con `setTimeout`
- ❌ No existe `/api/analyze`

### `/analyze/results`
- ✅ Layout y diseño visual perfectos
- ❌ Datos 100% hardcodeados (mock $4,200 / Uber Eats / etc)
- ❌ Botón "analizar otro estado de cuenta" → bypass del paywall

### `/login`
- ✅ Background gradiente naranja correcto
- ✅ Logo correcto
- ⚠️ No tiene mensaje contextual cuando viene del gating

### Dashboard
- ✅ Funciona normal
- ❌ No reclama análisis pendiente al hacer login (porque el hook no existe)

## Decisiones recientes
- Tailwind utilities SÍ funcionan en el proyecto (verificado por MCP).
- El proyecto usa CSS Modules en `/analyze` (clases tipo `analyze_dropzone__boEfO`).
- Logos reales viven en `/public/nva-logo.svg` y `/public/nva-icon.svg`.

## Bloqueado / pendiente
- Google OAuth config en Supabase (Sprint 5)
- Validar parsers Nu y Spin (¿existen como archivo separado?)
```