import { useCallback, useEffect, useRef, useState } from 'react';

export type PlaySpeed = 0.5 | 0.75 | 1;

export interface Player {
  audio: HTMLAudioElement;
  time: number;
  duration: number;
  playing: boolean;
  ready: boolean;
  error: string | null;
  speed: PlaySpeed;
  loop: [number, number] | null;
  play: () => Promise<void>;
  pause: () => void;
  toggle: () => void;
  seek: (t: number) => void;
  setSpeed: (s: PlaySpeed) => void;
  setLoop: (l: [number, number] | null) => void;
  /** Play [from, to) once; resolves when `to` is reached or playback is interrupted. */
  playRange: (from: number, to: number) => Promise<boolean>;
}

/**
 * HTMLAudioElement wrapper. Slow playback keeps the pitch (`preservesPitch`), which every current
 * browser supports natively, so no time-stretch library is needed for 0.5× / 0.75×.
 */
export function usePlayer(src: string | null): Player {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  if (!audioRef.current) {
    const a = new Audio();
    a.preload = 'auto';
    (a as HTMLAudioElement & { preservesPitch: boolean }).preservesPitch = true;
    (a as HTMLAudioElement & { mozPreservesPitch?: boolean }).mozPreservesPitch = true;
    audioRef.current = a;
  }
  const audio = audioRef.current;
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speed, setSpeedState] = useState<PlaySpeed>(1);
  const loopRef = useRef<[number, number] | null>(null);
  const [loop, setLoopState] = useState<[number, number] | null>(null);
  const rangeRef = useRef<{ to: number; resolve: (ok: boolean) => void } | null>(null);

  useEffect(() => {
    setReady(false);
    setError(null);
    setTime(0);
    setDuration(0);
    audio.pause();
    if (!src) return;
    audio.src = src;
    audio.load();
  }, [src, audio]);

  useEffect(() => {
    const onMeta = () => {
      setDuration(audio.duration || 0);
      setReady(true);
    };
    const onErr = () => setError('تعذر تحميل الملف الصوتي. شغّل scripts/fetch_audio.py أولاً.');
    const onPlay = () => setPlaying(true);
    const onPause = () => {
      setPlaying(false);
      if (rangeRef.current) {
        rangeRef.current.resolve(false);
        rangeRef.current = null;
      }
    };
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('error', onErr);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onPause);
    let raf = 0;
    const tick = () => {
      const t = audio.currentTime;
      setTime(t);
      const r = rangeRef.current;
      if (r && t >= r.to) {
        audio.pause();
        r.resolve(true);
        rangeRef.current = null;
      } else if (loopRef.current && !audio.paused && (t >= loopRef.current[1] || t < loopRef.current[0] - 0.5)) {
        audio.currentTime = loopRef.current[0];
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('error', onErr);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onPause);
    };
  }, [audio]);

  useEffect(() => () => audio.pause(), [audio]);

  const play = useCallback(async () => {
    try {
      await audio.play();
    } catch (e) {
      setError(String(e));
    }
  }, [audio]);
  const pause = useCallback(() => audio.pause(), [audio]);
  const toggle = useCallback(() => {
    if (audio.paused) void play();
    else audio.pause();
  }, [audio, play]);
  const seek = useCallback(
    (t: number) => {
      audio.currentTime = Math.max(0, Math.min(audio.duration || t, t));
      setTime(audio.currentTime);
    },
    [audio],
  );
  const setSpeed = useCallback(
    (s: PlaySpeed) => {
      audio.playbackRate = s;
      setSpeedState(s);
    },
    [audio],
  );
  const setLoop = useCallback((l: [number, number] | null) => {
    loopRef.current = l;
    setLoopState(l);
  }, []);
  const playRange = useCallback(
    (from: number, to: number) =>
      new Promise<boolean>((resolve) => {
        if (rangeRef.current) rangeRef.current.resolve(false);
        loopRef.current = null;
        setLoopState(null);
        audio.currentTime = from;
        rangeRef.current = { to, resolve };
        void audio.play().catch(() => resolve(false));
      }),
    [audio],
  );

  return { audio, time, duration, playing, ready, error, speed, loop, play, pause, toggle, seek, setSpeed, setLoop, playRange };
}

/** A short beep for echo mode (no TTS, just a tone). */
export function beep(ctx: AudioContext, ms = 160, freq = 880): Promise<void> {
  return new Promise((resolve) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = freq;
    g.gain.value = 0.15;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + ms / 1000);
    o.onended = () => resolve();
  });
}
