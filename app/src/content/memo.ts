// The repeat-to-memorize ledger (Mohammed, Oct 2026): every pass of a repeat session adds one
// repetition to each verse it covered; the learner is the one who says "حفظتها". The ring on a
// verse's number in the muṣḥaf fills with its repetitions and turns solid once it is memorized.
// Memorized verses come back for recall on the same ladder as the daily challenge (1, 3, 7, 14, 30 days).
// Verses are keyed "surah:basri" like the daily challenge and the ribbon. The challenge's own
// memorized verses count too, so the muṣḥaf shows everything the learner knows.

import { SURAHS, SURAH_BY_NUMBER } from '../audio/quran';
import { challenges, hifzState, REVIEW_DAYS } from './hifz';
import { dayKey, mutateProgress, readProgress, type Progress } from './progress';

/** Repetitions that fill a verse's ring. */
export const RING = 100;
const DAY = 24 * 3600 * 1000;

export type MemoState = NonNullable<Progress['memo']>;
export type MemoVerse = MemoState['verses'][string];

export const vkey = (surah: number, basri: number) => `${surah}:${basri}`;

export function memoState(p: Progress = readProgress()): MemoState {
  const m = p.memo;
  return m ? { verses: m.verses ?? {}, days: m.days ?? {}, updatedAt: m.updatedAt } : { verses: {}, days: {} };
}

function edit(fn: (m: MemoState) => void, now: number) {
  mutateProgress((p) => {
    const m = memoState(p);
    fn(m);
    const days = Object.keys(m.days).sort();
    for (const k of days.slice(0, Math.max(0, days.length - 180))) delete m.days[k];
    m.updatedAt = now;
    p.memo = m;
  });
}

const slot = (m: MemoState, k: string): MemoVerse => m.verses[k] ?? (m.verses[k] = { reps: 0, last: 0 });

/** One pass of a session is over: one more repetition for every verse it covered. */
export function addPass(keys: string[], now = Date.now()) {
  edit((m) => {
    for (const k of keys) { const v = slot(m, k); v.reps += 1; v.last = now; }
    const d = dayKey(new Date(now));
    m.days[d] = (m.days[d] ?? 0) + 1;
  }, now);
}

/** The learner said "حفظتها": the verses are memorized and come back for recall tomorrow. */
export function markDone(keys: string[], now = Date.now()) {
  edit((m) => {
    for (const k of keys) {
      const v = slot(m, k);
      if (v.done) continue;
      v.done = true; v.mAt = now; v.reviews = 0; v.due = now + REVIEW_DAYS[0] * DAY;
    }
  }, now);
}

export function unmarkDone(keys: string[], now = Date.now()) {
  edit((m) => { for (const k of keys) { const v = m.verses[k]; if (v?.done) { v.done = false; v.mAt = now; } } }, now);
}

/** A recall went well: the next one moves further out. A miss brings it back tomorrow. */
export function reviewResult(keys: string[], ok: boolean, now = Date.now()) {
  edit((m) => {
    for (const k of keys) {
      const v = m.verses[k];
      if (!v?.done) continue;
      v.mAt = now;
      if (ok) { v.reviews = (v.reviews ?? 0) + 1; v.due = now + (REVIEW_DAYS[Math.min(v.reviews, REVIEW_DAYS.length - 1)] ?? 30) * DAY; }
      else { v.reviews = 0; v.due = now + DAY; }
    }
  }, now);
}

let hifzById: Map<string, { surah: number; verses: number[] }> | null = null;
/** The verses the daily challenge has memorized. */
export function hifzKeys(p: Progress = readProgress()): string[] {
  if (!hifzById) hifzById = new Map(challenges().map((c) => [c.id, { surah: c.surah, verses: c.verses }]));
  const out: string[] = [];
  for (const id of Object.keys(hifzState(p).done)) { const c = hifzById.get(id); if (c) for (const b of c.verses) out.push(vkey(c.surah, b)); }
  return out;
}

/** Every verse known to be memorized, from either path. */
export function memorizedSet(p: Progress = readProgress()): Set<string> {
  const out = new Set<string>(hifzKeys(p));
  for (const [k, v] of Object.entries(memoState(p).verses)) if (v.done) out.add(k);
  return out;
}

export interface VerseRun { surah: number; from: number; to: number; keys: string[] }

/** Cut verse keys into runs of consecutive verses of one sūrah, in reading order. */
export function runsOf(keys: Iterable<string>): VerseRun[] {
  const byS = new Map<number, number[]>();
  for (const k of keys) { const [s, b] = k.split(':').map(Number); (byS.get(s) ?? byS.set(s, []).get(s)!).push(b); }
  const out: VerseRun[] = [];
  for (const s of [...byS.keys()].sort((a, b) => a - b)) {
    const list = byS.get(s)!.sort((a, b) => a - b);
    let cur: number[] = [];
    for (const b of list) {
      if (cur.length && b !== cur[cur.length - 1] + 1) { out.push({ surah: s, from: cur[0], to: cur[cur.length - 1], keys: cur.map((x) => vkey(s, x)) }); cur = []; }
      cur.push(b);
    }
    if (cur.length) out.push({ surah: s, from: cur[0], to: cur[cur.length - 1], keys: cur.map((x) => vkey(s, x)) });
  }
  return out;
}

/** Memorized verses whose recall is due, as runs. */
export function dueRuns(p: Progress = readProgress(), now = Date.now()): VerseRun[] {
  return runsOf(Object.entries(memoState(p).verses).filter(([, v]) => v.done && (v.due ?? 0) <= now).map(([k]) => k));
}

/** Verses being worked on (repeated, not yet memorized), as runs with their fewest repetitions. */
export function inProgressRuns(p: Progress = readProgress()): (VerseRun & { reps: number })[] {
  const done = memorizedSet(p);
  const m = memoState(p).verses;
  return runsOf(Object.entries(m).filter(([k, v]) => v.reps > 0 && !done.has(k)).map(([k]) => k)).map((r) => ({ ...r, reps: Math.min(...r.keys.map((k) => m[k].reps)) }));
}

export interface SurahTally { number: number; total: number; done: number; doing: number }
export function surahTallies(p: Progress = readProgress()): SurahTally[] {
  const done = memorizedSet(p);
  const m = memoState(p).verses;
  return SURAHS.map((s) => {
    let d = 0, w = 0;
    for (const v of s.verses) { const k = vkey(s.number, v.basri); if (done.has(k)) d++; else if ((m[k]?.reps ?? 0) > 0) w++; }
    return { number: s.number, total: s.verses.length, done: d, doing: w };
  });
}

export function totals(p: Progress = readProgress(), today = new Date()) {
  const t = surahTallies(p);
  const total = t.reduce((n, s) => n + s.total, 0);
  const done = t.reduce((n, s) => n + s.done, 0);
  const days = memoState(p).days;
  return { total, done, doing: t.reduce((n, s) => n + s.doing, 0), todayReps: days[dayKey(today)] ?? 0, percent: total ? (done / total) * 100 : 0 };
}

/** The last `n` days of repetitions, oldest first. */
export function repsByDay(p: Progress = readProgress(), n = 14, today = new Date()): { key: string; reps: number; today: boolean }[] {
  const days = memoState(p).days;
  const out = [];
  for (let i = n - 1; i >= 0; i--) { const d = new Date(today); d.setDate(d.getDate() - i); const key = dayKey(d); out.push({ key, reps: days[key] ?? 0, today: i === 0 }); }
  return out;
}

export function verseCount(surah: number): number {
  return SURAH_BY_NUMBER[surah]?.verses.length ?? 0;
}
