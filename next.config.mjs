/** @type {import('next').NextConfig} */
const nextConfig = {
    serverExternalPackages: ['pdf-parse', 'pdfjs-dist', '@napi-rs/canvas', '@napi-rs/canvas-darwin-arm64', 'belvo'],
    eslint: {
        ignoreDuringBuilds: true,
    },
};

export default nextConfig;
