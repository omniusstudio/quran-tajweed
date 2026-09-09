// Articulatory state model for the Articulation Viewer (PROMPT.md §5.2).

export type Pt = [number, number];

/** Front-view lip shapes. `rest` and `spread` map onto the nearest drawn state (see artwork.ts). */
export type LipKind = 'rest' | 'closed' | 'rounded' | 'teeth_on_lip' | 'open' | 'narrow' | 'spread';

/** Which part of the tongue is active in the top view (images/B*). */
export type TopRegion = 'sides' | 'front_edge' | 'tip' | 'middle' | 'back';

export type Airflow =
  | 'oral' // released through the mouth (stops, vowels)
  | 'nasal' // through the nose (ن م, ghunnah)
  | 'channel' // narrow channel at the teeth (ص س ز)
  | 'mid_channel' // spread channel over the middle of the tongue (ش)
  | 'lips_channel' // between upper teeth and lower lip (ف)
  | 'throat' // constriction in the pharynx (throat letters)
  | 'lateral' // around the sides of the tongue (ل) — drawn in the top view
  | 'jawf'; // free flow along the whole cavity (madd letters)

export type Phase = 'rest' | 'approach' | 'contact' | 'hold' | 'release';

export type Velum = 'open' | 'closed';

export interface TopParams {
  /** 0..1 intensity of each highlighted region; also selects the traced tongue shape. */
  highlight: Partial<Record<TopRegion, number>>;
  /** 0..1 lateral airflow arrows around the tongue (ل). */
  lateral: number;
}

export interface Keyframe {
  /** Normalised time 0..1. */
  t: number;
  phase: Phase;
  /** Name of a shape in artwork.SIDE_SHAPES, or explicit contour points. */
  tongue: string | Pt[];
  lips: LipKind;
  /** Jaw opening. Holds should sit on 0 (closed image), 0.5 (half, A15) or 1 (open, A14). */
  jaw: number;
  velum: Velum;
  /** Contact point (red dot) or near-contact ring. */
  contact?: Pt;
  contactKind?: 'touch' | 'near';
  airflow?: Airflow;
  heavy?: boolean;
  top?: Partial<TopParams>;
}

export type ArticulationGroup =
  | 'jawf'
  | 'throat'
  | 'back'
  | 'middle'
  | 'side'
  | 'tip_gum'
  | 'tip_root'
  | 'tip_lower'
  | 'tip_between'
  | 'lips'
  | 'khayshum'
  | 'vowel'
  | 'contrast';

export interface Articulation {
  id: string;
  /** Arabic letters shown as the label, e.g. "ق". */
  letters: string;
  /** Short Arabic name, e.g. "القاف". */
  nameAr: string;
  group: ArticulationGroup;
  /** Duration of one full cycle at 1× speed, in milliseconds. */
  duration: number;
  keyframes: Keyframe[];
  /** Harakah count to tick during the hold phase (madd / ghunnah). */
  harakat?: number;
  /** Label for the ticker, e.g. "مد" or "غنة". */
  tickerLabel?: string;
  /** Rendered greyed with ✗ — the "do not do this" version. */
  wrong?: boolean;
  /** lessons.json rule id whose text explains this articulation. */
  ruleId?: string;
  /** Annotated reference image names (images/annotated/*.png). */
  refImages?: string[];
  /** Something stated here is not in the content files and needs a scholar's review. */
  needsReview?: string;
}

export interface LipsShape {
  outer: Pt[];
  inner: Pt[];
  teethUpper: Pt[];
  teethLower: Pt[];
  tongue: Pt[];
  teethUpperOpacity: number;
  teethLowerOpacity: number;
  tongueOpacity: number;
  /** 0 = closed, 1 = fully drawn opening. */
  openness: number;
}

export interface TopShape {
  contour: Pt[];
  highlight: Partial<Record<TopRegion, number>>;
  lateral: number;
}

/** Fully interpolated state at one instant, ready to render. */
export interface ViewState {
  t: number;
  phase: Phase;
  /** Side-view tongue outline (closed contour). */
  tongue: Pt[];
  jaw: number;
  /** 0 = velum open (hanging), 1 = velum closed (raised against the pharynx). */
  velum: number;
  contact?: { pt: Pt; kind: 'touch' | 'near'; opacity: number };
  airflow?: { type: Airflow; opacity: number };
  heavy: number;
  lips: LipsShape;
  top: TopShape;
  /** Progress through the hold phase 0..1 (drives the harakah ticker). */
  hold: number;
}

export interface ContrastPair {
  id: string;
  title: string;
  a: string;
  b: string;
  note?: string;
}
