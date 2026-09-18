import { useMemo, useState } from 'react';
import { HIJRI_MONTHS, WEEKDAYS, addDays, formatGregorian, formatHijri, monthDays, shiftMonth, toHijri } from '../content/hijri';
import { fastingOn, occasionsOn, upcoming, type Fasting, type Occasion } from '../content/occasions';
import { PRAYER_NAMES, clock, timesFor, type PrayerKey } from '../content/prayer';
import { dayKey } from '../content/progress';
import { Icon } from '../ui/icons';
import { useSettings } from '../ui/settings';
import { sfx } from '../ui/sound';
import { HadithQuote, arNum } from './shared';

const FAST_LABEL: Record<Fasting, string> = { recommended: 'يُستحب صيامه', obligatory: 'صيام واجب', forbidden: 'يحرم صيامه' };
const SHORT_DAYS = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

function inDaysLabel(n: number) {
  return n === 1 ? 'غداً' : n === 2 ? 'بعد غد' : `بعد ${arNum(n)} ${n <= 10 ? 'أيام' : 'يوماً'}`;
}

/** What a day is, why, and what to do on it. */
export function OccasionDetail({ o, go }: { o: Occasion; go: (hash: string) => void }) {
  return (
    <article className={`occasion kind-${o.kind}`}>
      <header>
        <h4>{o.title}</h4>
        {o.fasting && <span className={`badge ${o.fasting === 'forbidden' ? 'warn' : o.fasting === 'obligatory' ? 'heavy' : ''}`}>{FAST_LABEL[o.fasting]}</span>}
      </header>
      <p className="why">{o.why}</p>
      <h5>ماذا أفعل؟</h5>
      <ul className="actions">
        {o.actions.map((a) => (
          <li key={a}><Icon name="check" size={16} /> {a}</li>
        ))}
      </ul>
      {o.surahs?.map(([n, label]) => (
        <button key={n} className="mini" onClick={() => go(`#/follow/${n}`)}><Icon name="book" size={14} /> {label}</button>
      ))}
      {o.hadith.length > 0 && <h5>من السنة</h5>}
      {o.hadith.map((id) => <HadithQuote key={id} id={id} />)}
    </article>
  );
}

