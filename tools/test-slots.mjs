// Checks the make-a-word slots: tap to place, tap a placed letter to leave a blank, the next tile
// fills that blank, and dragging a rack tile onto a filled slot replaces it. Clean up with
// tools/cleanup-test-users.sql.
import puppeteer from 'puppeteer-core';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY, emailFor } from '../src/config.ts';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const name = `test_s${Math.random().toString(36).slice(2, 6)}`;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
await sb.auth.signUp({ email: emailFor(name), password: 'testpass1', options: { data: { username: name, color: 'coral' } } });
const bots = (await sb.rpc('list_bots')).data;
const gid = (await sb.rpc('start_game', { opponent: bots[0].id })).data;

const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--mute-audio'] });
const p = await b.newPage();
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.goto('http://127.0.0.1:5173/lava-drop/', { waitUntil: 'networkidle0' });
await p.type('input[autocomplete=username]', name);
await p.type('input[type=password]', 'testpass1');
await p.evaluate(() => document.querySelector('form').requestSubmit());
await sleep(2000);
await p.goto(`http://127.0.0.1:5173/lava-drop/#/game/${gid}`, { waitUntil: 'networkidle0' });
await sleep(1500);

const slots = () => p.evaluate(() => [...document.querySelectorAll('.slots > *')].map((e) => e.textContent?.[0] || '_').join(''));
const center = async (sel, n) => {
  const r = await p.evaluate((s, i) => { const b = document.querySelectorAll(s)[i].getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, sel, n);
  return r;
};
const tap = async (sel, n) => { const c = await center(sel, n); await p.mouse.click(c.x, c.y); await sleep(150); };
const rackLetter = (n) => p.evaluate((i) => document.querySelectorAll('.rack .tile')[i].textContent[0], n);

const log = {};
for (let i = 0; i < 5; i++) await tap('.rack .tile', i);
log.placed = await slots();
await p.screenshot({ path: 'preview/60-slots-placed.png' });
await tap('.slots > *', 1);
log.removedSecond = await slots();
await p.screenshot({ path: 'preview/61-slots-blank.png' });
log.sixth = await rackLetter(5);
await tap('.rack .tile', 5);
log.filledBlank = await slots();
// drag rack tile 6 onto slot 0
log.seventh = await rackLetter(6);
const from = await center('.rack .tile', 6);
const to = await center('.slots > *', 0);
await p.mouse.move(from.x, from.y);
await p.mouse.down();
for (let s = 1; s <= 10; s++) { await p.mouse.move(from.x + ((to.x - from.x) * s) / 10, from.y + ((to.y - from.y) * s) / 10); await sleep(20); }
await p.screenshot({ path: 'preview/62-slots-dragging.png' });
await p.mouse.up();
await sleep(200);
log.dragged = await slots();
await p.screenshot({ path: 'preview/63-slots-after-drag.png' });
console.log(JSON.stringify({ ...log, errors }));
await b.close();
