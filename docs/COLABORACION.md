# Cómo colaborar en NVA

Guía para quien se suma a mejorar el frontend. Léela completa antes del primer PR.

## 1. Preparar tu máquina

```bash
git clone https://github.com/Asaply/Fi.git
cd Fi
npm ci                 # Node 22.x (ver "engines" en package.json)
```

Crea `.env.local` en la raíz con **solo** estas dos variables (te las pasa el mantenedor):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Son claves públicas (van en el bundle del navegador) y RLS protege los datos. No necesitas
ninguna otra variable para trabajar en UI. **Nunca pidas ni uses `SUPABASE_SERVICE_ROLE_KEY`**:
salta RLS y da acceso a los datos de todos los usuarios.

Arranca:

```bash
npm run dev            # http://localhost:3005
```

### Cuenta para probar

Usa una cuenta de prueba propia (`testerNN@demo.nva.lat`), no tu cuenta personal. Viene con
datos de ejemplo y está aislada por RLS: puedes importar, editar o borrar sin afectar a nadie.
El mantenedor la crea con `scripts/seed/create-demo-accounts.mjs` (ver `docs/demo-account.md`).

Lo que depende de llaves privadas (import de PDF con IA, Belvo, Stripe, compras de Apple) no
funciona en local. Pruébalo en el preview de Vercel de tu PR.

## 2. Flujo de trabajo

1. **Toma un issue** en GitHub asignado a ti. Si no existe, créalo y avisa antes de empezar.
2. **Crea la rama desde `main` actualizado:**
   ```bash
   git checkout main && git pull
   git checkout -b feature/frontend-<descripcion-corta>
   ```
3. **Commits pequeños** con prefijo: `feat:`, `fix:`, `style:`, `refactor:`.
4. **Antes de abrir el PR:**
   ```bash
   git fetch && git rebase origin/main
   npm run lint
   npm run build
   ```
5. **Abre el PR** contra `main` y llena la plantilla, con capturas de desktop y de móvil (375px).
6. Vercel genera un **preview** del PR. Revísalo ahí, en el teléfono también.
7. El mantenedor revisa y hace **squash merge**. Nadie hace push directo a `main`.
8. Después del merge:
   ```bash
   git checkout main && git pull
   git branch -d feature/frontend-<descripcion-corta>
   ```

Mantén las ramas cortas, de 1 a 3 días. Una rama que vive dos semanas termina en conflictos.

## 3. Qué toca cada quien

| Tú (frontend) | Mantenedor |
|---|---|
| `src/components/` | `src/lib/` (lógica, parsers, pagos, auth) |
| `ui-kit/` | `src/app/api/` (API routes) |
| Archivos `*.css` | `src/middleware.ts` |
| La parte visual de `src/app/**/page.js` | `*.sql`, `scripts/`, `ios/`, `capacitor.config.ts` |
| | `package.json` (dependencias), `next.config.mjs`, `vercel.json` |

**Páginas (`page.js`):** muchas mezclan UI con llamadas a Supabase (`supabase.from(...)`,
`supabase.auth...`). Puedes cambiar el JSX, los estilos y los componentes, pero **no modifiques
queries, inserts, auth ni cálculos de datos**. Si un cambio visual necesita otro dato, abre un
issue o pregunta.

**Archivos compartidos:** avisa en el issue o en el chat *antes* de editarlos, porque los dos
los tocamos seguido:

- `src/app/globals.css`
- `src/app/layout.js`
- `src/components/Sidebar.js`, `BottomNav.js`, `Topbar.js`, `ConditionalShell.js`

**Dependencias nuevas:** pregunta antes de agregar cualquier paquete npm.

## 4. Reglas de diseño

- Dark theme por defecto. Usa las variables CSS existentes (`globals.css`, `ui-kit/styles/tokens.css`)
  en vez de colores sueltos.
- Nada de estilos inline. Clases y variables CSS.
- Móvil primero: la app también corre como app iOS (Capacitor). Prueba a 375px y deja espacio
  para el notch y la barra inferior.
- No cambies rutas ni navegación salvo que el issue lo pida.

## 5. Si usas Claude Code o Codex

`CLAUDE.md` / `AGENTS.md` ya tienen una sección de colaboración. Abre cada sesión con:

```
Lee CLAUDE.md y docs/COLABORACION.md. Trabaja solo en el issue #<n>.
Rama: feature/frontend-...  No toques TASKS.md ni archivos fuera de tu zona.
```

`TASKS.md` es la cola personal del mantenedor. No lo edites ni ejecutes sus tareas.

## 6. Seguridad

- Nunca subas `.env*`, llaves, tokens ni estados de cuenta reales. Los estados de cuenta
  traen datos personales (PII) y no se versionan.
- No pegues datos reales de usuarios en issues, PRs ni capturas. Usa la cuenta de prueba.
- Si subiste algo sensible por error, avisa de inmediato. No intentes arreglarlo reescribiendo
  el historial por tu cuenta: hay que rotar la llave primero.
