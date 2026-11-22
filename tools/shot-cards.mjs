// Close-up screenshots of each card on a page: node tools/shot-cards.mjs <hash> <prefix>
import puppeteer from 'puppeteer-core';
const [hash, prefix] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await p.goto(`http://127.0.0.1:5173/lava-drop/${hash}`, { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 1500));
console.log('scrollWidth', await p.evaluate(() => document.documentElement.scrollWidth));
const cards = await p.$$('.card');
for (let i = 0; i < cards.length; i++) await cards[i].screenshot({ path: `${prefix}-${i + 1}.png` });
await b.close();
