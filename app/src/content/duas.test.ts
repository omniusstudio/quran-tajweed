import { describe, expect, it } from 'vitest';
import { DUAS, duaMatches, duaOfDay, resolveDua } from './duas';

describe('daily supplications', () => {
  it('every reference resolves to muṣḥaf verses that contain its key word', () => {
    const bad: string[] = [];
    for (const ref of DUAS) {
      const d = resolveDua(ref);
      if (!d) bad.push(`${ref.surah}:${ref.from} (no verses)`);
      else if (!duaMatches(d)) bad.push(`${ref.surah}:${ref.from}-${ref.to} → ${d.text.slice(0, 40)}`);
    }
    expect(bad).toEqual([]);
  });

  it('changes daily and never repeats within a cycle', () => {
    const seen = new Set<string>();
    for (let i = 0; i < DUAS.length; i++) {
      const d = duaOfDay(new Date(2026, 8, 1 + i))!;
      seen.add(`${d.ref.surah}:${d.ref.from}`);
    }
    expect(seen.size).toBe(DUAS.length);
  });
});
