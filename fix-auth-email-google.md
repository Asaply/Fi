# fix-auth-email-google.md

## Objetivo
1. Auto-login tras verificar email (sin tener que volver a escribir credenciales)
2. Fix Google OAuth — actualmente da error "provider is not enabled"
3. Agregar logo FNCE en la página de login

---

## Fix 1: Auto-login tras verificación de email

### El problema
Supabase manda un email con un link de verificación. Al hacer click, el usuario llega a una URL de callback pero la app no lo procesa y lo manda a login manualmente.

### Solución: crear ruta de callback de auth

Crear `src/app/auth/callback/route.ts`:

```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = createRouteHandlerClient({ cookies })
    await supabase.auth.exchangeCodeForSession(code)
  }

  // Redirigir a la app después de verificar — ya está autenticado
  return NextResponse.redirect(new URL('/finanzas', requestUrl.origin))
}
```

### Configurar Supabase para usar esta ruta de callback

En el dashboard de Supabase → Authentication → URL Configuration:
- **Site URL:** `http://localhost:3005` (dev) / `https://finanzas-integraweb.vercel.app` (prod)
- **Redirect URLs:** agregar `http://localhost:3005/auth/callback` y `https://finanzas-integraweb.vercel.app/auth/callback`

En `src/app/login/page.tsx`, modificar el signUp para usar el redirect correcto:

```typescript
const { error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: `${window.location.origin}/auth/callback`,
  },
})
```

### Cambiar mensaje de confirmación
Después de registrarse, en lugar de mostrar el mensaje genérico, mostrar:
```tsx
// Reemplazar el mensaje de éxito por:
{registered && (
  <div className="bg-[#1a2a1a] border border-green-800 rounded-lg p-4 text-sm text-green-400">
    ✓ Revisa tu email y haz click en el link de verificación. Al hacerlo, entrarás automáticamente a la app.
  </div>
)}
```

---

## Fix 2: Google OAuth

### El problema
Error: `"Unsupported provider: provider is not enabled"` — Google OAuth no está habilitado en Supabase.

### Pasos a seguir en Google Cloud Console
1. Ir a https://console.cloud.google.com
2. Crear un proyecto nuevo o usar uno existente
3. APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
4. Application type: Web application
5. Authorized redirect URIs: agregar exactamente esta URL (copiar del dashboard de Supabase):
   `https://[tu-proyecto].supabase.co/auth/v1/callback`
   (La URL está en Supabase → Authentication → Providers → Google)
6. Copiar el **Client ID** y **Client Secret**

### Activar en Supabase
1. Supabase Dashboard → Authentication → Providers → Google
2. Habilitar toggle
3. Pegar Client ID y Client Secret
4. Guardar

### En el código — NO hay que cambiar nada
El botón de Google en `src/app/login/page.tsx` ya tiene el código correcto. Solo falta que el provider esté activado en Supabase. Una vez activado, el botón funcionará.

Si quieres que el redirect post-Google también use el callback:
```typescript
async function handleGoogleAuth() {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { 
      redirectTo: `${window.location.origin}/auth/callback`
    }
  })
}
```

---

## Fix 3: Logo FNCE en la página de login

En `src/app/login/page.tsx`, reemplazar el div del logo por el logo real de la app.

Buscar el archivo del logo (probablemente `public/logo.svg`, `public/logo.png` o `public/favicon.ico`). Si existe, usarlo:

```tsx
// Reemplazar el div del $ por:
import Image from 'next/image'

// En el JSX:
<div className="flex flex-col items-center mb-8">
  <Image 
    src="/logo.png"   // ajustar al nombre real del archivo en /public
    alt="FNCE" 
    width={64} 
    height={64}
    className="mb-3"
  />
  <h1 className="text-white text-2xl font-bold tracking-tight">FNCE</h1>
  <p className="text-gray-500 text-sm mt-1">Tus finanzas en un solo lugar</p>
</div>
```

Si no hay logo como archivo, usar el ícono del sidebar (el componente que ya existe con el $):
```tsx
// Importar el mismo componente de logo que usa el sidebar
import { FNCELogo } from '@/components/ui/Logo' // ajustar ruta real
```

Buscar en `src/components/` el componente que renderiza "FNCE" con el ícono azul del sidebar y reutilizarlo aquí.

---

## Archivos a crear
- `src/app/auth/callback/route.ts`

## Archivos a modificar
- `src/app/login/page.tsx` — emailRedirectTo, mensaje post-registro, logo, Google redirect
