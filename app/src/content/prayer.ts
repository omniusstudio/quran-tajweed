// Prayer times for the place in the settings (computed locally by server/prayer.mjs).
import { METHODS, PRAYERS, PRAYER_NAMES, nextPrayer, prayerTimes } from '../../server/prayer.mjs';
import { getSettings, type Settings } from '../ui/settings';

export { METHODS, PRAYERS, PRAYER_NAMES };
export type PrayerKey = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

export function timesFor(date = new Date(), s: Settings = getSettings()): Record<PrayerKey, Date> | null {
  if (!s.place) return null;
  return prayerTimes(date, s.place, { method: s.prayerMethod, asr: s.asrMethod }) as Record<PrayerKey, Date>;
}

export function next(now = new Date(), s: Settings = getSettings()): { key: PrayerKey; at: Date } | null {
  if (!s.place) return null;
  return nextPrayer(now, s.place, { method: s.prayerMethod, asr: s.asrMethod }) as { key: PrayerKey; at: Date } | null;
}

export function clock(d: Date): string {
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
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
