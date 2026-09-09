// The daily memorization challenge (Mohammed, Sept 2026): five whole verses a day, in the order the
// khalwa uses (al-Fātiḥah, then an-Nās backwards), never split across sūrahs. The app plays,
// echoes, records and compares; the learner is the one who says "حفظتها". Earlier challenges come
// back for a short recall after 1, 3 and 7 days, then 14 and 30.

import { SURAHS, type Surah } from '../audio/quran';
import { readProgress, type Progress } from './progress';
import { changed } from '../ui/bus';

export const VERSES_PER_DAY = 5;
export const REVIEW_DAYS = [1, 3, 7, 14, 30];

export interface Challenge {
  id: string;
  /** Position in the path, 1-based. */
  index: number;
  surah: number;
  surahName: string;
  /** Baṣrī numbers of the verses, in order. */
  verses: number[];
  /** True for the first challenge of its sūrah (the basmalah is read with it). */
  opensSurah: boolean;
}

let cache: Challenge[] | null = null;

/** al-Fātiḥah, then sūrah 114 down to 2, cut into runs of five whole verses inside one sūrah. */
export function challenges(): Challenge[] {
  if (cache) return cache;
  const order: Surah[] = [SURAHS[0], ...[...SURAHS].filter((s) => s.number >= 2).sort((a, b) => b.number - a.number)];
  const out: Challenge[] = [];
  for (const s of order) {
    for (let i = 0; i < s.verses.length; i += VERSES_PER_DAY) {
      const run = s.verses.slice(i, i + VERSES_PER_DAY);
      out.push({ id: `${s.number}:${run[0].basri}`, index: out.length + 1, surah: s.number, surahName: s.name, verses: run.map((v) => v.basri), opensSurah: i === 0 });
    }
  }
  cache = out;
  return out;
}

export interface HifzCard {
  /** When it was first marked memorized. */
  at: number;
  /** Successful recalls so far. */
  reviews: number;
  /** Next recall due (ms). */
  due: number;
}
export type HifzState = { done: Record<string, HifzCard>; updatedAt?: number };

export function hifzState(p: Progress = readProgress()): HifzState {
  return (p as Progress & { hifz?: HifzState }).hifz ?? { done: {} };
}

function writeHifz(h: HifzState) {
  const p = readProgress() as Progress & { hifz?: HifzState };
  p.hifz = { ...h, updatedAt: Date.now() };
  try {
    localStorage.setItem('nutq.progress.v1', JSON.stringify(p));
  } catch {
    /* ignore */
  }
  changed();
  window.dispatchEvent(new Event('nutq:progress'));
}

/** The first challenge not yet memorized. */
export function currentChallenge(h: HifzState = hifzState()): Challenge | null {
  return challenges().find((c) => !h.done[c.id]) ?? null;
}

/** Memorized challenges whose recall is due (oldest due first). */
export function dueReviews(h: HifzState = hifzState(), now = Date.now()): Challenge[] {
  const all = challenges();
  return Object.entries(h.done)
    .filter(([, card]) => card.due <= now)
    .sort((a, b) => a[1].due - b[1].due)
    .map(([id]) => all.find((c) => c.id === id)!)
    .filter(Boolean);
}

const DAY = 24 * 3600 * 1000;

export function markMemorized(id: string, now = Date.now()) {
  const h = hifzState();
  if (!h.done[id]) h.done[id] = { at: now, reviews: 0, due: now + REVIEW_DAYS[0] * DAY };
  writeHifz(h);
}

/** A recall went well: push the next one further out. A miss brings it back tomorrow. */
export function recordReview(id: string, ok: boolean, now = Date.now()) {
  const h = hifzState();
  const card = h.done[id];
  if (!card) return;
  if (ok) {
    card.reviews += 1;
    card.due = now + (REVIEW_DAYS[Math.min(card.reviews, REVIEW_DAYS.length - 1)] ?? 30) * DAY;
  } else {
    card.reviews = 0;
    card.due = now + DAY;
  }
  writeHifz(h);
}

export function versesMemorized(h: HifzState = hifzState()): number {
  const all = challenges();
  return Object.keys(h.done).reduce((n, id) => n + (all.find((c) => c.id === id)?.verses.length ?? 0), 0);
}
