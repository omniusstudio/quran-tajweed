import { useMemo } from 'react';
import { SECTIONS } from '../content/lessons';
import { readProgress, recentDays, streak, useProgress } from '../content/progress';
import { loadDeck } from '../exercises/leitner';
import { useSettings } from '../ui/settings';
import { Icon } from '../ui/icons';
import { arNum } from './shared';

const ORDER: string[] = SECTIONS.flatMap((s) => s.rules.map((r) => r.id));
const DAY_NAMES = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

/** Today's practice ring. */
export function GoalRing({ value, goal, size = 112 }: { value: number; goal: number; size?: number }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const frac = Math.min(1, goal ? value / goal : 0);
  return (
    <div className={`ring${frac >= 1 ? ' done' : ''}${frac <= 0 ? ' empty' : ''}`} style={{ width: size, height: size }} role="img" aria-label={`اليوم ${arNum(value)} من ${arNum(goal)} نقاط`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className="track" cx={size / 2} cy={size / 2} r={r} />
        <circle className="fill" cx={size / 2} cy={size / 2} r={r} strokeDasharray={c} strokeDashoffset={c * (1 - frac)} />
      </svg>
      <div className="center">
        <strong>{arNum(value)}</strong>
        <small>من {arNum(goal)}</small>
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'صباح الخير' : h < 18 ? 'مساء الخير' : 'مساء النور';
}

/** Landing screen: today's goal, the streak, where to continue, and progress by section. */
export function HomePage({ go }: { go: (hash: string) => void }) {
  const [progress] = useProgress();
  const [settings] = useSettings();
  const p = readProgress();
  const days = recentDays(p);
  const today = days[days.length - 1].points;
  const st = streak(p);
  const done = ORDER.filter((id) => progress.done[id]).length;
  const next = progress.last && ORDER.includes(progress.last) ? progress.last : ORDER[0];
  const nextRule = SECTIONS.flatMap((s) => s.rules).find((r) => r.id === next);
  const due = useMemo(() => {
    const deck = loadDeck();
    const now = Date.now();
    return Object.values(deck).filter((c) => c.due <= now).length;
  }, []);
  const allDone = done === ORDER.length;

  return (
    <div className="page home stagger">
      <div className="card hero home-card">
        <div className="home-hero">
          <div>
            <h2>{greeting()}</h2>
            <p className="ref">
              {today >= settings.dailyGoal ? 'أنجزت هدف اليوم. ما تزيده الآن يثبّت ما تعلمته.' : today > 0 ? 'بدأت اليوم، فأكمل حتى الهدف.' : 'خطوة صغيرة كل يوم أفضل من جلسة طويلة كل أسبوع.'}
            </p>
            <div className="home-stats">
              <span className={`stat${st > 0 ? ' on' : ''}`}>
                <Icon name="flame" size={18} /> {st > 0 ? `${arNum(st)} ${st === 1 ? 'يوم' : st === 2 ? 'يومان' : st <= 10 ? 'أيام' : 'يوماً'} متتالية` : 'ابدأ سلسلتك اليوم'}
              </span>
              <span className="stat">
                <Icon name="book" size={18} /> {arNum(done)} / {arNum(ORDER.length)} خطوة
              </span>
              {due > 0 && (
                <span className="stat">
                  <Icon name="clock" size={18} /> {arNum(due)} للمراجعة
                </span>
              )}
            </div>
          </div>
          <GoalRing value={today} goal={settings.dailyGoal} size={typeof matchMedia === 'function' && matchMedia('(min-width: 1024px)').matches ? 156 : 112} />
        </div>
        <div className="home-cta">
          <button className="primary" onClick={() => go(allDone ? '#/practice' : `#/lessons/${next}`)}>
            <Icon name="play" size={18} />
            {allDone ? 'إلى التدريب' : progress.last ? 'أكمل من حيث توقفت' : 'ابدأ الدرس الأول'}
          </button>
          {nextRule && !allDone && <span className="ref">{nextRule.name}</span>}
        </div>
        <div className="week" aria-label="الأسبوع الأخير">
          {days.map((d) => {
            const date = new Date(d.key + 'T12:00:00');
            return (
              <div key={d.key} className={`day${d.today ? ' today' : ''}`}>
                <span className={`dot${d.points >= settings.dailyGoal ? ' goal' : d.points > 0 ? ' on' : ''}`} aria-label={`${arNum(d.points)} نقاط`}>
                  {d.points >= settings.dailyGoal ? <Icon name="check" size={18} /> : d.points > 0 ? <Icon name="record" size={10} /> : ''}
                </span>
                <span>{DAY_NAMES[date.getDay()]}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card home-quick">
        <h3>ابدأ من هنا</h3>
        <div className="quick">
          <button className="quick-card" onClick={() => go('#/exercises')}>
            <Icon name="target" />
            <strong>التمارين</strong>
            <small>{due > 0 ? `${arNum(due)} سؤالاً حان وقت مراجعته` : 'أسئلة من المصحف نفسه'}</small>
          </button>
          <button className="quick-card" onClick={() => go('#/follow/1')}>
            <Icon name="headphones" />
            <strong>المتابعة</strong>
            <small>اقرأ مع القارئ كلمة كلمة</small>
          </button>
          <button className="quick-card" onClick={() => go('#/letters/qaf')}>
            <Icon name="face" />
            <strong>الحروف</strong>
            <small>شاهد الفم من ثلاث جهات</small>
          </button>
          <button className="quick-card" onClick={() => go('#/drills')}>
            <Icon name="zap" />
            <strong>تدريبات الدوري</strong>
            <small>الإمالة والتسهيل وما يميز الرواية</small>
          </button>
        </div>
      </div>

      <div className="card home-lessons">
        <div className="section-head">
          <h3>الدروس</h3>
          <span className="badge neutral">{arNum(done)} / {arNum(ORDER.length)}</span>
        </div>
        <div className="section-progress">
          {SECTIONS.map((s, i) => {
            const d = s.rules.filter((r) => progress.done[r.id]).length;
            const first = s.rules.find((r) => !progress.done[r.id]) ?? s.rules[0];
            return (
              <a key={s.id} href={`#/lessons/${first.id}`} onClick={(e) => { e.preventDefault(); go(`#/lessons/${first.id}`); }}>
                <span className={`num${d === s.rules.length ? ' done' : ''}`}>{d === s.rules.length ? <Icon name="check" size={16} /> : arNum(i + 1)}</span>
                <span>
                  {s.title}
                  <span className="bar" aria-hidden><i style={{ transform: `scaleX(${s.rules.length ? d / s.rules.length : 0})` }} /></span>
                </span>
                <span className="ref">{arNum(d)}/{arNum(s.rules.length)}</span>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
