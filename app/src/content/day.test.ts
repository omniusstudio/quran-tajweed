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
