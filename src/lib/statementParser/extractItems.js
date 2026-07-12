// pdfjs-dist legacy build runs in the Node serverless runtime (no worker, no
// canvas needed for text extraction). It's ESM, so load it with a dynamic
// import (cached across calls).
let _pdfjs = null;
async function loadPdfjs() {
    if (!_pdfjs) _pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    return _pdfjs;
}

/**
 * Extract every text fragment from a PDF with its page-space coordinates.
 * Returns { fullText, pages }, where each page is { page, items }, and each
 * item is { x, y, w, str } (x = left edge, y = baseline, w = width). The
 * coordinates are what let us reconstruct columns and never confuse a running
 * balance (SALDO) with a movement amount.
 *
 * @param {Buffer|Uint8Array} buffer
 * @returns {Promise<{fullText: string, pages: Array<{page:number, items:Array<{x:number,y:number,w:number,str:string}>}>}>}
 */
export async function extractItems(buffer) {
    const pdfjs = await loadPdfjs();
    // pdfjs rejects Node Buffers specifically (even though Buffer extends
    // Uint8Array), so always hand it a plain Uint8Array view.
    const data = new Uint8Array(buffer.buffer ? buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) : buffer);
    // Serverless-safe options: text extraction needs no font rendering, so DON'T
    // touch system fonts (fontconfig is absent in Vercel/Lambda → getDocument can
    // throw or hang) and disable the worker/eval. This keeps extraction pure and
    // deterministic in the Node runtime.
    const doc = await pdfjs.getDocument({
        data,
        useSystemFonts: false,
        disableFontFace: true,
        isEvalSupported: false,
        useWorkerFetch: false,
        verbosity: 0,
    }).promise;

    const pages = [];
    let fullText = '';
    try {
        for (let p = 1; p <= doc.numPages; p++) {
            const page = await doc.getPage(p);
            const tc = await page.getTextContent();
            const items = [];
            for (const it of tc.items) {
                const str = it.str;
                if (!str || !str.trim()) continue;
                items.push({
                    x: Math.round(it.transform[4]),
                    y: Math.round(it.transform[5]),
                    w: Math.round(it.width || 0),
                    str,
                });
                fullText += str + ' ';
            }
            fullText += '\n';
            pages.push({ page: p, items });
            page.cleanup?.();
        }
    } finally {
        await doc.destroy?.();
    }
    return { fullText, pages };
}
