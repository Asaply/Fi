import { NextResponse } from 'next/server';
import belvo from 'belvo';
import { getAuthUser, unauthorized, serverError } from '@/lib/apiAuth';

export async function GET() {
    const user = await getAuthUser();
    if (!user) return unauthorized();

    try {
        const client = new belvo(
            process.env.BELVO_SECRET_ID,
            process.env.BELVO_SECRET_PASSWORD,
            process.env.BELVO_ENVIRONMENT || 'sandbox'
        );

        await client.connect();
        const tokenData = await client.widgetToken.create();

        return NextResponse.json({ accessToken: tokenData.access });
    } catch (error) {
        return serverError('belvo/token', error);
    }
}
