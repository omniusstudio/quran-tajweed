import { useEffect, useState } from 'react';
import { SURAH_BY_NUMBER } from '../audio/quran';
import { readProgress } from '../content/progress';
import { PACE_LABEL, PACE_QUARTERS, TOTAL_QUARTERS, completePortion, khatmDate, markRead, orderIndex, paceQuarters, restartWird, todayPortion, updateWird, wirdState, wirdStreak, wirdWeek, type Pace } from '../content/wird';
import { Icon } from '../ui/icons';
import { rewardWird } from '../ui/rewards';
import { sfx } from '../ui/sound';
import { arNum } from './shared';

const DAY_NAMES = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

export function useWird() {
  const [, force] = useState(0);
  useEffect(() => {
    const on = () => force((n) => n + 1);
    addEventListener('nutq:progress', on);
    return () => removeEventListener('nutq:progress', on);
  }, []);
  return wirdState(readProgress());
}

export function fmtDate(d: Date) {
  return d.toLocaleDateString('ar-u-nu-arab', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** The daily wird (#/wird): today's portion, reading view, pace, streak, khatm. */
export function WirdPage({ go }: { go: (hash: string) => void }) {
  const w = useWird();
  const p = todayPortion(w);
  const streak = wirdStreak(w);
  const week = wirdWeek(w);
  const [reading, setReading] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const readIdx = w.pos ? orderIndex(w.pos) : -1;
  const first = p.first;
  /** Where "listen with the reciter" should start: the verse after the last one read, inside the portion. */
  const listenAt = first ? (w.pos && orderIndex(w.pos) >= orderIndex(first.first) ? nextAfter(w.pos) : first.first) : null;

  const readUpTo = (surah: number, basri: number) => {
    const ev = markRead({ surah, basri });
    if (ev.advanced) {
      sfx('tap');
      rewardWird(ev);
    }
  };

  return (
    <div className="page wird">
      <header className="page-head">
        <span className="eyebrow">الورد اليومي</span>
        <h2 className="page-title">{p.title}</h2>
        {p.segments.length > 0 && (
          <p className="ref">
            {p.segments.map((s, i) => (
              <span key={i}>
                {i > 0 && ' · '}
                {s.surahName} {arNum(s.from)}{s.to !== s.from ? `–${arNum(s.to)}` : ''}
              </span>
            ))}
          </p>
        )}
      </header>

      <div className="hifz-stats">
        <span className={`stat${streak > 0 ? ' on' : ''}`}><Icon name="flame" size={18} /> {streak > 0 ? `${arNum(streak)} ${streak === 1 ? 'يوم' : streak === 2 ? 'يومان' : streak <= 10 ? 'أيام' : 'يوماً'} على الورد` : 'ابدأ وردك اليوم'}</span>
        <span className="stat"><Icon name="book" size={18} /> {arNum(w.posQ)} / {arNum(TOTAL_QUARTERS)} ربعاً</span>
        {w.khatms > 0 && <span className="stat"><Icon name="trophy" size={18} /> {arNum(w.khatms)} {w.khatms === 1 ? 'ختمة' : w.khatms === 2 ? 'ختمتان' : 'ختمات'}</span>}
      </div>

      <section className="card wird-today">
        <div className="section-head">
          <h3>{p.complete ? 'وردك اليوم تام' : 'ورد اليوم'}</h3>
          <span className="badge neutral">{arNum(p.done)} / {arNum(p.target)} {p.target === 1 ? 'ربع' : 'أرباع'}</span>
        </div>
        <span className="bar" aria-hidden><i style={{ transform: `scaleX(${p.target ? p.done / p.target : 1})` }} /></span>
        <p className="ref" style={{ marginBlockStart: 8 }}>
          الختمة بهذا الإيقاع: <strong>{fmtDate(khatmDate(w))}</strong>
        </p>
        <div className="row wrap" style={{ marginBlockStart: 10 }}>
          {first && listenAt && (
            <>
              <button className="primary" onClick={() => { sfx('tap'); setReading((r) => !r); }}>
                <Icon name="book" size={18} /> {reading ? 'أخفِ النص' : 'اقرأ الورد'}
              </button>
              <button className="toggle" onClick={() => go(`#/follow/${listenAt.surah}/${listenAt.basri}`)}>
                <Icon name="headphones" size={18} /> اسمع مع القارئ
              </button>
              {!p.complete && (
                <button className="toggle" onClick={() => { const ev = completePortion(); sfx('toggle'); rewardWird(ev); }}>
                  <Icon name="check" size={18} /> أتممت الورد
                </button>
              )}
            </>
          )}
        </div>
        {reading && p.segments.length > 0 && (
          <div className="mushaf wird-text" dir="rtl">
            <p className="ref">اضغط رقم الآية التي وصلت إليها: «قرأت حتى هنا».</p>
            {p.segments.map((seg) => {
              const s = SURAH_BY_NUMBER[seg.surah];
              return (
                <div key={`${seg.surah}:${seg.from}`} className="wird-surah">
                  <h4 className="wird-surah-name">{s.name}</h4>
                  {seg.from === 1 && s.header && <div className="verse header"><span className="ayah">{s.header}</span></div>}
                  <div className="ayah wird-run">
                    {s.verses.filter((v) => v.basri >= seg.from && v.basri <= seg.to).map((v) => {
                      const read = orderIndex({ surah: seg.surah, basri: v.basri }) <= readIdx;
                      return (
                        <span key={v.basri} className={`wird-verse${read ? ' read' : ''}`}>
                          {v.words.join(' ')}{' '}
                          <button className="num-btn" onClick={() => readUpTo(seg.surah, v.basri)} title="قرأت حتى هنا" aria-label={`قرأت حتى الآية ${arNum(v.basri)}`}>
                            ﴿{arNum(v.basri)}﴾
                          </button>{' '}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="card">
        <h3>هذا الأسبوع</h3>
        <div className="week" aria-label="الأسبوع الأخير">
          {week.map((d) => {
            const date = new Date(d.key + 'T12:00:00');
            return (
              <div key={d.key} className={`day${d.today ? ' today' : ''}`}>
                <span className={`dot${d.done ? ' goal' : d.read > 0 ? ' on' : ''}`} aria-label={`${arNum(d.read)} أرباع`}>
                  {d.done ? <Icon name="check" size={18} /> : d.read > 0 ? <Icon name="record" size={10} /> : ''}
                </span>
                <span>{DAY_NAMES[date.getDay()]}</span>
              </div>
            );
          })}
        </div>
        <p className="ref" style={{ marginBlockStart: 8 }}>يوم واحد يفوتك لا يقطع السلسلة؛ يومان متتاليان يقطعانها.</p>
      </section>

      <section className="card">
        <h3>الإيقاع</h3>
        <div className="setting">
          <span className="label"><Icon name="target" /><span>كم تقرأ كل يوم<small>الختمة في {arNum(Math.ceil(TOTAL_QUARTERS / paceQuarters({ ...w })))} يوماً بهذا الإيقاع</small></span></span>
          <div className="segmented" role="group">
            {(Object.keys(PACE_QUARTERS) as Pace[]).map((k) => (
              <button key={k} aria-pressed={!w.ramadan && w.pace === k} disabled={w.ramadan} onClick={() => { updateWird({ pace: k }); sfx('toggle'); }}>{PACE_LABEL[k]}</button>
            ))}
          </div>
        </div>
        <div className="setting">
          <span className="label"><Icon name="moon" /><span>وضع رمضان<small>جزء كل يوم: ختمة في الشهر</small></span></span>
          <button className="switch" role="switch" aria-checked={w.ramadan} aria-label="وضع رمضان" onClick={() => { updateWird({ ramadan: !w.ramadan }); sfx('toggle'); }} />
        </div>
        <div className="setting">
          <span className="label"><Icon name="clock" /><span>تذكير يومي<small>يظهر إشعار في هذا الوقت ما دام التطبيق مفتوحاً ولم يتم الورد</small></span></span>
          <span className="row">
            <input type="time" value={w.reminder ?? ''} onChange={(e) => { updateWird({ reminder: e.target.value || null }); if (e.target.value && 'Notification' in window && Notification.permission === 'default') void Notification.requestPermission(); }} aria-label="وقت التذكير" />
            {w.reminder && <button className="mini" onClick={() => updateWird({ reminder: null })}>إلغاء</button>}
          </span>
        </div>
        <div className="setting">
          <span className="label"><Icon name="refresh" /><span>ابدأ الختمة من جديد<small>يبقى عدد الختمات والتاريخ</small></span></span>
          {confirmRestart ? (
            <span className="row">
              <button className="toggle" onClick={() => setConfirmRestart(false)}>تراجع</button>
              <button className="danger" onClick={() => { restartWird(); setConfirmRestart(false); sfx('toggle'); }}>نعم، من الفاتحة</button>
            </span>
          ) : (
            <button className="toggle" onClick={() => setConfirmRestart(true)}>من الفاتحة</button>
          )}
        </div>
      </section>
    </div>
  );
}

/** The verse after `ref` in muṣḥaf order (or itself at the very end). */
function nextAfter(ref: { surah: number; basri: number }) {
  const s = SURAH_BY_NUMBER[ref.surah];
  const k = s.verses.findIndex((v) => v.basri === ref.basri);
  if (k >= 0 && k + 1 < s.verses.length) return { surah: ref.surah, basri: s.verses[k + 1].basri };
  const n = SURAH_BY_NUMBER[ref.surah + 1];
  return n ? { surah: n.number, basri: n.verses[0].basri } : ref;
}
