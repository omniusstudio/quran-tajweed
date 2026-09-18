export interface Place { lat: number; lon: number }
export interface PrayerOptions { method?: string; asr?: 'standard' | 'hanafi'; adjust?: Record<string, number> }
export const METHODS: Record<string, { name: string; fajr: number; isha?: number; ishaMinutes?: number }>;
export const PRAYERS: string[];
export const PRAYER_NAMES: Record<string, string>;
export function prayerTimes(date: Date, place: Place, opts?: PrayerOptions): Record<string, Date>;
export function nextPrayer(now: Date, place: Place, opts?: PrayerOptions): { key: string; at: Date } | null;
