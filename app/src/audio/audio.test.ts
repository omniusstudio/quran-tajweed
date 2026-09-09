import { describe, expect, it } from 'vitest';
import { fromExport, locate, proportionalWords, toExport, type SurahAlign } from './alignment';
import { normalise, segmentsFromSilences, silences } from './peaks';
import { SURAHS, bare, wordCues } from './quran';
import { CLIP_MANIFEST } from '../content/clipManifest';
import { lettersOf } from './letters';

const A: SurahAlign = {
  version: 1,
  surah: 112,
  reciter: 'test',
  verses: [
    { basri: 1, start: 0.5, end: 2.5, words: [[0.5, 1.0], [1.0, 1.4], [1.4, 2.0], [2.0, 2.5]] },
    { basri: 2, start: 3.0, end: 4.0, words: [[3.0, 3.5], [3.5, 4.0]] },
  ],
};

describe('alignment', () => {
  it('locates the verse and word at a time, and nothing in the gaps between verses', () => {
    expect(locate(A, 0.7)).toEqual({ verse: 0, word: 0 });
    expect(locate(A, 1.9)).toEqual({ verse: 0, word: 2 });
    expect(locate(A, 3.6)).toEqual({ verse: 1, word: 1 });
    expect(locate(A, 2.7)).toBeNull();
    expect(locate(A, 9)).toBeNull();
  });

  it('round-trips through the export format keyed by verse number', () => {
    const ex = toExport(A);
    expect(Object.keys(ex.verses)).toEqual(['1', '2']);
    const back = fromExport(JSON.parse(JSON.stringify(ex)));
    expect(back.verses).toEqual(A.verses);
    expect(back.surah).toBe(112);
  });

  it('spreads words proportionally and exactly fills the verse span', () => {
    const w = proportionalWords(['قُلۡ', 'هُوَ', 'ٱللَّهُ', 'أَحَدٌ'], 10, 14);
    expect(w).toHaveLength(4);
    expect(w[0][0]).toBe(10);
    expect(w[3][1]).toBe(14);
    for (let i = 1; i < w.length; i++) expect(w[i][0]).toBeCloseTo(w[i - 1][1], 6);
    expect(w[2][1] - w[2][0]).toBeGreaterThan(w[0][1] - w[0][0]); // الله is longer than قل
  });
});

describe('silence detection', () => {
  it('finds the gaps between sound segments', () => {
    const perSec = 50;
    const env = new Float32Array(perSec * 10);
    const sound = (a: number, b: number) => {
      for (let i = a * perSec; i < b * perSec; i++) env[i] = 0.5 + 0.3 * Math.sin(i);
    };
    sound(0.5, 2.5);
    sound(3.2, 5.0);
    sound(5.8, 9.5);
    const gaps = silences(normalise(env), perSec);
    const segs = segmentsFromSilences(gaps, 10);
    expect(segs).toHaveLength(3);
    expect(segs[0][0]).toBeCloseTo(0.5, 0);
    expect(segs[1][1]).toBeCloseTo(5.0, 0);
  });
});

describe('v1 muṣḥaf text', () => {
  it('has al-Fātiḥah with its basmalah as a header and 7 Baṣrī verses', () => {
    const f = SURAHS[0];
    expect(f.number).toBe(1);
    expect(f.header).toContain('بِسۡمِ');
    expect(f.verses.map((v) => v.basri)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('keeps the Dūrī marks and reads the cues off them', () => {
    const nas = SURAHS.find((s) => s.number === 114)!;
    const word = nas.verses[0].words[nas.verses[0].words.length - 1]; // ٱلنّ۪اسِ with the imālah rhombus
    expect(wordCues(word).imalah).toBe(true);
    expect(bare(word)).toBe('الناس');
    expect(wordCues('إِنَّ').ghunnah).toBe(true);
    expect(wordCues('قَالَ').madd).toBe(2);
    expect(wordCues('ٱلسَّمَا\u0653ءِ').madd).toBe(4); // madd sign U+0653 as encoded in duri.json
  });
});

describe('teacher clip manifest', () => {
  it('lists every letter alone and with each vowel, every pair and every example', () => {
    const ids = new Set(CLIP_MANIFEST.map((c) => c.id));
    expect(ids.size).toBe(CLIP_MANIFEST.length);
    expect(ids.has('letters/qaf')).toBe(true);
    expect(ids.has('letters/qaf_kasra')).toBe(true);
    expect(ids.has('pairs/kaf_qaf')).toBe(true);
    expect(CLIP_MANIFEST.filter((c) => c.id.startsWith('examples/')).length).toBe(128);
  });

  it('maps word letters to articulations', () => {
    expect(lettersOf('قُلۡ').map((l) => l.id)).toEqual(['qaf', 'lam']);
    expect(lettersOf('ٱلنَّاسِ').map((l) => l.id)).toEqual(['alif_madd', 'lam', 'nun', 'sin']);
  });
});
