import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get('ticker');

    if (!ticker) {
        return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
    }

    try {
        const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json'
            },
            next: { revalidate: 60 } // Cache for 60 seconds
        });

        if (!response.ok) {
            return NextResponse.json({ error: 'Failed to fetch price' }, { status: response.status });
        }

        const data = await response.json();
        
        if (data.chart && data.chart.result && data.chart.result.length > 0) {
            const price = data.chart.result[0].meta.regularMarketPrice;
            return NextResponse.json({ price });
        }

        return NextResponse.json({ error: 'Price not found' }, { status: 404 });
    } catch (error) {
        console.error('Yahoo Finance Proxy Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
