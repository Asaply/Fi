import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get('ticker');
    const range = searchParams.get('range'); // e.g. 7d, 1y

    if (!ticker) {
        return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
    }

    try {
        // 1. Search ID
        const searchRes = await fetch(`https://api.coingecko.com/api/v3/search?query=${ticker}`, {
            headers: { 'Accept': 'application/json' },
            next: { revalidate: 3600 } 
        });

        if (!searchRes.ok) return NextResponse.json({ error: 'Failed search' }, { status: searchRes.status });
        const searchData = await searchRes.json();
        
        let coinId = null;
        if (searchData.coins && searchData.coins.length > 0) {
            const exactMatch = searchData.coins.find(c => c.symbol.toLowerCase() === ticker.toLowerCase());
            coinId = exactMatch ? exactMatch.id : searchData.coins[0].id;
        }

        if (!coinId) return NextResponse.json({ error: 'Coin not found' }, { status: 404 });

        // 2. Fetch history or simple price
        if (range) {
            let days = '1';
            if (range === '7d') days = '7';
            else if (range === '1mo') days = '30';
            else if (range === '1y' || range === 'ytd') days = '365';

            const marketRes = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`, {
                headers: { 'Accept': 'application/json' },
                next: { revalidate: 300 } // Cache historics longer 5 min
            });

            if (marketRes.ok) {
                const marketData = await marketRes.json();
                if (marketData.prices && marketData.prices.length > 0) {
                    const latestPrice = marketData.prices[marketData.prices.length - 1][1];
                    const history = marketData.prices.map(p => ({
                        time: Math.floor(p[0] / 1000), // convert ms to s
                        price: p[1]
                    }));
                    return NextResponse.json({ price: latestPrice, history });
                }
            }
        }
    
        // Fallback or no range requested
        const priceRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`, {
            headers: { 'Accept': 'application/json' },
            next: { revalidate: 60 }
        });

        const priceData = await priceRes.json();
        if (priceData[coinId]?.usd) {
            return NextResponse.json({ price: priceData[coinId].usd, history: [] });
        }

        return NextResponse.json({ error: 'Price not available' }, { status: 404 });
    } catch (error) {
        console.error('CoinGecko Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
