// Map a muṣḥaf character to the articulation shown for it in the viewer.
export const LETTER_TO_ARTICULATION: Record<string, string> = {
  ء: 'hamza', أ: 'hamza', إ: 'hamza', آ: 'hamza', ؤ: 'hamza', ئ: 'hamza',
  ا: 'alif_madd', ٱ: 'alif_madd', ى: 'alif_madd',
  ب: 'ba', ت: 'ta', ث: 'tha', ج: 'jim', ح: 'hha', خ: 'kha', د: 'dal', ذ: 'dhal', ر: 'ra', ز: 'zay',
  س: 'sin', ش: 'shin', ص: 'sad', ض: 'dad', ط: 'tta', ظ: 'zha', ع: 'ain', غ: 'ghain', ف: 'fa',
  ق: 'qaf', ك: 'kaf', ل: 'lam', م: 'mim', ن: 'nun', ه: 'ha', ة: 'ha', و: 'waw', ي: 'ya',
};

/** Distinct letters of a word that have an articulation, in order of appearance. */
export function lettersOf(word: string): { ch: string; id: string }[] {
  const out: { ch: string; id: string }[] = [];
  const seen = new Set<string>();
  for (const ch of word) {
    const id = LETTER_TO_ARTICULATION[ch];
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push({ ch, id });
    }
  }
  return out;
}
