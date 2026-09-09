import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clearLocalAlignment, emptyAlignment, fromExport, loadAlignment, proportionalWords, saveAlignment, toExport, type SurahAlign } from '../audio/alignment';
import { decode, drawWave, envelope, normalise, segmentsFromSilences, silences } from '../audio/peaks';
import { DEFAULT_RECITER, RECITERS, SURAHS, SURAH_BY_NUMBER, audioUrl } from '../audio/quran';
import { usePlayer } from '../audio/usePlayer';
import { downloadBlob } from '../audio/zip';
import { arNum } from './shared';
import { Icon } from '../ui/icons';

const PER_SEC = 50;
const fmt = (t: number) => t.toFixed(2);

/** A boundary the editor asks for, in order: header start/end, then each verse's word starts and the verse end. */
interface Mark {
  label: string;
  apply: (a: SurahAlign, t: number) => void;
  get: (a: SurahAlign) => number;
}

function buildMarks(s: { header: string | null; verses: { basri: number; words: string[] }[] }): Mark[] {
  const marks: Mark[] = [];
  if (s.header) {
    marks.push({ label: 'بداية البسملة', get: (a) => a.header?.[0] ?? 0, apply: (a, t) => { a.header = [t, a.header?.[1] ?? t]; } });
    marks.push({ label: 'نهاية البسملة', get: (a) => a.header?.[1] ?? 0, apply: (a, t) => { a.header = [a.header?.[0] ?? t, t]; } });
  }
  s.verses.forEach((v, vi) => {
    v.words.forEach((w, wi) => {
      marks.push({
        label: `${arNum(v.basri)}: بداية «${w}»`,
        get: (a) => a.verses[vi].words[wi][0],
        apply: (a, t) => {
          const ver = a.verses[vi];
          ver.words[wi][0] = t;
          if (wi > 0) ver.words[wi - 1][1] = t;
          if (wi === 0) ver.start = t;
        },
      });
    });
    marks.push({
      label: `${arNum(v.basri)}: نهاية الآية`,
      get: (a) => a.verses[vi].end,
      apply: (a, t) => {
        const ver = a.verses[vi];
        ver.end = t;
        if (ver.words.length) ver.words[ver.words.length - 1][1] = t;
      },
    });
  });
  return marks;
}

