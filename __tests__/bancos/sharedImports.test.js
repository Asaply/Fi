import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..', '..');
const sharedDir = path.join(root, 'supabase', 'functions', '_shared');

function jsFiles(dir) {
    return readdirSync(dir).flatMap((f) => {
        const p = path.join(dir, f);
        return statSync(p).isDirectory() ? jsFiles(p) : p.endsWith('.js') ? [p] : [];
    });
}

describe('_shared es JS puro portable a Deno', () => {
    it('cada archivo se importa en Node ESM sin alias ni paquetes', () => {
        for (const file of jsFiles(sharedDir)) {
            const rel = './' + path.relative(root, file).split(path.sep).join('/');
            execFileSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(rel)})`], { cwd: root });
        }
    });

    it('ningún import usa @/, npm:, node: ni rutas sin .js', () => {
        for (const file of jsFiles(sharedDir)) {
            const src = readFileSync(file, 'utf8');
            const specs = [...src.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
            for (const s of specs) {
                expect(s.startsWith('./') || s.startsWith('../'), `${file}: ${s}`).toBe(true);
                expect(s.endsWith('.js'), `${file}: ${s}`).toBe(true);
            }
        }
    });

    it('la app sigue viendo las mismas exportaciones', async () => {
        const viaApp = await import('../../src/lib/categorias.js');
        expect(viaApp.CATEGORIAS_EGRESO).toContain('Transferencia entre tus cuentas');
        expect(typeof viaApp.claveComercio).toBe('function');
        const access = await import('../../src/lib/access.js');
        expect(typeof access.userHasAccess).toBe('function');
    });
});
