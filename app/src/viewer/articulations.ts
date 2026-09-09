// The catalogue: every letter, vowel and Dūrī feature as a keyframe sequence (PROMPT.md §5.2).
// Tongue shapes and contact points come from the traced artwork (artwork.ts); timings are
// normalised 0..1 and `duration` is the length of one cycle at 1× speed.
//
// Jaw values at holds sit on 0 / 0.5 / 1 because they crossfade the closed (A01), half-open
// (A15) and open (A14) drawings. Anything stated here that is NOT in data/content_*.py is
// marked with `needsReview` and shown with a "يُراجع" badge in the UI (PROMPT.md §9).

import { LANDMARKS as L } from './artwork';
import type { Airflow, Articulation, ArticulationGroup, ContrastPair, Keyframe, LipKind, Phase, Pt, TopParams } from './types';

type Partial_ = Partial<Keyframe>;

const BASE: Omit<Keyframe, 't' | 'phase'> = { tongue: 'rest', lips: 'closed', jaw: 0, velum: 'closed' };
const REST: Omit<Keyframe, 't' | 'phase'> = { ...BASE, velum: 'open' }; // breathing: velum hangs

function kf(t: number, phase: Phase, p: Partial_ = {}): Keyframe {
  return { ...BASE, ...p, t, phase };
}

interface Opts {
  shape: string;
  contact?: Pt;
  contactKind?: 'touch' | 'near';
  lips?: LipKind;
  jaw?: number;
  heavy?: boolean;
  top?: Partial<TopParams>;
  airflow?: Airflow;
  /** Tongue shape while the sound is released (defaults to rest). */
  releaseShape?: string;
}

/** Stop consonant: approach → contact held → release with a burst of air → rest. */
function plosive(o: Opts): Keyframe[] {
  const lips = o.lips ?? 'closed';
  const jaw = o.jaw ?? 0;
  const held: Partial_ = { tongue: o.shape, contact: o.contact, contactKind: 'touch', lips, jaw, heavy: o.heavy, top: o.top };
  const rel: Partial_ = { tongue: o.releaseShape ?? 'rest', lips: lips === 'closed' ? 'narrow' : lips, jaw: Math.min(1, jaw + 0.5), heavy: o.heavy, top: o.top, airflow: o.airflow ?? 'oral' };
  return [
    kf(0, 'rest', REST),
    kf(0.18, 'approach', { jaw, lips, top: o.top }),
    kf(0.34, 'contact', held),
    kf(0.54, 'contact', held),
    kf(0.66, 'release', rel),
    kf(0.82, 'release', { ...rel, airflow: undefined }),
    kf(1, 'rest', REST),
  ];
}

/** Fricative / continuant: approach → narrow constriction held with airflow → rest. */
function fricative(o: Opts): Keyframe[] {
  const lips = o.lips ?? 'narrow';
  const jaw = o.jaw ?? 0;
  const held: Partial_ = { tongue: o.shape, contact: o.contact, contactKind: o.contactKind ?? 'near', lips, jaw, heavy: o.heavy, top: o.top, airflow: o.airflow ?? 'channel' };
  return [
    kf(0, 'rest', REST),
    kf(0.2, 'approach', { jaw, lips, top: o.top }),
    kf(0.34, 'hold', held),
    kf(0.72, 'hold', held),
    kf(0.86, 'release', { jaw, lips }),
    kf(1, 'rest', REST),
  ];
}

/** Nasal: closure in the mouth, velum open, sound through the nose for the whole hold. */
function nasal(o: Opts): Keyframe[] {
  const lips = o.lips ?? 'closed';
  const jaw = o.jaw ?? 0;
  const held: Partial_ = { tongue: o.shape, contact: o.contact, contactKind: 'touch', lips, jaw, velum: 'open', airflow: 'nasal', top: o.top };
  return [
    kf(0, 'rest', REST),
    kf(0.18, 'approach', { jaw, lips, velum: 'open', top: o.top }),
    kf(0.32, 'hold', held),
    kf(0.74, 'hold', held),
    kf(0.86, 'release', { jaw, lips: lips === 'closed' ? 'narrow' : lips, velum: 'open' }),
    kf(1, 'rest', REST),
  ];
}

