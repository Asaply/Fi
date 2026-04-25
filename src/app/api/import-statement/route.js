import { NextResponse } from 'next/server';
import { detectBank, needsOCR, parseBankStatement } from '@/lib/parsers/bank-statement-parser';

async function extractPDFText(buffer) {
    try {
        const pdfParse = (await import('pdf-parse')).default;
        const data = await pdfParse(buffer);
        return data.text;
    } catch {
        return '';
    }
}

export async function POST(req) {
    try {
        const formData = await req.formData();
        const file = formData.get('file');
        const ocrTextInput = formData.get('ocrText');

        if (!file) {
            return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const filename = file.name;

        // Extract digital text first
        let text = await extractPDFText(buffer);

        // If client sent OCR text (for HSBC/Santander processed via Claude Vision)
        if (ocrTextInput && ocrTextInput.length > 100) {
            text = ocrTextInput;
        }

        const bank = detectBank(text, filename);

        // If text is unreadable/image PDF, tell client to do OCR
        if (!bank || needsOCR(text)) {
            const bankFromFile = detectBank('', filename);
            const status = needsOCR(text) && bankFromFile ? 200 : 422;
            return NextResponse.json({
                requiresOCR: true,
                bank: bankFromFile,
                message: bankFromFile
                    ? `El PDF de ${bankFromFile.toUpperCase()} requiere procesamiento de imagen. Enviando a OCR...`
                    : 'No se pudo detectar el banco. Verifica que el archivo sea un estado de cuenta válido.',
            }, { status });
        }

        const result = parseBankStatement(text, filename);

        if (!result || result.transactions.length === 0) {
            return NextResponse.json({
                error: 'No se encontraron transacciones. El formato del PDF puede haber cambiado.',
                bank,
                debug: { textLength: text.length, textSample: text.slice(0, 200) },
            }, { status: 422 });
        }

        return NextResponse.json({
            banco: result.banco,
            cuenta: result.cuenta,
            periodo: result.periodo,
            transactionCount: result.transactions.length,
            transactions: result.transactions,
        });

    } catch (err) {
        console.error('[import-statement]', err);
        return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 });
    }
}
