import { useEffect, useRef, useState } from 'react';
import { loadAlignment, type SurahAlign } from '../audio/alignment';
import { decode, drawWave, envelope, normalise, audioContext } from '../audio/peaks';
import { DEFAULT_RECITER, SURAH_BY_NUMBER, audioUrl } from '../audio/quran';
import { getClip, putClip, startRecording } from '../audio/store';
import { beep, usePlayer } from '../audio/usePlayer';
import { Icon } from '../ui/icons';
import { rewardRecording } from '../ui/rewards';
import { sfx } from '../ui/sound';
import { arNum } from './shared';

/**
 * Hear → echo → recite from memory (text hidden) → compare, for a run of verses of one sūrah.
 * Used by the verse of the day and the memorization challenge. Needs the sūrah's verse alignment;
 * otherwise it shows the text and says so.
 */
export function VerseDrill({ surah, verses, reciter = DEFAULT_RECITER, hideByDefault = false, clipKey, onRecorded }: { surah: number; verses: number[]; reciter?: string; hideByDefault?: boolean; clipKey: string; onRecorded?: () => void }) {
  const s = SURAH_BY_NUMBER[surah];
  const align: SurahAlign | undefined = loadAlignment(reciter, surah);
  const spans = verses.map((b) => align?.verses.find((v) => v.basri === b)).filter(Boolean) as SurahAlign['verses'];
  const canPlay = spans.length === verses.length && spans.every((v) => v.end > v.start);
  const player = usePlayer(canPlay ? audioUrl(reciter, surah) : null);
  const [hidden, setHidden] = useState(hideByDefault);
  const [mine, setMine] = useState<Blob | null>(null);
  const [rec, setRec] = useState<{ stop: () => Promise<Blob> } | null>(null);
  const [echo, setEcho] = useState(false);
  const echoRef = useRef(false);
  const mineAudio = useRef<HTMLAudioElement | null>(null);
  const mineCanvas = useRef<HTMLCanvasElement | null>(null);
  const teacherCanvas = useRef<HTMLCanvasElement | null>(null);
  const [current, setCurrent] = useState<number | null>(null);

  useEffect(() => {
    void getClip(clipKey).then((c) => setMine(c?.blob ?? null));
  }, [clipKey]);
  useEffect(() => {
    if (!mine || !mineCanvas.current) return;
    void mine.arrayBuffer().then(decode).then((b) => drawWave(mineCanvas.current!, normalise(envelope(b, 60)), { color: '#1d63b5' }));
  }, [mine]);
  useEffect(() => {
    if (!canPlay || !teacherCanvas.current) return;
    void fetch(audioUrl(reciter, surah))
      .then((r) => r.arrayBuffer())
      .then(decode)
      .then((b) => {
        const env = envelope(b, 60);
        drawWave(teacherCanvas.current!, normalise(env.slice(Math.floor(spans[0].start * 60), Math.ceil(spans[spans.length - 1].end * 60))), { color: '#1f7a4d' });
      })
      .catch(() => undefined);
  }, [canPlay, reciter, surah]); // eslint-disable-line react-hooks/exhaustive-deps

  // which verse is sounding
  useEffect(() => {
    if (!player.playing) return;
    const i = spans.findIndex((v) => player.time >= v.start && player.time < v.end);
    setCurrent(i >= 0 ? i : null);
  }, [player.time, player.playing]); // eslint-disable-line react-hooks/exhaustive-deps

  const playAll = () => {
    if (!canPlay) return;
    echoRef.current = false;
    setEcho(false);
    sfx('tap');
    void player.playRange(spans[0].start, spans[spans.length - 1].end);
  };
  const playOne = (i: number) => {
    if (!canPlay) return;
    void player.playRange(spans[i].start, spans[i].end);
  };
  const runEcho = async () => {
    if (!canPlay) return;
    echoRef.current = true;
    setEcho(true);
    const ctx = audioContext();
    for (let i = 0; i < spans.length && echoRef.current; i++) {
      setCurrent(i);
      const ok = await player.playRange(spans[i].start, spans[i].end);
      if (!ok || !echoRef.current) break;
      await new Promise((r) => setTimeout(r, 250));
      await beep(ctx);
      await new Promise((r) => setTimeout(r, Math.max(1200, ((spans[i].end - spans[i].start) / player.speed) * 1100)));
    }
    echoRef.current = false;
    setEcho(false);
    setCurrent(null);
  };
  const toggleEcho = () => {
    if (echo) {
      echoRef.current = false;
      setEcho(false);
      player.pause();
    } else void runEcho();
  };
  const toggleRec = async () => {
    if (rec) {
      const blob = await rec.stop();
      setRec(null);
      setMine(blob);
      await putClip(clipKey, blob);
      rewardRecording();
      onRecorded?.();
    } else {
      player.pause();
      try {
        setRec(await startRecording());
        sfx('toggle');
      } catch (e) {
        alert(`تعذر الوصول إلى الميكروفون: ${String(e)}`);
      }
    }
  };
  const playMine = () => {
    if (!mine) return;
    player.pause();
    if (!mineAudio.current) mineAudio.current = new Audio();
    mineAudio.current.src = URL.createObjectURL(mine);
    void mineAudio.current.play();
  };

  return (
    <div className="drill">
      <div className={`drill-text${hidden ? ' hidden-text' : ''}`} dir="rtl">
        <div className="ayah">
          {verses.map((b, i) => {
            const v = s.verses.find((x) => x.basri === b)!;
            return (
              <button key={b} className={`verse-run${current === i ? ' on' : ''}`} onClick={() => playOne(i)} disabled={!canPlay} title={canPlay ? 'اسمع هذه الآية' : undefined}>
                {v.words.join(' ')} <span className="num">﴿{arNum(b)}﴾</span>
              </button>
            );
          })}
        </div>
        {hidden && (
          <button className="reveal" onClick={() => setHidden(false)}>
            <Icon name="eye" size={18} /> أظهر النص
          </button>
        )}
      </div>
      <div className="drill-actions">
        <button className="primary" onClick={playAll} disabled={!canPlay || !player.ready}>
          <Icon name={player.playing && !echo ? 'pause' : 'play'} size={18} /> اسمع
        </button>
        <button className="toggle" aria-pressed={echo} onClick={toggleEcho} disabled={!canPlay || !player.ready} title="اسمع الآية، ثم صفارة، ثم ردّدها">
          <Icon name="repeat" size={18} /> ردّد
        </button>
        <button className="toggle" aria-pressed={hidden} onClick={() => setHidden((h) => !h)}>
          <Icon name="eye" size={18} /> {hidden ? 'النص مخفي' : 'أخفِ النص'}
        </button>
        <button className={`toggle${rec ? ' rec' : ''}`} onClick={toggleRec}>
          <Icon name={rec ? 'stop' : 'record'} size={14} /> {rec ? 'أوقف' : mine ? 'سجّل من جديد' : 'سجّل من حفظك'}
        </button>
        <div className="speeds">
          {([0.5, 0.75, 1] as const).map((v) => (
            <button key={v} aria-pressed={player.speed === v} onClick={() => player.setSpeed(v)} disabled={!canPlay}>
              {v === 1 ? '١×' : v === 0.75 ? '٠٫٧٥×' : '٠٫٥×'}
            </button>
          ))}
        </div>
      </div>
      {!canPlay && <p className="ref"><Icon name="alert" size={16} /> لم تُحدَّد مواضع آيات هذه السورة في التسجيل بعد، فالسماع غير متاح لها؛ اقرأ وسجّل، وسيُضاف الصوت حين تُحاذى.</p>}
      {align?.auto && canPlay && <p className="ref">حدود الآيات هنا تقديرية (يُراجع)؛ قد تسبق البداية أو تتأخر قليلاً.</p>}
      {mine && (
        <div className="compare-panel">
          {canPlay && (
            <span className="ab">
              <button className="ab-btn teacher" onClick={playAll}>القارئ</button>
              <canvas ref={teacherCanvas} width={240} height={40} />
            </span>
          )}
          <span className="ab">
            <button className="ab-btn me" onClick={playMine}>أنا</button>
            <canvas ref={mineCanvas} width={240} height={40} />
          </span>
        </div>
      )}
    </div>
  );
}
