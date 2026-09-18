#!/usr/bin/env python3
"""Hadith wording for the calendar and the daily checklist, cut from published editions.

    python3 scripts/fetch_hadith.py      # writes app/src/content/hadith.json

Nothing is typed by hand: each entry names an edition of the open hadith-api dataset
(github.com/fawazahmed0/hadith-api, Arabic editions with full diacritics), the hadith's number
in the usual numbering, and the first and last words of the passage to keep (matched without
diacritics). The cut text goes to hadith.json with its source line. Editions are cached in
data/hadith_cache/ (git-ignored).
"""
import json, sys, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / 'data' / 'hadith_cache'
OUT = ROOT / 'app' / 'src' / 'content' / 'hadith.json'
BASE = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-{}.min.json'
BOOKS = {'bukhari': 'صحيح البخاري', 'muslim': 'صحيح مسلم', 'tirmidhi': 'سنن الترمذي', 'abudawud': 'سنن أبي داود', 'nasai': 'سنن النسائي', 'ibnmajah': 'سنن ابن ماجه'}
GRADES = {'Sahih': 'صحيح', 'Hasan': 'حسن', 'Hasan Sahih': 'حسن صحيح', 'Sahih - Authentic': 'صحيح'}
DROP = set('ًٌٍَُِّْٰٓـ‏‎‍')
AR = '٠١٢٣٤٥٦٧٨٩'

# id, edition, number (Muslim: ʿAbd al-Bāqī's, as "1162.01"), first words, last words
ENTRIES = [
    ('arafah', 'muslim', '1162.01', 'صيام يوم عرفة', 'والسنة التي بعده'),
    ('ashura', 'muslim', '1162.01', 'صيام يوم عاشوراء', 'يكفر السنة التي قبله'),
    ('monday_born', 'muslim', '1162.02', 'ذاك يوم ولدت فيه', 'انزل علي فيه'),
    ('tasua', 'muslim', '1134.02', 'لئن بقيت', 'لاصومن التاسع'),
    ('ashura_musa', 'bukhari', '2004', 'قدم النبي', 'وامر بصيامه'),
    ('shawwal_six', 'muslim', '1164.01', 'من صام رمضان', 'كصيام الدهر'),
    ('muharram', 'muslim', '1163.01', 'افضل الصيام', 'صلاة الليل'),
    ('tashriq', 'muslim', '1141.01', 'ايام التشريق', 'اكل وشرب'),
    ('eid_no_fast', 'bukhari', '1991', 'نهى النبي', 'يوم الفطر والنحر'),
    ('mon_thu', 'tirmidhi', '747', 'تعرض الاعمال', 'وانا صائم'),
    ('white_days', 'tirmidhi', '761', 'يا ابا ذر', 'وخمس عشرة'),
    ('ten_days', 'bukhari', '969', 'ما العمل في ايام', 'فلم يرجع بشىء'),
    ('arafah_dua', 'tirmidhi', '3585', 'خير الدعاء', 'على كل شىء قدير'),
    ('ramadan_fast', 'bukhari', '38', 'من صام رمضان', 'من ذنبه'),
    ('sahur', 'bukhari', '1923', 'تسحروا', 'بركة'),
    ('qadr_qiyam', 'bukhari', '1901', 'من قام ليلة القدر', 'ما تقدم من ذنبه'),
    ('qadr_odd', 'bukhari', '2017', 'تحروا ليلة القدر', 'من رمضان'),
    ('qadr_dua', 'tirmidhi', '3513', 'قلت يا رسول الله', 'فاعف عني'),
    ('shaban', 'bukhari', '1969', 'كان رسول الله', 'في شعبان'),
    ('friday_best', 'muslim', '854.01', 'خير يوم', 'اخرج منها'),
    ('friday_hour', 'bukhari', '935', 'فيه ساعة', 'الا اعطاه اياه'),
    ('friday_salawat', 'abudawud', '1047', 'ان من افضل ايامكم', 'معروضة على'),
    ('friday_ghusl', 'bukhari', '881', 'من اغتسل يوم الجمعة', 'يستمعون الذكر'),
    ('kahf_ten', 'muslim', '809.01', 'من حفظ عشر ايات', 'عصم من الدجال'),
    ('mulk', 'tirmidhi', '2891', 'ان سورة من القران', 'بيده الملك'),
    ('baqarah_last_two', 'bukhari', '5009', 'من قرا بالايتين', 'كفتاه'),
    ('quls_sleep', 'bukhari', '5017', 'كان اذا اوى الى فراشه', 'ثلاث مرات'),
    ('quls_morning_evening', 'abudawud', '5082', '{ قل هو الله احد', 'من كل شىء'),
    ('kursi_sleep', 'bukhari', '2311', 'اذا اويت الى فراشك', 'حتى تصبح'),
]


