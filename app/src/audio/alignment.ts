// Word/verse timing for a reciter's sūrah recording (PROMPT.md §6). Aligned by hand in the
// editor; shipped alignments live in src/content/alignments/<reciter>/<NNN>.json and the
// editor's own saves override them in localStorage.

import { changed } from '../ui/bus';

export type Span = [number, number]; // seconds

export interface VerseAlign {
  basri: number;
  start: number;
  end: number;
  /** One span per word of the verse (same order as the muṣḥaf text). */
  words: Span[];
  /** Playback span when the boundaries are estimates: widened to the nearest pause-backed
   *  boundaries, so the whole verse is heard (with a neighbour when needed) rather than cut. */
  safe?: Span;
  /** Per word, where its vowel is held (the longest stretch between two letters, from the
   *  recogniser's letter timings) — the madd counter runs over this; null when nothing is held. */
  hold?: (Span | null)[];
}

export interface SurahAlign {
  version: 1;
  surah: number;
  reciter: string;
  /** Span of the istiʿādhah (or anything else the reciter says before the basmalah); nothing highlights during it. */
  preamble?: Span;
  /** Span of the unnumbered basmalah / header, if the reciter reads it. */
  header?: Span;
  verses: VerseAlign[];
  /** True when boundaries were guessed (silence detection / proportional split) and not yet checked. */
  auto?: boolean;
  /** 'hand' when the words were placed by a person; 'ctc' from speech recognition (scripts/align_ctc.py);
   *  'auto-verses' / 'hafs-dtw' when only verse ends were estimated by script. */
  source?: string;
}

/** Where a verse sounds in the recording, for playback: the safe (widened) span when the file has one. */
export function verseSpan(reciter: string, surah: number, basri: number): Span | null {
  const v = loadAlignment(reciter, surah)?.verses.find((x) => x.basri === basri);
  if (!v || !(v.end > v.start)) return null;
  return v.safe ?? [v.start, v.end];
}

/** Playback span for a verse entry (safe when present). */
export function playSpan(v: VerseAlign): Span {
  return v.safe ?? [v.start, v.end];
}

/** Sources whose word boundaries can be trusted: placed by hand, or read off a speech recogniser's letter timings. */
export const WORD_SOURCES = new Set(['hand', 'ctc']);

/** Where a word sounds: only from alignments with trustworthy words; older script-made word spans are guesses. */
export function wordSpan(reciter: string, surah: number, basri: number, word: number): Span | null {
  const a = loadAlignment(reciter, surah);
  if (!a || (a.source && !WORD_SOURCES.has(a.source))) return null;
  const s = a.verses.find((x) => x.basri === basri)?.words[word];
  return s && s[1] > s[0] ? s : null;
}

const shipped = import.meta.glob('../content/alignments/*/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;

function key(reciter: string, surah: number) {
  return `nutq.align.${reciter}.${surah}`;
}

export function loadAlignment(reciter: string, surah: number): SurahAlign | undefined {
  try {
    const raw = localStorage.getItem(key(reciter, surah));
    if (raw) return JSON.parse(raw) as SurahAlign;
  } catch {
    /* ignore */
  }
  const path = Object.keys(shipped).find((p) => p.endsWith(`/${reciter}/${String(surah).padStart(3, '0')}.json`));
  // Shipped files are in the export format (verses keyed by Baṣrī number); convert them like an import.
  return path ? fromExport(shipped[path]) : undefined;
}

export function saveAlignment(a: SurahAlign) {
  try {
    localStorage.setItem(key(a.reciter, a.surah), JSON.stringify({ ...a, savedAt: Date.now() }));
  } catch {
    /* ignore */
  }
  changed();
}

export function clearLocalAlignment(reciter: string, surah: number) {
  try {
    localStorage.removeItem(key(reciter, surah));
  } catch {
    /* ignore */
  }
}

/** Export format keyed by sūrah / Baṣrī verse / word index, as the brief asks. */
export function toExport(a: SurahAlign) {
  const verses: Record<string, { start: number; end: number; words: Span[]; safe?: Span; hold?: (Span | null)[] }> = {};
  for (const v of a.verses) verses[String(v.basri)] = { start: v.start, end: v.end, words: v.words, ...(v.safe ? { safe: v.safe } : {}), ...(v.hold ? { hold: v.hold } : {}) };
  return { version: 1, reciter: a.reciter, surah: a.surah, preamble: a.preamble, header: a.header, verses, auto: a.auto || undefined };
}

export function fromExport(obj: unknown): SurahAlign {
  const o = obj as { version?: number; reciter: string; surah: number; preamble?: Span; header?: Span; verses: Record<string, { start: number; end: number; words: Span[]; safe?: Span; hold?: (Span | null)[] }>; auto?: boolean };
  if (!o || typeof o.surah !== 'number' || !o.verses) throw new Error('ملف المحاذاة غير صالح');
  const verses = Object.entries(o.verses)
    .map(([k, v]) => ({ basri: Number(k), start: v.start, end: v.end, words: v.words, ...(v.safe ? { safe: v.safe } : {}), ...(v.hold ? { hold: v.hold } : {}) }))
    .sort((x, y) => x.basri - y.basri);
  return { version: 1, reciter: o.reciter, surah: o.surah, preamble: o.preamble, header: o.header, verses, auto: o.auto ? true : undefined, source: (o as { source?: string }).source };
}

/** Which verse / word is sounding at time t. */
export function locate(a: SurahAlign, t: number): { verse: number; word: number } | null {
  for (let i = 0; i < a.verses.length; i++) {
    const v = a.verses[i];
    if (t < v.start || t >= v.end) continue;
    let w = -1;
    for (let j = 0; j < v.words.length; j++) {
      if (t >= v.words[j][0] && t < v.words[j][1]) {
        w = j;
        break;
      }
    }
    if (w < 0) {
      // between words: attribute to the previous word so highlighting does not flicker
      for (let j = v.words.length - 1; j >= 0; j--) if (t >= v.words[j][0]) return { verse: i, word: j };
      return { verse: i, word: 0 };
    }
    return { verse: i, word: w };
  }
  return null;
}

/** Spread a verse's words across its span in proportion to letter count — an editable starting point only. */
export function proportionalWords(words: string[], start: number, end: number): Span[] {
  const weights = words.map((w) => Math.max(1, w.replace(/[ً-ْٓ-ٰٟۖ-ۭ]/g, '').length + 1));
  const total = weights.reduce((a, b) => a + b, 0);
  const out: Span[] = [];
  let t = start;
  for (const w of weights) {
    const d = ((end - start) * w) / total;
    out.push([t, t + d]);
    t += d;
  }
  if (out.length) out[out.length - 1][1] = end;
  return out;
}

/** Build a fresh alignment skeleton for a sūrah with every verse empty. */
export function emptyAlignment(reciter: string, surah: number, verseNumbers: number[], wordCounts: number[]): SurahAlign {
  return {
    version: 1,
    reciter,
    surah,
    verses: verseNumbers.map((basri, i) => ({ basri, start: 0, end: 0, words: Array.from({ length: wordCounts[i] }, () => [0, 0] as Span) })),
    auto: true,
  };
}
