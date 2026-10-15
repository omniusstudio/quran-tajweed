import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { loadAlignment } from '../audio/alignment';
import { SURAH_BY_NUMBER } from '../audio/quran';
import { pageOf, pageSegments } from '../content/pages';
import { MAX_TARGET, PRESETS, STAGE_LABEL, estimateSeconds, veilFraction, type GapMode, type MemoPlan, type MemoRun, type Scope } from '../content/memoRun';
import { Icon } from '../ui/icons';
import { sfx } from '../ui/sound';
import type { Settings } from '../ui/settings';
import type { MemoPhase } from './useMemoRun';
import { arNum } from './shared';

const shortName = (n: string) => n.replace(/^سُورَةُ\s*/, '');
const verseNo = (surah: number, basri: number, kufi: boolean) => {
  const v = SURAH_BY_NUMBER[surah]?.verses.find((x) => x.basri === basri);
  return kufi ? v?.kufi ?? basri : basri;
};
export const rangeLabel = (surah: number, from: number, to: number, kufi: boolean) => {
  const s = SURAH_BY_NUMBER[surah];
  const a = verseNo(surah, from, kufi), b = verseNo(surah, to, kufi);
  const total = s.verses.length;
  const body = from === 1 && to === total ? 'السورة كاملة' : from === to ? `الآية ${arNum(a)}` : `الآيات ${arNum(a)}–${arNum(b)}`;
  return `${shortName(s.name)} · ${body}`;
};
/** Arabic number agreement: one, two, 3–10 take the plural, 11 and over the singular. */
const counted = (n: number, one: string, two: string, few: string) => (n === 1 ? one : n === 2 ? two : n <= 10 ? `${arNum(n)} ${few}` : `${arNum(n)} ${one}`);
const times = (n: number) => counted(n, 'مرة', 'مرتان', 'مرات');
const minutes = (sec: number) => {
  if (sec < 90) return counted(Math.max(1, Math.round(sec)), 'ثانية', 'ثانيتان', 'ثوانٍ');
  if (sec < 3600) return counted(Math.round(sec / 60), 'دقيقة', 'دقيقتان', 'دقائق');
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
  return `${counted(h, 'ساعة', 'ساعتان', 'ساعات')}${m ? ` و${counted(m, 'دقيقة', 'دقيقتان', 'دقائق')}` : ''}`;
};

