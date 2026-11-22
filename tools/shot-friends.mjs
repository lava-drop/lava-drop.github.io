// Signs in as a fresh guest, screenshots New game (Friends), then deletes nothing: run the printed SQL to remove the guest.
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await p.goto('http://127.0.0.1:5173/lava-drop/', { waitUntil: 'networkidle0' });
await p.click('.quick-play');
await new Promise((r) => setTimeout(r, 3500));
await p.goto('http://127.0.0.1:5173/lava-drop/#/friends', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 2000));
await p.screenshot({ path: process.argv[2] });
const id = await p.evaluate(() => JSON.parse(localStorage.getItem('popquiz-auth')).user.id);
console.log(`delete from auth.users where id = '${id}';`);
await b.close();
