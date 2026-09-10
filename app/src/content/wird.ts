// The daily wird (Mohammed, Sept 2026): a reading habit tracker on the muṣḥaf's own divisions.
// The portion is "the next N ḥizb-quarters from where you are", never tied to the calendar; reading
// or listening along both count; the app takes the learner's word. Streaks forgive a single missed
// day. State lives in the progress store and syncs between devices.

import { SURAHS } from '../audio/quran';
import { readProgress, type Progress } from './progress';
import { changed } from '../ui/bus';

export type Pace = 'quarter' | 'half' | 'hizb' | 'juz';
export const PACE_QUARTERS: Record<Pace, number> = { quarter: 1, half: 2, hizb: 4, juz: 8 };
export const PACE_LABEL: Record<Pace, string> = { quarter: 'ربع حزب', half: 'نصف حزب', hizb: 'حزب', juz: 'جزء' };
export const TOTAL_QUARTERS = 240;

export interface Ref {
  surah: number;
  basri: number;
}
export interface Quarter {
  q: number;
  juz: number;
  hizb: number;
  /** 1–4 inside the ḥizb. */
  part: number;
  first: Ref;
  last: Ref;
  /** Verses grouped by sūrah, in muṣḥaf order. */
  segments: { surah: number; surahName: string; from: number; to: number }[];
}
export interface DayLog {
  /** Quarters completed when the day's first reading happened. */
  start: number;
  /** Quarters completed now. */
  done: number;
}
export interface WirdState {
  pace: Pace;
  ramadan: boolean;
  /** "HH:MM" local, or null. */
  reminder: string | null;
  /** Last verse read in this khatm (muṣḥaf order), or null at the start. */
  pos: Ref | null;
  /** Quarters completed in this khatm, kept beside pos for merging. */
  posQ: number;
  khatms: number;
  days: Record<string, DayLog>;
  updatedAt?: number;
}

export const DEFAULT_WIRD: WirdState = { pace: 'quarter', ramadan: false, reminder: null, pos: null, posQ: 0, khatms: 0, days: {} };

// ---- muṣḥaf order and quarters ------------------------------------------------------------------
const ORDER: Ref[] = [];
const INDEX = new Map<string, number>();
const QMAP = new Map<number, Ref[]>();
for (const s of SURAHS) {
  for (const v of s.verses) {
    const ref = { surah: s.number, basri: v.basri };
    INDEX.set(`${s.number}:${v.basri}`, ORDER.length);
    ORDER.push(ref);
    if (v.q) {
      if (!QMAP.has(v.q)) QMAP.set(v.q, []);
      QMAP.get(v.q)!.push(ref);
    }
  }
}
const NAME = Object.fromEntries(SURAHS.map((s) => [s.number, s.name])) as Record<number, string>;

export const QUARTERS: Quarter[] = Array.from({ length: TOTAL_QUARTERS }, (_, i) => {
  const q = i + 1;
  const refs = QMAP.get(q) ?? [];
  const segments: Quarter['segments'] = [];
  for (const r of refs) {
    const seg = segments[segments.length - 1];
    if (seg && seg.surah === r.surah) seg.to = r.basri;
    else segments.push({ surah: r.surah, surahName: NAME[r.surah], from: r.basri, to: r.basri });
  }
  return { q, juz: Math.ceil(q / 8), hizb: Math.ceil(q / 4), part: ((q - 1) % 4) + 1, first: refs[0], last: refs[refs.length - 1], segments };
});

export function orderIndex(ref: Ref): number {
  return INDEX.get(`${ref.surah}:${ref.basri}`) ?? -1;
}

/** Quarters whose last verse is at or before `pos` (0 when nothing read). */
export function completedQuarters(pos: Ref | null): number {
  if (!pos) return 0;
  const i = orderIndex(pos);
  let n = 0;
  for (const qt of QUARTERS) {
    if (orderIndex(qt.last) <= i) n++;
    else break;
  }
  return n;
}

/** Verses of a run of quarters, grouped by sūrah. */
export function segmentsOf(quarters: number[]): Quarter['segments'] {
  const out: Quarter['segments'] = [];
  for (const q of quarters) {
    for (const seg of QUARTERS[q - 1]?.segments ?? []) {
      const last = out[out.length - 1];
      if (last && last.surah === seg.surah && last.to + 1 === seg.from) last.to = seg.to;
      else out.push({ ...seg });
    }
  }
  return out;
}

export function dayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---- state -------------------------------------------------------------------------------------
type P = Progress & { wird?: WirdState };

export function wirdState(p: Progress = readProgress()): WirdState {
  return { ...DEFAULT_WIRD, ...((p as P).wird ?? {}) };
}

function write(w: WirdState) {
  const p = readProgress() as P;
  p.wird = { ...w, updatedAt: Date.now() };
  try {
    localStorage.setItem('nutq.progress.v1', JSON.stringify(p));
  } catch {
    /* ignore */
  }
  changed();
  window.dispatchEvent(new Event('nutq:progress'));
}

export function paceQuarters(w: WirdState): number {
  return w.ramadan ? PACE_QUARTERS.juz : PACE_QUARTERS[w.pace];
}

