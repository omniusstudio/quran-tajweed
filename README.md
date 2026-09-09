# نطق — Tajweed follow-along app (Dūrī ʿan Abī ʿAmr)

Source bundle for an interactive app that shows learners how each Arabic letter
and tajweed rule is produced (tongue, lips, jaw, airflow, timing) in the
riwāyah of al-Dūrī ʿan Abī ʿAmr, the reading taught in Sudan.

See `PROMPT.md` for the full project brief, milestones and quality bars.

## Layout

| Path | Contents |
|---|---|
| `PROMPT.md` | Project brief (audience, viewer spec, audio, exercises, architecture, milestones) |
| `data/duri.json` | Dūrī muṣḥaf text, 114 sūrahs, Baṣrī numbering, with imālah/tas-hīl marks |
| `data/quran.json` | Ḥafṣ ʿan ʿĀṣim Uthmani text (AlQuran.cloud), Kūfī numbering |
| `data/content_beginner.py` | Beginner curriculum (14 sections, 128 verified examples) — the lesson script |
| `data/content_duri.py` | Dūrī vs Ḥafṣ reference (uṣūl + farsh, 75 examples) |
| `data/content_ar.py`, `data/content.py` | General tajweed rules, Arabic and English |
| `data/diagrams.py` | Parameterised articulation SVG generator (side/top/lips) |
| `data/build*.py` | PDF builders; contain `norm()` word matching and Baṣrī→Kūfī mapping |
| `images/` | Approved base illustrations (A/B/C sets) and `annotated/` versions |
| `fonts/` | Amiri Quran, Amiri, Scheherazade New, Noto Sans Arabic (SIL OFL) |
| `pdf/` | Generated reference books (general rules, Dūrī reference, beginner book) |

## The app (`app/`)

Vite + React + TypeScript, SVG only, no backend. Milestone 1 (the Articulation
Viewer) is in place: three synchronised views (side, lips, top), a keyframe
engine, all 28 letters plus vowels, heavy/light, ghunnah and imālah, "this, not
that" contrast pairs, and a dev checklist route.

The viewer is built on the approved artwork in `images/`: `scripts/trace_artwork.py`
segments the tongue out of every A- and B-image and the lips, opening, teeth and
tongue out of every C-image, resamples each outline to a fixed number of points,
reads the contact dots off the annotated images, and writes clean raster
backgrounds (tongue, uvula and lips removed) plus `app/src/viewer/artwork.json`.
The animation morphs those traced outlines over the real drawings; the jaw
crossfades between the closed (A01), half-open (A15) and open (A14) heads.

```sh
cd app
npm install
npm run content   # content_beginner.py -> src/content/lessons.json (fails on any unverified example)
npm run trace     # images/ -> src/viewer/artwork.json + src/assets/art/*.png (needs numpy, opencv-python-headless)
npm run dev       # http://localhost:5173
npm test          # keyframe engine + anatomical plausibility tests
npm run build     # typecheck + production build in app/dist
```

Fonts and reference images are imported from the repo's `fonts/` and `images/`
folders directly; nothing is duplicated inside `app/`.

All five milestones are in place: lesson screens for all 14 sections with
local progress and a dictionary; follow-along recitation with word highlighting,
echo mode and record-and-compare; the alignment editor and teacher recorder; the
rule tagger over the muṣḥaf's own notation; seven exercises with Leitner
repetition; the Dūrī polish drills (watch → hear slow → hear normal → record →
compare); the Dūrī-vs-Ḥafṣ reference from `content_duri.py`; offline PWA
(app shell, fonts, artwork and content precached, recordings cached on first
play); and the release checklist at `#/checklist`. See PROMPT.md §10.

### Notation the tagger reads (data/duri.json)

| Mark | Meaning in this text |
|---|---|
| U+06E1 | sukūn (iẓhār on ن/م, qalqalah on ق ط ب ج د) |
| bare ن / م before another word | idghām, iqlāb (with the small mīm) or ikhfāʾ, decided by the next letter |
| U+064B–064D vs U+0657 / 065E / 0656 | plain tanwīn = iẓhār; sequential tanwīn = idghām / ikhfāʾ |
| U+06E2 small high mīm | iqlāb |
| U+0653 madd sign, U+0670 dagger alif | madd; muttaṣil / munfaṣil / lāzim by context |
| U+06EA rhombus below | imālah |
| U+06ED small low mīm under ذوات الياء | taqlīl (بين بين) — the beginner content says these words have a plain alif, so the app tags it "يُراجع" and keeps it out of the imālah exercise |
| U+06EC on a word-initial alif / on a later alif | hamzat al-waṣl / tas-hīl; U+06DF after a dagger alif on a word-initial hamzah = tas-hīl with idkhāl |
| U+06E6 small yāʾ, U+06E5 small wāw | ياء زائدة (Dūrī) / ṣilah of hāʾ |
| Ḥafṣ comparison | isqāṭ (a hamzah Dūrī drops), the sakt Dūrī does not make, farsh words |

