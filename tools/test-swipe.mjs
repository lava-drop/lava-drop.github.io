// Swipe to end: a tap on an active game still opens it; a left swipe shows End; tapping End ends
// the game and it leaves the list. Clean up with tools/cleanup-test-users.sql.
import puppeteer from 'puppeteer-core';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY, emailFor } from '../src/config.ts';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const name = `test_w${Math.random().toString(36).slice(2, 6)}`;
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
await sleep(3000);
const box = async () => p.evaluate(() => { const r = document.querySelector('.swipe-card').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });

let r = await box();
await p.mouse.click(r.x + r.w / 2, r.y + r.h / 2);
await sleep(1200);
const tapOpens = await p.evaluate(() => location.hash.startsWith('#/game/'));
await p.goto('http://127.0.0.1:5173/lava-drop/#/', { waitUntil: 'networkidle0' });
await sleep(1500);
r = await box();
const y = r.y + r.h / 2;
await p.mouse.move(r.x + r.w - 40, y);
await p.mouse.down();
for (let i = 1; i <= 12; i++) { await p.mouse.move(r.x + r.w - 40 - i * 12, y); await sleep(16); }
await p.mouse.up();
await sleep(400);
await p.screenshot({ path: 'preview/85-swipe-end.png' });
const stillHome = await p.evaluate(() => !location.hash.startsWith('#/game/'));
await p.click('.swipe-end');
await sleep(2500);
const gone = !(await p.$('.swipe-card'));
const listed = (await sb.rpc('list_games')).data.some((g) => g.id === gid);
console.log(JSON.stringify({ tapOpens, swipeDidNotOpenGame: stillHome, cardGone: gone, stillListed: listed, errors }));
await b.close();
