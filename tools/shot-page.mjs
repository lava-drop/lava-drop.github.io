// Screenshot one page of the dev server: node tools/shot-page.mjs <hash> <out.png> [fullPage]
import puppeteer from 'puppeteer-core';
const [hash, out, full] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://127.0.0.1:5173/lava-drop/${hash}`, { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 1500));
console.log('url', p.url(), await p.evaluate(() => document.querySelector('h1')?.textContent));
await p.screenshot({ path: out, fullPage: full === 'full' });
console.log('errors', errs.length, errs.join(' | '));
await b.close();
