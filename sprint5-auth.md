# FNCE Sprint 5 — Auth: Email + Google OAuth + RLS

## Prerequisito
Antes de ejecutar este prompt, la guía `sprint5-auth-setup-manual.md` debe estar completada:
- Google OAuth configurado en Google Cloud Console
- Provider Google activado en Supabase con Client ID + Secret

## Target files (crear o modificar)
- `src/middleware.ts` ← CREAR
- `src/app/login/page.tsx` ← CREAR o reemplazar
- `src/app/auth/callback/route.ts` ← CREAR
- `src/lib/supabase.ts` ← modificar para soporte server/client
- `src/lib/supabase-server.ts` ← CREAR
- `src/components/AuthProvider.tsx` ← CREAR
- `src/app/layout.tsx` ← integrar AuthProvider

---

## 1. Supabase client — separar server y client

### `src/lib/supabase.ts` (client-side, mantener compatible)
```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Exportar instancia default para compatibilidad con código existente
export const supabase = createClient()
```

### `src/lib/supabase-server.ts` (server-side)
```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

---

## 2. Middleware — proteger rutas

### `src/middleware.ts`
```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/auth')

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && request.nextUrl.pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

---

## 3. Auth callback route

### `src/app/auth/callback/route.ts`
```ts
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
}
```

---

## 4. Página de login

### `src/app/login/page.tsx`
Crear página de login con este diseño (dark theme, consistente con FNCE):

```tsx
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const supabase = createClient()
  const router = useRouter()

  async function handleEmailAuth() {
    setLoading(true)
    setMessage('')
    
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage(error.message)
      else router.push('/dashboard')
    } else {
      const { error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
      })
      if (error) setMessage(error.message)
      else setMessage('Revisa tu email para confirmar tu cuenta.')
    }
    setLoading(false)
  }

  async function handleGoogleAuth() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    })
    if (error) setMessage(error.message)
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
      <div className="w-full max-w-sm p-8" style={{ background: 'var(--bg-surface)', border: 'var(--card-border)', borderRadius: 'var(--card-radius)' }}>
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent)' }}>
            <span className="text-white font-bold text-sm">F</span>
          </div>
          <span className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>FNCE</span>
        </div>

        <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
          {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
          Tus finanzas personales en un solo lugar
        </p>

        {/* Google OAuth button */}
        <button
          onClick={handleGoogleAuth}
          className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-lg mb-4 transition-colors"
          style={{ background: 'var(--bg-surface-hover)', border: 'var(--card-border)', color: 'var(--text-primary)' }}
        >
          {/* Google SVG icon */}
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continuar con Google
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px" style={{ background: 'var(--bg-border)' }} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>o con email</span>
          <div className="flex-1 h-px" style={{ background: 'var(--bg-border)' }} />
        </div>

        {/* Email + Password */}
        <div className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="tu@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full py-2.5 px-3 rounded-lg text-sm outline-none"
            style={{ background: 'var(--bg-base)', border: 'var(--card-border)', color: 'var(--text-primary)' }}
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleEmailAuth()}
            className="w-full py-2.5 px-3 rounded-lg text-sm outline-none"
            style={{ background: 'var(--bg-base)', border: 'var(--card-border)', color: 'var(--text-primary)' }}
          />
        </div>

        {message && (
          <p className="text-xs mt-3" style={{ color: message.includes('email') || message.includes('Revisa') ? 'var(--color-gain)' : 'var(--color-loss)' }}>
            {message}
          </p>
        )}

        <button
          onClick={handleEmailAuth}
          disabled={loading || !email || !password}
          className="w-full mt-4 py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
          style={{ background: 'var(--accent)', color: 'white' }}
        >
          {loading ? 'Cargando...' : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
        </button>

        <p className="text-xs text-center mt-4" style={{ color: 'var(--text-secondary)' }}>
          {mode === 'login' ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
          <button
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage('') }}
            style={{ color: 'var(--accent)' }}
          >
            {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
          </button>
        </p>
      </div>
    </div>
  )
}
```

---

## 5. AuthProvider — contexto de sesión global

### `src/components/AuthProvider.tsx`
```tsx
'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

const AuthContext = createContext<{ user: User | null; loading: boolean }>({
  user: null,
  loading: true
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
```

### En `src/app/layout.tsx`
Envolver `children` con `<AuthProvider>`:
```tsx
import { AuthProvider } from '@/components/AuthProvider'
// ...
<AuthProvider>{children}</AuthProvider>
```

---

## 6. Botón logout en sidebar

En `src/components/sidebar/Sidebar.tsx`, agregar en la parte inferior:
```tsx
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

// dentro del componente:
const supabase = createClient()
const router = useRouter()

async function handleLogout() {
  await supabase.auth.signOut()
  router.push('/login')
}

// en el JSX, al final del sidebar:
<button onClick={handleLogout} className="text-xs" style={{ color: 'var(--text-muted)' }}>
  Cerrar sesión
</button>
```

---

## 7. Dependencias a instalar

```bash
npm install @supabase/ssr @supabase/supabase-js
```

Si ya están instaladas, verificar que `@supabase/ssr` esté presente (es el paquete nuevo requerido para Next.js App Router).

---

## 8. RLS en Supabase — SQL a ejecutar

Ejecutar en Supabase Dashboard → SQL Editor:

```sql
-- Habilitar RLS en todas las tablas
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_assets ENABLE ROW LEVEL SECURITY;

-- Policies: cada usuario solo ve sus propios datos
CREATE POLICY "Users see own transactions" ON transactions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users see own trading ops" ON trading_operations
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users see own portfolio" ON portfolio_assets
  FOR ALL USING (auth.uid() = user_id);
```

**IMPORTANTE:** Antes de habilitar RLS, asegúrate de que los registros existentes tengan `user_id` = tu UUID de Supabase. Si no, quedarán invisibles. Verifica con:
```sql
SELECT id, user_id FROM transactions LIMIT 5;
```

---

## Notas
- NO modificar lógica de datos existente — solo agregar auth wrapper
- El flujo de Google OAuth requiere que el Paso 1 de `sprint5-auth-setup-manual.md` esté completo
- Para desarrollo local, el redirect de Google Cloud Console debe incluir `http://localhost:3005`
