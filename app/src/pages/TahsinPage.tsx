import { useEffect, useMemo, useRef, useState } from 'react';
import { loadAlignment, playSpan } from '../audio/alignment';
import { audioUrl } from '../audio/quran';
import { setTodo } from '../content/daily';
import { logActivity } from '../content/progress';
import { ENTER_HOME, PROGRAMS, resolveItem, type Program, type Resolved } from '../content/tahsin';
import { setBusy } from '../ui/activity';
import { celebrate } from '../ui/celebrate';
import { Icon } from '../ui/icons';
import { useSettings } from '../ui/settings';
import { sfx } from '../ui/sound';
import { HadithQuote, arNum } from './shared';

/** One thing to play: a span of one sūrah's recording. */
interface Step {
  key: string;
  itemIndex: number;
  round: number;
  surah: number;
  from: number;
  to: number;
}

const LOOP_KEY = 'nutq.tahsin.loop';

function stepsFor(program: Program, reciter: string): { steps: Step[]; missing: string[] } {
  const steps: Step[] = [];
  const missing: string[] = [];
  program.items.forEach((item, itemIndex) => {
    const r = resolveItem(item);
    const a = r && loadAlignment(reciter, item.surah);
    const first = a?.verses.find((v) => v.basri === r!.verses[0]);
    const last = a?.verses.find((v) => v.basri === r!.verses[r!.verses.length - 1]);
    if (!r || !a || !first || !last) { missing.push(item.title); return; }
    // a whole sūrah starts from the basmalah (or the istiʿādhah) the reciter reads before it
    const from = r.whole ? (a.preamble?.[0] ?? a.header?.[0] ?? playSpan(first)[0]) : playSpan(first)[0];
    const to = playSpan(last)[1];
    for (let round = 0; round < item.repeat; round++) steps.push({ key: `${item.id}:${round}`, itemIndex, round, surah: item.surah, from, to });
  });
  return { steps, missing };
}

/** Plays a program's steps one after another through one audio element; survives sūrah changes. */
function useProgramPlayer(reciter: string, onDone: () => void) {
  const el = useRef<HTMLAudioElement | null>(null);
  const queue = useRef<Step[]>([]);
  const pos = useRef(-1);
  const loopRef = useRef(false);
  const [state, setState] = useState<{ playing: boolean; current: Step | null; waiting: boolean; error: string | null }>({ playing: false, current: null, waiting: false, error: null });

  const audio = () => {
    if (el.current) return el.current;
    const a = new Audio();
    a.preload = 'auto';
    a.addEventListener('timeupdate', () => {
      const cur = queue.current[pos.current];
      if (cur && a.currentTime >= cur.to) advance();
    });
    a.addEventListener('ended', () => advance());
    a.addEventListener('waiting', () => setState((s) => ({ ...s, waiting: true })));
    a.addEventListener('playing', () => setState((s) => ({ ...s, waiting: false, playing: true })));
    a.addEventListener('pause', () => setState((s) => ({ ...s, playing: false })));
    a.addEventListener('error', () => setState((s) => ({ ...s, playing: false, waiting: false, error: 'تعذّر تشغيل التلاوة. تأكد أن الخادم المحلي يعمل وأن السورة مُحمّلة.' })));
    el.current = a;
    return a;
  };
  const playStep = (i: number) => {
    const a = audio();
    const step = queue.current[i];
    if (!step) return;
    pos.current = i;
    const src = audioUrl(reciter, step.surah);
    if (!a.src.endsWith(src)) a.src = src;
    const seekAndPlay = () => {
      a.currentTime = step.from;
      void a.play().catch(() => setState((s) => ({ ...s, playing: false, error: 'اضغط «شغّل» مرة أخرى للسماح بالتشغيل.' })));
    };
    if (a.readyState >= 1) seekAndPlay();
    else a.addEventListener('loadedmetadata', seekAndPlay, { once: true });
    setState({ playing: true, current: step, waiting: true, error: null });
  };
  const advance = () => {
    const next = pos.current + 1;
    if (next < queue.current.length) return playStep(next);
    if (loopRef.current && queue.current.length) return playStep(0);
    el.current?.pause();
    pos.current = -1;
    setState({ playing: false, current: null, waiting: false, error: null });
    onDone();
  };
  const start = (steps: Step[], loop: boolean) => { queue.current = steps; loopRef.current = loop; playStep(0); };
  const toggle = () => { const a = audio(); if (a.paused) void a.play(); else a.pause(); };
  const skip = () => advance();
  const stop = () => { el.current?.pause(); pos.current = -1; queue.current = []; setState({ playing: false, current: null, waiting: false, error: null }); };
  const setLoop = (v: boolean) => { loopRef.current = v; };
  useEffect(() => () => { el.current?.pause(); setBusy('tahsin', false); }, []);
  useEffect(() => { setBusy('tahsin', state.playing); }, [state.playing]);
  return { ...state, start, toggle, skip, stop, setLoop, active: pos.current >= 0 };
}

