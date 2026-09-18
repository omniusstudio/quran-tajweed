export interface Place { lat: number; lon: number; tz?: string }
export interface PrayerOptions { method?: string; asr?: 'standard' | 'hanafi'; adjust?: Record<string, number> }
export const METHODS: Record<string, { name: string; fajr: number; isha?: number; ishaMinutes?: number }>;
export const PRAYERS: string[];
export const PRAYER_NAMES: Record<string, string>;
export function prayerTimes(date: Date, place: Place, opts?: PrayerOptions): Record<string, Date>;
export function nextPrayer(now: Date, place: Place, opts?: PrayerOptions): { key: string; at: Date } | null;
export function tzOffsetMinutes(tz: string, at?: Date): number;
export function deviceTz(): string;
export function placeTz(place: Place | null | undefined, at?: Date): string;
export function placeDay(at: Date, tz: string, addDays?: number): Date;
export function timesAt(now: Date, place: Place, opts?: PrayerOptions): Record<string, Date>;
export function sunPosition(date: Date, place: Place): { az: number; alt: number };
export function moonState(date: Date, place: Place): { az: number; alt: number; lit: number; waxing: boolean; age: number };
