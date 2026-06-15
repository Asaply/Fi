// Client helpers for the first-150-free promo.
import { supabase } from '@/lib/supabaseClient';
import { API_BASE } from '@/lib/apiBase';

async function authHeaders() {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
}

// { taken, limit, remaining } or null on failure.
export async function getRemainingSlots() {
    try {
        const res = await fetch(`${API_BASE}/api/access/claim`, { headers: await authHeaders() });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

// { granted, slot } | { granted:false, requiresPayment:true }.
export async function claimFreeSlot() {
    const res = await fetch(`${API_BASE}/api/access/claim`, {
        method: 'POST',
        headers: await authHeaders(),
    });
    return res.json();
}
