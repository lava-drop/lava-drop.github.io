// End game: a throwaway account starts a game, opens the ••• menu, taps End game, and the game
// must be gone from its list, count for nobody, and show "Game ended" if opened again.
// Clean up with tools/cleanup-test-users.sql.
import puppeteer from 'puppeteer-core';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY, emailFor } from '../src/config.ts';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const name = `test_e${Math.random().toString(36).slice(2, 6)}`;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
await sb.auth.signUp({ email: emailFor(name), password: 'testpass1', options: { data: { username: name, color: 'sun' } } });
const bot = (await sb.rpc('list_bots')).data[0];
const gid = (await sb.rpc('start_game', { opponent: bot.id })).data;

const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--mute-audio'] });
const p = await b.newPage();
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.goto('http://127.0.0.1:5173/lava-drop/', { waitUntil: 'networkidle0' });
await p.type('input[autocomplete=username]', name);
await p.type('input[type=password]', 'testpass1');
await p.evaluate(() => document.querySelectorAll('form')[1].requestSubmit());
await sleep(2500);
await p.goto(`http://127.0.0.1:5173/lava-drop/#/game/${gid}`, { waitUntil: 'networkidle0' });
await sleep(1500);
await p.click('[aria-label="Game menu"]');
await sleep(400);
await p.screenshot({ path: 'preview/80-game-menu.png' });
await p.evaluate(() => [...document.querySelectorAll('.menu-choice')].find((x) => x.textContent.startsWith('End game')).click());
await sleep(2500);
const atHome = await p.evaluate(() => location.hash === '#/' || location.hash === '');
const listed = (await sb.rpc('list_games')).data.some((g) => g.id === gid);
const rec = (await sb.rpc('head_to_head', { other: bot.id })).data;
await p.goto(`http://127.0.0.1:5173/lava-drop/#/game/${gid}`, { waitUntil: 'networkidle0' });
await sleep(1500);
const ended = (await p.evaluate(() => document.body.innerText)).includes('Game ended');
await p.screenshot({ path: 'preview/81-game-ended.png' });
console.log(JSON.stringify({ atHome, stillListed: listed, record: rec, showsEnded: ended, errors }));
await b.close();
