// Keyframe engine: turns an Articulation + time into a fully interpolated ViewState.

import { LIP_KINDS, SHAPES, resample } from './geometry';
import type { Airflow, Articulation, Keyframe, LipParams, Pt, TopParams, TopRegion, ViewState } from './types';

export const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a: number, b: number, f: number) => a + (b - a) * f;

const shapeCache = new Map<string, Pt[]>();

export function tongueOf(kf: Keyframe): Pt[] {
  if (typeof kf.tongue !== 'string') return resample(kf.tongue);
  let s = shapeCache.get(kf.tongue);
  if (!s) {
    const raw = SHAPES[kf.tongue];
    if (!raw) throw new Error(`Unknown tongue shape "${kf.tongue}"`);
    s = resample(raw);
    shapeCache.set(kf.tongue, s);
  }
  return s;
}

const DEFAULT_TOP: TopParams = { width: 0, forward: 0, highlight: {}, lateral: 0 };
const REGIONS: TopRegion[] = ['sides', 'front_edge', 'tip', 'middle', 'back'];

function topOf(kf: Keyframe): TopParams {
  return { ...DEFAULT_TOP, ...(kf.top ?? {}), highlight: { ...(kf.top?.highlight ?? {}) } };
}

function lerpTop(a: TopParams, b: TopParams, f: number): TopParams {
  const highlight: Partial<Record<TopRegion, number>> = {};
  for (const r of REGIONS) {
    const v = lerp(a.highlight[r] ?? 0, b.highlight[r] ?? 0, f);
    if (v > 0.001) highlight[r] = v;
  }
  return { width: lerp(a.width, b.width, f), forward: lerp(a.forward, b.forward, f), highlight, lateral: lerp(a.lateral, b.lateral, f) };
}

function lerpLips(a: LipParams, b: LipParams, f: number): LipParams {
  return { open: lerp(a.open, b.open, f), round: lerp(a.round, b.round, f), tuck: lerp(a.tuck, b.tuck, f), teeth: lerp(a.teeth, b.teeth, f) };
}

/** Opacity of an optional feature across a segment: 1 when both ends have it, fades when only one does. */
function presence(a: unknown, b: unknown, f: number): number {
  if (a && b) return 1;
  if (a) return 1 - f;
  if (b) return f;
  return 0;
}

/** Find the segment [i, i+1] containing t. */
export function segmentAt(kfs: Keyframe[], t: number): { a: Keyframe; b: Keyframe; f: number } {
  const tt = Math.min(1, Math.max(0, t));
  let i = 0;
  while (i < kfs.length - 2 && kfs[i + 1].t <= tt) i++;
  const a = kfs[i];
  const b = kfs[Math.min(i + 1, kfs.length - 1)];
  const span = b.t - a.t;
  const f = span <= 0 ? 1 : Math.min(1, Math.max(0, (tt - a.t) / span));
  return { a, b, f };
}

/** Progress 0..1 through the contiguous run of 'hold' keyframes that contains t (0 if none). */
export function holdProgress(kfs: Keyframe[], t: number): number {
  let start = -1;
  let end = -1;
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i];
    const b = kfs[i + 1];
    if (a.phase === 'hold' && b.phase === 'hold') {
      if (start < 0) start = a.t;
      end = b.t;
    } else if (start >= 0 && t <= end) break;
    else if (start >= 0) {
      start = -1;
      end = -1;
    }
  }
  if (start < 0 || t < start || t > end) return 0;
  return end > start ? (t - start) / (end - start) : 1;
}

export function sampleState(art: Articulation, t: number): ViewState {
  const kfs = art.keyframes;
  const { a, b, f } = segmentAt(kfs, t);
  const e = easeInOut(f);

  const ta = tongueOf(a);
  const tb = tongueOf(b);
  const tongue: Pt[] = ta.map((p, i) => [lerp(p[0], tb[i][0], e), lerp(p[1], tb[i][1], e)]);

  const contactOpacity = presence(a.contact, b.contact, f);
  let contact: ViewState['contact'];
  if (contactOpacity > 0) {
    const ca = a.contact ?? b.contact!;
    const cb = b.contact ?? a.contact!;
    contact = {
      pt: [lerp(ca[0], cb[0], e), lerp(ca[1], cb[1], e)],
      kind: (a.contact ? a.contactKind : b.contactKind) ?? 'touch',
      opacity: contactOpacity,
    };
  }

  const flowOpacity = presence(a.airflow, b.airflow, f);
  let airflow: ViewState['airflow'];
  if (flowOpacity > 0) {
    const type: Airflow = (a.airflow ?? b.airflow)!;
    airflow = { type, opacity: flowOpacity };
  }

  return {
    t,
    phase: f < 1 ? a.phase : b.phase,
    tongue,
    jaw: lerp(a.jaw, b.jaw, e),
    velum: lerp(a.velum === 'closed' ? 1 : 0, b.velum === 'closed' ? 1 : 0, e),
    contact,
    airflow,
    heavy: lerp(a.heavy ? 1 : 0, b.heavy ? 1 : 0, e),
    lips: lerpLips(LIP_KINDS[a.lips], LIP_KINDS[b.lips], e),
    top: lerpTop(topOf(a), topOf(b), e),
    hold: holdProgress(kfs, t),
  };
}

/** Sanity checks on an articulation's keyframes; throws with a readable message. */
export function validate(art: Articulation): void {
  const k = art.keyframes;
  if (k.length < 2) throw new Error(`${art.id}: needs at least two keyframes`);
  if (k[0].t !== 0) throw new Error(`${art.id}: first keyframe must be at t=0`);
  if (k[k.length - 1].t !== 1) throw new Error(`${art.id}: last keyframe must be at t=1`);
  for (let i = 1; i < k.length; i++) {
    if (k[i].t < k[i - 1].t) throw new Error(`${art.id}: keyframe ${i} goes backwards in time`);
  }
  for (const kf of k) tongueOf(kf);
}
