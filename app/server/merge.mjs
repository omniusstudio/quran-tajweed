// Merge two copies of the learner's state (progress, exercise deck, settings, alignments). Used by
// the local server (its copy is the meeting point) and by every device before it writes, so the
// phone and the Mac end up with the same picture. One person, so the rules are simple:
// done steps are a union, daily points take the higher count, a card keeps the copy that has been
// answered more (then the later due date), settings and alignments follow the latest change.

const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : 0);

export function mergeProgress(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  const done = { ...(a.done || {}), ...(b.done || {}) };
  const days = {};
  for (const src of [a.days || {}, b.days || {}]) {
    for (const [k, d] of Object.entries(src)) {
      const cur = days[k] || { lessons: 0, answers: 0, correct: 0, drills: 0 };
      days[k] = { lessons: Math.max(cur.lessons, num(d.lessons)), answers: Math.max(cur.answers, num(d.answers)), correct: Math.max(cur.correct, num(d.correct)), drills: Math.max(cur.drills, num(d.drills)), challenges: Math.max(num(cur.challenges), num(d.challenges)), wird: Math.max(num(cur.wird), num(d.wird)), todos: Math.max(num(cur.todos), num(d.todos)) };
    }
  }
  const newer = num(b.updatedAt) >= num(a.updatedAt) ? b : a;
  // memorization cards: keep the copy with more successful recalls, then the later due date
  const hifzDone = { ...((a.hifz && a.hifz.done) || {}) };
  for (const [id, card] of Object.entries((b.hifz && b.hifz.done) || {})) {
    const cur = hifzDone[id];
    if (!cur || num(card.reviews) > num(cur.reviews) || (num(card.reviews) === num(cur.reviews) && num(card.due) > num(cur.due))) hifzDone[id] = card;
  }
  const hifz = { done: hifzDone, updatedAt: Math.max(num(a.hifz && a.hifz.updatedAt), num(b.hifz && b.hifz.updatedAt)) };
  // the repeat-to-memorize ledger: repetitions only ever grow (max); the memorized flag follows its latest change
  const memoVerses = { ...((a.memo && a.memo.verses) || {}) };
  for (const [k, v] of Object.entries((b.memo && b.memo.verses) || {})) {
    const cur = memoVerses[k];
    if (!cur) { memoVerses[k] = v; continue; }
    const flag = num(v.mAt) > num(cur.mAt) || (num(v.mAt) === num(cur.mAt) && num(v.reviews) > num(cur.reviews)) ? v : cur;
    memoVerses[k] = { reps: Math.max(num(cur.reps), num(v.reps)), last: Math.max(num(cur.last), num(v.last)), done: flag.done, mAt: flag.mAt, reviews: flag.reviews, due: flag.due };
  }
  const memoDays = {};
  for (const src of [(a.memo && a.memo.days) || {}, (b.memo && b.memo.days) || {}]) for (const [k, n] of Object.entries(src)) memoDays[k] = Math.max(num(memoDays[k]), num(n));
  const memo = a.memo || b.memo ? { verses: memoVerses, days: memoDays, updatedAt: Math.max(num(a.memo && a.memo.updatedAt), num(b.memo && b.memo.updatedAt)) } : undefined;
  // the wird: the reader who is further ahead (more khatms, then more quarters) sets the position;
  // each day keeps its best log; pace / Ramadan / reminder follow the latest change
  let wird = a.wird || b.wird || null;
  if (a.wird && b.wird) {
    const ahead = num(b.wird.khatms) > num(a.wird.khatms) || (num(b.wird.khatms) === num(a.wird.khatms) && num(b.wird.posQ) > num(a.wird.posQ)) ? b.wird : a.wird;
    const latest = num(b.wird.updatedAt) >= num(a.wird.updatedAt) ? b.wird : a.wird;
    const wdays = {};
    for (const src of [a.wird.days || {}, b.wird.days || {}]) {
      for (const [k, d] of Object.entries(src)) {
        const cur = wdays[k];
        wdays[k] = cur ? { start: Math.min(num(cur.start), num(d.start)), done: Math.max(num(cur.done), num(d.done)) } : { start: num(d.start), done: num(d.done) };
      }
    }
    wird = { pace: latest.pace, ramadan: !!latest.ramadan, reminder: latest.reminder ?? null, pos: ahead.pos ?? null, posQ: num(ahead.posQ), khatms: Math.max(num(a.wird.khatms), num(b.wird.khatms)), days: wdays, updatedAt: Math.max(num(a.wird.updatedAt), num(b.wird.updatedAt)) };
  }
  // the daily checklist: each item follows its latest change, so a tick (or an untick) on either device wins
  const todos = {};
  for (const src of [a.todos || {}, b.todos || {}]) {
    for (const [k, d] of Object.entries(src)) {
      const day = todos[k] || (todos[k] = {});
      for (const [id, tick] of Object.entries(d)) if (!day[id] || num(tick.at) > num(day[id].at)) day[id] = tick;
    }
  }
  return { done, days, last: newer.last ?? a.last ?? b.last, hifz, ...(memo ? { memo } : {}), wird, todos, updatedAt: Math.max(num(a.updatedAt), num(b.updatedAt)) };
}

export function mergeDeck(a, b) {
  const out = { ...(a || {}) };
  for (const [id, card] of Object.entries(b || {})) {
    const cur = out[id];
    if (!cur) out[id] = card;
    else if (num(card.seen) > num(cur.seen) || (num(card.seen) === num(cur.seen) && num(card.due) > num(cur.due))) out[id] = card;
  }
  return out;
}

export function newer(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return num(b.updatedAt) > num(a.updatedAt) ? b : a;
}

export function mergeAlignments(a, b) {
  const out = { ...(a || {}) };
  for (const [k, v] of Object.entries(b || {})) out[k] = newer(out[k], v);
  return out;
}

export function mergeState(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return {
    v: 1,
    progress: mergeProgress(a.progress, b.progress),
    deck: mergeDeck(a.deck, b.deck),
    settings: newer(a.settings, b.settings),
    alignments: mergeAlignments(a.alignments, b.alignments),
  };
}
