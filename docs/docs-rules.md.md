```markdown
# Reglas globales NVA

## Ejecución
- NO replanificar. Si un exec.md tiene pasos numerados, ejecutar en orden.
- NO explicar el "por qué" salvo que el step lo pida.
- NO crear archivos markdown de reportes intermedios; reporta al usuario en chat.

## Código
- NO usar mock data en producción. Si necesitas placeholder, marcar con `// TODO: REAL`.
- USAR parsers existentes en `src/lib/parsers/`. No reescribir.
- NO crear nuevas tablas en Supabase sin instrucción explícita.
- NO modificar lógica de Trading/Portfolio en fixes de Finanzas.
- NO tocar archivos en `src/lib/parsers/` salvo que el step lo indique.

## UI
- Tailwind utilities funcionan en este proyecto. Usar libremente.
- CSS Modules `.module.css` también funcionan; preferir cuando hay lógica visual compleja.
- NO usar Tailwind y CSS Module mezclados en el mismo elemento si es evitable.
- Logos SVG: usar SIEMPRE los archivos en `/public/nva-logo.svg` y `/public/nva-icon.svg`. NO regenerar inline.
- Color naranja oficial: `#FF8700`.

## Auth y datos
- NO crear cuentas en nombre del usuario.
- Para análisis pre-auth: `sessionStorage["nva_pending_analysis"]`.
- Gating de análisis gratis: `localStorage["nva_free_analysis_used"]`.

## Reportes al usuario
- Al terminar exec.md, reportar SOLO:
  1. ✅/❌ por cada step
  2. Archivos modificados (lista)
  3. Bloqueos o decisiones que tomaste
- NO repetir el contenido del exec.md.
- NO escribir tutoriales.
```