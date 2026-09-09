// The Dūrī polish drills (PROMPT.md §2.3): each feature gets a "watch the mouth → hear it slow →
// hear it normal → record yourself → compare" drill. Texts come from the content files only.

import type { RuleId } from '../rules/tagger';

export interface Drill {
  id: string;
  title: string;
  /** Tagger rules whose instances feed the drill. */
  rules: RuleId[];
  /** Beginner lesson rule that explains it. */
  lesson: string;
  /** Technical reference rule(s). */
  ref: string[];
  /** Viewer: a contrast pair id or a letter id. */
  contrast?: string;
  letter?: string;
  /** Teacher example clips are named examples/<lessonRule>_<n>. */
}

export const DRILLS: Drill[] = [
  { id: 'imalah', title: 'الإمالة', rules: ['imalah'], lesson: 's11r1', ref: ['d7r1', 'd7r4', 'd7r5'], contrast: 'alif_imalah' },
  { id: 'tashil', title: 'التسهيل مع الإدخال', rules: ['tashil'], lesson: 's10r1', ref: ['d5r1', 'd5r2'], letter: 'hamza' },
  { id: 'isqat', title: 'إسقاط الهمزة الأولى', rules: ['isqat'], lesson: 's10r2', ref: ['d5r3'], letter: 'hamza' },
  { id: 'idgham_duri', title: 'إدغام إذ وقد وتاء التأنيث', rules: ['idgham_duri'], lesson: 's12r2', ref: ['d6r2'], letter: 'dal' },
  { id: 'ya_fath', title: 'فتح ياء المتكلم', rules: ['ya_fath'], lesson: 's12r3', ref: ['d8r1'], letter: 'ya' },
  { id: 'munfasil', title: 'قصر المد المنفصل', rules: ['madd_munfasil'], lesson: 's9r2', ref: ['d4r1'], letter: 'alif_madd' },
  { id: 'ya_zaida', title: 'ياءات الزوائد', rules: ['ya_zaida'], lesson: 's12r4', ref: ['d8r2'], letter: 'ya_madd' },
  { id: 'no_sakt', title: 'لا سكت', rules: ['no_sakt'], lesson: 's12r1', ref: ['d6r3'], letter: 'nun' },
  { id: 'ha_damir', title: 'هاء الكناية', rules: ['ha_damir', 'madd_silah'], lesson: 's12r5', ref: ['d3r2', 'd3r3'], letter: 'ha' },
];
