import type { Record3 } from './types';

/** "You lead 3–1", "Meg leads 2–0", "Tied 1–1", or '' before any finished game. */
export function recordLine(name: string, r?: Record3 | null): string {
  if (!r || r.wins + r.losses + r.ties === 0) return '';
  if (r.wins > r.losses) return `You lead ${r.wins}–${r.losses}`;
  if (r.losses > r.wins) return `${name} leads ${r.losses}–${r.wins}`;
  return `Tied ${r.wins}–${r.losses}`;
}
