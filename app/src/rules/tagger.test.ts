import { describe, expect, it } from 'vitest';
import { RULES as LESSON_RULES } from '../content/lessons';
import { SURAHS } from '../audio/quran';
import { RULES, tagVerse, units, type RuleId } from './tagger';

/**
 * For every lesson rule with examples in sections 6–13, the tagger must find the rule the lesson
 * teaches on a target word. Lessons also cite contrasting examples (النَّاسُ without imālah next
 * to النَّاسِ with it, مُوسَى next to بُشۡرَىٰ), so the requirement is per rule, not per example,
 * and the muṣḥaf's own mark decides the contrasting ones.
 */
const EXPECT: Record<string, RuleId[]> = {
  s6r1: ['izhar'],
  s6r2: ['idgham_ghunnah', 'idgham_no_ghunnah'],
  s6r3: ['iqlab'],
  s6r4: ['ikhfa'],
  s7r1: ['mim_ikhfa'],
  s7r2: ['mim_idgham'],
  s7r3: ['mim_izhar'],
  s8r1: ['ghunnah'],
  s8r2: ['qalqalah'],
  s9r1: ['madd_tabii'],
  s9r2: ['madd_munfasil'],
  s9r3: ['madd_muttasil'],
  s9r4: ['madd_lazim'],
  s9r5: ['madd_arid'],
  s9r6: ['madd_lazim'],
  s10r1: ['tashil'],
  s10r2: ['isqat'],
  s10r3: ['tashil'],
  s10r4: ['hamza_sakin'],
  s10r5: ['iskan'],
  s11r2: ['imalah'],
  s11r3: ['imalah'],
  s11r4: ['imalah'],
  s11r5: ['imalah'],
  s12r1: ['no_sakt'],
  s12r2: ['idgham_duri'],
  s12r3: ['ya_fath'],
  s12r4: ['ya_zaida'],
  s12r5: ['ha_damir', 'madd_silah'],
  s12r6: ['farsh'],
  s13r1: ['waqf_end'],
  s13r2: ['waqf_sign'],
};

describe('rule tagger against the lesson examples (PROMPT.md §7.4)', () => {
  for (const [ruleId, expected] of Object.entries(EXPECT)) {
    const rule = LESSON_RULES[ruleId];
    it(`${ruleId} ${rule.name}: a target word is tagged ${expected.join(' / ')}`, () => {
      expect(rule.examples.length, 'has examples').toBeGreaterThan(0);
      const report: string[] = [];
      let matched = 0;
      for (const ex of rule.examples) {
        const tags = tagVerse({ words: ex.words, hafs: ex.hafs, nextWord: ex.nextWord });
        const onTargets = tags.filter((t) => ex.hit.includes(t.word) && expected.includes(t.rule));
        if (onTargets.length) matched++;
        report.push(`${ex.surahName} ${ex.basri} [${tags.filter((t) => ex.hit.includes(t.word)).map((t) => `${ex.words[t.word]}:${t.rule}`).join(', ')}]`);
      }
      expect(matched, report.join(' | ')).toBeGreaterThan(0);
      // most rules: every example matches; the ones with deliberate contrasts are listed here
      const contrasts = ['s9r6', 's11r2', 's11r4', 's11r5', 's12r1', 's13r1'];
      if (!contrasts.includes(ruleId)) expect(matched, report.join(' | ')).toBe(rule.examples.length);
    });
  }

  it('every rule id has a label and a lesson', () => {
    for (const [id, info] of Object.entries(RULES)) {
      expect(info.label, id).toBeTruthy();
      expect(LESSON_RULES[info.lesson], `${id} → ${info.lesson}`).toBeDefined();
    }
  });
});

describe('tagger details', () => {
  it('splits words into letters with their marks', () => {
    const u = units('مِّن');
    expect(u.map((x) => x.ch)).toEqual(['م', 'ن']);
    expect(u[0].marks).toContain('ّ');
    expect(u[1].marks).toEqual([]);
  });

  it('reads iẓhār / idghām / iqlāb / ikhfāʾ off the notation of the nūn', () => {
    const t = (words: string[]) => tagVerse({ words }).filter((x) => x.word === 0).map((x) => x.rule);
    expect(t(['مِنۡ', 'عَلَيۡهِمۡ'])).toContain('izhar');
    expect(t(['مِن', 'رَّبِّهِمۡ'])).toContain('idgham_no_ghunnah');
    expect(t(['فَمَن', 'يَعۡمَلۡ'])).toContain('idgham_ghunnah');
    expect(t(['مِنۢ', 'بَعۡدِ'])).toContain('iqlab');
    expect(t(['مِن', 'قَبۡلِكَ'])).toContain('ikhfa');
    expect(t(['كُفُؤًا', 'أَحَدٌ'])).toContain('izhar');
    expect(t(['هُدٗى', 'لِّلۡمُتَّقِينَ'])).toContain('idgham_no_ghunnah');
    expect(t(['مَآءٗ', 'ثَجَّاجٗا'])).toContain('ikhfa');
  });

  it('does not read the rhombus under a verb\'s waṣl alif as imālah', () => {
    expect(tagVerse({ words: ['اُ۪هۡدِنَا'] }).some((t) => t.rule === 'imalah')).toBe(false);
    expect(tagVerse({ words: ['اَ۬لنّ۪اسِ'] }).some((t) => t.rule === 'imalah')).toBe(true);
    expect(tagVerse({ words: ['وَاُ۪هۡدِنَا'] }).some((t) => t.rule === 'imalah')).toBe(false);
  });

  it('never tags a nūn sākinah rule on the last word of a verse when nothing follows', () => {
    const tags = tagVerse({ words: ['مِنۡ'] });
    expect(tags.some((t) => ['izhar', 'ikhfa', 'idgham_ghunnah'].includes(t.rule))).toBe(false);
  });

  it('gives madd lengths', () => {
    const l = (w: string, next?: string) => tagVerse({ words: next ? [w, next] : [w] }).find((t) => t.rule.startsWith('madd'))!;
    expect(l('جَا\u0653ءَ').rule).toBe('madd_muttasil');
    expect(l('جَا\u0653ءَ').length).toBe(4);
    expect(l('اَ۬لضَّا\u0653لِّينَ').rule).toBe('madd_lazim');
    expect(l('بِمَا\u0653', 'أُنزِلَ').rule).toBe('madd_munfasil');
    expect(l('قَالَ', 'لَهُ').rule).toBe('madd_tabii');
    expect(l('اِ۬لۡعَٰلَمِينَ').rule).toBe('madd_tabii'); // the dagger alif first…
    expect(tagVerse({ words: ['اِ۬لۡعَٰلَمِينَ'] }).some((t) => t.rule === 'madd_arid')).toBe(true); // …then the ʿāriḍ at the end
  });

  it('runs over the whole v1 text without throwing and finds Dūrī features in it', () => {
    let n = 0;
    const found = new Set<RuleId>();
    for (const s of SURAHS) {
      for (let i = 0; i < s.verses.length; i++) {
        const v = s.verses[i];
        const tags = tagVerse({ words: v.words, hafs: v.hafs, nextWord: s.verses[i + 1]?.words[0] ?? null });
        n += tags.length;
        for (const t of tags) found.add(t.rule);
      }
    }
    expect(n).toBeGreaterThan(1000);
    for (const r of ['imalah', 'ikhfa', 'idgham_ghunnah', 'iqlab', 'qalqalah', 'madd_muttasil', 'ghunnah', 'mim_ikhfa'] as RuleId[]) expect(found.has(r), r).toBe(true);
  });
});
