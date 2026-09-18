// The ambient screen: something calm to leave on a second display. A sky that follows the prayer
// times, a slow rotation of āyāt, Qur'anic supplications and hadith, the Hijri date, the next
// prayer on an arc of the day, what is coming, and how the day's checklist stands. It starts by
// itself after a quiet spell (Settings → شاشة السكون) and leaves on Escape or a click.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ambientItems, phaseAt, playlist, type AmbientItem } from '../content/ambient';
import { summary, todosFor } from '../content/daily';
import { HIJRI_MONTHS, WEEKDAYS, addDays, formatGregorian, toHijri } from '../content/hijri';
import { fastingOn, occasionsOn, upcoming } from '../content/occasions';
import { PRAYERS, PRAYER_NAMES, clock, next as nextPrayer, timesFor, type PrayerKey } from '../content/prayer';
import { useProgress } from '../content/progress';
import { PlayRange, arNum } from '../pages/shared';
import { Icon } from './icons';
import { Mark } from './Mark';
import { useSettings } from './settings';

const ROTATE_MS = 45000;
const KIND_LABEL: Record<AmbientItem['kind'], string> = { ayah: 'آية', dua: 'دعاء من القرآن', hadith: 'من السنة' };

function sizeClass(text: string) {
  const n = text.split(' ').length;
  return n <= 8 ? 'xl' : n <= 16 ? 'lg' : n <= 28 ? 'md' : 'sm';
}
function countdown(ms: number) {
  const m = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(m / 60);
  return h > 0 ? `${arNum(h)} س ${arNum(m % 60)} د` : `${arNum(m)} د`;
}
function inDays(n: number) {
  return n === 0 ? 'اليوم' : n === 1 ? 'غداً' : n === 2 ? 'بعد غد' : `بعد ${arNum(n)} ${n <= 10 ? 'أيام' : 'يوماً'}`;
}

