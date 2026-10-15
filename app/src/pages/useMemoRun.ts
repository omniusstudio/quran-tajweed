import { useEffect, useRef, useState } from 'react';
import { loadAlignment, type SurahAlign } from '../audio/alignment';
import type { Player } from '../audio/usePlayer';
import { addPass, markDone, reviewResult } from '../content/memo';
import { gapMs, loadRun, planKeys, planRange, saveRun, type MemoPlan, type MemoRun } from '../content/memoRun';
import { logActivity } from '../content/progress';
import { celebrate } from '../ui/celebrate';
import { sfx } from '../ui/sound';
import { arNum } from './shared';

export type MemoPhase = 'listening' | 'gap' | 'paused' | 'complete';

export interface MemoSession {
  run: MemoRun | null;
  phase: MemoPhase;
  /** When the silent gap ends (ms since epoch), for the countdown. */
  gapEnds: number;
  start: (plan: MemoPlan) => boolean;
  resume: () => void;
  pause: () => void;
  clear: () => void;
  extend: (n: number) => void;
  /** The learner says it is memorized (or, for a recall, that it held). */
  finish: (ok: boolean) => void;
}

/**
 * The repeat engine. It drives the shared player: the loop covers the plan's range, each time the end is
 * reached the pass is counted (into the ledger as well), a gap may follow, and when the count is reached
 * the audio stops and the run is `complete` until the learner decides.
 */
export function useMemoRun(opts: { player: Player; align: SurahAlign | undefined; playSurah: number; setPlaySurah: (s: number) => void; pendingStart: React.MutableRefObject<number | null>; reciter: string }): MemoSession {
  const { player, align, playSurah, setPlaySurah, pendingStart, reciter } = opts;
  const [run, setRun] = useState<MemoRun | null>(() => loadRun());
  const runRef = useRef<MemoRun | null>(run);
  const [phase, setPhase] = useState<MemoPhase>(run?.completed ? 'complete' : 'paused');
  const [gapEnds, setGapEnds] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerRef = useRef(player);
  playerRef.current = player;

  const commit = (next: MemoRun | null) => {
    runRef.current = next;
    setRun(next);
    saveRun(next);
  };
  const cancelGap = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const rangeOf = (r: MemoRun): [number, number] | null => {
    const a = loadAlignment(reciter, r.plan.surah);
    return a ? planRange(r.plan, a) : null;
  };

  /** Play one hearing from the start of the range. */
  const hear = () => {
    const r = runRef.current;
    const range = r && rangeOf(r);
    if (!r || !range) return;
    cancelGap();
    setPhase('listening');
    playerRef.current.setLoop(range);
    playerRef.current.seek(range[0]);
    void playerRef.current.play();
  };

  /** One hearing is over. Returns true to wrap straight into the next one. */
  const passEnd = (): boolean => {
    const r = runRef.current;
    if (!r || r.completed) return false;
    const done = r.done + 1;
    addPass(planKeys(r.plan));
    if (done >= r.plan.target) {
      commit({ ...r, done, completed: true });
      playerRef.current.setLoop(null);
      playerRef.current.setPassHandler(null);
      setPhase('complete');
      sfx('fanfare');
      logActivity('challenge');
      return false;
    }
    commit({ ...r, done });
    const range = rangeOf(r);
    const ms = range ? gapMs(r.plan.gap, range[1] - range[0]) : 0;
    if (ms <= 0) return true;
    setPhase('gap');
    setGapEnds(Date.now() + ms);
    cancelGap();
    timer.current = setTimeout(() => { timer.current = null; if (runRef.current && !runRef.current.completed) hear(); }, ms);
    return false;
  };
  const passEndRef = useRef(passEnd);
  passEndRef.current = passEnd;

  // wire the loop to the sūrah whose recording is loaded; the pass handler reads the latest closure
  useEffect(() => {
    if (!run || run.completed) { player.setLoop(null); player.setPassHandler(null); return; }
    if (!align || align.surah !== run.plan.surah || !player.ready) return;
    const range = planRange(run.plan, align);
    if (range) player.setLoop(range);
    player.setPassHandler(() => passEndRef.current());
  }, [run?.plan, run?.completed, align, player.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // a recording that ends inside the range (a sūrah's last verse) still counts as a pass
  useEffect(() => {
    const onEnded = () => {
      const r = runRef.current;
      if (!r || r.completed || phase === 'paused') return;
      if (passEndRef.current()) hear();
    };
    player.audio.addEventListener('ended', onEnded);
    return () => player.audio.removeEventListener('ended', onEnded);
  }, [player.audio, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => cancelGap(), []);

  const launch = (r: MemoRun) => {
    const range = rangeOf(r);
    if (!range) return false;
    if (playSurah !== r.plan.surah) {
      // the loop is attached by the effect above once that recording is loaded
      pendingStart.current = range[0];
      setPhase('listening');
      setPlaySurah(r.plan.surah);
    } else {
      hear();
    }
    return true;
  };

  const start = (plan: MemoPlan) => {
    player.unlock();
    if (!loadAlignment(reciter, plan.surah)) return false;
    const r: MemoRun = { plan, done: 0, at: Date.now() };
    commit(r);
    return launch(r);
  };
  const resume = () => {
    player.unlock();
    const r = runRef.current;
    if (!r || r.completed) return;
    const range = rangeOf(r);
    setPhase('listening');
    if (playSurah !== r.plan.surah) { launch(r); return; }
    if (range && (player.time < range[0] - 0.5 || player.time >= range[1])) { hear(); return; }
    void player.play();
  };
  const pause = () => {
    cancelGap();
    player.pause();
    setPhase('paused');
  };
  const clear = () => {
    cancelGap();
    player.pause();
    player.setLoop(null);
    player.setPassHandler(null);
    commit(null);
    setPhase('paused');
  };
  const extend = (n: number) => {
    const r = runRef.current;
    if (!r) return;
    const next = { ...r, plan: { ...r.plan, target: r.plan.target + n }, completed: false };
    commit(next);
    launch(next);
  };
  const finish = (ok: boolean) => {
    const r = runRef.current;
    if (!r) return;
    const keys = planKeys(r.plan);
    if (r.plan.review) reviewResult(keys, ok);
    else if (ok) markDone(keys);
    if (ok) celebrate({ kind: 'section', title: r.plan.review ? 'ثبتت' : 'حفظتها', text: `${arNum(r.done)} تكرارًا. بارك الله فيك.` });
    clear();
  };

  return { run, phase, gapEnds, start, resume, pause, clear, extend, finish };
}
