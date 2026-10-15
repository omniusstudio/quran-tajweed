import { useMemo } from 'react';
import { SURAH_BY_NUMBER } from '../audio/quran';
import { dueRuns, inProgressRuns, repsByDay, surahTallies, totals, type VerseRun } from '../content/memo';
import { loadRun, setIntent } from '../content/memoRun';
import { useProgress } from '../content/progress';
import { Icon } from '../ui/icons';
import { sfx } from '../ui/sound';
import { useSettings } from '../ui/settings';
import { rangeLabel } from './MemoUi';
import { arNum } from './shared';

const pct = (n: number) => `${n < 10 && n > 0 ? arNum(Math.round(n * 10) / 10).replace('.', '٫') : arNum(Math.round(n))}٪`;

/** What is memorized, what is being worked on, and what is due for recall (#/memo). */
export function MemoPage({ go }: { go: (hash: string) => void }) {
  const [p] = useProgress();
  const [settings] = useSettings();
  const kufi = settings.numbering !== 'basri';
  const t = useMemo(() => totals(p), [p]);
  const due = useMemo(() => dueRuns(p), [p]);
  const doing = useMemo(() => inProgressRuns(p), [p]);
  const tallies = useMemo(() => surahTallies(p), [p]);
  const days = useMemo(() => repsByDay(p, 14), [p]);
  const run = loadRun();
  const maxDay = Math.max(1, ...days.map((d) => d.reps));
  const open = (r: VerseRun, extra: Parameters<typeof setIntent>[0] extends infer T ? Partial<T> : never) => {
    sfx('tap');
    setIntent({ surah: r.surah, from: r.from, to: r.to, ...extra });
    go(`#/read/${r.surah}/${r.from}`);
  };
  const empty = t.done === 0 && t.doing === 0 && !run;

  return (
    <div className="page memo-page">
      <header className="page-head">
        <span className="eyebrow">حفظي</span>
        <h2 className="page-title">{arNum(t.done)} آية في صدرك</h2>
        <p className="ref">{pct(t.percent)} من القرآن{t.todayReps > 0 ? ` · اليوم ${arNum(t.todayReps)} تكرارًا` : ''}</p>
        <span className="bar" aria-hidden><i style={{ transform: `scaleX(${Math.min(1, t.done / Math.max(1, t.total))})` }} /></span>
      </header>

      {empty && (
        <section className="card memo-empty">
          <h3><Icon name="repeat" size={20} /> لم تبدأ بعد</h3>
          <p>افتح المصحف واضغط زرّ التكرار في أعلى الصفحة، أو اضغط آيةً ضغطةً طويلة. اختر الآية أو الصفحة أو السورة، وعدد المرات، ثم اسمع وردّد.</p>
          <button className="primary" onClick={() => go('#/read')}><Icon name="book" size={18} /> افتح المصحف</button>
        </section>
      )}

      {run && !run.completed && (
        <section className="card">
          <div className="section-head"><h3><Icon name="repeat" size={20} /> جلسة لم تكتمل</h3></div>
          <p className="ref">{rangeLabel(run.plan.surah, run.plan.from, run.plan.to, kufi)} · {arNum(run.done)} من {arNum(run.plan.target)}</p>
          <button className="primary" onClick={() => { sfx('tap'); go(`#/read/${run.plan.surah}/${run.plan.from}`); }}><Icon name="play" size={18} /> تابعها</button>
        </section>
      )}

      {due.length > 0 && (
        <section className="card">
          <div className="section-head"><h3><Icon name="bell" size={20} /> تنتظر المراجعة</h3><span className="badge heavy">{arNum(due.reduce((n, r) => n + r.keys.length, 0))} آية</span></div>
          <ul className="memo-list">
            {due.map((r) => (
              <li key={`${r.surah}:${r.from}`}>
                <span>{rangeLabel(r.surah, r.from, r.to, kufi)}</span>
                <button className="toggle" onClick={() => open(r, { target: 10, review: true, gap: 'none', veil: false })}>راجع ×{arNum(10)}</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {doing.length > 0 && (
        <section className="card">
          <div className="section-head"><h3><Icon name="timer" size={20} /> قيد الحفظ</h3></div>
          <ul className="memo-list">
            {doing.map((r) => (
              <li key={`${r.surah}:${r.from}`}>
                <span>{rangeLabel(r.surah, r.from, r.to, kufi)}<small>{arNum(r.reps)} تكرارًا</small></span>
                <button className="toggle" onClick={() => open(r, { target: Math.max(100, Math.ceil((r.reps + 1) / 50) * 50) })}>كمّل</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <div className="section-head"><h3><Icon name="library" size={20} /> السور</h3><span className="ref">{arNum(t.doing)} قيد الحفظ</span></div>
        <div className="memo-grid" role="list">
          {tallies.map((s) => {
            const d = (s.done / s.total) * 100, w = ((s.done + s.doing) / s.total) * 100;
            return (
              <button key={s.number} role="listitem" className={`memo-tile${s.done === s.total ? ' full' : ''}`} style={{ background: `linear-gradient(to top, var(--primary-soft) ${d}%, var(--accent-soft) ${d}% ${w}%, transparent ${w}%)` }} onClick={() => { sfx('tap'); go(`#/read/${s.number}/1`); }} aria-label={`${SURAH_BY_NUMBER[s.number].name}: ${arNum(s.done)} من ${arNum(s.total)} محفوظة`}>
                <b>{arNum(s.number)}</b>
                {s.done + s.doing > 0 && <small>{arNum(s.done)}/{arNum(s.total)}</small>}
              </button>
            );
          })}
        </div>
        <p className="memo-legend"><i className="done" /> محفوظة <i className="doing" /> قيد الحفظ</p>
      </section>

      <section className="card">
        <div className="section-head"><h3><Icon name="flame" size={20} /> التكرار في آخر ١٤ يومًا</h3></div>
        <div className="memo-days" role="img" aria-label="عدد مرات التكرار في كل يوم">
          {days.map((d) => <span key={d.key} className={d.today ? 'today' : ''} title={`${arNum(d.reps)} تكرارًا`}><i style={{ height: `${d.reps ? Math.max(8, (d.reps / maxDay) * 100) : 3}%` }} /></span>)}
        </div>
      </section>
    </div>
  );
}
