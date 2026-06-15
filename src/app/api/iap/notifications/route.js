import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/stripeSync';
import { auditLog } from '@/lib/auditLog';
import {
    verifyNotification,
    verifyTransaction,
    deriveAppleStatus,
    applyAppleSubscription,
    findUserByOriginalTxId,
} from '@/lib/appleIap';

export const runtime = 'nodejs';

// POST /api/iap/notifications  { signedPayload }
// App Store Server Notifications V2: renewals, cancellations, refunds, etc.
// Public (Apple-signed, no user session) — must be in middleware isPublic.
export async function POST(request) {
    let payload;
    try {
        payload = await request.json();
    } catch {
        return NextResponse.json({ error: 'bad_body' }, { status: 400 });
    }

    const signedPayload = payload?.signedPayload;
    if (!signedPayload) return NextResponse.json({ error: 'missing_signedPayload' }, { status: 400 });

    let notification;
    try {
        notification = await verifyNotification(signedPayload);
    } catch (err) {
        console.error('[iap/notifications] verification failed:', err?.message);
        return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
    }

    try {
        const signedTx = notification.data?.signedTransactionInfo;
        if (!signedTx) return NextResponse.json({ ok: true });   // e.g. TEST notification

        const tx = await verifyTransaction(signedTx);
        const admin = getAdminClient();
        const userId = await findUserByOriginalTxId(admin, tx.originalTransactionId);
        if (!userId) {
            console.warn('[iap/notifications] No user for originalTransactionId', tx.originalTransactionId);
            return NextResponse.json({ ok: true });
        }

        const { status, expiresAt } = deriveAppleStatus(tx, notification.notificationType);
        await applyAppleSubscription(admin, userId, {
            status,
            expiresAt,
            originalTransactionId: tx.originalTransactionId,
        });

        auditLog({
            userId,
            event: 'iap.notification',
            meta: { type: notification.notificationType, subtype: notification.subtype, status, expires_at: expiresAt },
        });

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error('[iap/notifications] handler error:', err?.message);
        return NextResponse.json({ error: 'handler_error' }, { status: 500 });
    }
}
