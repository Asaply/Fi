import { NextResponse } from 'next/server';
import { parseBankStatement, detectBank } from '@/lib/parsers/bank-statement-parser';

export const runtime = 'nodejs';
export const maxDuration = 60;

const CATEGORY_COLORS = ['#FF8700', '#FFB366', '#FFD9B3', '#555', '#444', '#333'];

function buildInsights(transactions) {
    const expenses = transactions.filter(t => t.tipo === 'egreso' || t.tipo === 'cargo');
    const incomes  = transactions.filter(t => t.tipo === 'ingreso' || t.tipo === 'abono');

    const totalExpenses = expenses.reduce((s, t) => s + (Number(t.monto) || 0), 0);
    const totalIncome   = incomes.reduce((s, t)  => s + (Number(t.monto) || 0), 0);

    // Group by category
    const catMap = {};
    for (const t of expenses) {
        const cat = t.categoria || 'Otros';
        catMap[cat] = (catMap[cat] || 0) + (Number(t.monto) || 0);
    }

    const sortedCats = Object.entries(catMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);

    const categories = sortedCats.map(([name, amount], i) => ({
        name,
        amount: Math.round(amount),
        color: CATEGORY_COLORS[i] ?? '#333',
    }));

    const topCat = sortedCats[0];
    const mainInsight = topCat
        ? {
            category: topCat[0],
            amount: Math.round(topCat[1]),
            percentage: totalIncome > 0
                ? Math.round((topCat[1] / totalIncome) * 100)
                : null,
          }
        : null;

    // Group by merchant (concepto)
    const merchantMap = {};
    for (const t of expenses) {
        const name = String(t.concepto || '').split(' ').slice(0, 3).join(' ').trim() || 'Desconocido';
        merchantMap[name] = (merchantMap[name] || 0) + (Number(t.monto) || 0);
    }

    const topLeaks = Object.entries(merchantMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, amount]) => ({ name, amount: Math.round(amount) }));

    const recommendation = topLeaks[0]
        ? { action: `Reducir ${topLeaks[0].name} 30%`, savings: Math.round(topLeaks[0].amount * 0.3) }
        : null;

    return { mainInsight, topLeaks, recommendation, categories, totalIncome: Math.round(totalIncome), totalExpenses: Math.round(totalExpenses) };
}

async function extractTextFromPDF(buffer) {
    try {
        const pdfParseMod = await import('pdf-parse');
        const PDFParse = pdfParseMod.PDFParse || pdfParseMod.default?.PDFParse;
        const parser = new PDFParse({ data: new Uint8Array(buffer), verbosity: 0 });
        const data = await parser.getText();
        return data.text;
    } catch (error) {
        console.error('PDF EXTRACT ERROR:', error);
        throw error;
    }
}

async function fallbackAIParse(text, filename) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurada');

    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });

    const prompt = `Eres un parser de estados de cuenta bancarios mexicanos.
Extrae TODOS los movimientos del siguiente texto.
Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin backticks:
{
  "banco": "nombre del banco",
  "movimientos": [
    { "fecha": "YYYY-MM-DD", "concepto": "descripción", "monto": 0.00, "tipo": "egreso|ingreso", "categoria": "categoría" }
  ]
}
REGLAS:
- tipo "egreso": retiro/gasto/compra
- tipo "ingreso": depósito/pago recibido
- Fechas YYYY-MM-DD
- Omitir totales y encabezados

TEXTO:
${text.substring(0, 15000)}`;

    const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content[0].text.trim();
    const jsonStr = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
    const parsed = JSON.parse(jsonStr);

    const transactions = (parsed.movimientos ?? [])
        .map(m => ({
            fecha: m.fecha,
            concepto: String(m.concepto || '').trim().slice(0, 150),
            monto: Math.abs(Number(m.monto) || 0),
            tipo: m.tipo || 'egreso',
            categoria: m.categoria || 'Otros',
            banco: parsed.banco || 'Desconocido',
        }))
        .filter(t => t.monto > 0 && t.fecha);

    return { banco: parsed.banco || 'Desconocido', transactions };
}

export async function POST(request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file) {
            return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 });
        }

        const filename = file.name || '';
        const isCSV = /\.csv$/i.test(filename);

        let text;
        if (isCSV) {
            text = await file.text();
        } else {
            const buffer = Buffer.from(await file.arrayBuffer());
            try {
                text = await extractTextFromPDF(buffer);
            } catch (err) {
                return NextResponse.json({ error: 'No se pudo leer el PDF: ' + err.message }, { status: 422 });
            }
        }

        if (!text || text.trim().length < 50) {
            return NextResponse.json({ error: 'No se pudo extraer texto del archivo.' }, { status: 400 });
        }

        let bank = detectBank(text, filename);
        let result = bank ? parseBankStatement(text, filename, false) : null;

        if (!result || !result.transactions?.length) {
            result = await fallbackAIParse(text, filename);
        }

        const transactions = result.transactions ?? [];
        const insights = buildInsights(transactions);

        return NextResponse.json({
            success: true,
            bank: result.banco ?? bank ?? 'Desconocido',
            transactionCount: transactions.length,
            transactions,
            insights,
        });
    } catch (err) {
        console.error('[api/analyze]', err);
        return NextResponse.json({ error: err.message || 'Error procesando el archivo' }, { status: 500 });
    }
}
