import { NextResponse } from 'next/server';

const ALLOWED_ORIGINS = [
    'https://nva.lat',
    'https://www.nva.lat',
    'capacitor://localhost',
    'http://localhost:3005',
    'http://localhost',
];

export function withCors(response, requestOrigin) {
    const origin = ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : ALLOWED_ORIGINS[0];
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return response;
}

export function corsOptions(request) {
    const origin = request.headers.get('origin') || '';
    const res = new NextResponse(null, { status: 204 });
    return withCors(res, origin);
}
