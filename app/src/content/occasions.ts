// What a day is in the Hijri year: the two ʿĪds, the fasting days, the seasons of worship, Friday.
// Every occasion points at hadith passages in hadith.json (cut from the published collections by
// scripts/fetch_hadith.py, never typed here) and lists what to do in plain words.
// TODO(scholar): the "what to do" lines are common practice stated briefly; have them reviewed.
// Left out on purpose: days whose observance is disputed (the mawlid, 27 Rajab, mid-Shaʿbān).

import HADITH from './hadith.json';
import { addDays, toHijri, type HijriDate } from './hijri';

export interface Hadith {
  text: string;
  source: string;
  grade?: string;
  /** Not checked against a published edition: shown with the يُراجع badge. */
  review?: boolean;
}

const EXTRA: Record<string, Hadith> = {
  // Not in the six books the script reads, so typed here and flagged. TODO(scholar): confirm wording and grading.
  kahf_friday: { text: 'مَنْ قَرَأَ سُورَةَ الْكَهْفِ فِي يَوْمِ الْجُمُعَةِ أَضَاءَ لَهُ مِنَ النُّورِ مَا بَيْنَ الْجُمُعَتَيْنِ', source: 'المستدرك للحاكم، وصححه الألباني في صحيح الجامع ٦٤٧٠', review: true },
};

export function hadith(id: string): Hadith | undefined {
  return (HADITH as Record<string, Hadith>)[id] ?? EXTRA[id];
}

export type OccasionKind = 'eid' | 'fast' | 'season' | 'friday' | 'night' | 'marker';
export type Fasting = 'recommended' | 'obligatory' | 'forbidden';

export interface Occasion {
  id: string;
  title: string;
  kind: OccasionKind;
  /** One line: why the day matters. */
  why: string;
  hadith: string[];
  /** What to do, plainly. */
  actions: string[];
  fasting?: Fasting;
  /** Worth a reminder days ahead (the weekly ones are not). */
  major?: boolean;
  /** Sūrahs tied to the day: [sūrah number, label]. */
  surahs?: [number, string][];
}

