# Project brief: "نطق" — an interactive follow-along app for learning Qur'anic pronunciation (Tajweed) in the riwāyah of al-Dūrī ʿan Abī ʿAmr (the Sudanese reading)

You are building a teaching app whose single job is to make a learner **see and hear exactly how each Arabic letter and each tajweed rule is produced — tongue, lips, jaw, airflow, timing — and then imitate it**. The app does **not** listen to or grade the user. It demonstrates, breaks down, and lets the user follow along and self-compare.

Read this whole brief before writing code. Everything in the `data/` folder is verified and must be treated as the source of truth; never type Qur'anic text by hand or from memory.

---

## 1. Who it is for

- Adults and teenagers who **do not know tajweed terminology at all**. Assume the user does not know what إدغام or إظهار means. Every term is introduced in plain Arabic with a one-line definition and an example before it is ever used as a label.
- Primary audience: Sudanese learners (and the Sudanese diaspora) learning the **Dūrī ʿan Abī ʿAmr** reading, which is what the Sudanese khalāwī teach. A secondary mode for Ḥafṣ ʿan ʿĀṣim is welcome but is not the priority (the rule data for both is provided).
- UI language: **Arabic, RTL, first-class**. English is optional as a secondary UI language; the Qur'anic text and rule names are always Arabic.
- Devices: phones first (portrait), then tablets/desktop. Must work well on low-end Android in a browser and offline after first load (PWA).

## 2. What "done" looks like (product outcome)

A learner with zero background can open the app, go through the lessons in order, and by the end:
1. Knows where every one of the 28 letters is produced, and can *feel* it in their own mouth because the app showed them the tongue/lip position from three views with an animated transition into and out of the position.
2. Knows the small set of rules that govern how letters change next to each other (nūn/tanwīn, mīm, ghunnah, qalqalah, madd lengths, heavy/light) and can spot them on a real page of the muṣḥaf.
3. Can produce the features that make the Dūrī reading sound the way it does — imālah, tas-hīl with idkhāl, the extra idghāms, the fatḥah on ياء المتكلم, the short munfaṣil — because each one has a dedicated "watch the mouth → hear it slow → hear it normal → record yourself → compare" drill.
4. Can recite al-Fātiḥah and the short sūrahs (an-Nās → ad-Ḍuḥā) in Dūrī with the app's word-by-word follow-along.

## 3. Non-goals (do not build)

- No speech recognition, scoring, or "you said it wrong" feedback. (If you want to leave a clean interface for a future grader, fine, but do not implement one.)
- No accounts, no server-side state, no social features. Local storage only.
- No tafsīr, translation, or memorization scheduling beyond what is needed for the exercises.
- Do not generate, invent, or "correct" Qur'anic text. Do not paraphrase rules from memory when the provided content files already state them.

## 4. Provided assets (in `data/`) — use these, do not re-derive

| File | What it is | How to use it |
|---|---|---|
| `duri.json` | Full Dūrī ʿan Abī ʿAmr muṣḥaf text, 114 sūrahs, **Baṣrī verse numbering** (6,204 verses). Format: `{ "2": [[verse_number, "text"], ...] }`. The text carries the Dūrī muṣḥaf's own notation: imālah rhombus (U+06EA) under the imāled letter, tas-hīl dot (U+06EC), small alif for idkhāl, hamzah omitted from script where it is dropped (إسقاط), sukūn as U+06E1, small yāʾ/wāw for ṣilah and ياءات الزوائد. | **This is the text you display for Dūrī.** Render with the Amiri Quran font (provided) so the marks show. Do not normalise away the marks. |
| `quran.json` | Ḥafṣ ʿan ʿĀṣim Uthmani text (quran-uthmani edition, Kūfī numbering, 6,236 verses), from AlQuran.cloud. | Text for the optional Ḥafṣ mode, and for showing "how Ḥafṣ reads this word" comparisons. Verse numbers differ from `duri.json`; map by word-overlap (see `build_duri.py::kufi_number`). |
| `content_beginner.py` | The beginner curriculum, in Arabic, written for someone who knows nothing: 14 sections, every term defined before use, ~128 verified examples, each example = `(surah, basri_verse, [target words])`. Includes which diagram goes with which rule. | **This is your lesson script.** Convert it to JSON and build the lesson screens from it. Do not rewrite the pedagogy; you may split long texts into steps. |
| `content_duri.py` | The full, more technical statement of what Dūrī does differently from Ḥafṣ (uṣūl + farsh), 75 verified examples. | Source for the "Dūrī vs Ḥafṣ" reference screens and the advanced drills. |
| `content_ar.py`, `content.py` | Complete general tajweed rules (Ḥafṣ-based), Arabic and English, 262 verified examples on Ḥafṣ text. | Reference material; use for the Ḥafṣ mode and for rule definitions. |
| `diagrams.py` | Python that generates the articulation SVGs: a parameterised side-view head (`TOP` dict of tongue-surface control points per articulation state, `FLOOR`, `smooth_path`), front-view lips (`lips(kind)`), top-view tongue (`tongue_top(highlight)`). | **Port this to the front end (TypeScript/SVG) and animate it.** The `TOP` control points are your keyframes; interpolate between them. |
| `build_*.py` | The PDF builders. Contain the word-matching/normalisation code (`norm`) that strips diacritics to match bare words, and the Baṣrī→Kūfī verse mapping. | Reuse `norm` for locating target words inside verses. |
| `fonts/` | Amiri Quran, Amiri Regular/Bold (SIL OFL). | Scheherazade New for all Qur'anic text (renders every muṣḥaf mark, clearer than Amiri Quran); Noto Sans Arabic for UI text — both tested, both in fonts/. |
| `pdf/` | The three generated books (general rules, Dūrī reference, beginner book with diagrams). | For your own understanding of the material and as the in-app "reference" section if you want to embed them. |

