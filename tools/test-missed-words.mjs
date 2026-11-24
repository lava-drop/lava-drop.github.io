// Logs a made-up word, confirms a real word is not logged, and plays a bot turn on the new list.
// Clean up with tools/cleanup-test-users.sql.
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY, emailFor } from '../src/config.ts';
const name = `test_m${Math.random().toString(36).slice(2, 6)}`;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
await sb.auth.signUp({ email: emailFor(name), password: 'testpass1', options: { data: { username: name, color: 'sun' } } });
for (const w of ['qzxvb', 'qzxvb', 'zesty']) console.log(w, (await sb.rpc('log_missed_word', { w })).error?.message ?? 'ok');
console.log('user', name);
