import { describe, expect, it } from 'vitest';
import { QUARTERS, TOTAL_QUARTERS, completedQuarters, khatmDate, orderIndex, segmentsOf, todayPortion, wirdStreak, type WirdState } from './wird';
import { mergeProgress } from '../../server/merge.mjs';

const base: WirdState = { pace: 'quarter', ramadan: false, reminder: null, pos: null, posQ: 0, khatms: 0, days: {} };

describe('the wird on the muṣḥaf divisions', () => {
  it('has 240 non-empty quarters in muṣḥaf order, 8 per juzʾ, ending with an-Nās', () => {
    expect(QUARTERS).toHaveLength(TOTAL_QUARTERS);
    for (let i = 0; i < QUARTERS.length; i++) {
      const q = QUARTERS[i];
      expect(q.segments.length, `quarter ${q.q}`).toBeGreaterThan(0);
      expect(q.juz).toBe(Math.ceil((i + 1) / 8));
      if (i > 0) expect(orderIndex(q.first)).toBe(orderIndex(QUARTERS[i - 1].last) + 1);
    }
    expect(QUARTERS[0].first).toEqual({ surah: 1, basri: 1 });
    expect(QUARTERS[239].last.surah).toBe(114);
  });

  it('counts completed quarters from the last verse read and builds the day from there', () => {
    expect(completedQuarters(null)).toBe(0);
    expect(completedQuarters(QUARTERS[0].last)).toBe(1);
    expect(completedQuarters(QUARTERS[4].first)).toBe(4);
    const w = { ...base, pos: QUARTERS[2].last, posQ: 3, pace: 'hizb' as const };
    const p = todayPortion(w, new Date('2026-09-10T10:00:00'));
    expect(p.quarters).toEqual([4, 5, 6, 7]);
    expect(p.done).toBe(0);
    expect(p.complete).toBe(false);
    expect(segmentsOf([1]).map((s) => s.surah)).toEqual([1, 2]);
  });

  it('forgives one missed day and ends the streak on two', () => {
    const d = () => ({ start: 0, done: 1 });
    const w = { ...base, days: { '2026-09-09': d(), '2026-09-07': d(), '2026-09-06': d(), '2026-09-03': d() } };
    expect(wirdStreak(w, new Date('2026-09-10T12:00:00'))).toBe(3); // 9, (8 missed), 7, 6; 5 and 4 missed → stop
  });

  it('projects the khatm date from the pace', () => {
    const w = { ...base, pace: 'juz' as const, posQ: 232 };
    const t = new Date('2026-09-10T12:00:00');
    expect(khatmDate(w, t).getDate()).toBe(10); // one juzʾ left, today still open
    const w2 = { ...base, pace: 'quarter' as const, posQ: 0 };
    expect(Math.round((khatmDate(w2, t).getTime() - t.getTime()) / 86400000)).toBe(239);
  });

  it("merges by the furthest reader and keeps each day's best log", () => {
    type Days = Record<string, { start: number; done: number }>;
    const a = { done: {}, days: {}, updatedAt: 1, wird: { ...base, pos: QUARTERS[9].last, posQ: 10, days: { '2026-09-10': { start: 8, done: 10 } } as Days, updatedAt: 1 } };
    const b = { done: {}, days: {}, updatedAt: 2, wird: { ...base, pace: 'hizb' as const, pos: QUARTERS[7].last, posQ: 8, days: { '2026-09-10': { start: 8, done: 8 }, '2026-09-09': { start: 6, done: 8 } } as Days, updatedAt: 2 } };
    const m = mergeProgress(a, b) as typeof a & { wird: { pace: string; days: Days; posQ: number } };
    expect(m.wird.posQ).toBe(10);
    expect(m.wird.pace).toBe('hizb'); // settings follow the latest change
    expect(m.wird.days['2026-09-10'].done).toBe(10);
    expect(m.wird.days['2026-09-09'].done).toBe(8);
  });
});
