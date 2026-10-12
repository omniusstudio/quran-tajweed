#!/usr/bin/env python3
"""Where the Kūfī verse ends fall inside the Baṣrī verses (for showing Ḥafṣ-style numbering).

    python3 scripts/kufi_marks.py        # updates app/src/content/mushaf.json in place

The muṣḥaf is split by the Baṣrī count (the Dūrī prints). Ḥafṣ muṣḥafs use the Kūfī count, which
ends verses in a few other places (الم is a verse of its own in al-Baqarah; al-Fātiḥah's basmalah
is verse 1; some Baṣrī ends are not Kūfī ends). This aligns the Ḥafṣ text of every Kūfī ayah
(data/quran.json) to the Dūrī words of the sūrah and writes, for each Baṣrī verse, `kufiEnds`:
[[wordsBefore, kufiNumber], …] — a marker after that many words of the verse. It also sets, for
every Baṣrī verse, the `kufi` ayah holding its last word and that ayah's real Madani `page`, `juz`
and ḥizb quarter `q` (so pages turn exactly where the printed muṣḥaf does), and each sūrah's Kūfī
verse count `kufiCount` for the header medallion. Run after extract_mushaf.py.
"""
import difflib, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'scripts'))
from hafs_align import hafs_words, norm  # noqa: E402

MUSHAF = ROOT / 'app' / 'src' / 'content' / 'mushaf.json'
QURAN = {s['number']: s for s in json.load(open(ROOT / 'data' / 'quran.json', encoding='utf-8'))['data']['surahs']}
BASMALAH = ['بسم', 'الله', 'الرحمن', 'الرحيم']


def main():
    data = json.load(open(MUSHAF, encoding='utf-8'))
    inside = shared = 0
    for s in data['surahs']:
        n = s['number']
        duri = [(vi, wi, norm(w)) for vi, v in enumerate(s['verses']) for wi, w in enumerate(v['words'])]
        hafs, ends = [], []           # the Ḥafṣ stream and the index after which each Kūfī ayah ends
        for a in QURAN[n]['ayahs']:
            k = a['numberInSurah']
            ws = [norm(w) for w in hafs_words(n, k)]
            if k == 1 and n != 1 and ws[:4] == BASMALAH: ws = ws[4:]
            if n == 1 and k == 1:
                s['headerKufi'] = 1          # al-Fātiḥah's basmalah is Kūfī verse 1
                continue
            hafs += ws
            ends.append((len(hafs), k))
        sm = difflib.SequenceMatcher(None, [d[2] for d in duri], hafs, autojunk=False)
        # map a Ḥafṣ position to a Dūrī position through the matching blocks
        blocks = sm.get_matching_blocks()
        def to_duri(hpos):
            best = 0
            for a, b, size in blocks:
                if b + size <= hpos: best = a + size + (hpos - (b + size)) if False else a + size
                elif b <= hpos: return a + (hpos - b)
                else: break
            return min(best, len(duri))
        for v in s['verses']: v['kufiEnds'] = []
        s['kufiCount'] = len(QURAN[n]['ayahs'])
        s['revelation'] = 'makki' if QURAN[n]['revelationType'] == 'Meccan' else 'madani'
        ayahs = {a['numberInSurah']: a for a in QURAN[n]['ayahs']}
        # the Kūfī ayah holding each Baṣrī verse's last word → its real page, juzʾ and ḥizb quarter
        cum = 0
        dends = [(hpos, k) for hpos, k in ends]
        for v in s['verses']:
            cum += len(v['words'])
            k = next((k for hpos, k in dends if to_duri(hpos) >= cum), dends[-1][1])
            a = ayahs[k]
            v['kufi'], v['page'], v['juz'], v['q'] = k, a['page'], a['juz'], a['hizbQuarter']
        for hpos, k in ends:
            dpos = to_duri(hpos)                  # number of Dūrī words before the marker
            if dpos <= 0: continue
            vi, wi, _ = duri[dpos - 1]            # the word the marker follows
            v = s['verses'][vi]
            after = wi + 1
            v['kufiEnds'].append([after, k])
            if after == len(v['words']): shared += 1
            else: inside += 1
    json.dump(data, open(MUSHAF, 'w', encoding='utf-8'), ensure_ascii=False)
    print(f'Kūfī ends: {shared} on a Baṣrī end, {inside} inside a Baṣrī verse')
    f = data['surahs'][0]; b = data['surahs'][1]
    print('al-Fātiḥah:', f.get('headerKufi'), [(v['basri'], v['kufiEnds']) for v in f['verses']])
    print('al-Baqarah first:', [(v['basri'], len(v['words']), v['kufiEnds']) for v in b['verses'][:3]])


if __name__ == '__main__':
    main()