def _fold(s):
    out = []
    for c in s:
        if c in DROP: continue
        out.append({'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ى': 'ي', 'ٱ': 'ا'}.get(c, c))
    return ''.join(out)


def index_map(s):
    """Folded text plus, for each folded char, its index in the original."""
    folded, idx = [], []
    for i, c in enumerate(s):
        if c in DROP: continue
        folded.append({'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ى': 'ي', 'ٱ': 'ا'}.get(c, c)); idx.append(i)
    return ''.join(folded), idx


def edition(name):
    CACHE.mkdir(parents=True, exist_ok=True)
    f = CACHE / f'ara-{name}.json'
    if not f.exists():
        print('fetching', name)
        req = urllib.request.Request(BASE.format(name), headers={'User-Agent': 'nutq-tajweed/1.0'})
        f.write_bytes(urllib.request.urlopen(req, timeout=120).read())
    return json.load(open(f, encoding='utf-8'))['hadiths']


def ar_num(n):
    return ''.join(AR[int(c)] if c.isdigit() else c for c in str(n))


def quote(t):
    """Straight quotes → «…», alternating, one character for one so indices stay valid."""
    out, open_ = [], True
    for c in t:
        if c == '"':
            out.append('«' if open_ else '»'); open_ = not open_
        else:
            out.append(c)
    return ''.join(out)


def clean(t):
    t = t.replace('\u200f', '').replace('\u200e', '')
    for a, b in (('{', '﴿'), ('}', '﴾'), ('صلى الله عليه وسلم', 'ﷺ'), (' ـ ', ' '), (' - ', ' '), ('« ', '«'), (' »', '»'), ('﴿ ', '﴿'), (' ﴾', '﴾'), (' .', '.'), ('  ', ' ')):
        t = t.replace(a, b)
    t = t.strip(' .،-ـ')
    # a passage cut from inside a quotation: balance the marks
    first = min((i for i in (t.find('«'), t.find('»')) if i >= 0), default=-1)
    if first >= 0 and t[first] == '»': t = '«' + t
    if t.count('«') > t.count('»'): t = t + '»'
    if t.startswith('«') and t.endswith('»') and t.count('«') == 1: t = t[1:-1]
    return t


def main():
    out, bad = {}, []
    for hid, ed, num, first, last in ENTRIES:
        hs = edition(ed)
        h = next((x for x in hs if str(x.get('arabicnumber')) == num or (ed != 'muslim' and str(x.get('hadithnumber')) == num)), None)
        if not h:
            bad.append(f'{hid}: {ed} {num} not found'); continue
        src = quote(h['text'])
        folded, idx = index_map(src)
        a = folded.find(_fold(first)); b = folded.find(_fold(last), max(a, 0))
        if a < 0 or b < 0:
            bad.append(f'{hid}: passage not found in {ed} {num}'); continue
        end = idx[b + len(_fold(last)) - 1] + 1
        while end < len(src) and src[end] in DROP: end += 1      # keep the last letter's marks
        text = clean(src[idx[a]:end])
        grade = next((GRADES[g['grade']] for g in h.get('grades', []) if g.get('grade') in GRADES), None)
        shown = num.split('.')[0]
        out[hid] = {'text': text, 'source': f'{BOOKS[ed]} {ar_num(shown)}', **({'grade': grade} if grade and ed not in ('bukhari', 'muslim') else {})}
    if bad:
        print('\n'.join(bad)); sys.exit(1)
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{len(out)} passages → {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
