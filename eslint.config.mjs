import { FlatCompat } from "@eslint/eslintrc";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  // Deno entrypoints for Supabase Edge Functions (Deno globals, npm: imports).
  { ignores: ["supabase/functions/**/index.ts"] },
  ...compat.extends("next/core-web-vitals"),
];

export default eslintConfig;
