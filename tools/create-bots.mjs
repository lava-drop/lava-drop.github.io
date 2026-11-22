// One-time: creates the two computer-opponent accounts. Their passwords are random and thrown
// away, so nobody can sign in as them; migration 20261122000005_bots.sql flags them as bots.
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { SUPABASE_URL, SUPABASE_KEY, emailFor } from '../src/config.ts';

for (const [username, color] of [['Spark', 'coral'], ['Magma', 'berry']]) {
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const { error } = await sb.auth.signUp({
    email: emailFor(username), password: randomBytes(24).toString('base64url'), options: { data: { username, color } },
  });
  console.log(username, error ? error.message : 'created');
}
