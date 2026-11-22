import { DEFS, FONT, balloon, tile } from './common.mjs';

const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${FONT}<defs>${DEFS}</defs>${body}</svg>`;

// A: a volcano erupting behind two tiles, L and D.
export const eruption = svg(`
  <rect width="512" height="512" fill="url(#sky)"/>
  <circle cx="256" cy="150" r="150" fill="url(#glow)"/>
  <g fill="#FFB000"><circle cx="190" cy="92" r="16"/><circle cx="320" cy="78" r="13"/><circle cx="256" cy="52" r="18"/><circle cx="150" cy="140" r="10"/><circle cx="362" cy="130" r="11"/></g>
  <g fill="#FF6A00"><circle cx="222" cy="122" r="11"/><circle cx="292" cy="110" r="12"/></g>
  <path d="M-30 512 L196 196 Q256 156 316 196 L542 512 Z" fill="url(#cone)"/>
  <path d="M196 196 Q256 160 316 196 L302 222 Q256 196 210 222 Z" fill="#FFB000"/>
  <path d="M226 214 Q206 290 236 340 Q214 400 240 470" stroke="#FF8A00" stroke-width="16" fill="none" stroke-linecap="round"/>
  <path d="M290 214 Q316 280 296 330" stroke="#FFB000" stroke-width="12" fill="none" stroke-linecap="round"/>
  <path d="M0 450 Q64 430 128 450 T256 450 T384 450 T512 450 V512 H0 Z" fill="url(#lava)"/>
  ${tile(186, 330, 150, 'L', 1, -9)}
  ${tile(330, 318, 150, 'D', 2, 8)}`);

// B: the L and D tiles hang from balloons over the lava, like the game's characters.
export const balloons = svg(`
  <rect width="512" height="512" fill="url(#sky)"/>
  <path d="M-20 430 L110 250 Q130 232 150 250 L270 430 Z" fill="url(#cone)"/>
  <path d="M112 250 Q130 236 148 250 L142 262 Q130 252 118 262 Z" fill="#FFB000"/>
  <path d="M290 430 L390 290 Q406 276 422 290 L540 430 Z" fill="#1F0C0B"/>
  <path d="M168 150 Q176 220 186 262" stroke="#241509" stroke-width="4" fill="none"/>
  <path d="M340 140 Q332 210 326 252" stroke="#241509" stroke-width="4" fill="none"/>
  ${balloon(166, 108, 50, '#FF2E4D')}
  ${balloon(344, 98, 50, '#18B8FF')}
  ${tile(186, 318, 140, 'L', 1, -7)}
  ${tile(326, 308, 140, 'D', 2, 7)}
  <path d="M0 430 Q64 410 128 430 T256 430 T384 430 T512 430 V512 H0 Z" fill="url(#lava)"/>
  <g fill="#FFE45C"><circle cx="90" cy="470" r="7"/><circle cx="410" cy="480" r="6"/><circle cx="250" cy="490" r="5"/></g>`);

// C: one big LD tile with lava pouring over its top edge, on a hot lava background.
export const melting = svg(`
  <rect width="512" height="512" fill="url(#hot)"/>
  <circle cx="256" cy="230" r="230" fill="url(#glow)" opacity="0.6"/>
  <g transform="translate(256 270)">
    <rect x="-170" y="-130" width="340" height="270" rx="44" fill="#241509"/>
    <rect x="-170" y="-150" width="340" height="270" rx="44" fill="url(#tile)" stroke="#241509" stroke-width="10"/>
    <text x="-6" y="70" text-anchor="middle" font-family="Lilita One" font-size="200" fill="#241509" letter-spacing="-6">LD</text>
    <path d="M-170 -110 Q-170 -150 -126 -150 L126 -150 Q170 -150 170 -110 L170 -96 Q150 -84 140 -96 Q130 -40 112 -40 Q94 -40 96 -96 Q74 -80 54 -96 Q46 -60 30 -60 Q14 -60 18 -100 Q-10 -84 -36 -98 Q-40 -20 -62 -20 Q-84 -20 -82 -98 Q-110 -84 -130 -98 Q-140 -70 -156 -70 Q-170 -70 -170 -96 Z" fill="url(#lava)" stroke="#241509" stroke-width="6" stroke-linejoin="round"/>
  </g>
  <g fill="#FFE45C"><circle cx="100" cy="90" r="9"/><circle cx="420" cy="110" r="7"/><circle cx="380" cy="60" r="5"/><circle cx="140" cy="440" r="6"/></g>`);
