import duri from '../content/duri_v1.json';
import recitersJson from '../content/reciters.json';

export interface Verse {
  basri: number;
  kufi: number | null;
  text: string;
  words: string[];
  /** Ḥafṣ counterpart per word (null when unaligned). */
  hafs: (string | null)[];
}
export interface Surah {
  number: number;
  name: string;
  header: string | null;
  verses: Verse[];
}
export interface Reciter {
  id: string;
  nameAr: string;
  nameEn: string;
  note: string;
  server: string;
  credit: string;
}

export const SURAHS: Surah[] = (duri as { surahs: Surah[] }).surahs;
export const SURAH_BY_NUMBER: Record<number, Surah> = Object.fromEntries(SURAHS.map((s) => [s.number, s]));
export const RECITERS: Reciter[] = (recitersJson as { reciters: Reciter[] }).reciters;
export const DEFAULT_RECITER: string = (recitersJson as { default: string }).default;

/** Local (build-time cached) audio file for a reciter's sūrah — never hot-linked. */
export function audioUrl(reciter: string, surah: number): string {
  return `${import.meta.env.BASE_URL}audio/${reciter}/${String(surah).padStart(3, '0')}.mp3`;
}

// ---- Dūrī muṣḥaf notation (PROMPT.md §4) ---------------------------------------------------
export const IMALAH_MARK = '۪'; // rhombus under the imāled letter
export const TASHIL_MARK = '۬'; // tas-hīl dot
export const SUKUN = 'ۡ';
export const MADD_SIGN = 'ٓ';
export const SHADDA = 'ّ';

const HARAKAT = /[ً-ْٓ-ٰٟۖ-ۭ]/g;

/** Bare letters of a word (no diacritics, no small signs). */
export function bare(word: string): string {
  return word.replace(HARAKAT, '');
}

/**
 * Rough per-word cues for the follow-along indicators until the rule tagger (M4) replaces them:
 * madd count from the muṣḥaf's own signs, and ghunnah from a shaddah on ن or م.
 */
export function wordCues(word: string): { madd: 0 | 2 | 4 | 6; ghunnah: boolean; imalah: boolean; tashil: boolean } {
  const imalah = word.includes(IMALAH_MARK) && !/^[وفبكل]?[َُِ]?ا[َُِ]?۪/.test(word); // the rhombus also marks a verb's waṣl alif
  const tashil = word.includes(TASHIL_MARK);
  const ghunnah = /[نم][\u064B-\u0652]*\u0651/.test(word); // shaddah on ن or م (a vowel may sit before the shaddah in the encoding)
  let madd: 0 | 2 | 4 | 6 = 0;
  if (word.includes(MADD_SIGN)) madd = 4; // muttaṣil / munfaṣil / lāzim: length decided by the tagger later
  else if (/[َ]ا|[َ]ٰ|[ُ]و(?![َُِّ])|[ِ]ي(?![َُِّ])/.test(word)) madd = 2;
  return { madd, ghunnah, imalah, tashil };
}