**Verification rule (must implement):** every example the app shows must be located programmatically in `duri.json` (or `quran.json` for Ḥafṣ mode) by sūrah + verse + normalised word match. Fail the build if any example's target words are not found in the cited verse. The Python builders already do this; keep the guarantee.

## 5. The core experience: the Articulation Viewer

This is the heart of the app. Spend most of your effort here.

### 5.1 Three synchronised views
1. **Side view (sagittal)** — the head cut down the middle, facing left, exactly as in `diagrams.py`: nose, nasal cavity, upper/lower teeth, molars, hard palate, soft palate + uvula, pharynx wall, vocal folds, tongue, jaw. Tongue is a filled shape whose top surface is a smooth curve through control points.
2. **Front view (lips)** — lip shape, jaw opening, teeth visibility: closed (ب م), rounded (و, ḍammah), teeth-on-lip (ف), open (fatḥah), narrow (imālah), spread (kasrah).
3. **Top view (tongue in the dental arch)** — which part of the tongue is active: tip, front edge, sides (ض), middle, back.

All three must animate **together** from a rest state into the letter's position and back, with a scrub bar and a play/pause. Provide 0.25×, 0.5×, 1× speeds. Show the contact point (red dot) only during the contact phase; show airflow arrows (oral/nasal/narrow-channel) during the release phase.

### 5.2 Articulatory state model
Define each letter as a **sequence of keyframes** `{ t, tongueTop: [[x,y],...], lips: kind, jaw: 0..1, velum: "open"|"closed", contact?: [x,y], airflow?: "oral"|"nasal"|"channel", heavy: bool }`. Interpolate control points linearly (or with easing) between keyframes; the SVG re-renders each frame. Start from the states in `diagrams.py::TOP` and add what's missing (ك vs ق, ج vs ش, ر flap, ل lateral).

The 17 makhārij groups you must cover, with what the viewer must make visually obvious:
- Jawf (ا و ي as madd): no contact; the airflow arrow travels the length of the cavity; the *duration* is the lesson — show a harakah counter (2/4/6) ticking.
- Throat ×3 (ء هـ / ع ح / غ خ): tongue at rest; highlight the constriction *height* in the throat moving up across the three pairs.
- Back tongue: ق (soft palate) vs ك (hard/soft boundary) — animate the 1 cm difference.
- Middle tongue: ج (contact + release), ش (channel, spread airflow), ي.
- Side of tongue: ض — the side view cannot show it; the top view must, with the edge glowing against the upper molars, and an optional "istiṭālah" arrow along the edge.
- Tip → gum: ل (lateral airflow, front edge), ن (velum open, nasal arrow), ر (single flap — animate one tap, and show the *wrong* version, multiple trills, greyed with a ✗).
- Tip → roots of upper teeth: ط د ت — identical tongue tip; ط differs only by the raised back (heavy). Show the two side views side-by-side.
- Tip → lower teeth, narrow channel: ص س ز (whistle); ص = س + raised back.
- Tip between teeth: ظ ذ ث — the tip must visibly protrude.
- Lips: ف (teeth on lower lip), ب/م (closed; م with nasal arrow), و (rounded).
- Khayshūm: ghunnah — velum open, nasal arrow, with the 2-harakah timer.

### 5.3 Contrast pairs ("this, not that")
For every pair learners confuse, a split-screen with both animations playing in sync, and audio A/B: س/ص، ت/ط، د/ض، ذ/ظ، ك/ق، ه/ح، ء/ع، ز/ظ، ج/ش. Also: heavy vs light ر, ل of الله heavy vs light, and — crucial for Dūrī — **plain alif vs imāled alif** (front of tongue raised, jaw narrower).

