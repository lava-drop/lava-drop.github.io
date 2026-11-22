import { useId } from 'react';
import type { Color } from '../types';

// Glow colors: the magma inside each player's creature. The keys are stored in the database, so they stay;
// the names are what players see.
export const COLORS: Record<Color, { body: string; dark: string; belly: string; name: string }> = {
  sun: { body: '#FFB000', dark: '#B36B00', belly: '#FFF0A0', name: 'Gold' },
  berry: { body: '#FF2E3E', dark: '#9E0A18', belly: '#FFB0B6', name: 'Red' },
  mint: { body: '#2BEA6B', dark: '#0E8A3A', belly: '#B8FFD0', name: 'Toxic' },
  sky: { body: '#28B4FF', dark: '#0B5FA8', belly: '#C4ECFF', name: 'Ice' },
  grape: { body: '#B05CFF', dark: '#5E1EB8', belly: '#E6CCFF', name: 'Venom' },
  coral: { body: '#FF6A10', dark: '#A83A00', belly: '#FFD0A0', name: 'Blaze' },
  lime: { body: '#C8F52A', dark: '#6E9200', belly: '#F2FFB8', name: 'Acid' },
  cocoa: { body: '#E8E4DC', dark: '#8A8680', belly: '#FFFFFF', name: 'White-hot' },
};
export const COLOR_KEYS = Object.keys(COLORS) as Color[];

export type Mood = 'happy' | 'nervous' | 'scared' | 'ouch' | 'cheer' | 'sleepy';

/** Where the raised fist is, in the figure's 100x100 box (the balloon strings meet there). */
export const CRITTER_HAND = { x: 81, y: 11 };

interface Props {
  color: Color;
  mood?: Mood;
  size?: number;
  /** One arm up, gripping balloon strings. */
  holding?: boolean;
  className?: string;
}

const INK = '#0C0605';

/** Mirror a list of points left-to-right across the 100-wide box. */
const flip = (pts: number[][]) => pts.map(([x, y]) => [100 - x, y]);
const poly = (pts: number[][]) => pts.map((p) => p.join(',')).join(' ');
const hex = (cx: number, cy: number, r: number) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    return [+(cx + Math.cos(a) * r).toFixed(1), +(cy + Math.sin(a) * r * 0.92).toFixed(1)];
  });

const ARM_UP = [[[66, 46], [76, 43], [83, 29], [73, 27]], [[73, 29], [84, 29], [87, 16], [76, 15]]];
const ARM_DOWN = [[[68, 47], [77, 49], [79, 63], [70, 64]]];
const SHOULDER = [[63, 41], [73, 38], [81, 46], [78, 57], [66, 56]];
const BODY = [[34, 30], [42, 19], [58, 18], [67, 28], [70, 44], [72, 60], [66, 76], [54, 82], [44, 82], [33, 76], [28, 60], [30, 44]];
const LEG = [[36, 76], [47, 78], [47, 94], [34, 94], [32, 85]];

/**
 * The lava brute: a hulking rock creature with magma glowing through its cracks, eyes and mouth,
 * in the player's color. Moods show in the brow, eyes and mouth. 'ouch' is melted: the fire goes
 * out, the cracks go grey, eyes crossed out, smoking.
 */
