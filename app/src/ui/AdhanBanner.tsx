// The call to prayer inside the app. On the Mac the local server sounds the adhān itself (it runs
// all day, app open or closed), so there the banner only shows the time and a stop button. On any
// other device (the phone) the page plays the same recording while it is open.

import { useEffect, useRef, useState } from 'react';
import { PRAYERS, PRAYER_NAMES, adhanOn, timesFor, type PrayerKey } from '../content/prayer';
import { Icon } from './icons';
import { useSettings } from './settings';

const ON_SERVER_HOST = typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
const SHOW_FOR = 12 * 60 * 1000;

export function AdhanBanner() {
  const [settings] = useSettings();
  const [due, setDue] = useState<{ key: PrayerKey; id: string } | null>(null);
  const [closed, setClosed] = useState<string>('');
  const audio = useRef<HTMLAudioElement | null>(null);
  const announced = useRef<string>('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const times = timesFor(now, settings);
      if (!times) return setDue(null);
      let found: { key: PrayerKey; id: string } | null = null;
      for (const k of PRAYERS as PrayerKey[]) {
        if (!adhanOn(settings, k)) continue;
        const late = now.getTime() - times[k].getTime();
        if (late >= 0 && late < SHOW_FOR) found = { key: k, id: `${now.toDateString()} ${k}` };
        if (late >= 0 && late < 60000 && announced.current !== `${now.toDateString()} ${k}`) {
          announced.current = `${now.toDateString()} ${k}`;
          if ('Notification' in window && Notification.permission === 'granted' && !ON_SERVER_HOST) {
            try { new Notification('نُطق', { body: `حان الآن وقت صلاة ${PRAYER_NAMES[k]}`, tag: 'nutq-adhan', icon: '/icons/icon-192.png' }); } catch { /* ignore */ }
          }
          if (!ON_SERVER_HOST) {
            audio.current?.pause();
            audio.current = new Audio(`/__adhan/audio/${k === 'fajr' ? 'fajr' : 'adhan'}`);
            void audio.current.play().catch(() => { /* no recording uploaded, or autoplay blocked until the page is touched */ });
          }
        }
      }
      setDue(found);
    };
    tick();
    const t = setInterval(tick, 15000);
    return () => clearInterval(t);
  }, [settings]);

  if (!due || closed === due.id) return null;
  const stop = () => {
    audio.current?.pause();
    void fetch('/__adhan/stop', { method: 'POST' }).catch(() => { /* dev server */ });
    setClosed(due.id);
  };
  return (
    <div className="adhan-banner" role="status">
      <Icon name="bell" size={22} />
      <span>
        <strong>حان الآن وقت صلاة {PRAYER_NAMES[due.key]}</strong>
        <small>حيّ على الصلاة، حيّ على الفلاح</small>
      </span>
      <button className="mini" onClick={stop}><Icon name="volumeOff" size={14} /> أوقف وأغلق</button>
    </div>
  );
}
