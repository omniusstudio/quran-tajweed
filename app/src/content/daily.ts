// The day's checklist: adhkār, the sūrahs tied to the time of day, the wird, the memorization
// challenge, Friday's sūrah, a fasting day. Items the app can see for itself (the wird, the
// challenge, the practice goal) tick themselves; the rest the learner ticks. Ticks are kept per
// day inside the progress store, so they sync between devices.

import { dayKey, mutateProgress, points, readProgress, type Progress } from './progress';
import { todayPortion, wirdState } from './wird';
import { toHijri } from './hijri';
import { fastingOn, occasionsOn, type Occasion } from './occasions';
import { getSettings } from '../ui/settings';

export type Slot = 'morning' | 'day' | 'evening' | 'night';
export const SLOT_TITLES: Record<Slot, string> = { morning: 'الصباح', day: 'في يومك', evening: 'المساء', night: 'قبل النوم' };

export interface Todo {
  id: string;
  slot: Slot;
  title: string;
  detail?: string;
  /** Where to do it. */
  link?: string;
  /** Hadith ids (hadith.json) on why. */
  hadith?: string[];
  /** Ticked by the app from what it sees; cannot be ticked by hand. */
  auto?: boolean;
  /** Does not count toward finishing the day (a voluntary fast). */
  optional?: boolean;
  done: boolean;
}

export function ticksFor(p: Progress, key: string): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const [id, t] of Object.entries(p.todos?.[key] ?? {})) out[id] = t.d === 1;
  return out;
}

/** The list for a day. */
export function todosFor(date = new Date(), p: Progress = readProgress()): { todos: Todo[]; occasions: Occasion[] } {
  const settings = getSettings();
  const key = dayKey(date);
  const ticks = ticksFor(p, key);
  const hijri = toHijri(date, settings.hijriOffset ?? 0);
  const occasions = occasionsOn(hijri, date.getDay());
  const fasting = fastingOn(occasions);
  const isToday = key === dayKey();
  const portion = isToday ? todayPortion(wirdState(p), date) : null;
  const stats = p.days[key];
  const list: Omit<Todo, 'done'>[] = [
    { id: 'adhkar_morning', slot: 'morning', title: 'أذكار الصباح', detail: 'ومعها آية الكرسي، والإخلاص والمعوذتان ثلاثاً', link: '#/adhkar/morning', hadith: ['quls_morning_evening'] },
    { id: 'wird', slot: 'day', title: 'ورد القرآن', detail: portion ? portion.title : undefined, link: '#/wird', auto: true },
    { id: 'hifz', slot: 'day', title: 'تحدي الحفظ', detail: 'خمس آيات، أو مراجعة ما حان وقته', link: '#/hifz', auto: true },
    { id: 'practice', slot: 'day', title: 'هدف التدريب', detail: 'درس أو تمرين حتى تبلغ هدف اليوم', link: '#/practice', auto: true },
    { id: 'adhkar_evening', slot: 'evening', title: 'أذكار المساء', detail: 'ومعها آية الكرسي، والإخلاص والمعوذتان ثلاثاً', link: '#/adhkar/evening', hadith: ['quls_morning_evening'] },
    { id: 'sleep', slot: 'night', title: 'سورة الملك وأذكار النوم', detail: 'الملك، وآخر آيتين من البقرة، وآية الكرسي، والإخلاص والمعوذتان', link: '#/adhkar/sleep', hadith: ['mulk', 'baqarah_last_two', 'kursi_sleep', 'quls_sleep'] },
  ];
  if (date.getDay() === 5) {
    list.splice(1, 0, { id: 'kahf', slot: 'morning', title: 'سورة الكهف', detail: 'تُقرأ يوم الجمعة، من غروب شمس الخميس إلى غروب شمس الجمعة', link: '#/follow/18', hadith: ['kahf_friday', 'kahf_ten'] });
    list.splice(2, 0, { id: 'salawat', slot: 'day', title: 'الإكثار من الصلاة على النبي\u00a0ﷺ', hadith: ['friday_salawat'] });
  }
  for (const o of occasions) for (const [n, label] of o.surahs ?? []) if (!list.some((t) => t.link === `#/follow/${n}`)) list.push({ id: `surah_${n}`, slot: 'night', title: label, link: `#/follow/${n}` });
  if (fasting === 'recommended' || fasting === 'obligatory') {
    const o = occasions.find((x) => x.fasting === fasting)!;
    list.unshift({ id: 'fast', slot: 'morning', title: fasting === 'obligatory' ? 'صيام رمضان' : `صيام اليوم: ${o.title.replace(/^صيام /, '')}`, detail: o.why, hadith: o.hadith.slice(0, 1), optional: fasting === 'recommended', link: '#/calendar' });
  }
  const autoDone: Record<string, boolean> = {
    wird: portion ? portion.complete : (stats?.wird ?? 0) > 0,
    hifz: (stats?.challenges ?? 0) > 0,
    practice: points(stats) - (stats?.todos ?? 0) * 5 >= (settings.dailyGoal || 10),
  };
  return { todos: list.map((t) => ({ ...t, done: t.auto ? !!autoDone[t.id] || !!ticks[t.id] : !!ticks[t.id] })), occasions };
}

export function summary(todos: Todo[]) {
  const required = todos.filter((t) => !t.optional);
  const done = required.filter((t) => t.done).length;
  return { done, total: required.length, complete: required.length > 0 && done === required.length, left: required.filter((t) => !t.done) };
}

/** Tick or untick an item for a day. Returns true when this tick completed the day's list. */
export function setTodo(id: string, done: boolean, date = new Date()): boolean {
  const key = dayKey(date);
  const before = summary(todosFor(date).todos).complete;
  mutateProgress((p) => {
    const todos = p.todos ?? (p.todos = {});
    (todos[key] ?? (todos[key] = {}))[id] = { d: done ? 1 : 0, at: Date.now() };
    const keys = Object.keys(todos).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - 90))) delete todos[k];
  });
  return !before && summary(todosFor(date).todos).complete;
}

/** Days in a row (ending today or yesterday) on which the list was completed. */
export function todoStreak(p: Progress = readProgress(), today = new Date()): number {
  const d = new Date(today);
  if (!(p.days[dayKey(d)]?.todos)) d.setDate(d.getDate() - 1);
  let n = 0;
  while (p.days[dayKey(d)]?.todos) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/** Which slot the clock is in, to open the list at the right place. */
export function slotNow(now = new Date()): Slot {
  const h = now.getHours();
  return h < 11 ? 'morning' : h < 16 ? 'day' : h < 21 ? 'evening' : 'night';
}
