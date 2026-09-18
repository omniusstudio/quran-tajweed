import { useEffect, useMemo, useState } from 'react';
import { ADHKAR_SOURCE, SET_HINT, SET_TITLES, adhkar, eveningNotes, resolveRef, type AdhkarSet, type Dhikr } from '../content/adhkar';
import { setTodo } from '../content/daily';
import { dayKey, logActivity } from '../content/progress';
import { celebrate } from '../ui/celebrate';
import { Icon, type IconName } from '../ui/icons';
import { getSettings, useSettings } from '../ui/settings';
import { sfx } from '../ui/sound';
import { PlayRange, arNum } from './shared';

const SETS: { id: AdhkarSet; icon: IconName }[] = [
  { id: 'morning', icon: 'sunrise' },
  { id: 'evening', icon: 'moon' },
  { id: 'sleep', icon: 'moonStar' },
  { id: 'waking', icon: 'sun' },
];
const TODO_FOR: Partial<Record<AdhkarSet, string>> = { morning: 'adhkar_morning', evening: 'adhkar_evening', sleep: 'sleep' };

function storeKey(set: AdhkarSet) {
  return `nutq.adhkar.${dayKey()}.${set}`;
}
function readCounts(set: AdhkarSet): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(storeKey(set)) || '{}') as Record<string, number>;
  } catch {
    return {};
  }
}
function buzz() {
  if (getSettings().haptics && 'vibrate' in navigator) navigator.vibrate(12);
}

function Passage({ d, reciter, go }: { d: Dhikr; reciter: string; go: (h: string) => void }) {
  return (
    <>
      {d.lead && <p className="dhikr-lead">{d.lead}</p>}
      {d.quran!.map((r) => {
        const res = resolveRef(r);
        if (!res) return null;
        if (d.linkOnly) {
          return (
            <button key={r.surah} className="mini" onClick={() => go(`#/follow/${r.surah}`)}>
              <Icon name="book" size={14} /> {res.surahName}
            </button>
          );
        }
        return (
          <div key={`${r.surah}:${r.from ?? 0}`} className="mushaf-panel dhikr-quran">
            <p className="ayah" dir="rtl">{res.text}</p>
            <div className="ref ayah-ref">
              <span>{res.surahName}{res.whole ? '' : res.verses.length === 1 ? `، الآية ${arNum(res.verses[0])}` : `، الآيات ${arNum(res.verses[0])}–${arNum(res.verses[res.verses.length - 1])}`}</span>
              <PlayRange surah={res.surah} verses={res.verses} reciter={reciter} />
            </div>
          </div>
        );
      })}
    </>
  );
}

