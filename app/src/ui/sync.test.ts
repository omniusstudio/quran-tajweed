import { describe, expect, it } from 'vitest';
import { mergeDeck, mergeProgress, mergeState, newer } from '../../server/merge.mjs';

describe('state merge between devices', () => {
  it('unions done steps, keeps the higher daily counts and the latest "last"', () => {
    type Day = { lessons: number; answers: number; correct: number; drills: number };
    type P = { done: Record<string, true>; days: Record<string, Day>; last: string; updatedAt: number };
    const mac: P = { done: { a: true, b: true }, days: { '2026-09-09': { lessons: 2, answers: 3, correct: 2, drills: 0 } }, last: 'b', updatedAt: 10 };
    const phone: P = { done: { c: true }, days: { '2026-09-09': { lessons: 1, answers: 6, correct: 5, drills: 1 }, '2026-09-08': { lessons: 1, answers: 0, correct: 0, drills: 0 } }, last: 'c', updatedAt: 20 };
    const m = mergeProgress(mac, phone) as P;
    expect(Object.keys(m.done).sort()).toEqual(['a', 'b', 'c']);
    expect(m.days['2026-09-09']).toEqual({ lessons: 2, answers: 6, correct: 5, drills: 1 });
    expect(m.days['2026-09-08'].lessons).toBe(1);
    expect(m.last).toBe('c');
    expect(m.updatedAt).toBe(20);
  });

  it('keeps the card that has been answered more', () => {
    const a = { x: { box: 1, due: 5, seen: 1, wrong: 0 }, y: { box: 0, due: 9, seen: 2, wrong: 1 } };
    const b = { x: { box: 2, due: 8, seen: 2, wrong: 0 }, z: { box: 0, due: 1, seen: 1, wrong: 0 } };
    const m = mergeDeck(a, b) as typeof a & typeof b;
    expect(m.x.seen).toBe(2);
    expect(m.y.seen).toBe(2);
    expect(m.z.seen).toBe(1);
  });

  it('settings and alignments follow the latest change; a missing side is not a loss', () => {
    expect(newer({ theme: 'light', updatedAt: 1 }, { theme: 'dark', updatedAt: 2 })?.theme).toBe('dark');
    expect(newer({ theme: 'light', updatedAt: 3 }, { theme: 'dark', updatedAt: 2 })?.theme).toBe('light');
    const only = mergeState(null, { v: 1, progress: null, deck: {}, settings: null, alignments: {} });
    expect(only?.v).toBe(1);
    expect(mergeState(null, null)).toBeNull();
  });
});
