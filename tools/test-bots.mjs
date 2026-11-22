// Plays full games against both bots with a throwaway account (which plays like a decent
// human: frequency guessing), and reports scores, the bots' words and how long moves take.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { SUPABASE_URL, SUPABASE_KEY, emailFor } from '../src/config.ts';

const words = readFileSync(new URL('../public/words.txt', import.meta.url), 'utf8').split('\n').filter(Boolean);
const fits = (w, rack) => { let r = rack; for (const ch of w) { const i = r.indexOf(ch); if (i < 0) return false; r = r.slice(0, i) + r.slice(i + 1); } return true; };
const name = `test_b${Math.random().toString(36).slice(2, 6)}`;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
await sb.auth.signUp({ email: emailFor(name), password: 'testpass1', options: { data: { username: name } } });
const rpc = async (fn, args) => { const r = await sb.rpc(fn, args); if (r.error) throw new Error(fn + ': ' + r.error.message); return r.data; };

const bots = await rpc('list_bots');
console.log('bots', bots.map((b) => `${b.username}(${b.bot})`).join(', '));
console.log('add bot as friend ->', (await rpc('add_friend', { name: 'Magma' })).result);
let failures = 0;
for (const bot of bots) {
  for (let game = 0; game < (bot.bot === "easy" ? 4 : 1); game++) {
    const gid = await rpc('start_game', { opponent: bot.id });
    let g = await rpc('get_game', { gid });
    let slowest = 0;
    while (g.action !== 'done') {
      const t = Date.now();
      if (g.action === 'set') {
        const w = words.filter((x) => x.length >= 5 && fits(x, g.rack.letters))[0];
        const r = await rpc('submit_word', { gid, word: w });
        g = r.game;
      } else if (g.action === 'solve') {
        const s = g.solving;
        const ch = 'etaoinsrhldcumgpfywbvkjxqz'.split('').find((c) => !s.guesses.includes(c));
        g = await rpc('guess_letter', { gid, letter: ch });
      } else { console.log('FAIL stuck on', g.action); failures++; break; }
      slowest = Math.max(slowest, Date.now() - t);
    }
    const botWords = g.history.filter((h) => h.setter === bot.id);
    const botSolved = g.history.filter((h) => h.solver === bot.id && h.status === 'solved').length;
    console.log(`${bot.username}: you ${g.me.score} - bot ${g.them.score} | bot solved ${botSolved}/5 | bot words: ${botWords.map((h) => h.word).join(' ')} | slowest move ${slowest} ms`);
    if (g.history.length !== 10) { console.log('FAIL history', g.history.length); failures++; }
  }
}
const friends = await rpc('list_friends');
if (friends.some((f) => bots.some((b) => b.id === f.id))) { console.log('FAIL bot in friends'); failures++; }
console.log(failures ? `${failures} FAILED` : 'all passed');
