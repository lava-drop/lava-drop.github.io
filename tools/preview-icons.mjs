// Renders the icon designs (tools/icons/designs.mjs) to preview/icons-sheet.png at home-screen size,
// each shown with a round mask, a squircle mask, and small, the way Android launchers show them.
import puppeteer from 'puppeteer-core';
import * as D from './icons/designs.mjs';

const names = Object.keys(D);
const cell = (n) => `
  <div class="c"><div class="row">
    <div class="m round">${D[n]}</div><div class="m squircle">${D[n]}</div><div class="m small">${D[n]}</div>
  </div><b>${n}</b></div>`;
const html = `<html><head><link href="https://fonts.googleapis.com/css2?family=Lilita+One&display=block" rel="stylesheet">
<style>body{margin:0;padding:24px;background:#4a4f6a;font-family:sans-serif;color:#fff;display:flex;flex-direction:column;gap:28px}
.c{display:flex;flex-direction:column;align-items:flex-start;gap:8px;font-size:22px}.row{display:flex;gap:14px;align-items:center}
.m{width:180px;height:180px;overflow:hidden}.m svg{width:100%;height:100%;display:block}.round{border-radius:50%}.squircle{border-radius:28%}
.small{width:72px;height:72px;border-radius:28%}</style></head><body>${names.map(cell).join('')}</body></html>`;

const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
await p.setViewport({ width: 640, height: 400, deviceScaleFactor: 1 });
await p.setContent(html, { waitUntil: 'networkidle0' });
await p.evaluate(() => document.fonts.ready);
await new Promise((r) => setTimeout(r, 500));
await p.screenshot({ path: 'preview/icons-sheet.png', fullPage: true });
await b.close();
console.log(names.join(', '));
