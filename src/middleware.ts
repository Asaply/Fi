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

  // Public routes — no auth required
  const isPublic = pathname === '/' || pathname === '/login' ||
    pathname.startsWith('/analyze') || pathname.startsWith('/auth/') ||
    pathname.startsWith('/terms') || pathname.startsWith('/privacy') ||
    pathname.startsWith('/paywall') || pathname.startsWith('/api/mp/webhook')

  if (!user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
    }
    if (isPublic) return response
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Authenticated user on login or root → send to app
  if (pathname === '/login' || pathname === '/') {
    return NextResponse.redirect(new URL('/finanzas', request.url))
  }

  // Paywall check — skip for paywall pages and API routes
  const isPaid = user.user_metadata?.subscription_status === 'active'
  const isPaywallRoute = pathname.startsWith('/paywall')
  const isApiRoute = pathname.startsWith('/api/')

  if (!isPaid && !isPaywallRoute && !isApiRoute) {
    return NextResponse.redirect(new URL('/paywall', request.url))
  }

  // Paid user trying to access paywall → send to app
  if (isPaid && isPaywallRoute) {
    return NextResponse.redirect(new URL('/finanzas', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/paywall/:path*',
    '/dev/:path*',
    '/dashboard/:path*',
    '/finanzas/:path*',
    '/trading/:path*',
    '/portfolio/:path*',
    '/configuracion/:path*',
    '/perfil/:path*',
    '/clientes/:path*',
    '/prospectos/:path*',
    '/airbnb/:path*',
    '/api/parse-statement/:path*',
    '/api/parse-ai/:path*',
    '/api/import-statement/:path*',
    '/api/price/:path*',
    '/api/crypto/:path*',
    '/api/belvo/:path*',
    '/api/mp/create-preference/:path*',
  ],
}
