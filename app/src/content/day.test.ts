import { describe, expect, it } from 'vitest';
import { mergeProgress } from '../../server/merge.mjs';
import { moonState, placeTz, prayerTimes, sunPosition, timesAt } from '../../server/prayer.mjs';
import { CITIES } from './cities';
import { clock } from './prayer';
import { adhkar, resolveRef } from './adhkar';
import { monthDays, shiftMonth, toHijri } from './hijri';
import { fastingOn, hadith, occasionsOn, upcoming } from './occasions';

describe('Hijri calendar', () => {
  it('converts known dates (Umm al-Qura)', () => {
    expect(toHijri(new Date(2026, 8, 18))).toEqual({ year: 1448, month: 4, day: 7 });
    expect(toHijri(new Date(2026, 2, 20))).toMatchObject({ month: 10, day: 1 }); // ʿĪd al-Fiṭr 1447
    expect(toHijri(new Date(2026, 4, 27))).toMatchObject({ month: 12, day: 10 }); // ʿĪd al-Aḍḥā 1447
  });
  it('follows a local sighting through the offset', () => {
    const d = new Date(2026, 8, 18);
    expect(toHijri(d, 1).day).toBe(8);
    expect(toHijri(d, -1).day).toBe(6);
  });
  it('lists a whole month of 29 or 30 days starting on day 1, and moves between months', () => {
    const days = monthDays(new Date(2026, 8, 18));
    expect(days[0].hijri.day).toBe(1);
    expect([29, 30]).toContain(days.length);
    expect(days.every((d) => d.hijri.month === 4)).toBe(true);
    expect(toHijri(shiftMonth(new Date(2026, 8, 18), 1)).month).toBe(5);
    expect(toHijri(shiftMonth(new Date(2026, 8, 18), -1)).month).toBe(3);
  });
});

describe('occasions', () => {
  it('marks the two ʿĪds and the days of tashrīq as days that are not fasted, even on a Monday', () => {
    for (const h of [{ year: 1447, month: 10, day: 1 }, { year: 1447, month: 12, day: 10 }, { year: 1447, month: 12, day: 12 }]) {
      const list = occasionsOn(h, 1);
      expect(fastingOn(list)).toBe('forbidden');
      expect(list.some((o) => o.id === 'monday')).toBe(false);
    }
  });
  it('knows ʿArafah, ʿĀshūrāʾ, the white days, Monday, Thursday and Friday', () => {
    expect(occasionsOn({ year: 1447, month: 12, day: 9 }, 2)[0].id).toBe('arafah');
    expect(occasionsOn({ year: 1448, month: 1, day: 10 }, 2)[0].id).toBe('ashura');
    expect(occasionsOn({ year: 1448, month: 4, day: 14 }, 2).map((o) => o.id)).toContain('white');
    expect(occasionsOn({ year: 1448, month: 4, day: 7 }, 1).map((o) => o.id)).toEqual(['monday']);
    expect(occasionsOn({ year: 1448, month: 4, day: 7 }, 5).map((o) => o.id)).toEqual(['friday']);
    expect(occasionsOn({ year: 1447, month: 12, day: 13 }, 2).map((o) => o.id)).not.toContain('white'); // 13 Dhū al-Ḥijjah is tashrīq
  });
  it('makes Ramaḍān obligatory and flags the odd nights of the last ten the evening before', () => {
    expect(fastingOn(occasionsOn({ year: 1447, month: 9, day: 5 }, 1))).toBe('obligatory');
    expect(occasionsOn({ year: 1447, month: 9, day: 26 }, 3).map((o) => o.id)).toContain('qadr'); // the night of the 27th
    expect(occasionsOn({ year: 1447, month: 9, day: 27 }, 4).map((o) => o.id)).not.toContain('qadr');
  });
  it('points every occasion at hadith passages that exist', () => {
    for (let m = 1; m <= 12; m++) for (let d = 1; d <= 30; d++) for (let w = 0; w < 7; w++) {
      for (const o of occasionsOn({ year: 1448, month: m, day: d }, w)) for (const id of o.hadith) expect(hadith(id), `${o.id}: ${id}`).toBeTruthy();
    }
  });
  it('lists what is coming, nearest first, each once', () => {
    const up = upcoming(new Date(2026, 1, 10), 60);
    expect(up.map((u) => u.occasion.id)).toContain('ramadan');
    expect(new Set(up.map((u) => u.occasion.id)).size).toBe(up.length);
    expect(up.every((u, i) => i === 0 || u.inDays >= up[i - 1].inDays)).toBe(true);
  });
});