/** Today's portion: the next `pace` quarters after where the day started. */
export function todayPortion(w: WirdState, today = new Date()) {
  const key = dayKey(today);
  const start = w.days[key]?.start ?? w.posQ;
  const n = paceQuarters(w);
  const quarters = Array.from({ length: Math.min(n, TOTAL_QUARTERS - start) }, (_, i) => start + 1 + i);
  const done = Math.max(0, Math.min(quarters.length, w.posQ - start));
  const first = quarters.length ? QUARTERS[quarters[0] - 1] : null;
  const last = quarters.length ? QUARTERS[quarters[quarters.length - 1] - 1] : null;
  const segments = segmentsOf(quarters);
  const ar = (n: number) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
  const title = !first || !last ? 'ختمت المصحف' : first.q === last.q ? `الحزب ${ar(first.hizb)}، الربع ${ar(first.part)}` : first.juz === last.juz && quarters.length === 8 ? `الجزء ${ar(first.juz)}` : first.hizb === last.hizb && first.part === 1 && last.part === 4 ? `الحزب ${ar(first.hizb)}` : `من الحزب ${ar(first.hizb)} (الربع ${ar(first.part)}) إلى الحزب ${ar(last.hizb)} (الربع ${ar(last.part)})`;
  return { key, start, quarters, done, target: quarters.length, complete: quarters.length > 0 && done >= quarters.length, segments, title, first, last };
}

/** Is a verse inside today's portion and not yet read? */
export function inPortionAhead(w: WirdState, ref: Ref, today = new Date()): boolean {
  const p = todayPortion(w, today);
  if (!p.first || !p.last) return false;
  const i = orderIndex(ref);
  if (i < 0) return false;
  const lo = orderIndex(p.first.first);
  const hi = orderIndex(p.last.last);
  const cur = w.pos ? orderIndex(w.pos) : -1;
  return i >= lo && i <= hi && i > cur;
}

export interface ReadEvents {
  advanced: boolean;
  dayCompleted: boolean;
  juzCompleted: number | null;
  khatm: boolean;
}

/** The learner reached `ref` (read it, or listened along to it). Advances the wird if it is further. */
export function markRead(ref: Ref, today = new Date()): ReadEvents {
  const w = wirdState();
  const ev: ReadEvents = { advanced: false, dayCompleted: false, juzCompleted: null, khatm: false };
  const i = orderIndex(ref);
  if (i < 0 || (w.pos && orderIndex(w.pos) >= i)) return ev;
  const key = dayKey(today);
  const before = todayPortion(w, today);
  const wasComplete = before.complete;
  const prevQ = w.posQ;
  w.pos = ref;
  w.posQ = completedQuarters(ref);
  w.days[key] = { start: w.days[key]?.start ?? prevQ, done: w.posQ };
  ev.advanced = true;
  if (Math.floor(w.posQ / 8) > Math.floor(prevQ / 8) && w.posQ < TOTAL_QUARTERS) ev.juzCompleted = Math.floor(w.posQ / 8);
  const after = todayPortion(w, today);
  if (after.complete && !wasComplete) ev.dayCompleted = true;
  if (w.posQ >= TOTAL_QUARTERS) {
    ev.khatm = true;
    ev.dayCompleted = true;
    w.khatms += 1;
    w.pos = null;
    w.posQ = 0;
    w.days[key] = { start: w.days[key].start, done: TOTAL_QUARTERS };
  }
  const keys = Object.keys(w.days).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - 400))) delete w.days[k];
  write(w);
  return ev;
}

/** "أتممت الورد": jump to the end of today's portion. */
export function completePortion(today = new Date()): ReadEvents {
  const p = todayPortion(wirdState(), today);
  if (!p.last) return { advanced: false, dayCompleted: false, juzCompleted: null, khatm: false };
  return markRead(p.last.last, today);
}

export function updateWird(patch: Partial<Pick<WirdState, 'pace' | 'ramadan' | 'reminder'>>) {
  write({ ...wirdState(), ...patch });
}

/** Start the khatm over from the beginning (keeps the count of completed khatms and the history). */
export function restartWird() {
  const w = wirdState();
  write({ ...w, pos: null, posQ: 0 });
}

const DAY = 24 * 3600 * 1000;

/** Days in a row with the portion done, allowing one missed day at a time (two in a row end it). */
export function wirdStreak(w: WirdState, today = new Date()): number {
  const n = paceQuarters(w);
  const doneOn = (d: Date) => {
    const log = w.days[dayKey(d)];
    return !!log && log.done - log.start >= Math.min(n, TOTAL_QUARTERS - log.start) && log.done > log.start;
  };
  let streak = 0;
  let misses = 0;
  const d = new Date(today);
  if (!doneOn(d)) d.setTime(d.getTime() - DAY); // today still open
  for (let guard = 0; guard < 2000; guard++) {
    if (doneOn(d)) {
      streak++;
      misses = 0;
    } else {
      misses++;
      if (misses >= 2) break;
    }
    d.setTime(d.getTime() - DAY);
  }
  return streak;
}

/** The last seven days, oldest first: quarters read and whether the portion was done. */
export function wirdWeek(w: WirdState, today = new Date()) {
  const n = paceQuarters(w);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today.getTime() - (6 - i) * DAY);
    const log = w.days[dayKey(d)];
    const read = log ? log.done - log.start : 0;
    return { key: dayKey(d), read, done: !!log && read >= Math.min(n, TOTAL_QUARTERS - log.start) && read > 0, today: i === 6 };
  });
}

/** When the khatm lands at the current pace, counting today if its portion is not done yet. */
export function khatmDate(w: WirdState, today = new Date()): Date {
  const remaining = TOTAL_QUARTERS - w.posQ;
  const p = todayPortion(w, today);
  const days = Math.max(0, Math.ceil(remaining / paceQuarters(w)) - (p.complete ? 0 : 1));
  return new Date(today.getTime() + days * DAY);
}
