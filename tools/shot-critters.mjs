// Renders the creature in every mood and color on a blank dev page: node tools/shot-critters.mjs out.png
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
await p.setViewport({ width: 390, height: 420, deviceScaleFactor: 2 });
await p.goto('http://127.0.0.1:5173/lava-drop/', { waitUntil: 'networkidle0' });
await p.evaluate(async () => {
  const React = (await import('/lava-drop/node_modules/.vite/deps/react.js')).default;
  const rd = await import('/lava-drop/node_modules/.vite/deps/react-dom_client.js');
  const createRoot = rd.createRoot ?? rd.default.createRoot;
  const { Critter, COLOR_KEYS } = await import('/lava-drop/src/art/Critter.tsx');
  document.body.innerHTML = '<div id="x" style="padding:10px;background:#1a0907"></div>';
  const h = React.createElement;
  const moods = ['happy', 'nervous', 'scared', 'cheer', 'ouch'];
  createRoot(document.getElementById('x')).render(h('div', null,
    h('div', { style: { display: 'flex', justifyContent: 'space-between' } }, moods.map((m) => h(Critter, { key: m, color: 'coral', mood: m, size: 72, holding: m !== 'ouch' && m !== 'cheer' }))),
    h('div', { style: { display: 'flex', justifyContent: 'space-between', marginTop: 10 } }, COLOR_KEYS.map((k) => h(Critter, { key: k, color: k, size: 44 }))),
    h('div', { style: { display: 'flex', justifyContent: 'center', marginTop: 10 } }, h(Critter, { color: 'berry', size: 200, holding: true }))));
});
await new Promise((r) => setTimeout(r, 800));
await p.screenshot({ path: process.argv[2] });
await b.close();
