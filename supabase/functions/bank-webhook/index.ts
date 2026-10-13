import { createClient } from 'npm:@supabase/supabase-js@2';
import { createServe } from '../_shared/bancos/serve.js';
import { handleWebhook } from '../_shared/bancos/handlers.js';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const serve = createServe({ createClient, env: Deno.env.toObject(), waitUntil: (p) => EdgeRuntime.waitUntil(p) });
Deno.serve(serve(handleWebhook, { auth: false }));
