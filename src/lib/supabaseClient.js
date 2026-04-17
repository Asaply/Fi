import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase credentials are required. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

// createBrowserClient stores auth tokens in cookies instead of localStorage,
// which makes the session readable by Next.js middleware for route protection.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