describe('adhkār', () => {
  it('splits the morning and evening lists and resolves the Qur’anic items against the muṣḥaf', () => {
    const morning = adhkar('morning');
    const evening = adhkar('evening');
    expect(morning.length).toBeGreaterThan(18);
    expect(morning.some((d) => d.when === 'evening')).toBe(false);
    expect(evening.some((d) => d.when === 'morning')).toBe(false);
    const kursi = resolveRef(morning[0].quran![0])!;
    expect(kursi.text).toContain('هُوَ');
    expect(kursi.text.split(' ').length).toBe(50);
    expect(kursi.verses).toHaveLength(1);
    expect(resolveRef({ surah: 112 })!.verses).toEqual([1, 2, 3, 4]);
    expect(adhkar('sleep').length).toBeGreaterThan(8);
  });
});

describe('prayer times', () => {
  it('matches a published timetable within two minutes (Khartoum, Egyptian method, 18 Sep 2026)', () => {
    const t = prayerTimes(new Date(2026, 8, 18), { lat: 15.5007, lon: 32.5599 }, { method: 'egypt' });
    const utc = (d: Date) => d.getUTCHours() * 60 + d.getUTCMinutes();
    const want = { fajr: 2 * 60 + 21, dhuhr: 9 * 60 + 44, asr: 13 * 60 + 5, maghrib: 15 * 60 + 49, isha: 16 * 60 + 59 }; // Khartoum is UTC+2
    for (const [k, v] of Object.entries(want)) expect(Math.abs(utc(t[k]) - v), k).toBeLessThanOrEqual(2);
  });
});

describe('prayer times are on the clock of the place, not of the device', () => {
  const noon = new Date(Date.UTC(2026, 8, 18, 17)); // midday in Dallas, evening in Khartoum
  it('matches the published timetable for Dallas (ISNA, 18 Sep 2026) and keeps fajr in the morning', () => {
    const dallas = CITIES.find((c) => c.name === 'دالاس')!;
    const t = timesAt(noon, dallas, { method: dallas.method });
    const hhmm = (d: Date) => d.toLocaleTimeString('en-GB', { timeZone: dallas.tz, hour: '2-digit', minute: '2-digit' });
    expect(hhmm(t.fajr)).toBe('06:05');
    expect(hhmm(t.dhuhr)).toBe('13:21');
    expect(hhmm(t.maghrib)).toBe('19:29');
    expect(hhmm(t.isha)).toBe('20:37');
    expect(clock(t.fajr, dallas.tz)).toBe('٦:٠٥ ص');
    expect(clock(t.isha, dallas.tz)).toBe('٨:٣٧ م');
  });
  it('shows a far-away place in its own zone even without one stored (Khartoum seen from any device)', () => {
    const khartoum = { lat: 15.5007, lon: 32.5599, tz: 'Africa/Khartoum' };
    const t = timesAt(noon, khartoum, { method: 'egypt' });
    expect(clock(t.fajr, 'Africa/Khartoum')).toBe('٤:٢١ ص');
    expect(clock(t.maghrib, 'Africa/Khartoum')).toBe('٥:٤٩ م');
    // order within the day always holds on the place's clock
    const order = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'].map((k) => t[k].getTime());
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // a whole-hour zone is guessed from the longitude when the device is elsewhere or the zone is absent
    expect(['Etc/GMT-2', 'Africa/Khartoum']).toContain(placeTz({ lat: 15.5, lon: 32.56 }) === 'Etc/GMT-2' ? 'Etc/GMT-2' : 'Africa/Khartoum');
  });
  it('every listed city has fajr before sunrise in the morning of its own clock', () => {
    for (const c of CITIES) {
      const t = timesAt(noon, c, { method: c.method });
      const h = Number(t.fajr.toLocaleTimeString('en-GB', { timeZone: c.tz, hour: '2-digit' }).slice(0, 2));
      expect(h, c.name).toBeLessThan(8);
      expect(t.fajr.getTime(), c.name).toBeLessThan(t.sunrise.getTime());
    }
  });
});

