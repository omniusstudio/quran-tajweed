// Tajwīd colouring for the muṣḥaf, in the manner of the colour-coded prints: each letter the
// tagger puts a rule on takes the colour of that rule's family, so the reader sees how to read it.
// The palette and legend follow the familiar print (madd by length, ghunnah/ikhfāʾ, iqlāb,
// idghām and silent letters, qalqalah, heavy letters).

import { tagVerse, type RuleId, type Tag } from './tagger';

export type Tone = 'madd6' | 'madd4' | 'madd24' | 'madd1' | 'ghunnah' | 'iqlab' | 'silent' | 'qalqalah' | 'heavy' | 'imalah' | 'taqlil' | 'hamza';

export interface ToneInfo {
  id: Tone;
  label: string;
  color: string;
  /** The lessons that teach it, in the order the legend names them. */
  lessons: { id: string; text: string }[];
  /** Trailing words with no lesson behind them. */
  tail?: string;
  review?: boolean;
}

export const TONES: ToneInfo[] = [
  { id: 'madd6', label: 'مدّ لازم (٦ حركات)', color: '#7b1fa2', lessons: [{ id: 's9r4', text: 'مدّ لازم (٦ حركات)' }] },
  { id: 'madd4', label: 'مدّ متصل (٤ حركات)', color: '#d81b60', lessons: [{ id: 's9r3', text: 'مدّ متصل (٤ حركات)' }] },
  { id: 'madd24', label: 'مدّ منفصل أو عارض (٢ أو ٤ أو ٦)', color: '#ef6c00', lessons: [{ id: 's9r2', text: 'مدّ منفصل (٢ أو ٤)' }, { id: 's9r5', text: 'عارض (٢ أو ٤ أو ٦)' }] },
  { id: 'madd1', label: 'مدّ الصلة (حركتان)', color: '#b8860b', lessons: [{ id: 's12r5', text: 'مدّ الصلة (حركتان)' }] },
  { id: 'ghunnah', label: 'غنة وإخفاء', color: '#2e7d32', lessons: [{ id: 's8r1', text: 'غنة' }, { id: 's6r4', text: 'إخفاء' }] },
  { id: 'iqlab', label: 'إقلاب', color: '#7cb342', lessons: [{ id: 's6r3', text: 'إقلاب' }] },
  { id: 'silent', label: 'إدغام وحروف لا تُنطق', color: '#9e9e9e', lessons: [{ id: 's6r2', text: 'إدغام' }, { id: 's12r2', text: 'إدغام الدوري' }], tail: 'وحروف لا تُنطق' },
  { id: 'qalqalah', label: 'قلقلة', color: '#039be5', lessons: [{ id: 's8r2', text: 'قلقلة' }] },
  { id: 'heavy', label: 'تفخيم (الراء ولام الجلالة)', color: '#1565c0', lessons: [{ id: 's5r2', text: 'تفخيم الراء' }, { id: 's5r3', text: 'لام الجلالة' }], review: true },
  { id: 'imalah', label: 'إمالة', color: '#00897b', lessons: [{ id: 's11r2', text: 'إمالة' }] },
  { id: 'taqlil', label: 'تقليل (بين بين)', color: '#7bb8a7', lessons: [{ id: 's11r4', text: 'تقليل (بين بين)' }] },
  { id: 'hamza', label: 'الهمزة: تسهيل وإسقاط وإبدال', color: '#8d6e63', lessons: [{ id: 's10r1', text: 'تسهيل' }, { id: 's10r2', text: 'إسقاط' }, { id: 's10r4', text: 'همزة ساكنة' }] },
];
export const TONE_LABEL: Record<Tone, string> = Object.fromEntries(TONES.map((t) => [t.id, t.label])) as Record<Tone, string>;

