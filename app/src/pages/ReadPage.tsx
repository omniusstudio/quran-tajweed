import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WORD_SOURCES, loadAlignment, locate, playSpan, type SurahAlign } from '../audio/alignment';
import { DEFAULT_RECITER, RECITERS, SURAHS, SURAH_BY_NUMBER, audioUrl } from '../audio/quran';
import { usePlayer } from '../audio/usePlayer';
import { PAGE_COUNT, firstVerseOnPage, juzOfPage, pageOf, pageSegments } from '../content/pages';
import { inPortionAhead, markRead, wirdState } from '../content/wird';
import { Icon } from '../ui/icons';
import { rewardWird } from '../ui/rewards';
import { useSettings } from '../ui/settings';
import { sfx } from '../ui/sound';
import { arNum } from './shared';

const JUZ_NAMES = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر', 'الثالث عشر', 'الرابع عشر', 'الخامس عشر', 'السادس عشر', 'السابع عشر', 'الثامن عشر', 'التاسع عشر', 'العشرون', 'الحادي والعشرون', 'الثاني والعشرون', 'الثالث والعشرون', 'الرابع والعشرون', 'الخامس والعشرون', 'السادس والعشرون', 'السابع والعشرون', 'الثامن والعشرون', 'التاسع والعشرون', 'الثلاثون'];

/**
 * The muṣḥaf, page by page: continuous justified text with the verse markers inline, sūrah
 * headers and the basmalah where a sūrah begins, and an optional recitation that lights the words
 * as it goes and turns the page by itself. `#/read/<sūrah>/<verse>` opens the page holding that verse.
 */
