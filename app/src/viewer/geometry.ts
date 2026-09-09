// Port of data/diagrams.py: coordinates, head outline, tongue shapes and spline helpers.
// Side view: 420×330 viewBox, face pointing LEFT. Lips: 200×150. Top view: 200×230.

import type { LipKind, LipParams, Pt } from './types';

export const SIDE_VIEW = { w: 420, h: 330 };
export const LIPS_VIEW = { w: 200, h: 150 };
export const TOP_VIEW = { w: 200, h: 230 };

export const COLORS = {
  ink: '#2b2b2b',
  skin: '#f3d9c4',
  tongue: '#d9736a',
  tongueEdge: '#a9403a',
  teeth: '#ffffff',
  red: '#c81e1e',
  blue: '#1d63b5',
  green: '#1f7a4d',
  grey: '#bbbbbb',
  cavity: '#6b2f2b',
  nasal: '#fff7f2',
  velum: '#b56b5e',
  lip: '#c9605b',
  mouthDark: '#5a1d1a',
};

/** Number of points every tongue shape is resampled to, so any two can be interpolated. */
export const TONGUE_N = 32;

// ---------------------------------------------------------------------------
// Catmull-Rom helpers (tension 0.5, matching diagrams.py::smooth_path)

function crPoint(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const t2 = t * t;
  const t3 = t2 * t;
  return [
    0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
    0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
  ];
}

/** Evaluate the Catmull-Rom spline through pts at `samples` uniformly spaced parameters. */
export function sampleSpline(pts: Pt[], samples: number): Pt[] {
  if (pts.length < 2) return pts.slice();
  const ext = [pts[0], ...pts, pts[pts.length - 1]];
  const segs = pts.length - 1;
  const out: Pt[] = [];
  for (let i = 0; i < samples; i++) {
    const u = (i / (samples - 1)) * segs;
    let k = Math.min(Math.floor(u), segs - 1);
    const t = u - k;
    out.push(crPoint(ext[k], ext[k + 1], ext[k + 2], ext[k + 3], t));
  }
  return out;
}

/** Resample a control polygon to `n` points equally spaced by arc length along its spline. */
export function resample(pts: Pt[], n = TONGUE_N): Pt[] {
  const dense = sampleSpline(pts, 240);
  const cum = [0];
  for (let i = 1; i < dense.length; i++) {
    const dx = dense[i][0] - dense[i - 1][0];
    const dy = dense[i][1] - dense[i - 1][1];
    cum.push(cum[i - 1] + Math.hypot(dx, dy));
  }
  const total = cum[cum.length - 1];
  const out: Pt[] = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const target = (i / (n - 1)) * total;
    while (j < cum.length - 2 && cum[j + 1] < target) j++;
    const span = cum[j + 1] - cum[j] || 1;
    const f = Math.min(1, Math.max(0, (target - cum[j]) / span));
    out.push([dense[j][0] + (dense[j + 1][0] - dense[j][0]) * f, dense[j][1] + (dense[j + 1][1] - dense[j][1]) * f]);
  }
  return out;
}

