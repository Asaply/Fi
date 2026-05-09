/**
 * Shared auth utility for Next.js API routes.
 * Verifies Supabase session from cookies before processing any request.
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function getAuthUser() {
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll() { return cookieStore.getAll(); },
                setAll() {}, // read-only in API routes
            },
        }
    );
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

export function unauthorized() {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
}

/** Generic safe error — never leaks internal details to client. */
export function serverError(logLabel, err) {
    console.error(`[${logLabel}]`, err?.message ?? err);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
}

/** Validate uploaded file: type, size, extension */
export function validateUpload(file, { maxBytes = 10 * 1024 * 1024, allowedTypes = ['application/pdf'] } = {}) {
    if (!file) return 'No se recibió archivo.';
    if (file.size > maxBytes) return `El archivo excede el límite de ${Math.round(maxBytes / 1024 / 1024)}MB.`;
    if (!allowedTypes.includes(file.type) && file.type !== '') {
        // Some browsers send empty MIME for certain files — allow if extension matches
        const name = file.name?.toLowerCase() ?? '';
        const extOk = allowedTypes.some(t => {
            if (t === 'application/pdf' && name.endsWith('.pdf')) return true;
            if (t === 'text/csv' && (name.endsWith('.csv') || name.endsWith('.txt'))) return true;
            if (t.startsWith('image/') && /\.(png|jpe?g|webp|gif)$/.test(name)) return true;
            return false;
        });
        if (!extOk) return 'Tipo de archivo no permitido.';
    }
    return null; // valid
}
