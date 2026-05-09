import { NextResponse } from 'next/server';
import belvo from 'belvo';
import { getAuthUser, unauthorized, serverError } from '@/lib/apiAuth';

export async function POST(req) {
    const user = await getAuthUser();
    if (!user) return unauthorized();

    try {
        const body = await req.json();
        const { link_id, date_from, date_to } = body;

        if (!link_id || typeof link_id !== 'string' || link_id.length > 100) {
            return NextResponse.json({ error: 'link_id inválido.' }, { status: 400 });
        }

        const client = new belvo(
            process.env.BELVO_SECRET_ID,
            process.env.BELVO_SECRET_PASSWORD,
            process.env.BELVO_ENVIRONMENT || 'sandbox'
        );

        await client.connect();

        const d_to = date_to || new Date().toISOString().split('T')[0];
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - 90);
        const d_from = date_from || fromDate.toISOString().split('T')[0];

        const response = await client.transactions.retrieve(link_id, d_from, {
            dateTo: d_to,
            saveData: true,
        });

        const transactionsList = response.results || response;

        const mappedTransactions = transactionsList.map(tx => ({
            external_id: tx.id,
            date: tx.value_date || tx.created_at,
            concept: tx.description,
            amount: Math.abs(tx.amount),
            type: tx.type === 'INFLOW' ? 'Ingreso' : 'Egreso',
            status: tx.status === 'PENDING' ? 'pending' : 'completed',
            bank_name: tx.account?.institution?.name || 'Bank',
            currency: tx.currency,
        }));

        return NextResponse.json({
            success: true,
            count: mappedTransactions.length,
            transactions: mappedTransactions,
        });

    } catch (error) {
        return serverError('belvo/transactions', error);
    }
}
