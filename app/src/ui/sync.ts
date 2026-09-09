// Keeps the learner's state the same on every device that opens the app through the local server:
// pull on open and whenever the window comes back, push (debounced) after every change. Each side
// merges with server/merge.mjs, so nothing is lost when both devices were used. Silently inactive
// under the dev server or when the Mac is unreachable; local storage keeps working as before.

import { mergeState, type SyncState } from '../../server/merge.mjs';
import { replaceProgress, readProgress } from '../content/progress';
import { loadDeck, saveDeck } from '../exercises/leitner';
import { getClip, listKeys, putClip } from '../audio/store';
import { getSettings, replaceSettings } from './settings';

const ALIGN_PREFIX = 'nutq.align.';
let lastSync = 0;
let available: boolean | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function syncStatus() {
  return { lastSync, available };
}
export function onSyncStatus(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function collect(): SyncState {
  const alignments: SyncState['alignments'] = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (!k.startsWith(ALIGN_PREFIX)) continue;
      const v = JSON.parse(localStorage.getItem(k) || 'null');
      if (v) alignments[k.slice(ALIGN_PREFIX.length)] = { ...v, updatedAt: v.savedAt ?? 0 };
    }
  } catch {
    /* ignore */
  }
  return { v: 1, progress: readProgress() as unknown as Record<string, unknown>, deck: loadDeck() as unknown as Record<string, unknown>, settings: getSettings() as unknown as Record<string, unknown>, alignments };
}

function apply(state: SyncState | null) {
  if (!state) return;
  if (state.progress) replaceProgress(state.progress as never);
  if (state.deck) saveDeck(state.deck as never, false);
  if (state.settings) replaceSettings(state.settings as never);
  for (const [k, v] of Object.entries(state.alignments || {})) {
    try {
      const cur = JSON.parse(localStorage.getItem(ALIGN_PREFIX + k) || 'null');
      if (!cur || (cur.savedAt ?? 0) < (v.updatedAt ?? 0)) localStorage.setItem(ALIGN_PREFIX + k, JSON.stringify(v));
    } catch {
      /* ignore */
    }
  }
}

let inflight: Promise<void> | null = null;
let dirty = false;

/** Merge with the server copy and store the result on both sides. */
async function exchange(push: boolean): Promise<void> {
  const local = collect();
  let remote: SyncState | null = null;
  try {
    const r = await fetch('/__state', { cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    remote = (await r.json()) as SyncState | null;
    available = true;
  } catch {
    available = false;
    notify();
    return;
  }
  const merged = mergeState(remote, local);
  silent = true;
  try {
    apply(merged);
  } finally {
    silent = false;
  }
  if (push || JSON.stringify(merged) !== JSON.stringify(remote)) {
    try {
      const r = await fetch('/__state', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(merged) });
      if (r.ok) {
        silent = true;
        try {
          apply((await r.json()) as SyncState | null);
        } finally {
          silent = false;
        }
      }
    } catch {
      /* the next change will retry */
    }
  }
  lastSync = Date.now();
  notify();
}

let silent = false;
function run(push: boolean) {
  if (inflight) {
    dirty = dirty || push;
    return inflight;
  }
  inflight = exchange(push).finally(() => {
    inflight = null;
    if (dirty) {
      dirty = false;
      void run(true);
    }
  });
  return inflight;
}

/** Recordings: upload what only this device has (or has newer), download what only the server has. */
async function syncClips() {
  if (available === false) return;
  let remote: Record<string, { mime: string; at: number; size: number }>;
  try {
    const r = await fetch('/__clips', { cache: 'no-store' });
    if (!r.ok) return;
    remote = await r.json();
  } catch {
    return;
  }
  let local: string[] = [];
  try {
    local = await listKeys('');
  } catch {
    return;
  }
  const localAt = new Map<string, number>();
  for (const key of local) {
    const c = await getClip(key);
    if (!c) continue;
    localAt.set(key, c.at);
    const meta = remote[key];
    if (!meta || meta.at < c.at) {
      try {
        await fetch(`/__clips/${encodeURIComponent(key)}`, { method: 'PUT', headers: { 'content-type': c.mime || c.blob.type || 'application/octet-stream', 'x-clip-at': String(c.at) }, body: c.blob });
      } catch {
        /* next time */
      }
    }
  }
  for (const [key, meta] of Object.entries(remote)) {
    const at = localAt.get(key);
    if (at !== undefined && at >= meta.at) continue;
    try {
      const r = await fetch(`/__clips/${encodeURIComponent(key)}`, { cache: 'no-store' });
      if (!r.ok) continue;
      const blob = await r.blob();
      await putClip(key, new Blob([blob], { type: meta.mime }), meta.at);
    } catch {
      /* next time */
    }
  }
}

let timer = 0;
export function syncNow() {
  return run(true).then(syncClips);
}

export function startSync() {
  if (typeof window === 'undefined') return;
  void run(false).then(syncClips);
  addEventListener('nutq:clip', () => void syncClips());
  addEventListener('nutq:clip-deleted', (e) => {
    const key = (e as CustomEvent<{ key: string }>).detail.key;
    void fetch(`/__clips/${encodeURIComponent(key)}`, { method: 'DELETE' }).catch(() => undefined);
  });
  addEventListener('nutq:changed', () => {
    if (silent) return;
    clearTimeout(timer);
    timer = window.setTimeout(() => void run(true), 1200);
  });
  const pull = () => void run(false).then(syncClips);
  addEventListener('focus', pull);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && pull());
  addEventListener('pagehide', () => {
    // last chance: send whatever is pending without waiting for the debounce
    if (timer) {
      clearTimeout(timer);
      try {
        navigator.sendBeacon?.('/__state', new Blob([JSON.stringify(collect())], { type: 'application/json' }));
      } catch {
        /* ignore */
      }
    }
  });
}
