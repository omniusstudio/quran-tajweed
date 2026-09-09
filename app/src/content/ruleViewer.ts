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
