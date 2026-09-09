// The rule tagger (PROMPT.md §7.4): a pure function over the Dūrī muṣḥaf text that returns
// rule spans, using the muṣḥaf's own notation as ground truth wherever it exists.
//
// Notation in data/duri.json (see scripts/trace of the marks in the M4 commit message):
//   U+06E1 sukūn · U+0651 shaddah · U+064B-064D plain tanwīn (iẓhār) · U+0656/0657/065E
//   sequential tanwīn (idghām / ikhfāʾ) · U+06E2/06ED small mīm (iqlāb) · U+0653 madd sign ·
//   U+0670 dagger alif · U+06EA imālah · U+06EC on a word-initial alif = hamzat al-waṣl, on a
//   later alif = tas-hīl · U+06DF small zero after a dagger alif on a word-initial hamzah =
//   tas-hīl with idkhāl · U+06E6 small yāʾ · U+06E5 small wāw · U+06D6-06DB waqf signs.

export type RuleId =
  | 'izhar'
  | 'idgham_ghunnah'
  | 'idgham_no_ghunnah'
  | 'iqlab'
  | 'ikhfa'
  | 'mim_ikhfa'
  | 'mim_idgham'
  | 'mim_izhar'
  | 'ghunnah'
  | 'qalqalah'
  | 'madd_tabii'
  | 'madd_muttasil'
  | 'madd_munfasil'
  | 'madd_lazim'
  | 'madd_arid'
  | 'madd_silah'
  | 'imalah'
  | 'taqlil'
  | 'tashil'
  | 'isqat'
  | 'hamza_sakin'
  | 'iskan'
  | 'ya_zaida'
  | 'ya_fath'
  | 'idgham_duri'
  | 'no_sakt'
  | 'ha_damir'
  | 'farsh'
  | 'waqf_sign'
  | 'waqf_end';

export interface RuleInfo {
  /** Short Arabic label as shown on a word. */
  label: string;
  /** lessons.json rule that teaches it. */
  lesson: string;
  /** Plain-language one-liner for the tap panel (taken from the lesson names, not new content). */
  group: 'nun' | 'mim' | 'ghunnah' | 'qalqalah' | 'madd' | 'duri' | 'waqf';
}

export const RULES: Record<RuleId, RuleInfo> = {
  izhar: { label: 'إظهار', lesson: 's6r1', group: 'nun' },
  idgham_ghunnah: { label: 'إدغام بغنة', lesson: 's6r2', group: 'nun' },
  idgham_no_ghunnah: { label: 'إدغام بلا غنة', lesson: 's6r2', group: 'nun' },
  iqlab: { label: 'إقلاب', lesson: 's6r3', group: 'nun' },
  ikhfa: { label: 'إخفاء', lesson: 's6r4', group: 'nun' },
  mim_ikhfa: { label: 'إخفاء الميم', lesson: 's7r1', group: 'mim' },
  mim_idgham: { label: 'إدغام الميم', lesson: 's7r2', group: 'mim' },
  mim_izhar: { label: 'إظهار الميم', lesson: 's7r3', group: 'mim' },
  ghunnah: { label: 'غنة', lesson: 's8r1', group: 'ghunnah' },
  qalqalah: { label: 'قلقلة', lesson: 's8r2', group: 'qalqalah' },
  madd_tabii: { label: 'مد حركتان', lesson: 's9r1', group: 'madd' },
  madd_muttasil: { label: 'مد متصل (٤)', lesson: 's9r3', group: 'madd' },
  madd_munfasil: { label: 'مد منفصل (٢ أو ٤)', lesson: 's9r2', group: 'madd' },
  madd_lazim: { label: 'مد لازم (٦)', lesson: 's9r4', group: 'madd' },
  madd_arid: { label: 'مد عارض (٢/٤/٦)', lesson: 's9r5', group: 'madd' },
  madd_silah: { label: 'مد الصلة', lesson: 's12r5', group: 'madd' },
  imalah: { label: 'إمالة', lesson: 's11r2', group: 'duri' },
  taqlil: { label: 'تقليل (بين بين) — يُراجع', lesson: 's11r4', group: 'duri' },
  tashil: { label: 'تسهيل', lesson: 's10r1', group: 'duri' },
  isqat: { label: 'إسقاط الهمزة', lesson: 's10r2', group: 'duri' },
  hamza_sakin: { label: 'همزة ساكنة', lesson: 's10r4', group: 'duri' },
  iskan: { label: 'إسكان', lesson: 's10r5', group: 'duri' },
  ya_zaida: { label: 'ياء زائدة', lesson: 's12r4', group: 'duri' },
  ya_fath: { label: 'فتح ياء المتكلم', lesson: 's12r3', group: 'duri' },
  idgham_duri: { label: 'إدغام (الدوري)', lesson: 's12r2', group: 'duri' },
  no_sakt: { label: 'لا سكت', lesson: 's12r1', group: 'duri' },
  ha_damir: { label: 'هاء ساكنة', lesson: 's12r5', group: 'duri' },
  farsh: { label: 'تُقرأ بشكل مختلف', lesson: 's12r6', group: 'duri' },
  waqf_sign: { label: 'علامة وقف', lesson: 's13r2', group: 'waqf' },
  waqf_end: { label: 'وقف', lesson: 's13r1', group: 'waqf' },
};