/** SVG path: smooth curve through pts, then straight segments through closePts, closed. */
export function smoothPath(pts: Pt[], closePts: Pt[] = []): string {
  if (pts.length === 0) return '';
  const f = (v: number) => v.toFixed(1);
  let d = `M ${f(pts[0][0])} ${f(pts[0][1])} `;
  const ext = [pts[0], ...pts, pts[pts.length - 1]];
  for (let k = 1; k < ext.length - 2; k++) {
    const p0 = ext[k - 1], p1 = ext[k], p2 = ext[k + 1], p3 = ext[k + 2];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C ${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])} `;
  }
  for (const p of closePts) d += `L ${f(p[0])} ${f(p[1])} `;
  return d + 'Z';
}

export function polyline(pts: Pt[]): string {
  return pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}

// ---------------------------------------------------------------------------
// Side-view static anatomy (from diagrams.py::head_outline)

export const HEAD = {
  profile:
    'M 170 14 C 110 14 76 50 74 100 C 74 112 66 120 56 128 C 46 136 50 146 62 150 L 74 152 C 78 158 74 166 66 170 C 60 176 66 184 76 186 C 70 192 66 200 74 208 C 84 218 104 232 124 244 C 148 258 176 266 176 330 L 420 330 L 420 14 Z',
  nasalCavity: 'M 80 120 C 120 74 220 62 300 86 L 302 118 C 240 106 150 108 112 138 Z',
  oralCavity:
    'M 104 150 C 120 136 150 124 200 118 C 250 114 288 122 306 142 C 316 156 314 176 306 190 C 300 200 296 214 300 240 L 296 300 L 270 300 C 262 262 220 238 168 226 C 130 218 110 206 100 196 Z',
  hardPalate: 'M 104 150 C 120 136 150 124 200 118 C 236 115 264 118 282 126',
  pharynxWall: 'M 322 92 L 322 300',
  vocalFolds: 'M 268 302 C 280 292 306 292 318 302',
  upperTeeth: 'M 92 150 L 88 176 L 102 176 L 106 150 Z',
  lowerTeeth: 'M 96 208 L 92 184 L 106 184 L 108 208 Z',
  floorOfMouth: 'M 100 196 C 110 206 130 218 168 226 C 220 238 262 262 270 300',
  upperMolars: [
    { x: 200, y: 116, w: 26, h: 12 },
    { x: 232, y: 118, w: 24, h: 12 },
  ],
};

/** Soft palate + uvula control numbers. "open" = hanging (reference art), "closed" = raised to seal the nose. */
export const VELUM_OPEN = [282, 126, 300, 134, 310, 148, 308, 166, 306, 180, 298, 188, 292, 184];
export const VELUM_CLOSED = [282, 126, 300, 124, 314, 128, 320, 142, 322, 152, 318, 160, 310, 158];

export function velumPath(v: number): string {
  const n = VELUM_OPEN.map((a, i) => a + (VELUM_CLOSED[i] - a) * v);
  return `M ${n[0]} ${n[1]} C ${n[2]} ${n[3]} ${n[4]} ${n[5]} ${n[6]} ${n[7]} C ${n[8]} ${n[9]} ${n[10]} ${n[11]} ${n[12]} ${n[13]}`;
}

/** Vertical drop (px) of the lower jaw group at jaw = 1. */
export const JAW_DROP = 14;

/** Tongue underside, back → front (diagrams.py::FLOOR). */
export const FLOOR: Pt[] = [
  [292, 300],
  [270, 300],
  [230, 244],
  [168, 228],
  [120, 214],
  [104, 200],
];

/** FLOOR shifted with the jaw: the front of the floor follows the jaw, the root does not. */
export function floorAt(jaw: number): Pt[] {
  const drop = jaw * JAW_DROP;
  return [
    [292, 300],
    [270, 300],
    [230, 244 + drop * 0.35],
    [168, 228 + drop * 0.8],
    [120, 214 + drop],
    [104, 200 + drop],
  ];
}

/** Tongue top-surface control points, front (left) → back (right). */
export const SHAPES: Record<string, Pt[]> = {
  // --- verbatim from diagrams.py::TOP ---
  rest: [[108, 186], [150, 182], [200, 180], [250, 186], [290, 206], [296, 240]],
  throat: [[108, 188], [150, 186], [200, 186], [250, 192], [288, 214], [296, 246]],
  tip_ridge: [[104, 150], [118, 150], [150, 176], [200, 182], [250, 188], [290, 206], [296, 240]],
  tip_teeth_root: [[100, 156], [114, 156], [150, 178], [200, 182], [250, 188], [290, 206], [296, 240]],
  tip_between: [[84, 178], [110, 180], [150, 184], [200, 184], [250, 190], [290, 208], [296, 240]],
  tip_lower: [[100, 186], [120, 180], [150, 182], [200, 182], [250, 190], [290, 208], [296, 240]],
  mid_palate: [[108, 184], [140, 164], [180, 128], [215, 122], [250, 140], [284, 176], [296, 220], [296, 244]],
  back_soft: [[108, 186], [150, 178], [200, 168], [250, 138], [284, 128], [300, 150], [298, 220], [296, 244]],
  back_hard: [[108, 186], [150, 176], [200, 156], [236, 126], [262, 122], [290, 150], [298, 220], [296, 244]],
  heavy: [[108, 188], [150, 186], [200, 176], [240, 154], [272, 140], [292, 160], [298, 220], [296, 244]],
  light: [[108, 186], [150, 182], [200, 182], [250, 188], [290, 208], [296, 240]],
  imalah_py: [[108, 184], [140, 168], [180, 148], [220, 142], [256, 154], [282, 180], [294, 212], [296, 244]],
  closed_jaw: [[108, 184], [150, 178], [200, 174], [250, 182], [290, 204], [296, 240]],

  // --- added for the animation (see README addendum) ---
  /** ش: middle raised but leaving a channel under the palate. */
  mid_channel: [[108, 184], [140, 166], [180, 136], [215, 130], [250, 146], [284, 178], [296, 220], [296, 244]],
  /** ي: like ش, a little lower. */
  mid_ya: [[108, 184], [140, 168], [180, 142], [215, 136], [250, 150], [284, 180], [296, 220], [296, 244]],
  /** غ خ: back raised toward the uvula with a narrow gap, no contact. */
  back_near: [[108, 186], [150, 180], [200, 172], [250, 148], [284, 140], [300, 160], [298, 220], [296, 244]],
  /** ر flap: tip curled, brief contact at the ridge. */
  tip_flap: [[106, 152], [120, 152], [150, 178], [200, 184], [250, 190], [290, 208], [296, 240]],
  /** ط: tip at the roots of the teeth + raised back (heavy). */
  tip_teeth_root_heavy: [[100, 156], [114, 156], [150, 180], [200, 180], [240, 158], [272, 142], [292, 162], [298, 220], [296, 244]],
  /** ص: narrow channel at the teeth + raised back (heavy). */
  tip_lower_heavy: [[100, 186], [120, 180], [150, 182], [200, 178], [240, 158], [272, 142], [292, 162], [298, 220], [296, 244]],
  /** ظ: tip between the teeth + raised back (heavy). */
  tip_between_heavy: [[84, 178], [110, 180], [150, 184], [200, 180], [240, 158], [272, 142], [292, 162], [298, 220], [296, 244]],
  /** ض: the side view can only show the raised back; the top view shows the edges. */
  dad: [[108, 182], [150, 170], [200, 166], [240, 154], [272, 142], [292, 162], [298, 220], [296, 244]],
  /** و / ḍammah: back slightly raised, lips do the work. */
  waw: [[108, 188], [150, 184], [200, 176], [250, 160], [284, 150], [296, 172], [298, 220], [296, 244]],
  /** Open alif / fatḥah: tongue flat and low, jaw dropped. */
  alif_open: [[108, 190], [150, 190], [200, 188], [250, 192], [290, 210], [296, 242]],
  /** Kasrah: front raised toward the palate, jaw low. */
  kasrah: [[108, 184], [140, 166], [180, 146], [220, 144], [256, 160], [282, 184], [294, 214], [296, 244]],
  /** Imālah (addendum: front raised, back kept low). */
  imalah: [[108, 182], [140, 162], [180, 146], [220, 148], [256, 166], [284, 188], [294, 214], [296, 244]],
  /** ر between taps (wrong trill): tip just off the ridge. */
  tip_ridge_off: [[106, 162], [120, 160], [150, 178], [200, 184], [250, 190], [290, 208], [296, 240]],
  /** ل of الله when heavy: tip on the ridge + raised back. */
  tip_ridge_heavy: [[104, 150], [118, 150], [150, 178], [200, 180], [240, 158], [272, 142], [292, 162], [298, 220], [296, 244]],
};

// ---------------------------------------------------------------------------
// Landmarks on the anatomy, for contact points and airflow paths

export const LANDMARKS = {
  ridge: [112, 148] as Pt, // gum ridge behind the upper teeth (ل ن ر)
  teethRoot: [104, 154] as Pt, // roots of the upper teeth (ط د ت)
  teethEdge: [88, 178] as Pt, // tip between the teeth (ظ ذ ث)
  lowerTeeth: [100, 184] as Pt, // behind the lower teeth (ص س ز)
  hardPalateMid: [212, 120] as Pt, // middle of the hard palate (ج ش ي)
  hardSoftBoundary: [264, 120] as Pt, // ك
  softPalate: [284, 126] as Pt, // ق
  uvula: [300, 150] as Pt, // غ خ near-contact
  throat1: [300, 284] as Pt, // vocal folds (ء هـ)
  throat2: [316, 222] as Pt, // mid throat (ع ح)
  throat3: [312, 150] as Pt, // upper throat (غ خ)
  heavyRing: [268, 144] as Pt,
  imalahRing: [190, 150] as Pt,
};

export const AIRFLOW_PATHS: Record<string, Pt[]> = {
  oral: [[300, 250], [240, 150], [150, 150], [80, 160]],
  nasal: [[300, 240], [300, 150], [260, 100], [160, 84], [78, 124]],
  channel: [[200, 170], [120, 168], [72, 172]],
  mid_channel: [[260, 200], [200, 140], [130, 150], [76, 160]],
  lips_channel: [[180, 170], [120, 176], [70, 190]],
  throat: [[300, 280], [306, 220], [290, 170], [220, 150], [90, 158]],
  jawf: [[300, 270], [292, 190], [240, 150], [150, 150], [70, 160]],
  lateral: [],
};

// ---------------------------------------------------------------------------
// Front-view lips: each kind is a point in LipParams space so shapes interpolate.

export const LIP_KINDS: Record<LipKind, LipParams> = {
  rest: { open: 0.12, round: 0, tuck: 0, teeth: 0 },
  closed: { open: 0, round: 0.1, tuck: 0, teeth: 0 },
  rounded: { open: 0.45, round: 1, tuck: 0, teeth: 0 },
  teeth_on_lip: { open: 0.3, round: 0, tuck: 1, teeth: 1 },
  open: { open: 1, round: 0, tuck: 0, teeth: 1 },
  narrow: { open: 0.5, round: 0, tuck: 0, teeth: 0.6 },
  spread: { open: 0.35, round: -0.6, tuck: 0, teeth: 0.4 },
};

// ---------------------------------------------------------------------------
// Sampled palate line, used by the anatomical guard test (tongue must stay below it).

function bez(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
}

/** Returns the y of the roof of the mouth at x (hard palate + open soft palate), or -Infinity outside. */
export function roofY(x: number): number {
  const segs: [Pt, Pt, Pt, Pt][] = [
    [[104, 150], [120, 136], [150, 124], [200, 118]],
    [[200, 118], [236, 115], [264, 118], [282, 126]],
    [[282, 126], [300, 134], [310, 148], [308, 166]],
  ];
  let best = -Infinity;
  for (const s of segs) {
    for (let i = 0; i <= 40; i++) {
      const p = bez(s[0], s[1], s[2], s[3], i / 40);
      if (Math.abs(p[0] - x) < 2.5) best = Math.max(best, p[1]);
    }
  }
  if (x < 104 && x >= 88) return 150; // upper incisors: the crown hangs from y=150 down to 176
  return best;
}