const TONE_OF: Partial<Record<RuleId, Tone>> = {
  madd_lazim: 'madd6',
  madd_muttasil: 'madd4',
  madd_munfasil: 'madd24',
  madd_arid: 'madd24',
  madd_silah: 'madd1',
  ikhfa: 'ghunnah',
  ghunnah: 'ghunnah',
  mim_ikhfa: 'ghunnah',
  idgham_ghunnah: 'silent', // the nūn is not sounded; the ghunnah is on the letter it melts into (coloured on that letter)
  iqlab: 'iqlab',
  idgham_no_ghunnah: 'silent',
  mim_idgham: 'silent',
  idgham_duri: 'silent',
  qalqalah: 'qalqalah',
  imalah: 'imalah',
  taqlil: 'taqlil',
  tashil: 'hamza',
  isqat: 'hamza',
  hamza_sakin: 'hamza',
};

const isLetter = (c: string) => /[ء-غف-يٱ]/.test(c);
const SHADDA = 'ّ';
const SILENT_ALIF = '۟';
const SUN = new Set('تثدذرزسشصضطظلن');
const NON_JOINING = new Set('اأإآٱدذرزوؤةىءٲٳ');
export const ZWJ = '\u200d';

export interface Piece {
  text: string;
  tone?: Tone;
}

/** The word split into its letter units (letter + following marks), with any leading non-letters kept in front. */
function split(word: string): string[] {
  const out: string[] = [];
  let cur = '';
  for (const c of word) {
    if (isLetter(c)) { if (cur) out.push(cur); cur = c; }
    else cur += c;
  }
  if (cur) out.push(cur);
  // a leading run of marks (e.g. ۞) is not a unit: glue it to the first unit
  if (out.length > 1 && !isLetter(out[0][0])) { out[1] = out[0] + out[1]; out.shift(); }
  return out;
}

/** Letters that are written but not sounded: the silent alif after wāw al-jamāʿah, the lām of a sun-letter ال. */
function silentUnits(units: string[]): Set<number> {
  const s = new Set<number>();
  units.forEach((u, i) => {
    const ch = u[0];
    if ((ch === 'ا' || ch === 'ٱ') && u.includes(SILENT_ALIF)) s.add(i);
    if (ch === 'ل' && i > 0 && (units[i - 1][0] === 'ا' || units[i - 1][0] === 'ٱ') && units[i + 1] && SUN.has(units[i + 1][0]) && units[i + 1].includes(SHADDA)) s.add(i);
  });
  return s;
}

const FATHA_LIKE = /[\u064E\u064B\u065E]/;   // فتحة، فتحتان، فتحتان متتابعتان
const DAMMA_LIKE = /[\u064F\u064C\u0657]/;   // ضمة، ضمتان، ضمتان متتابعتان
const KASRA_LIKE = /[\u0650\u064D\u0656]/;   // كسرة، كسرتان، كسرتان متتابعتان
const IMALAH = '\u06EA';                          // the rhombus: imālah of the alif that follows
const WASL = /[\u06EC\u06EA]/;                  // on a word-initial alif: hamzat al-waṣl
const ISTILA = new Set('خصضغطقظ');
const isAlif = (u: string) => u[0] === 'ا' || u[0] === 'ٱ' || u[0] === 'ى';
const hasHaraka = (u: string) => FATHA_LIKE.test(u) || DAMMA_LIKE.test(u) || KASRA_LIKE.test(u);
const isWasl = (units: string[], i: number) => i === 0 && (units[0][0] === 'ا' || units[0][0] === 'ٱ') && WASL.test(units[0]);

/**
 * The rāʾ: heavy with fatḥah or ḍammah; thin with kasrah or before an imāled alif; sākin, it
 * follows what precedes it (heavy after fatḥah/ḍammah or the kasrah of hamzat al-waṣl, thin after
 * an original kasrah unless a letter of istiʿlāʾ follows, thin after a sākin yāʾ). At a verse end
 * the kasrah drops and the sākin rule applies to the stop. TODO(scholar): review against the Dūrī print.
 */
