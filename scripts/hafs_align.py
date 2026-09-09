"""Word-level alignment between a Dūrī verse and its Ḥafṣ (Uthmani) counterpart.

Used by the content scripts so the app can show "how Ḥafṣ reads this word" and so the rule
tagger can detect isqāṭ (a hamzah Dūrī drops), the sakt Dūrī does not make, and farsh words.
Shared `norm` with data/build_beginner.py (keep in sync).
"""
import difflib, json, unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
_Q = json.load(open(ROOT / 'data' / 'quran.json', encoding='utf-8'))['data']
SUR = {s['number']: s for s in _Q['surahs']}

STRIP = (set(range(0x0610, 0x061B)) | set(range(0x064B, 0x0660)) | set(range(0x06D6, 0x06EE))
         | {0x0670, 0x0640, 0x06E5, 0x06E6, 0x0653, 0x0654, 0x0655, 0x08F0, 0x08F1, 0x08F2})


def norm(w):
    out = []
    for ch in w:
        o = ord(ch)
        if o in STRIP or unicodedata.category(ch) == 'Mn' or ch == '۞':
            continue
        if ch in 'ٱأإآ': ch = 'ا'
        if ch == 'ى' or ch == 'ئ': ch = 'ي'
        if ch == 'ؤ': ch = 'و'
        out.append(ch)
    return ''.join(out)


def hafs_words(surah, kufi):
    """Ḥafṣ words; standalone mark tokens (the sakt sign ۜ, waqf signs) are folded into the word before them."""
    a = next((a for a in SUR[surah]['ayahs'] if a['numberInSurah'] == kufi), None)
    if not a:
        return []
    out = []
    for tok in a['text'].replace('﻿', '').split():
        if out and all(unicodedata.category(c) != 'Lo' for c in tok):
            out[-1] += tok
        else:
            out.append(tok)
    return out


def kufi_number(surah, dtext):
    dset = set(norm(w) for w in dtext.split())
    best, bn = 0, None
    for a in SUR[surah]['ayahs']:
        hs = set(norm(w) for w in a['text'].replace('﻿', '').split())
        ov = len(dset & hs) / max(1, len(dset | hs))
        if ov > best:
            best, bn = ov, a['numberInSurah']
    return bn


def align_words(duri_words, hafs):
    """For each Dūrī word, the Ḥafṣ word it corresponds to (or None when the split differs)."""
    a = [norm(w) for w in duri_words]
    b = [norm(w) for w in hafs]
    out = [None] * len(duri_words)
    sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == 'equal' or (tag == 'replace' and i2 - i1 == j2 - j1):
            for k in range(i2 - i1):
                out[i1 + k] = hafs[j1 + k]
    return out
