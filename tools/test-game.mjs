// End-to-end check against the live Supabase project: two throwaway accounts play a whole game
// through the same functions the app calls, and the security rules are poked at.
// Run: node tools/test-game.mjs   Clean up after: tools/cleanup-test-users.sql
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY, emailFor } from '../src/config.ts';

let failures = 0;
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures++;
};

const tag = Math.random().toString(36).slice(2, 7);
async function player(name) {
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signUp({
    email: emailFor(name), password: 'testpass1', options: { data: { username: name, color: 'mint' } },
  });
  if (error) throw error;
  return { sb, id: data.user.id, name };
}
const rpc = async (p, fn, args) => {
  const { data, error } = await p.sb.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data;
};

const anon = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
check((await anon.rpc('username_available', { name: `test_a${tag}` })).data === true, 'username free before sign-up');

const a = await player(`test_a${tag}`);
const b = await player(`test_b${tag}`);
const c = await player(`test_c${tag}`);
check((await anon.rpc('username_available', { name: `TEST_A${tag}` })).data === false, 'username taken, any case');

const added = await rpc(a, 'add_friend', { name: b.name.toUpperCase() });
check(added.result === 'ok', 'add friend by username');
check((await rpc(b, 'list_friends')).some((f) => f.id === a.id), 'friendship is mutual');
check((await rpc(a, 'add_friend', { name: 'nobody_here_x' })).result === 'not_found', 'unknown username');

const gid = await rpc(a, 'start_game', { opponent: b.id });
let ga = await rpc(a, 'get_game', { gid });
check(ga.action === 'set' && ga.rack.letters.length === 10, 'starter sets first with a 10-tile rack');
check((await rpc(b, 'get_game', { gid })).action === 'wait', 'opponent waits');
check((await rpc(c, 'get_game', { gid })) === null, 'stranger cannot read the game');

// Security: secret tables are closed, out-of-turn moves refused.
const words = await b.sb.from('game_words').select('*');
check(words.error || words.data.length === 0, 'game_words not readable');
const racks = await b.sb.from('game_racks').select('*');
check(racks.error || racks.data.length === 0, 'racks not readable');
const dict = await b.sb.from('dictionary').select('*').limit(1);
check(dict.error || dict.data.length === 0, 'dictionary not readable directly');
check(!!(await b.sb.rpc('swap_rack', { gid })).error, 'out-of-turn swap refused');
const forged = await b.sb.from('games').update({ score2: 999 }).eq('id', gid).select();
check(forged.error || forged.data.length === 0, 'scores not writable');
check(!!(await anon.rpc('list_games')).error, 'signed-out list refused');

// Find a dictionary word that fits a rack, from the app's own list.
import { readFileSync } from 'node:fs';
const dictWords = readFileSync(new URL('../public/words.txt', import.meta.url), 'utf8').split('\n').filter(Boolean);
const fits = (w, rack) => {
  let r = rack;
  for (const ch of w) { const i = r.indexOf(ch); if (i < 0) return false; r = r.slice(0, i) + r.slice(i + 1); }
  return true;
};
async function setWord(p) {
  let g = await rpc(p, 'get_game', { gid });
  let w = dictWords.find((x) => fits(x, g.rack.letters) && x.length >= 5);
  if (!w) {
    g = await rpc(p, 'swap_rack', { gid });
    w = dictWords.find((x) => fits(x, g.rack.letters));
  }
  const bad = await rpc(p, 'submit_word', { gid, word: 'zzzz' });
  check(bad.result === 'not_in_rack' || bad.result === 'not_a_word', 'junk word refused');
  const res = await rpc(p, 'submit_word', { gid, word: w });
  check(res.result === 'ok', `${p.name} set ${w}`);
  return w;
}
async function solve(p, word, fail) {
  let g = await rpc(p, 'get_game', { gid });
  check(g.action === 'solve' && g.solving.pattern === '_'.repeat(word.length), 'solver sees only blanks');
  check(!JSON.stringify(g).includes(`"${word}"`), 'secret word not in the solver\'s data');
  const misses = 'qjxzvkwyfb'.split('').filter((ch) => !word.includes(ch));
  if (fail) {
    for (let i = 0; g.solving; i++) {
      g = i < 3 ? await rpc(p, 'guess_letter', { gid, letter: misses[i] })
                : await rpc(p, 'guess_word', { gid, guess: 'wrongo'.slice(0, 4 + (i % 3)) });
    }
    return g;
  }
  g = await rpc(p, 'guess_letter', { gid, letter: misses[0] });
  for (const ch of new Set(word)) {
    if (g.solving) g = await rpc(p, 'guess_letter', { gid, letter: ch });
  }
  return g;
}

let expectA = 0, expectB = 0;
const value = (w) => [...w].reduce((s, ch) => s + ({ e:1,a:1,i:1,o:1,n:1,r:1,t:1,s:1,l:1,u:2,d:2,g:2,c:3,m:3,h:3,b:3,p:3,f:4,w:4,y:4,v:4,k:4,j:6,x:6,q:8,z:8 })[ch], 0);

let lastA = await setWord(a);
for (let round = 1; round <= 5; round++) {
  // b solves a's word (fails round 3), then sets.
  let g = await solve(b, lastA, round === 3);
  const hb = g.history.find((h) => h.word === lastA && h.setter === a.id);
  if (round === 3) { check(hb.status === 'failed' && hb.setter_points === value(lastA), 'stumped word scores for setter'); expectA += value(lastA); }
  else { const pts = value(lastA) + 2 * (6 - hb.misses); check(hb.status === 'solved' && hb.solver_points === pts, `solve scores value + 2/balloon (${pts})`); expectB += pts; }
  check(g.action === 'set', 'after solving, solver sets');
  const lastB = await setWord(b);
  check((await rpc(b, 'get_game', { gid })).action === 'wait', 'turn passes after setting');
  g = await solve(a, lastB, false);
  const ha = g.history.find((h) => h.word === lastB && h.setter === b.id);
  expectA += value(lastB) + 2 * (6 - ha.misses);
  if (round < 5) { check(g.action === 'set', 'starter sets next'); lastA = await setWord(a); }
  else check(g.status === 'finished' && g.action === 'done', 'game ends after five rounds each');
}
const final = await rpc(a, 'get_game', { gid });
check(final.me.score === expectA && final.them.score === expectB, `final scores ${final.me.score}-${final.them.score} (expected ${expectA}-${expectB})`);
const winner = expectA > expectB ? a.id : expectB > expectA ? b.id : null;
check(final.winner === winner, 'winner recorded');
check(final.history.length === 10, 'ten words in history');
const list = await rpc(b, 'list_games');
check(list[0].id === gid && list[0].active === false, 'game in list as finished');

// Resigning.
const g2 = await rpc(b, 'start_game', { opponent: a.id });
const r = await rpc(a, 'resign', { gid: g2 });
check(r.status === 'finished' && r.winner === b.id && r.resigned_by === a.id, 'resign hands the win over');

console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);