function raaHeavy(units: string[], i: number, prevWordLast: string | undefined, atStop: boolean): boolean {
  const u = units[i];
  if (i > 0 && u.includes(IMALAH)) return false;
  if (FATHA_LIKE.test(u) || DAMMA_LIKE.test(u)) return true;
  const before = (k: number) => (k >= 0 ? units[k] : prevWordLast);
  const sakinRule = (): boolean => {
    const prev = before(i - 1);
    if (!prev) return true;
    if (i - 1 === 0 && isWasl(units, 0)) return true;                       // كسرة عارضة
    if (KASRA_LIKE.test(prev)) {
      const next = units[i + 1];
      return !!next && ISTILA.has(next[0]) && (FATHA_LIKE.test(next) || DAMMA_LIKE.test(next));
    }
    if (prev[0] === 'ي' && !hasHaraka(prev)) return false;                 // ياء ساكنة
    if (isAlif(prev) && before(i - 2)?.includes(IMALAH)) return false;      // ألف ممالة قبلها
    if (!hasHaraka(prev) && !isAlif(prev) && prev[0] !== 'و') {             // ساكن قبله ما يحدد
      const pp = before(i - 2);
      return !pp || !KASRA_LIKE.test(pp);
    }
    return true;
  };
  if (KASRA_LIKE.test(u)) return atStop && i === units.length - 1 ? sakinRule() : false;
  return sakinRule();
}

/** The lām of الله: heavy after fatḥah or ḍammah (or at a start), thin after kasrah. */
function jalalahLam(units: string[], prevWordLast: string | undefined): number {
  const bare = units.map((u) => u.replace(/[^ء-غف-يٱ]/g, '').replace('ٱ', 'ا'));
  const tail = bare.join('');
  if (!tail.endsWith('لله')) return -1;
  // الله keeps both lāms after its alif; لِلَّهِ drops the first, so the jalālah lām is the one before the hāʾ
  const lam = tail.endsWith('الله') ? units.length - 3 : units.length - 2;
  if (lam < 0 || bare[lam] !== 'ل') return -1;
  let k = lam - 1;
  let ref = k >= 0 ? units[k] : prevWordLast;
  if (ref && k >= 0 && isAlif(ref) && !hasHaraka(ref) && k === 0) ref = prevWordLast;   // بِاللَّهِ-style alif without a mark: look past it
  if (ref && k >= 0 && isAlif(ref) && hasHaraka(ref)) { /* اَ۬للَّهُ: the waṣl alif carries the joining vowel */ }
  if (ref && k >= 0 && isAlif(ref) && !hasHaraka(ref) && k > 0) ref = units[k - 1];     // وَاَللَّهُ / تَاَللَّهِ: the prefix letter decides
  const heavy = !ref || !KASRA_LIKE.test(ref);
  return heavy ? lam : -2;
}

function heavyUnits(units: string[], prevWordLast: string | undefined, atStop: boolean): Set<number> {
  const s = new Set<number>();
  units.forEach((u, i) => { if (u[0] === 'ر' && raaHeavy(units, i, prevWordLast, atStop)) s.add(i); });
  const lam = jalalahLam(units, prevWordLast);
  if (lam >= 0) s.add(lam);
  return s;
}

/** For tests: is the rāʾ (or jalālah lām) at `i` heavy in `word` after `prev`? */
export function isHeavy(word: string, i: number, prev?: string, atStop = false): boolean {
  return heavyUnits(split(word), prev ? split(prev).slice(-1)[0] : undefined, atStop).has(i);
}

const TANWIN = /[\u064B-\u064D\u0656\u0657\u065E]/;
const NUN_FAMILY = new Set<RuleId>(['izhar', 'idgham_ghunnah', 'idgham_no_ghunnah', 'iqlab', 'ikhfa', 'mim_ikhfa', 'mim_idgham', 'mim_izhar']);

const MADD = new Set<RuleId>(['madd_tabii', 'madd_muttasil', 'madd_munfasil', 'madd_lazim', 'madd_arid', 'madd_silah']);

/** What the last word of `words` hands to the first letter of `nextWord`: the ghunnah of a melting nūn, or the hamzah of a separated madd. */
function carryFrom(words: string[], hafs: (string | null)[] | undefined, nextWord: string | null): Tone | undefined {
  if (!nextWord) return undefined;
  const last = words.length - 1;
  const tags = tagVerse({ words, hafs, nextWord }).filter((t) => t.word === last);
  if (tags.some((t) => t.rule === 'idgham_ghunnah')) return 'ghunnah';
  if (tags.some((t) => t.rule === 'madd_munfasil')) return 'madd24';
  return undefined;
}

