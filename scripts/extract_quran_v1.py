#!/usr/bin/env python3
"""Trim data/duri.json to the v1 sūrahs (al-Fātiḥah + juzʾ ʿAmma) for the follow-along mode.

Output app/src/content/duri_v1.json:
  { "surahs": [ { "number": 1, "name": "...", "header": "بِسۡمِ ...", "verses": [ { "basri": 1, "text": "...", "words": [...] } ] } ] }

The muṣḥaf text is copied verbatim (imālah rhombus U+06EA, tas-hīl U+06EC, small letters and
all). Only al-Fātiḥah carries a title + basmalah entry numbered 1 in duri.json; it is split off
as `header` so the numbered verses stay Baṣrī.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DURI = json.load(open(ROOT / 'data' / 'duri.json', encoding='utf-8'))
Q = json.load(open(ROOT / 'data' / 'quran.json', encoding='utf-8'))['data']
NAMES = {s['number']: s['name'] for s in Q['surahs']}
CFG = json.load(open(ROOT / 'app' / 'src' / 'content' / 'reciters.json', encoding='utf-8'))

out = {'surahs': []}
for n in CFG['v1Surahs']:
    entries = DURI[str(n)]
    header = None
    verses = []
    seen = set()
    for num, text in entries:
        if text.startswith('سُورَةُ') and num == 1 and 1 not in seen:
            header = text.split(' ', 2)[2] if text.count(' ') >= 2 else text  # drop "سُورَةُ الفَاتِحَةِ"
            continue
        seen.add(num)
        verses.append({'basri': num, 'text': text, 'words': text.split()})
    out['surahs'].append({'number': n, 'name': NAMES[n], 'header': header, 'verses': verses})

dst = ROOT / 'app' / 'src' / 'content' / 'duri_v1.json'
json.dump(out, open(dst, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
nv = sum(len(s['verses']) for s in out['surahs'])
print(f'OK: {len(out["surahs"])} sūrahs, {nv} verses -> {dst.relative_to(ROOT)} ({dst.stat().st_size // 1024} KB)')