export interface Tag {
  rule: RuleId;
  /** Word index in the verse. */
  word: number;
  /** Index of the letter unit inside the word the rule sits on. */
  unit: number;
  /** Madd length in harakāt, when the rule is a madd. */
  length?: 2 | 4 | 6;
  /** Extra detail, e.g. the waqf sign or how to stop. */
  detail?: string;
}

export interface TagInput {
  words: string[];
  /** Ḥafṣ counterpart per word (null when unaligned); enables isqāṭ, no-sakt and farsh. */
  hafs?: (string | null)[];
  /** First word of the next verse when the reader continues (rules can cross the boundary). */
  nextWord?: string | null;
}

// ---------------------------------------------------------------------------
// Marks

const SUKUN = new Set(['ۡ', 'ْ']);
const SHADDA = 'ّ';
const FATHA = 'َ';
const DAMMA = 'ُ';
const KASRA = 'ِ';
const HARAKAT = new Set([FATHA, DAMMA, KASRA]);
const TANWIN_PLAIN = new Set(['ً', 'ٌ', 'ٍ']);
const TANWIN_SEQ = new Set(['ٖ', 'ٗ', 'ٞ']);
const SMALL_MEEM_HIGH = 'ۢ'; // iqlāb
const SMALL_MEEM_LOW = 'ۭ'; // under ذوات الياء = taqlīl (بين بين); word-finally before ب = iqlāb of kasratān
const SMALL_MEEM = new Set([SMALL_MEEM_HIGH, SMALL_MEEM_LOW]);
const MADDA = 'ٓ';
const DAGGER = 'ٰ';
const IMALAH = '۪';
const WASL_OR_TASHIL = '۬';
const ZERO = '۟';
const SMALL_YA = 'ۦ';
const SMALL_WAW = 'ۥ';
const SAKT_HAFS = 'ۜ';
const WAQF: Record<string, string> = { 'ۖ': 'ۖ', 'ۗ': 'ۗ', 'ۘ': 'ۘ', 'ۙ': 'ۙ', 'ۚ': 'ۚ', 'ۛ': 'ۛ' };

const HAMZA = new Set(['ء', 'أ', 'إ', 'ؤ', 'ئ', 'آ']);
const THROAT = new Set(['ء', 'أ', 'إ', 'ه', 'ع', 'ح', 'غ', 'خ']);
const QALQALAH = new Set(['ق', 'ط', 'ب', 'ج', 'د']);
const ISKAN_WORDS = new Set(['باريكم', 'يامركم', 'تامرهم', 'يامرهم', 'يامرها']);

export interface Unit {
  ch: string;
  marks: string[];
}

const isLetter = (c: string) => /[ء-غف-يٱ]/.test(c);

/** Split a word into base letters with their following marks. Small yāʾ/wāw attach as marks. */
export function units(word: string): Unit[] {
  const out: Unit[] = [];
  for (const c of word) {
    if (isLetter(c)) out.push({ ch: c, marks: [] });
    else if (out.length) out[out.length - 1].marks.push(c);
  }
  return out;
}