/**
 * The pieces of every word of a verse, coloured; `shown` are the words as displayed (kashida
 * included). `prev` is the previous verse (its last word may melt into this verse's first letter).
 * Rules on the verse's last letter are not coloured: the print judges the stop, where tanwīn and
 * the sākin nūn's rule fall away.
 */
export function colourVerse(words: string[], hafs: (string | null)[] | undefined, nextWord: string | null, shown: string[], prev?: { words: string[]; hafs?: (string | null)[] }): Piece[][] {
  const tags = tagVerse({ words, hafs, nextWord });
  const byWord: Tag[][] = words.map(() => []);
  for (const t of tags) byWord[t.word]?.push(t);
  let carry: Tone | undefined = prev ? carryFrom(prev.words, prev.hafs, words[0]) : undefined;
  return words.map((w, wi) => {
    const units = split(shown[wi] ?? w);
    const tone: (Tone | undefined)[] = units.map(() => undefined);
    const prevLast = wi > 0 ? split(words[wi - 1]).slice(-1)[0] : undefined;
    const isLastWord = wi === words.length - 1;
    for (const i of silentUnits(units)) tone[i] = 'silent';
    for (const i of heavyUnits(units, prevLast, isLastWord)) tone[i] = 'heavy';
    if (carry && units.length) tone[0] = carry;
    carry = undefined;
    // madd first, so a qalqalah or ghunnah on the same letter keeps its own colour
    const ordered = [...byWord[wi]].sort((a, b) => (MADD.has(a.rule) ? 0 : 1) - (MADD.has(b.rule) ? 0 : 1));
    for (const t of ordered) {
      const tn = TONE_OF[t.rule];
      if (!tn || t.unit >= units.length) continue;
      if (MADD.has(t.rule)) {
        // the print colours the madd letter with what it leans on: the hamzah (muttaṣil), the doubled
        // or sākin letter (lāzim), the letter stopped on (ʿāriḍ); munfaṣil reaches the next word's hamzah
        tone[t.unit] = tn;
        if (t.rule === 'madd_muttasil' || t.rule === 'madd_lazim' || t.rule === 'madd_arid') { if (t.unit + 1 < units.length) tone[t.unit + 1] = tn; }
        if (t.rule === 'madd_munfasil' && t.unit >= units.length - 2) carry = tn;
        continue;
      }
      // a nūn-family rule at the word's end reaches into the next word: the tanwīn may sit on the
      // penultimate unit (هُدٗى), so "the end" is the last unit or a tanwīn just before it
      const atEnd = t.unit === units.length - 1 || (t.unit === units.length - 2 && TANWIN.test(units[t.unit]));
      if (isLastWord && atEnd && NUN_FAMILY.has(t.rule)) continue;
      tone[t.unit] = tn;
      // the imāled or lowered alif is coloured with the letter that carries the mark
      if ((t.rule === 'imalah' || t.rule === 'taqlil') && t.unit + 1 < units.length && /^[اٱىي]/.test(units[t.unit + 1]) && !hasHaraka(units[t.unit + 1])) tone[t.unit + 1] = tn;
      if (t.rule === 'idgham_ghunnah' && atEnd) carry = 'ghunnah';
    }
    // merge neighbours of one tone into one piece
    const pieces: Piece[] = [];
    units.forEach((u, i) => {
      const last = pieces[pieces.length - 1];
      if (last && last.tone === tone[i]) last.text += u;
      else pieces.push({ text: u, tone: tone[i] });
    });
    // each piece is shaped on its own by the browser, which would break the cursive joins at a colour
    // boundary: a zero-width joiner on both sides of every join keeps the letters connected
    for (let i = 0; i + 1 < pieces.length; i++) {
      const lastLetter = pieces[i].text.replace(/[^ء-غف-يٱ]/g, '').slice(-1);
      if (lastLetter && !NON_JOINING.has(lastLetter)) { pieces[i].text += ZWJ; pieces[i + 1].text = ZWJ + pieces[i + 1].text; }
    }
    return pieces;
  });
}