/** تحصين البيت: play the Sunnah's protection sūrahs and āyāt aloud, with the narrations behind each. */
export function TahsinPage({ go }: { go: (hash: string) => void }) {
  const [settings] = useSettings();
  const [programId, setProgramId] = useState<Program['id']>('daily');
  const program = PROGRAMS.find((p) => p.id === programId)!;
  const [loop, setLoopState] = useState(() => { try { return localStorage.getItem(LOOP_KEY) === '1'; } catch { return false; } });
  const [open, setOpen] = useState<string | null>(null);
  const resolved = useMemo(() => program.items.map(resolveItem).filter(Boolean) as Resolved[], [program]);
  const { steps, missing } = useMemo(() => stepsFor(program, settings.reciter), [program, settings.reciter]);
  const player = useProgramPlayer(settings.reciter, () => {
    sfx('complete');
    const finished = setTodo('tahsin', true);
    if (finished) logActivity('todos');
    celebrate({ kind: 'lesson', title: `تمّ ${program.title}`, text: 'حفظ الله بيتك وأهلك.' });
  });
  const setLoop = (v: boolean) => { setLoopState(v); player.setLoop(v); try { localStorage.setItem(LOOP_KEY, v ? '1' : '0'); } catch { /* ignore */ } sfx('toggle'); };
  const pick = (id: Program['id']) => { if (player.active) player.stop(); setProgramId(id); sfx('tap'); };
  const total = steps.length;
  const done = player.current ? steps.findIndex((s) => s.key === player.current!.key) : -1;

  return (
    <div className="page tahsin">
      <div className="lesson-head">
        <a href="#/" onClick={(e) => { e.preventDefault(); go('#/'); }} className="crumb"><Icon name="chevronRight" size={18} /> الرئيسية</a>
      </div>
      <div className="card hero">
        <div style={{ flex: '1 1 260px' }}>
          <h2>تحصين البيت</h2>
          <p className="ref">ما جاءت به السنة لحفظ البيت وأهله: يُتلى بصوت القارئ في البيت، والدليل مع كل مقطع. ليس فيه إلا ما ورد النص به.</p>
        </div>
      </div>

      <div className="segmented tahsin-tabs" role="group" aria-label="البرنامج">
        {PROGRAMS.map((p) => (
          <button key={p.id} aria-pressed={programId === p.id} onClick={() => pick(p.id)}>
            <Icon name={p.id === 'daily' ? 'home' : 'book'} size={18} /> {p.title}
          </button>
        ))}
      </div>

      <section className="card player-card">
        <div className="section-head">
          <h3>{program.title}</h3>
          <span className="badge neutral"><Icon name="clock" size={14} /> نحو {arNum(program.minutes)} دقيقة</span>
        </div>
        <p className="ref">{program.blurb}</p>
        {missing.length > 0 && <p className="todo"><Icon name="alert" size={16} /> لا محاذاة بعد لـ: {missing.join('، ')}؛ ستُتخطّى.</p>}
        <div className="row wrap player-row">
          {!player.active ? (
            <button className="primary" onClick={() => { sfx('tap'); player.start(steps, loop); }} disabled={!steps.length}><Icon name="play" size={18} /> شغّل في البيت</button>
          ) : (
            <>
              <button className="primary" onClick={player.toggle}><Icon name={player.playing ? 'pause' : 'play'} size={18} /> {player.playing ? 'إيقاف مؤقت' : 'تابع'}</button>
              <button className="toggle" onClick={player.skip}><Icon name="chevronLeft" size={18} /> التالي</button>
              <button className="toggle" onClick={player.stop}><Icon name="stop" size={18} /> أوقف</button>
            </>
          )}
          <label className="check" style={{ marginInlineStart: 'auto' }}>
            <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} /> كرر بلا توقف
          </label>
        </div>
        {player.active && (
          <>
            <span className="bar" aria-hidden><i style={{ transform: `scaleX(${total ? (done + 1) / total : 0})` }} /></span>
            <p className="ref" role="status">{player.waiting ? 'جارٍ جلب التلاوة…' : player.current ? `الآن: ${program.items[player.current.itemIndex].title}${program.items[player.current.itemIndex].repeat > 1 ? ` (${arNum(player.current.round + 1)} من ${arNum(program.items[player.current.itemIndex].repeat)})` : ''}` : ''}</p>
          </>
        )}
        {player.error && <p className="todo"><Icon name="alert" size={16} /> {player.error}</p>}
      </section>

      <ol className="tahsin-list">
        {resolved.map((r, i) => {
          const now = player.current?.itemIndex === i;
          const passed = player.active && player.current !== null && player.current.itemIndex > i;
          return (
            <li key={r.item.id} className={`card tahsin-item${now ? ' now' : ''}${passed ? ' passed' : ''}`}>
              <div className="section-head">
                <h3><span className="tahsin-n">{arNum(i + 1)}</span> {r.item.title}{r.item.repeat > 1 && <span className="badge">×{arNum(r.item.repeat)}</span>}</h3>
                <span className="row">
                  {now && <span className="badge"><Icon name="volume" size={14} /> يُتلى الآن</span>}
                  <button className="icon-btn" aria-expanded={open === r.item.id} onClick={() => setOpen(open === r.item.id ? null : r.item.id)} aria-label="الدليل"><Icon name={open === r.item.id ? 'chevronDown' : 'quote'} size={18} /></button>
                </span>
              </div>
              <p className="ref">{r.item.why}</p>
              {r.whole ? (
                <p className="ref"><a href={`#/follow/${r.item.surah}`} onClick={(e) => { e.preventDefault(); go(`#/follow/${r.item.surah}`); }}>{r.surahName} في المتابعة</a> · {arNum(r.verses.length)} آية</p>
              ) : (
                <div className="mushaf-panel dhikr-quran">
                  <p className="ayah" dir="rtl">{r.text}</p>
                  <div className="ref ayah-ref"><span>{r.surahName}، {r.verses.length === 1 ? `الآية ${arNum(r.verses[0])}` : `الآيات ${arNum(r.verses[0])}–${arNum(r.verses[r.verses.length - 1])}`}</span></div>
                </div>
              )}
              {open === r.item.id && r.item.hadith.map((h) => <HadithQuote key={h} id={h} />)}
            </li>
          );
        })}
      </ol>

      <section className="card">
        <h3>وعند دخول البيت</h3>
        <p className="dhikr-text">{ENTER_HOME.body}</p>
        <HadithQuote id={ENTER_HOME.hadith} />
        <p className="ref">من حصن المسلم. البسملة عند الدخول وعند الطعام هي التحصين الأول للبيت.</p>
      </section>
    </div>
  );
}
