import { describe, expect, it } from 'vitest';
import { RULES, SECTIONS } from './lessons';
import { TERMS, linkTerms } from './terms';

describe('lessons.json', () => {
  it('has the 14 sections in order with verified examples', () => {
    expect(SECTIONS).toHaveLength(14);
    expect(SECTIONS[0].title.startsWith('١.')).toBe(true);
    expect(SECTIONS[13].title.startsWith('١٤.')).toBe(true);
    let n = 0;
    for (const s of SECTIONS) for (const r of s.rules) for (const ex of r.examples) {
      n++;
      expect(ex.hit.length, `${r.id} ${ex.targets.join(' ')}`).toBeGreaterThan(0);
      for (const i of ex.hit) expect(ex.words[i], r.id).toBeTruthy();
    }
    expect(n).toBe(128);
  });
});

describe('dictionary terms', () => {
  it('every dictionary entry has stems', () => {
    expect(TERMS.length).toBe(14);
    for (const t of TERMS) expect(t.stems.length, t.name).toBeGreaterThan(0);
  });

  it('links the first use of a term only once, keeping the text intact', () => {
    const text = RULES.s6r2.text; // the idghām rule uses several dictionary terms
    const parts = linkTerms(text);
    expect(parts.map((p) => p.text).join('')).toBe(text);
    const linked = parts.filter((p) => p.termRuleId);
    expect(linked.length).toBeGreaterThanOrEqual(2);
    const ids = linked.map((p) => p.termRuleId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('s2r6'); // الغنة
  });

  it('does not link the entry to itself', () => {
    const parts = linkTerms(RULES.s2r8.text, 's2r8');
    expect(parts.some((p) => p.termRuleId === 's2r8')).toBe(false);
  });

  it('matches stems with the article and prefixes', () => {
    const parts = linkTerms('هذا مثال بالإدغام ثم بغنة واضحة.');
    expect(parts.find((p) => p.termRuleId === 's2r8')?.text).toBe('بالإدغام');
    expect(parts.find((p) => p.termRuleId === 's2r6')?.text).toBe('بغنة');
  });
});