/** Vowel / madd: open tract held with free airflow. */
function vowel(o: Opts): Keyframe[] {
  const lips = o.lips ?? 'open';
  const jaw = o.jaw ?? 1;
  const held: Partial_ = { tongue: o.shape, lips, jaw, heavy: o.heavy, contact: o.contact, contactKind: o.contactKind ?? 'near', airflow: o.airflow ?? 'oral', top: o.top };
  return [
    kf(0, 'rest', REST),
    kf(0.18, 'approach', { jaw, lips }),
    kf(0.3, 'hold', held),
    kf(0.78, 'hold', held),
    kf(0.9, 'release', { jaw: 0, lips: 'closed' }),
    kf(1, 'rest', REST),
  ];
}

/** ر: a single light tap of the tip on the ridge. */
function flap(heavy: boolean): Keyframe[] {
  const top = heavy ? { highlight: { tip: 1, back: 0.5 } } : { highlight: { tip: 1 } };
  const tap: Partial_ = { tongue: heavy ? 'lam_heavy' : 'tip_flap', contact: L.ridge, contactKind: 'touch', lips: 'narrow', heavy, top };
  const off: Partial_ = { tongue: heavy ? 'heavy' : 'rest', lips: 'narrow', heavy, airflow: 'oral', top: { highlight: { tip: 0.4 } } };
  return [
    kf(0, 'rest', REST),
    kf(0.22, 'approach', { lips: 'narrow', heavy }),
    kf(0.36, 'contact', tap),
    kf(0.42, 'contact', tap),
    kf(0.5, 'release', off),
    kf(0.7, 'release', { ...off, airflow: undefined }),
    kf(1, 'rest', REST),
  ];
}

/** The wrong ر: a rolled trill with several taps (shown greyed with ✗). */
function trillWrong(): Keyframe[] {
  const tap: Partial_ = { tongue: 'tip_flap', contact: L.ridge, contactKind: 'touch', lips: 'narrow', top: { highlight: { tip: 1 } } };
  const off: Partial_ = { tongue: 'tip_off', lips: 'narrow', airflow: 'oral', top: { highlight: { tip: 0.6 } } };
  const frames: Keyframe[] = [kf(0, 'rest', REST), kf(0.2, 'approach', { lips: 'narrow' })];
  let t = 0.28;
  for (let i = 0; i < 4; i++) {
    frames.push(kf(t, 'contact', tap), kf(t + 0.05, 'contact', tap), kf(t + 0.09, 'release', off));
    t += 0.13;
  }
  frames.push(kf(0.88, 'release', { lips: 'narrow' }), kf(1, 'rest', REST));
  return frames;
}

const TOP_TIP = { highlight: { tip: 1 } };
const TOP_BACK = { highlight: { back: 1 } };
const TOP_MID = { highlight: { middle: 1 } };
const TOP_HEAVY = { highlight: { back: 0.5 } };

function art(a: Omit<Articulation, 'duration'> & { duration?: number }): Articulation {
  return { duration: 2600, ...a };
}

// ---------------------------------------------------------------------------