| Path | Contents |
|---|---|
| `app/src/viewer/artwork.ts` | Typed access to the traced artwork: tongue shapes (traced + derived blends), landmarks, airflow paths |
| `scripts/trace_artwork.py` | Traces `images/` into contours, marks and clean backgrounds |
| `app/src/viewer/types.ts` | Articulatory state model (`Keyframe`, `Articulation`, `ViewState`) |
| `app/src/viewer/engine.ts` | Interpolates keyframes into a `ViewState` for any time t |
| `app/src/viewer/articulations.ts` | The catalogue: every letter/vowel/feature as keyframes, plus contrast pairs |
| `app/src/viewer/*View.tsx` | Side, lips and top SVG views; `ArticulationViewer` combines them with indicators |
| `app/src/viewer/engine.test.ts` | Tests, including the guard that keeps the morphing tongue inside the envelope the artwork draws |
| `scripts/extract_viewer_text.py` | Content pipeline: resolves every example against `duri.json`, adds the Ḥafṣ counterpart per word |
| `scripts/extract_quran_v1.py` | Trims `duri.json` to the v1 sūrahs with Ḥafṣ word alignment (`app/src/content/duri_v1.json`) |
| `scripts/hafs_align.py` | Word alignment between a Dūrī verse and its Ḥafṣ verse (shared by both scripts) |
| `scripts/fetch_audio.py` | Build-time cache of the Dūrī sūrah recordings (`app/public/audio`, git-ignored) |
| `app/src/rules/tagger.ts` | The rule tagger: pure function over the muṣḥaf notation → rule spans (nūn/tanwīn, mīm, ghunnah, qalqalah, madd lengths, imālah, tas-hīl, isqāṭ, Dūrī idghāms, farsh, waqf) |
| `app/src/rules/tagger.test.ts` | Every lesson example in sections 6–13 must receive the rule its lesson teaches |
| `app/src/exercises/` | Exercise bank generated by the tagger from the v1 text, plus the Leitner scheduler |
| `app/src/audio/` | Player (pitch-preserving slow playback), alignment store, peaks/silence detection, recordings store, zip writer |
| `app/src/pages/` | Lessons, dictionary, letters, contrast pairs, follow-along, alignment editor, teacher recorder, exercises, checklist |

### Audio (M3)

- `npm run audio` (`scripts/fetch_audio.py`) downloads the Dūrī per-sūrah MP3s
  for v1 (al-Fātiḥah + juzʾ ʿAmma) from mp3quran.net into `app/public/audio/`
  (git-ignored, never hot-linked). Reciters and credits are in
  `app/src/content/reciters.json`; the default voice is Noreen Mohammad Siddiq.
- **المتابعة** (`#/follow/1`): the verse text in Scheherazade New with words
  highlighted in sync with the recording, 0.5×/0.75×/1× with pitch preserved,
  echo mode (word → pause → beep → repeat), tap a word to loop it and open its
  letters in the viewer, a madd ticker and ghunnah indicator driven by the
  muṣḥaf's own marks (approximate until the M4 rule tagger), and per-verse
  record-and-compare (teacher / me, waveform thumbnails, loop) stored in
  IndexedDB.
- **المحاذاة** (`#/align/1`): the alignment editor. Waveform + zoom strip, Enter
  marks the next boundary at the playhead, silence detection proposes verse
  boundaries (one extra leading segment is taken as the istiʿādhah and kept
  out of the highlighting), proportional word spread as a starting point, save
  to the browser, export/import JSON keyed by sūrah / Baṣrī verse / word index.
  Put a finished export at `app/src/content/alignments/<reciter>/<NNN>.json` to
  ship it; the export keeps an `auto` flag until "✓ راجعتُ الحدود بالسماع" is
  pressed, and the follow-along page shows a يُراجع notice while it is set.
  Shipped so far: `nourin_siddig/001.json` (al-Fātiḥah; verse boundaries from
  the recording's pauses, word boundaries placed from its energy/frication
  profile — still to be confirmed by ear, hence flagged).
- **تسجيل المعلم** (`#/recorder`): walks the teacher through the clip manifest
  (letters alone and with each vowel, madd letters, minimal pairs, every lesson
  example) and exports all takes as a zip with the fixed file names.
  Optional since the listen-and-pick exercise (اسمع واختر) plays two real words
  from the reciter's recording (one with each letter of a confusable pair, chosen
  from the muṣḥaf text of aligned sūrahs) and asks which one has the named
  letter; only the bare letters and vowels for section 3 still want a teacher's
  voice, and the viewer and drills cover those with the mouth and real words.

## Verifying the content

Every example in the curriculum must be found programmatically in `duri.json`
by sūrah + verse + normalised word match. The builders in `data/` enforce this
(`MISSES` must be empty).
