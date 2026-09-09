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

```sh
cd app
npm install
npm run content   # content_beginner.py -> src/content/lessons.json (fails on any unverified example)
npm run dev       # http://localhost:5173
npm test          # keyframe engine + anatomical plausibility tests
npm run build     # typecheck + production build in app/dist
```

Fonts and reference images are imported from the repo's `fonts/` and `images/`
folders directly; nothing is duplicated inside `app/`.

| Path | Contents |
|---|---|
| `app/src/viewer/geometry.ts` | Port of `diagrams.py`: head outline, tongue shapes, Catmull-Rom helpers, landmarks |
| `app/src/viewer/types.ts` | Articulatory state model (`Keyframe`, `Articulation`, `ViewState`) |
| `app/src/viewer/engine.ts` | Interpolates keyframes into a `ViewState` for any time t |
| `app/src/viewer/articulations.ts` | The catalogue: every letter/vowel/feature as keyframes, plus contrast pairs |
| `app/src/viewer/*View.tsx` | Side, lips and top SVG views; `ArticulationViewer` combines them with indicators |
| `app/src/viewer/engine.test.ts` | Tests, including the tongue-never-passes-through-the-palate guard |
| `scripts/extract_viewer_text.py` | Content pipeline seed: resolves every example against `duri.json` |

## Verifying the content

Every example in the curriculum must be found programmatically in `duri.json`
by sūrah + verse + normalised word match. The builders in `data/` enforce this
(`MISSES` must be empty).