### 5.4 Real-mouth video (strongly recommended, optional to ship v1)
Allow a "teacher video" per letter/rule: a short clip (front and 3/4 profile) of a qualified Dūrī teacher's mouth, 3–5 s, played next to the diagram. Ship the slots and a simple JSON manifest; the owner will supply the videos. Do not source videos from the internet.

## 6. Audio

- **Reference audio for verses — use the mp3quran.net public API (free, no key):** `https://www.mp3quran.net/api/v3/reciters?language=eng` lists reciters; filter `moshaf[].name` containing `Aldori A'n Abi Amr`. Four complete Dūrī muṣḥafs are available as per-sūrah MP3s named `001.mp3`…`114.mp3` under each `server` URL (all verified to serve `audio/mpeg`):
  - **Noreen Mohammad Siddiq (نورين محمد صديق, Sudanese) — DEFAULT voice:** `https://server16.mp3quran.net/nourin_siddig/Rewayat-Aldori-A-n-Abi-Amr/`
  - **Alfateh Alzubair (الفاتح الزبير, Sudanese):** `https://server6.mp3quran.net/fateh/`
  - **Mahmoud Khalil Al-Hussary — "slow/clear" voice for beginners:** `https://server13.mp3quran.net/husr/Rewayat-Aldori-A-n-Abi-Amr/`
  - Muftah Alsaltany, Ahmad Deban: in the API.
  Download the needed sūrahs at build time (al-Fātiḥah + juzʾ ʿAmma, sūrahs 1 and 78–114, for v1) and cache them; do not hotlink at runtime. Files are **per sūrah only** — no per-verse or per-word timings exist for Dūrī anywhere — so build the **alignment editor** (waveform, tap to set verse and word boundaries, keyboard shortcuts, export JSON keyed by sūrah/Baṣrī-verse/word-index) and let the owner align once per reciter. Ship with the editor; do not attempt automatic word alignment for Dūrī (Ḥafṣ-trained aligners mislabel exactly the Dūrī-specific segments). Show reciter credit in the UI.
- **Letter/rule audio:** ship a manifest of short clips (isolated letter, letter with each vowel, minimal pairs, each rule example) to be recorded by the owner's teacher. Provide a recorder page that walks the teacher through the manifest and saves clips with the right filenames. Do not use TTS for Qur'anic sounds.
- **Slow playback** must preserve pitch (Web Audio with a time-stretch library such as SoundTouch.js), at 0.5× and 0.75×.
- **Self-record and A/B compare:** record with MediaRecorder, then a two-button player (teacher / me) with instant switching, waveform thumbnails, and a loop-region. No analysis, no scoring — just make comparison effortless.

## 7. Lesson and exercise design

### 7.1 Lesson flow (from `content_beginner.py`)
Each lesson screen = one rule from the content file: plain-language text → diagram/animation (the `figures` already mapped) → 1–3 verse examples with the target word highlighted → "try it" step. Keep screens short (one idea per screen). Progress is saved locally. The 14 sections in order:
1. Before you start · 2. Plain dictionary of terms · 3. Where each letter comes from (with viewer) · 4. Mouth shape for vowels · 5. Heavy/light · 6. Nūn sākinah & tanwīn (the "what letter comes next?" decision) · 7. Mīm sākinah · 8. Ghunnah, shaddah, qalqalah · 9. How long to hold (madd) · 10. Hamzah in Dūrī · 11. Imālah · 12. Other Dūrī differences · 13. Stopping · 14. Al-Fātiḥah walkthrough.

### 7.2 Follow-along recitation mode (the practice loop)
- Verse shown large in Amiri Quran; words highlight in sync with the reference audio (karaoke style).
- Tap any word → mini-panel: which rules apply to this word (computed, see 7.4), the articulation animation for the flagged letter, loop this word.
- **Madd ticker:** while a long vowel plays, show the count (٢ / ٤ / ٦) filling up so the learner internalises duration.
- **Ghunnah indicator:** a nose icon that lights up for the 2 counts of ghunnah.
- Speeds 0.5×/0.75×/1×; "echo mode": play word → pause → beep → user repeats → next word.
- Record-and-compare per verse.

### 7.3 Exercises (no listening required from the app)
1. **Spot the rule:** show a Dūrī verse, ask "أين الإدغام؟" — user taps the word. Generated from the rule tagger (7.4) so it works on any verse.
2. **What happens to this nūn?** show نْ + next letter → 4 buttons (واضحة / تذوب / ميم / خفية). Randomised from real verses.
3. **Listen and pick:** play two teacher clips (e.g. س vs ص in a word) → "which one is ص?" Uses the recorded minimal pairs.
4. **Imālah or not?** show a word with النار / الناس in different cases → yes/no. Checks against the imālah mark present in `duri.json` (U+06EA), so the answer key is the muṣḥaf itself.
5. **Count the madd:** play a word, user taps the count (2/4/6).
6. **Dūrī vs Ḥafṣ:** show the Ḥafṣ form of a farsh word (مَالِكِ / يَخْدَعُونَ / نُنشِزُهَا …) → user picks how Dūrī reads it.
7. **Mirror drill:** viewer plays the letter in slow motion; user holds their phone camera as a mirror (just show the front camera feed next to the diagram — no analysis) and imitates.
Spaced repetition: items answered wrong come back sooner (simple Leitner in localStorage).

