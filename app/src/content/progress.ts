// Local-only progress (PROMPT.md §3: no accounts, no server state): which lesson steps are done,
// where the learner left off, and a per-day activity log for the streak and the daily goal.

import { useCallback, useEffect, useState } from 'react';
import { changed } from '../ui/bus';

const KEY = 'nutq.progress.v1';

export interface DayStats {
  lessons: number;
  answers: number;
  correct: number;
  drills: number;
}
export interface Progress {
  done: Record<string, true>;
  last?: string;
  /** Activity per local calendar day, keyed YYYY-MM-DD. */
  days: Record<string, DayStats>;
  /** Last local write, for merging between devices. */
  updatedAt?: number;
}

export type Activity = 'lesson' | 'correct' | 'wrong' | 'drill';
/** Practice points per activity; the daily goal is measured in these. */
export const POINTS: Record<Activity, number> = { lesson: 3, correct: 1, wrong: 1, drill: 2 };

export function dayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function read(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Progress;
      if (!p.days) p.days = {};
      return p;
    }
  } catch {
    /* private mode or blocked storage: start fresh */
  }
  return { done: {}, days: {} };
}

function write(p: Progress, announce = true) {
  p.updatedAt = Date.now();
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
  if (announce) changed();
}

/** Store a merged copy coming from another device (no change event: it came from the sync). */
export function replaceProgress(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
  notify();
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function readProgress(): Progress {
  return read();
}

export function points(d: DayStats | undefined): number {
  if (!d) return 0;
  return d.lessons * POINTS.lesson + d.answers * POINTS.correct + d.drills * POINTS.drill;
}

/** Consecutive days with activity ending today (or yesterday, so a streak survives until tonight). */
export function streak(p: Progress, today = new Date()): number {
  const d = new Date(today);
  if (points(p.days[dayKey(d)]) === 0) d.setDate(d.getDate() - 1);
  let n = 0;
  while (points(p.days[dayKey(d)]) > 0) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/** The last `n` days (oldest first) with their points, for the week strip on the home page. */
export function recentDays(p: Progress, n = 7, today = new Date()): { key: string; points: number; today: boolean }[] {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    out.push({ key, points: points(p.days[key]), today: i === 0 });
  }
  return out;
}

/** Record one activity for today and return the day's points before and after. */
export function logActivity(kind: Activity): { before: number; after: number; day: DayStats } {
  const cur = read();
  const key = dayKey();
  const day = cur.days[key] ?? { lessons: 0, answers: 0, correct: 0, drills: 0 };
  const before = points(day);
  if (kind === 'lesson') day.lessons++;
  else if (kind === 'drill') day.drills++;
  else {
    day.answers++;
    if (kind === 'correct') day.correct++;
  }
  cur.days[key] = day;
  // keep the log small: the last 400 days
  const keys = Object.keys(cur.days).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - 400))) delete cur.days[k];
  write(cur);
  notify();
  return { before, after: points(day), day };
}

export function resetProgress() {
  write({ done: {}, days: {} });
  notify();
}

export function useProgress(): [Progress, (ruleId: string, done: boolean) => void, (ruleId: string) => void] {
  const [p, setP] = useState<Progress>(read);
  useEffect(() => {
    const on = () => setP(read());
    listeners.add(on);
    return () => {
      listeners.delete(on);
    };
  }, []);
  const mark = useCallback((ruleId: string, done: boolean) => {
    const cur = read();
    if (done) cur.done[ruleId] = true;
    else delete cur.done[ruleId];
    write(cur);
    notify();
  }, []);
  const visit = useCallback((ruleId: string) => {
    const cur = read();
    if (cur.last === ruleId) return;
    cur.last = ruleId;
    write(cur);
    notify();
  }, []);
  return [p, mark, visit];
}
