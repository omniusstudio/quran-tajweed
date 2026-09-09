// The plain dictionary (section 2 of content_beginner.py) as look-up terms, and a helper that
// links the first use of each term inside a lesson text (PROMPT.md §9: a term appears bold with
// its definition the first time; afterwards it can be a link back to the dictionary).

import { SECTIONS, type Rule } from './lessons';

export interface Term {
  /** Dictionary rule that defines the term. */
  ruleId: string;
  /** The display name of the entry. */
  name: string;
  /** Stems matched inside lesson text (without the definite article). */
  stems: string[];
}

const DICTIONARY_SECTION = SECTIONS.find((s) => s.id === 's2')!;

/** Hand-picked stems per dictionary entry (rule names contain more than one term in places). */
const STEMS: Record<string, string[]> = {
  s2r1: ['فتحة', 'ضمة', 'كسرة', 'حركة'],
  s2r2: ['سكون', 'ساكن'],
  s2r3: ['شدة', 'مشدد'],
  s2r4: ['تنوين'],
  s2r5: ['مد'],
  s2r6: ['غنة'],
  s2r7: ['إظهار'],
  s2r8: ['إدغام'],
  s2r9: ['إخفاء'],
  s2r10: ['إقلاب'],
  s2r11: ['تفخيم', 'ترقيق', 'مفخم', 'مرقق'],
  s2r12: ['همزة', 'تسهيل'],
  s2r13: ['إمالة', 'ممال'],
  s2r14: ['مخرج', 'مخارج'],
};

export const TERMS: Term[] = DICTIONARY_SECTION.rules.map((r) => ({ ruleId: r.id, name: r.name, stems: STEMS[r.id] ?? [r.name] }));
export const DICTIONARY_RULES: Rule[] = DICTIONARY_SECTION.rules;

export interface TextPart {
  text: string;
  termRuleId?: string;
}

/**
 * Split a text into plain parts and linked parts: the first occurrence of each term (any stem,
 * with or without the article / a prefix letter) becomes a link. The dictionary's own entry is skipped.
 */
export function linkTerms(text: string, skipRuleId?: string): TextPart[] {
  const hits: { start: number; end: number; ruleId: string }[] = [];
  const taken: boolean[] = new Array(text.length).fill(false);
  for (const term of TERMS) {
    if (term.ruleId === skipRuleId) continue;
    let best: { start: number; end: number } | null = null;
    for (const stem of term.stems) {
      // stem preceded by start / space / bracket and an optional prefix (ال, بال, وال, لل, و, ف, ب, ك)
      const re = new RegExp(`(^|[\\s(«])((?:و|ف|ب|ك|ل)?(?:ال|لل)?${stem}[\\u064B-\\u0652]*[^\\s،.:؛)»]*)`, 'u');
      const m = re.exec(text);
      if (!m) continue;
      const start = m.index + m[1].length;
      const end = start + m[2].length;
      if (!best || start < best.start) best = { start, end };
    }
    if (best && !taken.slice(best.start, best.end).some(Boolean)) {
      hits.push({ ...best, ruleId: term.ruleId });
      for (let i = best.start; i < best.end; i++) taken[i] = true;
    }
  }
  hits.sort((a, b) => a.start - b.start);
  const parts: TextPart[] = [];
  let pos = 0;
  for (const h of hits) {
    if (h.start > pos) parts.push({ text: text.slice(pos, h.start) });
    parts.push({ text: text.slice(h.start, h.end), termRuleId: h.ruleId });
    pos = h.end;
  }
  if (pos < text.length) parts.push({ text: text.slice(pos) });
  return parts;
}
