import { NextResponse } from 'next/server';
import belvo from 'belvo';

export async function GET() {
    try {
        const client = new belvo(
            process.env.BELVO_SECRET_ID,
            process.env.BELVO_SECRET_PASSWORD,
            process.env.BELVO_ENVIRONMENT || 'sandbox' // 'sandbox', 'development', 'production'
        );

        // Required explicitly by the JS SDK
        await client.connect();

        // Required parameters for the widget token
        // In highly secure apps you'd dynamically pass scopes, links, etc.
        const tokenData = await client.widgetToken.create();

        return NextResponse.json({ accessToken: tokenData.access });
    } catch (error) {
        console.error("Belvo Token Error:", error);
        return NextResponse.json({ error: "Failed to generate Belvo token." }, { status: 500 });
    }
}
