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

export const supabase = isNative
    ? createClient(supabaseUrl, supabaseAnonKey)
    : createBrowserClient(supabaseUrl, supabaseAnonKey)
