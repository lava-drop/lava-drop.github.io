// Usage: npm run dev, then node tools/screenshots.mjs <out-dir>. Clean up after with
// tools/cleanup-test-users.sql.
// Drives the local dev build with real throwaway accounts and screenshots each screen.
import puppeteer from 'puppeteer-core';
import { readFileSync, mkdirSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const URL_ = 'https://htvuzvtylujcnffifrxl.supabase.co';
const KEY = 'sb_publishable_41RtpeSYl_XaE9yaGGutvw_eAZEmYb5';
const emailFor = (u) => `${u.toLowerCase()}@players.popquiz.invalid`;
const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const words = readFileSync(new URL('../public/words.txt', import.meta.url), 'utf8').split('\n').filter(Boolean);
const fits = (w, rack) => { let r = rack; for (const ch of w) { const i = r.indexOf(ch); if (i < 0) return false; r = r.slice(0, i) + r.slice(i + 1); } return true; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const tag = Math.random().toString(36).slice(2, 5);
async function acct(name, color) {
  const sb = createClient(URL_, KEY, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signUp({ email: emailFor(name), password: 'testpass1', options: { data: { username: name, color } } });
  if (error) throw error;
  const rpc = async (fn, args) => { const r = await sb.rpc(fn, args); if (r.error) throw new Error(fn + ': ' + r.error.message); return r.data; };
  return { sb, id: data.user.id, name, rpc };
}
const A = await acct(`test_Alex${tag}`, 'sun');
const B = await acct(`test_Sam${tag}`, 'berry');
const C = await acct(`test_Gma${tag}`, 'grape');

async function setAny(p, gid, minLen = 5) {
  const g = await p.rpc('get_game', { gid });
  const w = words.find((x) => x.length >= minLen && fits(x, g.rack.letters)) ?? words.find((x) => fits(x, g.rack.letters));
  await p.rpc('submit_word', { gid, word: w });
  return w;
}
async function solveAll(p, gid, missFirst = 1) {
  let g = await p.rpc('get_game', { gid });
  const word = null;
  const miss = 'qjxzvkwyfb'.split('');
  let m = 0;
  while (g.solving) {
    const s = g.solving;
    if (m < missFirst) { const ch = miss.find((c) => !s.guesses.includes(c)); g = await p.rpc('guess_letter', { gid, letter: ch }); m++; continue; }
    const ch = 'etaoinsrhldcumgpbfywkvxzjq'.split('').find((c) => !s.guesses.includes(c));
    g = await p.rpc('guess_letter', { gid, letter: ch });
  }
  return g;
}

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--no-first-run', '--mute-audio'],
});
const ctx = await browser.createBrowserContext();
const page = await ctx.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()));
const shot = async (n) => { await sleep(900); await page.screenshot({ path: `${OUT}/${n}.png` }); console.log('shot', n); };
const clickText = async (txt) => {
  const ok = await page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim().startsWith(t));
    if (b) b.click();
    return !!b;
  }, txt);
  if (!ok) throw new Error('no button ' + txt);
};
const base = 'http://127.0.0.1:5173/lava-drop/';

await page.goto(base, { waitUntil: 'networkidle0' });
await clickText('New player');
await page.type('input[autocomplete=username]', 'GrandmaJ');
await shot('01-new-player');
await clickText('Sign in');
await page.evaluate(() => { document.querySelector('input[autocomplete=username]').value = ''; });
const u = await page.$('input[autocomplete=username]');
await u.click({ clickCount: 3 }); await u.type(A.name);
await page.type('input[type=password]', 'testpass1');
await page.evaluate(() => document.querySelector('form').requestSubmit());
await sleep(2000);
await shot('02-home-empty');

