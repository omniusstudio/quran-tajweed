import { useEffect, useMemo, useRef, useState } from 'react';
import { loadAlignment, verseSpan, wordSpan } from '../audio/alignment';
import { DEFAULT_RECITER, RECITERS, audioUrl } from '../audio/quran';
import { usePlayer } from '../audio/usePlayer';
import { RULES as LESSON_RULES } from '../content/lessons';
import { NUN_OPTIONS, duriHafsItems, imalahItems, listenPairs, maddItems, nunItems, spotItems, spotRulesAvailable, type DuriHafsItem, type ImalahItem, type ListenPair, type ListenWord, type MaddItem, type NunItem, type SpotItem, type VerseRef } from '../exercises/bank';
import { answer, deckStats, loadDeck, pickNext, type Deck } from '../exercises/leitner';
import { RULES, type RuleId } from '../rules/tagger';
import { BY_ID } from '../viewer/articulations';
import { LetterViewer, arNum } from './shared';
import { Icon, type IconName } from '../ui/icons';
import { rewardAnswer } from '../ui/rewards';
import { sfx } from '../ui/sound';

export type ExerciseKind = 'spot' | 'nun' | 'listen' | 'imalah' | 'madd' | 'duri' | 'mirror';

export const EXERCISES: { kind: ExerciseKind; title: string; blurb: string; icon: IconName }[] = [
  { kind: 'spot', title: 'أين القاعدة؟', blurb: 'آية من المصحف: اضغط الكلمة التي فيها القاعدة.', icon: 'eye' },
  { kind: 'nun', title: 'ماذا يحدث لهذه النون؟', blurb: 'نون ساكنة أو تنوين ثم حرف: واضحة، تذوب، ميم، أم خفية؟', icon: 'nose' },
  { kind: 'listen', title: 'اسمع واختر', blurb: 'كلمتان من تلاوة القارئ: في أيهما الحرف المطلوب؟', icon: 'ear' },
  { kind: 'imalah', title: 'إمالة أم لا؟', blurb: 'كلمة فيها الناس / النار / الكافرين: هل تُمال هنا؟', icon: 'sparkles' },
  { kind: 'madd', title: 'كم حركة؟', blurb: 'كلمة فيها مد: حركتان، أربع، أم ست؟', icon: 'timer' },
  { kind: 'duri', title: 'الدوري وحفص', blurb: 'كلمة كما يقرؤها حفص: كيف يقرؤها الدوري؟', icon: 'split' },
  { kind: 'mirror', title: 'تمرين المرآة', blurb: 'الكاميرا الأمامية بجوار الرسم: قلّد حركة الفم ببطء.', icon: 'camera' },
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
        <strong>
          <Icon name={ok ? 'check' : 'x'} size={20} />
          {ok ? 'صحيح' : 'ليس هذا'}
        </strong>
        {rule && <span className="badge">{RULES[rule].label}</span>}
        {detail && <span className="ref">{detail}</span>}
        {lesson && (
          <a className="crumb" href={`#/lessons/${lesson.id}`}>
            الدرس: {lesson.name}
            <Icon name="chevronLeft" size={16} />
          </a>
        )}
      </div>
      <button className="primary" onClick={() => { sfx('tap'); onNext(); }} autoFocus>
        التالي
        <Icon name="chevronLeft" size={18} />
      </button>
    </div>
  );
}

