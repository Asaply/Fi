import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get('ticker');

    if (!ticker) {
        return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
    }

    try {
        // 1. Search for the coin ID
        const searchRes = await fetch(`https://api.coingecko.com/api/v3/search?query=${ticker}`, {
            headers: {
                'Accept': 'application/json'
            },
            next: { revalidate: 3600 } // Cache id search highly because ids don't change
        });

        if (!searchRes.ok) {
            return NextResponse.json({ error: 'Failed to search coin id' }, { status: searchRes.status });
        }

        const searchData = await searchRes.json();
        
        let coinId = null;
        if (searchData.coins && searchData.coins.length > 0) {
            // Priority matching: exactly same symbol
            const exactMatch = searchData.coins.find(c => c.symbol.toLowerCase() === ticker.toLowerCase());
            coinId = exactMatch ? exactMatch.id : searchData.coins[0].id;
        }

        if (!coinId) {
            return NextResponse.json({ error: 'Coin not found on CoinGecko' }, { status: 404 });
        }

        // 2. Fetch price
        const priceRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`, {
            headers: {
                'Accept': 'application/json'
            },
            next: { revalidate: 60 } // Cache for 60 seconds against rate limit
        });

        if (!priceRes.ok) {
            return NextResponse.json({ error: 'Failed to get coin price' }, { status: priceRes.status });
        }

        const priceData = await priceRes.json();

        if (priceData[coinId] && priceData[coinId].usd) {
            return NextResponse.json({ price: priceData[coinId].usd });
        }

        return NextResponse.json({ error: 'Price not available in response' }, { status: 404 });

    } catch (error) {
        console.error('CoinGecko Proxy Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
