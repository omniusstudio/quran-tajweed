// How the muṣḥaf page is shown on this device: focus mode (only the text, the navigation and the player)
// and the text size. Per device on purpose: a phone wants focus and big text, the Mac does not,
// so these stay out of the synced settings.

import { useSyncExternalStore } from 'react';

export type ReadText = 'page' | 'large' | 'xlarge';
export interface ReadView { focus: boolean; text: ReadText; /** The reader picked a size themselves, so it is never chosen for them. */ chosen?: boolean }

const KEY = 'nutq.read.view';
let state: ReadView = { focus: false, text: 'page' };
try {
  const raw = JSON.parse(localStorage.getItem(KEY) || 'null') as Partial<ReadView> | null;
  if (raw) state = { focus: !!raw.focus, text: raw.text === 'large' || raw.text === 'xlarge' ? raw.text : 'page', chosen: !!raw.chosen };
} catch { /* ignore */ }

const listeners = new Set<() => void>();
export function setReadView(patch: Partial<ReadView>) {
  state = { ...state, ...patch, ...(patch.text && !('chosen' in patch) ? { chosen: true } : {}) };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}
export function useReadView(): [ReadView, (patch: Partial<ReadView>) => void] {
  const v = useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => state);
  return [v, setReadView];
}
export const NEXT_TEXT: Record<ReadText, ReadText> = { page: 'large', large: 'xlarge', xlarge: 'page' };
export const TEXT_LABEL: Record<ReadText, string> = { page: 'المصحف', large: 'كبير', xlarge: 'أكبر' };
