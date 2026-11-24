// New tiles costs swap_cost() points, only once per turn, and the penalty survives the score
// recount after a word is sent. Clean up with tools/cleanup-test-users.sql.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY, SWAP_COST, emailFor } from '../src/config.ts';
const words = readFileSync('public/words.txt', 'utf8').split('\n').map((w) => w.trim()).filter(Boolean);
const fits = (w, rack) => { const r = [...rack]; for (const ch of w) { const i = r.indexOf(ch); if (i < 0) return false; r.splice(i, 1); } return true; };
const name = `test_s${Math.random().toString(36).slice(2, 6)}`;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
await sb.auth.signUp({ email: emailFor(name), password: 'testpass1', options: { data: { username: name, color: 'sun' } } });
const bot = (await sb.rpc('list_bots')).data[0];
const gid = (await sb.rpc('start_game', { opponent: bot.id })).data;
const g0 = (await sb.rpc('get_game', { gid })).data;
const checks = [];
const ok = (label, pass, extra = '') => checks.push(`${pass ? 'PASS' : 'FAIL'} ${label} ${extra}`);
ok('starts setting with 1 swap', g0.rack?.swaps_left === 1, JSON.stringify(g0.rack));
const g1 = (await sb.rpc('swap_rack', { gid })).data;
ok('swap costs points', g1.me.score === g0.me.score - SWAP_COST, `${g0.me.score} -> ${g1.me.score}`);
ok('new letters', g1.rack.letters !== g0.rack.letters && g1.rack.swaps_left === 0);
const g2 = (await sb.rpc('swap_rack', { gid })).data;
ok('second swap does nothing', g2.me.score === g1.me.score && g2.rack.letters === g1.rack.letters, `${g2.me.score}`);
const w = words.filter((x) => x.length >= 4 && fits(x, g2.rack.letters)).sort((a, b) => b.length - a.length)[0];
const r = (await sb.rpc('submit_word', { gid, word: w })).data;
ok('word sent', r.result === 'ok', w);
const g3 = (await sb.rpc('get_game', { gid })).data;
const mine = g3.history.reduce((s, x) => s + (x.setter === g3.me.id ? x.setter_points : 0) + (x.solver === g3.me.id ? x.solver_points : 0), 0);
ok('penalty kept after recount', g3.me.score === mine - SWAP_COST, `score ${g3.me.score}, earned ${mine}`);
console.log(checks.join('\n'));