export function Critter({ color, mood = 'happy', size = 96, holding = false, className }: Props) {
  const c = COLORS[color] ?? COLORS.sun;
  const id = useId().replace(/:/g, '');
  const dead = mood === 'ouch';
  const armUp = holding || mood === 'cheer';
  const glow = dead ? '#5A5250' : c.body;
  const hot = dead ? '#6E6662' : c.belly;
  const rock = `url(#${id}r)`;
  const g = dead ? undefined : `url(#${id}g)`;

  const chunk = (pts: number[][], k: string | number) => (
    <polygon key={k} points={poly(pts)} fill={rock} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
  );
  const rightArm = armUp ? [...ARM_UP, hex(81, 10, 6.8)] : [...ARM_DOWN, hex(75, 70, 6.5)];
  const leftArm = (mood === 'cheer' ? [...ARM_UP, hex(81, 10, 6.8)] : [...ARM_DOWN, hex(75, 70, 6.5)]).map(flip);

  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <defs>
        <linearGradient id={`${id}r`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor={dead ? '#4A4644' : '#5A4842'} />
          <stop offset="0.55" stopColor={dead ? '#2E2A28' : '#33241F'} />
          <stop offset="1" stopColor={dead ? '#1A1817' : '#1A1210'} />
        </linearGradient>
        <radialGradient id={`${id}c`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={hot} stopOpacity="0.9" />
          <stop offset="0.5" stopColor={glow} stopOpacity="0.55" />
          <stop offset="1" stopColor={glow} stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}g`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* legs */}
      {chunk(LEG, 'll')}
      {chunk(flip(LEG), 'rl')}
      {/* arms, behind the shoulders */}
      {rightArm.map((p, i) => chunk(p, `ra${i}`))}
      {leftArm.map((p, i) => chunk(p, `la${i}`))}
      {/* body */}
      {chunk(BODY, 'b')}
      <polygon points="34,30 42,19 50,19 44,33 35,40" fill="#fff" opacity="0.08" />
      <polygon points="66,76 54,82 59,66 71,56" fill="#000" opacity="0.28" />
      {chunk(SHOULDER, 'rs')}
      {chunk(flip(SHOULDER), 'ls')}
      {/* magma core + cracks */}
      <ellipse cx="50" cy="68" rx="13" ry="10" fill={`url(#${id}c)`} />
      <g filter={g} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M44 60 L48 66 L45 72 L49 78 M56 62 L53 68 L57 74 M50 21 L52 27 L49 30 M70 48 L74 52 M30 50 L26 53 M40 86 L42 90 M60 86 L58 91"
          stroke={glow} strokeWidth="2.6" />
        <path d="M44 60 L48 66 L45 72 L49 78 M56 62 L53 68 L57 74" stroke={hot} strokeWidth="1" />
      </g>

      <Brow mood={mood} />
      <g filter={g}>
        <Eyes mood={mood} glow={glow} hot={hot} />
        <Mouth mood={mood} glow={glow} hot={hot} />
      </g>

      {(mood === 'nervous' || mood === 'scared' || dead) && (
        <g fill={dead ? '#8A8A8A' : '#B8B0AC'} opacity="0.75" className="smoke">
          <circle cx="40" cy="12" r="4.5" />
          <circle cx="52" cy="7" r="5.5" />
          <circle cx="62" cy="12" r="4" />
        </g>
      )}
    </svg>
  );
}

function Brow({ mood }: { mood: Mood }) {
  // Tilt of each brow ridge: positive = inner end low (cocky / mean), negative = inner end high (worried).
  const t = mood === 'happy' ? 2.5 : mood === 'nervous' || mood === 'scared' ? -2.5 : 0;
  const L = [[32, 34 - t], [48, 35 + t], [48, 39 + t], [33, 38.5 - t]];
  return (
    <g fill="#140C0A" stroke={INK} strokeWidth="1.4" strokeLinejoin="round">
      <polygon points={poly(L)} />
      <polygon points={poly(flip(L))} />
    </g>
  );
}

function Eyes({ mood, glow, hot }: { mood: Mood; glow: string; hot: string }) {
  switch (mood) {
    case 'happy': {
      const e = [[37, 41], [47, 42.5], [46, 45], [38, 44]];
      return (
        <g fill={hot} stroke={glow} strokeWidth="1.2" strokeLinejoin="round">
          <polygon points={poly(e)} />
          <polygon points={poly(flip(e))} />
        </g>
      );
    }
    case 'nervous':
      return (
        <g fill={hot} stroke={glow} strokeWidth="1.2">
          <circle cx="42" cy="43" r="2.4" />
          <circle cx="58" cy="43" r="2.4" />
        </g>
      );
    case 'scared':
      return (
        <g>
          <circle cx="42" cy="43" r="4.6" fill={glow} />
          <circle cx="58" cy="43" r="4.6" fill={glow} />
          <circle cx="42" cy="43" r="2.6" fill={hot} />
          <circle cx="58" cy="43" r="2.6" fill={hot} />
        </g>
      );
    case 'cheer':
      return (
        <g stroke={hot} strokeWidth="2.6" strokeLinecap="round" fill="none">
          <path d="M37 44 Q42 38 47 44" />
          <path d="M53 44 Q58 38 63 44" />
        </g>
      );
    case 'sleepy':
      return (
        <g stroke={glow} strokeWidth="2.2" strokeLinecap="round">
          <path d="M38 43 H46 M54 43 H62" />
        </g>
      );
    case 'ouch':
      return (
        <g stroke="#9A928E" strokeWidth="2.4" strokeLinecap="round">
          <path d="M38 40 L46 46 M46 40 L38 46 M54 40 L62 46 M62 40 L54 46" />
        </g>
      );
  }
}

function Mouth({ mood, glow, hot }: { mood: Mood; glow: string; hot: string }) {
  const edge = { stroke: INK, strokeWidth: 1.6, strokeLinejoin: 'round' as const };
  switch (mood) {
    case 'happy':
      // A jagged smirk with fire behind the teeth.
      return <polygon points="39,52 61,49 59,56 55,53.5 51,57 47,54 43,57" fill={glow} {...edge} />;
    case 'cheer':
      return (
        <g>
          <polygon points="37,50 63,50 59,62 50,66 41,62" fill={glow} {...edge} />
          <ellipse cx="50" cy="58" rx="6" ry="4" fill={hot} />
          <path d="M40 50 l3 4 l3 -4 l3 4 l3 -4 l3 4 l3 -4 l3 4" fill="#241815" stroke={INK} strokeWidth="1" strokeLinejoin="round" />
        </g>
      );
    case 'nervous':
      return (
        <g>
          <rect x="40" y="51" width="20" height="6" rx="1.5" fill={glow} {...edge} />
          <path d="M45 51 V57 M50 51 V57 M55 51 V57" stroke="#241815" strokeWidth="1.6" />
        </g>
      );
    case 'scared':
      return <ellipse cx="50" cy="55" rx="5" ry="6" fill={glow} {...edge} />;
    case 'sleepy':
      return <path d="M44 54 H56" stroke={hot} strokeWidth="2" strokeLinecap="round" />;
    case 'ouch':
      return <path d="M40 54 l3 -2.5 l3 2.5 l3 -2.5 l3 2.5 l3 -2.5 l3 2.5 l3 -2.5" stroke="#9A928E" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
  }
}
