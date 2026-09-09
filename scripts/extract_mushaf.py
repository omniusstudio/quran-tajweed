#!/usr/bin/env python3
"""Build the app's muṣḥaf bundle from data/duri.json: all 114 sūrahs by default, or only the v1
sūrahs (al-Fātiḥah + juzʾ ʿAmma, `--v1`) as the first release shipped.

Output app/src/content/mushaf.json:
  { "surahs": [ { "number": 1, "name": "...", "header": "بِسۡمِ ...",
      "verses": [ { "basri": 1, "kufi": 2, "words": [...], "hafs": [Ḥafṣ word or null per word] } ] } ] }

The muṣḥaf text is copied verbatim (imālah rhombus U+06EA, tas-hīl U+06EC, small letters and
all). Only al-Fātiḥah carries a title + basmalah entry numbered 1 in duri.json; it is split off
as `header` so the numbered verses stay Baṣrī; every other sūrah except at-Tawbah gets the same
basmalah as its header, since the reciters read it and the alignment editor aligns it separately.
"""
import json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from hafs_align import align_words, hafs_words, kufi_number  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DURI = json.load(open(ROOT / 'data' / 'duri.json', encoding='utf-8'))
Q = json.load(open(ROOT / 'data' / 'quran.json', encoding='utf-8'))['data']
NAMES = {s['number']: s['name'] for s in Q['surahs']}
CFG = json.load(open(ROOT / 'app' / 'src' / 'content' / 'reciters.json', encoding='utf-8'))

ALL = '--v1' not in sys.argv
numbers = sorted(int(k) for k in DURI) if ALL else CFG['v1Surahs']
BASMALAH = None
out = {'surahs': []}
for n in numbers:
    entries = DURI[str(n)]
    header = None
    verses = []
    seen = set()
    for num, text in entries:
        if text.startswith('سُورَةُ') and num == 1 and 1 not in seen:
            header = text.split(' ', 2)[2] if text.count(' ') >= 2 else text  # drop "سُورَةُ الفَاتِحَةِ"
            BASMALAH = header
            continue
        seen.add(num)
        words = text.split()
        kufi = kufi_number(n, text)
        # `words` is the verse (join with spaces); the full string is not repeated to keep the bundle small
        verses.append({'basri': num, 'kufi': kufi, 'words': words, 'hafs': align_words(words, hafs_words(n, kufi) if kufi else [])})
    if header is None and n != 9 and BASMALAH:
        header = BASMALAH
    out['surahs'].append({'number': n, 'name': NAMES[n], 'header': header, 'verses': verses})

dst = ROOT / 'app' / 'src' / 'content' / 'mushaf.json'
json.dump(out, open(dst, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
nv = sum(len(s['verses']) for s in out['surahs'])
print(f'OK: {len(out["surahs"])} sūrahs, {nv} verses -> {dst.relative_to(ROOT)} ({dst.stat().st_size // 1024} KB)')
