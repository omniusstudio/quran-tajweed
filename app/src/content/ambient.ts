// What the ambient screen shows in turn: well-known āyāt (references only, resolved against the
// bundled muṣḥaf so the text is never typed here), the Qur'anic supplications of the daily card,
// and the shorter hadith passages of hadith.json. `key` is a bare word that must occur in the
// resolved verse; the test checks it, because the Kūfī → Baṣrī match can slip.

import { SURAH_BY_NUMBER, bare } from '../audio/quran';
import { DUAS, resolveDua } from './duas';
import HADITH from './hadith.json';

export interface AyahRef {
  surah: number;
  from: number;
  to?: number;
  key: string;
}

export const AYAT: AyahRef[] = [
  { surah: 2, from: 152, key: 'فاذكروني' },
  { surah: 2, from: 153, key: 'بالصبر' },
  { surah: 2, from: 186, key: 'قريب' },
  { surah: 3, from: 139, key: 'تهنوا' },
  { surah: 3, from: 159, key: 'فتوكل' },
  { surah: 3, from: 200, key: 'اصبروا' },
  { surah: 7, from: 56, key: 'المحسنين' },
  { surah: 8, from: 2, key: 'وجلت' },
  { surah: 9, from: 51, key: 'يصيبنا' },
  { surah: 12, from: 87, key: 'روح' },
  { surah: 13, from: 28, key: 'تطمئن' },
  { surah: 14, from: 7, key: 'شكرتم' },
  { surah: 15, from: 49, key: 'الغفور' },
  { surah: 16, from: 97, key: 'طيبة' },
  { surah: 16, from: 128, key: 'اتقوا' },
  { surah: 17, from: 9, key: 'أقوم' },
  { surah: 17, from: 82, key: 'شفاء' },
  { surah: 18, from: 46, key: 'زينة' },
  { surah: 20, from: 14, key: 'لذكري' },
  { surah: 20, from: 46, key: 'أسمع' },
  { surah: 25, from: 63, key: 'هونا' },
  { surah: 29, from: 45, key: 'تنهى' },
  { surah: 29, from: 69, key: 'سبلنا' },
  { surah: 33, from: 41, to: 42, key: 'ذكرا' },
  { surah: 33, from: 56, key: 'يصلون' },
  { surah: 39, from: 10, key: 'حساب' },
  { surah: 39, from: 53, key: 'تقنطوا' },
  { surah: 40, from: 60, key: 'ادعوني' },
  { surah: 41, from: 30, key: 'ربنا' },
  { surah: 47, from: 7, key: 'ينصركم' },
  { surah: 49, from: 13, key: 'لتعارفوا' },
  { surah: 50, from: 16, key: 'الوريد' },
  { surah: 55, from: 60, key: 'جزاء' },
  { surah: 64, from: 11, key: 'يهد' },
  { surah: 93, from: 5, key: 'يعطيك' },
  { surah: 94, from: 5, to: 6, key: 'يسرا' },
];

export interface AmbientItem {
  kind: 'ayah' | 'dua' | 'hadith';
  text: string;
  /** Under the text: sūrah and verse, or the hadith's source. */
  ref: string;
  /** For the play button (Qur'anic items). */
  surah?: number;
  verses?: number[];
}

const AR = '٠١٢٣٤٥٦٧٨٩';
const ar = (n: number) => String(n).replace(/\d/g, (c) => AR[Number(c)]);

export function resolveAyah(r: AyahRef): AmbientItem | null {
  const s = SURAH_BY_NUMBER[r.surah];
  const vs = s?.verses.filter((v) => v.kufi !== null && v.kufi >= r.from && v.kufi <= (r.to ?? r.from)) ?? [];
  if (!s || !vs.length) return null;
  const text = vs.map((v) => v.words.join(' ')).join(' ۝ ');
  if (!bare(text).includes(bare(r.key))) return null;
  const name = s.name.replace(/^سُورَةُ\s*/, '');
  return { kind: 'ayah', text, ref: `${name} · ${vs.length === 1 ? ar(vs[0].basri) : `${ar(vs[0].basri)}–${ar(vs[vs.length - 1].basri)}`}`, surah: s.number, verses: vs.map((v) => v.basri) };
}

/** Everything the screen can show, in a fixed order (the screen shuffles it per session). */
export function ambientItems(): AmbientItem[] {
  const ayat = AYAT.map(resolveAyah).filter(Boolean) as AmbientItem[];
  const duas = DUAS.map(resolveDua).filter((d) => d && d.text.split(' ').length <= 40).map((d) => ({ kind: 'dua' as const, text: d!.text, ref: `${d!.surahName.replace(/^سُورَةُ\s*/, '')} · ${ar(d!.verses[0])}`, surah: d!.ref.surah, verses: d!.verses }));
  const hadith = Object.values(HADITH as Record<string, { text: string; source: string }>).filter((h) => h.text.length <= 190).map((h) => ({ kind: 'hadith' as const, text: h.text, ref: h.source }));
  return [...ayat, ...duas, ...hadith];
}

/** A shuffled order that never shows two hadith in a row and leads with an āyah. */
export function playlist(items: AmbientItem[], seed = Date.now()): AmbientItem[] {
  let x = seed % 2147483647 || 1;
  const rnd = () => (x = (x * 48271) % 2147483647) / 2147483647;
  const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const quran = shuffle(items.filter((i) => i.kind !== 'hadith'));
  const hadith = shuffle(items.filter((i) => i.kind === 'hadith'));
  const out: AmbientItem[] = [];
  let h = 0;
  quran.forEach((q, i) => { out.push(q); if (i % 3 === 2 && h < hadith.length) out.push(hadith[h++]); });
  return out;
}

export type Phase = 'dawn' | 'day' | 'afternoon' | 'dusk' | 'night';

/** The sky to paint: from the prayer times when a place is set, else from the clock. */
export function phaseAt(now: Date, t: Record<string, Date> | null): Phase {
  if (t) {
    const n = now.getTime();
    if (n < t.fajr.getTime()) return 'night';
    if (n < t.sunrise.getTime() + 25 * 60000) return 'dawn';
    if (n < t.asr.getTime()) return 'day';
    if (n < t.maghrib.getTime() - 20 * 60000) return 'afternoon';
    if (n < t.isha.getTime()) return 'dusk';
    return 'night';
  }
  const h = now.getHours();
  return h < 5 ? 'night' : h < 7 ? 'dawn' : h < 15 ? 'day' : h < 18 ? 'afternoon' : h < 20 ? 'dusk' : 'night';
}
