import { NextResponse } from 'next/server';
import belvo from 'belvo';

export async function POST(req) {
    try {
        const body = await req.json();
        const { link_id, date_from, date_to } = body;

        if (!link_id) {
            return NextResponse.json({ error: "link_id is required." }, { status: 400 });
        }

        const client = new belvo(
            process.env.BELVO_SECRET_ID,
            process.env.BELVO_SECRET_PASSWORD,
            process.env.BELVO_ENVIRONMENT || 'sandbox'
        );

        // Required to initialize Belvo SDK objects internally
        await client.connect();

        // Belvo transaction requests require a date range. 
        // We default to the last 90 days.
        const d_to = date_to || new Date().toISOString().split('T')[0];
        
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - 90);
        const d_from = date_from || fromDate.toISOString().split('T')[0];

        // Fetches ALL transactions within the range. Note: This can take some time if there are thousands.
        console.log(`Buscando transacciones en Belvo para link_id: ${link_id} de ${d_from} a ${d_to}`);
        
        const response = await client.transactions.retrieve(link_id, d_from, {
            dateTo: d_to,
            saveData: true // Instructs Belvo to store it in their DB for future queries
        });

        // The exact structure of response varies depending on the API version, usually it's an array directly or inside 'results' (in v2 pagination).
        const transactionsList = response.results || response;

        // Map Belvo data structure to our app structure
        const mappedTransactions = transactionsList.map(tx => {
            return {
                external_id: tx.id,
                date: tx.value_date || tx.created_at,
                concept: tx.description,
                amount: Math.abs(tx.amount), // Always positive for our app, type handles +/- 
                type: tx.type === 'INFLOW' ? 'Ingreso' : 'Egreso', // INFLOW or OUTFLOW
                status: tx.status === 'PENDING' ? 'pending' : 'completed',
                bank_name: tx.account?.institution?.name || 'Bank',
                currency: tx.currency
            };
        });

        return NextResponse.json({ 
            success: true, 
            count: mappedTransactions.length,
            transactions: mappedTransactions 
        });

    } catch (error) {
        console.error("Belvo Transactions Error:", error);
        return NextResponse.json({ error: error.message || "Failed to retrieve transactions." }, { status: 500 });
    }
}
