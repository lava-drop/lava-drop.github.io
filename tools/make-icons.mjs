// Writes the app icons from the chosen design ("eruption", picked by Thomas 2026-11-22):
// public/icon-512.png, icon-192.png, icon-180.png (iPhone) and icon.svg (browser tab).
import { writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import { eruption } from './icons/designs.mjs';

const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
for (const size of [512, 192, 180]) {
  await p.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await p.setContent(
    `<html><head><link href="https://fonts.googleapis.com/css2?family=Lilita+One&display=block" rel="stylesheet"></head>
     <body style="margin:0">${eruption.replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body></html>`,
    { waitUntil: 'load' },
  );
  await p.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 800));
  await p.screenshot({ path: `public/icon-${size}.png`, clip: { x: 0, y: 0, width: size, height: size } });
}
await b.close();
// The SVG keeps the font @import, so the browser tab shows the same lettering.
writeFileSync('public/icon.svg', eruption);
console.log('icons written');
