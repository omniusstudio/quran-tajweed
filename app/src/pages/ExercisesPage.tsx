import { useEffect, useMemo, useRef, useState } from 'react';
import { loadAlignment } from '../audio/alignment';
import { DEFAULT_RECITER, audioUrl } from '../audio/quran';
import { getClip } from '../audio/store';
import { usePlayer } from '../audio/usePlayer';
import { RULES as LESSON_RULES } from '../content/lessons';
import { NUN_OPTIONS, duriHafsItems, imalahItems, listenItems, maddItems, nunItems, spotItems, spotRulesAvailable, type DuriHafsItem, type ImalahItem, type ListenItem, type MaddItem, type NunItem, type SpotItem, type VerseRef } from '../exercises/bank';
import { answer, deckStats, loadDeck, pickNext, type Deck } from '../exercises/leitner';
import { RULES, type RuleId } from '../rules/tagger';
import { BY_ID } from '../viewer/articulations';
import { LetterViewer, arNum } from './shared';

export type ExerciseKind = 'spot' | 'nun' | 'listen' | 'imalah' | 'madd' | 'duri' | 'mirror';

export const EXERCISES: { kind: ExerciseKind; title: string; blurb: string }[] = [
  { kind: 'spot', title: 'أين القاعدة؟', blurb: 'آية من المصحف: اضغط الكلمة التي فيها القاعدة.' },
  { kind: 'nun', title: 'ماذا يحدث لهذه النون؟', blurb: 'نون ساكنة أو تنوين ثم حرف: واضحة، تذوب، ميم، أم خفية؟' },
  { kind: 'listen', title: 'اسمع واختر', blurb: 'مقطعان من صوت المعلم: أيهما الحرف المطلوب؟' },
  { kind: 'imalah', title: 'إمالة أم لا؟', blurb: 'كلمة فيها الناس / النار / الكافرين: هل تُمال هنا؟' },
  { kind: 'madd', title: 'كم حركة؟', blurb: 'كلمة فيها مد: حركتان، أربع، أم ست؟' },
  { kind: 'duri', title: 'الدوري وحفص', blurb: 'كلمة كما يقرؤها حفص: كيف يقرؤها الدوري؟' },
  { kind: 'mirror', title: 'تمرين المرآة', blurb: 'الكاميرا الأمامية بجوار الرسم: قلّد حركة الفم ببطء.' },
];

