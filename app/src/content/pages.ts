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
