import { NextResponse } from 'next/server';
import { getAuthUser, unauthorized, serverError } from '@/lib/apiAuth';

export const runtime = 'nodejs';

export async function POST(request) {
    const user = await getAuthUser();
    if (!user) return unauthorized();

    try {
        const origin = request.headers.get('origin') || 'https://finanzas-integraweb.vercel.app';

        const preference = {
            items: [{
                id: 'nva-acceso-completo',
                title: 'NVA — Acceso completo',
                description: 'Pago único para activar tu cuenta NVA',
                quantity: 1,
                unit_price: 50,
                currency_id: 'MXN',
            }],
            payer: {
                email: user.email,
            },
            back_urls: {
                success: `${origin}/paywall/success`,
                failure: `${origin}/paywall?error=failed`,
                pending: `${origin}/paywall?status=pending`,
            },
            auto_return: 'approved',
            external_reference: user.id,
            notification_url: `${origin}/api/mp/webhook`,
            statement_descriptor: 'NVA Finance',
        };

        const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
            },
            body: JSON.stringify(preference),
        });

        if (!res.ok) {
            const err = await res.text();
            console.error('[mp/create-preference] MP error:', err);
            return NextResponse.json({ error: 'Error al crear preferencia de pago.' }, { status: 500 });
        }

        const data = await res.json();
        return NextResponse.json({ init_point: data.init_point, id: data.id });

    } catch (err) {
        return serverError('mp/create-preference', err);
    }
}
