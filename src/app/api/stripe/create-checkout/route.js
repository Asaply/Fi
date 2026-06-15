import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getAuthUser, unauthorized, serverError } from '@/lib/apiAuth';

export const runtime = 'nodejs';

function getStripe() { return new Stripe(process.env.STRIPE_SECRET_KEY); }

export async function POST(request) {
    const user = await getAuthUser();
    if (!user) return unauthorized();

    try {
        const origin = request.headers.get('origin') || 'https://nva.lat';

        const session = await getStripe().checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [{
                price: process.env.STRIPE_PRICE_ID,   // recurring monthly price
                quantity: 1,
            }],
            client_reference_id: user.id,      // used to identify user on webhook
            customer_email: user.email,
            success_url: `${origin}/paywall/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/paywall?error=cancelled`,
            metadata: { user_id: user.id },
            // Propagate user_id onto the subscription so customer.subscription.*
            // and invoice.* webhook events can resolve the user.
            subscription_data: { metadata: { user_id: user.id } },
        });

        return NextResponse.json({ url: session.url });

    } catch (err) {
        return serverError('stripe/create-checkout', err);
    }
}