/** Close on Escape and keep keyboard focus inside while a dialog is open. */
function useDialog(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    (ref.current?.querySelector<HTMLElement>('[data-autofocus]') ?? ref.current)?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key !== 'Tab' || !ref.current) return;
      const f = [...ref.current.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, a[href]')];
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    addEventListener('keydown', key, true);
    return () => { removeEventListener('keydown', key, true); prev?.focus?.(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return ref;
}

const DEFAULTS: NonNullable<Settings['memo']> = { count: 100, scope: 'verse', gap: 'none', veil: true };

export function MemoSheet({ anchor, reciter, kufi, preset, run, defaults, onStart, onResume, onDiscard, onClose, go }: {
  anchor: { surah: number; basri: number };
  reciter: string;
  kufi: boolean;
  preset?: Partial<MemoPlan> & { surah: number; from: number; to: number };
  run: MemoRun | null;
  defaults: Settings['memo'];
  onStart: (plan: MemoPlan) => void;
  onResume: () => void;
  onDiscard: () => void;
  onClose: () => void;
  go: (hash: string) => void;
}) {
  const d = defaults ?? DEFAULTS;
  const ref = useDialog(onClose);
  const born = useRef(Date.now());
  const [sel, setSel] = useState(preset ? { surah: preset.surah, basri: preset.from } : anchor);
  const [scope, setScope] = useState<Scope>(preset ? 'range' : d.scope);
  const [count, setCount] = useState(preset?.target ?? d.count);
  const [gap, setGap] = useState<GapMode>(preset?.gap ?? d.gap);
  const [veil, setVeil] = useState(preset?.veil ?? d.veil);
  const surah = SURAH_BY_NUMBER[sel.surah];
  const idx = Math.max(0, surah.verses.findIndex((v) => v.basri === sel.basri));

  const range = useMemo<[number, number]>(() => {
    if (scope === 'range' && preset) return [preset.from, preset.to];
    if (scope === 'surah') return [surah.verses[0].basri, surah.verses[surah.verses.length - 1].basri];
    if (scope === 'page') {
      const seg = pageSegments(pageOf(sel.surah, sel.basri)).find((g) => g.surah.number === sel.surah);
      if (seg) return [seg.surah.verses[seg.from].basri, seg.surah.verses[seg.to].basri];
    }
    return [sel.basri, sel.basri];
  }, [scope, sel, preset, surah]);

  const plan: MemoPlan = { surah: sel.surah, from: range[0], to: range[1], scope, target: count, gap, veil, ...(preset?.review ? { review: true } : {}) };
  const align = loadAlignment(reciter, sel.surah);
  const est = align ? estimateSeconds(plan, align) : null;
  const playable = !!align && est !== null;
  const first = surah.verses[idx];
  const pageNo = pageOf(sel.surah, sel.basri);
  const step = (by: number) => { const n = surah.verses[idx + by]; if (n) { setSel({ surah: sel.surah, basri: n.basri }); sfx('tap'); } };
  const pick = (n: number) => { setCount(Math.max(1, Math.min(MAX_TARGET, Math.round(n) || 1))); sfx('tap'); };
  const resumable = run && !run.completed;

  return createPortal(
    <>
      <div className="sheet-backdrop" onClick={() => { if (Date.now() - born.current > 450) onClose(); }} />
      <div className="memo-sheet" role="dialog" aria-modal="true" aria-labelledby="memo-title" ref={ref} tabIndex={-1}>
        <div className="grip" aria-hidden />
        <header className="memo-head">
          <div>
            <h2 id="memo-title">{preset?.review ? 'مراجعة المحفوظ' : 'احفظ بالتكرار'}</h2>
            <p>{preset?.review ? 'اسمعها عدّة مرات، ثم احكم: هل ثبتت؟' : 'تسمع المقطع مرة بعد مرة حتى يثبت، والعدّاد يحفظ لك ما تقدّمت فيه.'}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="إغلاق"><Icon name="x" /></button>
        </header>

        {resumable && (
          <div className="memo-resume">
            <div>
              <strong>جلسة لم تكتمل</strong>
              <small>{rangeLabel(run.plan.surah, run.plan.from, run.plan.to, kufi)} · {arNum(run.done)} من {arNum(run.plan.target)}</small>
            </div>
            <button className="primary small" onClick={onResume}><Icon name="play" size={16} /> تابعها</button>
            <button className="quiet" onClick={onDiscard}>ألغِها</button>
          </div>
        )}

        {!preset?.review && !preset && (
          <fieldset className="memo-group">
            <legend>ماذا تكرّر؟</legend>
            <div className="memo-seg" role="group">
              {([['verse', 'الآية'], ['page', `الصفحة ${arNum(pageNo)}`], ['surah', 'السورة']] as [Scope, string][]).map(([k, label]) => (
                <button key={k} aria-pressed={scope === k} onClick={() => { setScope(k); sfx('tap'); }}>{label}</button>
              ))}
            </div>
          </fieldset>
        )}

        <div className="memo-target">
          {scope !== 'range' && !preset && (
            <button className="icon-btn" onClick={() => step(1)} disabled={idx >= surah.verses.length - 1} aria-label="الآية التالية"><Icon name="chevronRight" /></button>
          )}
          <div className="memo-target-body">
            <strong>{rangeLabel(plan.surah, plan.from, plan.to, kufi)}</strong>
            <span className="memo-preview" dir="rtl">{first.words.slice(0, 8).join(' ')}{first.words.length > 8 ? ' …' : ''}</span>
          </div>
          {scope !== 'range' && !preset && (
            <button className="icon-btn" onClick={() => step(-1)} disabled={idx <= 0} aria-label="الآية السابقة"><Icon name="chevronLeft" /></button>
          )}
        </div>

        <fieldset className="memo-group">
          <legend>كم مرة؟</legend>
          <div className="memo-seg" role="group">
            {PRESETS.map((n) => <button key={n} aria-pressed={count === n} onClick={() => pick(n)}>{arNum(n)}</button>)}
            <label className={`memo-num${PRESETS.includes(count) ? '' : ' on'}`}>
              <input type="number" inputMode="numeric" min={1} max={MAX_TARGET} value={PRESETS.includes(count) ? '' : count} placeholder="غيرها" onChange={(e) => e.target.value && pick(Number(e.target.value))} aria-label="عدد آخر" />
            </label>
          </div>
        </fieldset>

        <fieldset className="memo-group">
          <legend>بين المرتين</legend>
          <div className="memo-seg" role="group">
            {([['none', 'بلا وقفة'], ['short', 'وقفة قصيرة'], ['recite', 'أعِدها أنت']] as [GapMode, string][]).map(([k, label]) => (
              <button key={k} aria-pressed={gap === k} onClick={() => { setGap(k); sfx('tap'); }}>{label}</button>
            ))}
          </div>
          <small className="memo-hint">{gap === 'recite' ? 'بعد كل سماع يسكت القارئ بمقدار الآية لتردّدها أنت.' : gap === 'short' ? 'ثانيتان من السكون بين كل مرتين.' : 'يتصل السماع دون انقطاع، وتردّد معه.'}</small>
        </fieldset>

        <label className="memo-switch">
          <input type="checkbox" checked={veil} onChange={(e) => { setVeil(e.target.checked); sfx('toggle'); }} />
          <span className="box" aria-hidden><Icon name="check" size={16} /></span>
          <span><strong>أخفِ الكلمات تدريجيًا</strong><small>كلما زاد العدد اختفى جزء من النص، فتنتهي من حفظك. اضغط كلمة مخفية لتنظر إليها.</small></span>
        </label>

        <footer className="memo-foot">
          <span className="memo-est" aria-live="polite">{!playable ? 'لا تلاوة متزامنة لهذه السورة بعد.' : `نحو ${minutes(est!)}`}</span>
          <a className="memo-link" href="#/memo" onClick={(e) => { e.preventDefault(); onClose(); go('#/memo'); }}>حفظي</a>
          <button className="primary" disabled={!playable} onClick={() => onStart(plan)}><Icon name="repeat" size={18} /> ابدأ · {times(count)}</button>
        </footer>
      </div>
    </>,
    document.body,
  );
}

/** The session bar: the count in a ring, what is being repeated, and pause / end. */
export function MemoHud({ run, phase, playing, gapEnds, kufi, onToggle, onEnd }: {
  run: MemoRun;
  phase: MemoPhase;
  playing: boolean;
  gapEnds: number;
  kufi: boolean;
  onToggle: () => void;
  onEnd: () => void;
}) {
  const { plan, done } = run;
  const frac = Math.min(1, done / plan.target);
  const r = 23, c = 2 * Math.PI * r;
  const [asking, setAsking] = useState(false);
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (phase !== 'gap') return;
    const tick = () => setLeft(Math.max(0, Math.ceil((gapEnds - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [phase, gapEnds]);
  const stage = plan.veil ? STAGE_LABEL(veilFraction(done, plan.target)) : null;
  const running = phase === 'listening' && playing;
  const status = phase === 'gap' ? `رددها الآن… ${arNum(left)}` : phase === 'complete' ? 'اكتمل العدد' : running ? 'تسمع الآن' : 'متوقفة';
  return (
    <div className={`memo-hud ${phase}`} role="group" aria-label="جلسة الحفظ">
      <div className="memo-ring" role="img" aria-label={`${arNum(done)} من ${arNum(plan.target)}`}>
        <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden>
          <circle className="track" cx="28" cy="28" r={r} />
          <circle className="fill" cx="28" cy="28" r={r} strokeDasharray={c} strokeDashoffset={c * (1 - frac)} />
        </svg>
        <b><span>{arNum(done)}</span><small>من {arNum(plan.target)}</small></b>
      </div>
      <div className="memo-info" role="status" aria-live="polite">
        <strong>{rangeLabel(plan.surah, plan.from, plan.to, kufi)}</strong>
        <small>{status}{stage ? ` · ${stage}` : ''}</small>
        {phase === 'gap' && <i className="memo-gapbar" key={gapEnds} style={{ animationDuration: `${Math.max(0, gapEnds - Date.now())}ms` }} />}
      </div>
      {asking ? (
        <div className="memo-ask">
          <button className="quiet danger" onClick={() => { setAsking(false); onEnd(); }} data-autofocus>أنهِ الجلسة</button>
          <button className="quiet" onClick={() => setAsking(false)}>تابع</button>
        </div>
      ) : (
        <>
          <button className="play" onClick={onToggle} aria-label={running || phase === 'gap' ? 'إيقاف مؤقت' : 'تابع'}><Icon name={running || phase === 'gap' ? 'pause' : 'play'} size={22} /></button>
          <button className="icon-btn" onClick={() => setAsking(true)} aria-label="إنهاء الجلسة" title="إنهاء الجلسة"><Icon name="x" /></button>
        </>
      )}
    </div>
  );
}

/** The count is reached: the learner decides. */
export function MemoDone({ run, kufi, onYes, onNo, onMore, onLater }: {
  run: MemoRun;
  kufi: boolean;
  onYes: () => void;
  onNo: () => void;
  onMore: (n: number) => void;
  onLater: () => void;
}) {
  const ref = useDialog(onLater);
  const review = !!run.plan.review;
  return createPortal(
    <>
      <div className="sheet-backdrop" onClick={onLater} />
      <div className="memo-sheet done" role="dialog" aria-modal="true" aria-labelledby="memo-done-title" ref={ref} tabIndex={-1}>
        <div className="grip" aria-hidden />
        <div className="memo-done-mark"><Icon name="check" size={30} /></div>
        <h2 id="memo-done-title">{times(run.done)}</h2>
        <p>{rangeLabel(run.plan.surah, run.plan.from, run.plan.to, kufi)}</p>
        <p className="memo-ask-text">{review ? 'هل ثبتت في صدرك؟' : 'هل تقرؤها الآن من حفظك دون النظر؟'}</p>
        <div className="memo-done-actions">
          <button className="primary" data-autofocus onClick={onYes}><Icon name="check" size={18} /> {review ? 'ثبتت' : 'حفظتها'}</button>
          {review ? <button className="toggle" onClick={onNo}>تحتاج مراجعة غدًا</button> : <button className="toggle" onClick={() => onMore(50)}>كرّر {arNum(50)} مرة أخرى</button>}
          <button className="quiet" onClick={onLater}>لاحقًا</button>
        </div>
      </div>
    </>,
    document.body,
  );
}

