import { NextResponse } from 'next/server';
import { withCors, corsOptions } from '@/lib/cors';
import { getAuthUser, unauthorized } from '@/lib/apiAuth';

const TICKER_RE = /^[A-Z0-9.\-^=]{1,20}$/i;
const VALID_RANGES = new Set(['1d', '7d', '1mo', '1y', 'ytd']);

export async function OPTIONS(request) {
    return corsOptions(request);
}

export async function GET(request) {
    const user = await getAuthUser();
    if (!user) return unauthorized();

    const origin = request.headers.get('origin') || '';
    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get('ticker');
    const range = searchParams.get('range');

    if (!ticker) {
        return withCors(NextResponse.json({ error: 'Ticker is required' }, { status: 400 }), origin);
    }

    if (!TICKER_RE.test(ticker)) {
        return withCors(NextResponse.json({ error: 'Ticker inválido.' }, { status: 400 }), origin);
    }

    if (range && !VALID_RANGES.has(range)) {
        return withCors(NextResponse.json({ error: 'Range inválido.' }, { status: 400 }), origin);
    }

    try {
        let url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`;
        
        // If an extended range is requested, adjust query params for historical data
        if (range) {
            let interval = '1d';
            if (range === '7d') interval = '1d';
            else if (range === '1mo') interval = '1d';
            else if (range === '1y' || range === 'ytd') interval = '1d'; // Simplify to 1d
            
            url += `?range=${range}&interval=${interval}`;
        }

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Accept': 'application/json'
            },
            next: { revalidate: 60 } 
        });

        if (!response.ok) {
            return withCors(NextResponse.json({ error: 'Failed to fetch' }, { status: response.status }), origin);
        }

        const data = await response.json();
        const result = data?.chart?.result?.[0];

        if (result) {
            const price = result.meta.regularMarketPrice;
            let history = [];
            if (range && result.timestamp && result.indicators?.quote?.[0]?.close) {
                const closes = result.indicators.quote[0].close;
                history = result.timestamp.map((t, i) => ({
                    time: t,
                    price: closes[i] || null
                })).filter(h => h.price !== null);
            }
            return withCors(NextResponse.json({ price, history }), origin);
        }

        return withCors(NextResponse.json({ error: 'Data not found' }, { status: 404 }), origin);
    } catch (error) {
        console.error('Yahoo Finance Proxy Error:', error);
        return withCors(NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }), origin);
    }
}