### 7.4 Rule tagger (build this; it makes the exercises scale)
A pure function `tagRules(verseText, riwayah)` over the muṣḥaf text that returns spans with rule ids, using the muṣḥaf's own notation as ground truth wherever possible:
- nūn/tanwīn: sukūn present → iẓhār; bare nūn + next letter shaddah → idghām (with/without ghunnah by letter); small mīm → iqlāb; bare nūn otherwise → ikhfāʾ.
- mīm sākinah by next letter; shaddah on ن/م → ghunnah; ق ط ب ج د with sukūn → qalqalah.
- madd: madd sign → muttaṣil/munfaṣil/lāzim by context; long vowel at verse end → ʿāriḍ.
- Dūrī-specific: U+06EA → imālah; U+06EC → tas-hīl; omitted hamzah → isqāṭ; small yāʾ at word end → ياء زائدة; U+06E1 on hamzah/rāʾ in بارئكم/يأمركم → iskān.
Write unit tests against the examples in `content_beginner.py` (each example's target words must receive the rule the lesson teaches).

## 8. Architecture

- **Stack:** Vite + React + TypeScript, SVG for all diagrams (no canvas bitmaps, so it stays crisp and themeable), Zustand or plain context for state, IndexedDB for recordings, Workbox PWA for offline. Tailwind is fine. No backend required; static hosting.
- **Content pipeline:** a Node/Python script converts `content_beginner.py` / `content_duri.py` → `lessons.json`, resolves every example against `duri.json`, precomputes highlight spans and Kūfī numbers, and **fails the build on any mismatch**.
- **Fonts:** self-host Amiri Quran; test that U+06EA/U+06EC/U+06E1 and small letters render (they do in Amiri Quran).
- **RTL:** `dir="rtl"` at the root; mirror the layout; never rely on left/right in CSS (use logical properties).
- **Accessibility:** large type by default (Qur'an text ≥ 28 px on phones), high contrast, all animations pausable, captions for every audio clip.

## 9. Quality bars

- Arabic copy is natural, simple, and free of unexplained jargon. A term appears bold with its definition the first time; afterwards it can be a link back to the dictionary.
- Nothing about a rule is stated that is not in the provided content files. If you need a fact that is not there, leave a `TODO(scholar)` comment and a visible "يُراجع" badge rather than guessing.
- The articulation animations must be reviewed frame-by-frame for anatomical plausibility: tongue never passes through teeth/palate, contact point sits on the actual surface, lips close fully for ب/م, tip visibly protrudes for ث ذ ظ.
- Before "release", produce a checklist page listing every letter, every rule, every Dūrī feature, with ✅/❌ for: animation, teacher audio, example, exercise. Ship with the checklist visible in a dev route.

## 10. Milestones

1. **M1 — Viewer:** port `diagrams.py` to React SVG; keyframe engine; 28 letters + vowels + heavy/light + imālah; scrub/speed. Demo page.
2. **M2 — Content pipeline + lessons:** `lessons.json` with verified examples; lesson screens for sections 1–5; dictionary.
3. **M3 — Audio:** teacher-recording page + manifest; al-Fātiḥah aligned by hand; follow-along mode with word highlight, madd ticker, echo mode, record-and-compare.
4. **M4 — Rules + exercises:** rule tagger with tests; sections 6–13; exercises 1–6; Leitner.
5. **M5 — Dūrī polish:** imālah/tas-hīl/isqāṭ drills; Dūrī vs Ḥafṣ screens; section 14 walkthrough; juzʾ ʿAmma follow-along; PWA/offline; checklist.

Start with M1 and show it before proceeding — the viewer is the product; if it does not make the mouth movement obvious, nothing else matters.

---

## Addendum: reference artwork (in `images/`)

`images/A01–A15`, `B01–B05`, `C01–C05` are the approved base illustrations (side view, top view, lips) — 25 files, consistent style. `images/annotated/` holds the same images with contact dots, airflow arrows and zone rings already drawn on, plus `X01_mouth_map`. Use the annotated set as the static reference images in lessons, and use the base set as the visual target the Articulation Viewer animation should match (trace the tongue outline from each A-image to derive the keyframes instead of relying only on `diagrams.py`). A08 needs a lowered soft palate drawn in the animation (the base image shows the tongue only); A15 shows the front of the tongue raised — keep the back low in the animation.
