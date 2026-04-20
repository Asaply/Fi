## Problema

El login con Google OAuth redirigía a `localhost:3000` porque:

1. Supabase tenía `Site URL = http://localhost:3000` (ya corregido a `https://finanzas-integraweb.vercel.app`)
2. El código puede estar usando una URL hardcodeada o faltando `NEXT_PUBLIC_SITE_URL`

## Tareas

### 1. Buscar dónde se llama a `signInWithOAuth`

bash

```bash
grep -r "signInWithOAuth\|redirectTo\|NEXT_PUBLIC_SITE_URL\|localhost:3000" app/ components/ lib/ --include="*.tsx" --include="*.ts" -n
```

### 2. Asegurarse que `redirectTo` use variable de entorno

El callback de Google OAuth debe usar la URL dinámica, no hardcodeada:

ts

```ts
// ❌ Incorrecto
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: 'http://localhost:3000/auth/callback'
  }
})

// ✅ Correcto
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
  }
})
```

Si no existe `NEXT_PUBLIC_SITE_URL`, usar:

ts

```ts
redirectTo: `${typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
```

Esto funciona tanto en localhost como en producción sin cambiar código.

### 3. Verificar que existe la ruta `/auth/callback`

Confirma que existe el archivo `app/auth/callback/route.ts`. Si no existe, crearlo:

ts

```ts
// app/auth/callback/route.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const cookieStore = cookies()
    const supabase = createServerClient(
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
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=callback_error`)
}
```

### 4. Agregar `NEXT_PUBLIC_SITE_URL` a `.env.local`

env

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3005
```

### 5. Agregar la misma variable en Vercel

Ve a `vercel.com/dashboard` → proyecto FNCE → Settings → Environment Variables y agrega:

```
NEXT_PUBLIC_SITE_URL = https://finanzas-integraweb.vercel.app
```

(Solo para Production environment)

## Verificación

Después de los cambios:

1. En local: el login con Google debe redirigir a `http://localhost:3005/dashboard`
2. En Vercel: el login con Google debe redirigir a `https://finanzas-integraweb.vercel.app/dashboard`