const shuffle = <T,>(a: T[]): T[] => {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

function VerseLine({ verse: r, highlight, onWord, hideMark }: { verse: VerseRef; highlight?: number[]; onWord?: (i: number) => void; hideMark?: boolean }) {
  return (
    <div>
      <div className="ayah" dir="rtl">
        {r.words.map((w, i) => (
          <span key={i}>
            {onWord ? (
              <button className={`word${highlight?.includes(i) ? ' on' : ''}`} onClick={() => onWord(i)}>
                {hideMark ? w.split('۪').join('') : w}
              </button>
            ) : (
              <span className={highlight?.includes(i) ? 'hl' : ''}>{w}</span>
            )}{' '}
          </span>
        ))}
      </div>
      <div className="ref">
        {r.surahName}، الآية {arNum(r.basri)}
      </div>
    </div>
  );
}

function Feedback({ ok, rule, detail, onNext }: { ok: boolean | null; rule?: RuleId; detail?: string; onNext: () => void }) {
  if (ok === null) return null;
  const lesson = rule ? LESSON_RULES[RULES[rule].lesson] : undefined;
  return (
    <div className={`feedback ${ok ? 'ok' : 'bad'}`}>
      <div className="row wrap">
        <strong>{ok ? '✓ صحيح' : '✗ ليس هذا'}</strong>
        {rule && <span className="badge">{RULES[rule].label}</span>}
        {detail && <span className="ref">{detail}</span>}
        {lesson && (
          <a className="crumb" href={`#/lessons/${lesson.id}`}>
            الدرس: {lesson.name} ←
          </a>
        )}
      </div>
      <button className="primary" onClick={onNext} autoFocus>
        التالي ←
      </button>
    </div>
  );
}

/** Menu + the chosen exercise. `param` preselects a rule for "spot the rule". */
export function ExercisesPage({ kind, param, go }: { kind?: ExerciseKind; param?: string; go: (hash: string) => void }) {
  const [deck, setDeck] = useState<Deck>(loadDeck);
  const grade = (id: string, ok: boolean) => setDeck((d) => answer(d, id, ok));
  if (!kind) {
    return (
      <div className="lessons">
        <div className="card">
          <h2>التمارين</h2>
          <p className="ref">كل الأسئلة مولّدة من مصحف الدوري نفسه (سورة الفاتحة وجزء عمّ). ما تخطئ فيه يعود إليك أسرع.</p>
        </div>
        {EXERCISES.map((e) => {
          const st = deckStats(deck, `${e.kind === 'duri' ? 'dh' : e.kind}:`);
          return (
            <button key={e.kind} className="card exercise-card" onClick={() => go(`#/exercises/${e.kind}`)}>
              <span className="section-head">
                <h3>{e.title}</h3>
                {st.seen > 0 && (
                  <span className="badge">
                    {arNum(st.mastered)} متقن · {arNum(st.due)} للمراجعة
                  </span>
                )}
              </span>
              <span className="ref">{e.blurb}</span>
            </button>
          );
        })}
      </div>
    );
  }
  const back = (
    <a className="crumb" href="#/exercises" onClick={(e) => { e.preventDefault(); go('#/exercises'); }}>
      ← كل التمارين
    </a>
  );
  return (
    <div className="lessons">
      <div className="lesson-head">
        {back}
        <h2 style={{ margin: 0 }}>{EXERCISES.find((e) => e.kind === kind)?.title}</h2>
      </div>
      {kind === 'spot' && <Spot deck={deck} grade={grade} rule={(param as RuleId) || undefined} go={go} />}
      {kind === 'nun' && <Nun deck={deck} grade={grade} />}
      {kind === 'listen' && <Listen deck={deck} grade={grade} go={go} />}
      {kind === 'imalah' && <Imalah deck={deck} grade={grade} />}
      {kind === 'madd' && <Madd deck={deck} grade={grade} />}
      {kind === 'duri' && <DuriHafs deck={deck} grade={grade} />}
      {kind === 'mirror' && <Mirror />}
    </div>
  );
}

type Grade = (id: string, ok: boolean) => void;

/** `prefer` narrows the pool while it still has something to ask (e.g. words that have audio); the rest follow. */
function useQueue<T extends { id: string }>(deck: Deck, items: T[], prefer?: (item: T) => boolean) {
  const pick = (ex: string[]) => (prefer ? pickNext(deck, items.filter(prefer), ex) : undefined) ?? pickNext(deck, items, ex);
  const [asked, setAsked] = useState<string[]>([]);
  const [item, setItem] = useState<T | undefined>(() => pick([]));
  const next = () => {
    const ex = item ? [...asked.slice(-30), item.id] : asked;
    setAsked(ex);
    setItem(pick(ex));
  };
  return { item, next, count: asked.length };
}

function Spot({ deck, grade, rule, go }: { deck: Deck; grade: Grade; rule?: RuleId; go: (h: string) => void }) {
  const rules = useMemo(spotRulesAvailable, []);
  const chosen = rule && rules.includes(rule) ? rule : rules[0];
  const items = useMemo(() => spotItems(chosen), [chosen]);
  const { item, next, count } = useQueue<SpotItem>(deck, items);
  const [ok, setOk] = useState<boolean | null>(null);
  const [shown, setShown] = useState<number[]>([]);
  useEffect(() => { setOk(null); setShown([]); }, [item]);
  if (!item) return <p>لا توجد أسئلة.</p>;
  return (
    <>
      <div className="chips card">
        {rules.map((r) => (
          <button key={r} className="chip small" aria-pressed={r === chosen} onClick={() => go(`#/exercises/spot/${r}`)}>
            {RULES[r].label}
          </button>
        ))}
      </div>
      <div className="card">
        <p>
          أين <strong>{RULES[chosen].label}</strong>؟ اضغط الكلمة. <span className="ref">({arNum(count + 1)})</span>
        </p>
        <VerseLine verse={item.ref} highlight={ok === null ? [] : shown} onWord={(i) => { if (ok !== null) return; const right = item.answers.includes(i); setShown(item.answers); setOk(right); grade(item.id, right); }} />
        <Feedback ok={ok} rule={chosen} onNext={next} />
      </div>
    </>
  );
}

function Nun({ deck, grade }: { deck: Deck; grade: Grade }) {
  const items = useMemo(nunItems, []);
  const { item, next, count } = useQueue<NunItem>(deck, items);
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => setOk(null), [item]);
  if (!item) return <p>لا توجد أسئلة.</p>;
  return (
    <div className="card">
      <p>
        ماذا يحدث للنون الساكنة (أو التنوين) هنا؟ <span className="ref">({arNum(count + 1)})</span>
      </p>
      <div className="ayah huge" dir="rtl">{item.shown}</div>
      <div className="options">
        {NUN_OPTIONS.map((o) => (
          <button key={o.key} className={`option${ok !== null && o.key === item.answer ? ' right' : ''}`} disabled={ok !== null} onClick={() => { const r = o.key === item.answer; setOk(r); grade(item.id, r); }}>
            {o.label}
          </button>
        ))}
      </div>
      {ok !== null && <VerseLine verse={item.ref} highlight={[item.word]} />}
      <Feedback ok={ok} rule={item.rule} onNext={next} />
    </div>
  );
}

