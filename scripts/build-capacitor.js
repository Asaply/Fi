#!/usr/bin/env node
/**
 * Capacitor static build script.
 *
 * Next.js output:export fails if dynamic GET API routes don't have
 * `export const dynamic = 'force-static'` (literal string required — no expressions).
 * These routes live on Vercel and are never called from the native bundle.
 *
 * Strategy: temporarily swap them for a static stub → build → restore.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

const FILES_TO_STUB = [
    {
        file: 'src/app/api/crypto/route.js',
        stub: `import { NextResponse } from 'next/server';
export const dynamic = 'force-static';
export async function GET() { return NextResponse.json({}, { status: 503 }); }
export async function OPTIONS() { return new NextResponse(null, { status: 204 }); }
`,
    },
    {
        file: 'src/app/api/price/route.js',
        stub: `import { NextResponse } from 'next/server';
export const dynamic = 'force-static';
export async function GET() { return NextResponse.json({}, { status: 503 }); }
export async function OPTIONS() { return new NextResponse(null, { status: 204 }); }
`,
    },
    {
        file: 'src/app/api/belvo/token/route.js',
        stub: `import { NextResponse } from 'next/server';
export const dynamic = 'force-static';
export async function GET() { return NextResponse.json({}, { status: 503 }); }
`,
    },
    {
        file: 'src/app/api/stripe/verify-session/route.js',
        stub: `import { NextResponse } from 'next/server';
export const dynamic = 'force-static';
export async function GET() { return NextResponse.json({}, { status: 503 }); }
`,
    },
    {
        // Free-tier slot claim. GET (remaining count) is dynamic and breaks
        // static export; native calls the live route on Vercel via API_BASE.
        file: 'src/app/api/access/claim/route.js',
        stub: `import { NextResponse } from 'next/server';
export const dynamic = 'force-static';
export async function GET() { return NextResponse.json({}, { status: 503 }); }
export async function POST() { return NextResponse.json({}, { status: 503 }); }
`,
    },
    {
        file: 'src/app/sitemap.js',
        stub: `export const dynamic = 'force-static';
export default function sitemap() { return []; }
`,
    },
    {
        // Native app handles OAuth via ASWebAuthenticationSession + JS injection.
        // This server route is only needed on Vercel (web flow).
        file: 'src/app/auth/callback/route.js',
        stub: `import { NextResponse } from 'next/server';
export const dynamic = 'force-static';
export async function GET() { return NextResponse.redirect('https://nva.lat/login'); }
`,
    },
    {
        file: 'src/app/robots.js',
        stub: `export const dynamic = 'force-static';
export default function robots() { return { rules: { userAgent: '*', allow: '/' } }; }
`,
    },
    {
        // OG image uses edge runtime which static export doesn't support.
        // Native app doesn't need OG images — return a 1x1 PNG stub.
        file: 'src/app/opengraph-image.js',
        stub: `export const dynamic = 'force-static';
export const contentType = 'image/png';
export const size = { width: 1, height: 1 };
export const alt = 'NVA';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAABjE+ibYAAAAASUVORK5CYII=', 'base64');
export default function OGImage() { return new Response(PNG, { headers: { 'Content-Type': 'image/png' } }); }
`,
    },
];

const originals = {};

function restore() {
    for (const [file, content] of Object.entries(originals)) { // eslint-disable-line
        fs.writeFileSync(path.join(ROOT, file), content, 'utf-8');
        console.log(`  restored: ${file}`);
    }
}

// Swap routes for stubs
console.log('\n[build-capacitor] Stubbing dynamic routes...');
for (const { file, stub } of FILES_TO_STUB) {
    const abs = path.join(ROOT, file);
    originals[file] = fs.readFileSync(abs, 'utf-8');
    fs.writeFileSync(abs, stub, 'utf-8');
    console.log(`  stubbed:  ${file}`);
}

// Build
console.log('\n[build-capacitor] Running CAPACITOR=1 next build...\n');
let exitCode = 0;
try {
    execSync('npx next build', {
        cwd: ROOT,
        env: { ...process.env, CAPACITOR: '1' },
        stdio: 'inherit',
    });
} catch (err) {
    exitCode = err.status ?? 1;
} finally {
    console.log('\n[build-capacitor] Restoring original routes...');
    restore();
}

if (exitCode !== 0) {
    console.error('\n[build-capacitor] Build failed. Original routes restored.');
    process.exit(exitCode);
}

console.log('\n[build-capacitor] Done. Static output in ./out/');
