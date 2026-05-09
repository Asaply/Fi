import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  if (!user) {
    // API routes → 401 JSON (not redirect)
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
    }
    // /login and / are public — let unauthenticated users through
    if (pathname === '/login' || pathname === '/') {
      return response
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Authenticated user on login or root → send to app
  if (pathname === '/login' || pathname === '/') {
    return NextResponse.redirect(new URL('/finanzas', request.url))
  }

  return response
}

export const config = {
  matcher: [
    // Public entry points — redirect authenticated users away
    '/',
    '/login',
    // Dev tools — require auth (never exposed to anonymous users in production)
    '/dev/:path*',
    // App pages — require auth
    '/dashboard/:path*',
    '/finanzas/:path*',
    '/trading/:path*',
    '/portfolio/:path*',
    '/configuracion/:path*',
    '/perfil/:path*',
    '/clientes/:path*',
    '/prospectos/:path*',
    '/airbnb/:path*',
    // Sensitive API routes
    '/api/parse-statement/:path*',
    '/api/parse-ai/:path*',
    '/api/import-statement/:path*',
    // /api/analyze is intentionally public — handles anonymous free-tier with IP rate limiting
    '/api/price/:path*',
    '/api/crypto/:path*',
    '/api/belvo/:path*',
  ],
}
