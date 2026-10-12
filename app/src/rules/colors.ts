// Tajwīd colouring for the muṣḥaf, in the manner of the colour-coded prints: each letter the
// tagger puts a rule on takes the colour of that rule's family, so the reader sees how to read it.
// The palette and legend follow the familiar print (madd by length, ghunnah/ikhfāʾ, iqlāb,
// idghām and silent letters, qalqalah, heavy letters).

import { tagVerse, type RuleId, type Tag } from './tagger';

export type Tone = 'madd6' | 'madd4' | 'madd24' | 'madd1' | 'ghunnah' | 'iqlab' | 'silent' | 'qalqalah' | 'heavy';

export const TONES: { id: Tone; label: string; color: string }[] = [
  { id: 'madd6', label: 'مدّ لازم (٦ حركات)', color: '#7b1fa2' },
  { id: 'madd4', label: 'مدّ متصل (٤ حركات)', color: '#d81b60' },
  { id: 'madd24', label: 'مدّ منفصل أو عارض (٢ أو ٤ أو ٦)', color: '#ef6c00' },
  { id: 'madd1', label: 'مدّ الصلة (حركتان)', color: '#b8860b' },
  { id: 'ghunnah', label: 'غنة وإخفاء', color: '#2e7d32' },
  { id: 'iqlab', label: 'إقلاب', color: '#7cb342' },
  { id: 'silent', label: 'إدغام وحروف لا تُنطق', color: '#9e9e9e' },
  { id: 'qalqalah', label: 'قلقلة', color: '#039be5' },
  { id: 'heavy', label: 'تفخيم (الراء ولام الجلالة) — يُراجع', color: '#1565c0' },
];

const TONE_OF: Partial<Record<RuleId, Tone>> = {
  madd_lazim: 'madd6',
  madd_muttasil: 'madd4',
  madd_munfasil: 'madd24',
  madd_arid: 'madd24',
  madd_silah: 'madd1',
  ikhfa: 'ghunnah',
  ghunnah: 'ghunnah',
  mim_ikhfa: 'ghunnah',
  idgham_ghunnah: 'ghunnah',
  iqlab: 'iqlab',
  idgham_no_ghunnah: 'silent',
  mim_idgham: 'silent',
  idgham_duri: 'silent',
  qalqalah: 'qalqalah',
};

const isLetter = (c: string) => /[ء-غف-يٱ]/.test(c);
const KASRA = 'ِ';
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

/**
 * Heavy letters: rāʾ with fatḥah/ḍammah, or sākin after fatḥah/ḍammah; the lām of الله after fatḥah or
 * ḍammah. Plain rules stated briefly — TODO(scholar): the rāʾ's exceptions are not modelled.
 */
function heavyUnits(units: string[], prevWordLast?: string): Set<number> {
  const s = new Set<number>();
  const bare = units.map((u) => u.replace(/[^ء-غف-يٱ]/g, ''));
  units.forEach((u, i) => {
    const ch = u[0];
    const prev = i > 0 ? units[i - 1] : prevWordLast;
    if (ch === 'ر') {
      if (u.includes(KASRA)) return;
      if (/[َُ]/.test(u)) { s.add(i); return; }
      if (prev && !prev.includes(KASRA)) s.add(i);
    }
    if (ch === 'ل' && bare.join('') === 'الله' && i === 2) {
      if (!prev || !prev.includes(KASRA)) s.add(i);
      const p0 = prevWordLast;
      if (i === 2 && units[0][0] === 'ا' && p0 && p0.includes(KASRA)) s.delete(i);
    }
  });
  return s;
}

/** The pieces of every word of a verse, coloured; `shown` are the words as displayed (kashida included). */
export function colourVerse(words: string[], hafs: (string | null)[] | undefined, nextWord: string | null, shown: string[]): Piece[][] {
  const tags = tagVerse({ words, hafs, nextWord });
  const byWord: Tag[][] = words.map(() => []);
  for (const t of tags) byWord[t.word]?.push(t);
  return words.map((w, wi) => {
    const units = split(shown[wi] ?? w);
    const tone: (Tone | undefined)[] = units.map(() => undefined);
    const prevLast = wi > 0 ? split(words[wi - 1]).slice(-1)[0] : undefined;
    for (const i of silentUnits(units)) tone[i] = 'silent';
    for (const i of heavyUnits(units, prevLast)) tone[i] = 'heavy';
    for (const t of byWord[wi]) {
      const tn = TONE_OF[t.rule];
      if (!tn || t.unit >= units.length) continue;
      tone[t.unit] = tn;
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
