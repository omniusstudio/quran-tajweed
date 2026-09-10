// Qur'anic supplications for the daily card: references only (sūrah, Kūfī verse range), resolved
// against the bundled muṣḥaf so the text is never typed here. `key` is a bare word that must occur
// in the resolved verses (Uthmani spelling, no dagger alif); the test checks it, because the
// Baṣrī↔Kūfī match can slip.

import { SURAH_BY_NUMBER, bare } from '../audio/quran';

export interface DuaRef {
  surah: number;
  /** Kūfī verse numbers, inclusive. */
  from: number;
  to: number;
  key: string;
  /** Who said it / when, one short line (plain, not scholarship). */
  note: string;
}

export const DUAS: DuaRef[] = [
  { surah: 1, from: 5, to: 7, key: 'اهدنا', note: 'دعاء الفاتحة الذي نكرره في كل صلاة' },
  { surah: 2, from: 127, to: 128, key: 'تقبل', note: 'إبراهيم وإسماعيل عليهما السلام عند رفع البيت' },
  { surah: 2, from: 201, to: 201, key: 'حسنة', note: 'أجمع دعاء لخيري الدنيا والآخرة' },
  { surah: 2, from: 250, to: 250, key: 'صبرا', note: 'جنود طالوت عند لقاء العدو' },
  { surah: 2, from: 286, to: 286, key: 'تؤاخذنا', note: 'خاتمة البقرة' },
  { surah: 3, from: 8, to: 9, key: 'تزغ', note: 'الراسخون في العلم' },
  { surah: 3, from: 16, to: 16, key: 'ذنوبنا', note: 'دعاء المتقين' },
  { surah: 3, from: 38, to: 38, key: 'ذرية', note: 'زكريا عليه السلام' },
  { surah: 3, from: 147, to: 147, key: 'إسرافنا', note: 'الربيون الذين قاتلوا مع الأنبياء' },
  { surah: 3, from: 191, to: 194, key: 'بطلا', note: 'أولو الألباب' },
  { surah: 7, from: 23, to: 23, key: 'ظلمنا', note: 'آدم وحواء عليهما السلام' },
  { surah: 7, from: 126, to: 126, key: 'مسلمين', note: 'سحرة فرعون بعد إيمانهم' },
  { surah: 10, from: 85, to: 86, key: 'فتنة', note: 'قوم موسى عليه السلام' },
  { surah: 12, from: 101, to: 101, key: 'مسلما', note: 'يوسف عليه السلام' },
  { surah: 14, from: 40, to: 41, key: 'الصلوة', note: 'إبراهيم عليه السلام' },
  { surah: 17, from: 24, to: 24, key: 'ارحمهما', note: 'دعاء للوالدين' },
  { surah: 17, from: 80, to: 80, key: 'صدق', note: 'أُمر به النبي ﷺ' },
  { surah: 18, from: 10, to: 10, key: 'رشدا', note: 'أصحاب الكهف' },
  { surah: 20, from: 25, to: 28, key: 'صدري', note: 'موسى عليه السلام حين كُلّف' },
  { surah: 20, from: 114, to: 114, key: 'علما', note: 'رب زدني علما' },
  { surah: 21, from: 83, to: 83, key: 'الضر', note: 'أيوب عليه السلام' },
  { surah: 21, from: 87, to: 87, key: 'الظلمين', note: 'ذو النون في بطن الحوت' },
  { surah: 21, from: 89, to: 89, key: 'فردا', note: 'زكريا عليه السلام' },
  { surah: 23, from: 97, to: 98, key: 'همزت', note: 'الاستعاذة من الشياطين' },
  { surah: 23, from: 109, to: 109, key: 'الرحمين', note: 'عباد الله الصالحون' },
  { surah: 23, from: 118, to: 118, key: 'وارحم', note: 'خاتمة المؤمنون' },
  { surah: 25, from: 65, to: 66, key: 'غراما', note: 'عباد الرحمن' },
  { surah: 25, from: 74, to: 74, key: 'أعين', note: 'عباد الرحمن' },
  { surah: 26, from: 83, to: 85, key: 'حكما', note: 'إبراهيم عليه السلام' },
  { surah: 27, from: 19, to: 19, key: 'أوزعني', note: 'سليمان عليه السلام' },
  { surah: 28, from: 16, to: 16, key: 'ظلمت', note: 'موسى عليه السلام' },
  { surah: 28, from: 24, to: 24, key: 'فقير', note: 'موسى عليه السلام عند ماء مدين' },
  { surah: 37, from: 100, to: 100, key: 'الصلحين', note: 'إبراهيم عليه السلام يسأل الولد' },
  { surah: 40, from: 7, to: 9, key: 'وسعت', note: 'دعاء حملة العرش للمؤمنين' },
  { surah: 46, from: 15, to: 15, key: 'أوزعني', note: 'من بلغ الأربعين' },
  { surah: 59, from: 10, to: 10, key: 'غلا', note: 'الذين جاؤوا من بعد الصحابة' },
  { surah: 60, from: 4, to: 5, key: 'توكلنا', note: 'إبراهيم عليه السلام ومن معه' },
  { surah: 66, from: 8, to: 8, key: 'نورنا', note: 'المؤمنون يوم القيامة' },
  { surah: 66, from: 11, to: 11, key: 'بيتا', note: 'امرأة فرعون' },
  { surah: 71, from: 28, to: 28, key: 'ولولدي', note: 'نوح عليه السلام' },
];

export interface Dua {
  ref: DuaRef;
  surahName: string;
  /** Baṣrī numbers of the resolved verses. */
  verses: number[];
  text: string;
}

/** Resolve a reference against the muṣḥaf (Kūfī → the Baṣrī verses that carry those ayahs). */
export function resolveDua(ref: DuaRef): Dua | null {
  const s = SURAH_BY_NUMBER[ref.surah];
  if (!s) return null;
  const vs = s.verses.filter((v) => v.kufi !== null && v.kufi >= ref.from && v.kufi <= ref.to);
  if (!vs.length) return null;
  return { ref, surahName: s.name, verses: vs.map((v) => v.basri), text: vs.map((v) => v.words.join(' ')).join(' ') };
}

export function duaMatches(d: Dua): boolean {
  return bare(d.text).includes(bare(d.ref.key));
}

/** The day's supplication: one after another, a new one each day. */
export function duaOfDay(today = new Date()): Dua | null {
  const day = Math.floor((today.getTime() - today.getTimezoneOffset() * 60000) / 86400000);
  for (let k = 0; k < DUAS.length; k++) {
    const d = resolveDua(DUAS[(day + k) % DUAS.length]);
    if (d && duaMatches(d)) return d;
  }
  return null;
}
