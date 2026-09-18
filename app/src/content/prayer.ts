// Prayer times for the place in the settings (computed locally by server/prayer.mjs).
import { METHODS, PRAYERS, PRAYER_NAMES, deviceTz, nextPrayer, placeTz as zoneOf, timesAt, tzOffsetMinutes } from '../../server/prayer.mjs';
import { getSettings, type Settings } from '../ui/settings';

export { METHODS, PRAYERS, PRAYER_NAMES, tzOffsetMinutes };
export type PrayerKey = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

export const DEVICE_TZ: string = deviceTz();

export function placeTz(s: Settings = getSettings()): string {
  return zoneOf(s.place);
}

export function timesFor(date = new Date(), s: Settings = getSettings()): Record<PrayerKey, Date> | null {
  if (!s.place) return null;
  return timesAt(date, s.place, { method: s.prayerMethod, asr: s.asrMethod }) as Record<PrayerKey, Date>;
}

export function next(now = new Date(), s: Settings = getSettings()): { key: PrayerKey; at: Date } | null {
  if (!s.place) return null;
  return nextPrayer(now, s.place, { method: s.prayerMethod, asr: s.asrMethod }) as { key: PrayerKey; at: Date } | null;
}

/** A time on the clock of the place (not of the device). */
export function clock(d: Date, tz: string = placeTz()): string {
  const p = new Intl.DateTimeFormat('en-US-u-nu-latn', { timeZone: tz, hourCycle: 'h23', hour: 'numeric', minute: '2-digit' }).formatToParts(d);
  const h = Number(p.find((x) => x.type === 'hour')?.value);
  const m = p.find((x) => x.type === 'minute')?.value ?? '00';
  const AR = '٠١٢٣٤٥٦٧٨٩';
  return `${h % 12 === 0 ? 12 : h % 12}:${m}`.replace(/\d/g, (c) => AR[Number(c)]) + (h < 12 ? ' ص' : ' م');
}

export function adhanOn(s: Settings, key: string): boolean {
  return !!s.adhan?.enabled && s.adhan.prayers?.[key] !== false && (PRAYERS as string[]).includes(key);
}

/** A sensible calculation method for a place, used once when the place is first set (the learner can change it). */
export function suggestMethod(lat: number, lon: number): string {
  if (lon < -50 && lat > 14) return 'isna'; // North America
  if (lat > 12 && lat < 33 && lon > 34 && lon < 60) return 'makkah'; // Arabian Peninsula
  if (lat > -5 && lat < 38 && lon > 20 && lon <= 37) return 'egypt'; // Egypt, Sudan and their neighbours
  if (lat > 35 && lat < 43 && lon > 25 && lon < 45) return 'turkey';
  if (lat > 5 && lat < 38 && lon >= 60 && lon < 93) return 'karachi'; // South Asia
  if (lat > 41 && lat < 52 && lon > -5 && lon < 9) return 'france';
  return 'mwl';
}
