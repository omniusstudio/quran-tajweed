import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mergeProgress } from '../../server/merge.mjs';
import type { SurahAlign } from '../audio/alignment';
import { addPass, dueRuns, inProgressRuns, markDone, memoState, memorizedSet, repsByDay, reviewResult, runsOf, surahTallies, totals, unmarkDone, vkey } from './memo';
import { estimateSeconds, gapMs, inPlan, isVeiled, planKeys, planRange, veilFraction, type MemoPlan } from './memoRun';
import { readProgress } from './progress';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
});

const DAY = 24 * 3600 * 1000;
const plan = (over: Partial<MemoPlan> = {}): MemoPlan => ({ surah: 112, from: 1, to: 4, scope: 'surah', target: 100, gap: 'none', veil: true, ...over });

describe('repeat ledger', () => {
  it('counts a pass for every verse it covered, and per day', () => {
    const t = Date.UTC(2026, 9, 14, 12);
    addPass([vkey(112, 1), vkey(112, 2)], t);
    addPass([vkey(112, 1)], t);
    const m = memoState(readProgress());
    expect(m.verses['112:1'].reps).toBe(2);
    expect(m.verses['112:2'].reps).toBe(1);
    expect(Object.values(m.days).reduce((a, b) => a + b, 0)).toBe(2);
    expect(repsByDay(readProgress(), 3, new Date(t)).at(-1)?.reps).toBe(2);
  });

  it('memorized verses come back for recall on the ladder, and a miss brings them back tomorrow', () => {
    const t = Date.UTC(2026, 9, 14);
    addPass([vkey(112, 1)], t);
    markDone([vkey(112, 1)], t);
    expect(memoState().verses['112:1']).toMatchObject({ done: true, reviews: 0, due: t + DAY });
    expect(dueRuns(readProgress(), t)).toEqual([]);
    expect(dueRuns(readProgress(), t + DAY).map((r) => [r.surah, r.from, r.to])).toEqual([[112, 1, 1]]);
    reviewResult([vkey(112, 1)], true, t + DAY);
    expect(memoState().verses['112:1']).toMatchObject({ reviews: 1, due: t + DAY + 3 * DAY });
    reviewResult([vkey(112, 1)], false, t + 5 * DAY);
    expect(memoState().verses['112:1']).toMatchObject({ reviews: 0, due: t + 6 * DAY });
  });

  it('shows memorized, in-progress and totals, and lets a mistaken tick be undone', () => {
    addPass([vkey(112, 1), vkey(112, 2), vkey(112, 3)]);
    markDone([vkey(112, 1), vkey(112, 2)]);
    expect([...memorizedSet()].sort()).toEqual(['112:1', '112:2']);
    expect(inProgressRuns().map((r) => [r.surah, r.from, r.to, r.reps])).toEqual([[112, 3, 3, 1]]);
    const s = surahTallies().find((x) => x.number === 112)!;
    expect(s).toMatchObject({ total: 4, done: 2, doing: 1 });
    expect(totals().done).toBe(2);
    unmarkDone([vkey(112, 2)]);
    expect([...memorizedSet()]).toEqual(['112:1']);
  });

  it('cuts verses into runs of consecutive verses per sūrah', () => {
    expect(runsOf(['2:5', '2:3', '2:4', '2:9', '3:1']).map((r) => [r.surah, r.from, r.to])).toEqual([[2, 3, 5], [2, 9, 9], [3, 1, 1]]);
  });

  it('merges two devices: repetitions only grow, the memorized flag follows its latest change', () => {
    const a = { done: {}, days: {}, updatedAt: 1, memo: { verses: { '1:1': { reps: 40, last: 5, done: true, mAt: 10, reviews: 1, due: 99 }, '1:2': { reps: 3, last: 1 } }, days: { d1: 5 }, updatedAt: 1 } };
    const b = { done: {}, days: {}, updatedAt: 2, memo: { verses: { '1:1': { reps: 55, last: 9, done: false, mAt: 20 }, '1:3': { reps: 1, last: 2 } }, days: { d1: 3, d2: 7 }, updatedAt: 2 } };
    const m = (mergeProgress(a, b) as { memo: typeof a.memo }).memo;
    expect(m.verses['1:1']).toMatchObject({ reps: 55, last: 9, done: false, mAt: 20 });
    expect(Object.keys(m.verses).sort()).toEqual(['1:1', '1:2', '1:3']);
    expect(m.days).toEqual({ d1: 5, d2: 7 });
    expect(mergeProgress({ done: {}, days: {} }, { done: {}, days: {} })).not.toHaveProperty('memo');
  });
});

describe('repeat session plan', () => {
  it('lists the verses of the range and tells whether a verse belongs to it', () => {
    expect(planKeys(plan({ from: 2, to: 3 }))).toEqual(['112:2', '112:3']);
    expect(inPlan(plan({ from: 2, to: 3 }), 112, 3)).toBe(true);
    expect(inPlan(plan({ from: 2, to: 3 }), 112, 4)).toBe(false);
    expect(inPlan(plan({ from: 2, to: 3 }), 113, 3)).toBe(false);
  });

  const align: SurahAlign = {
    version: 1, reciter: 'x', surah: 112, header: [0.5, 3],
    verses: [{ basri: 1, start: 4, end: 7, words: [], safe: [3.8, 7.2] }, { basri: 2, start: 7.5, end: 9, words: [], safe: [7.3, 9.1] }],
  } as unknown as SurahAlign;
  it('starts a verse where it is sung, and a whole sūrah at its basmalah', () => {
    expect(planRange(plan({ scope: 'verse', from: 1, to: 2 }), align)).toEqual([3.8, 9.1]);
    expect(planRange(plan({ scope: 'surah', from: 1, to: 2 }), align)).toEqual([0.5, 9.1]);
    expect(planRange(plan({ from: 5, to: 5 }), align)).toBeNull();
  });
  it('estimates the time including the gaps', () => {
    const p = plan({ scope: 'verse', from: 1, to: 1, target: 10, gap: 'short' });
    expect(estimateSeconds(p, align)).toBeCloseTo(10 * 3.4 + 9 * 2, 5);
    expect(gapMs('none', 5)).toBe(0);
    expect(gapMs('recite', 5)).toBe(5500);
    expect(gapMs('recite', 100)).toBe(30000);
  });

  it('veils nothing for the first quarter, then more and more, and a hidden word stays hidden', () => {
    expect([0, 24, 25, 49, 50, 74, 75, 100].map((n) => veilFraction(n, 100))).toEqual([0, 0, 1 / 3, 1 / 3, 2 / 3, 2 / 3, 1, 1]);
    const words = Array.from({ length: 200 }, (_, i) => i);
    const at = (f: number) => new Set(words.filter((w) => isVeiled(2, 255, w, f)));
    const a = at(1 / 3), b = at(2 / 3);
    expect(at(0).size).toBe(0);
    expect(at(1).size).toBe(200);
    expect([...a].every((w) => b.has(w))).toBe(true);
    expect(a.size).toBeGreaterThan(40);
    expect(a.size).toBeLessThan(100);
    expect(b.size).toBeGreaterThan(100);
  });
});
