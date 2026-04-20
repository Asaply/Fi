## Bug 1: Perfil muestra datos hardcodeados

### Problema

La página de perfil muestra nombre hardcodeado ("Leonardo") y email placeholder ("[leonardo@example.com](mailto:leonardo@example.com)") en lugar de los datos reales del usuario autenticado.

### Fix

Busca el archivo de perfil:

bash

```bash
grep -r "example.com\|placeholder.*email\|defaultName\|defaultEmail" app/ components/ --include="*.tsx" --include="*.ts" -l
```

El perfil debe leer los datos del usuario autenticado desde Supabase:

tsx

```tsx
// ❌ Incorrecto — datos hardcodeados o con fallback fijo
const [name, setName] = useState('Leonardo')
const [email, setEmail] = useState('leonardo@example.com')

// ✅ Correcto — leer del usuario autenticado
const [name, setName] = useState('')
const [email, setEmail] = useState('')

useEffect(() => {
  const getUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const displayName = user.user_metadata?.full_name 
        || user.user_metadata?.name 
        || user.email?.split('@')[0] 
        || ''
      setName(displayName)
      setEmail(user.email || '')
    }
  }
  getUser()
}, [])
```

**Campos a corregir:**

- Nombre completo → `user.user_metadata?.full_name || user.user_metadata?.name || ''`
- Correo → `user.email || ''` (readonly, no editable)
- Avatar → `user.user_metadata?.avatar_url` si existe

---

## Bug 2: Optimización móvil

### Problemas observados

- Botón "Agregar Activo" cortado en Portfolio Health
- Filtros de tiempo desbordan en pantallas pequeñas
- Botones de acción en headers no visibles en móvil

### Fix — patrón para todos los headers de página:

tsx

```tsx
// ❌ Se corta en móvil
<div className="flex items-center gap-2">
  <div className="flex gap-1">/* filtros */</div>
  <button>+ Nuevo</button>
</div>

// ✅ Correcto
<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
  <div className="flex gap-1 overflow-x-auto scrollbar-hide">/* filtros */</div>
  <button className="shrink-0 self-end sm:self-auto">+ Nuevo</button>
</div>
```

**Páginas a revisar:** `finanzas`, `trading`, `portfolio`, `dashboard`

Asegúrate en cada página:

1. Filtros de período con `overflow-x-auto` en su contenedor
2. Botones de acción con `shrink-0`
3. Headers con `flex-wrap` o `flex-col` en mobile

---

## Bug 3: Tutoriales — mostrar solo una vez

### Problema

Los tutoriales (onboarding tour) aparecen cada vez que el usuario entra.

### Fix con localStorage:

tsx

```tsx
const [showTutorial, setShowTutorial] = useState(false)

useEffect(() => {
  const key = 'fnce_tutorial_trading_seen'
  if (!localStorage.getItem(key)) {
    setShowTutorial(true)
  }
}, [])

const handleCloseTutorial = () => {
  localStorage.setItem('fnce_tutorial_trading_seen', 'true')
  setShowTutorial(false)
}
```

**Claves por sección:**

- `fnce_tutorial_trading_seen`
- `fnce_tutorial_portfolio_seen`
- `fnce_tutorial_finanzas_seen`

Busca los componentes de tour:

bash

```bash
grep -r "Saltar tour\|Siguiente →\|tour\|onboarding" app/ components/ --include="*.tsx" -l
```

Conecta el botón "Saltar tour" y el final del tour con `handleCloseTutorial()`.

---

## Verificación

1. Login con cuenta Google diferente → perfil debe mostrar nombre y email de esa cuenta
2. Móvil 375px: botones visibles sin scroll horizontal
3. Tutorial: ver una vez, cerrar, volver → no debe aparecer de nuevo