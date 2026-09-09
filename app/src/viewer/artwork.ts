// Typed access to the traced artwork (scripts/trace_artwork.py -> artwork.json) plus the
// derived shapes, landmarks and airflow paths the animation needs. All coordinates are in
// the artwork's own pixel space: side 1024×1024, top and lips 1024×540.

import art from './artwork.json';
import type { Airflow, LipKind, Pt, TopRegion } from './types';

type Tongues = Record<string, Pt[]>;

interface LipStateJson {
  outer: Pt[];
  inner: Pt[];
  open: boolean;
  teethUpper: Pt[];
  hasTeethUpper: boolean;
  teethLower: Pt[];
  hasTeethLower: boolean;
  tongue: Pt[];
  hasTongue: boolean;
}

interface ArtJson {
  side: { size: [number, number]; tongues: Tongues; backgrounds: Record<string, string>; allowed: { cols: number; rows: number; bits: string[] } };
  top: { size: [number, number]; tongues: Tongues };
  lips: { size: [number, number]; states: Record<string, LipStateJson>; lipLine: Pt[] };
  marks: Record<string, { dots: Pt[]; rings: [number, number, number][] }>;
}

const A = art as unknown as ArtJson;

export const SIDE_SIZE = { w: A.side.size[0], h: A.side.size[1] };
export const TOP_SIZE = { w: A.top.size[0], h: A.top.size[1] };
export const LIPS_SIZE = { w: A.lips.size[0], h: A.lips.size[1] };

/** Crop of the side view actually shown (the artwork has wide margins). */
export const SIDE_VIEWBOX = '60 60 860 900';
export const TOP_VIEWBOX = '250 20 524 500';
export const LIPS_VIEWBOX = '150 0 724 540';

// ---------------------------------------------------------------------------
// Blending helpers

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Per-point blend from a to b; w may depend on the point of `a`. */
export function blend(a: Pt[], b: Pt[], w: number | ((p: Pt) => number)): Pt[] {
  return a.map((p, i) => {
    const f = typeof w === 'number' ? w : w(p);
    return [p[0] + (b[i][0] - p[0]) * f, p[1] + (b[i][1] - p[1]) * f];
  });
}

const T = A.side.tongues;
/** Front of the tongue from `front`, the raised back from the heavy image (ط ص ظ, لام الله). */
const heavyBack = (front: Pt[]) => blend(front, T.heavy, (p) => smoothstep(470, 660, p[0]));

/** Every side-view tongue shape the catalogue can reference. Traced ones first, derived ones after. */
export const SIDE_SHAPES: Record<string, Pt[]> = {
  rest: T.rest,
  throat: T.throat_mid,
  back_near: T.throat_upper,
  qaf: T.qaf,
  kaf: T.kaf,
  jim: T.jim_shin_ya,
  lam: T.lam_nun_ra,
  ghunnah: T.ghunnah,
  ta: T.ta_dal_tta,
  sin: T.sad_sin_zay,
  tha: T.tha_dhal_zha,
  heavy: T.heavy,
  light: T.light,
  alif_open: T.alif_open,
  imalah: T.imalah,
  // derived (README: keyframes not covered by a base image)
  shin: blend(T.jim_shin_ya, T.rest, 0.3), // channel under the palate instead of contact
  ya: blend(T.jim_shin_ya, T.rest, 0.45),
  tip_flap: T.lam_nun_ra,
  tip_off: blend(T.lam_nun_ra, T.rest, 0.45), // between taps of the wrong ر
  tta: heavyBack(T.ta_dal_tta),
  sad: heavyBack(T.sad_sin_zay),
  zha: heavyBack(T.tha_dhal_zha),
  lam_heavy: heavyBack(T.lam_nun_ra),
  dad: T.heavy,
  waw: blend(T.rest, T.qaf, 0.35),
  kasrah: blend(T.imalah, T.rest, 0.25),
};

export const SIDE_POINTS = T.rest.length;

const M = A.marks;
const dot = (name: string, i = 0): Pt => M[name].dots[i];
const ring = (name: string) => ({ c: [M[name].rings[0][0], M[name].rings[0][1]] as Pt, r: M[name].rings[0][2] });

