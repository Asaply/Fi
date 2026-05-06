# VALIDATION: analyze-flow

## Manual checks (en navegador)

### Layout
- [x] `/analyze` dropzone es rectángulo COMPLETO con borde dashed (no L invertida)
- [x] Icon de upload (flecha en círculo), no emoji 📄
- [x] Página centrada vertical y horizontal

### Procesamiento real
- [ ] Subir PDF de estado de cuenta real
- [ ] Loader muestra mensajes cambiando (5s aprox)
- [ ] `/analyze/results` muestra montos del PDF, NO `$4,200 / Uber Eats`
- [ ] Si el archivo es inválido → fallback "no pudimos analizar"

### Persistencia
- [ ] Click "Crear cuenta gratis" → `/login`
- [ ] Registrarse con email
- [ ] En dashboard: las transacciones del PDF aparecen en la lista
- [ ] DevTools console: `sessionStorage.getItem('nva_pending_analysis')` → `null`

### Gating
- [ ] Logout, ir a `/analyze` → redirige a `/login?reason=free_analysis_used`
- [ ] Login muestra banner explicativo

## Console smoke test
```js
// En /analyze después de un análisis exitoso
JSON.parse(sessionStorage.getItem('nva_pending_analysis'))
// debe tener: { bank, transactions: [...], insights: {...}, fileName }

localStorage.getItem('nva_free_analysis_used')
// debe tener timestamp ISO
```