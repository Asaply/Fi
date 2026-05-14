/**
 * Renders PDF pages to base64 PNG images using pdfjs-dist (browser only).
 * Assumes window.pdfjsLib is already loaded (loaded by finanzas page via CDN).
 * Falls back to loading pdfjs from CDN if not already loaded.
 */

const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

async function ensurePdfjs() {
    if (window.pdfjsLib) return window.pdfjsLib;
    await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = PDFJS_CDN;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    return window.pdfjsLib;
}

/**
 * Renders all pages of a PDF as base64 PNG images.
 * @param {File} file
 * @param {{ scale?: number, maxPages?: number, skipFirst?: boolean }} options
 * @returns {Promise<string[]>} base64 PNG strings (no data: prefix)
 */
export async function pdfToImages(file, options = {}) {
    const { scale = 2.0, maxPages = 15, skipFirst = true } = options;

    const pdfjsLib = await ensurePdfjs();
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

    const images = [];
    const startPage = skipFirst ? 2 : 1;
    const endPage = Math.min(pdf.numPages, startPage + maxPages - 1);

    for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');

        await page.render({ canvasContext: ctx, viewport }).promise;

        const dataUrl = canvas.toDataURL('image/png');
        images.push(dataUrl.split(',')[1]);
    }

    return images;
}

/**
 * Get page count of a PDF.
 * @param {File} file
 * @returns {Promise<number>}
 */
export async function getPDFPageCount(file) {
    const pdfjsLib = await ensurePdfjs();
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    return pdf.numPages;
}
