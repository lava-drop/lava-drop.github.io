// Records check: two fresh guests, fake finished games between them (and one vs the computer),
// then screenshots of Home, Friends, Rankings, Me and a finished game as guest A. Deletes both guests.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';
const BASE = 'http://127.0.0.1:5173/lava-drop/';
const out = process.argv[2] ?? 'preview';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// The SQL goes through a file: on Windows npx needs a shell, which would split an inline query.
const sql = (q) => {
  const f = join(mkdtempSync(join(tmpdir(), 'lava-')), 'q.sql');
  writeFileSync(f, q);
  return execFileSync('npx', ['supabase', 'db', 'query', '--remote', '--yes', '--file', `"${f}"`], { shell: true, encoding: 'utf8' });
};
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const errors = [];
async function guest() {
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await p.goto(BASE, { waitUntil: 'networkidle0' });
  await p.click('.quick-play');
  await wait(3500);
  const id = await p.evaluate(() => JSON.parse(localStorage.getItem('popquiz-auth')).user.id);
  return { p, id };
}
const A = await guest();
const B = await guest();
let gid;
try {
  const magma = `(select id from public.profiles where bot is not null limit 1)`;
  const res = sql(`
    insert into public.friends (user_id, friend_id) values ('${A.id}','${B.id}'),('${B.id}','${A.id}');
    with g as (
      insert into public.games (player1, player2, status, score1, score2, winner, updated_at) values
        ('${A.id}','${B.id}','finished',48,31,'${A.id}', now() - interval '3 hours'),
        ('${A.id}','${B.id}','finished',22,40,'${B.id}', now() - interval '2 hours'),
        ('${B.id}','${A.id}','finished',29,51,'${A.id}', now() - interval '1 hour'),
        ('${A.id}','${B.id}','finished',44,38,'${A.id}', now()),
        ('${A.id}',${magma},'finished',35,20,'${A.id}', now() - interval '5 hours')
      returning id, player1, player2, score1)
    insert into public.game_words (game_id, seq, setter, solver, word, value, status, setter_points, misses, finished_at)
      select id, 1, '${A.id}'::uuid, '${B.id}'::uuid, 'jukebox', 23, 'failed', 23, 6, now() from g where player2 = '${A.id}'
      union all select id, 1, '${A.id}'::uuid, '${B.id}'::uuid, 'quiz', 14, 'failed', 14, 6, now() from g where player1 = '${A.id}' and player2 = '${B.id}' and score1 = 48
    returning game_id;`);
  gid = res.match(/"game_id":\s*"([^"]+)"/)?.[1];
  const shot = async (hash, name) => {
    await A.p.goto(BASE + hash, { waitUntil: 'networkidle0' });
    await wait(1800);
    await A.p.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  };
  await shot('#/', '50-home');
  await shot('#/friends', '51-friends');
  await shot('#/leaders', '52-rankings');
  await shot('#/me', '53-me');
  if (gid) await shot(`#/game/${gid}`, '54-done');
  console.log(JSON.stringify({ gid, errors }));
} finally {
  sql(`delete from public.games where '${A.id}' in (player1, player2); delete from auth.users where id in ('${A.id}','${B.id}');`);
  console.log('cleaned up');
  await b.close();
}
