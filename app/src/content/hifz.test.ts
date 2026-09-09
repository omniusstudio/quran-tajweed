import { describe, expect, it } from 'vitest';
import { REVIEW_DAYS, VERSES_PER_DAY, challenges } from './hifz';
import { mergeProgress } from '../../server/merge.mjs';

describe('memorization path', () => {
  const all = challenges();
  it('starts with al-Fātiḥah, then an-Nās backwards, five whole verses at a time, never across sūrahs', () => {
    expect(all[0]).toMatchObject({ surah: 1, verses: [1, 2, 3, 4, 5], opensSurah: true });
    expect(all[1]).toMatchObject({ surah: 1, verses: [6, 7], opensSurah: false });
    expect(all[2]).toMatchObject({ surah: 114, verses: [1, 2, 3, 4, 5] });
    expect(all[3]).toMatchObject({ surah: 114, verses: [6] });
    expect(all[4].surah).toBe(113);
    for (const c of all) {
      expect(c.verses.length).toBeGreaterThan(0);
      expect(c.verses.length).toBeLessThanOrEqual(VERSES_PER_DAY);
      for (let i = 1; i < c.verses.length; i++) expect(c.verses[i]).toBe(c.verses[i - 1] + 1);
    }
    expect(all[all.length - 1].surah).toBe(2);
    expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
  });

  it('covers every verse of the muṣḥaf exactly once', () => {
    const n = all.reduce((s, c) => s + c.verses.length, 0);
    expect(n).toBe(6218);
  });

  it('review spacing grows and merges by recalls between devices', () => {
    expect(REVIEW_DAYS[0]).toBe(1);
    expect(REVIEW_DAYS).toEqual([...REVIEW_DAYS].sort((a, b) => a - b));
    const a = { done: {}, days: {}, updatedAt: 1, hifz: { done: { '1:1': { at: 1, reviews: 1, due: 5 } }, updatedAt: 1 } };
    const b = { done: {}, days: {}, updatedAt: 2, hifz: { done: { '1:1': { at: 1, reviews: 2, due: 9 }, '114:1': { at: 2, reviews: 0, due: 3 } }, updatedAt: 2 } };
    const m = mergeProgress(a, b) as typeof b;
    expect(m.hifz.done['1:1'].reviews).toBe(2);
    expect(m.hifz.done['114:1']).toBeDefined();
  });
});
