# Debug: API route parse-statement devuelve HTML en vez de JSON

## ERROR
`Unexpected token '<', "<!DOCTYPE"... is not valid JSON`
Significa que /api/parse-statement está crasheando y Next.js devuelve
su página de error HTML. El frontend intenta parsear ese HTML como JSON y explota.

---

## PASO 1 — LEE ESTOS ARCHIVOS PRIMERO

- src/app/api/parse-statement/route.js (o route.ts)
- El componente frontend que hace el fetch al route (busca "parse-statement")
- package.json (verificar si pdf-parse o pdfjs-dist está instalado)
- next.config.mjs (verificar si hay config de webpack que bloquee los módulos)

---

## PASO 2 — CAUSAS COMUNES Y FIXES

### Causa A: pdf-parse o pdfjs-dist no está instalado
Verificar en package.json. Si no está: