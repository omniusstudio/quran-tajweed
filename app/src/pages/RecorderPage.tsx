import { Icon } from '../ui/icons';
import { useEffect, useRef, useState } from 'react';
import { deleteClip, extensionFor, getClip, listKeys, putClip, startRecording } from '../audio/store';
import { downloadBlob, makeZip } from '../audio/zip';
import { CLIP_GROUPS, CLIP_MANIFEST, type ClipSpec } from '../content/clipManifest';
import { arNum } from './shared';

const PREFIX = 'teacher/';

/** Walks the teacher through the clip manifest and stores each take under its fixed file name (PROMPT.md §6). */
export function RecorderPage() {
  const [group, setGroup] = useState(CLIP_GROUPS[0]);
  const clips = CLIP_MANIFEST.filter((c) => c.group === group);
  const [idx, setIdx] = useState(0);
  const [have, setHave] = useState<Set<string>>(new Set());
  const [rec, setRec] = useState<{ stop: () => Promise<Blob> } | null>(null);
  const [busy, setBusy] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const clip: ClipSpec | undefined = clips[idx];

  const refresh = async () => setHave(new Set((await listKeys(PREFIX)).map((k) => k.slice(PREFIX.length))));
  useEffect(() => {
    void refresh();
  }, []);
  useEffect(() => setIdx(0), [group]);

  const toggle = async () => {
    if (!clip) return;
    if (rec) {
      const blob = await rec.stop();
      setRec(null);
      await putClip(PREFIX + clip.id, blob);
      await refresh();
      if (idx < clips.length - 1) setIdx(idx + 1);
    } else {
      try {
        setRec(await startRecording());
      } catch (e) {
        alert(`تعذر الوصول إلى الميكروفون: ${String(e)}`);
      }
    }
  };

  const play = async () => {
    if (!clip) return;
    const c = await getClip(PREFIX + clip.id);
    if (!c) return;
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.src = URL.createObjectURL(c.blob);
    void audioRef.current.play();
  };

  const remove = async () => {
    if (!clip) return;
    await deleteClip(PREFIX + clip.id);
    await refresh();
  };

  const exportAll = async () => {
    setBusy(true);
    try {
      const keys = await listKeys(PREFIX);
      const entries = [];
      const manifest: Record<string, { file: string; prompt: string; group: string }> = {};
      for (const k of keys) {
        const c = await getClip(k);
        if (!c) continue;
        const id = k.slice(PREFIX.length);
        const spec = CLIP_MANIFEST.find((m) => m.id === id);
        const file = `${id}.${extensionFor(c.mime)}`;
        entries.push({ name: file, data: new Uint8Array(await c.blob.arrayBuffer()) });
        manifest[id] = { file, prompt: spec?.prompt ?? '', group: spec?.group ?? '' };
      }
      entries.push({ name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify(manifest, null, 1)) });
      downloadBlob(makeZip(entries), 'nutq_teacher_clips.zip');
    } finally {
      setBusy(false);
    }
  };

  const total = CLIP_MANIFEST.length;
  return (
    <div className="page recorder">
      <div className="card">
        <h2>تسجيل صوت المعلم</h2>
        <p className="ref">
          سجّل كل مقطع في مكان هادئ، على مسافة شبر من الميكروفون. المقاطع تُحفظ في هذا المتصفح، ثم صدّرها كملف مضغوط بأسماء الملفات الصحيحة. لا تُستخدم أصوات مولّدة آلياً للقرآن.
        </p>
        <div className="row wrap">
          <label>
            المجموعة{' '}
            <select value={group} onChange={(e) => setGroup(e.target.value)}>
              {CLIP_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g} ({arNum(CLIP_MANIFEST.filter((c) => c.group === g).filter((c) => have.has(c.id)).length)}/{arNum(CLIP_MANIFEST.filter((c) => c.group === g).length)})
                </option>
              ))}
            </select>
          </label>
          <span className="badge">المسجّل: {arNum(have.size)} من {arNum(total)}</span>
          <button className="toggle" onClick={exportAll} disabled={busy || have.size === 0}>
            {busy ? 'جارٍ التجهيز…' : 'تنزيل الكل (zip)'}
          </button>
        </div>
      </div>

      {clip && (
        <div className="card rec-card">
          <div className="ref">
            {arNum(idx + 1)} / {arNum(clips.length)} — {clip.note ?? ''}
          </div>
          <div className="ayah huge" dir="rtl">{clip.prompt}</div>
          <div className="row wrap">
            <button className={`primary${rec ? ' rec' : ''}`} onClick={toggle}>
              <Icon name={rec ? 'stop' : 'record'} size={14} /> {rec ? 'أوقف وحفظ' : have.has(clip.id) ? 'أعد التسجيل' : 'سجّل'}
            </button>
            <button className="toggle" onClick={play} disabled={!have.has(clip.id)}><Icon name="play" size={18} /> استمع</button>
            <button className="toggle" onClick={remove} disabled={!have.has(clip.id)}>حذف</button>
            <button className="toggle" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}><Icon name="chevronRight" size={18} /> السابق</button>
            <button className="toggle" onClick={() => setIdx((i) => Math.min(clips.length - 1, i + 1))} disabled={idx >= clips.length - 1}>التالي <Icon name="chevronLeft" size={18} /></button>
          </div>
          <div className="ref mono">{clip.id}</div>
        </div>
      )}

      <div className="card">
        <div className="chips">
          {clips.map((c, i) => (
            <button key={c.id} className={`chip small${have.has(c.id) ? ' done' : ''}`} aria-pressed={i === idx} onClick={() => setIdx(i)} title={c.note}>
              {have.has(c.id) ? <Icon name="check" size={14} /> : null}{have.has(c.id) ? ' ' : ''}
              {c.prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
