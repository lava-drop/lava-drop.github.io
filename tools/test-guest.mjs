// Clicks "Play now" on a fresh browser, checks it lands signed in on Home, and prints the guest name.
// The guest it makes is real; delete it after with: delete from auth.users where id = '<printed id>';
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://127.0.0.1:5173/lava-drop/', { waitUntil: 'networkidle0' });
await p.screenshot({ path: 'preview/30-play-now.png' });
await p.click('.quick-play');
await new Promise((r) => setTimeout(r, 4000));
const info = await p.evaluate(() => {
  const raw = localStorage.getItem('popquiz-auth');
  const s = raw ? JSON.parse(raw) : null;
  return { id: s?.user?.id, anon: s?.user?.is_anonymous, name: s?.user?.user_metadata?.username, text: document.body.innerText.slice(0, 160) };
});
await p.screenshot({ path: 'preview/31-guest-home.png' });
await p.goto('http://127.0.0.1:5173/lava-drop/#/me', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 1500));
await p.screenshot({ path: 'preview/32-guest-me.png', fullPage: true });
console.log(JSON.stringify(info), 'errors', errs.length, errs.join(' | '));
await b.close();
