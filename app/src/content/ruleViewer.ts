// Which articulations / contrast pairs the viewer should show next to a lesson rule.

export interface RuleViewer {
  letters?: string[];
  contrast?: string;
}

export const RULE_VIEWER: Record<string, RuleViewer> = {
  s2r5: { letters: ['alif_madd', 'waw_madd', 'ya_madd'] },
  s2r6: { letters: ['ghunnah_nun', 'ghunnah_mim'] },
  s2r11: { contrast: 'heavy_light' },
  s2r13: { contrast: 'alif_imalah' },
  s3r1: { letters: ['hamza', 'ha', 'ain', 'hha', 'ghain', 'kha'] },
  s3r2: { letters: ['qaf', 'kaf'], contrast: 'kaf_qaf' },
  s3r3: { letters: ['jim', 'shin', 'ya'] },
  s3r4: { letters: ['dad'], contrast: 'dal_dad' },
  s3r5: { letters: ['lam', 'nun', 'ra', 'ra_wrong'] },
  s3r6: { letters: ['ta', 'dal', 'tta'], contrast: 'ta_tta' },
  s3r7: { letters: ['sin', 'zay', 'sad'], contrast: 'sin_sad' },
  s3r8: { letters: ['tha', 'dhal', 'zha'], contrast: 'dhal_zha' },
  s3r9: { letters: ['fa', 'ba', 'mim', 'waw'] },
  s3r10: { letters: ['alif_madd', 'waw_madd', 'ya_madd', 'ghunnah_nun'] },
  s4r1: { letters: ['fatha', 'damma', 'kasra'] },
  s4r2: { contrast: 'alif_imalah' },
  s5r1: { letters: ['heavy', 'light'], contrast: 'heavy_light' },
  s5r2: { contrast: 'ra_light_heavy' },
  s5r3: { contrast: 'lam_allah' },
  s11r1: { letters: ['imalah', 'alif_plain'], contrast: 'alif_imalah' },
};

/** Exercises that practise a lesson rule (sections 6–13). */
export const LESSON_EXERCISE: Record<string, { label: string; hash: string }[]> = {
  s6r1: [{ label: 'ماذا يحدث لهذه النون؟', hash: '#/exercises/nun' }, { label: 'أين الإظهار؟', hash: '#/exercises/spot/izhar' }],
  s6r2: [{ label: 'ماذا يحدث لهذه النون؟', hash: '#/exercises/nun' }, { label: 'أين الإدغام؟', hash: '#/exercises/spot/idgham_ghunnah' }],
  s6r3: [{ label: 'ماذا يحدث لهذه النون؟', hash: '#/exercises/nun' }, { label: 'أين الإقلاب؟', hash: '#/exercises/spot/iqlab' }],
  s6r4: [{ label: 'ماذا يحدث لهذه النون؟', hash: '#/exercises/nun' }, { label: 'أين الإخفاء؟', hash: '#/exercises/spot/ikhfa' }],
  s6r5: [{ label: 'ماذا يحدث لهذه النون؟', hash: '#/exercises/nun' }],
  s7r1: [{ label: 'أين إخفاء الميم؟', hash: '#/exercises/spot/mim_ikhfa' }],
  s7r2: [{ label: 'أين إدغام الميم؟', hash: '#/exercises/spot/mim_idgham' }],
  s7r3: [{ label: 'أين إظهار الميم؟', hash: '#/exercises/spot/mim_izhar' }],
  s8r1: [{ label: 'أين الغنة؟', hash: '#/exercises/spot/ghunnah' }],
  s8r2: [{ label: 'أين القلقلة؟', hash: '#/exercises/spot/qalqalah' }],
  s9r1: [{ label: 'كم حركة؟', hash: '#/exercises/madd' }],
  s9r2: [{ label: 'كم حركة؟', hash: '#/exercises/madd' }, { label: 'أين المد المنفصل؟', hash: '#/exercises/spot/madd_munfasil' }],
  s9r3: [{ label: 'كم حركة؟', hash: '#/exercises/madd' }, { label: 'أين المد المتصل؟', hash: '#/exercises/spot/madd_muttasil' }],
  s9r4: [{ label: 'كم حركة؟', hash: '#/exercises/madd' }],
  s9r5: [{ label: 'أين المد العارض؟', hash: '#/exercises/spot/madd_arid' }],
  s10r1: [{ label: 'الدوري وحفص', hash: '#/exercises/duri' }],
  s10r2: [{ label: 'الدوري وحفص', hash: '#/exercises/duri' }],
  s10r3: [{ label: 'الدوري وحفص', hash: '#/exercises/duri' }],
  s10r5: [{ label: 'الدوري وحفص', hash: '#/exercises/duri' }],
  s11r1: [{ label: 'إمالة أم لا؟', hash: '#/exercises/imalah' }],
  s11r2: [{ label: 'إمالة أم لا؟', hash: '#/exercises/imalah' }, { label: 'أين الإمالة؟', hash: '#/exercises/spot/imalah' }],
  s11r3: [{ label: 'إمالة أم لا؟', hash: '#/exercises/imalah' }],
  s11r4: [{ label: 'إمالة أم لا؟', hash: '#/exercises/imalah' }],
  s11r5: [{ label: 'إمالة أم لا؟', hash: '#/exercises/imalah' }],
  s12r1: [{ label: 'الدوري وحفص', hash: '#/exercises/duri' }],
  s12r2: [{ label: 'الدوري وحفص', hash: '#/exercises/duri' }],
  s12r3: [{ label: 'الدوري وحفص', hash: '#/exercises/duri' }],
  s12r6: [{ label: 'الدوري وحفص', hash: '#/exercises/duri' }],
  s3r7: [{ label: 'اسمع واختر: س / ص', hash: '#/exercises/listen' }],
  s3r6: [{ label: 'اسمع واختر: ت / ط', hash: '#/exercises/listen' }],
  s3r2: [{ label: 'اسمع واختر: ك / ق', hash: '#/exercises/listen' }, { label: 'تمرين المرآة', hash: '#/exercises/mirror' }],
  s3r8: [{ label: 'اسمع واختر: ذ / ظ', hash: '#/exercises/listen' }, { label: 'تمرين المرآة', hash: '#/exercises/mirror' }],
};