/** The day from fajr (right) to ʿishāʾ (left) as an arc, the prayers as beads, the present as a light. */
function DayArc({ times, now, nextKey }: { times: Record<PrayerKey, Date>; now: Date; nextKey: PrayerKey | null }) {
  const a = times.fajr.getTime();
  const b = times.isha.getTime();
  const at = (t: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  const pt = (f: number) => ({ x: 200 + 180 * Math.cos(Math.PI * f), y: 104 - 88 * Math.sin(Math.PI * f) });
  const f = at(now.getTime());
  const inside = now.getTime() >= a && now.getTime() <= b;
  const me = pt(f);
  return (
    <svg className="amb-arc" viewBox="0 0 400 124" aria-hidden focusable="false">
      <path d="M380 104 A180 88 0 0 0 20 104" pathLength={1} className="track" />
      {inside && <path d="M380 104 A180 88 0 0 0 20 104" pathLength={1} className="done" strokeDasharray={`${f} 1`} />}
      <line x1="8" y1="104" x2="392" y2="104" className="horizon" />
      {(['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as PrayerKey[]).map((k) => {
        const p = pt(at(times[k].getTime()));
        return <circle key={k} cx={p.x} cy={p.y} r={k === 'sunrise' ? 2.2 : k === nextKey ? 5.5 : 3.6} className={`bead${k === nextKey ? ' next' : ''}${times[k].getTime() <= now.getTime() ? ' past' : ''}${k === 'sunrise' ? ' minor' : ''}`} />;
      })}
      {inside ? (
        <g className="sun">
          <circle cx={me.x} cy={me.y} r="13" className="halo" />
          <circle cx={me.x} cy={me.y} r="6" className="core" />
        </g>
      ) : (
        <g className="moon" transform="translate(200 78)">
          <path d="M6 -14 A15 15 0 1 0 14 8 A11.5 11.5 0 0 1 6 -14 Z" />
        </g>
      )}
    </svg>
  );
}

export function Ambient({ onExit }: { onExit: () => void }) {
  const [settings] = useSettings();
  const [progress] = useProgress();
  const root = useRef<HTMLDivElement | null>(null);
  const [now, setNow] = useState(() => new Date());
  const list = useMemo(() => playlist(ambientItems()), []);
  const [idx, setIdx] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [controls, setControls] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const [full, setFull] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(t);
  }, []);
  const advance = () => setIdx((i) => { setPrev(i); return (i + 1) % list.length; });
  useEffect(() => {
    const t = setInterval(advance, ROTATE_MS);
    return () => clearInterval(t);
  }, [list.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (prev === null) return;
    const t = setTimeout(() => setPrev(null), 1600);
    return () => clearTimeout(t);
  }, [prev]);

  // keep the display awake while the screen is up (where the browser allows it)
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const ask = () => {
      const wl = (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock;
      if (wl && !document.hidden) wl.request('screen').then((l) => { lock = l; }).catch(() => undefined);
    };
    ask();
    document.addEventListener('visibilitychange', ask);
    return () => { document.removeEventListener('visibilitychange', ask); void lock?.release().catch(() => undefined); };
  }, []);

  const reveal = () => {
    setControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControls(false), 3500);
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') onExit();
      else if (e.key === ' ' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); advance(); }
      else if (e.key === 'f' || e.key === 'F') toggleFull();
    };
    addEventListener('keydown', key);
    const fs = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', fs);
    root.current?.focus();
    return () => { removeEventListener('keydown', key); document.removeEventListener('fullscreenchange', fs); clearTimeout(hideTimer.current); if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void root.current?.requestFullscreen?.().catch(() => undefined);
  };
  const backgroundClick = () => (controls ? onExit() : reveal());

  const offset = settings.hijriOffset ?? 0;
  const hijri = toHijri(now, offset);
  const times = timesFor(now, settings);
  const nxt = nextPrayer(now, settings);
  const phase = phaseAt(now, times);
  const today = occasionsOn(hijri, now.getDay());
  const soon = upcoming(now, 45, offset)[0];
  const fastToday = fastingOn(today);
  let nextFast: { n: number; title: string } | null = null;
  for (let i = fastToday === 'recommended' || fastToday === 'obligatory' ? 0 : 1; i <= 14 && !nextFast; i++) {
    const d = addDays(now, i);
    const occ = occasionsOn(toHijri(d, offset), d.getDay());
    const f = fastingOn(occ);
    if (f === 'recommended' || f === 'obligatory') nextFast = { n: i, title: occ.find((o) => o.fasting === f)!.title.replace(/^صيام /, '').replace(/ \(.*\)$/, '') };
  }
  const sum = summary(todosFor(now, progress).todos);
  const item = list[idx];
  const old = prev !== null ? list[prev] : null;
  const hm = clock(now, Intl.DateTimeFormat().resolvedOptions().timeZone).split(' ');

  return (
    <div ref={root} className={`ambient phase-${phase}${controls ? ' show-controls' : ''}`} role="dialog" aria-label="شاشة السكون" tabIndex={-1} onPointerMove={(e) => e.pointerType === 'mouse' && reveal()} onClick={backgroundClick}>
      <div className="amb-sky" aria-hidden />
      <div className="amb-stars" aria-hidden />
      <div className="amb-pattern" aria-hidden />
      <div className="amb-glow" aria-hidden />
      <div className="amb-frame" aria-hidden><i /><i /><i /><i /></div>

      <div className="amb-inner">
        <header className="amb-top">
          <div className="amb-date">
            <span className="amb-hday">{arNum(hijri.day)}</span>
            <div>
              <strong>{HIJRI_MONTHS[hijri.month - 1]} {arNum(hijri.year)}</strong>
              <small>{WEEKDAYS[now.getDay()]} · {formatGregorian(now)}</small>
            </div>
          </div>
          <div className="amb-clock" aria-label="الساعة">{hm[0]}<small>{hm[1]}</small></div>
        </header>

        <main className="amb-center" aria-live="off">
          {old && (
            <figure key={`o${prev}`} className={`amb-item out k-${old.kind} ${sizeClass(old.text)}`} aria-hidden>
              <span className="amb-kind">{KIND_LABEL[old.kind]}</span>
              <blockquote>{old.text}</blockquote>
              <figcaption>{old.ref}</figcaption>
            </figure>
          )}
          <figure key={`c${idx}`} className={`amb-item in k-${item.kind} ${sizeClass(item.text)}`}>
            <span className="amb-kind">{KIND_LABEL[item.kind]}</span>
            <blockquote>{item.text}</blockquote>
            <div className="amb-rule" aria-hidden><i /><svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 1l2.6 6.1L21 5.4l-2.4 6.3L23 15l-6.6.9L15 22l-3-5.4L9 22l-1.4-6.1L1 15l4.4-3.3L3 5.4l6.4 1.7z" /></svg><i /></div>
            <figcaption>{item.ref}</figcaption>
          </figure>
        </main>

        <footer className="amb-bottom">
          <section className="amb-prayer" aria-label="الصلاة القادمة">
            {times && nxt ? (
              <>
                <div className="amb-arcwrap">
                  <DayArc times={times} now={now} nextKey={nxt.key} />
                  <div className="amb-next">
                    <small>الصلاة القادمة</small>
                    <strong>{PRAYER_NAMES[nxt.key]}</strong>
                    <span>{clock(nxt.at)} · بعد {countdown(nxt.at.getTime() - now.getTime())}</span>
                  </div>
                </div>
                <div className="amb-times">
                  {(PRAYERS as PrayerKey[]).map((k) => <span key={k} className={k === nxt.key ? 'next' : times[k].getTime() <= now.getTime() ? 'past' : ''}><small>{PRAYER_NAMES[k]}</small>{clock(times[k])}</span>)}
                </div>
              </>
            ) : (
              <p className="amb-hint">حدّد مدينتك من الإعدادات لتظهر أوقات الصلاة هنا.</p>
            )}
          </section>
          <section className="amb-cards">
            <div className={`amb-card${today[0] ? ' on' : ''}`}>
              <Icon name="crescent" size={20} />
              <div>
                <small>{today[0] ? 'اليوم' : soon ? inDays(soon.inDays) : 'اليوم'}</small>
                <strong>{today[0] ? today[0].title : soon ? soon.occasion.title.replace(/ \(.*\)$/, '') : 'يوم من أيام الله'}</strong>
                <span>{today[0] ? today[0].why : soon ? soon.occasion.why : ''}</span>
              </div>
            </div>
            {nextFast && (
              <div className={`amb-card${nextFast.n === 0 ? ' on' : ''}`}>
                <Icon name="moonStar" size={20} />
                <div>
                  <small>{nextFast.n === 0 ? 'صيام اليوم' : `الصيام القادم · ${inDays(nextFast.n)}`}</small>
                  <strong>{nextFast.title}</strong>
                  {nextFast.n === 1 && <span>انوِ من الليل وتسحّر</span>}
                </div>
              </div>
            )}
            <div className={`amb-card${sum.complete ? ' on' : ''}`}>
              <Icon name="listChecks" size={20} />
              <div>
                <small>مهام اليوم</small>
                <strong>{sum.complete ? 'اكتمل يومك' : `${arNum(sum.done)} من ${arNum(sum.total)}`}</strong>
                <span className="amb-bar"><i style={{ transform: `scaleX(${sum.total ? sum.done / sum.total : 0})` }} /></span>
                {!sum.complete && sum.left[0] && <span>التالي: {sum.left[0].title}</span>}
              </div>
            </div>
          </section>
        </footer>
        <div className="amb-brand" aria-hidden><Mark size={22} book="currentColor" pageGap="transparent" /> نُطق</div>
      </div>

      <div className="amb-controls" onClick={(e) => e.stopPropagation()}>
        {item.surah && item.verses && <PlayRange surah={item.surah} verses={item.verses} reciter={settings.reciter} />}
        <button onClick={() => { advance(); reveal(); }}><Icon name="chevronLeft" size={18} /> التالي</button>
        <button onClick={toggleFull}><Icon name="monitor" size={18} /> {full ? 'إنهاء ملء الشاشة' : 'ملء الشاشة'}</button>
        <button onClick={onExit}><Icon name="x" size={18} /> خروج</button>
      </div>
      <p className="amb-exit-hint">اضغط مرتين للخروج · Esc</p>
    </div>
  );
}
