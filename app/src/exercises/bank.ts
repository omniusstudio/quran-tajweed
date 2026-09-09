// Exercise items generated from the muṣḥaf text by the rule tagger (PROMPT.md §7.3), so every
// answer key is the muṣḥaf's own notation, never a hand-typed list.

import { SURAHS, bare, type Surah, type Verse } from '../audio/quran';
import { QUIZ_RULES, RULES, hasImalah, tagVerse, type RuleId, type Tag } from '../rules/tagger';
import { CONTRAST_PAIRS } from '../viewer/articulations';

export interface VerseRef {
  surah: number;
  surahName: string;
  basri: number;
  words: string[];
  hafs: (string | null)[];
}

interface Tagged {
  ref: VerseRef;
  tags: Tag[];
  nextWord: string | null;
}

let cache: Tagged[] | null = null;

/** Every v1 verse with its tags, computed once. */
export function taggedVerses(): Tagged[] {
  if (cache) return cache;
  cache = [];
  for (const s of SURAHS as Surah[]) {
    s.verses.forEach((v: Verse, i: number) => {
      const nextWord = s.verses[i + 1]?.words[0] ?? null;
      cache!.push({
        ref: { surah: s.number, surahName: s.name, basri: v.basri, words: v.words, hafs: v.hafs },
        tags: tagVerse({ words: v.words, hafs: v.hafs, nextWord }),
        nextWord,
      });
    });
  }
  return cache;
}

// ---------------------------------------------------------------------------
// 1. Spot the rule

export interface SpotItem {
  id: string;
  rule: RuleId;
  ref: VerseRef;
  /** Word indices that carry the rule (any of them is a correct tap). */
  answers: number[];
}

export function spotItems(rule: RuleId, maxWords = 14): SpotItem[] {
  return taggedVerses()
    .filter((t) => t.ref.words.length <= maxWords && t.ref.words.length >= 3)
    .map((t) => ({ id: `spot:${rule}:${t.ref.surah}:${t.ref.basri}`, rule, ref: t.ref, answers: Array.from(new Set(t.tags.filter((x) => x.rule === rule).map((x) => x.word))) }))
    .filter((it) => it.answers.length > 0 && it.answers.length < it.ref.words.length);
}

/** Rules that actually occur in the v1 text, for the exercise menu. */
export function spotRulesAvailable(): RuleId[] {
  const present = new Set<RuleId>();
  for (const t of taggedVerses()) for (const x of t.tags) present.add(x.rule);
  return QUIZ_RULES.filter((r) => present.has(r) && spotItems(r).length >= 3);
}

// ---------------------------------------------------------------------------
// 2. What happens to this nūn?

export type NunAnswer = 'izhar' | 'idgham' | 'iqlab' | 'ikhfa';
export const NUN_OPTIONS: { key: NunAnswer; label: string }[] = [
  { key: 'izhar', label: 'واضحة (إظهار)' },
  { key: 'idgham', label: 'تذوب في ما بعدها (إدغام)' },
  { key: 'iqlab', label: 'تصير ميماً (إقلاب)' },
  { key: 'ikhfa', label: 'خفية (إخفاء)' },
];

export interface NunItem {
  id: string;
  ref: VerseRef;
  word: number;
  /** The word and the one after it, as shown. */
  shown: string;
  answer: NunAnswer;
  rule: RuleId;
}

const NUN_MAP: Partial<Record<RuleId, NunAnswer>> = { izhar: 'izhar', idgham_ghunnah: 'idgham', idgham_no_ghunnah: 'idgham', iqlab: 'iqlab', ikhfa: 'ikhfa' };

