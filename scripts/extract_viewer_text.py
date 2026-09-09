#!/usr/bin/env python3
"""Content pipeline (M1/M2 seed): convert content_beginner.py -> app/src/content/lessons.json.

Every example is resolved against duri.json by surah + Basri verse + normalised word
match. The script exits non-zero if any target word is not found in the cited verse,
so the app build cannot ship an unverified example.
"""
import json, sys, unicodedata, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'data'
sys.path.insert(0, str(DATA))

from content_beginner import SECTIONS  # noqa: E402
sys.path.insert(0, str(Path(__file__).resolve().parent))
from hafs_align import align_words, hafs_words  # noqa: E402

Q = json.load(open(DATA / 'quran.json', encoding='utf-8'))['data']
SUR = {s['number']: s for s in Q['surahs']}
DURI = {int(k): v for k, v in json.load(open(DATA / 'duri.json', encoding='utf-8')).items()}

# --- identical to data/build_beginner.py::norm (keep in sync) ---
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

def kufi_number(s, dtext):
    dset = set(norm(w) for w in dtext.split())
    best, bn = 0, None
    for a in SUR[s]['ayahs']:
        hs = set(norm(w) for w in a['text'].replace('﻿', '').split())
        ov = len(dset & hs) / max(1, len(dset | hs))
        if ov > best: best, bn = ov, a['numberInSurah']
    return bn

MISSES = []

def resolve(s, num, targets):
    tn = [norm(t) for t in targets]
    cands = []
    for vn, t in DURI[s]:
        words = t.split(); nw = [norm(w) for w in words]
        if all(x in nw for x in tn):
            cands.append((abs(vn - num), vn, words, nw))
    if not cands:
        MISSES.append(f'NOT FOUND in Duri {s}:{num}: {targets}')
        return None
    _, vn, words, nw = sorted(cands)[0]
    hit = [i for i, w in enumerate(nw) if w in tn]
    kufi = kufi_number(s, ' '.join(words))
    # the next verse's first word matters for rules that cross the verse boundary when continuing
    nxt = next((t for n2, t in DURI[s] if n2 == vn + 1), None)
    return {
        'surah': s, 'surahName': SUR[s]['name'], 'basri': vn,
        'kufi': kufi,
        'words': words, 'hit': hit, 'targets': targets,
        'hafs': align_words(words, hafs_words(s, kufi) if kufi else []),
        'nextWord': nxt.split()[0] if nxt else None,
    }

IMG_RE = re.compile(r"<img src='[^']*/([^/']+)\.png'/>")

def fig_to_json(f):
    svg, caption = f
    m = IMG_RE.search(svg)
    return {'img': m.group(1) if m else None, 'caption': caption}

out = {'sections': []}
n = 0
for si, sec in enumerate(SECTIONS, 1):
    rules = []
    for ri, r in enumerate(sec['rules'], 1):
        ex = []
        for (s, v, t) in r['examples']:
            n += 1
            e = resolve(s, v, t)
            if e: ex.append(e)
        rules.append({
            'id': f's{si}r{ri}', 'name': r['name'], 'text': r['text'],
            'figures': [fig_to_json(f) for f in r.get('figures', [])],
            'examples': ex,
        })
    out['sections'].append({'id': f's{si}', 'title': sec['title'], 'intro': sec.get('intro'), 'rules': rules})

if MISSES:
    print('\n'.join(MISSES), file=sys.stderr)
    print(f'FAILED: {len(MISSES)} of {n} examples not found', file=sys.stderr)
    sys.exit(1)

dst = ROOT / 'app' / 'src' / 'content' / 'lessons.json'
dst.parent.mkdir(parents=True, exist_ok=True)
json.dump(out, open(dst, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'OK: {n} examples verified -> {dst.relative_to(ROOT)}')
