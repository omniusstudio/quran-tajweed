// Local preferences (PROMPT.md §3: no accounts): theme, sounds, haptics, Qur'an text size, motion.

import { useCallback, useEffect, useState } from 'react';
import { changed } from './bus';

const KEY = 'nutq.settings.v1';

export type Theme = 'system' | 'light' | 'dark';
export type Motion = 'system' | 'reduced';

export interface Settings {
  theme: Theme;
  sound: boolean;
  haptics: boolean;
  /** Multiplier on the Qur'an text size (1 = default). */
  quranScale: 1 | 1.15 | 1.3;
  motion: Motion;
  /** Daily goal in practice points (lesson = 3, drill = 2, answer = 1). */
  dailyGoal: number;
  /** Reciter for follow-along and the alignment editor. */
  reciter: string;
  /** Sūrah last opened in follow-along. */
  lastSurah: number;
  /** Follow-along: keep playing through the sūrah, or stop at the end of every verse. */
  playMode: 'continuous' | 'verse';
  /** Follow-along: where each sūrah was left (seconds), keyed by sūrah number. */
  positions: Record<string, number>;
  /** The ribbon: the verse to pick up from. Set on every stop unless pinned by hand. */
  bookmark?: { surah: number; basri: number; pinned: boolean; at: number };
  /** Days to add to the computed (Umm al-Qura) Hijri date, to follow a local moon sighting: -2 … 2. */
  hijriOffset?: number;
  /** Where prayer times are computed for. */
  place?: { lat: number; lon: number; name?: string; /** IANA zone the times are shown in; absent = the device's */ tz?: string };
  /** Calculation method (see server/prayer.mjs METHODS) and the ʿaṣr shadow rule. */
  prayerMethod?: string;
  asrMethod?: 'standard' | 'hanafi';
  /** The call to prayer: on/off and which prayers. The Mac's local server plays it even with the app closed. */
  adhan?: { enabled: boolean; prayers: Record<string, boolean> };
  /** Evening nudge (HH:MM) when the day's checklist is not finished; null = off. */
  todoReminder?: string | null;
  /** Last local change, for merging between devices. */
  updatedAt?: number;
}

export const DEFAULTS: Settings = { theme: 'system', sound: true, haptics: true, quranScale: 1, motion: 'system', dailyGoal: 10, reciter: 'nourin_siddig', lastSurah: 1, playMode: 'continuous', positions: {}, hijriOffset: 0, prayerMethod: 'mwl', asrMethod: 'standard', todoReminder: '20:30' };

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULTS };
}

function write(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

const listeners = new Set<() => void>();
let current: Settings = read();

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch, updatedAt: Date.now() };
  write(current);
  applySettings(current);
  listeners.forEach((l) => l());
  changed();
}

/** Adopt settings merged from another device (no change event). */
export function replaceSettings(s: Settings) {
  current = { ...DEFAULTS, ...s };
  write(current);
  applySettings(current);
  listeners.forEach((l) => l());
}

/** Is the page currently in dark mode (explicit or via the system)? */
export function isDark(s: Settings = current): boolean {
  if (s.theme !== 'system') return s.theme === 'dark';
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Should animation be kept to a minimum (setting or OS preference)? */
export function reducedMotion(s: Settings = current): boolean {
  if (s.motion === 'reduced') return true;
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Push the settings into the document: theme attribute, text scale, motion, browser chrome colour. */
export function applySettings(s: Settings = current) {
  const root = document.documentElement;
  root.dataset.theme = s.theme;
  root.dataset.motion = s.motion;
  root.style.setProperty('--quran-scale', String(s.quranScale));
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', isDark(s) ? '#14201b' : '#faf7f2');
}

if (typeof document !== 'undefined') {
  applySettings(current);
  if (typeof matchMedia === 'function') {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      applySettings(current);
      listeners.forEach((l) => l());
    });
  }
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const [s, setS] = useState<Settings>(current);
  useEffect(() => {
    const on = () => setS(current);
    listeners.add(on);
    return () => {
      listeners.delete(on);
    };
  }, []);
  const update = useCallback((patch: Partial<Settings>) => updateSettings(patch), []);
  return [s, update];
}
