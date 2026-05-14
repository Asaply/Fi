import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function GET(request) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const next = requestUrl.searchParams.get('next')

    if (code) {
        // Default redirect — onboarding handles routing for existing users too
        const redirectUrl = (next && /^\/[^/]/.test(next))
            ? new URL(next, requestUrl.origin)
            : new URL('/onboarding', requestUrl.origin)

        const response = NextResponse.redirect(redirectUrl)

        // Cookies MUST be set on the response object that is returned
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

        // Already onboarded → skip onboarding, go to finanzas
        // Redirect to finanzas but preserve cookies already set on response
        if (!next && data?.user?.user_metadata?.onboarded) {
            const finanzasResponse = NextResponse.redirect(new URL('/finanzas', requestUrl.origin))
            response.cookies.getAll().forEach(({ name, value, ...opts }) => {
                finanzasResponse.cookies.set(name, value, opts)
            })
            return finanzasResponse
        }

        return response
    }

    // No code — send to login
    return NextResponse.redirect(new URL('/login', requestUrl.origin))
}
