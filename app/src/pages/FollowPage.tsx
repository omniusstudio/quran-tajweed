import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadAlignment, locate, playSpan, type SurahAlign, type VerseAlign } from '../audio/alignment';
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
import { useSettings } from '../ui/settings';
import { inPortionAhead, markRead, wirdState } from '../content/wird';
import { rewardWird } from '../ui/rewards';
import { micProblem } from '../audio/mic';

const SPEEDS: { v: PlaySpeed; label: string }[] = [
  { v: 0.5, label: '٠٫٥×' },
  { v: 0.75, label: '٠٫٧٥×' },
  { v: 1, label: '١×' },
];
const AR = ['٠', '١', '٢', '٣', '٤', '٥', '٦'];

/** Follow-along recitation mode (PROMPT.md §7.2). */
export function FollowPage({ surah, verse, go }: { surah: number; verse?: number; go: (hash: string) => void }) {
  const [settings, updateSettings] = useSettings();
  const reciter = RECITERS.some((r) => r.id === settings.reciter) ? settings.reciter : DEFAULT_RECITER;
  const setReciter = (id: string) => updateSettings({ reciter: id });
  const s = SURAH_BY_NUMBER[surah] ?? SURAHS[0];
  useEffect(() => {
    if (settings.lastSurah !== s.number) updateSettings({ lastSurah: s.number });
  }, [s.number]); // eslint-disable-line react-hooks/exhaustive-deps
  const align: SurahAlign | undefined = useMemo(() => loadAlignment(reciter, s.number), [reciter, s.number]);
  const player = usePlayer(audioUrl(reciter, s.number));
  const pos = align ? locate(align, player.time) : null;
  const [picked, setPicked] = useState<{ verse: number; word: number } | null>(null);
  const mode = settings.playMode ?? 'continuous';
  /** Verse to play next (verse-by-verse mode), and where to resume (continuous mode). */
  const savedAt = settings.positions?.[String(s.number)] ?? 0;
  const savedVerse = align && savedAt > 0 ? Math.max(0, align.verses.findIndex((v) => savedAt < v.end)) : 0;
  const linkedVerse = verse ? s.verses.findIndex((v) => v.basri === verse) : -1;
  const [cursor, setCursor] = useState<number>(linkedVerse >= 0 ? linkedVerse : savedVerse);
  const bookmark = settings.bookmark;
  const hereMarked = (vi: number) => !!bookmark && bookmark.surah === s.number && bookmark.basri === s.verses[vi]?.basri;
  /** Pin the ribbon on a verse by hand (tap again to unpin). */
  const toggleBookmark = (vi: number) => {
    sfx('toggle');
    if (hereMarked(vi) && bookmark?.pinned) return updateSettings({ bookmark: { ...bookmark, pinned: false } });
    updateSettings({ bookmark: { surah: s.number, basri: s.verses[vi].basri, pinned: true, at: Date.now() } });
  };
  // a verse reached through a link (the home card, the bookmark) scrolls into view, ready to play
  useEffect(() => {
    if (linkedVerse < 0) return;
    const t = setTimeout(() => verseRefs.current[linkedVerse]?.scrollIntoView({ block: 'center' }), 250);
    return () => clearTimeout(t);
  }, [linkedVerse]);
  const lastVerseRef = useRef<number | null>(null);
  // remember where the learner is: on pause, and whenever the verse changes
  useEffect(() => {
    if (pos && pos.verse !== lastVerseRef.current) {
      // the verse just finished counts toward today's wird when it lies inside the portion
      const prev = lastVerseRef.current;
      if (prev !== null && pos.verse > prev) {
        const ref = { surah: s.number, basri: s.verses[prev].basri };
        if (inPortionAhead(wirdState(), ref)) rewardWird(markRead(ref));
      }
      lastVerseRef.current = pos.verse;
      if (mode === 'continuous') setCursor(pos.verse);
    }
  }, [pos?.verse]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (player.playing || player.time <= 0) return;
    const positions = { ...(settings.positions ?? {}), [String(s.number)]: Number(player.time.toFixed(2)) };
    const here = align ? Math.max(0, align.verses.findIndex((v) => player.time < v.end)) : cursor;
    const ribbon = bookmark?.pinned ? bookmark : { surah: s.number, basri: s.verses[here]?.basri ?? s.verses[0].basri, pinned: false, at: Date.now() };
    if ((settings.positions ?? {})[String(s.number)] !== positions[String(s.number)] || ribbon !== bookmark) updateSettings({ positions, bookmark: ribbon });
  }, [player.playing]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Play one verse and stop (verse-by-verse mode); the cursor moves on when it finishes. */
  const playVerse = (vi: number) => {
    if (!align) return;
    const v = align.verses[vi];
    if (!v) return;
    setCursor(vi);
    player.setLoop(null);
    const [a, b] = playSpan(v);
    void player.playRange(a, b).then((ok) => ok && setCursor(Math.min(vi + 1, align.verses.length - 1)));
  };
  /** Start from the beginning of a verse: through to the end in continuous mode, one verse otherwise. */
  const playFrom = (vi: number) => {
    if (!align) return;
    sfx('tap');
    if (mode === 'verse') return playVerse(vi);
    setCursor(vi);
    player.setLoop(null);
    player.seek(playSpan(align.verses[vi])[0]);
    void player.play();
  };
  /** The big button: pause, or continue from the verse the learner is on. */
  const mainToggle = () => {
    if (player.playing) return player.pause();
    if (!align) return void player.play();
    if (mode === 'verse') return playVerse(cursor);
    if (player.time <= 0.01 && savedAt > 0) player.seek(align.verses[cursor]?.start ?? savedAt);
    void player.play();
  };
  const cursorVerse = align?.verses[cursor];
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
    const [a, b] = playSpan(align.verses[vi]);
    const same = player.loop && player.loop[0] === a && player.loop[1] === b;
    player.setLoop(same ? null : [a, b]);
    if (!same) {
      player.seek(a);
      void player.play();
    }
  };

  // The verse rows are memoised (al-Baqarah has 6,000 words; re-rendering them every animation frame
  // made the highlight lag behind the voice), so they get stable handlers and a stable player API.
  const actRef = useRef<RowActions>({ playFrom, tapWord, toggleBookmark, loopVerse });
  actRef.current = { playFrom, tapWord, toggleBookmark, loopVerse };
  const act = useMemo<RowActions>(
    () => ({
      playFrom: (vi) => actRef.current.playFrom(vi),
      tapWord: (vi, wi) => actRef.current.tapWord(vi, wi),
      toggleBookmark: (vi) => actRef.current.toggleBookmark(vi),
      loopVerse: (vi) => actRef.current.loopVerse(vi),
    }),
    [],
  );
  const api = useMemo<PlayerApi>(
    () => ({ audio: player.audio, pause: player.pause, setLoop: player.setLoop, playRange: player.playRange }),
    [player.audio, player.pause, player.setLoop, player.playRange],
  );

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
      <div className="card follow-head">
        <div className="field">
          <label htmlFor="follow-surah">السورة</label>
          <div className="select">
            <select id="follow-surah" value={s.number} onChange={(e) => go(`#/follow/${e.target.value}`)}>
              {SURAHS.map((x) => (
                <option key={x.number} value={x.number}>
                  {arNum(x.number)} — {x.name}
                </option>
              ))}
            </select>
            <Icon name="chevronLeft" size={18} className="select-arrow" />
          </div>
          <div className="surah-nav">
            <button className="mini" disabled={s.number <= 1} onClick={() => go(`#/follow/${s.number - 1}`)}><Icon name="chevronRight" size={16} /> السابقة</button>
            <span className="ref">{arNum(s.verses.length)} آية</span>
            <button className="mini" disabled={s.number >= 114} onClick={() => go(`#/follow/${s.number + 1}`)}>التالية <Icon name="chevronLeft" size={16} /></button>
          </div>
        </div>
        <div className="field">
          <span className="label-text">القارئ</span>
          <div className="reciters" role="group" aria-label="القارئ">
            {RECITERS.map((r) => (
              <button key={r.id} className="reciter" aria-pressed={r.id === reciter} onClick={() => { setReciter(r.id); sfx('toggle'); }}>
                <strong>{r.nameAr}</strong>
                <small>{r.note}</small>
              </button>
            ))}
          </div>
        </div>
        {player.error && <p className="todo"><Icon name="alert" size={18} /> {player.error}</p>}
        {player.loading !== null && (
          <p className="ref loading-note">
            <span className="bar" style={{ width: 160, display: 'inline-block', verticalAlign: 'middle' }}><i style={{ transform: `scaleX(${player.loading})` }} /></span>{' '}
            جارٍ جلب التلاوة من الإنترنت للمرة الأولى ({arNum(Math.round(player.loading * 100))}٪)… تُحفظ على الجهاز بعدها.
          </p>
        )}
        {!player.ready && !player.error && player.loading === null && <p className="ref">جارٍ تحميل التلاوة…</p>}
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
        <button className="play" onClick={mainToggle} aria-label={player.playing ? 'إيقاف مؤقت' : 'تشغيل'} disabled={!player.ready} title={cursorVerse && !player.playing ? `من الآية ${arNum(cursorVerse.basri)}` : undefined}>
          <Icon name={player.playing ? 'pause' : 'play'} size={24} />
        </button>
        {!player.playing && cursorVerse && (cursor > 0 || mode === 'verse') && (
          <span className="resume-hint" aria-live="polite">{mode === 'verse' ? 'الآية' : 'من الآية'} {arNum(cursorVerse.basri)}</span>
        )}
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
        <div className="segmented" role="group" aria-label="طريقة التشغيل" title="متواصل: يكمل السورة. آية آية: يقف بعد كل آية وتتابع أنت.">
          <button aria-pressed={mode === 'continuous'} onClick={() => { updateSettings({ playMode: 'continuous' }); sfx('toggle'); }}>متواصل</button>
          <button aria-pressed={mode === 'verse'} onClick={() => { updateSettings({ playMode: 'verse' }); sfx('toggle'); player.pause(); }} disabled={!align}>آية آية</button>
        </div>
        <div className="indicators in-bar">
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
          return (
            <VerseRow
              key={v.basri}
              v={v}
              vi={vi}
              va={va}
              active={active}
              onWord={active ? pos!.word : -1}
              pickedWord={picked?.verse === vi ? picked.word : -1}
              maddLen={active ? maddLen : 0}
              maddCount={active ? maddCount : 0}
              marked={hereMarked(vi)}
              pinned={!!bookmark?.pinned}
              looping={!!(va && player.loop && player.loop[0] === playSpan(va)[0] && player.loop[1] === playSpan(va)[1])}
              next={cursor === vi && !player.playing}
              reciter={reciter}
              surah={s.number}
              api={api}
              act={act}
              refs={verseRefs}
            />
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
type PlayerApi = Pick<ReturnType<typeof usePlayer>, 'audio' | 'pause' | 'setLoop' | 'playRange'>;
interface RowActions {
  playFrom: (vi: number) => void;
  tapWord: (vi: number, wi: number) => void;
  toggleBookmark: (vi: number) => void;
  loopVerse: (vi: number) => void;
}

/** One verse of the follow-along text. Memoised: only the verse being read (and the one just left) re-renders while the audio plays. */
const VerseRow = memo(function VerseRow({ v, vi, va, active, onWord, pickedWord, maddLen, maddCount, marked, pinned, looping, next, reciter, surah, api, act, refs }: {
  v: { basri: number; words: string[] };
  vi: number;
  va: VerseAlign | undefined;
  active: boolean;
  onWord: number;
  pickedWord: number;
  maddLen: number;
  maddCount: number;
  marked: boolean;
  pinned: boolean;
  looping: boolean;
  next: boolean;
  reciter: string;
  surah: number;
  api: PlayerApi;
  act: RowActions;
  refs: React.MutableRefObject<(HTMLDivElement | null)[]>;
}) {
  return (
    <div ref={(el) => { refs.current[vi] = el; }} className={`verse${active ? ' active' : ''}${marked ? (pinned ? ' marked pinned' : ' marked') : ''}`} dir="rtl">
      {marked && <span className="ribbon" title={pinned ? 'علامة مثبّتة' : 'هنا توقفت'}><Icon name="bookmark" size={16} /></span>}
      <span className="ayah">
        {va && (
          <button className={`verse-play${next ? ' next' : ''}`} onClick={() => act.playFrom(vi)} aria-label={`شغّل من الآية ${arNum(v.basri)}`} title={`من الآية ${arNum(v.basri)}`}>
            <Icon name="play" size={14} />
          </button>
        )}
        {v.words.map((w, wi) => {
          const on = onWord === wi;
          return (
            <span key={wi}>
              <button className={`word${on ? ' on' : ''}${pickedWord === wi ? ' picked' : ''}`} onClick={() => act.tapWord(vi, wi)} disabled={!va}>
                {w}
                {on && maddLen > 0 && (
                  <span className="word-madd" aria-hidden>
                    {Array.from({ length: maddLen }, (_, i) => (
                      <i key={i} className={i < maddCount ? 'on' : ''} />
                    ))}
                    <b>{AR[maddLen]}</b>
                  </span>
                )}
              </button>{' '}
            </span>
          );
        })}
        <span className="num">﴿{arNum(v.basri)}﴾</span>
      </span>
      <span className="verse-tools">
        <button className="mini" onClick={() => act.toggleBookmark(vi)} aria-pressed={marked && pinned} title="ثبّت العلامة هنا">
          <Icon name="bookmark" size={14} /> {marked && pinned ? 'مثبّتة' : 'علامة'}
        </button>
        <button className="mini" onClick={() => act.loopVerse(vi)} aria-pressed={looping} disabled={!va}>
          {looping ? 'أوقف التكرار' : 'كرر الآية'}
        </button>
        <RecordCompare reciter={reciter} surah={surah} basri={v.basri} span={va ? playSpan(va) : null} player={api} />
      </span>
    </div>
  );
});

function RecordCompare({ reciter, surah, basri, span, player }: { reciter: string; surah: number; basri: number; span: [number, number] | null; player: PlayerApi }) {
  const key = `me/${reciter}/${surah}/${basri}`;
  const [mine, setMine] = useState<Blob | null>(null);
  const [recording, setRecording] = useState<{ stop: () => Promise<Blob> } | null>(null);
  const [open, setOpen] = useState(false);
  const [loopMine, setLoopMine] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
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
        setProblem(null);
      } catch (e) {
        setProblem(micProblem(e));
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
      <button className={`mini${recording ? ' rec' : ''}`} onClick={toggleRec}>
        <Icon name={recording ? 'stop' : 'record'} size={14} /> {recording ? 'أوقف التسجيل' : mine ? 'سجّل من جديد' : 'سجّل نفسك'}
      </button>
      {mine && (
        <button className="mini" onClick={() => setOpen((o) => !o)} aria-pressed={open}>
          قارن
        </button>
      )}
      {problem && <span className="todo"><Icon name="alert" size={16} /> {problem}</span>}
      {open && mine && (
        <span className="compare-panel">
          {span ? (
            <span className="ab">
              <button className="ab-btn teacher" onClick={playTeacher}>المعلم</button>
              <canvas ref={teacherCanvas} width={240} height={40} />
            </span>
          ) : (
            <span className="ref">لم تُحدَّد هذه الآية في التسجيل بعد، فلا مقارنة مع القارئ هنا.</span>
          )}
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
