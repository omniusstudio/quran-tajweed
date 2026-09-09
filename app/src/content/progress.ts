// Local-only lesson progress (PROMPT.md §3: no accounts, no server state).

import { useCallback, useEffect, useState } from 'react';

const KEY = 'nutq.progress.v1';

export interface Progress {
  done: Record<string, true>;
  last?: string;
}

function read(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Progress;
  } catch {
    /* private mode or blocked storage: start fresh */
  }
  return { done: {} };
}

function write(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

const listeners = new Set<() => void>();

export function useProgress(): [Progress, (ruleId: string, done: boolean) => void, (ruleId: string) => void] {
  const [p, setP] = useState<Progress>(read);
  useEffect(() => {
    const on = () => setP(read());
    listeners.add(on);
    return () => {
      listeners.delete(on);
    };
  }, []);
  const mark = useCallback((ruleId: string, done: boolean) => {
    const cur = read();
    if (done) cur.done[ruleId] = true;
    else delete cur.done[ruleId];
    write(cur);
    listeners.forEach((l) => l());
  }, []);
  const visit = useCallback((ruleId: string) => {
    const cur = read();
    if (cur.last === ruleId) return;
    cur.last = ruleId;
    write(cur);
    listeners.forEach((l) => l());
  }, []);
  return [p, mark, visit];
}
