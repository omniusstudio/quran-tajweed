// Keyframe engine: turns an Articulation + time into a fully interpolated ViewState.

import { LIP_STATES, LIP_STATE_OF, SIDE_SHAPES, TOP_REGION_SHAPE, TOP_SHAPES, blend } from './artwork';
import type { Airflow, Articulation, Keyframe, LipsShape, Pt, TopParams, TopRegion, TopShape, ViewState } from './types';

export const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a: number, b: number, f: number) => a + (b - a) * f;

export function tongueOf(kf: Keyframe): Pt[] {
  if (typeof kf.tongue !== 'string') return kf.tongue;
  const s = SIDE_SHAPES[kf.tongue];
  if (!s) throw new Error(`Unknown tongue shape "${kf.tongue}"`);
  return s;
}

const REGIONS: TopRegion[] = ['sides', 'front_edge', 'tip', 'middle', 'back'];
const DEFAULT_TOP: TopParams = { highlight: {}, lateral: 0 };

function topOf(kf: Keyframe): TopParams {
  return { ...DEFAULT_TOP, ...(kf.top ?? {}), highlight: { ...(kf.top?.highlight ?? {}) } };
}

/** The top-view contour for a set of highlight weights: rest plus each region's traced offset. */
export function topContour(highlight: Partial<Record<TopRegion, number>>): Pt[] {
  let c = TOP_SHAPES.rest;
  for (const r of REGIONS) {
    const w = highlight[r] ?? 0;
    const shapeName = TOP_REGION_SHAPE[r];
    if (w > 0 && shapeName) c = blend(c, TOP_SHAPES[shapeName], w);
  }
  return c;
}

function lerpTop(a: TopParams, b: TopParams, f: number): TopShape {
  const highlight: Partial<Record<TopRegion, number>> = {};
  for (const r of REGIONS) {
    const v = lerp(a.highlight[r] ?? 0, b.highlight[r] ?? 0, f);
    if (v > 0.001) highlight[r] = v;
  }
  return { contour: topContour(highlight), highlight, lateral: lerp(a.lateral, b.lateral, f) };
}

function lerpLips(ka: Keyframe, kb: Keyframe, f: number): LipsShape {
  const a = LIP_STATES[LIP_STATE_OF[ka.lips]];
  const b = LIP_STATES[LIP_STATE_OF[kb.lips]];
  return {
    outer: blend(a.outer, b.outer, f),
    inner: blend(a.inner, b.inner, f),
    teethUpper: blend(a.teethUpper, b.teethUpper, f),
    teethLower: blend(a.teethLower, b.teethLower, f),
    tongue: blend(a.tongue, b.tongue, f),
    teethUpperOpacity: lerp(a.hasTeethUpper ? 1 : 0, b.hasTeethUpper ? 1 : 0, f),
    teethLowerOpacity: lerp(a.hasTeethLower ? 1 : 0, b.hasTeethLower ? 1 : 0, f),
    tongueOpacity: lerp(a.hasTongue ? 1 : 0, b.hasTongue ? 1 : 0, f),
    openness: lerp(a.open ? 1 : 0, b.open ? 1 : 0, f),
  };
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

  const tongue = blend(tongueOf(a), tongueOf(b), e);

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
    lips: lerpLips(a, b, e),
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
  for (const kf of k) {
    tongueOf(kf);
    if (!LIP_STATES[LIP_STATE_OF[kf.lips]]) throw new Error(`${art.id}: unknown lips "${kf.lips}"`);
  }
}
