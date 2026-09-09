import { useEffect, useMemo, useRef, useState } from 'react';
import { loadAlignment } from '../audio/alignment';
import { decode, drawWave, envelope, normalise } from '../audio/peaks';
import { DEFAULT_RECITER, audioUrl } from '../audio/quran';
import { getClip, putClip, startRecording } from '../audio/store';
import { usePlayer } from '../audio/usePlayer';
import { DRILLS, type Drill } from '../content/drills';
import { REF_RULES } from '../content/duriRef';
import { RULES as LESSON_RULES } from '../content/lessons';
import { taggedVerses, type VerseRef } from '../exercises/bank';
import { RULES as TAG_RULES } from '../rules/tagger';
import { CONTRAST_PAIRS } from '../viewer/articulations';
import { ContrastView } from '../viewer/ContrastView';
import { LetterViewer, LinkedText, arNum } from './shared';

interface Instance {
  ref: VerseRef;
  word: number;
  label: string;
  detail?: string;
}

function instancesOf(d: Drill): Instance[] {
  const out: Instance[] = [];
  for (const t of taggedVerses()) {
    for (const x of t.tags) {
      if (!d.rules.includes(x.rule)) continue;
      if (out.some((o) => o.ref === t.ref && o.word === x.word)) continue;
      out.push({ ref: t.ref, word: x.word, label: TAG_RULES[x.rule].label, detail: x.detail });
    }
  }
  return out;
}

/** Dūrī polish drills: watch → hear slow → hear normal → record → compare (PROMPT.md §2.3). */
export function DrillsPage({ drillId, go }: { drillId?: string; go: (hash: string) => void }) {
  const drill = DRILLS.find((d) => d.id === drillId);
  if (!drill) {
    return (
      <div className="lessons">
        <div className="card">
          <h2>تدريبات الدوري</h2>
          <p className="ref">ما يجعل قراءة الدوري تُسمع كما هي. كل تدريب: شاهد الفم → اسمع ببطء → اسمع عادياً → سجّل نفسك → قارن.</p>
        </div>
        {DRILLS.map((d) => (
          <button key={d.id} className="card exercise-card" onClick={() => go(`#/drills/${d.id}`)}>
            <span className="section-head">
              <h3>{d.title}</h3>
              <span className="badge">{arNum(instancesOf(d).length)} موضعاً في جزء عمّ والفاتحة</span>
            </span>
            <span className="ref">{LESSON_RULES[d.lesson]?.name}</span>
          </button>
        ))}
      </div>
    );
  }
  return <DrillScreen drill={drill} go={go} />;
}

function DrillScreen({ drill, go }: { drill: Drill; go: (hash: string) => void }) {
  const lesson = LESSON_RULES[drill.lesson];
  const refs = drill.ref.map((r) => REF_RULES[r]).filter(Boolean);
  const instances = useMemo(() => instancesOf(drill), [drill]);
  const [idx, setIdx] = useState(0);
  const inst = instances[idx];
  const pair = drill.contrast ? CONTRAST_PAIRS.find((p) => p.id === drill.contrast) : undefined;
  useEffect(() => { setIdx(0); scrollTo({ top: 0 }); }, [drill]);
  return (
    <div className="lessons">
      <div className="lesson-head">
        <a className="crumb" href="#/drills" onClick={(e) => { e.preventDefault(); go('#/drills'); }}>← كل التدريبات</a>
        <h2 style={{ margin: 0 }}>{drill.title}</h2>
      </div>

      <div className="card">
        <h3>١. القاعدة</h3>
        {lesson && <LinkedText text={lesson.text} onTerm={(id) => go(`#/dictionary/${id}`)} />}
        {refs.map((r) => (
          <details key={r.id}>
            <summary className="ref">التفصيل: {r.name}</summary>
            <LinkedText text={r.text} onTerm={(id) => go(`#/dictionary/${id}`)} />
          </details>
        ))}
      </div>

      <div className="card">
        <h3>٢. شاهد الفم</h3>
        {pair ? <ContrastView key={pair.id} pair={pair} /> : drill.letter ? <LetterViewer id={drill.letter} /> : null}
      </div>

      <div className="card">
        <h3>٣. اسمع ببطء، ثم عادياً، ثم سجّل وقارن</h3>
        {instances.length === 0 && <p className="ref">لا مواضع لهذه القاعدة في سور المرحلة الأولى؛ انظر أمثلة الدرس.</p>}
        {inst && (
          <>
            <div className="row wrap">
              <button className="toggle" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>→ السابق</button>
              <span className="ref">الموضع {arNum(idx + 1)} من {arNum(instances.length)}</span>
              <button className="toggle" onClick={() => setIdx((i) => Math.min(instances.length - 1, i + 1))} disabled={idx >= instances.length - 1}>التالي ←</button>
            </div>
            <WordDrill key={`${inst.ref.surah}:${inst.ref.basri}:${inst.word}`} inst={inst} drill={drill} />
          </>
        )}
      </div>
    </div>
  );
}

