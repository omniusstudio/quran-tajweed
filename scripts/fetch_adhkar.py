#!/usr/bin/env python3
"""Morning, evening, sleep and waking adhkār from Ḥiṣn al-Muslim (hisnmuslim.com's public JSON).

    python3 scripts/fetch_adhkar.py      # writes app/src/content/adhkar.json

The wording is kept exactly as published. Each item is split into its body (inside the double
parentheses) and the notes that follow it (the evening variant, the count). Qur'anic items are
replaced by references into the bundled muṣḥaf, so the app shows them in the Dūrī text and can
play them in the reciter's voice.
"""
import json, re, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'app' / 'src' / 'content' / 'adhkar.json'
API = 'https://www.hisnmuslim.com/api/ar/{}.json'
CHAPTERS = {'day': 27, 'sleep': 28, 'waking': 1}
# Qur'anic items by their id in the book: (sūrah, Kūfī from, Kūfī to); a whole sūrah is (n, None, None)
QURAN = {
    75: [(2, 255, 255)], 76: [(112, None, None), (113, None, None), (114, None, None)],
    99: [(112, None, None), (113, None, None), (114, None, None)], 100: [(2, 255, 255)], 101: [(2, 285, 286)],
    110: [(32, None, None), (67, None, None)], 4: [(3, 190, 200)],
}
LINK_ONLY = {110}            # whole long sūrahs: a link to the follow-along page, not inline text
REPEAT_FIX = {83: 7}         # the feed says 1, the text says seven times


def fetch(n):
    req = urllib.request.Request(API.format(n), headers={'User-Agent': 'nutq-tajweed/1.0'})
    d = json.loads(urllib.request.urlopen(req, timeout=30).read().decode('utf-8-sig'))
    return next(iter(d.values()))


def split(text):
    """(body, notes[]) — the dhikr itself and what the book adds after it."""
    t = re.sub(r'\s+', ' ', text).strip()
    m = re.match(r'^\(\((.*?)\)\)\s*\.?\s*(.*)$', t)
    if not m:
        return t.strip('() '), []
    body, rest = m.group(1).strip(), m.group(2).strip()
    if rest and not rest.strip(') .'):      # the body itself ended with a parenthesis: «… (أربعاً وثلاثين)))»
        body, rest = body + ')', ''
    notes = [n.strip(' .') for n in re.findall(r'\[([^\]]*)\]|\(([^()]*(?:\([^()]*\))?[^()]*)\)', rest) for n in n if n.strip(' .')]
    if not notes and rest.strip(' .،'):
        notes = [rest.strip(' .،')]
    return body, notes


def main():
    out = {'source': 'حصن المسلم، سعيد بن علي بن وهف القحطاني — hisnmuslim.com', 'sets': {}}
    for key, chap in CHAPTERS.items():
        items = []
        for it in fetch(chap):
            iid, text = it['ID'], it['ARABIC_TEXT']
            entry = {'id': iid, 'repeat': REPEAT_FIX.get(iid, int(it.get('REPEAT') or 1))}
            if iid in QURAN:
                entry['quran'] = [{'surah': s, **({'from': a, 'to': b} if a else {})} for s, a, b in QURAN[iid]]
                if iid in LINK_ONLY: entry['linkOnly'] = True
                lead = re.match(r'^\(*\s*([^﴿]*?)\s*(?:بسم الله الرحمن الرحيم)?\s*﴿', re.sub(r'\s+', ' ', text))
                if lead and lead.group(1).strip(' :('): entry['lead'] = lead.group(1).strip(' :(')
            else:
                entry['body'], notes = split(text)
                if notes: entry['notes'] = notes
                joined = ' '.join(notes)
                if 'إذا أصبح' in joined and 'أمسى' not in joined: entry['when'] = 'morning'
                elif 'إذا أمسى' in joined and 'وإذا أمسى قال' not in joined: entry['when'] = 'evening'
            items.append(entry)
        out['sets'][key] = items
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print({k: len(v) for k, v in out['sets'].items()}, '→', OUT.relative_to(ROOT))


if __name__ == '__main__':
    main()
