import { useEffect, useRef } from 'react';
import { isBusy } from './activity';

/** Calls `onIdle` after `minutes` without touch, mouse, wheel or keyboard (never while audio plays). 0 = off. */
export function useIdle(minutes: number, enabled: boolean, onIdle: () => void) {
  const cb = useRef(onIdle);
  cb.current = onIdle;
  useEffect(() => {
    if (!enabled || !(minutes > 0)) return;
    let last = Date.now();
    let lastMove = 0;
    const touch = () => { last = Date.now(); };
    const move = () => { const n = Date.now(); if (n - lastMove > 1000) { lastMove = n; last = n; } };
    const events: [string, () => void][] = [['pointerdown', touch], ['keydown', touch], ['wheel', touch], ['touchstart', touch], ['pointermove', move]];
    events.forEach(([e, f]) => addEventListener(e, f, { passive: true }));
    const t = setInterval(() => {
      if (isBusy()) { last = Date.now(); return; }
      if (Date.now() - last >= minutes * 60000) { last = Date.now(); cb.current(); }
    }, 5000);
    return () => { clearInterval(t); events.forEach(([e, f]) => removeEventListener(e, f)); };
  }, [minutes, enabled]);
}