function Listen({ deck, grade, go }: { deck: Deck; grade: Grade; go: (h: string) => void }) {
  const items = useMemo(listenItems, []);
  const [available, setAvailable] = useState<ListenItem[] | null>(null);
  useEffect(() => {
    void (async () => {
      const ok: ListenItem[] = [];
      for (const it of items) if ((await getClip(`teacher/letters/${it.a}`)) && (await getClip(`teacher/letters/${it.b}`))) ok.push(it);
      setAvailable(ok);
    })();
  }, [items]);
  if (available === null) return <p className="ref">جارٍ البحث عن مقاطع المعلم…</p>;
  if (!available.length)
    return (
      <div className="card">
        <p>هذا التمرين يحتاج إلى مقاطع المعلم للحروف المنفردة (مثل ص و س).</p>
        <p className="ref">
          سجّلها من صفحة{' '}
          <a href="#/recorder" onClick={(e) => { e.preventDefault(); go('#/recorder'); }}>
            تسجيل المعلم
          </a>{' '}
          ثم عد إلى هنا. لا نستخدم أصواتاً مولّدة آلياً.
        </p>
      </div>
    );
  return <ListenInner deck={deck} grade={grade} items={available} />;
}

function ListenInner({ deck, grade, items }: { deck: Deck; grade: Grade; items: ListenItem[] }) {
  const { item, next, count } = useQueue<ListenItem>(deck, items);
  const [order, setOrder] = useState<[string, string]>(['a', 'b']);
  const [ok, setOk] = useState<boolean | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => { setOk(null); setOrder(Math.random() < 0.5 ? ['a', 'b'] : ['b', 'a']); }, [item]);
  if (!item) return <p>لا توجد أسئلة.</p>;
  const play = async (which: 'a' | 'b') => {
    const c = await getClip(`teacher/letters/${which === 'a' ? item.a : item.b}`);
    if (!c) return;
    if (!audio.current) audio.current = new Audio();
    audio.current.src = URL.createObjectURL(c.blob);
    void audio.current.play();
  };
  const target = item.bLetters;
  return (
    <div className="card">
      <p>
        اسمع المقطعين ثم اختر: أيهما <strong className="ayah">{target}</strong>؟ <span className="ref">({arNum(count + 1)})</span>
      </p>
      <div className="row wrap">
        {order.map((w, i) => (
          <button key={w} className="toggle" onClick={() => play(w as 'a' | 'b')}>
            ▶ المقطع {i === 0 ? 'الأول' : 'الثاني'}
          </button>
        ))}
      </div>
      <div className="options">
        {order.map((w, i) => (
          <button key={w} className={`option${ok !== null && w === 'b' ? ' right' : ''}`} disabled={ok !== null} onClick={() => { const r = w === 'b'; setOk(r); grade(item.id, r); }}>
            {i === 0 ? 'الأول' : 'الثاني'}
          </button>
        ))}
      </div>
      <Feedback ok={ok} detail={`${item.aLetters} / ${item.bLetters}`} onNext={next} />
    </div>
  );
}

function Imalah({ deck, grade }: { deck: Deck; grade: Grade }) {
  const items = useMemo(imalahItems, []);
  const { item, next, count } = useQueue<ImalahItem>(deck, items);
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => setOk(null), [item]);
  if (!item) return <p>لا توجد أسئلة.</p>;
  return (
    <div className="card">
      <p>
        هل تُمال الألف في هذه الكلمة عند الدوري؟ <span className="ref">({arNum(count + 1)})</span>
      </p>
      <div className="ayah huge" dir="rtl">{item.shown}</div>
      <VerseLine verse={item.ref} highlight={[item.word]} hideMark={ok === null} onWord={() => undefined} />
      <div className="options">
        {[true, false].map((v) => (
          <button key={String(v)} className={`option${ok !== null && v === item.answer ? ' right' : ''}`} disabled={ok !== null} onClick={() => { const r = v === item.answer; setOk(r); grade(item.id, r); }}>
            {v ? 'نعم، تُمال' : 'لا، ألف عادية'}
          </button>
        ))}
      </div>
      <Feedback ok={ok} rule="imalah" detail={ok !== null ? `في المصحف: ${item.ref.words[item.word]}` : undefined} onNext={next} />
    </div>
  );
}