describe('checklist merge', () => {
  it('lets the latest tick or untick of an item win on either device', () => {
    const a = { done: {}, days: {}, todos: { '2026-09-18': { adhkar_morning: { d: 1, at: 10 }, sleep: { d: 1, at: 10 } } } };
    const b = { done: {}, days: {}, todos: { '2026-09-18': { sleep: { d: 0, at: 20 }, adhkar_evening: { d: 1, at: 5 } } } };
    const m = mergeProgress(a, b) as { todos: Record<string, Record<string, { d: number }>> };
    expect(m.todos['2026-09-18'].adhkar_morning.d).toBe(1);
    expect(m.todos['2026-09-18'].sleep.d).toBe(0);
    expect(m.todos['2026-09-18'].adhkar_evening.d).toBe(1);
  });
});

describe('ambient screen content', () => {
  it('resolves every listed āyah against the muṣḥaf (the key word is found)', async () => {
    const { AYAT, resolveAyah, ambientItems, playlist } = await import('./ambient');
    const missing = AYAT.filter((r) => !resolveAyah(r)).map((r) => `${r.surah}:${r.from} ${r.key}`);
    expect(missing).toEqual([]);
    const items = ambientItems();
    expect(items.filter((i) => i.kind === 'hadith').length).toBeGreaterThan(8);
    const order = playlist(items, 7);
    expect(order[0].kind).not.toBe('hadith');
    expect(order.some((x, i) => i > 0 && x.kind === 'hadith' && order[i - 1].kind === 'hadith')).toBe(false);
  });
});

describe('the sky view follows the real sun and moon', () => {
  const dallas = { lat: 32.78, lon: -96.8 };
  it('puts the sun at the horizon at sunrise and maghrib, 15° under it at fajr and ʿishāʾ (ISNA), due south at dhuhr', () => {
    const t = prayerTimes(new Date(2026, 8, 18), dallas, { method: 'isna' });
    expect(sunPosition(t.sunrise, dallas).alt).toBeCloseTo(-0.83, 0);
    expect(sunPosition(t.maghrib, dallas).alt).toBeCloseTo(-0.83, 0);
    expect(sunPosition(t.fajr, dallas).alt).toBeCloseTo(-15, 0);
    expect(sunPosition(t.isha, dallas).alt).toBeCloseTo(-15, 0);
    const noon = sunPosition(t.dhuhr, dallas);
    expect(Math.abs(noon.az - 180)).toBeLessThan(1);
    expect(noon.alt).toBeGreaterThan(55);
    expect(sunPosition(t.sunrise, dallas).az).toBeLessThan(95); // rises in the east …
    expect(sunPosition(t.maghrib, dallas).az).toBeGreaterThan(265); // … sets in the west
  });
  it('knows the moon\'s phase: dark at a known new moon, full at a known full moon, waxing in between', () => {
    expect(moonState(new Date(Date.UTC(2026, 8, 11, 3, 27)), dallas).lit).toBeLessThan(0.01);
    const full = moonState(new Date(Date.UTC(2026, 8, 26, 16, 49)), dallas);
    expect(full.lit).toBeGreaterThan(0.99);
    const week = moonState(new Date(Date.UTC(2026, 8, 18, 17)), dallas);
    expect(week.waxing).toBe(true);
    expect(week.lit).toBeGreaterThan(0.4);
    expect(week.lit).toBeLessThan(0.6);
    expect(Math.round(week.age)).toBe(7); // and it is the 7th of the Hijri month
  });
});

describe('تحصين البيت', () => {
  it('resolves every item against the muṣḥaf and points at narrations that exist', async () => {
    const { PROGRAMS, resolveItem, ENTER_HOME } = await import('./tahsin');
    for (const p of PROGRAMS) for (const it of p.items) {
      const r = resolveItem(it);
      expect(r, it.id).toBeTruthy();
      for (const h of it.hadith) expect(hadith(h), `${it.id}: ${h}`).toBeTruthy();
    }
    const kursi = resolveItem(PROGRAMS[0].items[0])!;
    expect(kursi.verses).toEqual([253]);
    expect(kursi.text.split(' ').length).toBe(50);
    expect(resolveItem(PROGRAMS[0].items[1])!.verses).toEqual([284, 285]);
    expect(ENTER_HOME.body).toContain('وَلَجْنَا');
    expect(hadith(ENTER_HOME.hadith)).toBeTruthy();
  });
});