// Friends + new game through the UI.
await clickText('+ New game');
await sleep(800);
await page.type('.add-friend input', B.name);
await clickText('Add');
await sleep(1200);
await page.evaluate(async () => {});
await (async () => { await page.type('.add-friend input', C.name); await clickText('Add'); await sleep(1200); })();
await shot('03-friends');
const playBtns = await page.$$('.friend-row .btn-go');
// Play the Sam row
await page.evaluate((n) => {
  const row = [...document.querySelectorAll('.friend-row')].find((r) => r.textContent.includes(n));
  row.querySelector('.btn-go').click();
}, B.name);
await sleep(2500);
const gid = page.url().split('/game/')[1];
console.log('game', gid);
await shot('04-set-empty');
const g0 = await A.rpc('get_game', { gid });
const w0 = words.filter((x) => x.length >= 5 && fits(x, g0.rack.letters)).sort((a, b) => b.length - a.length)[0] ?? words.find((x) => fits(x, g0.rack.letters));
for (const ch of w0) await page.keyboard.press(ch);
await sleep(300);
await clickText('Ideas');
await shot('05-set-word');
await page.keyboard.press('Enter');
await sleep(2000);
await shot('06-wait-sent');
// Sam guesses live.
await B.rpc('guess_letter', { gid, letter: 'q' === w0[0] ? 'z' : 'q' });
await B.rpc('guess_letter', { gid, letter: w0[0] });
await B.rpc('guess_letter', { gid, letter: 'j' });
await sleep(2500);
await shot('07-wait-live');
// Sam finishes and sets a word for Alex.
await solveAll(B, gid, 0);
const wb = await setAny(B, gid, 6);
console.log('Sam set', wb);
await sleep(3000);
await shot('08-recap');
await clickText('OK');
// Alex: miss twice, hit once.
const misses = 'zxqjvk'.split('').filter((c) => !wb.includes(c));
await page.keyboard.press(misses[0]); await sleep(900);
await page.keyboard.press(misses[1]); await sleep(900);
await page.keyboard.press(wb[1]); await sleep(900);
await page.keyboard.press(misses[2]); await sleep(900);
await shot('09-solving');
for (const ch of new Set(wb)) { await page.keyboard.press(ch); await sleep(700); }
await sleep(1500);
await shot('10-solved');
await clickText('Now make');
await sleep(800);
await shot('11-set-again');

// A finished game: Gma vs Alex played out through the API.
const g2 = await C.rpc('start_game', { opponent: A.id });
let first = true;
for (let r = 0; r < 5; r++) {
  await setAny(C, g2);
  await solveAll(A, g2, r === 2 ? 6 : 1);
  await setAny(A, g2);
  await solveAll(C, g2, 3);
}
// one more in progress vs Gma where it's Gma's turn
const g3 = await A.rpc('start_game', { opponent: C.id });
await setAny(A, g3);
await page.goto(base + '#/game/' + g2, { waitUntil: 'networkidle0' });
await sleep(2000);
await shot('12-done');
await page.goto(base + '#/', { waitUntil: 'networkidle0' });
await sleep(2000);
await shot('13-home');
// failed word view: Gma's turn for Alex? create g4 where Alex fails
const g4 = await B.rpc('start_game', { opponent: A.id });
await setAny(B, g4);
await page.goto(base + '#/game/' + g4, { waitUntil: 'networkidle0' });
await sleep(1500);
const g4s = await A.rpc('get_game', { gid: g4 });
for (const ch of 'zxqjvkwyfbmpgh'.split('').filter((c) => !g4s.solving.pattern.includes(c))) {
  const cur = await A.rpc('get_game', { gid: g4 });
  if (!cur.solving) break;
  // only press letters not in the word: we don't know the word, so check after
  await page.keyboard.press(ch); await sleep(800);
  if (await page.$('.result-card')) break;
}
await sleep(1500);
await shot('14-stumped-or-solved');
await page.goto(base + '#/me', { waitUntil: 'networkidle0' });
await shot('15-me');
await page.goto(base + '#/help', { waitUntil: 'networkidle0' });
await shot('16-help');
// Against the hard bot: set a word, the bot answers in the same move.
await page.goto(base + '#/friends', { waitUntil: 'networkidle0' });
await sleep(1500);
await shot('17-new-game-bots');
await page.evaluate(() => {
  const row = [...document.querySelectorAll('.friend-row')].find((r) => r.textContent.includes('Magma'));
  row.querySelector('.btn-go').click();
});
await sleep(2500);
const gb = page.url().split('/game/')[1];
const gbs = await A.rpc('get_game', { gid: gb });
const wbot = words.filter((x) => x.length >= 5 && fits(x, gbs.rack.letters)).sort((a, b) => b.length - a.length)[0];
for (const ch of wbot) await page.keyboard.press(ch);
await page.keyboard.press('Enter');
await sleep(2500);
await shot('18-bot-recap');
await clickText('OK');
await sleep(800);
await shot('19-bot-solve');
await browser.close();
console.log('done');
