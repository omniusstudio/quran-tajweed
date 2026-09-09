// Waveform peaks and silence detection from decoded audio (used by the alignment editor and
// the record-and-compare thumbnails).

let ctx: AudioContext | null = null;
export function audioContext(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  return ctx;
}

export async function decode(data: ArrayBuffer): Promise<AudioBuffer> {
  return audioContext().decodeAudioData(data.slice(0));
}

/** Mono RMS envelope with `perSecond` samples per second. */
export function envelope(buf: AudioBuffer, perSecond = 50): Float32Array {
  const ch = buf.getChannelData(0);
  const step = Math.max(1, Math.floor(buf.sampleRate / perSecond));
  const n = Math.ceil(ch.length / step);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    const s = i * step;
    const e = Math.min(ch.length, s + step);
    for (let k = s; k < e; k++) sum += ch[k] * ch[k];
    out[i] = Math.sqrt(sum / Math.max(1, e - s));
  }
  return out;
}

/** Peak-normalised envelope for drawing. */
export function normalise(env: Float32Array): Float32Array {
  let max = 0;
  for (const v of env) max = Math.max(max, v);
  const out = new Float32Array(env.length);
  for (let i = 0; i < env.length; i++) out[i] = max ? env[i] / max : 0;
  return out;
}

/**
 * Pauses in the recording: gaps where the envelope stays under `thresholdRatio` × its median
 * loud level for at least `minGap` seconds. Returns [start, end] of each gap in seconds.
 */
export function silences(env: Float32Array, perSecond: number, minGap = 0.35, thresholdRatio = 0.12): [number, number][] {
  const sorted = Array.from(env).sort((a, b) => a - b);
  const loud = sorted[Math.floor(sorted.length * 0.8)] || 0;
  const thr = loud * thresholdRatio;
  const gaps: [number, number][] = [];
  let start = -1;
  for (let i = 0; i <= env.length; i++) {
    const quiet = i < env.length && env[i] < thr;
    if (quiet && start < 0) start = i;
    if (!quiet && start >= 0) {
      if ((i - start) / perSecond >= minGap) gaps.push([start / perSecond, i / perSecond]);
      start = -1;
    }
  }
  return gaps;
}

/** Segments of sound between the gaps (each is a candidate verse). */
export function segmentsFromSilences(gaps: [number, number][], duration: number, minLen = 0.6): [number, number][] {
  const segs: [number, number][] = [];
  let t = 0;
  for (const [s, e] of gaps) {
    if (s - t >= minLen) segs.push([t, s]);
    t = e;
  }
  if (duration - t >= minLen) segs.push([t, duration]);
  return segs;
}

export function drawWave(canvas: HTMLCanvasElement, env: Float32Array, opts: { from?: number; to?: number; color?: string; bg?: string } = {}) {
  const g = canvas.getContext('2d');
  if (!g) return;
  const w = canvas.width;
  const h = canvas.height;
  const from = opts.from ?? 0;
  const to = opts.to ?? env.length;
  g.fillStyle = opts.bg ?? '#fff';
  g.fillRect(0, 0, w, h);
  g.fillStyle = opts.color ?? '#1f7a4d';
  const span = Math.max(1, to - from);
  for (let x = 0; x < w; x++) {
    const i0 = from + Math.floor((x / w) * span);
    const i1 = from + Math.floor(((x + 1) / w) * span);
    let m = 0;
    for (let i = i0; i <= i1 && i < env.length; i++) m = Math.max(m, env[i]);
    const bh = Math.max(1, m * h * 0.95);
    g.fillRect(x, (h - bh) / 2, 1, bh);
  }
}
