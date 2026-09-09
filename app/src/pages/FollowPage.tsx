import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadAlignment, locate, type SurahAlign } from '../audio/alignment';
import { lettersOf } from '../audio/letters';
import { audioContext, decode, drawWave, envelope, normalise } from '../audio/peaks';
import { DEFAULT_RECITER, RECITERS, SURAHS, SURAH_BY_NUMBER, audioUrl } from '../audio/quran';
import { RULES as LESSON_RULES } from '../content/lessons';
import { RULES, tagVerse, tagsByWord, type Tag } from '../rules/tagger';
import { getClip, putClip, startRecording } from '../audio/store';
import { beep, usePlayer, type PlaySpeed } from '../audio/usePlayer';
import { BY_ID } from '../viewer/articulations';
import { arNum } from './shared';
import { Icon } from '../ui/icons';
import { rewardRecording } from '../ui/rewards';
import { sfx } from '../ui/sound';

const SPEEDS: { v: PlaySpeed; label: string }[] = [
  { v: 0.5, label: '٠٫٥×' },
  { v: 0.75, label: '٠٫٧٥×' },
  { v: 1, label: '١×' },
];
const AR = ['٠', '١', '٢', '٣', '٤', '٥', '٦'];

/** Follow-along recitation mode (PROMPT.md §7.2). */
export function FollowPage({ surah, go }: { surah: number; go: (hash: string) => void }) {
  const [reciter, setReciter] = useState(DEFAULT_RECITER);
  const s = SURAH_BY_NUMBER[surah] ?? SURAHS[0];
  const align: SurahAlign | undefined = useMemo(() => loadAlignment(reciter, s.number), [reciter, s.number]);
  const player = usePlayer(audioUrl(reciter, s.number));
  const pos = align ? locate(align, player.time) : null;
  const [picked, setPicked] = useState<{ verse: number; word: number } | null>(null);
  const [echo, setEcho] = useState(false);
  const echoRef = useRef(false);
  const verseRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rec = RECITERS.find((r) => r.id === reciter)!;
  /** Rule tags per verse, per word (the tagger is pure; computed once per sūrah). */
  const verseTags = useMemo(() => s.verses.map((v, i) => tagsByWord(tagVerse({ words: v.words, hafs: v.hafs, nextWord: s.verses[i + 1]?.words[0] ?? null }), v.words.length)), [s]);

  useEffect(() => {
    if (pos && player.playing) verseRefs.current[pos.verse]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [pos?.verse, player.playing]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- echo mode: play word → pause → beep → learner repeats → next word ----
  const runEcho = useCallback(
    async (from: { verse: number; word: number }) => {
      if (!align) return;
      echoRef.current = true;
      const ctx = audioContext();
      for (let vi = from.verse; vi < align.verses.length && echoRef.current; vi++) {
        const v = align.verses[vi];
        for (let wi = vi === from.verse ? from.word : 0; wi < v.words.length && echoRef.current; wi++) {
          const [a, b] = v.words[wi];
          setPicked({ verse: vi, word: wi });
          const ok = await player.playRange(a, b);
          if (!ok || !echoRef.current) break;
          await new Promise((r) => setTimeout(r, 250));
          await beep(ctx);
          await new Promise((r) => setTimeout(r, Math.max(700, ((b - a) / player.speed) * 1500)));
        }
      }
      echoRef.current = false;
      setEcho(false);
    },
    [align, player],
  );
  const toggleEcho = () => {
    if (echo) {
      echoRef.current = false;
      setEcho(false);
      player.pause();
    } else {
      setEcho(true);
      void runEcho(pos ?? picked ?? { verse: 0, word: 0 });
    }
  };

  const tapWord = (vi: number, wi: number) => {
    if (!align) return;
    const span = align.verses[vi]?.words[wi];
    if (!span) return;
    setPicked({ verse: vi, word: wi });
    player.setLoop(null);
    player.seek(span[0]);
    void player.play();
  };

  const loopWord = () => {
    if (!align || !picked) return;
    const span = align.verses[picked.verse].words[picked.word];
    player.setLoop(player.loop ? null : [span[0], span[1]]);
    if (!player.playing) {
      player.seek(span[0]);
      void player.play();
    }
  };

  const loopVerse = (vi: number) => {
    if (!align) return;
    const v = align.verses[vi];
    const same = player.loop && player.loop[0] === v.start && player.loop[1] === v.end;
    player.setLoop(same ? null : [v.start, v.end]);
    if (!same) {
      player.seek(v.start);
      void player.play();
    }
  };

  // ---- indicators for the word being sounded, from the rule tagger ----
  const cur = pos ?? picked;
  const curTags: Tag[] = cur ? verseTags[cur.verse]?.[cur.word] ?? [] : [];
  const maddTag = curTags.filter((t) => t.length).sort((a, b) => (b.length ?? 0) - (a.length ?? 0))[0];
  const maddLen = maddTag?.length ?? 0;
  let maddCount = 0;
  if (align && pos && maddLen) {
    const [a, b] = align.verses[pos.verse].words[pos.word];
    const p = b > a ? (player.time - a) / (b - a) : 0;
    maddCount = Math.min(maddLen, Math.ceil((Math.max(0, p - 0.3) / 0.7) * maddLen));
  }
  const ghunnahRules = new Set(['ghunnah', 'idgham_ghunnah', 'ikhfa', 'iqlab', 'mim_ikhfa', 'mim_idgham']);
  const ghunnahOn = !!(player.playing && pos && curTags.some((t) => ghunnahRules.has(t.rule)));
  const pickedWord = picked ? s.verses[picked.verse]?.words[picked.word] : undefined;
  const pickedTags: Tag[] = picked ? verseTags[picked.verse]?.[picked.word] ?? [] : [];
  const cues = { madd: maddLen, imalah: curTags.some((t) => t.rule === 'imalah'), tashil: curTags.some((t) => t.rule === 'tashil') };

  return (
    <div className="page follow">
      <div className="card">
        <div className="row wrap">
          <label>
            السورة{' '}
            <select value={s.number} onChange={(e) => go(`#/follow/${e.target.value}`)}>
              {SURAHS.map((x) => (
                <option key={x.number} value={x.number}>
                  {arNum(x.number)} — {x.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            القارئ{' '}
            <select value={reciter} onChange={(e) => setReciter(e.target.value)}>
              {RECITERS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nameAr} — {r.note}
                </option>
              ))}
            </select>
          </label>
        </div>
        {player.error && <p className="todo"><Icon name="alert" size={18} /> {player.error}</p>}
        {!player.ready && !player.error && <p className="ref">جارٍ تحميل التلاوة… (في المرة الأولى تُجلب من الإنترنت وتُحفظ على هذا الجهاز)</p>}
        {!align && (
          <p className="todo">
            <Icon name="alert" size={18} /> لم تُحاذَ هذه السورة لهذا القارئ بعد، فلن تُضاء الكلمات مع الصوت.{' '}
            <a href={`#/align/${s.number}`} onClick={(e) => { e.preventDefault(); go(`#/align/${s.number}`); }}>
              افتح محرر المحاذاة
            </a>
          </p>
        )}
        {align?.auto && <p className="todo"><Icon name="alert" size={18} /> محاذاة لم تُراجَع بالسماع بعد (يُراجع): قد تسبق إضاءة الكلمة صوتها أو تتأخر عنه قليلاً.</p>}
      </div>

      <div className="controls sticky">
        <button className="play" onClick={player.toggle} aria-label={player.playing ? 'إيقاف مؤقت' : 'تشغيل'} disabled={!player.ready}>
          <Icon name={player.playing ? 'pause' : 'play'} size={24} />
        </button>
        <input type="range" min={0} max={Math.max(1, Math.round(player.duration * 100))} value={Math.round(player.time * 100)} onChange={(e) => player.seek(Number(e.target.value) / 100)} aria-label="موضع التشغيل" />
        <div className="speeds">
          {SPEEDS.map((sp) => (
            <button key={sp.v} aria-pressed={player.speed === sp.v} onClick={() => player.setSpeed(sp.v)}>
              {sp.label}
            </button>
          ))}
        </div>
        <button className="toggle" aria-pressed={echo} onClick={() => { sfx('toggle'); toggleEcho(); }} disabled={!align || !player.ready} title="اسمع الكلمة، ثم صفارة، ثم كرّرها">
          <Icon name="repeat" size={18} />
          وضع الصدى
        </button>
      </div>

      <div className="indicators">
        <span className={`ticker${cues?.madd ? '' : ' off'}`} aria-label="عداد المد">
          <span className="phase">مد</span>
          {Array.from({ length: cues?.madd || 2 }, (_, i) => (
            <span key={i} className={`cell${i < maddCount ? ' on' : ''}`}>
              {AR[i + 1]}
            </span>
          ))}
        </span>
        <span className={`nose${ghunnahOn ? ' on' : ''}`}>
          <Icon name="nose" size={18} /> {ghunnahOn ? 'غنة' : 'الأنف'}
        </span>
        {align?.preamble && player.time >= align.preamble[0] && player.time < align.preamble[1] && <span className="badge">الاستعاذة</span>}
        {cues?.imalah && <span className="badge">إمالة</span>}
        {cues?.tashil && <span className="badge">تسهيل</span>}
      </div>

      <div className="mushaf card">
        {s.header && (
          <div className="verse header" dir="rtl">
            <span className="ayah">{s.header}</span>
          </div>
        )}
        {s.verses.map((v, vi) => {
          const va = align?.verses[vi];
          const active = pos?.verse === vi;
          const looping = !!(va && player.loop && player.loop[0] === va.start && player.loop[1] === va.end);
          return (
            <div key={v.basri} ref={(el) => { verseRefs.current[vi] = el; }} className={`verse${active ? ' active' : ''}`} dir="rtl">
              <span className="ayah">
                {v.words.map((w, wi) => {
                  const on = pos?.verse === vi && pos.word === wi;
                  const isPicked = picked?.verse === vi && picked.word === wi;
                  return (
                    <span key={wi}>
                      <button className={`word${on ? ' on' : ''}${isPicked ? ' picked' : ''}`} onClick={() => tapWord(vi, wi)} disabled={!va}>
                        {w}
                      </button>{' '}
                    </span>
                  );
                })}
                <span className="num">﴿{arNum(v.basri)}﴾</span>
              </span>
              <span className="verse-tools">
                <button className="mini" onClick={() => loopVerse(vi)} aria-pressed={looping} disabled={!va}>
                  {looping ? 'أوقف التكرار' : 'كرر الآية'}
                </button>
                <RecordCompare reciter={reciter} surah={s.number} basri={v.basri} span={va ? [va.start, va.end] : null} player={player} />
              </span>
            </div>
          );
        })}
        <p className="ref credit">{rec.credit}</p>
      </div>

      {picked && pickedWord && (
        <div className="card wordpanel">
          <div className="row wrap">
            <span className="ayah big">{pickedWord}</span>
            <button className="toggle" aria-pressed={!!player.loop} onClick={loopWord}>
              {player.loop ? 'أوقف تكرار الكلمة' : 'كرر هذه الكلمة'}
            </button>
          </div>
          <p className="ref">حروف الكلمة — اضغط حرفاً لترى كيف يُنطق:</p>
          <div className="chips">
            {lettersOf(pickedWord).map(({ ch, id }) => (
              <button key={ch} className="chip" onClick={() => go(`#/letters/${id}`)} title={BY_ID[id]?.nameAr}>
                {ch}
              </button>
            ))}
          </div>
          <p className="ref" style={{ marginBlockStart: 8 }}>القواعد في هذه الكلمة (من علامات المصحف):</p>
          {pickedTags.length === 0 && <p className="ref">لا قاعدة خاصة هنا.</p>}
          <div className="tagline">
            {pickedTags.map((t, i) => {
              const lesson = LESSON_RULES[RULES[t.rule].lesson];
              return (
                <a key={i} className={`tag ${RULES[t.rule].group}`} href={`#/lessons/${lesson.id}`} onClick={(e) => { e.preventDefault(); go(`#/lessons/${lesson.id}`); }} title={lesson.name}>
                  {RULES[t.rule].label}
                  {t.detail ? ` — ${t.detail}` : ''}
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Record yourself reciting one verse, then switch instantly between the teacher and you. */
function RecordCompare({ reciter, surah, basri, span, player }: { reciter: string; surah: number; basri: number; span: [number, number] | null; player: ReturnType<typeof usePlayer> }) {
  const key = `me/${reciter}/${surah}/${basri}`;
  const [mine, setMine] = useState<Blob | null>(null);
  const [recording, setRecording] = useState<{ stop: () => Promise<Blob> } | null>(null);
  const [open, setOpen] = useState(false);
  const [loopMine, setLoopMine] = useState(false);
  const mineAudio = useRef<HTMLAudioElement | null>(null);
  const mineCanvas = useRef<HTMLCanvasElement | null>(null);
  const teacherCanvas = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    void getClip(key).then((c) => setMine(c?.blob ?? null));
  }, [key]);

  useEffect(() => {
    if (!open || !mine || !mineCanvas.current) return;
    void mine.arrayBuffer().then(decode).then((b) => drawWave(mineCanvas.current!, normalise(envelope(b, 60)), { color: '#1d63b5' }));
  }, [open, mine]);

  useEffect(() => {
    if (!open || !span || !teacherCanvas.current) return;
    const src = player.audio.src;
    void fetch(src)
      .then((r) => r.arrayBuffer())
      .then(decode)
      .then((b) => {
        const env = envelope(b, 60);
        drawWave(teacherCanvas.current!, normalise(env.slice(Math.floor(span[0] * 60), Math.ceil(span[1] * 60))), { color: '#1f7a4d' });
      })
      .catch(() => undefined);
  }, [open, span, player.audio.src]);

  const toggleRec = async () => {
    if (recording) {
      const blob = await recording.stop();
      setRecording(null);
      setMine(blob);
      await putClip(key, blob);
      setOpen(true);
      rewardRecording();
    } else {
      player.pause();
      try {
        const r = await startRecording();
        setRecording(r);
      } catch (e) {
        alert(`تعذر الوصول إلى الميكروفون: ${String(e)}`);
      }
    }
  };

  const playTeacher = () => {
    if (!span) return;
    if (mineAudio.current) mineAudio.current.pause();
    player.setLoop(loopMine ? [span[0], span[1]] : null);
    void player.playRange(span[0], span[1]);
  };
  const playMine = () => {
    if (!mine) return;
    player.pause();
    if (!mineAudio.current) mineAudio.current = new Audio();
    mineAudio.current.src = URL.createObjectURL(mine);
    mineAudio.current.loop = loopMine;
    void mineAudio.current.play();
  };

  return (
    <span className="compare">
      <button className={`mini${recording ? ' rec' : ''}`} onClick={toggleRec} disabled={!span && !recording}>
        <Icon name={recording ? 'stop' : 'record'} size={14} /> {recording ? 'أوقف التسجيل' : mine ? 'سجّل من جديد' : 'سجّل نفسك'}
      </button>
      {mine && (
        <button className="mini" onClick={() => setOpen((o) => !o)} aria-pressed={open}>
          قارن
        </button>
      )}
      {open && mine && (
        <span className="compare-panel">
          <span className="ab">
            <button className="ab-btn teacher" onClick={playTeacher}>المعلم</button>
            <canvas ref={teacherCanvas} width={240} height={40} />
          </span>
          <span className="ab">
            <button className="ab-btn me" onClick={playMine}>أنا</button>
            <canvas ref={mineCanvas} width={240} height={40} />
          </span>
          <label className="mini-label">
            <input type="checkbox" checked={loopMine} onChange={(e) => setLoopMine(e.target.checked)} /> تكرار
          </label>
        </span>
      )}
    </span>
  );
}