const has = (u: Unit, m: string) => u.marks.includes(m);
const hasAny = (u: Unit, set: Set<string>) => u.marks.some((m) => set.has(m));
const haraka = (u: Unit) => u.marks.find((m) => HARAKAT.has(m));
const isBare = (u: Unit) => !haraka(u) && !hasAny(u, SUKUN) && !has(u, SHADDA) && !hasAny(u, TANWIN_PLAIN) && !hasAny(u, TANWIN_SEQ);
const isAlif = (u: Unit) => u.ch === 'ا' || u.ch === 'ٱ' || u.ch === 'ى';

/** True when the word carries the imālah rhombus on a real letter (not on a waṣl alif). */
export function hasImalah(word: string): boolean {
  return tagVerse({ words: [word] }).some((t) => t.rule === 'imalah');
}

/** Letters only, hamzah forms unified, for word-list matching. */
export function skeleton(word: string): string {
  return units(word)
    .map((u) => (u.ch === 'ٱ' || u.ch === 'أ' || u.ch === 'إ' || u.ch === 'آ' ? 'ا' : u.ch === 'ئ' || u.ch === 'ى' ? 'ي' : u.ch === 'ؤ' ? 'و' : u.ch))
    .join('');
}

/**
 * A reading-level form of a word for spotting farsh differences against Ḥafṣ: letters and
 * vowels kept, notation differences (sukūn shapes, tanwīn shapes, waṣl marks, small signs,
 * hamzah carriers, waqf signs) removed, the dagger alif written out as an alif.
 */
export function readingForm(word: string): string {
  // Dūrī sequential tanwīn shapes: ٗ (U+0657) fatḥatān, ٞ (U+065E) ḍammatān, ٖ (U+0656) kasratān
  const TANWIN_MAP: Record<string, string> = { 'ٗ': 'ً', 'ٞ': 'ٌ', 'ٖ': 'ٍ' };
  let out = '';
  const us = units(word);
  for (let k = 0; k < us.length; k++) {
    const u = us[k];
    // hamzat al-waṣl (also after a و/ف prefix): Dūrī writes its vowel on the alif, Ḥafṣ writes ٱ bare
    // a bare alif carrying a vowel at the start of a word (or after a one-letter prefix) is always hamzat al-waṣl in this text
    const wasl = u.ch === 'ٱ' || (u.ch === 'ا' && k <= 1 && (has(u, WASL_OR_TASHIL) || has(u, ZERO) || (haraka(u) !== undefined && !has(u, MADDA) && !has(u, DAGGER) && (k === 0 || 'وفبكل'.includes(us[0].ch)))));
    // a standalone hamzah / hamzah-with-madd is spelt differently in the two texts (ءَا vs أٓ)
    const looseHamza = u.ch === 'ء' || ((u.ch === 'أ' || u.ch === 'ا') && has(u, MADDA) && k < us.length - 1 && !isAlif(us[k + 1]) && us[k + 1].ch !== 'ء');
    let base = u.ch;
    if (base === 'ٱ' || base === 'أ' || base === 'إ' || base === 'آ') base = 'ا';
    else if (base === 'ؤ') base = 'و';
    else if (base === 'ئ') base = 'ي';
    else if (base === 'ء') base = '';
    else if (base === 'ى') base = 'ي';
    out += base;
    let dagger = false;
    const meemTanwin = has(u, SMALL_MEEM_HIGH) || (has(u, SMALL_MEEM_LOW) && !(us[k + 1] && (us[k + 1].ch === 'ي' || us[k + 1].ch === 'ى')));
    const MEEM_MAP: Record<string, string> = { 'َ': 'ً', 'ُ': 'ٌ', 'ِ': 'ٍ' };
    for (const m of u.marks) {
      if (HARAKAT.has(m) && (wasl || looseHamza)) continue;
      if (HARAKAT.has(m) && meemTanwin && !hasAny(u, TANWIN_PLAIN) && !hasAny(u, TANWIN_SEQ)) out += MEEM_MAP[m]; // ـَۢ is a tanwīn turned to mīm
      else if (m === SHADDA && k === 0) continue; // a shaddah on a word's first letter only marks idghām from the word before
      else if (HARAKAT.has(m) || m === SHADDA) out += m;
      else if (SUKUN.has(m)) {
        // silent letters carry a sukūn in Dūrī and a small zero in Ḥafṣ: the alif after a plural wāw, the wāw of أولئك
        const silent = u.ch === 'ا' || (u.ch === 'و' && k === 1 && us[0].ch === 'أ' && us[2]?.ch === 'ل');
        if (!silent) out += 'ْ';
      } else if (TANWIN_PLAIN.has(m)) out += m;
      else if (TANWIN_MAP[m]) out += TANWIN_MAP[m];
      else if (m === DAGGER) dagger = true;
    }
    if (dagger) out += 'ا';
    // Dūrī leaves a sākin ن / م bare where Ḥafṣ writes the sukūn: not a reading difference
    if ((u.ch === 'ن' || u.ch === 'م') && isBare(u)) out += 'ْ';
  }
  // canonical order of marks after each letter
  return out.replace(/([\u064B-\u0652]+)/g, (m) => Array.from(m).sort().join(''));
}