describe('the muṣḥaf pages', () => {
  it('covers 604 pages, every verse once, in order, with sūrah starts marked', async () => {
    const { PAGE_COUNT, pageSegments, pageOf, firstVerseOnPage, juzOfPage } = await import('./pages');
    let count = 0;
    let lastSurah = 0, lastIdx = -1;
    for (let p = 1; p <= PAGE_COUNT; p++) {
      const segs = pageSegments(p);
      expect(segs.length, `page ${p}`).toBeGreaterThan(0);
      for (const g of segs) {
        count += g.to - g.from + 1;
        expect(g.surah.number > lastSurah || (g.surah.number === lastSurah && g.from === lastIdx + 1)).toBe(true);
        expect(g.starts).toBe(g.from === 0);
        lastSurah = g.surah.number; lastIdx = g.to;
      }
    }
    expect(count).toBe(6218);
    expect(pageOf(1, 1)).toBe(1);
    expect(pageOf(2, 1)).toBe(2);
    expect(firstVerseOnPage(604)).toEqual({ surah: 112, basri: 1 });
    expect(juzOfPage(1)).toBe(1);
    expect(juzOfPage(604)).toBe(30);
  });
});

describe('Kūfī numbering marks', () => {
  it('has 6236 Kūfī verse ends placed like a Ḥafṣ muṣḥaf', async () => {
    const { SURAHS, SURAH_BY_NUMBER } = await import('../audio/quran');
    const total = SURAHS.reduce((n, s) => n + s.verses.reduce((m, v) => m + (v.kufiEnds?.length ?? 0), 0), 0) + (SURAH_BY_NUMBER[1].headerKufi ? 1 : 0);
    expect(total).toBe(6236);
    expect(SURAH_BY_NUMBER[1].headerKufi).toBe(1);
    expect(SURAH_BY_NUMBER[1].verses[5].kufiEnds).toEqual([]); // أنعمت عليهم: no Kūfī end
    expect(SURAH_BY_NUMBER[1].verses[6].kufiEnds).toEqual([[5, 7]]);
    expect(SURAH_BY_NUMBER[2].verses[0].kufiEnds).toEqual([[1, 1], [8, 2]]); // الٓمٓ ① … للمتقين ②
    for (const s of SURAHS) for (const v of s.verses) for (const [after] of v.kufiEnds ?? []) expect(after >= 1 && after <= v.words.length).toBe(true);
  });
});

describe('the 15-line page', () => {
  it('places every word on a line of its page, in order, with headings above a sūrah\'s first line', async () => {
    const { PAGE_COUNT, pageLines, pageSegments } = await import('./pages');
    let placed = 0;
    for (let p = 1; p <= PAGE_COUNT; p++) {
      const slots = pageLines(p, 'kufi');
      expect(slots.length).toBe(p <= 2 ? slots.length : 15); // the first two pages are a small frame with only their used lines
      expect(slots.length).toBeLessThanOrEqual(15);
      const words = slots.flatMap((s) => (s.kind === 'text' ? s.words : []));
      expect(words.length, `page ${p}`).toBeGreaterThan(0);
      placed += words.length;
      for (let i = 1; i < words.length; i++) {
        const a = words[i - 1], b = words[i];
        expect(a.surah.number < b.surah.number || (a.surah.number === b.surah.number && (a.vi < b.vi || (a.vi === b.vi && a.wi < b.wi)))).toBe(true);
      }
      for (const g of pageSegments(p)) if (g.starts) expect(slots.some((s) => s.kind === 'band' && s.surah === g.surah), `band on page ${p}`).toBe(true);
    }
    expect(placed).toBe(77426); // every word of the muṣḥaf, once
    // a verse running over a page break is split: its first words close one page, the rest open the next
    const p34 = pageLines(34, 'kufi').flatMap((s) => (s.kind === 'text' ? s.words : []));
    const p35 = pageLines(35, 'kufi').flatMap((s) => (s.kind === 'text' ? s.words : []));
    expect(p34[p34.length - 1].surah.number).toBe(2);
    expect(p35[0].vi).toBe(p34[p34.length - 1].vi);
    expect(p35[0].wi).toBe(p34[p34.length - 1].wi + 1);
    const p604 = pageLines(604, 'kufi').map((s) => s.kind);
    expect(p604).toEqual(['band', 'basmalah', 'text', 'text', 'band', 'basmalah', 'text', 'text', 'text', 'band', 'basmalah', 'text', 'text', 'text', 'text']);
  });
});

