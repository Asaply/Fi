# v1-sprint5-auth.md

## Objetivo
Agregar autenticación con Supabase Auth (email + Google) y proteger todas las rutas. Cada usuario ve solo sus propios datos. Incluye pantalla de login y onboarding básico al primer acceso.

---

## Paso 1: Configurar Supabase Auth

Verificar que en `src/lib/supabase.ts` el cliente está correctamente inicializado:

```typescript
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export const supabase = createClientComponentClient()
```

En el dashboard de Supabase (supabase.com), habilitar:
- **Email/Password** → Authentication > Providers > Email
- **Google OAuth** → Authentication > Providers > Google (requiere Google Cloud Console credentials)

---

## Paso 2: Middleware de protección de rutas

Crear `src/middleware.ts` en la raíz del proyecto:

```typescript
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  
  const { data: { session } } = await supabase.auth.getSession()
  
  const isAuthPage = req.nextUrl.pathname.startsWith('/login')
  const isProtectedRoute = !isAuthPage && req.nextUrl.pathname !== '/'
  
  if (isProtectedRoute && !session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  
  if (isAuthPage && session) {
    return NextResponse.redirect(new URL('/finanzas', req.url))
  }
  
  return res
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
```

---

## Paso 3: Página de Login

Crear `src/app/login/page.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const router = useRouter()

  async function handleEmailAuth() {
    setIsLoading(true)
    setError('')
    
    const fn = mode === 'login' 
      ? supabase.auth.signInWithPassword 
      : supabase.auth.signUp
    
    const { error } = await fn({ email, password })
    
    if (error) {
      setError(error.message)
    } else {
      router.push('/finanzas')
    }
    setIsLoading(false)
  }

  async function handleGoogleAuth() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/finanzas` }
    })
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-lg">$</span>
          </div>
          <h1 className="text-white text-2xl font-bold">FNCE</h1>
          <p className="text-gray-500 text-sm mt-1">Tus finanzas en un solo lugar</p>
        </div>

        {/* Tabs login/registro */}
        <div className="flex bg-[#1a1a1a] rounded-lg p-1 mb-6">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'login' ? 'bg-[#2a2a2a] text-white' : 'text-gray-500'
            }`}
          >
            Iniciar sesión
          </button>
          <button
            onClick={() => setMode('register')}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'register' ? 'bg-[#2a2a2a] text-white' : 'text-gray-500'
            }`}
          >
            Registrarse
          </button>
        </div>

        {/* Form */}
        <div className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-lg px-4 py-3 text-sm outline-none focus:border-blue-500 transition-colors"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-lg px-4 py-3 text-sm outline-none focus:border-blue-500 transition-colors"
          />
          
          {error && <p className="text-red-400 text-xs">{error}</p>}
          
          <button
            onClick={handleEmailAuth}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 rounded-lg text-sm transition-colors"
          >
            {isLoading ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[#2a2a2a]" />
            <span className="text-gray-600 text-xs">o</span>
            <div className="flex-1 h-px bg-[#2a2a2a]" />
          </div>

          <button
            onClick={handleGoogleAuth}
            className="w-full bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-[#2a2a2a] text-white font-medium py-3 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continuar con Google
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

## Paso 4: Row Level Security en Supabase

En el SQL Editor de Supabase, ejecutar para cada tabla principal:

```sql
-- Habilitar RLS
ALTER TABLE transacciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE activos ENABLE ROW LEVEL SECURITY;

-- Policy: cada usuario solo ve sus propios datos
CREATE POLICY "Users can only see their own data" ON transacciones
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only see their own data" ON trades
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only see their own data" ON activos
  FOR ALL USING (auth.uid() = user_id);
```

Verificar que las tablas tengan la columna `user_id uuid references auth.users(id)`. Si no la tienen, agregarla:
```sql
ALTER TABLE transacciones ADD COLUMN IF NOT EXISTS user_id uuid references auth.users(id);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS user_id uuid references auth.users(id);
ALTER TABLE activos ADD COLUMN IF NOT EXISTS user_id uuid references auth.users(id);
```

---

## Paso 5: Pasar user_id en todos los inserts

En cada formulario que guarda datos, obtener el user actual y pasarlo:

```typescript
const { data: { user } } = await supabase.auth.getUser()

await supabase.from('transacciones').insert({
  ...formData,
  user_id: user?.id,
})
```

---

## Paso 6: Botón de logout en header

En `src/components/layout/Header.tsx`, en el avatar/perfil del usuario:

```tsx
async function handleLogout() {
  await supabase.auth.signOut()
  router.push('/login')
}

// En el menú del avatar:
<button onClick={handleLogout} className="text-sm text-red-400 hover:text-red-300">
  Cerrar sesión
</button>
```

---

## Archivos a crear
- `src/app/login/page.tsx`
- `src/middleware.ts`

## Archivos a modificar
- `src/lib/supabase.ts` — verificar cliente
- `src/app/finanzas/` — agregar user_id en inserts
- `src/app/trading/` — agregar user_id en inserts
- `src/app/portfolio/` — agregar user_id en inserts
- `src/components/layout/Header.tsx` — botón logout

## SQL a ejecutar en Supabase Dashboard
- Habilitar RLS en las 3 tablas
- Crear policies
- Agregar columna user_id si no existe
