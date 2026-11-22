// Shared pieces for the app-icon designs (512x512). Keep the important stuff inside the middle
// 80% circle so Android's round and squircle masks don't cut it off.
export const FONT = `<style>@import url('https://fonts.googleapis.com/css2?family=Lilita+One&amp;display=block');</style>`;
export const DEFS = `
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14509C"/><stop offset="0.55" stop-color="#3E8FDA"/><stop offset="1" stop-color="#9CC8E8"/></linearGradient>
  <linearGradient id="cone" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5A3326"/><stop offset="0.5" stop-color="#2E1813"/><stop offset="1" stop-color="#170B09"/></linearGradient>
  <linearGradient id="lava" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE45C"/><stop offset="0.35" stop-color="#FF8A00"/><stop offset="1" stop-color="#C21E0A"/></linearGradient>
  <linearGradient id="hot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF9A1A"/><stop offset="0.6" stop-color="#E0420E"/><stop offset="1" stop-color="#7A0A06"/></linearGradient>
  <linearGradient id="tile" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FBEBC4"/><stop offset="1" stop-color="#E4C083"/></linearGradient>
  <radialGradient id="shine" cx="0.35" cy="0.3" r="0.6"><stop offset="0" stop-color="#fff" stop-opacity="0.7"/><stop offset="0.45" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#FFB000" stop-opacity="0.9"/><stop offset="1" stop-color="#FF6A00" stop-opacity="0"/></radialGradient>`;

/** A Scrabble-style tile centered at (x, y), side s, rotated r degrees. */
export const tile = (x, y, s, letter, value, r = 0) => `
  <g transform="translate(${x} ${y}) rotate(${r})">
    <rect x="${-s / 2}" y="${-s / 2 + s * 0.07}" width="${s}" height="${s}" rx="${s * 0.16}" fill="#241509"/>
    <rect x="${-s / 2}" y="${-s / 2}" width="${s}" height="${s}" rx="${s * 0.16}" fill="url(#tile)" stroke="#241509" stroke-width="${s * 0.045}"/>
    <text x="${-s * 0.04}" y="${s * 0.25}" text-anchor="middle" font-family="Lilita One" font-size="${s * 0.72}" fill="#241509">${letter}</text>
    <text x="${s * 0.33}" y="${s * 0.38}" text-anchor="middle" font-family="Lilita One" font-size="${s * 0.2}" fill="#241509">${value}</text>
  </g>`;

export const balloon = (x, y, rx, color) => `
  <ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${rx * 1.18}" fill="${color}" stroke="#241509" stroke-width="5"/>
  <ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${rx * 1.18}" fill="url(#shine)"/>
  <path d="M${x - 9} ${y + rx * 1.18 + 10} L${x + 9} ${y + rx * 1.18 + 10} L${x} ${y + rx * 1.18 - 2} Z" fill="${color}" stroke="#241509" stroke-width="4" stroke-linejoin="round"/>`;
