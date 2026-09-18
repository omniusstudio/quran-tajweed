// The Hijri date, from the browser's own Umm al-Qura calendar (Intl), with a ±2-day adjustment for
// places that follow a local moon sighting. The Hijri day begins at sunset; here a Gregorian day is
// paired with the Hijri date of its daytime, as printed calendars do.

export interface HijriDate {
  year: number;
  /** 1 = Muḥarram … 12 = Dhū al-Ḥijjah */
  month: number;
  day: number;
}

export const HIJRI_MONTHS = ['محرّم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوّال', 'ذو القعدة', 'ذو الحجة'];
export const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const GREG_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

const FMT = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** Noon UTC of a local calendar day, so time zones and daylight saving never shift the date. */
function anchor(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12));
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Hijri date of a local calendar day; `offset` shifts it (in days) to follow a local sighting. */
export function toHijri(d: Date, offset = 0): HijriDate {
  const parts = FMT.formatToParts(anchor(addDays(d, offset)));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { year: get('year'), month: get('month'), day: get('day') };
}

/** The Gregorian day on which a Hijri month starts (searching around a day known to be in or near it). */
export function monthStart(near: Date, offset = 0): Date {
  const h = toHijri(near, offset);
  return addDays(near, -(h.day - 1));
}

export interface MonthDay {
  date: Date;
  hijri: HijriDate;
}

/** Every day of the Hijri month that contains `near`. */
export function monthDays(near: Date, offset = 0): MonthDay[] {
  const first = monthStart(near, offset);
  const month = toHijri(first, offset).month;
  const out: MonthDay[] = [];
  for (let i = 0; i < 31; i++) {
    const date = addDays(first, i);
    const hijri = toHijri(date, offset);
    if (hijri.month !== month) break;
    out.push({ date, hijri });
  }
  return out;
}

/** A day in the next / previous Hijri month. */
export function shiftMonth(near: Date, by: 1 | -1, offset = 0): Date {
  const first = monthStart(near, offset);
  return by === 1 ? addDays(first, monthDays(near, offset).length) : addDays(first, -1);
}

const AR = '٠١٢٣٤٥٦٧٨٩';
const ar = (n: number) => String(n).replace(/\d/g, (c) => AR[Number(c)]);

export function formatHijri(h: HijriDate): string {
  return `${ar(h.day)} ${HIJRI_MONTHS[h.month - 1]} ${ar(h.year)} هـ`;
}

export function formatGregorian(d: Date): string {
  return `${ar(d.getDate())} ${GREG_MONTHS[d.getMonth()]} ${ar(d.getFullYear())}`;
}
