/** @type {import('next').NextConfig} */
const nextConfig = {
    // Prevent webpack from bundling native Node.js modules used by pdf-parse
    serverExternalPackages: ['pdf-parse', 'pdfjs-dist', '@napi-rs/canvas', '@napi-rs/canvas-darwin-arm64'],
};

export default nextConfig;
