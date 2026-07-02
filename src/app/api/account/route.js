import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getAuthUser, unauthorized, serverError } from '@/lib/apiAuth'

// Full account deletion (App Store Guideline 5.1.1(v)): removes all user data
// AND the auth user itself. Authenticates via Bearer token (native app) or
// session cookie (web) through getAuthUser, so both platforms delete completely.
export async function DELETE() {
    const user = await getAuthUser()
    if (!user) return unauthorized()

    const userId = user.id
    try {
        const adminClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        )

        const tables = ['transactions', 'trading_operations', 'portfolio_assets', 'clients', 'prospects', 'budgets', 'reminders']
        for (const table of tables) {
            await adminClient.from(table).delete().eq('user_id', userId)
        }

        const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)
        if (deleteError) return serverError('account/delete admin', deleteError)

        return NextResponse.json({ success: true })
    } catch (err) {
        return serverError('account/delete', err)
    }
}
