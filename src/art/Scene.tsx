import { useEffect, useRef, useState } from 'react';
import type { Color } from '../types';
import { CRITTER_HAND, Critter, type Mood } from './Critter';

const BALLOON_COLORS = ['#FF2E4D', '#FFB000', '#18B8FF', '#3DDC5A', '#B455FF', '#FF6A1A'];
// Balloon centers in the cluster, in the scene's 300-wide coordinate space.
const SPOTS = [
  { x: 126, y: 54 }, { x: 174, y: 54 }, { x: 150, y: 38 },
  { x: 106, y: 82 }, { x: 194, y: 82 }, { x: 150, y: 72 },
];
// Where the strings meet: the creature's raised fist, which sits here in the scene.
const HAND = { x: 153, y: 116 };
const SIZE = 72;
const SCALE = SIZE / 100;
const EMBERS = Array.from({ length: 14 }, (_, i) => ({
  x: 10 + ((i * 137) % 280),
  delay: -((i * 0.83) % 6),
  dur: 4 + (i % 4),
  r: 1 + (i % 3) * 0.6,
}));

interface Props {
  color: Color;
  misses: number;
  maxMisses: number;
  /** 'playing' while guessing; 'solved' floats away; 'failed' drops into the lava. */
  state: 'playing' | 'solved' | 'failed' | 'idle';
  /** The other player, standing on the ledge and watching. */
  rival?: { color: Color };
}

