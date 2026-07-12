// We use `unpdf` instead of raw pdfjs-dist: it ships a serverless-ready build of
// pdfjs with all the browser globals (DOMMatrix, Path2D, ImageData) polyfilled
// internally, so it needs NO native `@napi-rs/canvas`. Raw pdfjs-dist on Vercel
// could not polyfill DOMMatrix (canvas module absent) → getTextContent broke →
// every statement fell through to the slow Vision path → 504 timeout.
let _unpdf = null;
async function loadUnpdf() {
    if (!_unpdf) _unpdf = await import('unpdf');
    return _unpdf;
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
    const { getDocumentProxy } = await loadUnpdf();
    // Hand pdfjs a plain Uint8Array view (it rejects Node Buffers specifically,
    // even though Buffer extends Uint8Array).
    const data = new Uint8Array(buffer.buffer ? buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) : buffer);
    // unpdf resolves a serverless pdfjs build and applies the browser-global
    // polyfills. Text extraction needs no system fonts / worker.
    const doc = await getDocumentProxy(data, {
        useSystemFonts: false,
        disableFontFace: true,
        isEvalSupported: false,
        useWorkerFetch: false,
        verbosity: 0,
    });

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
