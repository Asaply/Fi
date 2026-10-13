# Cómo colaborar en NVA

Guía para Alan (frontend y experiencia de usuario). Léela completa antes del primer PR.
Backend: Leonardo.

## 0. Hacia dónde va la app

- **Solo móvil:** iOS primero y Android después. La versión web de la app se va a retirar; en nva.lat
  quedarán solo la landing, la parte legal y soporte.
- **El centro de la app es la sincronización bancaria:** el usuario conecta su banco una vez y sus
  movimientos llegan solos y categorizados. El import manual de PDF/CSV se va a retirar.
- **El diseño completo y el contrato entre frontend y backend** están en
  `docs/superpowers/specs/2026-10-12-sincronizacion-bancaria-design.md`, sección *Contrato para el frontend*.
  Si algo de ese contrato no te sirve, avisa antes de programar otra cosa: cambiarlo requiere acuerdo de los dos.

## 1. Preparar tu máquina

```bash
git clone https://github.com/Asaply/Fi.git
cd Fi
npm ci                 # Node 22.x (ver "engines" en package.json)
```

Crea `.env.local` en la raíz con **solo** estas variables (las dos primeras te las pasa Leonardo):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_BANCOS_MOCK=1
```

Las dos primeras son claves públicas (van dentro de la app) y RLS protege los datos.
`NEXT_PUBLIC_BANCOS_MOCK=1` hace que las pantallas de bancos usen datos de prueba (ver sección 4).
**Nunca pidas ni uses `SUPABASE_SERVICE_ROLE_KEY`**: salta RLS y da acceso a los datos de todos los usuarios.

Arranca:

```bash
npm run dev            # http://localhost:3005 — para iterar rápido en el navegador
```

El navegador sirve para avanzar rápido, pero **la app es móvil**: antes de dar algo por terminado, pruébalo en el
simulador de iPhone (`npm run cap:ios`, necesita Mac con Xcode) o, si no tienes Mac, en el navegador en modo
dispositivo a 375 px y pide a Leonardo que lo revise en el simulador.

### Cuenta para probar

Crea una cuenta normal en la app con tu correo de trabajo y pásale el correo a Leonardo. Él le da acceso de prueba
(el acceso solo lo puede dar el servidor; ya no se puede activar desde la app). No uses cuentas de usuarios reales.

## 2. Flujo de trabajo

**Rama base:** `main`.

1. **Toma un issue** en GitHub asignado a ti. Si no existe, créalo y avisa antes de empezar.
2. **Crea la rama desde la base actualizada:**
   ```bash
   git checkout main && git pull
   git checkout -b feature/frontend-<descripcion-corta>
   ```
3. **Commits pequeños** con prefijo: `feat:`, `fix:`, `style:`, `refactor:`.
4. **Antes de abrir el PR:**
   ```bash
   git fetch && git rebase origin/main
   npm run lint
   npx vitest run
   npm run build
   ```
5. **Abre el PR** contra `main` y llena la plantilla, con capturas del simulador o de 375 px.
6. **Revisión y aprobación (obligatoria por acuerdo del equipo):**
   - El PR queda abierto hasta que **Leonardo lo apruebe** en GitHub (*Review changes → Approve*).
   - Si pide ajustes, haces los cambios en la **misma rama** (nuevos commits, sin abrir otro PR) y respondes cada comentario.
   - **Alan nunca hace merge**, aunque GitHub muestre el botón habilitado: `main` no tiene protección técnica
     todavía, así que esta regla la cumplimos nosotros. **Solo Leonardo hace el merge** (squash), después de aprobar.
   - Nadie hace push directo a `main`.
   **Los PRs siempre van contra `main`**, nunca contra otra rama de feature: un PR mergeado en otra rama no llega a la app.
7. Después del merge borra tu rama local.

Mantén las ramas cortas, de 1 a 3 días. Una rama que vive dos semanas termina en conflictos.

## 3. Qué toca cada quien

| Alan (frontend) | Leonardo (backend) |
|---|---|
| `src/components/` (incluye `src/components/bancos/`) | `src/lib/` (lógica, pagos, auth, categorías) |
| `ui-kit/`, archivos `*.css` | `src/lib/bancos/client.js` (capa de datos de bancos) |
| La parte visual de `src/app/**/page.js` | `supabase/` (migraciones, Edge Functions), `src/app/api/` |
| Datos de ejemplo en `src/lib/bancos/mock.js` (mismo formato del contrato) | `src/middleware.ts`, `scripts/`, `ios/`, `capacitor.config.ts` |
| | `package.json` (dependencias), `next.config.mjs`, `vercel.json` |

**Páginas (`page.js`):** muchas mezclan UI con llamadas a Supabase. Puedes cambiar el JSX, los estilos y los
componentes, pero **no modifiques queries, inserts, auth ni lógica de acceso**. Si un cambio visual necesita otro
dato, abre un issue o pregunta. **Excepción acordada:** excluir de los totales los pagos entre cuentas propias
(ver sección 4) sí es tuyo.

**Archivos compartidos:** avisa en el issue *antes* de editarlos:
`src/app/globals.css`, `src/app/layout.js`, `src/components/Sidebar.js`, `BottomNav.js`, `Topbar.js`,
`ConditionalShell.js`.

**Dependencias nuevas:** pregunta antes de agregar cualquier paquete npm.

## 4. Pantallas de bancos

Las pantallas **solo** usan `src/lib/bancos/client.js`. Nunca importes `mock.js` ni llames a Supabase desde
esas pantallas: así, cuando el backend esté listo, se apaga `NEXT_PUBLIC_BANCOS_MOCK` y no cambias nada.

```js
import {
  listarBancos, listarCuentas, listarMovimientos,
  pedirTokenConexion, registrarBanco, sincronizar, desconectar, cambiarCategoria,
  cuentaParaTotales, BancosError, MAX_LINKS_PER_USER,
} from '@/lib/bancos/client';
```

- Los errores llegan como `BancosError` con `code`: `no_session`, `no_subscription`, `max_links`, `forbidden`,
  `conflict`, `not_found`, `rate_limited` (trae `retryAfter` en segundos) o `unknown`. Cada uno necesita un mensaje
  claro para el usuario.
- **Estados de un banco:** `syncing` → "Sincronizando…" (vuelve a pedir la lista cada ~10 s mientras haya alguno);
  `valid` → "Al día · hace X"; `token_required` o `invalid` → botón "Reconectar".
- **Conectar:** construye el componente `src/components/bancos/ConectarBanco.js` con la interfaz
  `<ConectarBanco linkId? onLinked={(providerLinkId) => …} onExit={() => …} />`. Por ahora, en modo prueba, simula el
  widget del banco (por ejemplo, una hoja con una lista de bancos de prueba) y llama `onLinked('link-<algo>')`.
  Leonardo reemplaza el interior cuando se integre el proveedor; la interfaz no cambia.
- **Movimientos:** muestra de qué banco viene cada uno, marca "pendiente" si `bank_status === 'pending'` y deja cambiar
  la categoría con un toque (`cambiarCategoria`).
- **Totales:** gastos, ingresos, gráficas y presupuestos deben ignorar los movimientos donde
  `cuentaParaTotales(t)` es `false` (pagos entre cuentas propias). Hoy dashboard, finanzas y presupuestos suman por `type`.

Primeros issues sugeridos, en orden: *Mis bancos + Conectar* → *Cuentas de un banco* → *Movimientos con banco,
pendiente y cambio de categoría* → *Totales sin transferencias propias*.

## 5. Reglas de diseño

- Dark theme por defecto. Usa las variables CSS existentes (`globals.css`, `ui-kit/styles/tokens.css`).
- Nada de estilos inline nuevos. Clases y variables CSS.
- Diseña para el teléfono: notch, barra inferior, teclado, áreas táctiles de al menos 44 px.
- No cambies rutas ni navegación salvo que el issue lo pida.

## 6. Si usas Claude Code o Codex

`CLAUDE.md` / `AGENTS.md` tienen una sección de colaboración. Abre cada sesión con:

```
Lee CLAUDE.md, docs/COLABORACION.md y el contrato en
docs/superpowers/specs/2026-10-12-sincronizacion-bancaria-design.md. Trabaja solo en el issue #<n>.
Rama: feature/frontend-...  No toques TASKS.md ni archivos fuera de tu zona.
```

`TASKS.md` es la cola personal de Leonardo. No lo edites ni ejecutes sus tareas.

## 7. Seguridad

- Nunca subas `.env*`, llaves, tokens ni estados de cuenta reales.
- No pegues datos reales de usuarios en issues, PRs ni capturas. Usa tu cuenta de prueba o los datos de `mock.js`.
- Si subiste algo sensible por error, avisa de inmediato. No intentes arreglarlo reescribiendo el historial por tu
  cuenta: hay que rotar la llave primero.
