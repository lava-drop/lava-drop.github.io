// Checks name-first quick play and the save-your-account reminder:
// 1) a taken name is refused, 2) a new name plays with no password and gets no reminder yet,
// 3) a guest with an automatic Guest#### name gets "Pick your name", saves name + password, and
//    is a real account afterwards. Deletes everything it made.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';
const BASE = 'http://127.0.0.1:5173/lava-drop/';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const sql = (q) => {
  const f = join(mkdtempSync(join(tmpdir(), 'lava-')), 'q.sql');
  writeFileSync(f, q);
  return execFileSync('npx', ['supabase', 'db', 'query', '--remote', '--yes', '--file', `"${f}"`], { shell: true, encoding: 'utf8' });
};
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const errors = [];
const out = {};
const ids = [];
async function page() {
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await p.goto(BASE, { waitUntil: 'networkidle0' });
  return p;
}
const text = (p) => p.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
const user = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('popquiz-auth')).user);
try {
  const a = await page();
  await a.screenshot({ path: 'preview/70-signin.png' });
  await a.type('.quick-card input', 'Thomas');
  await a.click('.quick-play');
  await wait(1500);
  out.takenRefused = (await text(a)).includes('Thomas is taken');
  const nameA = `Tn${Math.random().toString(36).slice(2, 7)}`;
  await a.$eval('.quick-card input', (el) => { el.value = ''; });
  await a.click('.quick-card input', { clickCount: 3 });
  await a.keyboard.press('Backspace');
  await a.type('.quick-card input', nameA);
  await a.click('.quick-play');
  await wait(3500);
  const ua = await user(a);
  ids.push(ua.id);
  out.aGuest = ua.is_anonymous;
  out.aHasName = (await text(a)).includes(nameA);
  out.aNoReminder = !(await a.$('.save-nudge'));
  await a.screenshot({ path: 'preview/71-named-guest-home.png' });

  const g = await page();
  await g.type('.quick-card input', `Tg${Math.random().toString(36).slice(2, 7)}`);
  await g.click('.quick-play');
  await wait(3500);
  const ug = await user(g);
  ids.push(ug.id);
  const auto = `Guest${Math.floor(1000 + Math.random() * 9000)}`;
  sql(`update public.profiles set username = '${auto}' where id = '${ug.id}';`);
  await g.reload({ waitUntil: 'networkidle0' });
  await wait(2000);
  out.autoReminder = !!(await g.$('.save-nudge'));
  await g.screenshot({ path: 'preview/72-pick-your-name.png' });
  const real = `Tr${Math.random().toString(36).slice(2, 7)}`;
  await g.type('.save-nudge input', real);
  await g.type('.save-nudge input[type=password]', 'testpass1');
  await g.click('.save-nudge .btn-go');
  await wait(3500);
  out.reminderGone = !(await g.$('.save-nudge'));
  out.savedNotGuest = (await user(g)).is_anonymous === false;
  out.savedName = (await text(g)).includes(real);
  await g.screenshot({ path: 'preview/73-after-save.png' });
  console.log(JSON.stringify({ ...out, errors }));
} finally {
  if (ids.length) sql(`delete from auth.users where id in (${ids.map((i) => `'${i}'`).join(',')});`);
  console.log('cleaned up', ids.length);
  await b.close();
}
