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

## Verifying the content

Every example in the curriculum must be found programmatically in `duri.json`
by sūrah + verse + normalised word match. The builders in `data/` enforce this
(`MISSES` must be empty).