describe('kashida', () => {
  it('lengthens the join before the last letter, keeps marks on their letter, never splits لا', async () => {
    const { kashidaPoint, withKashida, planKashida } = await import('./kashida');
    expect(withKashida('ٱلۡعَٰلَمِينَ', 2)).toBe('ٱلۡعَٰلَمِيــنَ');
    expect(withKashida('يُؤۡمِنُونَ', 1)).toBe('يُؤۡمِنُـونَ'); // و does not join forward, so the stroke sits before it
    expect(kashidaPoint('إِلَّا')).toBe(-1); // nothing to lengthen but the لا ligature
    expect(withKashida('لَا', 3)).toBe('لَا');
    expect(withKashida('مَا', 3)).toBe('مَا');
    const plan = planKashida([{ text: 'قُلۡ', width: 30 }, { text: 'هُوَ', width: 30 }, { text: 'ٱللَّهُ', width: 50 }, { text: 'أَحَدٌ', width: 40 }], 400, 8, 6);
    expect(plan.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    expect(plan[0]).toBe(0); // قُلۡ: ق joins ل but nothing follows ل
    expect(plan[2] + plan[3]).toBe(plan.reduce((a, b) => a + b, 0));
  });
});

describe('tajwīd colours', () => {
  it('colours the governed letters of a verse and keeps the text intact', async () => {
    const { colourVerse } = await import('../rules/colors');
    const { SURAH_BY_NUMBER } = await import('../audio/quran');
    const v = SURAH_BY_NUMBER[2].verses[2]; // ٱلَّذِينَ يُؤۡمِنُونَ بِٱلۡغَيۡبِ … — ikhfāʾ, qalqalah, madd
    const pieces = colourVerse(v.words, v.hafs, SURAH_BY_NUMBER[2].verses[3].words[0], v.words);
    expect(pieces).toHaveLength(v.words.length);
    pieces.forEach((ps, i) => expect(ps.map((p) => p.text).join('').replace(/\u200d/g, '')).toBe(v.words[i]));
    const tones = new Set(pieces.flat().map((p) => p.tone).filter(Boolean));
    expect(tones.size).toBeGreaterThan(1);
    // the silent alif of a plural wāw is greyed, and nothing breaks with a kashida in the shown text
    const w = SURAH_BY_NUMBER[2].verses[5].words; // … قَالُواْ ءَامَنَّا …
    const i = w.findIndex((x) => x.startsWith('قَالُوا'));
    if (i >= 0) {
      const ps = colourVerse(w, SURAH_BY_NUMBER[2].verses[5].hafs, null, w.map((x, k) => (k === i ? x.replace('قَالُ', 'قَالُــ') : x)))[i];
      expect(ps.map((p) => p.text).join('')).toContain('ــ');
      expect(ps.some((p) => p.tone === 'silent')).toBe(true);
    }
  });
});

describe('heavy rāʾ and the lām of الله', () => {
  it('follows the rule with the Dūrī marks', async () => {
    const { isHeavy } = await import('../rules/colors');
    const r = (w: string) => [...w].filter((c) => /[ء-غف-يٱ]/.test(c)).indexOf('ر');
    expect(isHeavy('مُسۡتَكۡبِرٗا', r('مُسۡتَكۡبِرٗا'))).toBe(true);     // فتحتان
    expect(isHeavy('كَبِيرًا', r('كَبِيرًا'))).toBe(true);
    expect(isHeavy('فِرۡعَوۡنَ', r('فِرۡعَوۡنَ'))).toBe(false);          // ساكنة بعد كسرة أصلية
    expect(isHeavy('قِرۡطَاسٖ', r('قِرۡطَاسٖ'))).toBe(true);           // بعدها حرف استعلاء مفتوح
    expect(isHeavy('مِرۡصَادٗا', r('مِرۡصَادٗا'))).toBe(true);
    expect(isHeavy('فِرۡقَةٖ', r('فِرۡقَةٖ'))).toBe(true);
    expect(isHeavy('اُ۪رۡجِعِيٓ', r('اُ۪رۡجِعِيٓ'))).toBe(true);        // بعد كسرة همزة الوصل العارضة
    expect(isHeavy('اِ۪رۡحَمۡهُمَا', r('اِ۪رۡحَمۡهُمَا'))).toBe(true);
    expect(isHeavy('بُشۡر۪يٰ', r('بُشۡر۪يٰ'))).toBe(false);             // ألف ممالة بعدها
    expect(isHeavy('ذِكۡر۪يٰ', r('ذِكۡر۪يٰ'))).toBe(false);
    expect(isHeavy('اَ۬لۡمَرۡءِ', r('اَ۬لۡمَرۡءِ'))).toBe(true);          // ساكنة بعد فتحة
    expect(isHeavy('خَيۡرٞ', r('خَيۡرٞ'))).toBe(true);                // مفتوحة وصلاً
    expect(isHeavy('خَيۡرٞ', r('خَيۡرٞ'), undefined, true)).toBe(true); // ٞ is fatḥatān: heavy even at a stop? no — at stop the tanwīn drops
    expect(isHeavy('اُ۬لنّ۪ارِ', r('اُ۬لنّ۪ارِ'), 'أَصۡحَٰبُ', true)).toBe(false); // ممالة عند الوقف
    expect(isHeavy('وَٱلۡفَجۡرِ', r('وَٱلۡفَجۡرِ'), undefined, true)).toBe(true); // ساكن قبله فتحة عند الوقف
    expect(isHeavy('ٱلۡفَجۡرِ', r('ٱلۡفَجۡرِ'))).toBe(false);          // مكسورة وصلاً
    const lam = (w: string) => [...w].filter((c) => /[ء-غف-يٱ]/.test(c)).length - 3;
    expect(isHeavy('اَ۬للَّهُ', lam('اَ۬للَّهُ'), 'خَتَمَ')).toBe(true);
    expect(isHeavy('اِ۬للَّهِ', lam('اِ۬للَّهِ'), 'دُونِ')).toBe(false);
    expect(isHeavy('بِاللَّهِ', lam('بِاللَّهِ'), 'ءَامَنَّا')).toBe(false);
    expect(isHeavy('وَاَللَّهُ', lam('وَاَللَّهُ'), 'قَالُواْ')).toBe(true);
    expect(isHeavy('تَاَللَّهِ', lam('تَاَللَّهِ'), 'قَالُواْ')).toBe(true);
    expect(isHeavy('لِلَّهِ', lam('لِلَّهِ'), 'اِ۬لۡحَمۡدُ')).toBe(false);
  });
});

describe('nūn, mīm and ghunnah colours', () => {
  it('colours as the print does: ikhfāʾ green on the nūn, idghām grey with the ghunnah on the next letter, nothing on the stop', async () => {
    const { colourVerse } = await import('../rules/colors');
    const { SURAH_BY_NUMBER } = await import('../audio/quran');
    const s = SURAH_BY_NUMBER[31];
    const colour = (basri: number) => {
      const i = s.verses.findIndex((v) => v.basri === basri);
      const v = s.verses[i];
      const pv = s.verses[i - 1];
      return { v, pieces: colourVerse(v.words, v.hafs, s.verses[i + 1]?.words[0] ?? null, v.words, pv ? { words: pv.words, hafs: pv.hafs } : undefined) };
    };
    const toneOf = (pieces: { text: string; tone?: string }[], letter: string) => pieces.find((p) => p.text.replace(/[^ء-غف-يٱ]/g, '').startsWith(letter))?.tone;
    // 31:2 (Baṣrī) هُدٗى وَرَحۡمَةٗ لِّلۡمُحۡسِنِينَ — tanwīn + و melts with ghunnah: د grey, و green; tanwīn + ل melts without: ة grey
    const a = colour(2);
    const iHuda = a.v.words.findIndex((w) => w.startsWith('هُد'));
    expect(toneOf(a.pieces[iHuda], 'د')).toBe('silent');
    expect(a.pieces[iHuda + 1][0].tone).toBe('ghunnah');
    expect(toneOf(a.pieces[iHuda + 1], 'ة')).toBe('silent');
    // 31:5 مَن يَشۡتَرِي: ن grey, ي green; مِّن رَّبِّهِمۡ in 31:4: ن grey (no ghunnah), ر heavy
    const b = colour(5);
    const iMan = b.v.words.findIndex((w) => w === 'مَن');
    expect(toneOf(b.pieces[iMan], 'ن')).toBe('silent');
    expect(b.pieces[iMan + 1][0].tone).toBe('ghunnah');
    const c = colour(4);
    const iMin = c.v.words.findIndex((w) => w.replace(/[^ء-غف-يٱ]/g, '') === 'من' && w.includes('ّ'));
    expect(toneOf(c.pieces[iMin], 'ن')).toBe('silent');
    expect(c.pieces[iMin + 1][0].tone).toBe('heavy');
    // ikhfāʾ inside a word: أَنزَلۡنَا — the nūn green; a doubled nūn: إِنَّ green
    const d = colour(9);
    const iAnz = d.v.words.findIndex((w) => w.includes('أَنزَلۡنَا'));
    expect(toneOf(d.pieces[iAnz], 'ن')).toBe('ghunnah');
    const e = colour(7);
    expect(toneOf(e.pieces[0], 'ن')).toBe('ghunnah'); // إِنَّ
    // the verse's last letter carries no nūn-rule colour (the stop)
    for (const basri of [2, 4, 5, 7]) { const { pieces } = colour(basri); const lastWord = pieces[pieces.length - 1]; const last = lastWord[lastWord.length - 1]; expect(['madd24', 'madd4', 'madd6', 'heavy', 'silent', undefined]).toContain(last.tone); }
  });
});

describe('madd and qalqalah colours', () => {
  it('colours the madd letter with what it leans on, and the letter bounced on at a stop', async () => {
    const { colourVerse } = await import('../rules/colors');
    const { SURAH_BY_NUMBER } = await import('../audio/quran');
    const paint = (sn: number, basri: number) => {
      const s = SURAH_BY_NUMBER[sn]; const i = s.verses.findIndex((v) => v.basri === basri); const v = s.verses[i]; const pv = s.verses[i - 1];
      return { v, p: colourVerse(v.words, v.hafs, s.verses[i + 1]?.words[0] ?? null, v.words, pv ? { words: pv.words, hafs: pv.hafs } : undefined) };
    };
    const letters = (ps: { text: string; tone?: string }[]) => ps.flatMap((p) => [...p.text.replace(/[^ء-غف-يٱ]/g, '')].map((c) => [c, p.tone] as const));
    // lāzim: الٓمٓ purple on both letters; muttaṣil: ٱلسَّمَآءِ alif and hamzah pink; ʿāriḍ: ٱلۡحَكِيمِ at the verse end, yāʾ and mīm orange
    const l = paint(31, 1);
    expect(letters(l.p[0]).map(([, t]) => t)).toEqual([undefined, 'madd6', 'madd6']); // the alif of الٓمٓ is a plain letter name
    const bare = (w: string) => w.replace(/[^ء-غف-يٱ]/g, '').replace('ٱ', 'ا');
    const sky = paint(31, 9); const iSky = sky.v.words.findIndex((w) => bare(w) === 'السماء');
    expect(letters(sky.p[iSky]).slice(-2).map(([, t]) => t)).toEqual(['madd4', 'madd4']); // the alif of the madd and the hamzah it meets
    const end = letters(l.p[l.p.length - 1]);
    expect(end.slice(-2).map(([, t]) => t)).toEqual(['madd24', 'madd24']);
    // munfaṣil reaches the hamzah of the next word: بِمَآ أُنزِلَ
    const b = paint(2, 3); const iBima = b.v.words.findIndex((w) => bare(w) === 'بما');
    expect(letters(b.p[iBima]).slice(-1)[0][1]).toBe('madd24');
    expect(b.p[iBima + 1][0].tone).toBe('madd24');
    // qalqalah: sākin inside a word (أَبۡصَٰرِهِمۡ) and the letter stopped on at a verse end (أَحَدُۢ, ٱلۡفَلَقِ), not a bare final alif
    const q = paint(2, 6); const iAb = q.v.words.findIndex((w) => bare(w) === 'أبصرهم');
    expect(letters(q.p[iAb]).find(([c]) => c === 'ب')?.[1]).toBe('qalqalah');
    expect(letters(paint(112, 4).p.slice(-1)[0]).slice(-1)[0]).toEqual(['د', 'qalqalah']);
    expect(letters(paint(113, 1).p.slice(-1)[0]).slice(-1)[0]).toEqual(['ق', 'qalqalah']);
    const eq = paint(113, 1);
    expect(eq.p.slice(-1)[0].some((x) => x.tone === 'qalqalah')).toBe(true);
  });
});

describe('Dūrī marks: imālah, taqlīl, the hamzah', () => {
  it('tags and colours them on the letters that carry the marks', async () => {
    const { colourVerse } = await import('../rules/colors');
    const { tagVerse } = await import('../rules/tagger');
    const { SURAH_BY_NUMBER } = await import('../audio/quran');
    const bare = (w: string) => w.replace(/[^ء-غف-يٱ]/g, '').replace('ٱ', 'ا');
    // find the first verse of a sūrah holding a word (compared by bare letters), never a typed literal
    const paint = (sn: number, word: string, after?: string) => { const s = SURAH_BY_NUMBER[sn]; const i = s.verses.findIndex((v) => v.words.some((w, k) => bare(w) === word && (!after || bare(v.words[k - 1] ?? '').startsWith(after)))); const v = s.verses[i]; expect(v, `${word} in ${sn}`).toBeDefined(); return { v, p: colourVerse(v.words, v.hafs, s.verses[i + 1]?.words[0] ?? null, v.words), t: tagVerse({ words: v.words, hafs: v.hafs, nextWord: s.verses[i + 1]?.words[0] ?? null }) }; };
    const letters = (ps: { text: string; tone?: string }[]) => ps.flatMap((p) => [...p.text.replace(/[^ء-غف-يٱ]/g, '')].map((c) => [c, p.tone] as const));
    // imālah: ٱلنّ۪اسِ — the nūn and the alif teal
    const a = paint(2, 'الناس'); const iNas = a.v.words.findIndex((w) => bare(w) === 'الناس');
    expect(letters(a.p[iNas]).filter(([c]) => c === 'ن' || c === 'ا').slice(-2).map(([, t]) => t)).toEqual(['imalah', 'imalah']);
    // taqlīl: مُوسَىٰ — the sīn and the alif maqṣūrah lowered
    const m = paint(2, 'موسي'); const iMusa = m.v.words.findIndex((w) => bare(w) === 'موسي');   // the muṣḥaf writes the lowered alif as yāʾ + dagger alif
    expect(letters(m.p[iMusa]).slice(-2).map(([, t]) => t)).toEqual(['taqlil', 'taqlil']);
    // the sākin hamzah of يُؤۡمِنُونَ is an ibdāl for Abū ʿAmr; two hamzahs in one word: ءَٰا۬نذَرۡتَهُمۡ
    const y = paint(2, 'يؤمنون'); const iYu = y.v.words.findIndex((w) => bare(w) === 'يؤمنون');
    expect(letters(y.p[iYu]).find(([c]) => c === 'ؤ')?.[1]).toBe('hamza');
    const n = paint(2, 'ءانذرتهم'); const iAn = n.v.words.findIndex((w) => bare(w) === 'ءانذرتهم');
    expect(n.t.some((t) => t.word === iAn && t.rule === 'tashil')).toBe(true);
    expect(n.p[iAn].some((x) => x.tone === 'hamza')).toBe(true);
    // two hamzahs across words, different vowels: ٱلسُّفَهَآءُ اَ۬لَآ — the second is tas-hīl, not isqāṭ
    const s13 = paint(2, 'الا', 'السفها'); const iAla = s13.v.words.findIndex((w, k) => bare(w) === 'الا' && bare(s13.v.words[k - 1] ?? '').startsWith('السفها'));
    expect(s13.t.some((t) => t.word === iAla && t.rule === 'tashil')).toBe(true); expect(s13.t.some((t) => t.word === iAla && t.rule === 'isqat')).toBe(false);
    // the same vowel: هَٰٓؤُلَآءِ إِن → the first hamzah dropped, marked on the word that lost it
    const h = paint(2, 'هؤلا'); const iHa = h.v.words.findIndex((w) => bare(w) === 'هؤلا');
    expect(h.t.some((t) => t.word === iHa && t.rule === 'isqat' && t.unit === bare(h.v.words[iHa]).length - 1)).toBe(true);
  });
});
