// Every sound is synthesized with Web Audio, so there are no audio files to license or load.
let ctx: AudioContext | null = null;
let muted = (() => {
  try {
    return localStorage.getItem('popquiz-muted') === '1';
  } catch {
    return false;
  }
})();

export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem('popquiz-muted', m ? '1' : '0');
  } catch {
    /* private mode */
  }
}

function audio(): AudioContext | null {
  if (muted) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.2, slideTo?: number) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + start;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(start: number, dur: number, gain: number, cutoff: number) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + start;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = cutoff;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

export const sfx = {
  pop() {
    noise(0, 0.12, 0.9, 3500);
    tone(500, 0, 0.08, 'triangle', 0.25, 120);
  },
  ding() {
    tone(880, 0, 0.15, 'sine', 0.18);
    tone(1320, 0.07, 0.25, 'sine', 0.15);
  },
  tap() {
    tone(600, 0, 0.05, 'triangle', 0.08);
  },
  whoosh() {
    noise(0, 0.35, 0.25, 900);
  },
  ouch() {
    tone(300, 0, 0.5, 'sawtooth', 0.12, 60);
    noise(0.05, 0.2, 0.6, 600);
  },
  win() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.3, 'triangle', 0.18));
  },
  lose() {
    [392, 349, 311, 262].forEach((f, i) => tone(f, i * 0.16, 0.35, 'triangle', 0.15));
  },
  buzz() {
    tone(140, 0, 0.25, 'square', 0.08);
  },
};