/** The alignment editor (PROMPT.md §6): waveform, tap to set verse and word boundaries, export JSON. */
export function AlignPage({ surah, go }: { surah: number; go: (hash: string) => void }) {
  const [reciter, setReciter] = useState(DEFAULT_RECITER);
  const s = SURAH_BY_NUMBER[surah] ?? SURAHS[0];
  const player = usePlayer(audioUrl(reciter, s.number));
  const [env, setEnv] = useState<Float32Array | null>(null);
  const [align, setAlign] = useState<SurahAlign>(() => loadAlignment(reciter, s.number) ?? emptyAlignment(reciter, s.number, s.verses.map((v) => v.basri), s.verses.map((v) => v.words.length)));
  const [cursor, setCursor] = useState(0);
  const [msg, setMsg] = useState<string>('');
  const [dirty, setDirty] = useState(false);
  const fullCanvas = useRef<HTMLCanvasElement | null>(null);
  const zoomCanvas = useRef<HTMLCanvasElement | null>(null);
  const marks = useMemo(() => buildMarks(s), [s]);
  const ZOOM = 6; // seconds visible in the zoom strip

  useEffect(() => {
    setAlign(loadAlignment(reciter, s.number) ?? emptyAlignment(reciter, s.number, s.verses.map((v) => v.basri), s.verses.map((v) => v.words.length)));
    setCursor(0);
    setDirty(false);
  }, [reciter, s]);

  useEffect(() => {
    setEnv(null);
    let dead = false;
    fetch(audioUrl(reciter, s.number))
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then(decode)
      .then((b) => !dead && setEnv(normalise(envelope(b, PER_SEC))))
      .catch(() => !dead && setMsg('تعذر تحميل الصوت لرسم الموجة. شغّل scripts/fetch_audio.py أولاً.'));
    return () => {
      dead = true;
    };
  }, [reciter, s.number]);

  // full waveform + playhead + marks
  useEffect(() => {
    const c = fullCanvas.current;
    if (!c || !env) return;
    drawWave(c, env, { color: '#b8cfc3' });
    const g = c.getContext('2d')!;
    const px = (t: number) => (t / (env.length / PER_SEC)) * c.width;
    g.fillStyle = 'rgba(31,122,77,.9)';
    for (const v of align.verses) if (v.end > v.start) g.fillRect(px(v.start), 0, 2, c.height);
    g.fillStyle = '#c81e1e';
    g.fillRect(px(player.time), 0, 2, c.height);
  }, [env, align, player.time]);

  useEffect(() => {
    const c = zoomCanvas.current;
    if (!c || !env) return;
    const from = Math.max(0, player.time - ZOOM / 2);
    const to = from + ZOOM;
    drawWave(c, env, { from: Math.floor(from * PER_SEC), to: Math.ceil(to * PER_SEC), color: '#8ab7a0' });
    const g = c.getContext('2d')!;
    const px = (t: number) => ((t - from) / ZOOM) * c.width;
    for (const v of align.verses) {
      g.fillStyle = 'rgba(31,122,77,.9)';
      if (v.start >= from && v.start <= to) g.fillRect(px(v.start), 0, 3, c.height);
      g.fillStyle = 'rgba(29,99,181,.7)';
      for (const [a] of v.words) if (a > 0 && a >= from && a <= to) g.fillRect(px(a), c.height * 0.25, 2, c.height * 0.5);
    }
    g.fillStyle = '#c81e1e';
    g.fillRect(px(player.time), 0, 2, c.height);
  }, [env, align, player.time]);

  const update = useCallback((fn: (a: SurahAlign) => void, auto = false) => {
    setAlign((prev) => {
      const next: SurahAlign = JSON.parse(JSON.stringify(prev));
      next.auto = auto;
      fn(next);
      return next;
    });
    setDirty(true);
  }, []);

  const markHere = useCallback(() => {
    if (cursor >= marks.length) return;
    const t = Number(player.time.toFixed(3));
    update((a) => marks[cursor].apply(a, t));
    setCursor((c) => Math.min(marks.length, c + 1));
  }, [cursor, marks, player.time, update]);

  const save = useCallback(() => {
    saveAlignment(align);
    setDirty(false);
    setMsg('حُفظت المحاذاة في هذا المتصفح.');
  }, [align]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'SELECT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        player.toggle();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        markHere();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      } else if (e.key === 'ArrowLeft') {
        player.seek(player.time - (e.shiftKey ? 1 : 0.1));
      } else if (e.key === 'ArrowRight') {
        player.seek(player.time + (e.shiftKey ? 1 : 0.1));
      } else if (e.key === '[') {
        setCursor((c) => Math.max(0, c - 1));
      } else if (e.key === ']') {
        setCursor((c) => Math.min(marks.length, c + 1));
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [player, markHere, save, marks.length]);

  const detectVerses = () => {
    if (!env) return;
    const duration = env.length / PER_SEC;
    const gaps = silences(env, PER_SEC);
    const segs = segmentsFromSilences(gaps, duration);
    const expected = s.verses.length + (s.header ? 1 : 0);
    // One extra segment at the start is the istiʿādhah (mp3quran recordings of al-Fātiḥah open with it).
    const preamble = segs.length === expected + 1;
    update((a) => {
      let i = 0;
      a.preamble = preamble ? segs[i++] : undefined;
      if (s.header && segs.length) a.header = segs[i++];
      a.verses.forEach((v, vi) => {
        const seg = segs[i++];
        if (!seg) return;
        v.start = seg[0];
        v.end = seg[1];
        v.words = proportionalWords(s.verses[vi].words, seg[0], seg[1]);
      });
    }, true);
    setMsg(
      `اكتُشفت ${arNum(segs.length)} مقاطع صوتية، والمتوقع ${arNum(expected)}` +
        (segs.length === expected ? ' — تطابق تام، راجع الحدود واحفظ.' : preamble ? ' — عُدّ المقطع الأول استعاذة، راجع الحدود واحفظ.' : ' — راجع الحدود يدوياً.'),
    );
  };

  const distribute = () => {
    update((a) => {
      a.verses.forEach((v, vi) => {
        if (v.end > v.start) v.words = proportionalWords(s.verses[vi].words, v.start, v.end);
      });
    }, true);
    setMsg('وُزّعت الكلمات داخل كل آية بالتقدير؛ اضبطها بالسماع.');
  };

  /** The owner has checked every boundary by ear: drop the "تقديرية / يُراجع" flag without moving anything. */
  const markReviewed = () => {
    update(() => undefined, false);
    setMsg('عُلّمت المحاذاة كمراجَعة بالسماع؛ احفظ ثم صدّر.');
  };

  const exportJson = () => {
    downloadBlob(new Blob([JSON.stringify(toExport(align), null, 1)], { type: 'application/json' }), `${reciter}_${String(s.number).padStart(3, '0')}.json`);
  };
  const importJson = (file: File) => {
    void file.text().then((txt) => {
      try {
        const a = fromExport(JSON.parse(txt));
        if (a.surah !== s.number) throw new Error('الملف لسورة أخرى');
        setAlign({ ...a, reciter });
        setDirty(true);
        setMsg('استُورد الملف.');
      } catch (e) {
        setMsg(`تعذر الاستيراد: ${String(e)}`);
      }
    });
  };

  const seekFromCanvas = (e: React.MouseEvent<HTMLCanvasElement>, zoom: boolean) => {
    if (!env) return;
    const c = e.currentTarget;
    const x = (e.clientX - c.getBoundingClientRect().left) / c.clientWidth;
    const duration = env.length / PER_SEC;
    if (zoom) {
      const from = Math.max(0, player.time - ZOOM / 2);
      player.seek(from + x * ZOOM);
    } else player.seek(x * duration);
  };

  const current = marks[cursor];
  return (
    <div className="page align">
      <div className="card">
        <div className="row wrap">
          <label>
            السورة{' '}
            <select value={s.number} onChange={(e) => go(`#/align/${e.target.value}`)}>
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
                  {r.nameAr}
                </option>
              ))}
            </select>
          </label>
          <span className="ref">
            {align.auto ? 'محاذاة تقديرية' : 'محاذاة يدوية'}
            {dirty ? ' — تغييرات غير محفوظة' : ''}
          </span>
        </div>
        <p className="ref">
          اختصارات: مسافة = تشغيل/إيقاف · Enter = علّم الحد الحالي عند مؤشر التشغيل · ← → = تحريك ٠٫١ ث (مع Shift: ثانية) · Backspace = ارجع خطوة · [ ] = الحد السابق/التالي · S = حفظ
        </p>
        {player.error && <p className="todo"><Icon name="alert" size={18} /> {player.error}</p>}
        {msg && <p className="ref">{msg}</p>}
      </div>

      <div className="card">
        <canvas ref={fullCanvas} width={1200} height={90} className="wave" onClick={(e) => seekFromCanvas(e, false)} />
        <canvas ref={zoomCanvas} width={1200} height={140} className="wave" onClick={(e) => seekFromCanvas(e, true)} />
        <div className="controls">
          <button className="play" onClick={player.toggle} disabled={!player.ready} aria-label={player.playing ? 'إيقاف مؤقت' : 'تشغيل'}>
            <Icon name={player.playing ? 'pause' : 'play'} size={24} />
          </button>
          <span className="mono">{fmt(player.time)} / {fmt(player.duration)} ث</span>
          <div className="speeds">
            {([0.5, 0.75, 1] as const).map((v) => (
              <button key={v} aria-pressed={player.speed === v} onClick={() => player.setSpeed(v)}>
                {v}×
              </button>
            ))}
          </div>
          <button className="primary" onClick={markHere} disabled={!current}>
            علّم هنا: {current ? current.label : 'اكتملت الحدود'}
          </button>
        </div>
        <div className="row wrap" style={{ marginBlockStart: 8 }}>
          <button className="toggle" onClick={detectVerses} disabled={!env}>اكتشاف الوقفات → حدود الآيات</button>
          <button className="toggle" onClick={distribute}>توزيع الكلمات تقديرياً</button>
          <button className="toggle" onClick={markReviewed} disabled={!align.auto}>✓ راجعتُ الحدود بالسماع</button>
          <button className="toggle" onClick={save}>حفظ (S)</button>
          <button className="toggle" onClick={exportJson}>تصدير JSON</button>
          <label className="toggle">
            استيراد JSON <input type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
          </label>
          <button className="toggle" onClick={() => { clearLocalAlignment(reciter, s.number); setAlign(loadAlignment(reciter, s.number) ?? emptyAlignment(reciter, s.number, s.verses.map((v) => v.basri), s.verses.map((v) => v.words.length))); setMsg('أُعيدت المحاذاة المحلية.'); }}>
            مسح التعديلات المحلية
          </button>
          <a className="toggle" href={`#/follow/${s.number}`} onClick={(e) => { e.preventDefault(); go(`#/follow/${s.number}`); }}>
            افتح في وضع المتابعة
          </a>
        </div>
      </div>

      <div className="card marks">
        {align.preamble && (
          <div className="mark-row">
            <span className="small">الاستعاذة (قبل البسملة، لا تُضاء)</span>
            <span className="mono">{`${fmt(align.preamble[0])} – ${fmt(align.preamble[1])}`}</span>
            <button className="mini" onClick={() => align.preamble && player.playRange(align.preamble[0], align.preamble[1])} aria-label="اسمع الاستعاذة"><Icon name="play" size={14} /></button>
          </div>
        )}
        {s.header && (
          <div className="mark-row">
            <span className="ayah small">{s.header}</span>
            <span className="mono">{align.header ? `${fmt(align.header[0])} – ${fmt(align.header[1])}` : '—'}</span>
          </div>
        )}
        {s.verses.map((v, vi) => {
          const va = align.verses[vi];
          const base = (s.header ? 2 : 0) + s.verses.slice(0, vi).reduce((n, x) => n + x.words.length + 1, 0);
          return (
            <div key={v.basri} className="mark-verse">
              <div className="mark-row head">
                <span>الآية {arNum(v.basri)}</span>
                <span className="mono">{va.end > va.start ? `${fmt(va.start)} – ${fmt(va.end)}` : '—'}</span>
                <button className="mini" onClick={() => va.end > va.start && player.playRange(va.start, va.end)} disabled={!(va.end > va.start)}><Icon name="play" size={14} /> الآية</button>
              </div>
              <div className="mark-words" dir="rtl">
                {v.words.map((w, wi) => {
                  const idx = base + wi;
                  const [a, b] = va.words[wi];
                  return (
                    <button key={wi} className={`wordmark${cursor === idx ? ' target' : ''}${b > a ? ' set' : ''}`} onClick={() => { setCursor(idx); if (b > a) void player.playRange(a, b); }} title={b > a ? `${fmt(a)} – ${fmt(b)}` : 'غير محدد'}>
                      <span className="ayah small">{w}</span>
                      <span className="mono tiny">{b > a ? fmt(a) : '·'}</span>
                    </button>
                  );
                })}
                <button className={`wordmark${cursor === base + v.words.length ? ' target' : ''}`} onClick={() => setCursor(base + v.words.length)}>
                  <span className="small">نهاية</span>
                  <span className="mono tiny">{va.end > 0 ? fmt(va.end) : '·'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
