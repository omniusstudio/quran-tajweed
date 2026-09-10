import { useMemo } from 'react';
import { SURAHS, SURAH_BY_NUMBER } from '../audio/quran';
import { SECTIONS } from '../content/lessons';
import { dayKey, readProgress, recentDays, streak, useProgress } from '../content/progress';
import { loadDeck } from '../exercises/leitner';
import { useSettings } from '../ui/settings';
import { Icon } from '../ui/icons';
import { arNum } from './shared';
import { VerseDrill } from './VerseDrill';
import { DuaCard } from './DuaCard';
import { challenges, currentChallenge, dueReviews, hifzState, versesMemorized } from '../content/hifz';
import { todayPortion, wirdState, wirdStreak } from '../content/wird';

const ORDER: string[] = SECTIONS.flatMap((s) => s.rules.map((r) => r.id));
const DAY_NAMES = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

/** Today's practice ring. */
export function GoalRing({ value, goal, size = 112 }: { value: number; goal: number; size?: number }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const frac = Math.min(1, goal ? value / goal : 0);
  const small = size < 80;
  return (
    <div className={`ring${frac >= 1 ? ' done' : ''}${frac <= 0 ? ' empty' : ''}`} style={{ width: size, height: size }} role="img" aria-label={`اليوم ${arNum(value)} من ${arNum(goal)} نقاط`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className="track" cx={size / 2} cy={size / 2} r={r} />
        <circle className="fill" cx={size / 2} cy={size / 2} r={r} strokeDasharray={c} strokeDashoffset={c * (1 - frac)} />
      </svg>
      {!small && (
        <div className="center">
          <strong>{arNum(value)}</strong>
          <small>من {arNum(goal)}</small>
        </div>
      )}
      {small && <div className="center" style={{ fontSize: '.8rem', fontWeight: 700 }}>{arNum(value)}</div>}
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'صباح الخير' : h < 18 ? 'مساء الخير' : 'مساء النور';
}

/** A short verse from the v1 text, changing daily; the muṣḥaf itself as the centrepiece. */
function verseOfDay() {
  const pool = SURAHS.flatMap((s) => s.verses.filter((v) => v.words.length >= 3 && v.words.length <= 9).map((v) => ({ surah: s.number, surahName: s.name, ...v })));
  const key = dayKey();
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return pool[h % pool.length];
}

/** Landing screen: today's goal and streak, a verse to hear, the lessons as a journey, four doors. */
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
  const nextSection = SECTIONS.find((s) => s.rules.some((r) => r.id === next));
  const due = useMemo(() => {
    const now = Date.now();
    return Object.values(loadDeck()).filter((c) => c.due <= now).length;
  }, []);
  const verse = useMemo(verseOfDay, []);
  const hifz = hifzState(p);
  const wird = wirdState(p);
  const portion = todayPortion(wird);
  const wirdStreakN = wirdStreak(wird);
  const challenge = currentChallenge(hifz);
  const reviewsDue = dueReviews(hifz).length;
  const allDone = done === ORDER.length;
  const wide = typeof matchMedia === 'function' && matchMedia('(min-width: 1024px)').matches;
  const rows = [SECTIONS.slice(0, 7), SECTIONS.slice(7)];

  return (
    <div className="page home">
      <DuaCard go={go} />
      <section className="today-panel">
        <div className="today-grid">
          <div>
            <h2 className="greet">{greeting()}</h2>
            <p className="lead">
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
          <GoalRing value={today} goal={settings.dailyGoal} size={wide ? 168 : 100} />
        </div>
        <div className="next-up">
          <button className="primary" onClick={() => go(allDone ? '#/practice' : `#/lessons/${next}`)}>
            <Icon name="play" size={18} />
            {allDone ? 'إلى التدريب' : progress.last ? 'أكمل من حيث توقفت' : 'ابدأ الدرس الأول'}
          </button>
          {nextRule && !allDone && (
            <span className="what">
              <small>{nextSection?.title}</small>
              <strong>{nextRule.name}</strong>
            </span>
          )}
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
      </section>

      <div className="home-grid">
        <section className="journey-card span">
          <div className="section-head">
            <h3>رحلة الدروس</h3>
            <span className="badge neutral">{arNum(done)} / {arNum(ORDER.length)}</span>
          </div>
          {rows.map((row, ri) => (
            <div key={ri} className="journey-row">
              {row.map((s) => {
                const i = SECTIONS.indexOf(s);
                const d = s.rules.filter((r) => progress.done[r.id]).length;
                const first = s.rules.find((r) => !progress.done[r.id]) ?? s.rules[0];
                const isDone = d === s.rules.length;
                const isNow = !isDone && s.id === nextSection?.id;
                return (
                  <a key={s.id} className={`station${isDone ? ' done' : ''}${isNow ? ' now' : ''}`} href={`#/lessons/${first.id}`} onClick={(e) => { e.preventDefault(); go(`#/lessons/${first.id}`); }} title={s.title}>
                    <span className="pin">{isDone ? <Icon name="check" size={20} /> : arNum(i + 1)}</span>
                    <span className="name">{s.title.replace(/^[٠-٩0-9]+[.،]\s*/, '')}</span>
                    <span className="cnt">{arNum(d)}/{arNum(s.rules.length)}</span>
                  </a>
                );
              })}
            </div>
          ))}
        </section>

        <div>
          <section className="card wird-card">
            <div className="section-head">
              <h3><Icon name="calendar" size={20} /> وردك اليوم</h3>
              {wirdStreakN > 0 && <span className="badge"><Icon name="flame" size={14} /> {arNum(wirdStreakN)}</span>}
            </div>
            <p className="challenge-title">{portion.title}</p>
            {portion.segments.length > 0 && <p className="ref">{portion.segments.map((s) => `${s.surahName} ${arNum(s.from)}${s.to !== s.from ? `–${arNum(s.to)}` : ''}`).join(' · ')}</p>}
            <span className="bar" aria-hidden><i style={{ transform: `scaleX(${portion.target ? portion.done / portion.target : 1})` }} /></span>
            <div className="row wrap" style={{ marginBlockStart: 10 }}>
              <button className="primary" onClick={() => go('#/wird')}><Icon name={portion.complete ? 'check' : 'book'} size={18} /> {portion.complete ? 'تم ورد اليوم' : 'اقرأ الورد'}</button>
              <span className="ref">{arNum(portion.done)} / {arNum(portion.target)} {portion.target === 1 ? 'ربع' : 'أرباع'}</span>
            </div>
          </section>
          <section className="card challenge-card">
            <div className="section-head">
              <h3><Icon name="star" size={20} /> تحدي الحفظ اليومي</h3>
              {reviewsDue > 0 && <span className="badge heavy">{arNum(reviewsDue)} للمراجعة</span>}
            </div>
            {challenge ? (
              <>
                <p className="ref">{arNum(challenge.index)} من {arNum(challenges().length)} · {arNum(versesMemorized(hifz))} آية محفوظة</p>
                <p className="challenge-title">{challenge.surahName}، {challenge.verses.length === 1 ? `الآية ${arNum(challenge.verses[0])}` : `الآيات ${arNum(challenge.verses[0])}–${arNum(challenge.verses[challenge.verses.length - 1])}`}</p>
              </>
            ) : (
              <p className="ref">أتممت المسار كله.</p>
            )}
            <button className="primary" onClick={() => go('#/hifz')}><Icon name="play" size={18} /> {reviewsDue > 0 && !challenge ? 'راجع' : 'ابدأ تحدي اليوم'}</button>
          </section>
          <section className="verse-card">
            <span className="eyebrow">آية اليوم</span>
            <p className="ref" style={{ textAlign: 'center', margin: 0 }}>{verse.surahName}، الآية {arNum(verse.basri)}</p>
            <VerseDrill surah={verse.surah} verses={[verse.basri]} reciter={settings.reciter} clipKey={`me/verse/${verse.surah}/${verse.basri}`} />
            <div className="ref" style={{ justifyContent: 'center', display: 'flex' }}>
              <a href={`#/follow/${verse.surah}`} onClick={(e) => { e.preventDefault(); go(`#/follow/${verse.surah}`); }}>افتح السورة في المتابعة</a>
            </div>
          </section>
        </div>

        <div className="tiles">
          <button className="tile" onClick={() => go('#/exercises')}>
            <Icon name="target" />
            <strong>التمارين</strong>
            <small>{due > 0 ? `${arNum(due)} سؤالاً حان وقت مراجعته` : 'أسئلة من المصحف نفسه'}</small>
          </button>
          <button className="tile" onClick={() => go(settings.bookmark ? `#/follow/${settings.bookmark.surah}/${settings.bookmark.basri}` : `#/follow/${settings.lastSurah || 1}`)}>
            <Icon name={settings.bookmark ? 'bookmark' : 'headphones'} />
            <strong>المتابعة</strong>
            <small>{settings.bookmark ? `علامتك: ${SURAH_BY_NUMBER[settings.bookmark.surah]?.name ?? ''}، الآية ${arNum(settings.bookmark.basri)}` : 'اقرأ مع القارئ كلمة كلمة'}</small>
          </button>
          <button className="tile" onClick={() => go('#/letters/qaf')}>
            <Icon name="face" />
            <strong>الحروف</strong>
            <small>شاهد الفم من ثلاث جهات</small>
          </button>
          <button className="tile" onClick={() => go('#/drills')}>
            <Icon name="zap" />
            <strong>تدريبات الدوري</strong>
            <small>الإمالة والتسهيل وما يميز الرواية</small>
          </button>
        </div>
      </div>
    </div>
  );
}
