import data from './duri_ref.json';
import type { Rule, Section } from './lessons';

/** The technical Dūrī-vs-Ḥafṣ reference (content_duri.py), same shape as the lessons. */
export const REF_SECTIONS: Section[] = data.sections as Section[];
export const REF_RULES: Record<string, Rule> = Object.fromEntries(REF_SECTIONS.flatMap((s) => s.rules.map((r) => [r.id, r])));
