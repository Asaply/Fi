import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase credentials are required. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

// Capacitor: use localStorage-based client (cookies don't work at capacitor://localhost)
// Web: use cookie-based client (readable by Next.js middleware for route protection)
const isNative = typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.()

// Native session storage backed by Capacitor Preferences (native, persistent).
// WKWebView localStorage at capacitor://localhost can be purged by iOS when the
// app closes, which was logging users out on every launch. Preferences survives.
// Dynamic import keeps the plugin out of the web/SSR bundle.
const nativeStorage = {
    getItem: async (key) => {
        const { Preferences } = await import('@capacitor/preferences')
        const { value } = await Preferences.get({ key })
        return value
    },
    setItem: async (key, value) => {
        const { Preferences } = await import('@capacitor/preferences')
        await Preferences.set({ key, value })
    },
    removeItem: async (key) => {
        const { Preferences } = await import('@capacitor/preferences')
        await Preferences.remove({ key })
    },
}

export const supabase = isNative
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            storage: nativeStorage,
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
        },
    })
    : createBrowserClient(supabaseUrl, supabaseAnonKey)