/** Contact points and rings, straight from the annotated reference images. */
export const LANDMARKS = {
  qaf: dot('qaf'),
  kaf: dot('kaf'),
  palateMid: dot('jim_shin_ya'),
  ridge: dot('lam_nun_ra'),
  teethRoot: dot('ta_dal_tta'),
  lowerTeeth: dot('sad_sin_zay'),
  teethEdge: dot('tha_dhal_zha'),
  uvula: dot('throat_upper'),
  throat1: dot('throat_zones', 0),
  throat2: dot('throat_zones', 1),
  throat3: dot('throat_zones', 2),
  heavyRing: ring('heavy'),
  imalahRing: ring('imalah'),
  topTip: dot('top_tip'),
};

/** Airflow arrows in side-view coordinates (traced by eye from the annotated images). */
export const AIRFLOW_PATHS: Record<Airflow, Pt[]> = {
  nasal: [[735, 880], [742, 640], [700, 420], [560, 328], [330, 336], [222, 392]],
  oral: [[690, 640], [560, 570], [360, 566], [232, 586]],
  channel: [[640, 560], [430, 546], [300, 556], [238, 576]],
  mid_channel: [[690, 640], [560, 540], [360, 556], [232, 586]],
  lips_channel: [[430, 572], [300, 588], [216, 604]],
  throat: [[742, 900], [738, 700], [692, 600], [560, 566], [240, 586]],
  jawf: [[730, 880], [736, 650], [690, 572], [520, 566], [250, 596]],
  lateral: [],
};

/** Soft palate + uvula as a cubic: hanging (open, as drawn) and raised against the pharynx wall (closed). */
export const VELUM_OPEN = [598, 452, 650, 468, 688, 505, 698, 548];
export const VELUM_CLOSED = [598, 452, 650, 452, 712, 452, 752, 472];

// ---------------------------------------------------------------------------
// Top view

const TT = A.top.tongues;
export const TOP_SHAPES = TT;
export const TOP_REGION_SHAPE: Partial<Record<TopRegion, string>> = { sides: 'sides', front_edge: 'front_edge', tip: 'tip', back: 'back' };
export const TOP_POINTS = TT.rest.length;

// ---------------------------------------------------------------------------
// Lips

export const LIP_STATES = A.lips.states;
export const LIP_STATE_OF: Record<LipKind, string> = {
  rest: 'closed',
  closed: 'closed',
  rounded: 'rounded',
  teeth_on_lip: 'teeth_on_lip',
  open: 'open',
  narrow: 'narrow',
  spread: 'narrow',
};
export const LIP_POINTS = A.lips.states.closed.outer.length;

// ---------------------------------------------------------------------------
// Allowed region for the anatomical guard test

export function tongueAllowedAt(x: number, y: number): boolean {
  const g = A.side.allowed;
  const cx = Math.floor((x / SIDE_SIZE.w) * g.cols);
  const cy = Math.floor((y / SIDE_SIZE.h) * g.rows);
  if (cx < 0 || cy < 0 || cx >= g.cols || cy >= g.rows) return false;
  return g.bits[cy][cx] === '1';
}

// ---------------------------------------------------------------------------
// Path helpers

const f1 = (v: number) => v.toFixed(1);

/** Closed Catmull-Rom curve through pts as an SVG path. */
export function closedPath(pts: Pt[]): string {
  const n = pts.length;
  if (n < 3) return '';
  let d = `M ${f1(pts[0][0])} ${f1(pts[0][1])} `;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C ${f1(c1[0])} ${f1(c1[1])} ${f1(c2[0])} ${f1(c2[1])} ${f1(p2[0])} ${f1(p2[1])} `;
  }
  return d + 'Z';
}

export function polyline(pts: Pt[]): string {
  return pts.map(([x, y]) => `${f1(x)},${f1(y)}`).join(' ');
}

export function lerpNums(a: number[], b: number[], f: number): number[] {
  return a.map((v, i) => v + (b[i] - v) * f);
}
