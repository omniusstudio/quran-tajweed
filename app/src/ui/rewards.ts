// Turns an event into progress + feedback: log the activity, play the cue, and celebrate when
// something worth noticing happened (a section finished, the daily goal reached, a run of answers).

import { SECTIONS } from '../content/lessons';
import { logActivity, readProgress, streak } from '../content/progress';
import { celebrate } from './celebrate';
import { getSettings } from './settings';
import { sfx } from './sound';
import { arNum } from '../pages/shared';

const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];

/** Celebrate the daily goal (and a streak milestone) if this activity crossed it. */
function checkGoal(before: number, after: number) {
  const goal = getSettings().dailyGoal;
  if (before < goal && after >= goal) {
    const s = streak(readProgress());
    const milestone = STREAK_MILESTONES.includes(s);
    celebrate({
      kind: milestone ? 'streak' : 'goal',
      title: milestone ? `${arNum(s)} ${s <= 10 ? 'أيام' : 'يوماً'} متتالية` : 'أنجزت هدف اليوم',
      text: milestone ? 'ثبات يومي كهذا هو ما يجعل النطق يستقر.' : s > 1 ? `سلسلتك الآن ${arNum(s)} ${s === 2 ? 'يومان' : s <= 10 ? 'أيام' : 'يوماً'}.` : 'عد غداً لتبدأ سلسلة.',
    });
    return true;
  }
  return false;
}

/** A lesson step was just marked done (call only when it was not done before). */
export function rewardLesson(ruleId: string, doneNow: Record<string, true>) {
  const { before, after } = logActivity('lesson');
  const section = SECTIONS.find((s) => s.rules.some((r) => r.id === ruleId));
  const sectionDone = !!section && section.rules.every((r) => doneNow[r.id]);
  const allDone = SECTIONS.every((s) => s.rules.every((r) => doneNow[r.id]));
  if (allDone) {
    celebrate({ kind: 'section', title: 'أتممت الدروس كلها', text: 'ما بقي هو التمرين والمتابعة مع القارئ.' });
    return;
  }
  if (sectionDone && section) {
    celebrate({ kind: 'section', title: `أتممت: ${section.title}`, text: 'قسم كامل خلفك.' });
    return;
  }
  if (checkGoal(before, after)) return;
  sfx('complete');
  celebrate({ kind: 'lesson', title: 'خطوة منجزة' });
}

/** An exercise answer; `run` is the number of right answers in a row including this one. */
export function rewardAnswer(ok: boolean, run: number) {
  const { before, after } = logActivity(ok ? 'correct' : 'wrong');
  sfx(ok ? 'correct' : 'wrong');
  if (checkGoal(before, after)) return;
  if (ok && (run === 5 || run === 10 || (run > 10 && run % 10 === 0))) {
    celebrate({ kind: 'run', title: `${arNum(run)} إجابات صحيحة متتالية` });
  }
}

/** The wird moved on: points for the day's portion, a celebration for a juzʾ or a khatm. */
export function rewardWird(ev: { advanced: boolean; dayCompleted: boolean; juzCompleted: number | null; khatm: boolean }) {
  if (!ev.advanced) return;
  if (ev.khatm) {
    logActivity('wird');
    celebrate({ kind: 'section', title: 'ختمة مباركة', text: 'ختمت المصحف كله. يبدأ الورد من جديد من الفاتحة.' });
    return;
  }
  if (ev.dayCompleted) {
    const { before, after } = logActivity('wird');
    if (ev.juzCompleted) {
      celebrate({ kind: 'section', title: `أتممت الجزء ${arNum(ev.juzCompleted)}`, text: 'وردك اليوم تام أيضاً.' });
      return;
    }
    if (checkGoal(before, after)) return;
    sfx('complete');
    celebrate({ kind: 'lesson', title: 'وردك اليوم تام' });
    return;
  }
  if (ev.juzCompleted) celebrate({ kind: 'section', title: `أتممت الجزء ${arNum(ev.juzCompleted)}` });
}

/** The learner recorded themselves in a drill or the follow-along mode. */
export function rewardRecording() {
  const { before, after } = logActivity('drill');
  sfx('toggle');
  checkGoal(before, after);
}
