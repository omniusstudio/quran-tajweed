import { useEffect, useState } from 'react';
import { verseSpan } from '../audio/alignment';
import { audioUrl } from '../audio/quran';
import { usePlayer } from '../audio/usePlayer';
import { duaOfDay } from '../content/duas';
import { dayKey } from '../content/progress';
import { Icon } from '../ui/icons';
import { useSettings } from '../ui/settings';
import { sfx } from '../ui/sound';
import { arNum } from './shared';

const DISMISS_KEY = 'nutq.dua.dismissed';

/** The day's supplication from the muṣḥaf, playable in the reciter's voice; closable for the day. */
export function DuaCard({ go }: { go: (hash: string) => void }) {
  const [settings] = useSettings();
  const dua = duaOfDay();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === dayKey();
    } catch {
      return false;
    }
  });
  const spans = dua ? dua.verses.map((b) => verseSpan(settings.reciter, dua.ref.surah, b)) : [];
  const canPlay = spans.length > 0 && spans.every(Boolean);
  const player = usePlayer(dua && canPlay ? audioUrl(settings.reciter, dua.ref.surah) : null);
  useEffect(() => () => player.pause(), []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!dua || dismissed) return null;
  const close = () => {
    try {
      localStorage.setItem(DISMISS_KEY, dayKey());
    } catch {
      /* ignore */
    }
    player.pause();
    sfx('tap');
    setDismissed(true);
  };
  const play = () => {
    if (!canPlay) return;
    if (player.playing) return player.pause();
    sfx('tap');
    void player.playRange(spans[0]![0], spans[spans.length - 1]![1]);
  };
  const range = dua.verses.length === 1 ? `الآية ${arNum(dua.verses[0])}` : `الآيات ${arNum(dua.verses[0])}–${arNum(dua.verses[dua.verses.length - 1])}`;
  return (
    <section className="dua-card" aria-label="دعاء اليوم">
      <button className="dua-close icon-btn" onClick={close} aria-label="أغلق دعاء اليوم" title="أغلق لليوم">
        <Icon name="x" size={18} />
      </button>
      <span className="eyebrow">دعاء اليوم</span>
      <p className="ayah dua-text" dir="rtl">
        {dua.text} <span className="num">﴿{arNum(dua.verses[dua.verses.length - 1])}﴾</span>
      </p>
      <p className="ref dua-ref">
        {dua.surahName}، {range} · {dua.ref.note}
      </p>
      <div className="row wrap dua-actions">
        <button className="primary" onClick={play} disabled={!canPlay || (!player.ready && player.loading === null && canPlay && !player.error)}>
          <Icon name={player.playing ? 'pause' : 'play'} size={18} /> {player.playing ? 'إيقاف' : 'اسمع'}
        </button>
        {player.loading !== null && <span className="ref">جارٍ جلب التلاوة ({arNum(Math.round(player.loading * 100))}٪)…</span>}
        {!canPlay && <span className="ref">لا صوت لهذه السورة بعد</span>}
        {canPlay && <span className="ref">تُسمع معها الآية التي قبلها والتي بعدها حتى لا تُقطع.</span>}
        <a className="crumb" href={`#/follow/${dua.ref.surah}/${dua.verses[0]}`} onClick={(e) => { e.preventDefault(); go(`#/follow/${dua.ref.surah}/${dua.verses[0]}`); }}>
          في المتابعة <Icon name="chevronLeft" size={14} />
        </a>
      </div>
    </section>
  );
}
