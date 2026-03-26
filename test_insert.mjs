import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = {};
fs.readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
  if (line && line.includes('=')) {
    const [k, ...v] = line.split('=');
    env[k.trim()] = v.join('=').trim().replace(/['"]/g, '');
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const newRes = {
    guest: "test",
    property: "Villa Sol",
    dates: "test",
    amount: "100",
    status: "Pendiente"
  };
  const { data, error } = await supabase.from('airbnb_reservations').insert([newRes]).select();
  console.log("Insert result:", { data, error });
}
check();