/** Volcano country: a lava brute hangs from balloons over a lava lake. Each miss pops one. */
export function Scene({ color, misses, maxMisses, state, rival }: Props) {
  const left = Math.max(0, maxMisses - misses);
  const prev = useRef(left);
  const [bursting, setBursting] = useState<number[]>([]);

  useEffect(() => {
    if (left < prev.current) {
      const gone = Array.from({ length: prev.current - left }, (_, i) => left + i);
      setBursting(gone);
      const t = setTimeout(() => setBursting([]), 450);
      prev.current = left;
      return () => clearTimeout(t);
    }
    prev.current = left;
  }, [left]);

  const mood: Mood =
    state === 'failed' ? 'ouch' : state === 'solved' ? 'cheer' : state === 'idle' ? 'happy'
      : left <= 1 ? 'scared' : left <= 3 ? 'nervous' : 'happy';
  const rivalMood: Mood = state === 'failed' ? 'cheer' : state === 'solved' ? 'nervous' : left <= 2 ? 'cheer' : 'happy';
  // How far the creature has sunk toward the lava.
  const drop = state === 'failed' ? 104 : state === 'solved' ? -260 : (misses / maxMisses) * 66;
  const danger = state === 'failed' ? 1 : Math.min(1, misses / maxMisses);

  return (
    <div className={`scene scene-${state}`}>
      <svg viewBox="0 0 300 300" preserveAspectRatio="xMidYMid slice" className="scene-svg" aria-hidden>
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1F6FC9" />
            <stop offset="0.5" stopColor="#5AAAE8" />
            <stop offset="0.82" stopColor="#B9D9EE" />
            <stop offset="1" stopColor="#F2B36A" />
          </linearGradient>
          <linearGradient id="lava" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFE14D" />
            <stop offset="0.25" stopColor="#FF8A00" />
            <stop offset="0.7" stopColor="#E0260E" />
            <stop offset="1" stopColor="#7A0A06" />
          </linearGradient>
          <linearGradient id="flow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFD23F" />
            <stop offset="1" stopColor="#FF3D00" stopOpacity="0.2" />
          </linearGradient>
          <radialGradient id="glow" cx="0.5" cy="1" r="0.8">
            <stop offset="0" stopColor="#FF6A00" stopOpacity="0.55" />
            <stop offset="1" stopColor="#FF6A00" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="shine" cx="0.35" cy="0.3" r="0.6">
            <stop offset="0" stopColor="#fff" stopOpacity="0.65" />
            <stop offset="0.4" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <filter id="blur3"><feGaussianBlur stdDeviation="3" /></filter>
        </defs>
        <rect width="300" height="300" fill="url(#sky)" />
        {/* the lava's heat haze climbs as balloons go */}
        <rect width="300" height="300" fill="url(#glow)" opacity={0.25 + danger * 0.55} />
        <g fill="#fff" opacity="0.9">
          <g className="cloud"><ellipse cx="40" cy="40" rx="30" ry="10" /><circle cx="30" cy="34" r="11" /><circle cx="48" cy="31" r="13" /></g>
          <g className="cloud cloud-b"><ellipse cx="250" cy="70" rx="24" ry="8" /><circle cx="242" cy="65" r="9" /><circle cx="256" cy="62" r="10" /></g>
        </g>

        {/* far volcano, right */}
        <g className="smoke-plume" style={{ animationDelay: '-3s' }}>
          <ellipse cx="236" cy="118" rx="18" ry="10" fill="#3A2A2A" opacity="0.6" />
          <ellipse cx="244" cy="98" rx="24" ry="13" fill="#2E2222" opacity="0.5" />
        </g>
        <path d="M168 230 L222 140 Q236 128 250 140 L310 230 Z" fill="#1F0C0B" />
        <path d="M228 140 Q236 134 244 140 L240 150 Q236 146 232 150 Z" fill="#FF8A00" />
        <path d="M236 146 Q232 170 240 196 Q236 210 244 232" stroke="url(#flow)" strokeWidth="3" fill="none" className="lava-flow" />

        {/* big volcano, left */}
        <g className="smoke-plume">
          <ellipse cx="80" cy="84" rx="22" ry="12" fill="#3A2A2A" opacity="0.65" />
          <ellipse cx="66" cy="62" rx="30" ry="16" fill="#2E2222" opacity="0.55" />
          <ellipse cx="88" cy="40" rx="34" ry="18" fill="#251B1B" opacity="0.45" />
        </g>
        <path d="M-20 240 L58 110 Q76 92 96 110 L176 240 Z" fill="#2A100E" />
        <path d="M-20 240 L58 110 Q66 102 72 104 L40 240 Z" fill="#371512" />
        <path d="M60 108 Q76 96 94 108 L88 118 Q77 110 66 118 Z" fill="#FFB000" />
        <ellipse cx="77" cy="108" rx="20" ry="6" fill="#FF6A00" filter="url(#blur3)" opacity="0.9" />
        <path d="M70 116 Q62 150 74 178 Q66 204 80 236" stroke="url(#flow)" strokeWidth="4" fill="none" className="lava-flow" />
        <path d="M86 116 Q96 146 90 170 Q100 200 96 236" stroke="url(#flow)" strokeWidth="3" fill="none" className="lava-flow" style={{ animationDelay: '-1s' }} />
        <g fill="#FFC233">
          {[0, 1, 2, 3, 4].map((i) => (
            <circle key={i} cx={70 + i * 4} cy="104" r="2" className="spark" style={{ animationDelay: `${-i * 0.55}s`, ['--dx' as string]: `${(i - 2) * 14}px` }} />
          ))}
        </g>

        {/* rocky ledges framing the lake; the other player stands on the right one */}
        <path d="M-10 236 L40 228 L70 238 L52 250 L-10 252 Z" fill="#170908" />
        <path d="M310 232 L262 226 L236 236 L250 250 L310 252 Z" fill="#170908" />
        {rival && (
          <g transform="translate(236 180)">
            <Critter color={rival.color} mood={rivalMood} size={54} />
          </g>
        )}

        <g className="floater" style={{ transform: `translateY(${drop}px)` }}>
          <g className={state === 'playing' || state === 'idle' ? 'bob' : ''}>
            {state !== 'failed' &&
              SPOTS.map((s, i) => {
                const alive = i < left;
                const burst = bursting.includes(i);
                if (!alive && !burst) return null;
                return (
                  <g key={i}>
                    {alive && (
                      <path
                        d={`M${s.x} ${s.y + 21} Q${(s.x + HAND.x) / 2 + (i % 2 ? 8 : -8)} ${(s.y + HAND.y) / 2 + 10} ${HAND.x} ${HAND.y}`}
                        stroke="#C9B8A8" strokeWidth="1" fill="none" opacity="0.8"
                      />
                    )}
                    {alive ? (
                      <g className="balloon" style={{ animationDelay: `${i * -0.37}s` }}>
                        <ellipse cx={s.x} cy={s.y} rx="16" ry="19" fill={BALLOON_COLORS[i]} />
                        <ellipse cx={s.x} cy={s.y} rx="16" ry="19" fill="url(#shine)" />
                        <path d={`M${s.x - 3.5} ${s.y + 22} L${s.x + 3.5} ${s.y + 22} L${s.x} ${s.y + 17} Z`} fill={BALLOON_COLORS[i]} />
                      </g>
                    ) : (
                      <g className="burst">
                        <Burst x={s.x} y={s.y} color={BALLOON_COLORS[i]} />
                      </g>
                    )}
                  </g>
                );
              })}
            <g transform={`translate(${HAND.x - CRITTER_HAND.x * SCALE} ${HAND.y - CRITTER_HAND.y * SCALE})`}>
              <Critter color={color} mood={mood} size={SIZE} holding={state !== 'failed'} />
            </g>
          </g>
        </g>

        {/* lava lake, drawn over the creature so a fall sinks into it */}
        <path className="lava-surface" d="M-20 252 Q10 244 40 252 T100 252 T160 252 T220 252 T280 252 T340 252 V300 H-20 Z" fill="url(#lava)" />
        <ellipse cx="150" cy="256" rx="150" ry="10" fill="#FFE14D" opacity="0.35" filter="url(#blur3)" />
        <g fill="#FFE14D">
          <circle cx="60" cy="266" r="3" className="bubble" />
          <circle cx="196" cy="270" r="2.5" className="bubble" style={{ animationDelay: '-1.2s' }} />
          <circle cx="250" cy="264" r="2" className="bubble" style={{ animationDelay: '-2.1s' }} />
          <circle cx="120" cy="272" r="2" className="bubble" style={{ animationDelay: '-0.6s' }} />
        </g>
        <g fill="#FF8A00">
          {EMBERS.map((e, i) => (
            <circle key={i} cx={e.x} cy="290" r={e.r} className="ember" style={{ animationDelay: `${e.delay}s`, animationDuration: `${e.dur}s` }} />
          ))}
        </g>

        {state === 'failed' && (
          <>
            <g className="splash" fill="#FFB000">
              <circle cx="132" cy="246" r="5" /><circle cx="168" cy="244" r="6" /><circle cx="150" cy="236" r="4" />
              <circle cx="122" cy="240" r="3" /><circle cx="178" cy="238" r="3" />
            </g>
            <g className="steam" fill="#B9A8A0">
              <circle cx="140" cy="236" r="10" /><circle cx="158" cy="230" r="13" /><circle cx="150" cy="220" r="9" />
            </g>
            <g className="ouch-text">
              <text x="150" y="128" textAnchor="middle">MELTED!</text>
            </g>
          </>
        )}
      </svg>
    </div>
  );
}

function Burst({ x, y, color }: { x: number; y: number; color: string }) {
  const pts = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    const r = i % 2 ? 10 : 26;
    return `${x + Math.cos(a) * r},${y + Math.sin(a) * r}`;
  }).join(' ');
  return (
    <>
      <polygon points={pts} fill={color} />
      <text x={x} y={y + 5} textAnchor="middle" className="pop-text">POP!</text>
    </>
  );
}