function WordDrill({ inst, drill }: { inst: Instance; drill: Drill }) {
  const align = loadAlignment(DEFAULT_RECITER, inst.ref.surah);
  const player = usePlayer(audioUrl(DEFAULT_RECITER, inst.ref.surah));
  const verse = align?.verses.find((v) => v.basri === inst.ref.basri);
  const span = verse?.words[inst.word];
  const word = inst.ref.words[inst.word];
  const hafs = inst.ref.hafs[inst.word];
  const teacherKey = `teacher/examples/${drill.lesson}`;
  const [teacher, setTeacher] = useState<Blob | null>(null);
  const [mine, setMine] = useState<Blob | null>(null);
  const [rec, setRec] = useState<{ stop: () => Promise<Blob> } | null>(null);
  const mineKey = `me/drill/${drill.id}/${inst.ref.surah}/${inst.ref.basri}/${inst.word}`;
  const mineCanvas = useRef<HTMLCanvasElement | null>(null);
  const mineAudio = useRef<HTMLAudioElement | null>(null);
  const teacherAudio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    void (async () => {
      for (let i = 1; i <= 3; i++) {
        const c = await getClip(`${teacherKey}_${i}`);
        if (c) {
          setTeacher(c.blob);
          return;
        }
      }
    })();
    void getClip(mineKey).then((c) => setMine(c?.blob ?? null));
  }, [teacherKey, mineKey]);

  useEffect(() => {
    if (!mine || !mineCanvas.current) return;
    void mine.arrayBuffer().then(decode).then((b) => drawWave(mineCanvas.current!, normalise(envelope(b, 60)), { color: '#1d63b5' }));
  }, [mine]);

  const canPlay = !!span && player.ready && span[1] > span[0];
  const hear = (rate: 0.5 | 1) => {
    if (teacher) {
      if (!teacherAudio.current) teacherAudio.current = new Audio();
      const a = teacherAudio.current as HTMLAudioElement & { preservesPitch: boolean };
      a.preservesPitch = true;
      a.src = URL.createObjectURL(teacher);
      a.playbackRate = rate;
      void a.play();
    } else if (span) {
      player.setSpeed(rate === 0.5 ? 0.5 : 1);
      void player.playRange(Math.max(0, span[0] - 0.15), span[1] + 0.15);
    }
  };
  const toggleRec = async () => {
    if (rec) {
      const blob = await rec.stop();
      setRec(null);
      setMine(blob);
      await putClip(mineKey, blob);
    } else {
      try {
        setRec(await startRecording());
      } catch (e) {
        alert(`تعذر الوصول إلى الميكروفون: ${String(e)}`);
      }
    }
  };
  const playMine = () => {
    if (!mine) return;
    if (!mineAudio.current) mineAudio.current = new Audio();
    mineAudio.current.src = URL.createObjectURL(mine);
    void mineAudio.current.play();
  };
  const sourceNote = teacher ? 'صوت المعلم' : canPlay ? 'من تسجيل السورة' : 'لا صوت بعد: سجّل صوت المعلم أو اجلب التسجيل وحاذِ السورة';

  return (
    <div className="drill-word">
      <div className="ayah huge" dir="rtl">{word}</div>
      <div className="row wrap">
        <span className="badge">{inst.label}</span>
        {inst.detail && <span className="ref">{inst.detail}</span>}
        {hafs && hafs !== word && <span className="ref">حفص: <span className="ayah small">{hafs}</span></span>}
      </div>
      <div className="ayah" dir="rtl" style={{ fontSize: '1.5rem' }}>
        {inst.ref.words.map((w, i) => (
          <span key={i} className={i === inst.word ? 'hl' : ''}>{w} </span>
        ))}
      </div>
      <div className="ref">{inst.ref.surahName}، الآية {arNum(inst.ref.basri)}</div>
      <div className="row wrap" style={{ marginBlockStart: 8 }}>
        <button className="toggle" onClick={() => hear(0.5)} disabled={!teacher && !canPlay}>🐢 اسمع ببطء</button>
        <button className="toggle" onClick={() => hear(1)} disabled={!teacher && !canPlay}>▶ اسمع عادياً</button>
        <button className={`toggle${rec ? ' rec' : ''}`} onClick={toggleRec}>{rec ? '■ أوقف' : mine ? '● سجّل من جديد' : '● سجّل نفسك'}</button>
        {mine && <button className="ab-btn me" onClick={playMine}>أنا</button>}
        {mine && <canvas ref={mineCanvas} width={240} height={40} className="thumb" />}
        <span className="ref">{sourceNote}</span>
      </div>
      {player.error && !teacher && <p className="ref">{player.error}</p>}
    </div>
  );
}
