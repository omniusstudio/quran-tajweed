// Kashida: the stroke the calligrapher lengthens to fill a line. A word can take it between two
// joined letters; the print prefers the join before the last letter. Combining marks stay on
// their letter (the stroke goes after them), and the لا ligature is never split.

const NON_JOINING = new Set('اأإآٱدذرزوؤةىءٲٳ');
const MARK = /[ً-ٰٟۖ-ۭؐ-ؚ࣓-ࣿ]/;
const LETTER = /[ء-يٱ-ۓ]/;

/** Index at which a kashida can be inserted into `word`, or -1 (prefers the join before the final letter). */
export function kashidaPoint(word: string): number {
  const letters: { ch: string; end: number }[] = [];
  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    if (LETTER.test(ch)) letters.push({ ch, end: i + 1 });
    else if (MARK.test(ch) && letters.length) letters[letters.length - 1].end = i + 1;
  }
  if (letters.length < 3) return -1; // particles like ما and في keep their shape
  for (let k = letters.length - 2; k >= 0; k--) {
    const a = letters[k], b = letters[k + 1];
    if (NON_JOINING.has(a.ch)) continue;
    if (a.ch === 'ل' && 'اأإآٱ'.includes(b.ch)) continue;
    return a.end;
  }
  return -1;
}

export function withKashida(word: string, n: number): string {
  if (n <= 0) return word;
  const at = kashidaPoint(word);
  return at < 0 ? word : word.slice(0, at) + 'ـ'.repeat(n) + word.slice(at);
}

/**
 * How many strokes each word of a line should take so the words, at their natural widths, fill
 * `lineWidth`: the slack is shared by the words that can take a kashida, longest words first,
 * at most `maxPerWord` strokes each. Returns one count per word (0 where none).
 */
export function planKashida(words: { text: string; width: number }[], lineWidth: number, strokeWidth: number, gap: number, maxPerWord = 6): number[] {
  const counts = words.map(() => 0);
  const natural = words.reduce((n, w) => n + w.width, 0) + gap * Math.max(0, words.length - 1);
  let slack = lineWidth - natural;
  if (slack <= strokeWidth || strokeWidth <= 0) return counts;
  const able = words.map((w, i) => ({ i, len: w.text.replace(/[^ء-يٱ-ۓ]/g, '').length })).filter((x) => kashidaPoint(words[x.i].text) >= 0 && x.len >= 3); // particles like ما and في keep their shape
  if (!able.length) return counts;
  // leave a little of the slack for the gaps, as the print does
  let strokes = Math.floor((slack * 0.82) / strokeWidth);
  // a sparse line (few words able to take a stroke) gets longer strokes, as the print does
  maxPerWord = Math.min(16, Math.max(maxPerWord, Math.ceil(strokes / able.length)));
  const order = [...able].sort((a, b) => b.len - a.len);
  while (strokes > 0) {
    let placed = false;
    for (const x of order) {
      if (strokes <= 0) break;
      if (counts[x.i] >= maxPerWord) continue;
      counts[x.i]++; strokes--; placed = true;
    }
    if (!placed) break;
  }
  return counts;
}