function Madd({ deck, grade }: { deck: Deck; grade: Grade }) {
  const items = useMemo(maddItems, []);
  // Ask about words the learner can actually hear first: sūrahs with a shipped or saved alignment.
  const hasAudio = (i: MaddItem) => !!loadAlignment(DEFAULT_RECITER, i.ref.surah);
  const { item, next, count } = useQueue<MaddItem>(deck, items, hasAudio);
  const [ok, setOk] = useState<boolean | null>(null);
  const align = item ? loadAlignment(DEFAULT_RECITER, item.ref.surah) : undefined;
  const player = usePlayer(item ? audioUrl(DEFAULT_RECITER, item.ref.surah) : null);
  useEffect(() => setOk(null), [item]);
  if (!item) return <p>لا توجد أسئلة.</p>;
  const span = align?.verses.find((v) => v.basri === item.ref.basri)?.words[item.word];
  const canPlay = !!span && player.ready && span[1] > span[0];
  return (
    <div className="card">
      <p>
        كم حركة يُمد الصوت في هذه الكلمة؟ <span className="ref">({arNum(count + 1)})</span>
      </p>
      <div className="ayah huge" dir="rtl">{item.ref.words[item.word]}</div>
      <div className="row wrap">
        <button className="toggle" onClick={() => span && player.playRange(span[0], span[1])} disabled={!canPlay}>
          ▶ اسمع الكلمة
        </button>
        {!canPlay && <span className="ref">(الصوت يتوفر بعد جلب التسجيل ومحاذاة السورة)</span>}
      </div>
      <div className="options">
        {([2, 4, 6] as const).map((n) => (
          <button key={n} className={`option${ok !== null && n === item.answer ? ' right' : ''}`} disabled={ok !== null} onClick={() => { const r = n === item.answer; setOk(r); grade(item.id, r); }}>
            {arNum(n)} حركات
          </button>
        ))}
      </div>
      {ok !== null && <VerseLine verse={item.ref} highlight={[item.word]} />}
      <Feedback ok={ok} rule={item.rule} onNext={next} />
    </div>
  );
}

function DuriHafs({ deck, grade }: { deck: Deck; grade: Grade }) {
  const items = useMemo(duriHafsItems, []);
  const { item, next, count } = useQueue<DuriHafsItem>(deck, items);
  const [ok, setOk] = useState<boolean | null>(null);
  const options = useMemo(() => {
    if (!item) return [];
    const others = items.filter((o) => o.id !== item.id && o.duri !== item.duri);
    const distractor = others.length ? others[Math.floor(Math.random() * others.length)].duri : item.hafs;
    return shuffle([
      { text: item.duri, right: true },
      { text: item.hafs, right: false },
      { text: distractor, right: false },
    ]);
  }, [item, items]);
  useEffect(() => setOk(null), [item]);
  if (!item) return <p>لا توجد أسئلة.</p>;
  return (
    <div className="card">
      <p>
        هكذا يقرؤها حفص: <span className="ref">({arNum(count + 1)})</span>
      </p>
      <div className="ayah huge" dir="rtl">{item.hafs}</div>
      <p>كيف يقرؤها الدوري؟</p>
      <div className="options">
        {options.map((o, i) => (
          <button key={i} className={`option ayah${ok !== null && o.right ? ' right' : ''}`} disabled={ok !== null} onClick={() => { setOk(o.right); grade(item.id, o.right); }}>
            {o.text}
          </button>
        ))}
      </div>
      {ok !== null && <VerseLine verse={item.ref} highlight={[item.word]} />}
      <Feedback ok={ok} rule={item.rule} onNext={next} />
    </div>
  );
}

function Mirror() {
  const [letter, setLetter] = useState('qaf');
  const video = useRef<HTMLVideoElement | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((s) => {
        stream = s;
        if (video.current) video.current.srcObject = s;
      })
      .catch((e) => setErr(String(e)));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);
  const ids = ['qaf', 'kaf', 'tha', 'dad', 'tta', 'sad', 'ra', 'imalah', 'fa', 'waw'];
  return (
    <>
      <div className="card">
        <p className="ref">انظر إلى فمك في الكاميرا وقلّد الرسم ببطء. لا تحليل ولا تقييم؛ المرآة فقط.</p>
        <div className="chips">
          {ids.map((id) => (
            <button key={id} className="chip" aria-pressed={id === letter} onClick={() => setLetter(id)}>
              {BY_ID[id].letters}
            </button>
          ))}
        </div>
      </div>
      <div className="mirror">
        <div className="card mirror-cam">
          {err ? <p className="todo">⚠ تعذر فتح الكاميرا: {err}</p> : <video ref={video} autoPlay playsInline muted />}
        </div>
        <LetterViewer id={letter} />
      </div>
    </>
  );
}
