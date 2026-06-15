import { NextResponse } from 'next/server';
import { getAuthUser, unauthorized, serverError } from '@/lib/apiAuth';
import { getAdminClient } from '@/lib/stripeSync';
import { auditLog } from '@/lib/auditLog';
import {
    verifyTransaction,
    deriveAppleStatus,
    applyAppleSubscription,
    APPLE_BUNDLE_ID,
    APPLE_PRODUCT_ID,
} from '@/lib/appleIap';

export const runtime = 'nodejs';

// POST /api/iap/verify  { jws }
// Verifies a StoreKit signed transaction from the native app and activates the
// subscription. Called after a purchase or a Restore Purchases.
export async function POST(request) {
    try {
        const user = await getAuthUser();
        if (!user) return unauthorized();

        const { jws } = await request.json().catch(() => ({}));
        if (!jws) return NextResponse.json({ error: 'missing_jws' }, { status: 400 });

        let tx;
        try {
            tx = await verifyTransaction(jws);
        } catch (err) {
            console.error('[iap/verify] JWS verification failed:', err?.message);
            return NextResponse.json({ active: false, error: 'invalid_transaction' }, { status: 400 });
        }

        if (tx.bundleId !== APPLE_BUNDLE_ID || tx.productId !== APPLE_PRODUCT_ID) {
            return NextResponse.json({ active: false, error: 'product_mismatch' }, { status: 400 });
        }

        const { status, expiresAt } = deriveAppleStatus(tx);
        const admin = getAdminClient();
        await applyAppleSubscription(admin, user.id, {
            status,
            expiresAt,
            originalTransactionId: tx.originalTransactionId,
        });

        auditLog({
            userId: user.id,
            event: 'iap.verified',
            meta: { transaction_id: tx.transactionId, status, expires_at: expiresAt },
        });

        return NextResponse.json({ active: status === 'active', expiresAt });
    } catch (err) {
        return serverError('iap/verify', err);
    }
}