const hamzaCount = (w: string) => Array.from(w).filter((c) => HAMZA.has(c) || c === 'ٔ' || c === 'ٕ').length;

// ---------------------------------------------------------------------------

export function tagVerse(input: TagInput): Tag[] {
  const { words, hafs, nextWord } = input;
  const tags: Tag[] = [];
  const all = words.map(units);
  const nextUnits = nextWord ? units(nextWord) : null;

  for (let wi = 0; wi < words.length; wi++) {
    const us = all[wi];
    if (!us.length) continue;
    const last = us.length - 1;
    const isVerseEnd = wi === words.length - 1;
    const following = wi + 1 < words.length ? all[wi + 1] : nextUnits;
    const nextLetter = following?.[0];
    const push = (rule: RuleId, unit: number, extra: Partial<Tag> = {}) => tags.push({ rule, word: wi, unit, ...extra });
    const duriTagged = new Set<RuleId>();
    const pushDuri = (rule: RuleId, unit: number, extra: Partial<Tag> = {}) => {
      duriTagged.add(rule);
      push(rule, unit, extra);
    };

    const isMuqattaat = us.length <= 5 && us.every((u) => !haraka(u) && !hasAny(u, SUKUN) && !has(u, SHADDA)) && us.some((u) => has(u, MADDA));

    for (let k = 0; k < us.length; k++) {
      const u = us[k];
      const nextInWord = us[k + 1];
      const after = nextInWord ?? (k === last ? nextLetter : undefined);
      const nextCh = after?.ch;

      // ---- nūn sākinah & tanwīn --------------------------------------------------------
      const tanwinPlain = hasAny(u, TANWIN_PLAIN);
      const tanwinSeq = hasAny(u, TANWIN_SEQ);
      const lowMeemTaqlil = has(u, SMALL_MEEM_LOW) && nextInWord !== undefined && (nextInWord.ch === 'ي' || nextInWord.ch === 'ى' || nextInWord.ch === 'ا');
      const smallMeem = has(u, SMALL_MEEM_HIGH) || (has(u, SMALL_MEEM_LOW) && !lowMeemTaqlil);
      const nunSakin = u.ch === 'ن' && k > 0 && (hasAny(u, SUKUN) || isBare(u)) && !isMuqattaat;
      if (u.ch === 'ن' && k > 0 && smallMeem) push('iqlab', k);
      else if (tanwinPlain || tanwinSeq || (smallMeem && u.ch !== 'ن')) {
        // the tanwīn's "next letter" is the first letter of the next word (an alif carrier may follow in this word)
        const nl = nextLetter?.ch;
        if (smallMeem) push('iqlab', k);
        else if (tanwinPlain && nl) push('izhar', k);
        else if (tanwinSeq && nl) {
          if ('ينمو'.includes(nl)) push('idgham_ghunnah', k);
          else if ('لر'.includes(nl)) push('idgham_no_ghunnah', k);
          else if (nl === 'ب') push('iqlab', k);
          else push('ikhfa', k);
        }
      } else if (nunSakin) {
        if (hasAny(u, SUKUN)) {
          if (nextCh) push('izhar', k);
        } else if (nextCh) {
          if ('ينمو'.includes(nextCh)) push('idgham_ghunnah', k);
          else if ('لر'.includes(nextCh)) push('idgham_no_ghunnah', k);
          else if (nextCh === 'ب') push('iqlab', k);
          else if (!THROAT.has(nextCh)) push('ikhfa', k);
        }
      }

      // ---- mīm sākinah ---------------------------------------------------------------------
      if (u.ch === 'م' && k > 0 && !has(u, SHADDA)) {
        if (hasAny(u, SUKUN)) {
          if (nextCh) push('mim_izhar', k);
        } else if (k === last && isBare(u) && nextLetter) {
          if (nextLetter.ch === 'ب') push('mim_ikhfa', k);
          else if (nextLetter.ch === 'م') push('mim_idgham', k);
        }
      }

      // ---- ghunnah on a doubled ن / م ----------------------------------------------------
      if ((u.ch === 'ن' || u.ch === 'م') && has(u, SHADDA)) push('ghunnah', k);

      // ---- qalqalah -----------------------------------------------------------------------
      if (QALQALAH.has(u.ch) && hasAny(u, SUKUN)) push('qalqalah', k);

      // ---- madd -----------------------------------------------------------------------------
      const prev = us[k - 1];
      const prevH = prev ? haraka(prev) : undefined;
      const isMaddLetter =
        !isMuqattaat &&
        !has(u, SHADDA) &&
        !hasAny(u, SUKUN) &&
        ((isAlif(u) && !haraka(u) && prevH === FATHA && k > 0) ||
          (u.ch === 'و' && !haraka(u) && prevH === DAMMA) ||
          (u.ch === 'ي' && !haraka(u) && prevH === KASRA) ||
          (isAlif(u) && has(u, MADDA) && k > 0));
      if (has(u, DAGGER) && !isMuqattaat) {
        // dagger alif: a two-count madd carried on this letter; with a madd sign it behaves like an alif
        if (has(u, MADDA)) {
          if (nextCh && HAMZA.has(nextCh) && nextInWord) push('madd_muttasil', k, { length: 4 });
          else if (nextLetter && !nextInWord && HAMZA.has(nextLetter.ch)) push('madd_munfasil', k, { length: 2, detail: 'حركتان عند الدوري (أو أربع)' });
          else push('madd_tabii', k, { length: 2 });
        } else push('madd_tabii', k, { length: 2 });
      } else if (isMaddLetter) {
        if (has(u, MADDA)) {
          if (nextInWord && HAMZA.has(nextInWord.ch)) push('madd_muttasil', k, { length: 4 });
          else if (nextInWord && (has(nextInWord, SHADDA) || hasAny(nextInWord, SUKUN))) push('madd_lazim', k, { length: 6 });
          else if (!nextInWord && nextLetter && HAMZA.has(nextLetter.ch)) push('madd_munfasil', k, { length: 2, detail: 'حركتان عند الدوري (أو أربع)' });
          else push('madd_tabii', k, { length: 2 });
        } else if (isVerseEnd && k === last - 1) push('madd_arid', k, { length: 2, detail: 'حركتان أو أربع أو ست عند الوقف' });
        else push('madd_tabii', k, { length: 2 });
      } else if (isMuqattaat && has(u, MADDA)) push('madd_lazim', k, { length: 6, detail: 'حروف أوائل السور' });

      // hāʾ al-ḍamīr with a small wāw / yāʾ
      if (u.ch === 'ه' && (has(u, SMALL_WAW) || has(u, SMALL_YA))) push('madd_silah', k, { length: 2 });

      // ---- Dūrī features --------------------------------------------------------------------
      if (has(u, IMALAH) && !(isAlif(u) && k <= 1 && !us.slice(0, k).some((p) => p.ch !== 'و' && p.ch !== 'ف' && p.ch !== 'ب' && p.ch !== 'ك' && p.ch !== 'ل'))) pushDuri('imalah', k); // the same rhombus sits under a verb's hamzat al-waṣl (اُ۪هۡدِنَا)
      if (lowMeemTaqlil) pushDuri('taqlil', k, { detail: 'علامة في مصحف الدوري تحت ذوات الياء؛ المحتوى يذكر أنها تُنطق ألفاً عادية — يُراجع' });
      if (has(u, WASL_OR_TASHIL) && isAlif(u) && k > 0) pushDuri('tashil', k, { detail: 'نصف همزة' });
      if (k === 0 && HAMZA.has(u.ch) && has(u, DAGGER) && has(u, ZERO)) pushDuri('tashil', k, { detail: 'نصف همزة مع ألف بينهما' });
      if (HAMZA.has(u.ch) && hasAny(u, SUKUN)) pushDuri('hamza_sakin', k);
      if (u.ch !== 'ه' && has(u, SMALL_YA) && k === last) pushDuri('ya_zaida', k);
      if (u.ch === 'ه' && k === last && hasAny(u, SUKUN)) pushDuri('ha_damir', k);
      if (u.ch === 'ي' && k === last && haraka(u) === FATHA && nextLetter && !nextInWord && HAMZA.has(nextLetter.ch)) pushDuri('ya_fath', k);
      if (k === last && isBare(u) && u.ch !== 'ن' && u.ch !== 'م' && !isAlif(u) && u.ch !== 'و' && u.ch !== 'ي' && nextLetter && has(nextLetter, SHADDA)) pushDuri('idgham_duri', k);

      // ---- waqf signs -----------------------------------------------------------------------
      for (const m of u.marks) if (WAQF[m]) push('waqf_sign', k, { detail: WAQF[m] });
    }

    // qalqalah when stopping on the verse-final word
    if (isVerseEnd) {
      const lastConsonant = [...us].reverse().find((u) => !(isAlif(u) && isBare(u)) && !hasAny(u, TANWIN_PLAIN) && !hasAny(u, TANWIN_SEQ)) ?? us[last];
      if (QALQALAH.has(lastConsonant.ch) && !hasAny(lastConsonant, SUKUN)) push('qalqalah', us.indexOf(lastConsonant), { detail: 'عند الوقف' });
      const u = us[last];
      let detail = 'تسكّن آخر الكلمة';
      if (u.ch === 'ة') detail = 'تقف بالهاء الساكنة';
      else if (isAlif(u) && us[last - 1] && (hasAny(us[last - 1], TANWIN_PLAIN) || hasAny(us[last - 1], TANWIN_SEQ) || (haraka(us[last - 1]) === FATHA && hasAny(us[last - 1], SMALL_MEEM)))) detail = 'تنوين الفتح يصير ألفاً';
      else if (hasAny(u, TANWIN_PLAIN) || hasAny(u, TANWIN_SEQ)) detail = 'يسقط التنوين وتسكّن';
      push('waqf_end', last, { detail });
    }

    // word-list Dūrī iskān
    const sk = skeleton(words[wi]);
    if (ISKAN_WORDS.has(sk) && us.some((u) => (u.ch === 'ئ' || u.ch === 'ر' || u.ch === 'أ') && hasAny(u, SUKUN))) {
      const idx = us.findIndex((u) => (u.ch === 'ئ' || u.ch === 'ر') && hasAny(u, SUKUN));
      pushDuri('iskan', idx < 0 ? last : idx);
    }

    // comparisons with Ḥafṣ
    const h = hafs?.[wi];
    if (h) {
      if (h.includes(SAKT_HAFS)) pushDuri('no_sakt', last, { detail: 'حفص يسكت هنا؛ الدوري يصل' });
      if (!duriTagged.has('tashil') && hamzaCount(h) > hamzaCount(words[wi])) pushDuri('isqat', 0, { detail: `حفص: ${h}` });
      if (!duriTagged.size && (readingForm(h) !== readingForm(words[wi]) || hamzaCount(h) !== hamzaCount(words[wi]))) pushDuri('farsh', 0, { detail: `حفص: ${h}` });
    }
  }
  return tags;
}

/** Tags grouped by word. */
export function tagsByWord(tags: Tag[], nWords: number): Tag[][] {
  const out: Tag[][] = Array.from({ length: nWords }, () => []);
  for (const t of tags) out[t.word]?.push(t);
  return out;
}

/** Tags a learner should be quizzed on (the noisy always-present ones are left out). */
export const QUIZ_RULES: RuleId[] = [
  'izhar', 'idgham_ghunnah', 'idgham_no_ghunnah', 'iqlab', 'ikhfa',
  'mim_ikhfa', 'mim_idgham', 'mim_izhar', 'ghunnah', 'qalqalah',
  'madd_muttasil', 'madd_munfasil', 'madd_lazim', 'madd_arid',
  'imalah', 'tashil', 'isqat', 'ya_zaida', 'idgham_duri',
];
