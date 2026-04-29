import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(req) {
    let res = NextResponse.next({ request: { headers: req.headers } })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll() {
                    return req.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
                    res = NextResponse.next({ request: req })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        res.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    const { data: { session } } = await supabase.auth.getSession()

    const { pathname } = req.nextUrl
    const isLoginPage    = pathname === '/login'
    const isRoot         = pathname === '/'
    const isOnboarding   = pathname === '/onboarding'
    // /auth/* handles email verification and OAuth callbacks — always allow through
    const isAuthCallback = pathname.startsWith('/auth/')

    // Unauthenticated — redirect to /login (except login page and auth callbacks)
    if (!session && !isLoginPage && !isAuthCallback) {
        return NextResponse.redirect(new URL('/login', req.url))
    }

    // Authenticated on login or root — go to dashboard
    // Onboarding manages its own redirect (localStorage check)
    if (session && (isLoginPage || isRoot)) {
        return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    return res
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico|manifest.json|favicon.png|apple-icon.png).*)'],
}
