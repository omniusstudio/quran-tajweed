// The list of short clips the owner's teacher records (PROMPT.md §6): isolated letters, each
// letter with each vowel, minimal pairs, and every lesson example's target word. File names are
// fixed so the app can find them; the recorder page walks through this list.

import { ARTICULATIONS, CONTRAST_PAIRS } from '../viewer/articulations';
import { SECTIONS } from './lessons';

export interface ClipSpec {
  /** Storage key and file name without extension, e.g. letters/qaf_fatha. */
  id: string;
  /** What the teacher should say, in Arabic. */
  prompt: string;
  /** Group label for the recorder page. */
  group: string;
  /** Extra instruction, if any. */
  note?: string;
}

const VOWELS: { id: string; mark: string; name: string }[] = [
  { id: 'fatha', mark: 'َ', name: 'بالفتحة' },
  { id: 'damma', mark: 'ُ', name: 'بالضمة' },
  { id: 'kasra', mark: 'ِ', name: 'بالكسرة' },
];

const LETTERS = ARTICULATIONS.filter((a) => !a.wrong && a.group !== 'jawf' && a.letters.length === 1 && /[ء-ي]/.test(a.letters));
const MADD: { id: string; prompt: string; note: string }[] = [
  { id: 'alif_madd', prompt: 'بَا', note: 'مد الألف بعد فتحة (حركتان)' },
  { id: 'waw_madd', prompt: 'بُو', note: 'مد الواو بعد ضمة (حركتان)' },
  { id: 'ya_madd', prompt: 'بِي', note: 'مد الياء بعد كسرة (حركتان)' },
];

function buildManifest(): ClipSpec[] {
  const out: ClipSpec[] = [];
  for (const a of LETTERS) {
    out.push({ id: `letters/${a.id}`, prompt: `اِ${a.letters}ْ`, group: 'الحروف منفردة (ساكنة بعد همزة)', note: a.nameAr });
  }
  for (const a of LETTERS) {
    for (const v of VOWELS) out.push({ id: `letters/${a.id}_${v.id}`, prompt: `${a.letters}${v.mark}`, group: 'الحروف مع الحركات', note: `${a.nameAr} ${v.name}` });
  }
  for (const m of MADD) out.push({ id: `letters/${m.id}`, prompt: m.prompt, group: 'حروف المد', note: m.note });
  for (const p of CONTRAST_PAIRS) {
    out.push({ id: `pairs/${p.id}`, prompt: p.title, group: 'الأزواج المتشابهة (الأول ثم الثاني)', note: p.note });
  }
  for (const s of SECTIONS) {
    for (const r of s.rules) {
      r.examples.forEach((ex, i) => {
        const words = ex.hit.map((h) => ex.words[h]).join(' ');
        out.push({ id: `examples/${r.id}_${i + 1}`, prompt: words, group: `أمثلة القواعد — ${s.title}`, note: `${r.name} — ${ex.surahName} ${ex.basri}` });
      });
    }
  }
  return out;
}

export const CLIP_MANIFEST: ClipSpec[] = buildManifest();
export const CLIP_GROUPS: string[] = Array.from(new Set(CLIP_MANIFEST.map((c) => c.group)));
