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

| Path | Contents |
|---|---|
| `app/src/viewer/artwork.ts` | Typed access to the traced artwork: tongue shapes (traced + derived blends), landmarks, airflow paths |
| `scripts/trace_artwork.py` | Traces `images/` into contours, marks and clean backgrounds |
| `app/src/viewer/types.ts` | Articulatory state model (`Keyframe`, `Articulation`, `ViewState`) |
| `app/src/viewer/engine.ts` | Interpolates keyframes into a `ViewState` for any time t |
| `app/src/viewer/articulations.ts` | The catalogue: every letter/vowel/feature as keyframes, plus contrast pairs |
| `app/src/viewer/*View.tsx` | Side, lips and top SVG views; `ArticulationViewer` combines them with indicators |
| `app/src/viewer/engine.test.ts` | Tests, including the guard that keeps the morphing tongue inside the envelope the artwork draws |
| `scripts/extract_viewer_text.py` | Content pipeline seed: resolves every example against `duri.json` |

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
  boundaries, proportional word spread as a starting point, save to the
  browser, export/import JSON keyed by sūrah / Baṣrī verse / word index. Put a
  finished export at `app/src/content/alignments/<reciter>/<NNN>.json` to ship it.
- **تسجيل المعلم** (`#/recorder`): walks the teacher through the clip manifest
  (letters alone and with each vowel, madd letters, minimal pairs, every lesson
  example) and exports all takes as a zip with the fixed file names.

## Verifying the content

Every example in the curriculum must be found programmatically in `duri.json`
by sūrah + verse + normalised word match. The builders in `data/` enforce this
(`MISSES` must be empty).
