import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')

    if (code) {
        const cookieStore = await cookies()

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll()
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    },
                },
            }
        )

        const { data } = await supabase.auth.exchangeCodeForSession(code)

        // If a specific next route is requested (e.g. password reset), go there.
        // Validate it's a relative path to prevent open redirect attacks.
        const next = requestUrl.searchParams.get('next')
        if (next && /^\/[^/]/.test(next)) {
            return NextResponse.redirect(new URL(next, requestUrl.origin))
        }

        // Existing user (already onboarded) → skip walkthrough
        if (data?.user?.user_metadata?.onboarded) {
            return NextResponse.redirect(new URL('/finanzas', requestUrl.origin))
        }
    }

    // New user — show onboarding walkthrough
    return NextResponse.redirect(new URL('/onboarding', requestUrl.origin))
}
