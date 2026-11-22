// start_game twice against the same opponent must return the same game. Clean up with
// tools/cleanup-test-users.sql.
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY, emailFor } from '../src/config.ts';
const name = `test_g${Math.random().toString(36).slice(2, 6)}`;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
await sb.auth.signUp({ email: emailFor(name), password: 'testpass1', options: { data: { username: name, color: 'sun' } } });
const bot = (await sb.rpc('list_bots')).data[0];
const a = (await sb.rpc('start_game', { opponent: bot.id })).data;
const b = (await sb.rpc('start_game', { opponent: bot.id })).data;
console.log(JSON.stringify({ first: a, second: b, same: a === b }));
