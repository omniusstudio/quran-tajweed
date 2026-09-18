import { useEffect, useState } from 'react';
import { SURAH_BY_NUMBER } from '../audio/quran';
import { SLOT_TITLES, setTodo, slotNow, summary, todoStreak, todosFor, type Slot, type Todo } from '../content/daily';
import { WEEKDAYS, formatGregorian, formatHijri, toHijri } from '../content/hijri';
import { upcoming } from '../content/occasions';
import { PRAYER_NAMES, clock, next as nextPrayer, timesFor, type PrayerKey } from '../content/prayer';
import { logActivity, useProgress } from '../content/progress';
import { celebrate } from '../ui/celebrate';
import { AdhanPlay } from '../ui/AdhanPlay';
import { Icon } from '../ui/icons';
import { useSettings } from '../ui/settings';
import { sfx } from '../ui/sound';
import { HadithQuote, arNum } from './shared';

function countdown(ms: number) {
  const m = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(m / 60);
  return h > 0 ? `${arNum(h)} س ${arNum(m % 60)} د` : `${arNum(m)} دقيقة`;
}

/** Top of the home page: the Hijri date, what today is, the next prayer, and the way back to the bookmark. */
export function DayStrip({ go }: { go: (hash: string) => void }) {
  const [settings] = useSettings();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  const offset = settings.hijriOffset ?? 0;
  const hijri = toHijri(now, offset);
  const { occasions } = todosFor(now);
  const main = occasions[0];
  const soon = upcoming(now, 10, offset)[0];
  const times = timesFor(now, settings);
  const nxt = nextPrayer(now, settings);
  const bm = settings.bookmark;
  return (
    <section className="day-strip" aria-label="اليوم">
      <button className="day-date" onClick={() => go('#/calendar')}>
        <span className="hijri-day">{arNum(hijri.day)}</span>
        <span>
          <strong>{WEEKDAYS[now.getDay()]}، {formatHijri(hijri)}</strong>
          <small>{formatGregorian(now)}</small>
        </span>
        <Icon name="chevronLeft" size={18} />
      </button>
      {main ? (
        <button className={`day-occasion kind-${main.kind}`} onClick={() => go('#/calendar')}>
          <Icon name={main.kind === 'eid' ? 'sparkles' : main.kind === 'friday' ? 'star' : 'crescent'} size={20} />
          <span>
            <strong>{main.title}</strong>
            <small>{main.why}</small>
          </span>
        </button>
      ) : soon ? (
        <button className="day-occasion soon" onClick={() => go('#/calendar')}>
          <Icon name="bell" size={20} />
          <span>
            <strong>{soon.inDays === 1 ? 'غداً' : `بعد ${arNum(soon.inDays)} أيام`}: {soon.occasion.title.replace(/ \(.*\)$/, '')}</strong>
            <small>{soon.occasion.why}</small>
          </span>
        </button>
      ) : null}
      {times && nxt ? (
        <div className="day-prayer">
          <button className="np" onClick={() => go('#/settings')} aria-label="أوقات الصلاة: افتح الإعدادات">
            <small>الصلاة القادمة</small>
            <strong>{PRAYER_NAMES[nxt.key]} {clock(nxt.at)}</strong>
            <small>بعد {countdown(nxt.at.getTime() - now.getTime())}{settings.place?.name ? ` · ${settings.place.name.split('،')[0]}` : ''}</small>
          </button>
          <div className="prayer-row compact">
            {(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as PrayerKey[]).map((k) => (
              <span key={k} className={k === nxt.key ? 'next' : ''}><small>{PRAYER_NAMES[k]}</small>{clock(times[k])}</span>
            ))}
          </div>
          <AdhanPlay className="mini adhan-play" onMissing={() => go('#/settings')} />
        </div>
      ) : (
        <button className="day-prayer empty" onClick={() => go('#/settings')}>
          <Icon name="mapPin" size={20} />
          <span><strong>أوقات الصلاة والأذان</strong><small>حدّد موقعك مرة واحدة من الإعدادات</small></span>
        </button>
      )}
      {bm && (
        <button className="primary bookmark-go" onClick={() => { sfx('tap'); go(`#/follow/${bm.surah}/${bm.basri}`); }}>
          <Icon name="bookmark" size={18} />
          <span>تابع من علامتي: {SURAH_BY_NUMBER[bm.surah]?.name.replace(/^سُورَةُ\s*/, '') ?? ''}، الآية {arNum(bm.basri)}</span>
        </button>
      )}
    </section>
  );
}