export function ReadPage({ surah, verse, go }: { surah?: number; verse?: number; go: (hash: string) => void }) {
  const [settings, updateSettings] = useSettings();
  const reciter = RECITERS.some((r) => r.id === settings.reciter) ? settings.reciter : DEFAULT_RECITER;
  const initial = surah ? pageOf(surah, verse ?? SURAH_BY_NUMBER[surah].verses[0].basri) : settings.lastPage ?? 1;
  const [page, setPage] = useState(initial);
  const segs = useMemo(() => pageSegments(page), [page]);
  const juz = juzOfPage(page);

  // the recitation: one sūrah at a time, moving on to the next when it ends
  const [playSurah, setPlaySurah] = useState<number>(segs[0]?.surah.number ?? 1);
  const align: SurahAlign | undefined = useMemo(() => loadAlignment(reciter, playSurah), [reciter, playSurah]);
  const player = usePlayer(align ? audioUrl(reciter, playSurah) : null);
  const pos = align && player.playing ? locate(align, player.time) : align ? locate(align, player.time) : null;
  const wordsTrusted = !!align && (!align.source || WORD_SOURCES.has(align.source));
  const pendingStart = useRef<number | null>(null);

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
    if (!align || !player.playing) return;
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
    const at = playSpan(v)[0];
    if (s !== playSurah) { pendingStart.current = at; setPlaySurah(s); return; }
    lastVerse.current = a.verses.indexOf(v);
    player.seek(at);
    void player.play();
  };
  const mainToggle = () => {
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
    const v = pos && align ? { surah: playSurah, basri: align.verses[pos.verse].basri } : firstVerseOnPage(page);
    sfx('toggle');
    if (bm && bm.pinned && bm.surah === v.surah && bm.basri === v.basri) return updateSettings({ bookmark: { ...bm, pinned: false } });
    updateSettings({ bookmark: { ...v, pinned: true, at: Date.now() } });
  };
  const current = pos && align ? { surah: playSurah, basri: align.verses[pos.verse].basri, word: pos.word } : null;
  const headerSurah = segs[segs.length - 1]?.surah;

  return (
    <div className="page read">
      <div className="read-bar">
        <a href="#/" onClick={(e) => { e.preventDefault(); go('#/'); }} className="crumb"><Icon name="chevronRight" size={18} /> الرئيسية</a>
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
          <button className={`icon-btn${bm?.pinned && pageOf(bm.surah, bm.basri) === page ? ' on' : ''}`} onClick={bookmarkHere} aria-label="علامة هنا" title="ثبّت العلامة هنا"><Icon name="bookmark" /></button>
          <button className="icon-btn" onClick={() => go(`#/follow/${current?.surah ?? firstVerseOnPage(page).surah}/${current?.basri ?? firstVerseOnPage(page).basri}`)} aria-label="افتح في المتابعة" title="المتابعة آيةً آية"><Icon name="headphones" /></button>
        </span>
      </div>

      <div className="mushaf-wrap">
        <button className="page-turn prev" onClick={() => turn(-1)} disabled={page <= 1} aria-label="الصفحة السابقة"><Icon name="chevronRight" /></button>
        <article className={`mushaf-page${player.playing ? ' playing' : ''}`} dir="rtl" onPointerDown={onDown} onPointerUp={onUp} aria-label={`صفحة ${arNum(page)}`}>
          <header className="mp-head">
            <span>{headerSurah?.name}</span>
            <span>الجزء {JUZ_NAMES[juz]}</span>
          </header>
          <div className="mp-body">
            {segs.map((g) => {
              const s = g.surah;
              const a = loadAlignment(reciter, s.number);
              return (
                <section key={s.number} className="mp-surah">
                  {g.starts && (
                    <>
                      <div className="surah-band"><i /><h2>{s.name}</h2><i /></div>
                      {s.header && <p className="basmalah">{s.header}</p>}
                    </>
                  )}
                  <p className="mp-text">
                    {Array.from({ length: g.to - g.from + 1 }, (_, k) => s.verses[g.from + k]).map((v) => {
                      const isCur = current?.surah === s.number && current.basri === v.basri;
                      const marked = bm?.pinned && bm.surah === s.number && bm.basri === v.basri;
                      const canPlay = !!a?.verses.find((x) => x.basri === v.basri);
                      return (
                        <span key={v.basri} className={`aya${isCur ? ' on' : ''}${marked ? ' marked' : ''}`} onClick={() => canPlay && startAt(s.number, v.basri)} role={canPlay ? 'button' : undefined} title={canPlay ? `اسمع من الآية ${arNum(v.basri)}` : undefined}>
                          {v.words.map((w, wi) => (
                            <span key={wi}>
                              <span className={`w${isCur && wordsTrusted && current!.word === wi ? ' on' : ''}`}>{w}</span>{' '}
                            </span>
                          ))}
                          <span className="aya-n" aria-label={`الآية ${arNum(v.basri)}`}>{arNum(v.basri)}</span>{' '}
                        </span>
                      );
                    })}
                  </p>
                </section>
              );
            })}
          </div>
          <footer className="mp-foot">{arNum(page)}</footer>
        </article>
        <button className="page-turn next" onClick={() => turn(1)} disabled={page >= PAGE_COUNT} aria-label="الصفحة التالية"><Icon name="chevronLeft" /></button>
      </div>

      <div className="read-player">
        <button className="play" onClick={mainToggle} aria-label={player.playing ? 'إيقاف مؤقت' : 'استمع'} disabled={!align && !loadAlignment(reciter, firstVerseOnPage(page).surah)}>
          <Icon name={player.playing ? 'pause' : 'play'} size={22} />
        </button>
        <div className="read-status">
          {player.playing && current ? (
            <><strong>{SURAH_BY_NUMBER[current.surah].name.replace(/^سُورَةُ\s*/, '')} · الآية {arNum(current.basri)}</strong><small>{RECITERS.find((r) => r.id === reciter)?.nameAr}</small></>
          ) : player.loading !== null ? (
            <><strong>جارٍ جلب التلاوة…</strong><small>{arNum(Math.round(player.loading * 100))}٪</small></>
          ) : !align && !loadAlignment(reciter, firstVerseOnPage(page).surah) ? (
            <><strong>اقرأ من المصحف</strong><small>لا تلاوة متزامنة لهذه السورة بعد</small></>
          ) : (
            <><strong>استمع وتابع</strong><small>اضغط آيةً لتبدأ منها · ← → لتقليب الصفحات</small></>
          )}
        </div>
        <select className="read-reciter" value={reciter} onChange={(e) => updateSettings({ reciter: e.target.value })} aria-label="القارئ">
          {RECITERS.map((r) => <option key={r.id} value={r.id}>{r.nameAr}</option>)}
        </select>
      </div>
    </div>
  );
}
