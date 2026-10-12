/** @type {import('next').NextConfig} */

const SUPABASE_HOST = 'rdmvynbidxfesvdkuqga.supabase.co';

const securityHeaders = [
    // Prevent clickjacking
    { key: 'X-Frame-Options', value: 'DENY' },
    // Prevent MIME type sniffing
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    // XSS protection (legacy browsers)
    { key: 'X-XSS-Protection', value: '1; mode=block' },
    // Strict referrer — don't leak URL to third parties
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    // HSTS — force HTTPS for 1 year (enable once confirmed HTTPS-only)
    { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
    // Permissions policy — disable features not needed
    {
        key: 'Permissions-Policy',
        value: [
            'camera=(self)',           // profile picture upload
            'microphone=()',
            'geolocation=()',
            'payment=()',
            'usb=()',
            'magnetometer=()',
            'gyroscope=()',
            'accelerometer=()',
        ].join(', '),
    },
    // Content Security Policy
    {
        key: 'Content-Security-Policy',
        value: [
            "default-src 'self'",
            // Next.js needs unsafe-inline + unsafe-eval for hydration in some builds
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline'",
            // data: for profile pics (base64), blob: for PDF worker
            "img-src 'self' data: blob: https:",
            "font-src 'self' data:",
            // Supabase (HTTPS + WebSocket), market data APIs, Google OAuth
            [
                "connect-src 'self'",
                `https://${SUPABASE_HOST}`,
                `wss://${SUPABASE_HOST}`,
                'https://api.coingecko.com',
                'https://query1.finance.yahoo.com',
                'https://query2.finance.yahoo.com',
                'https://accounts.google.com',
                'https://oauth2.googleapis.com',
            ].join(' '),
            // Allow WebAuthn (biometrics) — needs same origin
            "worker-src 'self' blob:",
            "frame-src 'none'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "upgrade-insecure-requests",
        ].join('; '),
    },
];

const isCapacitor = process.env.CAPACITOR === '1';

const nextConfig = {
    // Static export for Capacitor native builds
    ...(isCapacitor && {
        output: 'export',
        images: { unoptimized: true },
    }),
    serverExternalPackages: [
        'pdfjs-dist', 'unpdf',
        '@napi-rs/canvas', '@napi-rs/canvas-darwin-arm64',
        'belvo',
    ],
    eslint: {
        ignoreDuringBuilds: true,
    },
    async headers() {
        return [
            {
                // Apply to all routes
                source: '/(.*)',
                headers: securityHeaders,
            },
        ];
    },
};

export default nextConfig;
