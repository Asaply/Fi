import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function GET(request) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const next = requestUrl.searchParams.get('next')

    if (code) {
        // Create response first — cookies MUST be set on the returned response
        const response = NextResponse.redirect(new URL('/paywall', requestUrl.origin))

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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

        const { data, error } = await supabase.auth.exchangeCodeForSession(code)

        if (error) {
            console.error('[auth/callback] exchangeCodeForSession error:', error.message)
            return NextResponse.redirect(new URL('/login', requestUrl.origin))
        }

        const user = data?.user

        // Explicit next param (e.g. password reset) — validate relative path
        if (next && /^\/[^/]/.test(next)) {
            const nextResponse = NextResponse.redirect(new URL(next, requestUrl.origin))
            response.cookies.getAll().forEach(({ name, value, ...opts }) => {
                nextResponse.cookies.set(name, value, opts)
            })
            return nextResponse
        }

        // Determine correct destination based on user state
        const isOnboarded = !!user?.user_metadata?.onboarded
        const dest = isOnboarded ? '/finanzas' : '/onboarding'

        const destResponse = NextResponse.redirect(new URL(dest, requestUrl.origin))
        response.cookies.getAll().forEach(({ name, value, ...opts }) => {
            destResponse.cookies.set(name, value, opts)
        })
        return destResponse
    }

    // No code — send to login
    return NextResponse.redirect(new URL('/login', requestUrl.origin))
}
