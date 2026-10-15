import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { WORD_SOURCES, loadAlignment, locate, playSpan, type SurahAlign, startTime } from '../audio/alignment';
import { DEFAULT_RECITER, RECITERS, SURAHS, SURAH_BY_NUMBER, audioUrl } from '../audio/quran';
import { usePlayer } from '../audio/usePlayer';
import { PAGE_COUNT, firstVerseOnPage, juzOfPage, pageLines, pageOf, pageSegments } from '../content/pages';
import { planKashida, withKashida } from '../content/kashida';
import { TONES, TONE_LABEL, colourVerse, type Piece } from '../rules/colors';
import { Ribbon } from '../ui/Ribbon';
import { inPortionAhead, markRead, wirdState } from '../content/wird';
import { Icon } from '../ui/icons';
import { SurahBand } from '../ui/SurahBand';
import { rewardWird } from '../ui/rewards';
import { getSettings, useSettings } from '../ui/settings';
import { sfx } from '../ui/sound';
import { arNum } from './shared';
import { RING, memoState, memorizedSet, vkey } from '../content/memo';
import { inPlan, isVeiled, takeIntent, veilFraction } from '../content/memoRun';
import { useProgress } from '../content/progress';
import { NEXT_TEXT, TEXT_LABEL, useReadView } from '../ui/readView';
import { reducedMotion } from '../ui/settings';
import { MemoDone, MemoHud, MemoSheet } from './MemoUi';
import { useMemoRun } from './useMemoRun';

const JUZ_NAMES = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر', 'الثالث عشر', 'الرابع عشر', 'الخامس عشر', 'السادس عشر', 'السابع عشر', 'الثامن عشر', 'التاسع عشر', 'العشرون', 'الحادي والعشرون', 'الثاني والعشرون', 'الثالث والعشرون', 'الرابع والعشرون', 'الخامس والعشرون', 'السادس والعشرون', 'السابع والعشرون', 'الثامن والعشرون', 'التاسع والعشرون', 'الثلاثون'];

/**
 * The muṣḥaf, page by page: continuous justified text with the verse markers inline, sūrah
 * headers and the basmalah where a sūrah begins, and an optional recitation that lights the words
 * as it goes and turns the page by itself. `#/read/<sūrah>/<verse>` opens the page holding that verse.
 */
const getSettingsBookmark = () => getSettings().bookmark;