export const ARTICULATIONS: Articulation[] = [
  // ---- الجوف: حروف المد ----------------------------------------------------
  art({ id: 'alif_madd', letters: 'ا', nameAr: 'الألف (مد)', group: 'jawf', duration: 3200, harakat: 2, tickerLabel: 'مد',
    keyframes: vowel({ shape: 'alif_open', lips: 'open', jaw: 1, airflow: 'jawf' }),
    ruleId: 's3r10', refImages: ['jawf', 'alif_open', 'lips_open'] }),
  art({ id: 'waw_madd', letters: 'و', nameAr: 'الواو (مد)', group: 'jawf', duration: 3200, harakat: 2, tickerLabel: 'مد',
    keyframes: vowel({ shape: 'waw', lips: 'rounded', jaw: 0, airflow: 'jawf' }),
    ruleId: 's3r10', refImages: ['jawf', 'lips_rounded'],
    needsReview: 'ارتفاع مؤخرة اللسان قليلاً في الواو غير مذكور في المحتوى؛ المذكور هو تدوير الشفتين.' }),
  art({ id: 'ya_madd', letters: 'ي', nameAr: 'الياء (مد)', group: 'jawf', duration: 3200, harakat: 2, tickerLabel: 'مد',
    keyframes: vowel({ shape: 'kasrah', lips: 'narrow', jaw: 0.5, airflow: 'jawf', top: { highlight: { middle: 0.5 } } }),
    ruleId: 's3r10', refImages: ['jawf'] }),

  // ---- الحلق -----------------------------------------------------------------
  art({ id: 'hamza', letters: 'ء', nameAr: 'الهمزة', group: 'throat',
    keyframes: plosive({ shape: 'throat', contact: L.throat1, lips: 'narrow', airflow: 'throat', releaseShape: 'throat' }),
    ruleId: 's3r1', refImages: ['throat_zones'],
    needsReview: 'الرسم يُغلق الحبال الصوتية للهمزة ويتركها مفتوحة للهاء؛ المحتوى يذكر فقط أن كليهما من أقصى الحلق.' }),
  art({ id: 'ha', letters: 'هـ', nameAr: 'الهاء', group: 'throat',
    keyframes: fricative({ shape: 'throat', contact: L.throat1, contactKind: 'near', airflow: 'throat' }),
    ruleId: 's3r1', refImages: ['throat_zones'] }),
  art({ id: 'ain', letters: 'ع', nameAr: 'العين', group: 'throat',
    keyframes: fricative({ shape: 'throat', contact: L.throat2, contactKind: 'near', airflow: 'throat' }),
    ruleId: 's3r1', refImages: ['throat_zones'] }),
  art({ id: 'hha', letters: 'ح', nameAr: 'الحاء', group: 'throat',
    keyframes: fricative({ shape: 'throat', contact: L.throat2, contactKind: 'near', airflow: 'throat' }),
    ruleId: 's3r1', refImages: ['throat_zones'] }),
  art({ id: 'ghain', letters: 'غ', nameAr: 'الغين', group: 'throat',
    keyframes: fricative({ shape: 'back_near', contact: L.uvula, contactKind: 'near', heavy: true, airflow: 'throat', top: TOP_HEAVY }),
    ruleId: 's3r1', refImages: ['throat_upper', 'throat_zones'] }),
  art({ id: 'kha', letters: 'خ', nameAr: 'الخاء', group: 'throat',
    keyframes: fricative({ shape: 'back_near', contact: L.uvula, contactKind: 'near', heavy: true, airflow: 'throat', top: TOP_HEAVY }),
    ruleId: 's3r1', refImages: ['throat_upper', 'throat_zones'] }),

  // ---- أقصى اللسان ------------------------------------------------------------
  art({ id: 'qaf', letters: 'ق', nameAr: 'القاف', group: 'back',
    keyframes: plosive({ shape: 'qaf', contact: L.qaf, heavy: true, top: TOP_BACK }),
    ruleId: 's3r2', refImages: ['qaf', 'top_back'] }),
  art({ id: 'kaf', letters: 'ك', nameAr: 'الكاف', group: 'back',
    keyframes: plosive({ shape: 'kaf', contact: L.kaf, top: TOP_BACK }),
    ruleId: 's3r2', refImages: ['kaf', 'top_back'] }),

  // ---- وسط اللسان -------------------------------------------------------------
  art({ id: 'jim', letters: 'ج', nameAr: 'الجيم', group: 'middle',
    keyframes: plosive({ shape: 'jim', contact: L.palateMid, top: TOP_MID }),
    ruleId: 's3r3', refImages: ['jim_shin_ya'] }),
  art({ id: 'shin', letters: 'ش', nameAr: 'الشين', group: 'middle',
    keyframes: fricative({ shape: 'shin', contact: L.palateMid, contactKind: 'near', airflow: 'mid_channel', top: TOP_MID }),
    ruleId: 's3r3', refImages: ['jim_shin_ya'] }),
  art({ id: 'ya', letters: 'ي', nameAr: 'الياء', group: 'middle',
    keyframes: fricative({ shape: 'ya', contact: L.palateMid, contactKind: 'near', airflow: 'mid_channel', lips: 'narrow', top: { highlight: { middle: 0.7 } } }),
    ruleId: 's3r3', refImages: ['jim_shin_ya'] }),

  // ---- حافة اللسان ------------------------------------------------------------
  art({ id: 'dad', letters: 'ض', nameAr: 'الضاد', group: 'side', duration: 3200,
    keyframes: fricative({ shape: 'dad', heavy: true, jaw: 0, airflow: 'lateral', top: { highlight: { sides: 1, back: 0.4 } } }),
    ruleId: 's3r4', refImages: ['top_sides', 'heavy'] }),

  // ---- طرف اللسان مع اللثة ------------------------------------------------------
  art({ id: 'lam', letters: 'ل', nameAr: 'اللام', group: 'tip_gum',
    keyframes: fricative({ shape: 'lam', contact: L.ridge, contactKind: 'touch', airflow: 'lateral', top: { highlight: { front_edge: 1 }, lateral: 1 } }),
    ruleId: 's3r5', refImages: ['lam_nun_ra', 'top_front_edge'] }),
  art({ id: 'nun', letters: 'ن', nameAr: 'النون', group: 'tip_gum',
    keyframes: nasal({ shape: 'ghunnah', contact: L.ridge, lips: 'narrow', top: TOP_TIP }),
    ruleId: 's3r5', refImages: ['lam_nun_ra', 'top_tip', 'ghunnah'] }),
  art({ id: 'ra', letters: 'ر', nameAr: 'الراء (رقيقة)', group: 'tip_gum', duration: 2200,
    keyframes: flap(false), ruleId: 's3r5', refImages: ['lam_nun_ra', 'top_tip'] }),
  art({ id: 'ra_heavy', letters: 'رَ', nameAr: 'الراء (غليظة)', group: 'tip_gum', duration: 2200,
    keyframes: flap(true), ruleId: 's5r2', refImages: ['lam_nun_ra', 'heavy'] }),
  art({ id: 'ra_wrong', letters: 'ر', nameAr: 'الراء المكررة (خطأ)', group: 'tip_gum', duration: 2200, wrong: true,
    keyframes: trillWrong(), ruleId: 's3r5', refImages: ['lam_nun_ra'] }),

  // ---- طرف اللسان مع أصول الأسنان ----------------------------------------------
  art({ id: 'ta', letters: 'ت', nameAr: 'التاء', group: 'tip_root',
    keyframes: plosive({ shape: 'ta', contact: L.teethRoot, top: TOP_TIP }),
    ruleId: 's3r6', refImages: ['ta_dal_tta'] }),
  art({ id: 'dal', letters: 'د', nameAr: 'الدال', group: 'tip_root',
    keyframes: plosive({ shape: 'ta', contact: L.teethRoot, top: TOP_TIP }),
    ruleId: 's3r6', refImages: ['ta_dal_tta'] }),
  art({ id: 'tta', letters: 'ط', nameAr: 'الطاء', group: 'tip_root',
    keyframes: plosive({ shape: 'tta', contact: L.teethRoot, heavy: true, releaseShape: 'heavy', top: { highlight: { tip: 1, back: 0.5 } } }),
    ruleId: 's3r6', refImages: ['ta_dal_tta', 'heavy'] }),

  // ---- طرف اللسان قرب الأسنان السفلى ------------------------------------------
  art({ id: 'sin', letters: 'س', nameAr: 'السين', group: 'tip_lower', duration: 3000,
    keyframes: fricative({ shape: 'sin', contact: L.lowerTeeth, contactKind: 'touch', airflow: 'channel', lips: 'narrow', top: { highlight: { tip: 0.7 } } }),
    ruleId: 's3r7', refImages: ['sad_sin_zay'] }),
  art({ id: 'zay', letters: 'ز', nameAr: 'الزاي', group: 'tip_lower', duration: 3000,
    keyframes: fricative({ shape: 'sin', contact: L.lowerTeeth, contactKind: 'touch', airflow: 'channel', lips: 'narrow', top: { highlight: { tip: 0.7 } } }),
    ruleId: 's3r7', refImages: ['sad_sin_zay'] }),
  art({ id: 'sad', letters: 'ص', nameAr: 'الصاد', group: 'tip_lower', duration: 3000,
    keyframes: fricative({ shape: 'sad', contact: L.lowerTeeth, contactKind: 'touch', airflow: 'channel', heavy: true, top: { highlight: { tip: 0.7, back: 0.5 } } }),
    ruleId: 's3r7', refImages: ['sad_sin_zay', 'heavy'] }),

  // ---- طرف اللسان بين الأسنان ---------------------------------------------------
  art({ id: 'tha', letters: 'ث', nameAr: 'الثاء', group: 'tip_between', duration: 3000,
    keyframes: fricative({ shape: 'tha', contact: L.teethEdge, contactKind: 'touch', airflow: 'channel', lips: 'narrow', top: { highlight: { tip: 1 } } }),
    ruleId: 's3r8', refImages: ['tha_dhal_zha'] }),
  art({ id: 'dhal', letters: 'ذ', nameAr: 'الذال', group: 'tip_between', duration: 3000,
    keyframes: fricative({ shape: 'tha', contact: L.teethEdge, contactKind: 'touch', airflow: 'channel', lips: 'narrow', top: { highlight: { tip: 1 } } }),
    ruleId: 's3r8', refImages: ['tha_dhal_zha'] }),
  art({ id: 'zha', letters: 'ظ', nameAr: 'الظاء', group: 'tip_between', duration: 3000,
    keyframes: fricative({ shape: 'zha', contact: L.teethEdge, contactKind: 'touch', airflow: 'channel', lips: 'narrow', heavy: true, top: { highlight: { tip: 1, back: 0.5 } } }),
    ruleId: 's3r8', refImages: ['tha_dhal_zha', 'heavy'] }),

  // ---- الشفتان ------------------------------------------------------------------
  art({ id: 'fa', letters: 'ف', nameAr: 'الفاء', group: 'lips', duration: 3000,
    keyframes: fricative({ shape: 'rest', lips: 'teeth_on_lip', airflow: 'lips_channel' }),
    ruleId: 's3r9', refImages: ['lips_fa'] }),
  art({ id: 'ba', letters: 'ب', nameAr: 'الباء', group: 'lips',
    keyframes: plosive({ shape: 'rest', lips: 'closed' }),
    ruleId: 's3r9', refImages: ['lips_closed'] }),
  art({ id: 'mim', letters: 'م', nameAr: 'الميم', group: 'lips',
    keyframes: nasal({ shape: 'rest', lips: 'closed' }),
    ruleId: 's3r9', refImages: ['lips_closed', 'ghunnah'] }),
  art({ id: 'waw', letters: 'و', nameAr: 'الواو', group: 'lips',
    keyframes: fricative({ shape: 'waw', lips: 'rounded', airflow: 'oral' }),
    ruleId: 's3r9', refImages: ['lips_rounded'],
    needsReview: 'ارتفاع مؤخرة اللسان قليلاً في الواو غير مذكور في المحتوى؛ المذكور هو تدوير الشفتين.' }),

  // ---- الخيشوم: الغنة -------------------------------------------------------------
  art({ id: 'ghunnah_nun', letters: 'نّ', nameAr: 'الغنة (نون مشددة)', group: 'khayshum', duration: 3400, harakat: 2, tickerLabel: 'غنة',
    keyframes: nasal({ shape: 'ghunnah', contact: L.ridge, lips: 'narrow', top: TOP_TIP }),
    ruleId: 's3r10', refImages: ['ghunnah', 'lam_nun_ra'] }),
  art({ id: 'ghunnah_mim', letters: 'مّ', nameAr: 'الغنة (ميم مشددة)', group: 'khayshum', duration: 3400, harakat: 2, tickerLabel: 'غنة',
    keyframes: nasal({ shape: 'rest', lips: 'closed' }),
    ruleId: 's3r10', refImages: ['ghunnah', 'lips_closed'] }),

  // ---- الحركات --------------------------------------------------------------------
  art({ id: 'fatha', letters: 'بَ', nameAr: 'الفتحة', group: 'vowel', harakat: 1, tickerLabel: 'حركة',
    keyframes: vowel({ shape: 'alif_open', lips: 'open', jaw: 1 }),
    ruleId: 's4r1', refImages: ['lips_open'] }),
  art({ id: 'damma', letters: 'بُ', nameAr: 'الضمة', group: 'vowel', harakat: 1, tickerLabel: 'حركة',
    keyframes: vowel({ shape: 'waw', lips: 'rounded', jaw: 0 }),
    ruleId: 's4r1', refImages: ['lips_rounded'] }),
  art({ id: 'kasra', letters: 'بِ', nameAr: 'الكسرة', group: 'vowel', harakat: 1, tickerLabel: 'حركة',
    keyframes: vowel({ shape: 'kasrah', lips: 'narrow', jaw: 0.5 }),
    ruleId: 's4r1', refImages: [] }),
  art({ id: 'alif_plain', letters: 'نَار', nameAr: 'ألف عادية', group: 'vowel', duration: 3200, harakat: 2, tickerLabel: 'مد',
    keyframes: vowel({ shape: 'alif_open', lips: 'open', jaw: 1, airflow: 'jawf' }),
    ruleId: 's4r2', refImages: ['alif_open', 'lips_open'] }),
  art({ id: 'imalah', letters: 'النَّارِ', nameAr: 'ألف ممالة (إمالة)', group: 'vowel', duration: 3200, harakat: 2, tickerLabel: 'مد',
    keyframes: vowel({ shape: 'imalah', lips: 'narrow', jaw: 0.5, airflow: 'jawf', contact: L.imalahRing.c, contactKind: 'near', top: { highlight: { middle: 0.6 } } }),
    ruleId: 's11r1', refImages: ['imalah', 'lips_narrow'] }),

  // ---- التفخيم والترقيق ------------------------------------------------------------
  art({ id: 'heavy', letters: 'خُصَّ ضَغْطٍ قِظْ', nameAr: 'حرف غليظ (مفخم)', group: 'vowel', duration: 3000,
    keyframes: vowel({ shape: 'heavy', lips: 'open', jaw: 1, heavy: true, top: TOP_HEAVY }),
    ruleId: 's5r1', refImages: ['heavy'] }),
  art({ id: 'light', letters: 'رقيق', nameAr: 'حرف رقيق (مرقق)', group: 'vowel', duration: 3000,
    keyframes: vowel({ shape: 'light', lips: 'narrow', jaw: 0 }),
    ruleId: 's5r1', refImages: ['light'] }),
  art({ id: 'lam_allah_heavy', letters: 'هُوَ اللهُ', nameAr: 'لام (الله) غليظة', group: 'vowel', duration: 3000,
    keyframes: fricative({ shape: 'lam_heavy', contact: L.ridge, contactKind: 'touch', airflow: 'lateral', heavy: true, top: { highlight: { front_edge: 1, back: 0.5 }, lateral: 1 } }),
    ruleId: 's5r3', refImages: ['lam_nun_ra', 'heavy'] }),
  art({ id: 'lam_allah_light', letters: 'بِسْمِ اللهِ', nameAr: 'لام (الله) رقيقة', group: 'vowel', duration: 3000,
    keyframes: fricative({ shape: 'lam', contact: L.ridge, contactKind: 'touch', airflow: 'lateral', top: { highlight: { front_edge: 1 }, lateral: 1 } }),
    ruleId: 's5r3', refImages: ['lam_nun_ra', 'light'] }),
];

