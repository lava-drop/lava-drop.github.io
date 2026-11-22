// Renders public/badge-96.png: the small Android notification icon. Android only uses its shape
// (alpha channel), so it's a plain white balloon on transparent, not the full-color app icon.
import puppeteer from 'puppeteer-core';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
  <ellipse cx="48" cy="38" rx="25" ry="30" fill="#fff"/>
  <path d="M42 70 L54 70 L48 62 Z" fill="#fff"/>
  <path d="M48 70 Q42 78 50 84 Q56 89 50 94" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/>
  <ellipse cx="38" cy="26" rx="6" ry="9" fill="#000" fill-opacity="0" />
</svg>`;
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
await p.setViewport({ width: 96, height: 96 });
await p.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
await p.screenshot({ path: 'public/badge-96.png', omitBackground: true, clip: { x: 0, y: 0, width: 96, height: 96 } });
await b.close();
console.log('wrote public/badge-96.png');
