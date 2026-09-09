import { useCallback, useEffect, useRef, useState } from 'react';

export type Speed = 0.25 | 0.5 | 1;

export interface Clock {
  t: number;
  playing: boolean;
  speed: Speed;
  loop: boolean;
  seek: (t: number) => void;
  toggle: () => void;
  setSpeed: (s: Speed) => void;
  setLoop: (l: boolean) => void;
  restart: () => void;
}

/** A requestAnimationFrame clock producing normalised time 0..1 over `durationMs` at 1×. */
export function useClock(durationMs: number, autoplay = true): Clock {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(autoplay);
  const [speed, setSpeed] = useState<Speed>(1);
  const [loop, setLoop] = useState(true);
  const tRef = useRef(0);
  const loopRef = useRef(loop);
  loopRef.current = loop;

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      let next = tRef.current + (dt * speed) / durationMs;
      if (next >= 1) {
        if (loopRef.current) next -= Math.floor(next);
        else {
          next = 1;
          tRef.current = next;
          setT(next);
          setPlaying(false);
          return;
        }
      }
      tRef.current = next;
      setT(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, durationMs]);

  const seek = useCallback((v: number) => {
    tRef.current = Math.min(1, Math.max(0, v));
    setT(tRef.current);
  }, []);
  const toggle = useCallback(() => {
    if (!playing && tRef.current >= 1) seek(0);
    setPlaying((p) => !p);
  }, [playing, seek]);
  const restart = useCallback(() => {
    seek(0);
    setPlaying(true);
  }, [seek]);

  return { t, playing, speed, loop, seek, toggle, setSpeed, setLoop, restart };
}
