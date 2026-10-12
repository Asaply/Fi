# Integración Belvo — INACTIVA (dormida)

La conexión bancaria vía **Belvo** (open banking México) **no está habilitada** en la
app. El código se conserva, sin cablear a la UI, para una futura activación.

## Estado actual
- **No visible / no alcanzable** por el usuario. No se renderiza en ninguna pantalla.
- No representa riesgo de App Review (un revisor no puede llegar a ella).

## Archivos que componen la integración (dormidos)
- `src/components/BankConnectWidget.jsx` — widget de Belvo (carga `cdn.belvo.io`, pide token, abre el widget, entrega `link_id`). Marcado como INACTIVO.
- `src/app/api/belvo/token/route.js` — genera el `widgetToken` (servidor).
- `src/app/api/belvo/transactions/route.js` — trae y mapea movimientos por `link_id`.

## Variables de entorno requeridas (en Vercel, cuando se active)
- `BELVO_SECRET_ID`
- `BELVO_SECRET_PASSWORD`
- `BELVO_ENVIRONMENT` — **debe ser `production`** en release (por defecto `sandbox`).

## Cómo reactivar
1. Configurar credenciales de Belvo en Vercel y `BELVO_ENVIRONMENT=production` (con acceso a producción aprobado por Belvo).
2. En `src/app/finanzas/page.js`:
   - Re-importar el componente: `import BankConnectWidget from "@/components/BankConnectWidget";`
   - Re-agregar el handler `handleBankConnected(link, institution)` (ver historial de git; llama `POST /api/belvo/transactions`, inserta en `transactions`, refresca).
   - Renderizar `<BankConnectWidget onConnected={handleBankConnected} />` en la UI de finanzas.
3. Quitar el marcador "INACTIVO" del encabezado de `BankConnectWidget.jsx`.
4. Verificar el flujo con una cuenta real antes de publicar (evitar bancos sandbox falsos en producción).

## Notas
- La política de privacidad y los Términos ya mencionan a Belvo como agregador de solo lectura; revisar que sigan vigentes al activar.
- Mapear correctamente `link_id` y las columnas de `transactions` (date/concept/amount/type/account_type/bank).
