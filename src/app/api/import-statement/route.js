import { NextResponse } from 'next/server';
import { detectBank, needsOCR, parseBankStatement } from '@/lib/parsers/bank-statement-parser';
import { getAuthUser, unauthorized, serverError, validateUpload } from '@/lib/apiAuth';

async function extractPDFText(buffer) {
    try {
        const pdfParseMod = await import('pdf-parse');
        const PDFParse = pdfParseMod.PDFParse || pdfParseMod.default?.PDFParse;
        const parser = new PDFParse({ data: new Uint8Array(buffer), verbosity: 0 });
        const data = await parser.getText();
        return data.text;
    } catch {
        return '';
    }
}

export async function POST(req) {
    const user = await getAuthUser();
    if (!user) return unauthorized();

    try {
        const formData = await req.formData();
        const file = formData.get('file');
        const ocrTextInput = formData.get('ocrText');

        const uploadError = validateUpload(file, { maxBytes: 10 * 1024 * 1024, allowedTypes: ['application/pdf'] });
        if (uploadError) return NextResponse.json({ error: uploadError }, { status: 400 });

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
        return serverError('import-statement', err);
    }
}