/** The Hijri month as a grid, the day's occasions with their hadith, and what is coming. */
export function CalendarPage({ go }: { go: (hash: string) => void }) {
  const [settings, update] = useSettings();
  const offset = settings.hijriOffset ?? 0;
  const today = useMemo(() => new Date(), []);
  const [view, setView] = useState<Date>(today);
  const [picked, setPicked] = useState<Date>(today);
  const days = useMemo(() => monthDays(view, offset), [view, offset]);
  const head = days[0].hijri;
  const lead = days[0].date.getDay();
  const pickedHijri = toHijri(picked, offset);
  const occasions = occasionsOn(pickedHijri, picked.getDay());
  const coming = useMemo(() => upcoming(today, 60, offset).slice(0, 6), [today, offset]);
  const isToday = dayKey(picked) === dayKey(today);
  const times = isToday ? timesFor(today, settings) : null;
  const pick = (d: Date) => { setPicked(d); sfx('tap'); };
  const gregSpan = `${formatGregorian(days[0].date)} – ${formatGregorian(days[days.length - 1].date)}`;

  return (
    <div className="page calendar">
      <div className="card hero cal-hero">
        <div>
          <span className="eyebrow">اليوم</span>
          <h2>{WEEKDAYS[today.getDay()]}، {formatHijri(toHijri(today, offset))}</h2>
          <p className="ref">{formatGregorian(today)}</p>
        </div>
        <button className="toggle" onClick={() => { setView(today); setPicked(today); }}><Icon name="calendar" size={18} /> اليوم</button>
      </div>

      <div className="cal-layout">
        <section className="card cal-card" aria-label="الشهر الهجري">
          <div className="cal-nav">
            <button className="icon-btn" onClick={() => setView(shiftMonth(view, -1, offset))} aria-label="الشهر السابق"><Icon name="chevronRight" /></button>
            <div className="cal-title">
              <strong>{HIJRI_MONTHS[head.month - 1]} {arNum(head.year)}</strong>
              <small>{gregSpan}</small>
            </div>
            <button className="icon-btn" onClick={() => setView(shiftMonth(view, 1, offset))} aria-label="الشهر التالي"><Icon name="chevronLeft" /></button>
          </div>
          <div className="cal-grid" role="grid">
            {SHORT_DAYS.map((d) => <span key={d} className="cal-dow" role="columnheader">{d}</span>)}
            {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />)}
            {days.map(({ date, hijri }) => {
              const list = occasionsOn(hijri, date.getDay());
              const fast = fastingOn(list);
              const eid = list.some((o) => o.kind === 'eid');
              const major = list.some((o) => o.major || o.kind === 'night');
              const k = dayKey(date);
              return (
                <button key={k} role="gridcell" className={`cal-day${k === dayKey(today) ? ' today' : ''}${k === dayKey(picked) ? ' picked' : ''}${eid ? ' eid' : ''}${date.getDay() === 5 ? ' friday' : ''}`} aria-pressed={k === dayKey(picked)} aria-label={`${formatHijri(hijri)}${list.length ? `: ${list.map((o) => o.title).join('، ')}` : ''}`} onClick={() => pick(date)}>
                  <strong>{arNum(hijri.day)}</strong>
                  <small>{arNum(date.getDate())}</small>
                  <span className="marks" aria-hidden>
                    {fast === 'recommended' && <i className="m fast" />}
                    {fast === 'obligatory' && <i className="m must" />}
                    {fast === 'forbidden' && <i className="m no" />}
                    {major && <i className="m star" />}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="cal-legend ref">
            <span><i className="m fast" /> صيام مستحب</span>
            <span><i className="m must" /> صيام واجب</span>
            <span><i className="m no" /> لا يُصام</span>
            <span><i className="m star" /> مناسبة</span>
          </div>
          <div className="setting cal-offset">
            <span className="label">
              <Icon name="crescent" />
              <span>
                ضبط التاريخ الهجري
                <small>الحساب على تقويم أم القرى. إن اختلفت رؤية الهلال في بلدك فقدّم يوماً أو أخّر.</small>
              </span>
            </span>
            <div className="stepper">
              <button className="icon-btn" onClick={() => update({ hijriOffset: Math.max(-2, offset - 1) })} aria-label="أخّر يوماً" disabled={offset <= -2}><Icon name="minus" size={18} /></button>
              <span>{offset === 0 ? 'بلا تعديل' : `${offset > 0 ? '+' : '−'}${arNum(Math.abs(offset))}`}</span>
              <button className="icon-btn" onClick={() => update({ hijriOffset: Math.min(2, offset + 1) })} aria-label="قدّم يوماً" disabled={offset >= 2}><Icon name="plus" size={18} /></button>
            </div>
          </div>
        </section>

        <div>
          <section className="card day-detail" aria-live="polite">
            <span className="eyebrow">{isToday ? 'اليوم' : WEEKDAYS[picked.getDay()]}</span>
            <h3>{WEEKDAYS[picked.getDay()]}، {formatHijri(pickedHijri)}</h3>
            <p className="ref">{formatGregorian(picked)}</p>
            {times && (
              <div className="prayer-row">
                {(['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as PrayerKey[]).map((k) => (
                  <span key={k}><small>{PRAYER_NAMES[k]}</small>{clock(times[k])}</span>
                ))}
              </div>
            )}
            {occasions.length === 0 && <p className="ref">يوم عادي من أيام السنة. وردك وأذكارك تكفيك.</p>}
            {occasions.map((o) => <OccasionDetail key={o.id} o={o} go={go} />)}
            {occasions.some((o) => o.fasting === 'recommended') && dayKey(addDays(picked, -1)) === dayKey(today) && <p className="todo"><Icon name="bell" size={16} /> غداً صيام مستحب: انوِ من الليل وتسحّر.</p>}
          </section>

          <section className="card">
            <h3>القادم</h3>
            <ul className="upcoming">
              {coming.map((u) => (
                <li key={u.occasion.id}>
                  <button onClick={() => { setView(u.date); pick(u.date); scrollTo({ top: 0, behavior: 'smooth' }); }}>
                    <span className="when">{inDaysLabel(u.inDays)}</span>
                    <span>
                      <strong>{u.occasion.title.replace(/ \(.*\)$/, '')}</strong>
                      <small>{WEEKDAYS[u.date.getDay()]}، {formatHijri(u.hijri)} · {formatGregorian(u.date)}</small>
                    </span>
                    <Icon name="chevronLeft" size={18} />
                  </button>
                </li>
              ))}
            </ul>
            <p className="ref">نصوص الأحاديث منقولة من مصادرها المذكورة تحت كل حديث. ما عليه علامة «يُراجع» لم يُطابق على نسخة مطبوعة بعد.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