export const BY_ID: Record<string, Articulation> = Object.fromEntries(ARTICULATIONS.map((a) => [a.id, a]));

export const GROUPS: { id: ArticulationGroup; title: string }[] = [
  { id: 'throat', title: 'الحلق' },
  { id: 'back', title: 'أقصى اللسان' },
  { id: 'middle', title: 'وسط اللسان' },
  { id: 'side', title: 'حافة اللسان' },
  { id: 'tip_gum', title: 'طرف اللسان مع اللثة' },
  { id: 'tip_root', title: 'طرف اللسان مع أصول الأسنان' },
  { id: 'tip_lower', title: 'طرف اللسان قرب الأسنان السفلى' },
  { id: 'tip_between', title: 'طرف اللسان بين الأسنان' },
  { id: 'lips', title: 'الشفتان' },
  { id: 'jawf', title: 'الجوف: حروف المد' },
  { id: 'khayshum', title: 'الخيشوم: الغنة' },
  { id: 'vowel', title: 'الحركات، التفخيم والترقيق، الإمالة' },
];

/** "This, not that" pairs (PROMPT.md §5.3). */
export const CONTRAST_PAIRS: ContrastPair[] = [
  { id: 'sin_sad', title: 'س / ص', a: 'sin', b: 'sad' },
  { id: 'ta_tta', title: 'ت / ط', a: 'ta', b: 'tta' },
  { id: 'dal_dad', title: 'د / ض', a: 'dal', b: 'dad' },
  { id: 'dhal_zha', title: 'ذ / ظ', a: 'dhal', b: 'zha' },
  { id: 'kaf_qaf', title: 'ك / ق', a: 'kaf', b: 'qaf' },
  { id: 'ha_hha', title: 'هـ / ح', a: 'ha', b: 'hha' },
  { id: 'hamza_ain', title: 'ء / ع', a: 'hamza', b: 'ain' },
  { id: 'zay_zha', title: 'ز / ظ', a: 'zay', b: 'zha' },
  { id: 'jim_shin', title: 'ج / ش', a: 'jim', b: 'shin' },
  { id: 'ra_light_heavy', title: 'ر رقيقة / غليظة', a: 'ra', b: 'ra_heavy' },
  { id: 'ra_flap_trill', title: 'ر واحدة / مكررة ✗', a: 'ra', b: 'ra_wrong' },
  { id: 'lam_allah', title: 'لام الله رقيقة / غليظة', a: 'lam_allah_light', b: 'lam_allah_heavy' },
  { id: 'alif_imalah', title: 'ألف عادية / ممالة', a: 'alif_plain', b: 'imalah', note: 'مقدم اللسان مرتفع والفم أضيق' },
  { id: 'heavy_light', title: 'غليظ / رقيق', a: 'light', b: 'heavy' },
];
