import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// The migration script runs under plain Node ESM (no bundler), so every relative
// import in the lib it loads needs an explicit extension. Only the lib is
// imported here: importing the script itself would connect to the database.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('scripts/migrate-access-to-app-metadata.mjs', () => {
    it('su lib carga en Node ESM puro', () => {
        const code = "import('./src/lib/accessMigration.js').then((m) => {" +
            " if (typeof m.accessFromRecords !== 'function' || typeof m.losesAccess !== 'function' ||" +
            " typeof m.sameAccess !== 'function') process.exit(1); })" +
            ".catch((e) => { console.error(e.message); process.exit(1); })";
        expect(() => execFileSync(process.execPath, ['--input-type=module', '-e', code], {
            cwd: repoRoot,
            stdio: 'pipe',
        })).not.toThrow();
    });
});
