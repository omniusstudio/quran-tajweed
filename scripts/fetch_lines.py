#!/usr/bin/env python3
"""The 15-line Madani page layout: which line of its page every word sits on.

    python3 scripts/fetch_lines.py        # caches data/mushaf_lines/<page>.json, updates mushaf.json

Source: Quran.com's API v4 (mushaf 2 = the Madani 15-line muṣḥaf), one request per page, cached.
Every Kūfī ayah's words come back with a line number. They are matched to the Dūrī words of the
same ayah (the Kūfī marks of kufi_marks.py partition the Dūrī text by Kūfī ayah); when the word
counts differ (a handful of ayahs: Dūrī and Ḥafṣ sometimes join or split a word), the lines are
spread over the Dūrī words in proportion. Each Baṣrī verse gets `lines`: [[line, words], …] in
reading order. Run after kufi_marks.py.
"""
import json, time, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / 'data' / 'mushaf_lines'
MUSHAF = ROOT / 'app' / 'src' / 'content' / 'mushaf.json'
URL = 'https://api.quran.com/api/v4/verses/by_page/{}?words=true&word_fields=line_number&mushaf=2&per_page=50'


def page(p):
    CACHE.mkdir(parents=True, exist_ok=True)
    f = CACHE / f'{p:03d}.json'
    if not f.exists():
        req = urllib.request.Request(URL.format(p), headers={'User-Agent': 'nutq-tajweed/1.0'})
        f.write_bytes(urllib.request.urlopen(req, timeout=30).read())
        time.sleep(0.15)
    return json.load(open(f, encoding='utf-8'))['verses']


def main():
    data = json.load(open(MUSHAF, encoding='utf-8'))
    # line numbers per Kūfī ayah, from every page
    ayah_lines = {}
    for p in range(1, 605):
        for v in page(p):
            ayah_lines[v['verse_key']] = [w['line_number'] for w in v['words'] if w['char_type_name'] == 'word']
        if p % 100 == 0: print('fetched', p)
    uneven = 0
    for s in data['surahs']:
        n = s['number']
        # the Dūrī word stream partitioned by Kūfī ayah (words up to each Kūfī mark)
        stream = [(vi, wi) for vi, v in enumerate(s['verses']) for wi in range(len(v['words']))]
        marks = []
        pos = 0
        for vi, v in enumerate(s['verses']):
            for after, k in sorted(v['kufiEnds']):
                marks.append((pos + after, k))
            pos += len(v['words'])
        start = 0
        per_word = [None] * len(stream)
        for end, k in marks:
            src = ayah_lines.get(f'{n}:{k}', [])
            cnt = end - start
            if len(src) == cnt:
                lines = src
            else:
                uneven += 1
                lines = [src[min(len(src) - 1, int(i * len(src) / cnt))] for i in range(cnt)] if src else []
            for i in range(cnt): per_word[start + i] = lines[i] if i < len(lines) else (lines[-1] if lines else None)
            start = end
        # run-length per Baṣrī verse
        idx = 0
        for v in s['verses']:
            runs = []
            for wi in range(len(v['words'])):
                ln = per_word[idx]; idx += 1
                if runs and runs[-1][0] == ln: runs[-1][1] += 1
                else: runs.append([ln, 1])
            v['lines'] = runs
    json.dump(data, open(MUSHAF, 'w', encoding='utf-8'), ensure_ascii=False)
    print(f'lines written; {uneven} ayahs had a different word count and were spread in proportion')


if __name__ == '__main__':
    main()
