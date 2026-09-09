import { describe, expect, it } from 'vitest';
import { bare } from '../audio/quran';
import { duriHafsItems, imalahItems, listenPairs, maddItems, nunItems, spotItems, spotRulesAvailable } from './bank';
import { answer, deckStats, pickNext } from './leitner';

describe('exercise bank (generated from the muṣḥaf by the tagger)', () => {
  it('spot-the-rule has items for the main rules', () => {
    const rules = spotRulesAvailable();
    for (const r of ['ikhfa', 'idgham_ghunnah', 'iqlab', 'izhar', 'qalqalah', 'imalah', 'madd_muttasil'] as const) expect(rules, r).toContain(r);
    const items = spotItems('ikhfa');
    expect(items.length).toBeGreaterThan(20);
    for (const it of items) for (const a of it.answers) expect(it.ref.words[a]).toBeTruthy();
  });

  it('nūn items show the nūn word with the word after it and carry one of the four answers', () => {
    const items = nunItems();
    expect(items.length).toBeGreaterThan(200);
    const byAnswer = new Set(items.map((i) => i.answer));
    expect(byAnswer).toEqual(new Set(['izhar', 'idgham', 'iqlab', 'ikhfa']));
    expect(items.every((i) => i.shown.split(' ').length >= 1)).toBe(true);
  });

  it('imālah items strip the rhombus from the shown word and keep the key from it', () => {
    const items = imalahItems();
    expect(items.some((i) => i.answer)).toBe(true);
    expect(items.some((i) => !i.answer)).toBe(true);
    for (const i of items) expect(i.shown.includes('۪')).toBe(false);
    const nas = items.find((i) => i.ref.surah === 114 && i.ref.basri === 1)!;
    expect(nas.answer).toBe(true); // ٱلنّ۪اسِ
    const nasu = items.find((i) => i.shown.includes('نَّاسُ') || i.shown.includes('نَّاسَ'));
    if (nasu) expect(nasu.answer).toBe(false); // النَّاسُ / النَّاسَ are never imāled (no rhombus)
  });

  it('madd items have a single unambiguous length each', () => {
    const items = maddItems();
    expect(items.length).toBeGreaterThan(100);
    expect(new Set(items.map((i) => i.answer))).toEqual(new Set([2, 4, 6]));
  });

  it('Dūrī vs Ḥafṣ items differ between the two texts', () => {
    const items = duriHafsItems();
    expect(items.length).toBeGreaterThan(20);
    for (const i of items) expect(i.hafs).not.toBe(i.duri);
    expect(items.some((i) => i.duri === 'مَلِكِ')).toBe(true);
  });

  it('listen-and-pick words carry exactly one side of their pair, straight from the muṣḥaf text', () => {
    const pairs = listenPairs();
    expect(pairs.map((p) => p.id)).toEqual(['sin_sad', 'ta_tta', 'dal_dad', 'dhal_zha', 'kaf_qaf', 'ha_hha', 'hamza_ain', 'zay_zha', 'jim_shin']);
    for (const p of pairs) {
      for (const w of p.a) expect(bare(w.ref.words[w.word]), `${p.id} a`).toMatch(new RegExp(`[${p.aLetters.replace('هـ', 'ه').replace('ء', 'ءأإؤئآ')}]`));
      for (const w of p.b) expect(bare(w.ref.words[w.word]), `${p.id} b`).toContain(p.bLetters);
      for (const w of p.b) expect(bare(w.ref.words[w.word]), `${p.id} b must not carry ${p.aLetters}`).not.toMatch(new RegExp(`[${p.aLetters.replace('هـ', 'ه').replace('ء', 'ءأإؤئآ')}]`));
    }
    const sinSad = pairs.find((p) => p.id === 'sin_sad')!;
    expect(sinSad.b.some((w) => w.ref.surah === 1 && bare(w.ref.words[w.word]) === 'الصرط') /* dagger alif in the muṣḥaf */).toBe(true);
    expect(sinSad.a.some((w) => w.ref.surah === 1 && bare(w.ref.words[w.word]) === 'نستعين')).toBe(true);
    // al-Fātiḥah alone (the shipped alignment) already covers six pairs
    const inFatiha = pairs.filter((p) => p.a.some((w) => w.ref.surah === 1) && p.b.some((w) => w.ref.surah === 1)).map((p) => p.id);
    expect(inFatiha).toEqual(['sin_sad', 'ta_tta', 'dal_dad', 'kaf_qaf', 'ha_hha', 'hamza_ain']);
    // أَنۡعَمۡتَ has both a hamzah and an ʿayn, so it sits on neither side
    const hamzaAin = pairs.find((p) => p.id === 'hamza_ain')!;
    expect([...hamzaAin.a, ...hamzaAin.b].some((w) => bare(w.ref.words[w.word]) === 'أنعمت')).toBe(false);
  });
});

describe('Leitner', () => {
  it('drops wrong answers to box 0 and promotes right ones with longer waits', () => {
    let deck = {};
    const t0 = 1_000_000;
    deck = answer(deck, 'a', true, t0);
    expect(deck['a' as keyof typeof deck]).toMatchObject({ box: 1 });
    deck = answer(deck, 'a', true, t0);
    expect((deck as Record<string, { box: number; due: number }>).a.box).toBe(2);
    expect((deck as Record<string, { box: number; due: number }>).a.due).toBeGreaterThan(t0 + 3600_000);
    deck = answer(deck, 'a', false, t0);
    expect((deck as Record<string, { box: number; due: number }>).a.box).toBe(0);
  });

  it('asks due items before unseen ones', () => {
    let deck = {};
    const t0 = 1_000_000;
    deck = answer(deck, 'x', false, t0); // due now
    const pick = pickNext(deck, [{ id: 'y' }, { id: 'x' }], [], t0 + 1, () => 0);
    expect(pick?.id).toBe('x');
    const pick2 = pickNext(deck, [{ id: 'y' }, { id: 'x' }], ['x'], t0 + 1, () => 0);
    expect(pick2?.id).toBe('y');
    expect(deckStats(deck, 'x', t0 + 1)).toEqual({ seen: 1, due: 1, mastered: 0 });
  });
});