/** Everything that applies to a day, most important first. `weekday`: 0 = Sunday … 6 = Saturday. */
export function occasionsOn(h: HijriDate, weekday: number): Occasion[] {
  const out: Occasion[] = [];
  const { month: m, day: d } = h;
  const eidFitr = m === 10 && d === 1;
  const eidAdha = m === 12 && d === 10;
  const tashriq = m === 12 && d >= 11 && d <= 13;
  const ramadan = m === 9;
  const noFast = eidFitr || eidAdha || tashriq;

  if (eidFitr) out.push({ id: 'eid_fitr', title: 'عيد الفطر', kind: 'eid', major: true, fasting: 'forbidden', why: 'يوم فرح المسلمين بإتمام صيام رمضان، وصيامه محرّم.', hadith: ['eid_no_fast'], actions: ['أخرج زكاة الفطر قبل صلاة العيد', 'كبّر من غروب شمس آخر رمضان حتى صلاة العيد', 'كُل تمرات وتراً قبل الخروج، واغتسل والبس أحسن ثيابك', 'صلِّ صلاة العيد، وصِل رحمك وهنّئ من تلقى'] });
  if (eidAdha) out.push({ id: 'eid_adha', title: 'عيد الأضحى (يوم النحر)', kind: 'eid', major: true, fasting: 'forbidden', why: 'أعظم أيام السنة، يوم الحج الأكبر، وصيامه محرّم.', hadith: ['eid_no_fast'], actions: ['صلِّ صلاة العيد، ولا تأكل حتى ترجع فتأكل من أضحيتك إن ضحّيت', 'اذبح أضحيتك بعد الصلاة، وكُل منها وتصدّق وأهدِ', 'كبّر عقب الصلوات إلى عصر آخر أيام التشريق'] });
  if (tashriq) out.push({ id: 'tashriq', title: `أيام التشريق (اليوم ${['الأول', 'الثاني', 'الثالث'][d - 11]})`, kind: 'eid', fasting: 'forbidden', why: 'أيام أكل وشرب وذكر لله، ولا تُصام.', hadith: ['tashriq'], actions: ['كبّر عقب الصلوات', 'وقت الأضحية ممتد إلى غروب شمس الثالث عشر', 'أكثر من ذكر الله'] });

  if (m === 12 && d === 9) out.push({ id: 'arafah', title: 'يوم عرفة', kind: 'fast', major: true, fasting: 'recommended', why: 'صيامه لغير الحاج يكفّر سنتين، وهو خير يوم للدعاء.', hadith: ['arafah', 'arafah_dua'], actions: ['صُم إن لم تكن حاجاً', 'أكثر من الدعاء، وخيره ما في الحديث أدناه', 'ابدأ التكبير المقيّد عقب الصلوات من فجر اليوم'] });
  if (m === 12 && d >= 1 && d <= 8) out.push({ id: 'ten_days', title: `عشر ذي الحجة (اليوم ${['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن'][d - 1]})`, kind: 'season', major: d === 1, fasting: 'recommended', why: 'العمل الصالح فيها أحب إلى الله منه في سائر الأيام.', hadith: ['ten_days'], actions: ['أكثر من التكبير والتهليل والتحميد', 'صُم ما تيسر من الأيام التسعة', 'إن أردت الأضحية فلا تأخذ من شعرك وأظفارك حتى تضحّي', 'تصدّق، واقرأ القرآن، وحافظ على الصلوات في وقتها'] });

  if (m === 1 && d === 10) out.push({ id: 'ashura', title: 'يوم عاشوراء', kind: 'fast', major: true, fasting: 'recommended', why: 'يوم نجّى الله فيه موسى وقومه، وصيامه يكفّر سنة.', hadith: ['ashura', 'ashura_musa'], actions: ['صُم اليوم', 'صُم معه التاسع (أو الحادي عشر) مخالفةً لليهود'] });
  if (m === 1 && d === 9) out.push({ id: 'tasua', title: 'تاسوعاء', kind: 'fast', major: true, fasting: 'recommended', why: 'عزم النبي ﷺ على صيامه مع عاشوراء.', hadith: ['tasua'], actions: ['صُم اليوم وغداً (عاشوراء)'] });
  if (m === 1 && d === 1) out.push({ id: 'new_year', title: 'أول السنة الهجرية', kind: 'marker', major: true, why: 'بداية عام هجري جديد. لم يرد فيه عبادة مخصوصة؛ وشهر المحرّم كله موسم صيام.', hadith: ['muharram'], actions: ['حاسب نفسك على ما مضى، واعزم على الخير فيما يأتي', 'أكثر من الصيام في المحرّم'] });
  else if (m === 1 && d !== 9 && d !== 10) out.push({ id: 'muharram', title: 'شهر الله المحرّم', kind: 'season', fasting: 'recommended', why: 'أفضل الصيام بعد رمضان.', hadith: ['muharram'], actions: ['أكثر من الصيام هذا الشهر'] });

  if (ramadan) {
    const last = d >= 20;
    out.push({ id: 'ramadan', title: last && d >= 21 ? 'رمضان: العشر الأواخر' : 'رمضان', kind: 'season', major: d === 1, fasting: 'obligatory', why: 'شهر الصيام والقرآن.', hadith: last ? ['ramadan_fast', 'qadr_qiyam'] : ['ramadan_fast', 'sahur'], actions: ['صُم، وتسحّر ولو بشربة ماء', 'اقرأ وردك من القرآن', 'صلِّ التراويح', ...(last ? ['اجتهد في الليل أكثر مما قبله'] : [])] });
    // the night that begins at this day's sunset belongs to tomorrow's date
    if (d >= 20 && d <= 28 && (d + 1) % 2 === 1) out.push({ id: 'qadr', title: `الليلة ليلة ${d + 1}: من أوتار العشر الأواخر`, kind: 'night', why: 'ليلة القدر تُلتمس في أوتار العشر الأواخر.', hadith: ['qadr_odd', 'qadr_qiyam', 'qadr_dua'], actions: ['أحيِ الليلة بالصلاة والقرآن والدعاء', 'أكثر من الدعاء الوارد في حديث عائشة أدناه'], surahs: [[97, 'سورة القدر']] });
  }
  if (m === 10 && d >= 2) out.push({ id: 'shawwal', title: 'ست من شوال', kind: 'fast', major: d === 2, fasting: 'recommended', why: 'من أتبع رمضان بست من شوال فكأنما صام الدهر.', hadith: ['shawwal_six'], actions: ['صُم ستة أيام من شوال، متتابعة أو متفرقة', 'ابدأ بقضاء ما عليك من رمضان إن كان عليك قضاء'] });
  if (m === 8) out.push({ id: 'shaban', title: 'شعبان', kind: 'season', major: d === 1, fasting: 'recommended', why: 'كان النبي ﷺ يكثر الصيام فيه استعداداً لرمضان.', hadith: ['shaban'], actions: ['أكثر من الصيام', 'اقضِ ما بقي عليك من رمضان الماضي', 'هيّئ وردك من القرآن لرمضان'] });

  if (!ramadan && !noFast && d >= 13 && d <= 15) out.push({ id: 'white', title: `الأيام البيض (${['الثالث عشر', 'الرابع عشر', 'الخامس عشر'][d - 13]})`, kind: 'fast', fasting: 'recommended', why: 'صيام ثلاثة أيام من كل شهر كصيام الدهر، وأفضلها البيض.', hadith: ['white_days'], actions: ['صُم اليوم'] });
  if (!ramadan && !noFast && (weekday === 1 || weekday === 4)) out.push({ id: weekday === 1 ? 'monday' : 'thursday', title: weekday === 1 ? 'صيام الاثنين' : 'صيام الخميس', kind: 'fast', fasting: 'recommended', why: 'تُعرض الأعمال يومي الاثنين والخميس.', hadith: weekday === 1 ? ['mon_thu', 'monday_born'] : ['mon_thu'], actions: ['صُم اليوم إن استطعت'] });
  if (weekday === 5) out.push({ id: 'friday', title: 'يوم الجمعة', kind: 'friday', why: 'خير يوم طلعت عليه الشمس.', hadith: ['friday_best', 'kahf_friday', 'friday_salawat', 'friday_hour', 'friday_ghusl'], actions: ['اقرأ سورة الكهف', 'أكثر من الصلاة على النبي ﷺ', 'اغتسل وتطيّب وبكّر إلى صلاة الجمعة', 'تحرَّ ساعة الإجابة بالدعاء، وأرجاها آخر ساعة بعد العصر'], surahs: [[18, 'سورة الكهف']] });
  return out;
}

/** The fasting ruling for the day, the strongest one that applies. */
export function fastingOn(list: Occasion[]): Fasting | undefined {
  const all = list.map((o) => o.fasting).filter(Boolean) as Fasting[];
  return all.includes('forbidden') ? 'forbidden' : all.includes('obligatory') ? 'obligatory' : all.includes('recommended') ? 'recommended' : undefined;
}

export interface Upcoming {
  date: Date;
  hijri: HijriDate;
  inDays: number;
  occasion: Occasion;
}

/** Major occasions in the coming days (each once, on its first day), nearest first. */
export function upcoming(from: Date, days = 40, offset = 0): Upcoming[] {
  const out: Upcoming[] = [];
  const seen = new Set<string>();
  for (let i = 1; i <= days; i++) {
    const date = addDays(from, i);
    const hijri = toHijri(date, offset);
    for (const o of occasionsOn(hijri, date.getDay())) {
      if (!o.major || seen.has(o.id)) continue;
      seen.add(o.id);
      out.push({ date, hijri, inDays: i, occasion: o });
    }
  }
  return out;
}
