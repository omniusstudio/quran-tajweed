#!/usr/bin/env python3
"""Per-verse (and per-word) timings of a Ḥafṣ recitation from quran.com, used only as a rhythm
prior when placing Dūrī verse boundaries (scripts/segment_verses.py): how long each verse takes
relative to the others carries the madd and the cadence that letter counts miss.

    python3 scripts/fetch_timings.py            # Mishari al-ʿAfasy (recitation 7) → data/timings_hafs.json
"""
import json, sys, time, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'data' / 'timings_hafs.json'
RECITATION = int(sys.argv[1]) if len(sys.argv) > 1 else 7

data = json.load(open(OUT, encoding='utf-8')) if OUT.exists() else {}
for n in range(1, 115):
    if str(n) in data:
        continue
    url = f'https://api.quran.com/api/v4/chapter_recitations/{RECITATION}/{n}?segments=true'
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'nutq-tajweed/1.0'}), timeout=60) as r:
                j = json.load(r)
            break
        except Exception as e:  # noqa: BLE001
            print(f'{n}: retry {attempt + 1}: {e}', file=sys.stderr)
            time.sleep(2)
    else:
        print(f'{n}: failed', file=sys.stderr)
        continue
    ts = j['audio_file'].get('timestamps') or []
    data[str(n)] = [{'ayah': int(t['verse_key'].split(':')[1]), 'from': t['timestamp_from'], 'to': t['timestamp_to'], 'words': [[w[1], w[2]] for w in (t.get('segments') or []) if len(w) >= 3]} for t in ts]
    print(f'{n}: {len(ts)} ayahs')
    json.dump(data, open(OUT, 'w', encoding='utf-8'), separators=(',', ':'))
print(f'OK: {len(data)} sūrahs -> {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)')
