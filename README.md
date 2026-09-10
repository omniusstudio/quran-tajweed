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

### Running it as an app (Mac Dock + phone)

From the Terminal, once (and again after changing the code):

```sh
bash scripts/install_app.sh      # or: cd app && npm run install-app
```

It builds the app and copies `app/dist`, `app/server` and the recordings to
`~/Library/Application Support/nutq`, installs a launchd agent
`com.omniusstudio.nutq` that runs `server/serve.mjs` from there whenever you are
logged in, and puts the launcher `نُطق.app` in `~/Applications`. Drag that to the
Dock: opening it makes sure the server is up and opens http://localhost:7373/ in
its own Chrome window (or brings the open one to the front).

Why the copy: the repo lives on an external drive, and macOS does not let a
Dock-launched app or a launchd agent read a removable volume without a per-app
grant, so the served files live in the home folder (the app then also works with
the drive unplugged).

A phone on the same Wi-Fi can open it too: **Settings → على هاتفك** shows the
address and a QR code. The address is the Mac's Bonjour name
(`<computer-name>.local`, read at run time, so the same installer works on any
Mac and the link survives a new DHCP lease); the numeric address is shown as a
fallback for a phone that cannot resolve `.local` names. Two ports are served:

| Port | Use |
|---|---|
| 7373 (http) | What the QR code opens: Mac and phone, no warnings; the phone's microphone stays off (browsers only allow it on https) |
| 7374 (https, self-signed certificate made on first run) | Optional, for record-and-compare on the phone; accept the certificate warning once |

Progress, the exercise deck, settings and saved alignments are shared between
every device that opens the app through this server: the server keeps
`state.json` in the app folder, each device pulls it on open and when the window
comes back, and pushes after every change; both sides merge with
`app/server/merge.mjs` (done steps are a union, daily points take the higher
count, a card keeps the copy answered more often, settings and alignments follow
the latest change). Recordings (record-and-compare takes and teacher clips) are
shared the same way through `/__clips`, and the chosen reciter and the last sūrah
opened travel with the settings.

Away from home, the safe route is a private network between your devices, not a
port opened on the internet (the app has no password and holds your progress and
recordings). Install Tailscale on the Mac and the phone with the same account,
run `tailscale serve --bg 7373` once on the Mac, and Settings → خارج شبكة البيت
shows a real https address that works anywhere (microphone included, no
certificate warning). The server detects Tailscale and its serve status itself.

On the phone, "Add to Home Screen" gives it an icon and a full-screen window.
Logs: `~/Library/Logs/nutq.log` (server) and `nutq-launcher.log`. Without the
launcher, `cd app && npm start` builds and serves the same thing from the repo.

### Verse of the day and the memorization challenge

- **آية اليوم** on the home page is a drill: hear the verse, echo it (verse → beep →
  you), hide the text and record yourself, then switch between the reciter and you.
- **تحدي الحفظ اليومي** (`#/hifz`, `app/src/content/hifz.ts`): five whole verses a
  day, never split across sūrahs, in the khalwa's order (al-Fātiḥah, then an-Nās
  backwards through the muṣḥaf). Steps: listen, echo, recite from memory with
  the text hidden (recorded), compare, then the learner decides "حفظتها" (the app
  never grades). Memorized runs come back for a recall after 1, 3, 7, 14 and 30
  days. State lives in the progress store and syncs between devices.
- Both need verse boundaries in the recording. `scripts/segment_verses.py`
  writes them for every cached sūrah of a reciter: the istiʿādhah and basmalah
  are found by matching against al-Fātiḥah's hand-aligned ones, verse ends are
  placed by letter proportion within each breath group and snapped to a nearby
  pause; words are spread proportionally. Files are flagged `auto` and
  `source: auto-verses` (يُراجع in the app) and never overwrite one placed by
  hand (`source: hand`). Word alignment stays manual, as the brief asks.

### The daily wird

`#/wird` (`app/src/content/wird.ts`): a reading habit on the muṣḥaf's own
divisions. Every verse in the bundle carries its juzʾ, ḥizb quarter (1–240) and
page, derived from the Ḥafṣ metadata by the verse's share of the sūrah's text.
The portion is the next quarter / half / ḥizb / juzʾ from wherever the reader is
(never calendar-bound; Ramadan mode = a juzʾ a day). Reading it in the page and
tapping "قرأت حتى هنا" on a verse number, or listening along in follow-along,
both advance it; "أتممت الورد" jumps to the end. The day's portion earns 5
points, a finished juzʾ and a khatm are celebrated, the khatm date is projected
from the pace, the streak forgives one missed day (two in a row end it), and an
optional local reminder fires at a chosen time while the app is open. State
syncs between devices (the reader further ahead sets the position).

### Daily supplication card

