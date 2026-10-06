// تحصين البيت: the sūrahs and āyāt the Sunnah ties to a protected home, read aloud in sequence in
// the reciter's voice. Only what a ṣaḥīḥ narration says, and the narration is shown with each item
// (hadith.json, cut from the collections by scripts/fetch_hadith.py). Nothing here is a custom
// without a text: no "corners of the house", no set number of days.

import { SURAH_BY_NUMBER } from '../audio/quran';
import DATA from './adhkar.json';

export interface TahsinItem {
  id: string;
  title: string;
  /** One line: what the text says it does. */
  why: string;
  hadith: string[];
  surah: number;
  /** Kūfī verse numbers, inclusive; absent = the whole sūrah. */
  from?: number;
  to?: number;
  /** Times to read it in one program. */
  repeat: number;
}

export interface Program {
  id: 'daily' | 'baqarah';
  title: string;
  blurb: string;
  /** Rough length for the card. */
  minutes: number;
  items: TahsinItem[];
}

export const PROGRAMS: Program[] = [
  {
    id: 'daily',
    title: 'التحصين اليومي',
    blurb: 'آية الكرسي، وخاتمة البقرة، والإخلاص والمعوذتان ثلاثاً. نحو عشر دقائق.',
    minutes: 10,
    items: [
      { id: 'kursi', title: 'آية الكرسي', why: 'من قرأها لم يزل عليه من الله حافظ ولا يقربه شيطان.', hadith: ['kursi_sleep'], surah: 2, from: 255, to: 255, repeat: 1 },
      { id: 'baqarah_end', title: 'خاتمة سورة البقرة', why: 'الآيتان من آخر البقرة: من قرأهما في ليلة كفتاه.', hadith: ['baqarah_last_two'], surah: 2, from: 285, to: 286, repeat: 1 },
      { id: 'ikhlas', title: 'سورة الإخلاص', why: 'مع المعوذتين ثلاث مرات: تكفيك من كل شيء.', hadith: ['quls_morning_evening', 'quls_sleep'], surah: 112, repeat: 3 },
      { id: 'falaq', title: 'سورة الفلق', why: 'الاستعاذة من شر ما خلق، ومن الحاسد إذا حسد.', hadith: ['quls_morning_evening'], surah: 113, repeat: 3 },
      { id: 'nas', title: 'سورة الناس', why: 'الاستعاذة من الوسواس الخناس، من الجنة والناس.', hadith: ['quls_morning_evening'], surah: 114, repeat: 3 },
    ],
  },
  {
    id: 'baqarah',
    title: 'سورة البقرة كاملة',
    blurb: 'الشيطان ينفر من البيت الذي تُقرأ فيه سورة البقرة. نحو ساعتين؛ اتركها تُتلى في البيت.',
    minutes: 126,
    items: [{ id: 'baqarah', title: 'سورة البقرة', why: 'البيت الذي تُقرأ فيه البقرة ينفر منه الشيطان.', hadith: ['baqarah_home'], surah: 2, repeat: 1 }],
  },
];

/** The dhikr on entering the home, from Ḥiṣn al-Muslim (adhkar.json, chapter 11). */
export const ENTER_HOME: { body: string; hadith: string } = { body: ((DATA.sets as Record<string, { body?: string }[]>).home?.[0]?.body) ?? '', hadith: 'enter_home' };

export interface Resolved {
  item: TahsinItem;
  surahName: string;
  /** Baṣrī verse numbers carrying the passage (all of them for a whole sūrah). */
  verses: number[];
  text: string;
  whole: boolean;
}

export function resolveItem(item: TahsinItem): Resolved | null {
  const s = SURAH_BY_NUMBER[item.surah];
  if (!s) return null;
  const vs = item.from ? s.verses.filter((v) => v.kufi !== null && v.kufi >= item.from! && v.kufi <= (item.to ?? item.from!)) : s.verses;
  if (!vs.length) return null;
  return { item, surahName: s.name, verses: vs.map((v) => v.basri), text: vs.map((v) => v.words.join(' ')).join(' ۝ '), whole: !item.from };
}
