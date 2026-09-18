// Morning, evening, sleep and waking adhkār. The wording lives in adhkar.json, written by
// scripts/fetch_adhkar.py from Ḥiṣn al-Muslim; Qur'anic items are references into the muṣḥaf.

import DATA from './adhkar.json';
import { SURAH_BY_NUMBER } from '../audio/quran';

export type AdhkarSet = 'morning' | 'evening' | 'sleep' | 'waking';

export interface QuranRef {
  surah: number;
  /** Kūfī verse numbers, inclusive; absent = the whole sūrah. */
  from?: number;
  to?: number;
}
export interface Dhikr {
  id: number;
  repeat: number;
  body?: string;
  notes?: string[];
  when?: 'morning' | 'evening';
  quran?: QuranRef[];
  linkOnly?: boolean;
  lead?: string;
}

export const ADHKAR_SOURCE: string = DATA.source;
export const SET_TITLES: Record<AdhkarSet, string> = { morning: 'أذكار الصباح', evening: 'أذكار المساء', sleep: 'أذكار النوم', waking: 'أذكار الاستيقاظ' };
export const SET_HINT: Record<AdhkarSet, string> = {
  morning: 'من طلوع الفجر إلى طلوع الشمس، ويمتد وقتها إلى الضحى',
  evening: 'من العصر إلى غروب الشمس، ويمتد وقتها إلى الليل',
  sleep: 'حين تأوي إلى فراشك',
  waking: 'أول ما تفتح عينيك',
};

export function adhkar(set: AdhkarSet): Dhikr[] {
  const sets = DATA.sets as unknown as Record<string, Dhikr[]>;
  if (set === 'sleep' || set === 'waking') return sets[set];
  return sets.day.filter((d) => !d.when || d.when === set);
}

/** In the evening list the book's «وإذا أمسى قال …» note is the wording to say. */
export function eveningNotes(d: Dhikr): string[] {
  return (d.notes ?? []).filter((n) => n.startsWith('وإذا أمسى'));
}

export interface ResolvedRef {
  surah: number;
  surahName: string;
  /** Baṣrī verse numbers carrying the passage. */
  verses: number[];
  text: string;
  whole: boolean;
}

/** A muṣḥaf reference as Dūrī text with the Baṣrī verses that carry it. */
export function resolveRef(r: QuranRef): ResolvedRef | null {
  const s = SURAH_BY_NUMBER[r.surah];
  if (!s) return null;
  const vs = r.from ? s.verses.filter((v) => v.kufi !== null && v.kufi >= r.from! && v.kufi <= (r.to ?? r.from!)) : s.verses;
  if (!vs.length) return null;
  return { surah: s.number, surahName: s.name, verses: vs.map((v) => v.basri), text: vs.map((v) => v.words.join(' ')).join(' ۝ '), whole: !r.from };
}

/** Which set fits the hour: morning until noon, evening from mid-afternoon, sleep late at night. */
export function setForNow(now = new Date()): AdhkarSet {
  const h = now.getHours();
  if (h < 4) return 'sleep';
  if (h < 12) return 'morning';
  if (h < 15) return 'morning';
  if (h < 21) return 'evening';
  return 'sleep';
}
