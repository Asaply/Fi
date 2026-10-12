// Client-side: decides whether the paywall can promise the free trial.
// RLS lets a user read only their own subscriptions row.
import { supabase } from '@/lib/supabaseClient';

export async function isTrialEligible(userId) {
    if (!userId) return true;
    const { data } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();
    return !data;
}
