// Exports what the native ticker needs from the web app's own sources, so the two never drift:
// the muṣḥaf text with its tajwīd colours already worked out (src/rules/colors.ts), the verse
// numbering, and the pages. Run from app/:  npx vite-node ../mac/tools/export_data.ts <out.json>
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { SURAHS } from '../../app/src/audio/quran';
import { TONES, colourVerse } from '../../app/src/rules/colors';

const out = process.argv[2];
if (!out) throw new Error('usage: export_data.ts <out.json>');

const surahs = SURAHS.map((s) => ({
  n: s.number,
  name: s.name,
  header: s.header,
  headerKufi: s.headerKufi ?? null,
  kufiCount: s.kufiCount ?? s.verses.length,
  verses: s.verses.map((v, i) => {
    const prev = s.verses[i - 1];
    const next = s.verses[i + 1];
    const pieces = colourVerse(v.words, v.hafs, next?.words[0] ?? null, v.words, prev ? { words: prev.words, hafs: prev.hafs } : undefined);
    return {
      b: v.basri,
      k: v.kufi ?? v.basri,
      p: v.page ?? 0,
      // each word: its coloured pieces, [text] or [text, tone]
      w: pieces.map((ps) => ps.map((p) => (p.tone ? [p.text, p.tone] : [p.text]))),
      // Kūfī verse-end markers inside the verse: [words before the marker, number]
      e: v.kufiEnds && v.kufiEnds.length ? v.kufiEnds : [[v.words.length, v.kufi ?? v.basri]],
    };
  }),
}));

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ tones: Object.fromEntries(TONES.map((t) => [t.id, t.color])), surahs }));
console.log(`wrote ${out}: ${surahs.length} sūrahs, ${surahs.reduce((n, s) => n + s.verses.length, 0)} verses`);