export function ReadPage({ surah, verse, go }: { surah?: number; verse?: number; go: (hash: string) => void }) {
  const [settings, updateSettings] = useSettings();
  const reciter = RECITERS.some((r) => r.id === settings.reciter) ? settings.reciter : DEFAULT_RECITER;
  const initial = surah ? pageOf(surah, verse ?? SURAH_BY_NUMBER[surah].verses[0].basri) : settings.lastPage ?? 1;
  const [page, setPage] = useState(initial);
  const [view, setView] = useReadView();
  const focus = view.focus;
  const flow = view.text !== 'page';
  const segs = useMemo(() => pageSegments(page), [page]);
  const juz = juzOfPage(page);

  // the recitation: one sūrah at a time, moving on to the next when it ends
  const [playSurah, setPlaySurah] = useState<number>(segs[0]?.surah.number ?? 1);
  const align: SurahAlign | undefined = useMemo(() => loadAlignment(reciter, playSurah), [reciter, playSurah]);
  const player = usePlayer(align ? audioUrl(reciter, playSurah) : null);
  const pos = align && player.playing ? locate(align, player.time) : align ? locate(align, player.time) : null;
  const wordsTrusted = !!align && (!align.source || WORD_SOURCES.has(align.source));
  const pendingStart = useRef<number | null>(null);
  const memo = useMemoRun({ player, align, playSurah, setPlaySurah, pendingStart, reciter });
  const memoLive = !!memo.run && !memo.run.completed;

  useEffect(() => { updateSettings({ lastPage: page }); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { scrollTo({ top: 0 }); }, [page]);

  // the playing verse: follow it onto the next page, count it toward the wird, hand over to the next sūrah
  const lastVerse = useRef<number | null>(null);
  useEffect(() => {
    if (!align || !pos) return;
    if (pos.verse !== lastVerse.current) {
      const prev = lastVerse.current;
      if (prev !== null && pos.verse > prev && player.playing) {
        const ref = { surah: playSurah, basri: align.verses[prev].basri };
        if (inPortionAhead(wirdState(), ref)) rewardWird(markRead(ref));
      }
      lastVerse.current = pos.verse;
      const p = pageOf(playSurah, align.verses[pos.verse].basri);
      if (player.playing && p !== page) setPage(p);
    }
  }, [pos?.verse, player.playing]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!align || !player.playing || memoLive) return;
    const last = align.verses[align.verses.length - 1];
    if (player.time < playSpan(last)[1]) return;
    const next = playSurah + 1;
    if (next > 114 || !loadAlignment(reciter, next)) return player.pause();
    pendingStart.current = 0;
    setPlaySurah(next);
  }, [player.time]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (pendingStart.current === null || !align || !player.ready) return;
    const at = pendingStart.current;
    pendingStart.current = null;
    player.seek(at === 0 ? (align.header?.[0] ?? playSpan(align.verses[0])[0]) : at);
    void player.play();
  }, [align, player.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const startAt = (s: number, basri: number) => {
    const a = loadAlignment(reciter, s);
    const v = a?.verses.find((x) => x.basri === basri);
    if (!a || !v) return;
    sfx('tap');
    const at = startTime(a, v);   // a sūrah starts with its basmalah when the reciter reads one
    if (s !== playSurah) { pendingStart.current = at; setPlaySurah(s); return; }
    lastVerse.current = a.verses.indexOf(v);
    player.seek(at);
    void player.play();
  };
  const memoActive = memo.phase === 'gap' || (memo.phase === 'listening' && player.playing);
  const memoToggle = () => (memoActive ? memo.pause() : memo.resume());
  const mainToggle = () => {
    if (memoLive) return memoToggle();
    if (player.playing) return player.pause();
    if (!align || segs.every((g) => g.surah.number !== playSurah)) {
      const first = firstVerseOnPage(page);
      return startAt(first.surah, first.basri);
    }
    if (player.time <= 0.01) { const first = firstVerseOnPage(page); if (first.surah === playSurah) return startAt(first.surah, first.basri); }
    void player.play();
  };

  // turning pages: buttons, keys, a swipe; turning forward counts the page toward the wird
  const turn = useCallback((by: 1 | -1) => {
    setPage((p) => {
      const n = Math.min(PAGE_COUNT, Math.max(1, p + by));
      if (n === p) return p;
      sfx('tap');
      if (by === 1 && !player.playing) for (const g of pageSegments(p)) for (let i = g.from; i <= g.to; i++) { const ref = { surah: g.surah.number, basri: g.surah.verses[i].basri }; if (inPortionAhead(wirdState(), ref)) rewardWird(markRead(ref)); }
      return n;
    });
  }, [player.playing]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'SELECT') return;
      if (e.key === 'ArrowLeft') turn(1);
      else if (e.key === 'ArrowRight') turn(-1);
      else if (e.key === ' ') { e.preventDefault(); mainToggle(); }
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [turn, mainToggle]); // eslint-disable-line react-hooks/exhaustive-deps
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onDown = (e: React.PointerEvent) => { if (e.pointerType !== 'mouse') swipe.current = { x: e.clientX, y: e.clientY }; };
  const onUp = (e: React.PointerEvent) => {
    const s = swipe.current; swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 60) turn(dx < 0 ? 1 : -1);
  };

  const bm = settings.bookmark;
  const bookmarkHere = () => {
    sfx('toggle');
    if (bm?.pinned && pageOf(bm.surah, bm.basri) === page) return updateSettings({ bookmark: { ...bm, pinned: false } });
    const v = pos && align && player.playing ? { surah: playSurah, basri: align.verses[pos.verse].basri } : bm && pageOf(bm.surah, bm.basri) === page ? { surah: bm.surah, basri: bm.basri } : firstVerseOnPage(page);
    updateSettings({ bookmark: { ...v, pinned: true, at: Date.now() } });
  };
  const current = pos && align ? { surah: playSurah, basri: align.verses[pos.verse].basri, word: pos.word } : null;
  const headerSurah = segs[segs.length - 1]?.surah;
  const kufi = (settings.numbering ?? 'kufi') === 'kufi';
  const lines = useMemo(() => pageLines(page, kufi ? 'kufi' : 'basri'), [page, kufi]);
  // fit and kashida: the print fills each of the 15 lines by lengthening letters. Here the page's
  // font first shrinks just enough that no line overflows; then every line's slack is measured and
  // turned into kashida strokes inside a few words (content/kashida.ts), so words stay close.
  const body = useRef<HTMLDivElement | null>(null);
  const [kashida, setKashida] = useState<{ key: string; counts: number[][] }>({ key: '', counts: [] });
  const layoutKey = `${page}:${kufi}:${settings.quranScale}:${flow}`;
  useLayoutEffect(() => {
    const el = body.current;
    if (!el) return;
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      // 1. no kashida, measure, shrink until nothing overflows
      el.style.removeProperty('--fit');
      el.classList.add('measuring');
      let ratio = 1;
      const textLines = [...el.querySelectorAll<HTMLElement>('.mp-line.text')];
      for (const line of textLines) if (line.scrollWidth > line.clientWidth + 1) ratio = Math.min(ratio, line.clientWidth / line.scrollWidth);
      if (ratio < 1) el.style.setProperty('--fit', String(Math.max(0.6, ratio * 0.985)));
      // 2. the slack of every line → strokes per word
      const probe = document.createElement('span');
      probe.className = 'wrd probe';
      probe.textContent = 'ـــــــــــ';
      const counts: number[][] = [];
      for (const line of el.querySelectorAll<HTMLElement>('.mp-line')) {
        if (!line.classList.contains('text') || line.classList.contains('centred')) { counts.push([]); continue; }
        line.appendChild(probe);
        const stroke = probe.getBoundingClientRect().width / 11;
        line.removeChild(probe);
        const gap = parseFloat(getComputedStyle(line).fontSize) * 0.38;
        const words = [...line.querySelectorAll<HTMLElement>('.wrd')].map((w) => ({ text: w.dataset.word ?? '', width: w.getBoundingClientRect().width }));
        counts.push(planKashida(words, line.clientWidth, stroke, gap));
      }
      el.classList.remove('measuring');
      setKashida({ key: layoutKey, counts });
    };
    run();
    const ro = new ResizeObserver(run);
    ro.observe(el);
    (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready.then(run);
    return () => { cancelled = true; ro.disconnect(); };
  }, [layoutKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // 3. if a stroke overshot, let the font give a little more
  useLayoutEffect(() => {
    const el = body.current;
    if (!el || kashida.key !== layoutKey) return;
    let ratio = 1;
    for (const line of el.querySelectorAll<HTMLElement>('.mp-line.text')) if (line.scrollWidth > line.clientWidth + 1) ratio = Math.min(ratio, line.clientWidth / line.scrollWidth);
    if (ratio < 1) { const cur = parseFloat(el.style.getPropertyValue('--fit') || '1'); el.style.setProperty('--fit', String(Math.max(0.6, cur * ratio * 0.99))); }
  }, [kashida, layoutKey]);
  const strokes = kashida.key === layoutKey ? kashida.counts : [];
  // the recitation's place on the page: one continuous band per line of the current verse, and a marker
  // that slides from word to word (both are measured from the laid-out words, so kashida and justification
  // are included, and they sit under the ink rather than boxing each word)
  type Box = { left: number; top: number; width: number; height: number };
  const [hl, setHl] = useState<{ bands: Box[]; word: Box | null }>({ bands: [], word: null });
  const curKey = current ? `${current.surah}:${current.basri}:${current.word}` : '';
  useLayoutEffect(() => {
    const el = body.current;
    if (!el) return;
    const measure = () => {
      const b = el.getBoundingClientRect();
      const box = (r: { left: number; top: number; right: number; bottom: number }): Box => ({ left: r.left - b.left, top: r.top - b.top, width: r.right - r.left, height: r.bottom - r.top });
      const bands: Box[] = [];
      const rects = [...el.querySelectorAll<HTMLElement>('.wrd.in-aya')].map((w) => w.getBoundingClientRect()).sort((x, y) => x.top - y.top);
      let group: DOMRect[] = [];
      const flush = () => {
        if (!group.length) return;
        bands.push(box({ left: Math.min(...group.map((r) => r.left)), right: Math.max(...group.map((r) => r.right)), top: Math.min(...group.map((r) => r.top)), bottom: Math.max(...group.map((r) => r.bottom)) }));
        group = [];
      };
      for (const r of rects) {
        const ref = group[0];
        if (ref && r.top > ref.top + ref.height * 0.5) flush();
        group.push(r);
      }
      flush();
      const on = el.querySelector<HTMLElement>('.wrd.on');
      setHl({ bands, word: on ? box(on.getBoundingClientRect()) : null });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [curKey, kashida, page, flow, focus]);
  const colours = settings.tajweedColors !== false;
  // the shown text of every word on the page (with its kashida), then the coloured pieces per verse
  const shownWords = useMemo(() => {
    const m = new Map<string, string>();
    lines.forEach((slot, li) => { if (slot.kind === 'text') slot.words.forEach((w, i) => m.set(`${w.surah.number}:${w.vi}:${w.wi}`, withKashida(w.surah.verses[w.vi].words[w.wi], flow ? 0 : strokes[li]?.[i] ?? 0))); });
    return m;
  }, [lines, strokes, flow]);
  const pieces = useMemo(() => {
    const out = new Map<string, Piece[][]>();
    if (!colours) return out;
    for (const slot of lines) {
      if (slot.kind !== 'text') continue;
      for (const w of slot.words) {
        const key = `${w.surah.number}:${w.vi}`;
        if (out.has(key)) continue;
        const v = w.surah.verses[w.vi];
        const shown = v.words.map((t, wi) => shownWords.get(`${w.surah.number}:${w.vi}:${wi}`) ?? t);
        const pv = w.surah.verses[w.vi - 1];
        out.set(key, colourVerse(v.words, v.hafs, w.surah.verses[w.vi + 1]?.words[0] ?? null, shown, pv ? { words: pv.words, hafs: pv.hafs } : undefined));
      }
    }
    return out;
  }, [lines, shownWords, colours]);
  const renderWord = (sn: number, vi: number, wi: number) => {
    const text = shownWords.get(`${sn}:${vi}:${wi}`) ?? SURAH_BY_NUMBER[sn].verses[vi].words[wi];
    const ps = pieces.get(`${sn}:${vi}`)?.[wi];
    if (!ps || !ps.some((p) => p.tone)) return text;
    // one text node per word: the colours are painted over it (see paintTones), never by splitting the
    // word into spans, which Safari shapes separately and so disconnects the letters
    const labels = [...new Set(ps.flatMap((p) => (p.tone ? [TONE_LABEL[p.tone]] : [])))].join(' · ');
    return <span className="wt" data-k={`${sn}:${vi}:${wi}`} title={labels}>{text}</span>;
  };
  // paint the tajwīd tones: a horizontal gradient clipped to the word's own glyphs, its stops measured
  // from the shaped text with Ranges, so every browser shapes the word as one run and colours the same
  useLayoutEffect(() => {
    const el = body.current;
    if (!el) return;
    const paint = () => {
      for (const wt of el.querySelectorAll<HTMLElement>('.wt')) {
        const [sn, vi, wi] = (wt.dataset.k ?? '').split(':').map(Number);
        const ps = pieces.get(`${sn}:${vi}`)?.[wi];
        const node = wt.firstChild;
        if (!ps || !node || node.nodeType !== Node.TEXT_NODE) { wt.classList.remove('painted'); wt.style.removeProperty('background-image'); continue; }
        const base = wt.getBoundingClientRect();
        const len = node.textContent?.length ?? 0;
        const runs: { a: number; b: number; c: string }[] = [];
        let off = 0;
        for (const p of ps) {
          const end = Math.min(off + p.text.length, len);
          if (p.tone && end > off) {
            const r = document.createRange();
            r.setStart(node, off); r.setEnd(node, end);
            const rects = [...r.getClientRects()].filter((x) => x.width > 0);
            if (rects.length) runs.push({ a: Math.min(...rects.map((x) => x.left)) - base.left, b: Math.max(...rects.map((x) => x.right)) - base.left, c: `var(--tj-${p.tone})` });
          }
          off = end;
        }
        if (!runs.length) { wt.classList.remove('painted'); wt.style.removeProperty('background-image'); continue; }
        runs.sort((x, y) => x.a - y.a);
        let g = ''; let x = 0;
        for (const run of runs) {
          const a = Math.max(x, run.a); const b = Math.max(a, run.b);
          if (a > x) g += `, var(--ink-q) ${x.toFixed(2)}px ${a.toFixed(2)}px`;
          g += `, ${run.c} ${a.toFixed(2)}px ${b.toFixed(2)}px`;
          x = b;
        }
        g += `, var(--ink-q) ${x.toFixed(2)}px 100%`;
        wt.style.backgroundImage = `linear-gradient(to right${g})`;
        wt.classList.add('painted');
      }
    };
    paint();
    const ro = new ResizeObserver(paint);
    ro.observe(el);
    (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready.then(paint);
    return () => ro.disconnect();
  }, [pieces, shownWords, kashida, page]);
  const bmOnPage = !!bm && pageOf(bm.surah, bm.basri) === page;

  // ---- repeat to memorize: what is memorized, the veil, the sheet, long-press to start
  const [progress] = useProgress();
  const memorized = useMemo(() => memorizedSet(progress), [progress]);
  const ledger = useMemo(() => memoState(progress).verses, [progress]);
  const veilFrac = memo.run && memo.run.plan.veil && !memo.run.completed ? veilFraction(memo.run.done, memo.run.plan.target) : 0;
  const [peek, setPeek] = useState<Set<string>>(() => new Set());
  const peekWord = (k: string) => {
    setPeek((p) => new Set(p).add(k));
    setTimeout(() => setPeek((p) => { const n = new Set(p); n.delete(k); return n; }), 2500);
  };
  const [sheet, setSheet] = useState<{ anchor: { surah: number; basri: number }; preset?: NonNullable<ReturnType<typeof takeIntent>> } | null>(null);
  useEffect(() => {
    const i = takeIntent();
    if (i) setSheet({ anchor: { surah: i.surah, basri: i.from }, preset: i });
  }, []);
  const openMemo = (at?: { surah: number; basri: number }) => {
    sfx('tap');
    const anchor = at ?? (current && player.playing ? { surah: current.surah, basri: current.basri } : bm && bmOnPage ? { surah: bm.surah, basri: bm.basri } : firstVerseOnPage(page));
    setSheet({ anchor });
  };
  const press = useRef<{ timer: ReturnType<typeof setTimeout> | null; fired: boolean; x: number; y: number }>({ timer: null, fired: false, x: 0, y: 0 });
  const stopPress = () => { const pr = press.current; if (pr.timer) { clearTimeout(pr.timer); pr.timer = null; } };
  type Slot = (typeof lines)[number];
  type SlotWord = Extract<Slot, { kind: 'text' }>['words'][number];
  const wordSpan = (w: SlotWord) => {
    const v = w.surah.verses[w.vi];
    const isCur = current?.surah === w.surah.number && current.basri === v.basri;
    const canPlay = !!loadAlignment(reciter, w.surah.number)?.verses.find((x) => x.basri === v.basri);
    const marked = bm?.surah === w.surah.number && bm.basri === v.basri && w.mark !== undefined;
    const k = `${w.surah.number}:${v.basri}:${w.wi}`;
    const veiled = memoLive && !!memo.run && veilFrac > 0 && inPlan(memo.run.plan, w.surah.number, v.basri) && !peek.has(k) && isVeiled(w.surah.number, v.basri, w.wi, veilFrac);
    const mk = vkey(w.surah.number, v.basri);
    const reps = ledger[mk]?.reps ?? 0;
    const st = memorized.has(mk) ? ' m-done' : reps > 0 ? ' m-doing' : '';
    return (
      <span key={k} data-word={v.words[w.wi]} className={`wrd${isCur ? ' in-aya' : ''}${isCur && wordsTrusted && current!.word === w.wi ? ' on' : ''}${veiled ? ' veil' : ''}`}
        onClick={() => {
          if (press.current.fired) { press.current.fired = false; return; }
          if (memoLive) { if (veiled) peekWord(k); return; }
          if (canPlay) startAt(w.surah.number, v.basri);
        }}
        onPointerDown={(e) => {
          const pr = press.current;
          pr.fired = false; pr.x = e.clientX; pr.y = e.clientY;
          stopPress();
          pr.timer = setTimeout(() => { pr.timer = null; pr.fired = true; openMemo({ surah: w.surah.number, basri: v.basri }); }, 550);
        }}
        onPointerMove={(e) => { if (press.current.timer && Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) > 10) stopPress(); }}
        onPointerUp={stopPress} onPointerCancel={stopPress}
        onContextMenu={(e) => { e.preventDefault(); openMemo({ surah: w.surah.number, basri: v.basri }); }}
        role={canPlay || memoLive ? 'button' : undefined}
        title={memoLive ? (veiled ? 'اضغط لتنظر إلى الكلمة' : undefined) : canPlay ? `اسمع من الآية ${arNum(shownNumber(w.surah.number, v.basri, w.wi))} · اضغط مطوّلًا لتحفظها` : undefined}>
        {renderWord(w.surah.number, w.vi, w.wi)}
        {w.mark !== undefined && <span className={`aya-n${marked ? ' marked' : ''}${st}`} style={st === ' m-doing' ? ({ '--p': Math.min(1, reps / RING) } as React.CSSProperties) : undefined} aria-label={`الآية ${arNum(w.mark)}${st === ' m-done' ? '، محفوظة' : ''}`}>{arNum(w.mark)}</span>}
      </span>
    );
  };
  const flowBlocks = useMemo(() => {
    const out: { li: number; slot?: Slot; words?: SlotWord[] }[] = [];
    lines.forEach((slot, li) => {
      if (slot.kind === 'text') {
        const last = out[out.length - 1];
        if (last?.words) last.words.push(...slot.words);
        else out.push({ li, words: [...slot.words] });
      } else if (slot.kind !== 'empty') out.push({ li, slot });
    });
    return out;
  }, [lines]);

  // the focus view hides the app's chrome (see .read-focus in styles.css); Escape leaves it
  useEffect(() => {
    document.documentElement.classList.toggle('read-focus', focus);
    return () => document.documentElement.classList.remove('read-focus');
  }, [focus]);
  useEffect(() => {
    if (!focus) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setView({ focus: false }); };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [focus, setView]);
  // reflowed text is taller than the screen: keep the word being recited in view
  useEffect(() => {
    if (!flow || !player.playing || !curKey) return;
    const el = body.current?.querySelector<HTMLElement>('.wrd.on') ?? body.current?.querySelector<HTMLElement>('.wrd.in-aya');
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < 90 || r.bottom > innerHeight - 160) scrollBy({ top: r.top - innerHeight * 0.33, behavior: reducedMotion() ? 'auto' : 'smooth' });
  }, [curKey, flow]); // eslint-disable-line react-hooks/exhaustive-deps
  // an unpinned ribbon follows the reader: the page just opened, or the verse where listening stopped
  const remember = useCallback((v: { surah: number; basri: number }) => {
    const cur = getSettingsBookmark();
    if (cur?.pinned) return;
    if (cur && cur.surah === v.surah && cur.basri === v.basri) return;
    updateSettings({ bookmark: { ...v, pinned: false, at: Date.now() } });
  }, [updateSettings]);
  useEffect(() => { remember(firstVerseOnPage(page)); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (player.playing || !align || !pos) return;
    remember({ surah: playSurah, basri: align.verses[pos.verse].basri });
  }, [player.playing]); // eslint-disable-line react-hooks/exhaustive-deps
  /** The verse number to announce for a position, in the chosen count. */
  const shownNumber = (sn: number, basri: number, word: number) => {
    const v = SURAH_BY_NUMBER[sn].verses.find((x) => x.basri === basri)!;
    if (!kufi) return basri;
    return v.kufiEnds?.find((e) => e[0] > word)?.[1] ?? v.kufi ?? basri;
  };

  return (
    <div className="page read">
      <div className={`read-bar${focus ? ' focus' : ''}`}>
        {focus ? (
          <button className="icon-btn" onClick={() => { setView({ focus: false }); sfx('tap'); }} aria-label="اخرج من وضع التركيز" title="خروج (Esc)"><Icon name="x" /></button>
        ) : (
          <a href="#/" onClick={(e) => { e.preventDefault(); go('#/'); }} className="crumb"><Icon name="chevronRight" size={18} /> <span className="crumb-label">الرئيسية</span></a>
        )}
        <div className="read-goto">
          <select value={headerSurah?.number ?? 1} onChange={(e) => { const s = SURAH_BY_NUMBER[Number(e.target.value)]; setPage(pageOf(s.number, s.verses[0].basri)); sfx('tap'); }} aria-label="السورة">
            {SURAHS.map((s) => <option key={s.number} value={s.number}>{arNum(s.number)} · {s.name.replace(/^سُورَةُ\s*/, '')}</option>)}
          </select>
          <label className="read-pageno">
            <span>صفحة</span>
            <input type="number" min={1} max={PAGE_COUNT} value={page} onChange={(e) => { const n = Number(e.target.value); if (n >= 1 && n <= PAGE_COUNT) setPage(n); }} aria-label="رقم الصفحة" />
          </label>
        </div>
        <span className="row">
          {!focus && <button className={`icon-btn${bm?.pinned && bmOnPage ? ' on' : ''}`} onClick={bookmarkHere} aria-label="علامة هنا" title={bm?.pinned && bmOnPage ? 'فكّ العلامة' : 'ثبّت العلامة هنا'}><Icon name="bookmark" /></button>}
          {!focus && bm && !bmOnPage && <button className="icon-btn" onClick={() => { sfx('tap'); setPage(pageOf(bm.surah, bm.basri)); }} aria-label="اذهب إلى العلامة" title={`العلامة: صفحة ${arNum(pageOf(bm.surah, bm.basri))}`}><Icon name="arrowLeft" /></button>}
          {!focus && <button className={`icon-btn${colours ? ' on' : ''}`} onClick={() => { updateSettings({ tajweedColors: !colours }); sfx('toggle'); }} aria-pressed={colours} aria-label="ألوان التجويد" title={colours ? 'أطفئ ألوان التجويد' : 'لوّن الحروف بأحكام التجويد'}><Icon name="sparkles" /></button>}
          <button className={`icon-btn text-size${flow ? ' on' : ''}`} onClick={() => { setView({ text: NEXT_TEXT[view.text] }); sfx('tap'); }} aria-label={`حجم النص: ${TEXT_LABEL[view.text]}`} title={`حجم النص: ${TEXT_LABEL[view.text]}. اضغط للتبديل`}><Icon name="textSize" />{flow && <small>{TEXT_LABEL[view.text]}</small>}</button>
          <button className={`icon-btn${memo.run ? ' on' : ''}`} onClick={() => openMemo()} aria-label="احفظ بالتكرار" title="احفظ بالتكرار"><Icon name="repeat" /></button>
          {!focus && <button className="icon-btn only-wide" onClick={() => go(`#/follow/${current?.surah ?? firstVerseOnPage(page).surah}/${current?.basri ?? firstVerseOnPage(page).basri}`)} aria-label="افتح في المتابعة" title="المتابعة آيةً آية"><Icon name="headphones" /></button>}
          {!focus && <button className="icon-btn" onClick={() => { setView({ focus: true }); sfx('tap'); }} aria-label="وضع التركيز" title="وضع التركيز: النص فقط"><Icon name="expand" /></button>}
        </span>
      </div>

      <div className="mushaf-wrap">
        <button className="page-turn prev" onClick={() => turn(-1)} disabled={page <= 1} aria-label="الصفحة السابقة"><Icon name="chevronRight" /></button>
        <article className={`mushaf-page${player.playing ? ' playing' : ''}${page <= 2 && !flow ? ' framed' : ''}${flow ? ' flowing' : ''}`} dir="rtl" onPointerDown={onDown} onPointerUp={onUp} aria-label={`صفحة ${arNum(page)}`}>
          {bmOnPage && <Ribbon pinned={!!bm?.pinned} onClick={bookmarkHere} title={bm?.pinned ? 'علامة مثبّتة هنا — اضغط لفكّها' : 'هنا توقفت — اضغط لتثبيت العلامة'} />}
          <header className="mp-head">
            <span>{headerSurah?.name}</span>
            <span>الجزء {JUZ_NAMES[juz]}</span>
          </header>
          <div className={`mp-body${flow ? ' flow' : ''}`} data-text={view.text} ref={body} style={flow ? undefined : { gridTemplateRows: `repeat(${lines.length}, var(--line))` }}>
            {hl.bands.map((b, i) => <div key={i} className="aya-band" style={b} aria-hidden />)}
            {hl.word && <div className="word-marker" style={hl.word} aria-hidden />}
            {(flow ? flowBlocks : lines.map((slot, li) => (slot.kind === 'text' ? { li, words: slot.words, centred: slot.centred } : { li, slot }))).map((b) => {
              const li = b.li;
              if ('words' in b && b.words) {
                if (flow) return <p key={li} className="mp-flow-text" dir="rtl">{b.words.map((w) => <Fragment key={`${w.surah.number}:${w.vi}:${w.wi}`}>{wordSpan(w)}{' '}</Fragment>)}</p>;
                return <div key={li} className={`mp-line text${'centred' in b && b.centred ? ' centred' : ''}`}>{b.words.map((w) => wordSpan(w))}</div>;
              }
              const slot = b.slot!;
              if (slot.kind === 'band') return (
                <div key={li} className={`mp-line band-line${slot.compact ? ' compact' : ''}`}>
                  <SurahBand name={slot.surah.name} order={slot.surah.number} count={slot.surah.kufiCount ?? slot.surah.verses.length} revelation={slot.surah.revelation} />
                  {slot.compact && <span className="basmalah small">{slot.surah.header}</span>}
                </div>
              );
              if (slot.kind === 'basmalah') {
                const playable = !!loadAlignment(reciter, slot.surah.number);
                const first = slot.surah.verses[0];
                return <div key={li} className="mp-line basmalah-line"><span className={`basmalah${playable ? ' wrd' : ''}`} onClick={() => playable && !memoLive && startAt(slot.surah.number, first.basri)} role={playable ? 'button' : undefined} title={playable ? 'اسمع من البسملة' : undefined}>{slot.surah.header}{kufi && slot.surah.headerKufi ? <> <span className="aya-n">{arNum(slot.surah.headerKufi)}</span></> : null}</span></div>;
              }
              return <div key={li} className="mp-line" />;
            })}
          </div>
          <footer className="mp-foot">
            <span>الجزء {arNum(juz)}</span>
            <span className="mp-range">{(() => { const w = lines.flatMap((s) => (s.kind === 'text' ? s.words : [])); if (!w.length) return ''; const a = w[0], b = w[w.length - 1]; const n = (x: typeof a) => shownNumber(x.surah.number, x.surah.verses[x.vi].basri, x.wi); return `${b.surah.name.replace(/^سُورَةُ\s*/, '')} ${arNum(n(a))}–${arNum(n(b))}`; })()}</span>
            <span>{arNum(page)}</span>
          </footer>
          {colours && (
            <ul className="tj-legend" aria-label="دليل الألوان: اضغط اسم الحكم لتفتح درسه">
              {TONES.map((t) => (
                <li key={t.id}>
                  <i style={{ background: t.color }} />
                  {t.lessons.map((l, i) => (
                    <span key={l.id}>
                      {i > 0 && ' · '}
                      <a href={`#/lessons/${l.id}`} onClick={(e) => { e.preventDefault(); sfx('tap'); go(`#/lessons/${l.id}`); }}>{l.text}</a>
                    </span>
                  ))}
                  {t.tail && <> {t.tail}</>}
                  {t.review && <span className="badge review">يُراجع</span>}
                </li>
              ))}
            </ul>
          )}
        </article>
        <button className="page-turn next" onClick={() => turn(1)} disabled={page >= PAGE_COUNT} aria-label="الصفحة التالية"><Icon name="chevronLeft" /></button>
      </div>

      {flow && (
        <div className="flow-turn">
          <button className="toggle" onClick={() => turn(1)} disabled={page >= PAGE_COUNT}><Icon name="chevronRight" size={18} /> الصفحة التالية</button>
          <span>{arNum(page)}</span>
          <button className="toggle" onClick={() => turn(-1)} disabled={page <= 1}>الصفحة السابقة <Icon name="chevronLeft" size={18} /></button>
        </div>
      )}

      {memo.run && !memo.run.completed ? (
        <MemoHud run={memo.run} phase={memo.phase} playing={player.playing} gapEnds={memo.gapEnds} kufi={kufi} onToggle={memoToggle} onEnd={memo.clear} />
      ) : (
      <div className="read-player">
        <button className="play" onClick={mainToggle} aria-label={player.playing ? 'إيقاف مؤقت' : 'استمع'} disabled={!align && !loadAlignment(reciter, firstVerseOnPage(page).surah)}>
          <Icon name={player.playing ? 'pause' : 'play'} size={22} />
        </button>
        <div className="read-status">
          {player.playing && current ? (
            <><strong>{SURAH_BY_NUMBER[current.surah].name.replace(/^سُورَةُ\s*/, '')} · الآية {arNum(shownNumber(current.surah, current.basri, current.word))}</strong><small>{RECITERS.find((r) => r.id === reciter)?.nameAr}</small></>
          ) : player.loading !== null ? (
            <><strong>جارٍ جلب التلاوة…</strong><small>{arNum(Math.round(player.loading * 100))}٪</small></>
          ) : !align && !loadAlignment(reciter, firstVerseOnPage(page).surah) ? (
            <><strong>اقرأ من المصحف</strong><small>لا تلاوة متزامنة لهذه السورة بعد</small></>
          ) : (
            <><strong>استمع وتابع</strong><small>اضغط آيةً لتبدأ منها · اضغطها مطوّلًا لتحفظها بالتكرار</small></>
          )}
        </div>
        <select className="read-reciter" value={reciter} onChange={(e) => updateSettings({ reciter: e.target.value })} aria-label="القارئ">
          {RECITERS.map((r) => <option key={r.id} value={r.id}>{r.nameAr}</option>)}
        </select>
      </div>
      )}

      {sheet && (
        <MemoSheet anchor={sheet.anchor} preset={sheet.preset} reciter={reciter} kufi={kufi} run={memo.run} defaults={settings.memo} go={go}
          onClose={() => setSheet(null)}
          onResume={() => { setSheet(null); if (memo.run) setPage(pageOf(memo.run.plan.surah, memo.run.plan.from)); memo.resume(); }}
          onDiscard={() => memo.clear()}
          onStart={(plan) => {
            if (!plan.review) updateSettings({ memo: { count: plan.target, scope: plan.scope === 'range' ? 'verse' : plan.scope, gap: plan.gap, veil: plan.veil } });
            setSheet(null);
            if (memo.start(plan)) setPage(pageOf(plan.surah, plan.from));
          }} />
      )}
      {memo.phase === 'complete' && memo.run?.completed && (
        <MemoDone run={memo.run} kufi={kufi} onYes={() => memo.finish(true)} onNo={() => memo.finish(false)} onMore={(n) => memo.extend(n)} onLater={memo.clear} />
      )}
    </div>
  );
}
