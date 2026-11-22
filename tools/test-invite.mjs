// Two fresh guests: A shows Home + Friends, B opens A's invite link signed out, plays as guest,
// lands on the invite screen. Prints SQL that deletes both guests afterwards.
import puppeteer from 'puppeteer-core';
const BASE = 'http://127.0.0.1:5173/lava-drop/';
const out = process.argv[2] ?? 'preview';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const errors = [];
async function page() {
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  return p;
}
const uid = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('popquiz-auth')).user.id);

const a = await page();
await a.goto(BASE, { waitUntil: 'networkidle0' });
await a.click('.quick-play');
await wait(3500);
const aid = await uid(a);
await a.screenshot({ path: `${out}/40-home.png` });
await a.goto(BASE + '#/friends', { waitUntil: 'networkidle0' });
await wait(1500);
await a.screenshot({ path: `${out}/41-friends-empty.png` });

const bp = await page();
await bp.goto(`${BASE}#/invite/${aid}`, { waitUntil: 'networkidle0' });
await wait(1500);
await bp.screenshot({ path: `${out}/42-invite-signedout.png` });
await bp.click('.quick-play');
await wait(4000);
const bid = await uid(bp);
await bp.screenshot({ path: `${out}/43-invite-landed.png` });
const bText = await bp.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 200));

await a.goto(BASE + '#/', { waitUntil: 'networkidle0' });
await a.goto(BASE + '#/friends', { waitUntil: 'networkidle0' });
await wait(1500);
await a.screenshot({ path: `${out}/44-friends-after.png` });
const aText = await a.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 300));
console.log(JSON.stringify({ bText, aText, errors }));
console.log(`SQL:delete from auth.users where id in ('${aid}','${bid}');`);
await b.close();
