// Interface sounds, synthesised with Web Audio so the app needs no audio assets for them.
// These are UI cues only; Qur'anic sounds always come from the reciter (PROMPT.md §3, §6).

import { getSettings } from './settings';

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** One soft note: `type` waveform, `freq` Hz (optionally gliding to `to`), `dur` seconds, `at` offset. */
function note(c: AudioContext, freq: number, dur: number, at = 0, opts: { type?: OscillatorType; gain?: number; to?: number } = {}) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = opts.type ?? 'triangle';
  const t0 = c.currentTime + at;
  o.frequency.setValueAtTime(freq, t0);
  if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
  const peak = opts.gain ?? 0.08;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

export type Sfx = 'tap' | 'toggle' | 'correct' | 'wrong' | 'complete' | 'fanfare';

const PATTERNS: Record<Sfx, (c: AudioContext) => void> = {
  tap: (c) => note(c, 1400, 0.045, 0, { type: 'sine', gain: 0.035 }),
  toggle: (c) => note(c, 880, 0.06, 0, { type: 'sine', gain: 0.05 }),
  correct: (c) => {
    note(c, 659, 0.11, 0, { gain: 0.09 });
    note(c, 988, 0.16, 0.1, { gain: 0.09 });
  },
  wrong: (c) => note(c, 262, 0.22, 0, { type: 'triangle', gain: 0.07, to: 196 }),
  complete: (c) => {
    [523, 659, 784].forEach((f, i) => note(c, f, 0.14, i * 0.09, { gain: 0.08 }));
    note(c, 1047, 0.32, 0.27, { gain: 0.09 });
  },
  fanfare: (c) => {
    [523, 659, 784, 1047].forEach((f, i) => note(c, f, 0.16, i * 0.1, { gain: 0.09 }));
    [659, 784, 1047, 1319].forEach((f, i) => note(c, f, 0.5, 0.45 + i * 0.02, { type: 'sine', gain: 0.05 }));
  },
};

const HAPTIC: Partial<Record<Sfx, number | number[]>> = { tap: 8, toggle: 12, correct: [18, 40, 18], wrong: 55, complete: [20, 40, 20, 40, 40], fanfare: [30, 50, 30, 50, 60] };

/** Play a UI cue; silent when sounds are off. Haptics follow their own switch. */
export function sfx(kind: Sfx) {
  const s = getSettings();
  if (s.sound) {
    const c = context();
    if (c) {
      try {
        PATTERNS[kind](c);
      } catch {
        /* audio blocked until a gesture: ignore */
      }
    }
  }
  if (s.haptics && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    const h = HAPTIC[kind];
    if (h) {
      try {
        navigator.vibrate(h);
      } catch {
        /* ignore */
      }
    }
  }
}

/** Warm the audio context up on the first user gesture so the first cue is not swallowed. */
export function primeSound() {
  if (getSettings().sound) context();
}