function TodoRow({ t, go, onToggle }: { t: Todo; go: (h: string) => void; onToggle: (t: Todo) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <li className={`todo-row${t.done ? ' done' : ''}`}>
      <button className="tick" role="checkbox" aria-checked={t.done} aria-label={t.title} disabled={t.auto} onClick={() => onToggle(t)} title={t.auto ? 'يُعلَّم تلقائياً حين تُتمّه' : undefined}>
        {t.done && <Icon name="check" size={18} />}
      </button>
      <div className="todo-main">
        <button className="todo-title" onClick={() => (t.link ? go(t.link) : onToggle(t))}>
          <strong>{t.title}</strong>
          {t.optional && <span className="badge neutral">تطوّع</span>}
          {t.detail && <small>{t.detail}</small>}
        </button>
        {open && t.hadith?.map((id) => <HadithQuote key={id} id={id} />)}
      </div>
      {t.hadith && t.hadith.length > 0 && (
        <button className="icon-btn why-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)} aria-label="لماذا؟" title="لماذا؟">
          <Icon name={open ? 'chevronDown' : 'quote'} size={18} />
        </button>
      )}
      {t.link && (
        <button className="icon-btn" onClick={() => go(t.link!)} aria-label={`افتح: ${t.title}`}>
          <Icon name="chevronLeft" size={18} />
        </button>
      )}
    </li>
  );
}

/** The day's checklist, grouped by the time of day; ticking the last required item finishes the day. */
export function TodayChecklist({ go }: { go: (hash: string) => void }) {
  const [progress] = useProgress();
  const { todos } = todosFor(new Date(), progress);
  const sum = summary(todos);
  const streak = todoStreak(progress);
  const current = slotNow();
  const toggle = (t: Todo) => {
    if (t.auto) return;
    const finished = setTodo(t.id, !t.done);
    sfx(t.done ? 'toggle' : 'correct');
    if (finished) {
      logActivity('todos');
      celebrate({ kind: 'goal', title: 'أتممت مهام اليوم', text: 'يوم كامل: ذكر وقرآن وعمل. ثبّتك الله.' });
    }
  };
  const slots = (['morning', 'day', 'evening', 'night'] as Slot[]).map((s) => ({ s, list: todos.filter((t) => t.slot === s) })).filter((g) => g.list.length);
  return (
    <section className="card checklist span" aria-label="مهام اليوم">
      <div className="section-head">
        <h3><Icon name="listChecks" size={20} /> مهام اليوم</h3>
        <span className="row">
          {streak > 0 && <span className="badge heavy"><Icon name="flame" size={14} /> {arNum(streak)}</span>}
          <span className={`badge${sum.complete ? '' : ' neutral'}`}>{arNum(sum.done)} / {arNum(sum.total)}</span>
        </span>
      </div>
      <span className="bar" aria-hidden><i style={{ transform: `scaleX(${sum.total ? sum.done / sum.total : 0})` }} /></span>
      <p className="ref checklist-lead">{sum.complete ? 'اكتمل يومك. ما زاد فهو خير.' : `بقي ${arNum(sum.left.length)}: ${sum.left.slice(0, 3).map((t) => t.title).join('، ')}${sum.left.length > 3 ? '…' : ''}`}</p>
      <div className="todo-groups">
        {slots.map(({ s, list }) => (
          <div key={s} className={`todo-group${s === current ? ' now' : ''}`}>
            <h4>{SLOT_TITLES[s]}{s === current && <span className="badge">الآن</span>}</h4>
            <ul>
              {list.map((t) => <TodoRow key={t.id} t={t} go={go} onToggle={toggle} />)}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