/** Menu + the chosen exercise. `param` preselects a rule for "spot the rule". */
export function ExercisesPage({ kind, param, go }: { kind?: ExerciseKind; param?: string; go: (hash: string) => void }) {
  const [deck, setDeck] = useState<Deck>(loadDeck);
  const [run, setRun] = useState(0);
  const grade = (id: string, ok: boolean) => {
    setDeck((d) => answer(d, id, ok));
    const next = ok ? run + 1 : 0;
    setRun(next);
    rewardAnswer(ok, next);
  };
  if (!kind) {
    return (
      <div className="page lessons stagger grid2">
        <div className="card intro">
          <h2>التمارين</h2>
          <p className="ref">كل الأسئلة مولّدة من مصحف الدوري نفسه (سورة الفاتحة وجزء عمّ). ما تخطئ فيه يعود إليك أسرع.</p>
        </div>
        {EXERCISES.map((e) => {
          const st = deckStats(deck, `${e.kind === 'duri' ? 'dh' : e.kind}:`);
          return (
            <button key={e.kind} className="card exercise-card" onClick={() => { sfx('tap'); go(`#/exercises/${e.kind}`); }}>
              <span className="section-head">
                <h3>
                  <Icon name={e.icon} size={20} />
                  {e.title}
                </h3>
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
      <Icon name="chevronRight" size={18} />
      كل التمارين
    </a>
  );
  return (
    <div className="page lessons">
      <div className="lesson-head">
        {back}
        <span className="row">
          {run >= 2 && (
            <span className="run">
              <Icon name="sparkles" size={16} /> {arNum(run)} متتالية
            </span>
          )}
          <h2 style={{ margin: 0 }}>{EXERCISES.find((e) => e.kind === kind)?.title}</h2>
        </span>
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

/** One listen-and-pick word with its span in the reciter's recording. */
interface ListenChoice extends ListenWord {
  span: [number, number];
}
interface ListenItem {
  id: string;
  pair: ListenPair;
  /** The word the item is keyed on (a `b`-side word); its partner is drawn from the other side each time. */
  target: ListenChoice;
  side: 'a' | 'b';
}

/** Words of a pair side whose sound is known (hand-placed word boundaries only), with their spans. */
function alignedWords(reciter: string, words: ListenWord[]): ListenChoice[] {
  const out: ListenChoice[] = [];
  for (const w of words) {
    const span = wordSpan(reciter, w.ref.surah, w.ref.basri, w.word);
    if (span) out.push({ ...w, span });
  }
  return out;
}

/**
 * Listen and pick (PROMPT.md §7.3 no. 3): two real words from the reciter's recording, one with each
 * letter of a confusable pair. The muṣḥaf text is the answer key, so no teacher clips are needed.
 */
function Listen({ deck, grade, go }: { deck: Deck; grade: Grade; go: (h: string) => void }) {
  const reciter = DEFAULT_RECITER;
  const pools = useMemo(() => listenPairs().map((pair) => ({ pair, a: alignedWords(reciter, pair.a), b: alignedWords(reciter, pair.b) })).filter((p) => p.a.length && p.b.length), [reciter]);
  const items = useMemo(() => {
    const out: ListenItem[] = [];
    for (const p of pools) {
      for (const w of p.b) out.push({ id: `listen:${p.pair.id}:${w.ref.surah}:${w.ref.basri}:${w.word}`, pair: p.pair, target: w, side: 'b' });
      for (const w of p.a) out.push({ id: `listen:${p.pair.id}:${w.ref.surah}:${w.ref.basri}:${w.word}`, pair: p.pair, target: w, side: 'a' });
    }
    return out;
  }, [pools]);
  if (!items.length)
    return (
      <div className="card">
        <p>هذا التمرين يشغّل كلمتين من تلاوة القارئ، فيحتاج إلى سورة محاذاة.</p>
        <p className="ref">
          افتح{' '}
          <a href="#/align/1" onClick={(e) => { e.preventDefault(); go('#/align/1'); }}>
            محرر المحاذاة
          </a>{' '}
          وحاذِ سورة واحدة على الأقل، ثم عد إلى هنا.
        </p>
      </div>
    );
  return <ListenInner deck={deck} grade={grade} items={items} pools={pools} reciter={reciter} />;
}

function ListenInner({ deck, grade, items, pools, reciter }: { deck: Deck; grade: Grade; items: ListenItem[]; pools: { pair: ListenPair; a: ListenChoice[]; b: ListenChoice[] }[]; reciter: string }) {
  const { item, next, count } = useQueue<ListenItem>(deck, items);
  const [q, setQ] = useState<{ first: ListenChoice; second: ListenChoice; firstSide: 'a' | 'b'; asked: 'a' | 'b' } | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    setOk(null);
    if (!item) return setQ(null);
    const pool = pools.find((p) => p.pair.id === item.pair.id)!;
    const others = item.side === 'b' ? pool.a : pool.b;
    const same = others.filter((w) => w.ref.surah === item.target.ref.surah);
    const from = same.length ? same : others;
    const partner = from[Math.floor(Math.random() * from.length)];
    const targetFirst = Math.random() < 0.5;
    setQ({
      first: targetFirst ? item.target : partner,
      second: targetFirst ? partner : item.target,
      firstSide: targetFirst ? item.side : item.side === 'a' ? 'b' : 'a',
      asked: Math.random() < 0.5 ? 'a' : 'b',
    });
  }, [item, pools]);
  const playerA = usePlayer(q ? audioUrl(reciter, q.first.ref.surah) : null);
  const playerB = usePlayer(q ? audioUrl(reciter, q.second.ref.surah) : null);
  if (!item || !q) return <p>لا توجد أسئلة.</p>;
  const askedLetters = q.asked === 'a' ? item.pair.aLetters : item.pair.bLetters;
  const answer: 'first' | 'second' = q.firstSide === q.asked ? 'first' : 'second';
  const play = (which: 'first' | 'second') => {
    const [me, other] = which === 'first' ? [playerA, playerB] : [playerB, playerA];
    other.pause();
    const w = which === 'first' ? q.first : q.second;
    void me.playRange(w.span[0], w.span[1]);
  };
  const choose = (which: 'first' | 'second') => {
    const r = which === answer;
    setOk(r);
    grade(item.id, r);
  };
  const ready = playerA.ready && playerB.ready;
  const rec = RECITERS.find((r) => r.id === reciter);
  return (
    <div className="card">
      <p>
        اسمع الكلمتين ثم اختر: في أيهما <strong className="ayah">{askedLetters}</strong>؟ <span className="ref">({arNum(count + 1)})</span>
      </p>
      <div className="row wrap">
        {(['first', 'second'] as const).map((w, i) => {
          const p = w === 'first' ? playerA : playerB;
          return (
            <button key={w} className="toggle" aria-pressed={p.playing} onClick={() => play(w)} disabled={!ready}>
              <Icon name={p.playing ? 'pause' : 'play'} size={18} /> الكلمة {i === 0 ? 'الأولى' : 'الثانية'}
            </button>
          );
        })}
        {!ready && <span className="ref">(جارٍ تحميل التلاوة…)</span>}
        {(playerA.error || playerB.error) && <span className="todo"><Icon name="alert" size={18} /> {playerA.error || playerB.error}</span>}
      </div>
      <div className="options">
        {(['first', 'second'] as const).map((w, i) => (
          <button key={w} className={`option${ok !== null && w === answer ? ' right' : ''}`} disabled={ok !== null} onClick={() => choose(w)}>
            {i === 0 ? 'الأولى' : 'الثانية'}
          </button>
        ))}
      </div>
      {ok !== null && (
        <div className="row wrap" style={{ marginBlockStart: 8 }}>
          {(['first', 'second'] as const).map((w, i) => {
            const c = w === 'first' ? q.first : q.second;
            return (
              <span key={w} className="ref">
                {i === 0 ? 'الأولى' : 'الثانية'}: <span className="ayah">{c.ref.words[c.word]}</span> ({c.ref.surahName} {arNum(c.ref.basri)})
              </span>
            );
          })}
        </div>
      )}
      <Feedback ok={ok} detail={`${item.pair.aLetters} / ${item.pair.bLetters}${rec ? ' — ' + rec.credit : ''}`} onNext={next} />
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
  const player = usePlayer(item ? audioUrl(DEFAULT_RECITER, item.ref.surah) : null);
  useEffect(() => setOk(null), [item]);
  if (!item) return <p>لا توجد أسئلة.</p>;
  const word = wordSpan(DEFAULT_RECITER, item.ref.surah, item.ref.basri, item.word);
  const span = word ?? verseSpan(DEFAULT_RECITER, item.ref.surah, item.ref.basri);
  const canPlay = !!span && player.ready;
  return (
    <div className="card">
      <p>
        كم حركة يُمد الصوت في هذه الكلمة؟ <span className="ref">({arNum(count + 1)})</span>
      </p>
      <div className="ayah huge" dir="rtl">{item.ref.words[item.word]}</div>
      <div className="row wrap">
        <button className="toggle" onClick={() => span && player.playRange(span[0], span[1])} disabled={!canPlay}>
          <Icon name="play" size={18} /> {word ? 'اسمع الكلمة' : 'اسمع الآية'}
        </button>
        {!canPlay && <span className="ref">(لا صوت لهذه السورة بعد)</span>}
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
          {err ? <p className="todo"><Icon name="alert" size={18} /> تعذر فتح الكاميرا: {err}</p> : <video ref={video} autoPlay playsInline muted />}
        </div>
        <LetterViewer id={letter} />
      </div>
    </>
  );
}