At the top of the home page: a Qur'anic duʿāʾ (one verse or a few), a new one each
day from `app/src/content/duas.ts`, which holds references only (sūrah, Kūfī verse
range, a key word) resolved against the bundled muṣḥaf; the test checks every
reference lands on verses containing its key word. Playable in the reciter's
voice, opens in follow-along, closable for the day.

### Interface (`app/src/ui/`)

- `settings.ts`: local preferences (theme system/light/dark, interface sounds, haptics,
  Qur'an text size, reduced motion, daily goal) applied through `data-theme`,
  `data-motion` and `--quran-scale` on the root element. Settings page at `#/settings`.
- `sound.ts`: interface cues synthesised with Web Audio (tap, toggle, right, wrong,
  complete, fanfare). They never stand in for Qur'anic sounds.
- `icons.tsx`: one SVG icon set (24 px, 2 px round strokes); no emoji or font glyphs as controls.
- `celebrate.tsx` + `rewards.ts`: `content/progress.ts` keeps a per-day activity log
  (lesson = 3 points, drill or recording = 2, answer = 1). Finishing a step, a
  section, the daily goal, a streak milestone or a run of right answers shows a
  short overlay (confetti only for the big ones and only when motion is not reduced).
- `styles.css`: tokens (colour, radius, shadow, motion), light and dark palettes,
  the shell (bottom navigation on phones, inline navigation on wide screens, a
  "more" sheet for tools), and the components. The home page (`#/`) shows today's
  goal ring, the streak, the last seven days and progress by section.

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
| `scripts/extract_mushaf.py` | Builds the app's muṣḥaf bundle from `duri.json`: all 114 sūrahs with Ḥafṣ word alignment (`app/src/content/mushaf.json`; `--v1` for the first-release subset) |
| `scripts/hafs_align.py` | Word alignment between a Dūrī verse and its Ḥafṣ verse (shared by both scripts) |
| `scripts/fetch_audio.py` | Build-time cache of the Dūrī sūrah recordings (`app/public/audio`, git-ignored) |
| `app/src/rules/tagger.ts` | The rule tagger: pure function over the muṣḥaf notation → rule spans (nūn/tanwīn, mīm, ghunnah, qalqalah, madd lengths, imālah, tas-hīl, isqāṭ, Dūrī idghāms, farsh, waqf) |
| `app/src/rules/tagger.test.ts` | Every lesson example in sections 6–13 must receive the rule its lesson teaches |
| `app/src/exercises/` | Exercise bank generated by the tagger from the whole muṣḥaf, plus the Leitner scheduler |
| `app/src/audio/` | Player (pitch-preserving slow playback), alignment store, peaks/silence detection, recordings store, zip writer |
| `app/src/pages/` | Lessons, dictionary, letters, contrast pairs, follow-along, alignment editor, teacher recorder, exercises, checklist |

### Audio (M3)

- `npm run audio` (`scripts/fetch_audio.py`) downloads the Dūrī per-sūrah MP3s
  for al-Fātiḥah + juzʾ ʿAmma from mp3quran.net into `app/public/audio/`
  (git-ignored, never hot-linked); `--surahs all` fetches the whole muṣḥaf
  (about 1.1 GB per reciter). The local server also fetches any missing sūrah
  the first time it is played and keeps it, so all 114 sūrahs are playable
  without a full pre-fetch (`scripts/install_app.sh --all-audio` pre-fetches
  everything for the default reciter). Reciters and credits are in
  `app/src/content/reciters.json`; the default voice is Noreen Mohammad Siddiq.
- **المتابعة** (`#/follow/1`): the verse text in Scheherazade New with words
  highlighted in sync with the recording, 0.5×/0.75×/1× with pitch preserved,
  echo mode (word → pause → beep → repeat), tap a word to loop it and open its
  letters in the viewer, a madd ticker and ghunnah indicator driven by the
  muṣḥaf's own marks (approximate until the M4 rule tagger), and per-verse
  record-and-compare (teacher / me, waveform thumbnails, loop) stored in
  IndexedDB.
- Follow-along keeps a bookmark (a ribbon on the verse): it moves to wherever
  you stop, or stays put once pinned by hand from the verse's "علامة" button.
  The home page's المتابعة tile reopens that exact verse (`#/follow/<sūrah>/<verse>`),
  synced across devices. Each sūrah's position is remembered too, and the big
  play button continues from that verse; every verse has its own play button;
  a switch at the top chooses continuous play or stopping at the end of each
  verse (the next tap plays the next verse). Both live in the settings.
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
- Every example verse in the lessons, the reference and the drills is played by
  the reciter (the whole verse; the learner finds the word in it), so no teacher
  recording is needed for examples. Word-level playback (listen-and-pick, the
  madd word) uses only hand-placed word boundaries; elsewhere the verse is played.
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
