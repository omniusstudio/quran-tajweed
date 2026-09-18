// Play the adhān by hand, on whichever device the button is pressed (the recording uploaded in the
// settings, served by the local server). The same button stops it.

import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons';

export function AdhanPlay({ slot = 'adhan', label = 'شغّل الأذان', className = 'toggle', onMissing }: { slot?: 'adhan' | 'fajr'; label?: string; className?: string; onMissing?: () => void }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [missing, setMissing] = useState(false);
  useEffect(() => () => audio.current?.pause(), []);
  const toggle = () => {
    if (audio.current && !audio.current.paused) return audio.current.pause();
    const el = new Audio(`/__adhan/audio/${slot}`);
    el.addEventListener('play', () => setPlaying(true));
    el.addEventListener('pause', () => setPlaying(false));
    el.addEventListener('ended', () => setPlaying(false));
    el.addEventListener('error', () => { setPlaying(false); setMissing(true); onMissing?.(); });
    audio.current = el;
    setMissing(false);
    void el.play().catch(() => { setMissing(true); onMissing?.(); });
  };
  return (
    <button className={className} onClick={toggle} aria-pressed={playing} title={missing ? 'لا يوجد تسجيل للأذان بعد: ارفعه من الإعدادات' : undefined}>
      <Icon name={playing ? 'stop' : missing ? 'alert' : 'bell'} size={18} /> {playing ? 'أوقف الأذان' : missing ? 'ارفع تسجيل الأذان أولاً' : label}
    </button>
  );
}
