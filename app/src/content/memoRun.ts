// A repeat session: one stretch of verses (a verse, a page or a whole sūrah) heard N times, with an
// optional silent gap after each hearing to say it back, and an optional veil that hides more of the
// text as the count climbs, so the last repetitions are from memory.

import { SURAH_BY_NUMBER } from '../audio/quran';
import { playSpan, startTime, type SurahAlign } from '../audio/alignment';
import { vkey } from './memo';

export type Scope = 'verse' | 'page' | 'surah' | 'range';
export type GapMode = 'none' | 'short' | 'recite';

export interface MemoPlan {
  surah: number;
  /** Baṣrī numbers of the first and last verse. */
  from: number;
  to: number;
  scope: Scope;
  /** How many hearings in all. */
  target: number;
  gap: GapMode;
  /** Hide more of the text as the count climbs. */
  veil: boolean;
  /** A recall of something already memorized, not new learning. */
  review?: boolean;
}
export interface MemoRun { plan: MemoPlan; done: number; at: number; completed?: boolean }

export const PRESETS = [10, 33, 100];
export const MAX_TARGET = 1000;

export function planKeys(plan: MemoPlan): string[] {
  const s = SURAH_BY_NUMBER[plan.surah];
  return s ? s.verses.filter((v) => v.basri >= plan.from && v.basri <= plan.to).map((v) => vkey(plan.surah, v.basri)) : [];
}

export function inPlan(plan: MemoPlan, surah: number, basri: number): boolean {
  return surah === plan.surah && basri >= plan.from && basri <= plan.to;
}

/** The recording's seconds for one hearing: from the first verse (with the basmalah only when the whole sūrah is repeated) to the last verse's end. */
export function planRange(plan: MemoPlan, a: SurahAlign): [number, number] | null {
  const first = a.verses.find((v) => v.basri === plan.from);
  const last = a.verses.find((v) => v.basri === plan.to);
  if (!first || !last) return null;
  const start = plan.scope === 'surah' ? startTime(a, first) : playSpan(first)[0];
  const end = playSpan(last)[1];
  return end > start ? [start, end] : null;
}

export function gapMs(mode: GapMode, passSeconds: number): number {
  if (mode === 'short') return 2000;
  if (mode === 'recite') return Math.min(30000, Math.max(2000, Math.round(passSeconds * 1100)));
  return 0;
}

/** Seconds for the whole session if run from the start. */
export function estimateSeconds(plan: MemoPlan, a: SurahAlign): number | null {
  const r = planRange(plan, a);
  if (!r) return null;
  const pass = r[1] - r[0];
  return plan.target * pass + Math.max(0, plan.target - 1) * (gapMs(plan.gap, pass) / 1000);
}

/** The share of words hidden: none in the first quarter of the count, then a third, two thirds, and all. */
export function veilFraction(done: number, target: number): number {
  const f = target > 0 ? done / target : 0;
  return f < 0.25 ? 0 : f < 0.5 ? 1 / 3 : f < 0.75 ? 2 / 3 : 1;
}

export const STAGE_LABEL = (fraction: number) => (fraction === 0 ? 'النص كاملًا' : fraction < 0.5 ? 'ثلث الكلمات مخفي' : fraction < 1 ? 'ثلثا الكلمات مخفيان' : 'من الحفظ');

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  // FNV-1a alone moves only the low bits when the last character changes, so neighbouring words
  // would hash alike; a final avalanche spreads them (murmur3's finalizer)
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
/** Whether a word is hidden at a given veil fraction. The set only grows as the fraction does. */
export function isVeiled(surah: number, basri: number, word: number, fraction: number): boolean {
  if (fraction <= 0) return false;
  if (fraction >= 1) return true;
  return hash(`${surah}:${basri}:${word}`) < fraction;
}

const RUN_KEY = 'nutq.memo.run';
export function loadRun(): MemoRun | null {
  try {
    const r = JSON.parse(localStorage.getItem(RUN_KEY) || 'null') as MemoRun | null;
    return r && r.plan && SURAH_BY_NUMBER[r.plan.surah] ? r : null;
  } catch {
    return null;
  }
}
export function saveRun(r: MemoRun | null) {
  try {
    if (r) localStorage.setItem(RUN_KEY, JSON.stringify(r));
    else localStorage.removeItem(RUN_KEY);
  } catch { /* ignore */ }
}

/** A start handed from another page (review, continue): the sheet opens with it. */
const INTENT_KEY = 'nutq.memo.intent';
export function setIntent(i: Partial<MemoPlan> & { surah: number; from: number; to: number }) {
  try { localStorage.setItem(INTENT_KEY, JSON.stringify(i)); } catch { /* ignore */ }
}
export function takeIntent(): (Partial<MemoPlan> & { surah: number; from: number; to: number }) | null {
  try {
    const raw = localStorage.getItem(INTENT_KEY);
    if (!raw) return null;
    localStorage.removeItem(INTENT_KEY);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
