// Simple Leitner spaced repetition in localStorage (PROMPT.md §7.3): items answered wrong come
// back sooner. Boxes 0..4 with growing intervals; a wrong answer drops the item to box 0.

const KEY = 'nutq.leitner.v1';
const INTERVALS_MS = [0, 10 * 60 * 1000, 24 * 3600 * 1000, 3 * 24 * 3600 * 1000, 7 * 24 * 3600 * 1000];

export interface Card {
  box: number;
  due: number;
  seen: number;
  wrong: number;
}

export type Deck = Record<string, Card>;

export function loadDeck(): Deck {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Deck;
  } catch {
    /* ignore */
  }
  return {};
}

export function saveDeck(d: Deck) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* ignore */
  }
}

/** Record an answer for an item id; returns the updated deck. */
export function answer(deck: Deck, id: string, correct: boolean, now = Date.now()): Deck {
  const c = deck[id] ?? { box: 0, due: now, seen: 0, wrong: 0 };
  const box = correct ? Math.min(INTERVALS_MS.length - 1, c.box + 1) : 0;
  const next: Deck = { ...deck, [id]: { box, due: now + INTERVALS_MS[box], seen: c.seen + 1, wrong: c.wrong + (correct ? 0 : 1) } };
  saveDeck(next);
  return next;
}

/**
 * Pick the next item to ask from `candidates`: due items first (lowest box first), then unseen
 * ones, then anything else. `random` lets tests be deterministic.
 */
export function pickNext<T extends { id: string }>(deck: Deck, candidates: T[], exclude: string[] = [], now = Date.now(), random = Math.random): T | undefined {
  const pool = candidates.filter((c) => !exclude.includes(c.id));
  if (!pool.length) return undefined;
  const due = pool.filter((c) => deck[c.id] && deck[c.id].due <= now).sort((a, b) => deck[a.id].box - deck[b.id].box || deck[a.id].due - deck[b.id].due);
  if (due.length) return due[0];
  const unseen = pool.filter((c) => !deck[c.id]);
  if (unseen.length) return unseen[Math.floor(random() * unseen.length)];
  return pool[Math.floor(random() * pool.length)];
}

export function deckStats(deck: Deck, prefix: string, now = Date.now()) {
  const cards = Object.entries(deck).filter(([k]) => k.startsWith(prefix));
  return {
    seen: cards.length,
    due: cards.filter(([, c]) => c.due <= now).length,
    mastered: cards.filter(([, c]) => c.box >= 3).length,
  };
}