export function nunItems(): NunItem[] {
  const out: NunItem[] = [];
  for (const t of taggedVerses()) {
    for (const x of t.tags) {
      const a = NUN_MAP[x.rule];
      if (!a) continue;
      const next = t.ref.words[x.word + 1] ?? t.nextWord ?? '';
      out.push({ id: `nun:${t.ref.surah}:${t.ref.basri}:${x.word}`, ref: t.ref, word: x.word, shown: `${t.ref.words[x.word]} ${next}`.trim(), answer: a, rule: x.rule });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 3. Listen and pick: two real words from the reciter's recording, which one has the letter?
// The answer key is the muṣḥaf text; the voice is the reciter's, so no teacher clips are needed.

/** The muṣḥaf characters that count as each side of a confusable pair (CONTRAST_PAIRS ids). */
const PAIR_LETTERS: Record<string, [string, string]> = {
  sin_sad: ['س', 'ص'],
  ta_tta: ['ت', 'ط'],
  dal_dad: ['د', 'ض'],
  dhal_zha: ['ذ', 'ظ'],
  kaf_qaf: ['ك', 'ق'],
  ha_hha: ['ه', 'ح'],
  hamza_ain: ['ءأإؤئآ', 'ع'],
  zay_zha: ['ز', 'ظ'],
  jim_shin: ['ج', 'ش'],
};
const TASHIL = '\u06EC';

export interface ListenWord {
  ref: VerseRef;
  word: number;
}
export interface ListenPair {
  id: string;
  aLetters: string;
  bLetters: string;
  /** Words containing an `a` letter and no `b` letter, and the reverse. */
  a: ListenWord[];
  b: ListenWord[];
}

const hasAny = (bareWord: string, letters: string) => [...letters].some((ch) => bareWord.includes(ch));

/** For every confusable pair, the v1 words that carry exactly one side of it (all sūrahs; the page keeps the aligned ones). */
export function listenPairs(): ListenPair[] {
  const out: ListenPair[] = [];
  for (const p of CONTRAST_PAIRS) {
    const letters = PAIR_LETTERS[p.id];
    if (!letters) continue;
    const pair: ListenPair = { id: p.id, aLetters: p.title.split(' / ')[0], bLetters: p.title.split(' / ')[1] ?? '', a: [], b: [] };
    for (const t of taggedVerses()) {
      t.ref.words.forEach((w, i) => {
        // ة is ت in waṣl and ه at a stop, so it is neither side; a hamzah softened by tas-hīl is not a clean hamzah.
        if (w.includes('ة') || (p.id === 'hamza_ain' && w.includes(TASHIL))) return;
        const b = bare(w);
        const hasA = hasAny(b, letters[0]);
        const hasB = hasAny(b, letters[1]);
        if (hasA && !hasB) pair.a.push({ ref: t.ref, word: i });
        else if (hasB && !hasA) pair.b.push({ ref: t.ref, word: i });
      });
    }
    if (pair.a.length && pair.b.length) out.push(pair);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 4. Imālah or not?

export interface ImalahItem {
  id: string;
  ref: VerseRef;
  word: number;
  /** The word with the imālah rhombus removed so the learner has to decide. */
  shown: string;
  answer: boolean;
}

const IMALAH_MARK = '۪';
const IMALAH_STEMS = ['ناس', 'نار', 'كافرين', 'كفرين', 'ابرار', 'الدار', 'قهار', 'جبار'];

export function imalahItems(): ImalahItem[] {
  const out: ImalahItem[] = [];
  for (const t of taggedVerses()) {
    const taqlil = new Set(t.tags.filter((x) => x.rule === 'taqlil').map((x) => x.word));
    t.ref.words.forEach((w, i) => {
      if (taqlil.has(i)) return;
      const sk = w.replace(/[^ء-ي]/g, '').replace(/[أإٱ]/g, 'ا');
      if (!IMALAH_STEMS.some((st) => sk.includes(st))) return;
      out.push({ id: `imalah:${t.ref.surah}:${t.ref.basri}:${i}`, ref: t.ref, word: i, shown: w.split(IMALAH_MARK).join(''), answer: hasImalah(w) });
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 5. Count the madd

export interface MaddItem {
  id: string;
  ref: VerseRef;
  word: number;
  rule: RuleId;
  answer: 2 | 4 | 6;
}

export function maddItems(): MaddItem[] {
  const out: MaddItem[] = [];
  for (const t of taggedVerses()) {
    const seen = new Set<number>();
    for (const x of t.tags) {
      if (!x.length || x.rule === 'madd_arid' || x.rule === 'madd_silah' || seen.has(x.word)) continue;
      // one madd per word only, and skip words carrying two different lengths
      const others = t.tags.filter((y) => y.word === x.word && y.length && y.length !== x.length);
      if (others.length) continue;
      seen.add(x.word);
      out.push({ id: `madd:${t.ref.surah}:${t.ref.basri}:${x.word}`, ref: t.ref, word: x.word, rule: x.rule, answer: x.length });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 6. Dūrī vs Ḥafṣ

export interface DuriHafsItem {
  id: string;
  ref: VerseRef;
  word: number;
  hafs: string;
  duri: string;
  rule: RuleId;
}

export function duriHafsItems(): DuriHafsItem[] {
  const out: DuriHafsItem[] = [];
  for (const t of taggedVerses()) {
    for (const x of t.tags) {
      if (!['farsh', 'isqat', 'tashil', 'idgham_duri', 'ya_fath', 'iskan', 'no_sakt'].includes(x.rule)) continue;
      const h = t.ref.hafs[x.word];
      if (!h || h === t.ref.words[x.word]) continue;
      if (out.some((o) => o.ref === t.ref && o.word === x.word)) continue;
      out.push({ id: `dh:${t.ref.surah}:${t.ref.basri}:${x.word}`, ref: t.ref, word: x.word, hafs: h, duri: t.ref.words[x.word], rule: x.rule });
    }
  }
  return out;
}

export const RULE_LABEL = (r: RuleId) => RULES[r].label;
