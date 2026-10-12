// The muṣḥaf as pages: which verses of which sūrahs sit on each of the 604 pages (the page numbers
// in mushaf.json), so the reading view can turn pages like a printed copy.

import { SURAHS, SURAH_BY_NUMBER, type Surah, type Verse } from '../audio/quran';

export interface PageSegment {
  surah: Surah;
  /** Indices into surah.verses, inclusive. */
  from: number;
  to: number;
  /** The sūrah begins on this page: show its header and basmalah before the text. */
  starts: boolean;
}

export const PAGE_COUNT = 604;
const PAGES: PageSegment[][] = [];
const PAGE_OF = new Map<string, number>();
for (const s of SURAHS) {
  s.verses.forEach((v: Verse, i: number) => {
    const p = v.page ?? 1;
    PAGE_OF.set(`${s.number}:${v.basri}`, p);
    const segs = PAGES[p] ?? (PAGES[p] = []);
    const last = segs[segs.length - 1];
    if (last && last.surah === s) last.to = i;
    else segs.push({ surah: s, from: i, to: i, starts: i === 0 });
  });
}

export function pageSegments(page: number): PageSegment[] {
  return PAGES[page] ?? [];
}

export function pageOf(surah: number, basri: number): number {
  return PAGE_OF.get(`${surah}:${basri}`) ?? SURAH_BY_NUMBER[surah]?.verses[0]?.page ?? 1;
}

/** The juzʾ a page belongs to (its first verse's). */
export function juzOfPage(page: number): number {
  const seg = pageSegments(page)[0];
  return seg ? seg.surah.verses[seg.from].juz ?? 1 : 1;
}

export function firstVerseOnPage(page: number): { surah: number; basri: number } {
  const seg = pageSegments(page)[0];
  return seg ? { surah: seg.surah.number, basri: seg.surah.verses[seg.from].basri } : { surah: 1, basri: 1 };
}

export const LINES_PER_PAGE = 15;

export interface LineWord {
  surah: Surah;
  /** Index into surah.verses. */
  vi: number;
  /** Index into the verse's words. */
  wi: number;
  /** A verse-end marker after this word (the number to print), per the chosen count. */
  mark?: number;
  /** This word closes its sūrah (the print centres that line). */
  lastOfSurah?: boolean;
}
export type Slot = { kind: 'band'; surah: Surah; /** no line left for the basmalah: draw it inside the band */ compact?: boolean } | { kind: 'basmalah'; surah: Surah } | { kind: 'text'; words: LineWord[]; centred: boolean } | { kind: 'empty' };

/** The page as its 15 lines: headings where a sūrah begins, then the words line by line. */
/** A verse that runs over a page break: the runs before the break (`head`, previous page) and after it (`tail`). */
function splitRuns(v: Verse): { head: [number, number][]; tail: [number, number][] } {
  const runs = v.lines ?? [[LINES_PER_PAGE, v.words.length]];
  const drop = runs.findIndex((r, i) => i > 0 && r[0] < runs[i - 1][0]);
  return drop < 0 ? { head: [], tail: runs } : { head: runs.slice(0, drop), tail: runs.slice(drop) };
}

export function pageLines(page: number, numbering: 'kufi' | 'basri'): Slot[] {
  const slots: Slot[] = Array.from({ length: LINES_PER_PAGE }, () => ({ kind: 'empty' }));
  // the first verse of the next page may begin on this one
  const next = pageSegments(page + 1)[0];
  const spill = next && splitRuns(next.surah.verses[next.from]).head.length ? { surah: next.surah, vi: next.from } : null;
  const groups: { surah: Surah; from: number; to: number; starts: boolean; headOnly?: boolean }[] = [...pageSegments(page)];
  if (spill) {
    const last = groups[groups.length - 1];
    if (last && last.surah === spill.surah) last.to = spill.vi;
    else groups.push({ surah: spill.surah, from: spill.vi, to: spill.vi, starts: spill.vi === 0 });
  }
  for (const g of groups) {
    const s = g.surah;
    let firstLine = LINES_PER_PAGE;
    for (let vi = g.from; vi <= g.to; vi++) {
      const v = s.verses[vi];
      const parts = splitRuns(v);
      const isSpill = spill && s === spill.surah && vi === spill.vi;
      const runs = isSpill ? parts.head : parts.tail;
      let wi = isSpill ? 0 : parts.head.reduce((n, r) => n + r[1], 0);
      for (const [line, count] of runs) {
        firstLine = Math.min(firstLine, line);
        const slot = slots[line - 1];
        const words = slot.kind === 'text' ? slot.words : [];
        if (slot.kind !== 'text') slots[line - 1] = { kind: 'text', words, centred: false };
        for (let k = 0; k < count; k++, wi++) {
          const after = wi + 1;
          const mark = numbering === 'kufi' ? v.kufiEnds?.find((e) => e[0] === after)?.[1] : after === v.words.length ? v.basri : undefined;
          words.push({ surah: s, vi, wi, mark, lastOfSurah: vi === s.verses.length - 1 && after === v.words.length });
        }
      }
    }
    if (g.starts) {
      // the heading takes the line (or two, with the basmalah) just above the first text line
      const bas = !!s.header;
      const bandLine = firstLine - (bas ? 2 : 1);
      if (bandLine >= 1) {
        slots[bandLine - 1] = { kind: 'band', surah: s };
        if (bas) slots[firstLine - 2] = { kind: 'basmalah', surah: s };
      } else if (firstLine >= 2) {
        slots[0] = { kind: 'band', surah: s, compact: bas };
      }
    }
  }
  for (const slot of slots) if (slot.kind === 'text' && slot.words.some((w) => w.lastOfSurah)) slot.centred = true;
  return slots;
}
