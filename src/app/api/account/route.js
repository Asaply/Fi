import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function DELETE(request) {
    // Authenticate the user via their session cookie
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll() { return request.cookies.getAll() },
                setAll() {},
            },
        }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const userId = user.id

    try {
        // Delete user data from all tables
        const tables = ['transactions', 'trading_operations', 'portfolio_assets', 'clients', 'prospects', 'budgets', 'reminders']
        for (const table of tables) {
            await supabase.from(table).delete().eq('user_id', userId)
        }

        // Delete auth user via admin API (requires service role)
        const adminClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        )
        const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)
        if (deleteError) {
            console.error('[account/delete] admin deleteUser error:', deleteError.message)
            return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('[account/delete] error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
