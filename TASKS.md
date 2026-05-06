# TASKS — Cola de tareas activa

Implementa las tareas en orden. Marca cada una como ✅ al terminarla antes de continuar.

---

## ⏳ Pendientes

### ✅ TASK-01: Fix perfil hardcodeado
**Archivos:** buscar con `grep -r "example.com\|'Leonardo'\|\"Leonardo\"" app/ components/ --include="*.tsx" -l`

Reemplazar nombre/email estáticos por datos reales del usuario autenticado:
```tsx
const { data: { user } } = await supabase.auth.getUser()
const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuario'
const displayEmail = user?.email || ''
const avatarUrl = user?.user_metadata?.avatar_url || null
```

---

### ✅ TASK-02: Optimización móvil — headers y filtros de período
**Archivos:** buscar con `grep -r "Nueva Transacción\|Agregar Activo\|Nuevo Trade" app/ --include="*.tsx" -l`

1. En cada header de página, agregar `flex-wrap gap-2` al contenedor y `shrink-0` al botón de acción
2. En contenedores de pills de período (`Este mes`, `3 meses`, etc.), agregar `overflow-x-auto pb-1` y `shrink-0` a cada pill

---

### ✅ TASK-03: Tutoriales — mostrar solo una vez
**Archivos:** buscar con `grep -r "tour\|tutorial\|onboarding\|Saltar tour" app/ components/ --include="*.tsx" -l`

Reemplazar estado inicial del tutorial por uno que consulte localStorage:
```tsx
// Claves por sección:
// Trading:   'fnce_tutorial_trading_seen'
// Portfolio: 'fnce_tutorial_portfolio_seen'
// Finanzas:  'fnce_tutorial_finanzas_seen'

const [showTutorial, setShowTutorial] = useState(false)
useEffect(() => {
  if (!localStorage.getItem(TUTORIAL_KEY)) setShowTutorial(true)
}, [])
const handleCloseTutorial = () => {
  localStorage.setItem(TUTORIAL_KEY, 'true')
  setShowTutorial(false)
}
```
Conectar `handleCloseTutorial` a los botones "Saltar tour" y "Finalizar".

---

### ✅ TASK-04: Bug import — mostrar error detallado
**Archivos:** buscar con `grep -r "Error al importar\|importar\|import.*csv\|upload" app/api/ app/ --include="*.ts" --include="*.tsx" -l`

En el API route de import y en el componente cliente:
1. En el API route: envolver toda la lógica en try/catch y retornar `{ error: error.message, stack: error.stack }` en el response con status 400/500
2. En el componente cliente: mostrar el mensaje de error real en lugar de un string genérico
```tsx
// ANTES
setError('Error al importar')

// DESPUÉS  
const data = await res.json()
setError(data.error || `Error ${res.status}: ${res.statusText}`)
```

---

### ✅ TASK-05: Design polish (visual/CSS only)
Ver archivo `v1-design-polish.md` para instrucciones detalladas.
⚠️ Solo cambios visuales — no modificar lógica, queries de Supabase ni routing.

---

### ✅ TASK-06: Automatización de estados de cuenta
Implementar soporte para nuevos bancos (Nu, BBVA Débito, Banamex vertical) y mejorar el parser genérico con IA como fallback.
1. Crear parser para Nu ✅
2. Mejorar parser genérico para formatos verticales ✅
3. Actualizar prompt de IA y modelo (Claude 3.5 Sonnet) ✅
4. Ampliar reglas de categorización con keywords reales ✅

---

## ✅ Completadas

- Bug Fix: ReferenceError TrendingDown en Portfolio page
- Sprint 1: Sidebar limpio
- Sprint 2: Dashboard fijo en `/dashboard`
- Sprint 3: Bug fixes de datos
