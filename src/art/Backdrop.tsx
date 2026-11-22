/**
 * The full-page backdrop behind every screen: a blue sky with drifting clouds, a big erupting
 * volcano with a smoke plume and lava rivers, dark cliffs and a glowing lava sea at the bottom.
 * Fixed in place, so the screens scroll over it.
 */
const EMBERS = Array.from({ length: 18 }, (_, i) => ({
  x: 12 + ((i * 89) % 380),
  delay: -((i * 0.71) % 7),
  dur: 5 + (i % 5),
  r: 1.4 + (i % 3) * 0.7,
}));

export function Backdrop() {
  return (
    <div className="backdrop" aria-hidden>
      <svg viewBox="0 0 400 800" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="bd-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#14509C" />
            <stop offset="0.45" stopColor="#3E8FDA" />
            <stop offset="0.72" stopColor="#9CC8E8" />
            <stop offset="0.86" stopColor="#F3A35C" />
            <stop offset="1" stopColor="#E0420E" />
          </linearGradient>
          <linearGradient id="bd-cone" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#4A2A20" />
            <stop offset="0.5" stopColor="#2E1813" />
            <stop offset="1" stopColor="#1A0D0A" />
          </linearGradient>
          <linearGradient id="bd-lava" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFE45C" />
            <stop offset="0.3" stopColor="#FF8A00" />
            <stop offset="1" stopColor="#B3200A" />
          </linearGradient>
          <linearGradient id="bd-river" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFD23F" />
            <stop offset="1" stopColor="#FF4A00" />
          </linearGradient>
          <radialGradient id="bd-heat" cx="0.5" cy="1" r="0.7">
            <stop offset="0" stopColor="#FF6A00" stopOpacity="0.55" />
            <stop offset="1" stopColor="#FF6A00" stopOpacity="0" />
          </radialGradient>
          <filter id="bd-blur"><feGaussianBlur stdDeviation="4" /></filter>
        </defs>

        <rect width="400" height="800" fill="url(#bd-sky)" />
        <rect y="400" width="400" height="400" fill="url(#bd-heat)" />

        <g fill="#fff">
          <g className="bd-cloud" style={{ animationDuration: '70s' }}>
            <ellipse cx="60" cy="120" rx="48" ry="14" /><circle cx="44" cy="110" r="18" /><circle cx="72" cy="104" r="22" />
          </g>
          <g className="bd-cloud" style={{ animationDuration: '95s', animationDelay: '-40s' }} opacity="0.85">
            <ellipse cx="300" cy="60" rx="40" ry="11" /><circle cx="288" cy="52" r="14" /><circle cx="310" cy="48" r="17" />
          </g>
          <g className="bd-cloud" style={{ animationDuration: '120s', animationDelay: '-70s' }} opacity="0.7">
            <ellipse cx="180" cy="230" rx="34" ry="9" /><circle cx="170" cy="223" r="11" /><circle cx="190" cy="220" r="13" />
          </g>
        </g>

        {/* far ridge */}
        <path d="M-10 600 L40 560 L90 580 L150 540 L200 570 L250 545 L320 575 L370 550 L410 570 V640 H-10 Z" fill="#4B3A55" opacity="0.75" />

        {/* smoke plume from the big volcano */}
        <g className="bd-plume" fill="#4A4248">
          <circle cx="262" cy="410" r="26" />
          <circle cx="244" cy="372" r="34" />
          <circle cx="274" cy="336" r="38" />
          <circle cx="232" cy="300" r="40" />
          <circle cx="286" cy="262" r="42" />
          <circle cx="250" cy="220" r="44" opacity="0.85" />
          <circle cx="300" cy="186" r="40" opacity="0.7" />
        </g>
        <g fill="#FFC233">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <circle key={i} cx={250 + i * 5} cy="440" r="3" className="bd-spark"
              style={{ animationDelay: `${-i * 0.45}s`, ['--dx' as string]: `${(i - 2.5) * 22}px` }} />
          ))}
        </g>

        {/* small volcano, left */}
        <path d="M-40 660 L50 520 Q64 508 78 520 L170 660 Z" fill="url(#bd-cone)" />
        <path d="M52 522 Q64 512 76 522 L72 530 Q64 524 56 530 Z" fill="#FF9A00" />
        <path className="bd-flow" d="M60 528 Q54 570 64 610 Q58 640 66 660" stroke="url(#bd-river)" strokeWidth="4" fill="none" strokeLinecap="round" />

        {/* big volcano */}
        <path d="M100 680 L236 452 Q262 430 288 452 L430 680 Z" fill="url(#bd-cone)" />
        <path d="M100 680 L236 452 Q246 444 254 446 L190 680 Z" fill="#fff" opacity="0.05" />
        <path d="M234 456 Q262 436 290 456 L282 470 Q262 458 242 470 Z" fill="#FFB000" />
        <ellipse cx="262" cy="456" rx="30" ry="9" fill="#FF6A00" filter="url(#bd-blur)" />
        <path className="bd-flow" d="M248 466 Q236 520 250 560 Q238 610 254 680" stroke="url(#bd-river)" strokeWidth="7" fill="none" strokeLinecap="round" />
        <path className="bd-flow" style={{ animationDelay: '-0.7s' }} d="M274 466 Q290 512 280 552 Q296 604 286 680" stroke="url(#bd-river)" strokeWidth="5" fill="none" strokeLinecap="round" />

        {/* dark cliffs */}
        <path d="M-10 700 L30 668 L80 676 L120 700 L96 730 L-10 734 Z" fill="#160A08" />
        <path d="M410 694 L360 664 L318 676 L290 704 L316 732 L410 736 Z" fill="#160A08" />

        {/* lava sea */}
        <path className="bd-slosh" d="M-30 720 Q0 710 30 720 T90 720 T150 720 T210 720 T270 720 T330 720 T390 720 T450 720 V800 H-30 Z" fill="url(#bd-lava)" />
        <ellipse cx="200" cy="724" rx="220" ry="12" fill="#FFE45C" opacity="0.4" filter="url(#bd-blur)" />
        <g fill="#FF9A1A">
          {EMBERS.map((e, i) => (
            <circle key={i} cx={e.x} cy="790" r={e.r} className="bd-ember"
              style={{ animationDelay: `${e.delay}s`, animationDuration: `${e.dur}s` }} />
          ))}
        </g>
      </svg>
    </div>
  );
}
