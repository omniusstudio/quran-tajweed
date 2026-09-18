// The wird reminder: a local notification at the chosen time while the app is open (there is no
// server push; on a phone this works once the app is on the home screen and running).

import { todayPortion, wirdState } from '../content/wird';
import { summary, todosFor } from '../content/daily';
import { getSettings } from './settings';

let notifiedFor = '';

export function startWirdReminder() {
  if (typeof window === 'undefined') return;
  const tick = () => {
    const w = wirdState();
    if (!w.reminder) return;
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const key = `${now.toDateString()} ${w.reminder}`;
    if (hhmm !== w.reminder || notifiedFor === key) return;
    notifiedFor = key;
    const p = todayPortion(w);
    if (p.complete) return;
    const body = `${p.title}: ${p.segments.map((s) => `${s.surahName} ${s.from}${s.to !== s.from ? `–${s.to}` : ''}`).join('، ')}`;
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const n = new Notification('وردك اليوم', { body, tag: 'nutq-wird', icon: '/icons/icon-192.png' });
        n.onclick = () => {
          window.focus();
          location.hash = '#/wird';
        };
      } catch {
        /* ignore */
      }
    }
  };
  setInterval(tick, 30 * 1000);
  tick();
}


let todoNotifiedFor = '';

/** An evening nudge when the day's checklist is not finished (while the app is open, like the wird reminder). */
export function startTodoReminder() {
  if (typeof window === 'undefined') return;
  const tick = () => {
    const at = getSettings().todoReminder;
    if (!at) return;
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const key = `${now.toDateString()} ${at}`;
    if (hhmm !== at || todoNotifiedFor === key) return;
    todoNotifiedFor = key;
    const sum = summary(todosFor(now).todos);
    if (sum.complete || !('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      const n = new Notification('بقي من مهام يومك', { body: sum.left.map((t) => t.title).join('، '), tag: 'nutq-todos', icon: '/icons/icon-192.png' });
      n.onclick = () => {
        window.focus();
        location.hash = '#/';
      };
    } catch {
      /* ignore */
    }
  };
  setInterval(tick, 30 * 1000);
  tick();
}
