import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ALLOWED_ORIGINS = ['capacitor://localhost', 'http://localhost:3005', 'https://finanzas-integraweb.vercel.app']

function corsHeaders(origin: string | null) {
  const headers: Record<string, string> = {}
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, apikey, x-client-info'
    headers['Access-Control-Allow-Credentials'] = 'true'
  }
  return headers
}

export async function middleware(request: NextRequest) {
  const origin = request.headers.get('origin')

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
  }

  let response = NextResponse.next({ request })

  // Add CORS headers to all API responses
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const cors = corsHeaders(origin)
    Object.entries(cors).forEach(([k, v]) => response.headers.set(k, v))
  }

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
    pathname.startsWith('/paywall') ||
    pathname.startsWith('/api/stripe/webhook')

  if (!user) {
    // API routes with Bearer token — let route handler check auth
    if (pathname.startsWith('/api/') && request.headers.get('authorization')?.startsWith('Bearer ')) {
      return response
    }
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
    }
    if (isPublic) return response
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Authenticated user state
  const isPaid = user.user_metadata?.subscription_status === 'active'
  const isOnboarded = !!user.user_metadata?.onboarded
  const isPaywallRoute = pathname.startsWith('/paywall')
  const isOnboardingRoute = pathname.startsWith('/onboarding')
  const isApiRoute = pathname.startsWith('/api/')
  const isDevRoute = pathname.startsWith('/dev/')

  // Smart destination for this user
  // Order: onboarding first → paywall → app
  function getSmartDest() {
    if (!isOnboarded) return '/onboarding'
    if (!isPaid) return '/paywall'
    return '/finanzas'
  }

  // Authenticated user at login or root → smart redirect
  if (pathname === '/login' || pathname === '/') {
    return NextResponse.redirect(new URL(getSmartDest(), request.url))
  }

  // API + dev routes pass through
  if (isApiRoute || isDevRoute) return response

  // Not onboarded → must complete onboarding first (paywall is inside onboarding)
  if (!isOnboarded && !isOnboardingRoute) {
    return NextResponse.redirect(new URL('/onboarding', request.url))
  }

  // Onboarded but not paid → paywall
  if (isOnboarded && !isPaid && !isPaywallRoute) {
    return NextResponse.redirect(new URL('/paywall', request.url))
  }

  // Paid user at paywall → move on
  if (isPaid && isPaywallRoute) {
    return NextResponse.redirect(new URL(isOnboarded ? '/finanzas' : '/onboarding', request.url))
  }

  // Onboarded + paid hitting onboarding → finanzas
  if (isOnboarded && isPaid && isOnboardingRoute) {
    return NextResponse.redirect(new URL('/finanzas', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/onboarding',
    '/paywall/:path*',
    '/dev/:path*',
    '/dashboard/:path*',
    '/finanzas/:path*',
    '/trading/:path*',
    '/portfolio/:path*',
    '/configuracion/:path*',
    '/perfil/:path*',
    '/api/:path*',
  ],
}