/** Morning, evening, sleep and waking adhkār with a tap counter; finishing a list ticks the day's checklist. */
export function AdhkarPage({ set, go }: { set: AdhkarSet; go: (hash: string) => void }) {
  const [settings] = useSettings();
  const items = useMemo(() => adhkar(set), [set]);
  const [counts, setCounts] = useState<Record<string, number>>(() => readCounts(set));
  useEffect(() => { setCounts(readCounts(set)); scrollTo({ top: 0 }); }, [set]);
  const left = (d: Dhikr) => Math.max(0, d.repeat - (counts[d.id] ?? 0));
  const doneCount = items.filter((d) => left(d) === 0).length;
  const allDone = doneCount === items.length;

  const save = (next: Record<string, number>) => {
    setCounts(next);
    try { localStorage.setItem(storeKey(set), JSON.stringify(next)); } catch { /* ignore */ }
  };
  const tap = (d: Dhikr, all = false) => {
    if (left(d) === 0) return;
    const next: Record<string, number> = { ...counts, [d.id]: all ? d.repeat : (counts[d.id] ?? 0) + 1 };
    save(next);
    buzz();
    const finishedItem = (next[d.id] ?? 0) >= d.repeat;
    sfx(finishedItem ? 'correct' : 'tap');
    if (finishedItem && items.every((x) => (next[x.id] ?? 0) >= x.repeat)) {
      const todo = TODO_FOR[set];
      const dayDone = todo ? setTodo(todo, true) : false;
      if (dayDone) logActivity('todos');
      celebrate({ kind: dayDone ? 'goal' : 'lesson', title: `أتممت ${SET_TITLES[set]}`, text: dayDone ? 'وبها اكتملت مهام يومك كلها.' : undefined });
    }
  };
  const reset = () => { save({}); sfx('toggle'); };

  return (
    <div className="page adhkar">
      <div className="lesson-head">
        <a href="#/" onClick={(e) => { e.preventDefault(); go('#/'); }} className="crumb"><Icon name="chevronRight" size={18} /> الرئيسية</a>
        <span className="ref">{arNum(doneCount)} / {arNum(items.length)}</span>
      </div>
      <div className="segmented adhkar-tabs" role="group" aria-label="نوع الأذكار">
        {SETS.map((s) => (
          <button key={s.id} aria-pressed={set === s.id} onClick={() => { sfx('tap'); go(`#/adhkar/${s.id}`); }}>
            <Icon name={s.icon} size={18} /> {SET_TITLES[s.id].replace('أذكار ', '')}
          </button>
        ))}
      </div>
      <div className="card hero">
        <div style={{ flex: '1 1 240px' }}>
          <h2>{SET_TITLES[set]}</h2>
          <p className="ref">{SET_HINT[set]}</p>
          <span className="bar" aria-hidden><i style={{ transform: `scaleX(${items.length ? doneCount / items.length : 0})` }} /></span>
        </div>
        {allDone ? <span className="badge"><Icon name="check" size={14} /> تمّت</span> : null}
      </div>

      <ol className="dhikr-list">
        {items.map((d, i) => {
          const remaining = left(d);
          const done = remaining === 0;
          const evening = set === 'evening' ? eveningNotes(d).map((n) => n.replace(/^وإذا أمسى قال:\s*/, '')) : [];
          const other = (d.notes ?? []).filter((n) => !n.startsWith('وإذا أمسى'));
          // the book gives some evening wordings in full and others as their first words only
          const letters = (t: string) => t.replace(/[^\u0621-\u064A]/g, '').length;
          const whole = evening.length === 1 && !evening[0].endsWith('...') && letters(evening[0]) > 0.6 * letters(d.body ?? '');
          return (
            <li key={d.id} className={`card dhikr${done ? ' done' : ''}`}>
              <span className="dhikr-n">{arNum(i + 1)}</span>
              {d.quran ? <Passage d={d} reciter={settings.reciter} go={go} /> : whole ? <p className="dhikr-text">{evening[0]}</p> : <p className={`dhikr-text${evening.length ? ' dim' : ''}`}>{d.body}</p>}
              {!whole && evening.map((n) => <p key={n} className="dhikr-evening"><Icon name="moon" size={16} /> {n.replace(/\.+$/, '')} …</p>)}
              {!whole && evening.length > 0 && <p className="ref">في المساء تُبدَّل ألفاظ الصباح بما بجانب الهلال، ويُتمّ الذكر كما هو.</p>}
              {other.length > 0 && <p className="ref dhikr-notes">{other.join(' · ')}</p>}
              <div className="dhikr-foot">
                <button className={`counter${done ? ' done' : ''}`} onClick={() => tap(d)} disabled={done} aria-label={done ? 'تمّ' : `بقي ${remaining}`}>
                  {done ? <Icon name="check" size={22} /> : <strong>{arNum(remaining)}</strong>}
                  <small>{done ? 'تمّ' : d.repeat === 1 ? 'اضغط بعد القراءة' : `من ${arNum(d.repeat)}`}</small>
                </button>
                {!done && d.repeat > 10 && <button className="mini" onClick={() => tap(d, true)}>أتممتها كلها</button>}
              </div>
            </li>
          );
        })}
      </ol>
      <div className="row wrap" style={{ justifyContent: 'space-between' }}>
        <p className="ref" style={{ margin: 0 }}>النص من: {ADHKAR_SOURCE}. الآيات من المصحف برواية الدوري.</p>
        <button className="mini" onClick={reset}><Icon name="refresh" size={14} /> ابدأ العدّ من جديد</button>
      </div>
    </div>
  );
}
