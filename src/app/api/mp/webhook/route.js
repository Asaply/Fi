import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';
import { checkRateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';

function getAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

/**
 * Verify MercadoPago webhook signature.
 * Docs: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
 * Header x-signature: "ts=<epoch>,v1=<hmac_hex>"
 * Signed template: "id:<data.id>;request-id:<x-request-id>;ts:<ts>"
 */
function verifyMPSignature(request, dataId, rawSignature, requestId) {
    const secret = process.env.MP_WEBHOOK_SECRET;
    if (!secret) {
        // If secret not configured, skip verification but log warning
        console.warn('[mp/webhook] MP_WEBHOOK_SECRET not set — skipping signature check');
        return true;
    }
    if (!rawSignature) return false;

    // Parse "ts=...,v1=..."
    const parts = Object.fromEntries(
        rawSignature.split(',').map(p => p.split('='))
    );
    const { ts, v1 } = parts;
    if (!ts || !v1) return false;

    // Reject stale webhooks (>5 min)
    if (Math.abs(Date.now() - Number(ts) * 1000) > 5 * 60 * 1000) {
        console.warn('[mp/webhook] Stale webhook timestamp:', ts);
        return false;
    }

    const template = `id:${dataId};request-id:${requestId ?? ''};ts:${ts}`;
    const expected = createHmac('sha256', secret).update(template).digest('hex');

    return expected === v1;
}

export async function POST(request) {
    // Rate limit by IP: 60 webhooks per minute
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const rl = checkRateLimit(`mp-webhook:${ip}`, { maxRequests: 60, windowMs: 60_000 });
    if (!rl.allowed) {
        return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    try {
        const body = await request.json();

        const topic = body.type || body.topic;
        const paymentId = body.data?.id || body.id;

        if (topic !== 'payment' || !paymentId) {
            return NextResponse.json({ ok: true });
        }

        // Verify MP signature
        const xSignature = request.headers.get('x-signature');
        const xRequestId = request.headers.get('x-request-id');
        if (!verifyMPSignature(request, paymentId, xSignature, xRequestId)) {
            console.warn('[mp/webhook] Invalid signature for payment:', paymentId);
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        // Fetch payment details from MP
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
        });

        if (!mpRes.ok) {
            console.error('[mp/webhook] Failed to fetch payment:', paymentId);
            return NextResponse.json({ error: 'MP fetch failed' }, { status: 500 });
        }

        const payment = await mpRes.json();
        const userId = payment.external_reference;
        const status = payment.status;

        if (!userId) {
            console.error('[mp/webhook] No external_reference in payment:', paymentId);
            return NextResponse.json({ ok: true });
        }

        const supabase = getAdminClient();

        // Upsert subscription record
        const { error: dbErr } = await supabase
            .from('subscriptions')
            .upsert({
                user_id: userId,
                status: status === 'approved' ? 'active' : status,
                mp_payment_id: String(paymentId),
                mp_payment_data: payment,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });

        if (dbErr) console.error('[mp/webhook] DB upsert error:', dbErr.message);

        if (status === 'approved') {
            const { error: metaErr } = await supabase.auth.admin.updateUserById(userId, {
                user_metadata: { subscription_status: 'active' },
            });
            if (metaErr) console.error('[mp/webhook] Metadata update error:', metaErr.message);
        }

        return NextResponse.json({ ok: true });

    } catch (err) {
        console.error('[mp/webhook] Error:', err?.message);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
