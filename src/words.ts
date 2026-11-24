// The list of words a player may set (same list the server checks against), loaded once.
let words: Promise<string[]> | null = null;
let wordSet: Set<string> | null = null;

export function loadWords(): Promise<string[]> {
  words ??= fetch(`${import.meta.env.BASE_URL}words.txt`)
    .then((r) => r.text())
    .then((t) => {
      const list = t.split('\n').filter(Boolean);
      wordSet = new Set(list);
      return list;
    });
  return words;
}

export const isWord = (w: string) => wordSet?.has(w) ?? false;

export function fitsRack(w: string, rack: string) {
  let r = rack;
  for (const ch of w) {
    const i = r.indexOf(ch);
    if (i < 0) return false;
    r = r.slice(0, i) + r.slice(i + 1);
  }
  return true;
}

export const LETTER_VALUES: Record<string, number> = {
  e: 1, a: 1, i: 1, o: 1, n: 1, r: 1, t: 1, s: 1, l: 1,
  u: 2, d: 2, g: 2,
  c: 3, m: 3, h: 3, b: 3, p: 3,
  f: 4, w: 4, y: 4, v: 4, k: 4,
  j: 6, x: 6,
  q: 8, z: 8,
};

export const wordValue = (w: string) => [...w].reduce((s, ch) => s + (LETTER_VALUES[ch] ?? 0), 0);
