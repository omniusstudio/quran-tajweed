import json, unicodedata, html, sys
from content import SECTIONS

Q = json.load(open('quran.json', encoding='utf-8'))['data']
SUR = {s['number']: s for s in Q['surahs']}
BASMALA = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ"

STRIP = set(range(0x0610, 0x061B)) | set(range(0x064B, 0x0660)) | set(range(0x06D6, 0x06EE)) | {0x0670, 0x0640, 0x06E5, 0x06E6, 0x0653, 0x0654, 0x0655}
def norm(w):
    out = []
    for ch in w:
        o = ord(ch)
        if o in STRIP or unicodedata.category(ch) == 'Mn':
            continue
        if ch == 'ٱ': ch = 'ا'
        if ch == 'ى': ch = 'ي'
        if ch == '۞': continue
        out.append(ch)
    return ''.join(out)

def ayah_text(s, a):
    t = SUR[s]['ayahs'][a-1]['text'].replace('\ufeff', '').strip()
    if a == 1 and s not in (1, 9):
        w = t.split()
        if [norm(x) for x in w[:4]] == ['بسم','الله','الرحمن','الرحيم']:
            t = ' '.join(w[4:])
    return t

MISSES=[]
def render_ayah(s, a, targets, maxwords=22):
    words = ayah_text(s, a).split()
    tn = [norm(t) for t in targets]
    hit_idx = [i for i, w in enumerate(words) if norm(w) in tn]
    missing = [t for t, n in zip(targets, tn) if not any(norm(w) == n for w in words)]
    if missing:
        MISSES.append(f"NOT FOUND in {s}:{a}: {missing}\n  ayah: {' '.join(words)}")
        hit_idx = hit_idx or [0]
    # window for long ayahs
    lo, hi = 0, len(words)
    if len(words) > maxwords:
        c = (min(hit_idx) + max(hit_idx)) // 2
        span = max(maxwords, max(hit_idx) - min(hit_idx) + 8)
        lo = max(0, min(min(hit_idx) - 4, c - span // 2))
        hi = min(len(words), max(max(hit_idx) + 5, lo + span))
        lo = max(0, min(lo, hi - span))
    parts = []
    if lo > 0: parts.append('…')
    for i in range(lo, hi):
        w = html.escape(words[i])
        parts.append(f'<span class="hl">{w}</span>' if i in hit_idx else w)
    if hi < len(words): parts.append('…')
    return ' '.join(parts)

def ref(s, a):
    su = SUR[s]
    return f"{su['englishName']} {s}:{a} &nbsp;<span class='ar-small'>{su['name']}</span>"

css = """
@font-face { font-family: 'AmiriQ'; src: url('fonts/AmiriQuran.ttf'); }
@font-face { font-family: 'Amiri'; src: url('fonts/Amiri-Regular.ttf'); }
@font-face { font-family: 'Amiri'; src: url('fonts/Amiri-Bold.ttf'); font-weight: bold; }
@page { size: A4; margin: 18mm 16mm 20mm 16mm;
  @bottom-center { content: counter(page); font-family: 'Amiri'; font-size: 9pt; color:#777; }
  @bottom-left { content: "Tajweed & the Riwāyah of Ḥafṣ ʿan ʿĀṣim"; font-family:'Amiri'; font-size:8pt; color:#999; }
}
body { font-family: 'Amiri', serif; font-size: 10.5pt; color: #1e1e1e; line-height: 1.45; }
h1 { font-size: 26pt; margin: 0 0 4pt 0; color:#0f3d2e; }
h2 { font-size: 16pt; color:#0f3d2e; border-bottom: 2px solid #0f3d2e; padding-bottom: 3pt; margin: 0 0 8pt 0; page-break-after: avoid; }
h3 { font-size: 12pt; margin: 12pt 0 3pt 0; color:#7a4b12; page-break-after: avoid; }
h3 .ar { font-family:'AmiriQ'; font-size: 13pt; color:#0f3d2e; float: right; direction: rtl; }
.intro { font-style: italic; color:#444; margin-bottom: 8pt; }
.rule { page-break-inside: avoid; }
.ex { direction: rtl; text-align: right; font-family: 'AmiriQ'; font-size: 17pt; line-height: 2.05;
      background:#f7f5ee; border-right: 3px solid #b08a3e; padding: 6pt 10pt 4pt 10pt; margin: 5pt 0 2pt 0; }
.hl { color:#a3230f; background:#fbe9c4; border-radius:3px; padding:0 2px; }
.ref { font-size: 8.5pt; color:#666; margin: 0 0 6pt 0; }
.ar-small { font-family:'AmiriQ'; font-size: 10pt; direction: rtl; unicode-bidi: embed; }
.cover { text-align:center; margin-top: 120pt; }
.cover .big { font-family:'AmiriQ'; font-size: 40pt; direction: rtl; color:#0f3d2e; line-height: 1.9; }
.cover p { color:#555; font-size: 11pt; }
.cover .basm { font-family:'AmiriQ'; font-size: 24pt; direction: rtl; color:#7a4b12; margin: 40pt 0 20pt 0; }
.toc { columns: 2; font-size: 10pt; }
.toc div { margin-bottom: 3pt; }
.note { font-size: 9pt; color:#444; background:#eef3f0; padding: 8pt 10pt; border-left: 3px solid #0f3d2e; margin-top: 10pt; }
.pb { page-break-before: always; }
table.key { border-collapse: collapse; font-size: 9.5pt; width: 100%; margin-top: 6pt; }
table.key td { border: 1px solid #ccc; padding: 4pt 6pt; vertical-align: top; }
table.key td.sym { font-family:'AmiriQ'; font-size: 16pt; text-align:center; direction: rtl; width: 22%; }
"""

parts = [f"<html><head><meta charset='utf-8'><style>{css}</style></head><body>"]

# Cover
parts.append("""
<div class="cover">
 <div class="basm">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</div>
 <div class="big">أَحْكَامُ التَّجْوِيدِ<br/>بِرِوَايَةِ حَفْصٍ عَنْ عَاصِمٍ</div>
 <h1>The Rules of Tajweed</h1>
 <p style="font-size:14pt;color:#7a4b12;">According to the Riwāyah of Ḥafṣ ʿan ʿĀṣim (Ṭarīq al-Shāṭibiyyah)</p>
 <p>A complete reference with every rule illustrated from the Qur'an.<br/>
 All Arabic examples are taken verbatim from the Uthmani (Madinah) muṣḥaf text; the word(s) to which each rule applies are highlighted.</p>
 <p style="margin-top:60pt;font-size:9pt;color:#888;">Compiled September 2026 &middot; Quranic text: quran-uthmani edition (Tanzil/AlQuran.cloud), unaltered</p>
</div>
""")

# TOC
parts.append('<div class="pb"><h2>Contents</h2><div class="toc">')
for sec in SECTIONS:
    parts.append(f"<div><b>{html.escape(sec['title'])}</b></div>")
    for r in sec['rules']:
        parts.append(f"<div style='margin-left:12pt;'>{html.escape(r['name'])}</div>")
parts.append('</div>')

# Mushaf notation key
parts.append("""
<h2 style="margin-top:16pt;">How to read the muṣḥaf marks used in this document</h2>
<table class="key">
<tr><td class="sym">أَنْعَمْتَ &nbsp; كُفُوًا أَحَدٌۢ</td><td>Sukūn written on the nūn / stacked tanwīn = <b>iẓhār</b> (pronounce the nūn clearly).</td></tr>
<tr><td class="sym">مِن رَّبِّهِمْ &nbsp; مِن قَبْلِكَ</td><td>Bare nūn with no sukūn: next letter carries shaddah = <b>idghām</b>; no shaddah = <b>ikhfāʾ</b>. Tanwīn written in sequence likewise.</td></tr>
<tr><td class="sym">مِنۢ بَعْدِ &nbsp; سَمِيعًۢا بَصِيرًا</td><td>Small mīm over the nūn / after the tanwīn = <b>iqlāb</b>.</td></tr>
<tr><td class="sym">جَآءَ &nbsp; بِمَآ أُنزِلَ &nbsp; ٱلضَّآلِّينَ</td><td>Madd sign = lengthening beyond 2 counts (muttaṣil, munfaṣil, lāzim).</td></tr>
<tr><td class="sym">ٱلصَّلَوٰةَ &nbsp; دَاوُۥدُ &nbsp; بِهِۦ</td><td>Small (dagger) alif, small wāw, small yāʾ = letters read though not in the base script; on the pronoun هـ they mark madd ṣilah.</td></tr>
<tr><td class="sym">قَالُوا۟ &nbsp; أَنَا۠</td><td>Round circle = letter never pronounced. Oval = pronounced only when stopping.</td></tr>
<tr><td class="sym">عِوَجَا ۜ &nbsp; مَجْر۪ىٰهَا &nbsp; ءَا۬عْجَمِىٌّ &nbsp; تَأْمَ۫نَّا &nbsp; يَبْصُۜطُ</td><td>Sakt (breathless pause) · imālah · tas-hīl · ishmām · small sīn over ṣād = read as sīn.</td></tr>
<tr><td class="sym">فِيهِ ۛ هُدًى &nbsp; ٱلْقَيُّومُ ۚ &nbsp; كَلَّا ۖ</td><td>Stop signs: مـ must stop · لا do not stop · ج may stop · صلى better to continue · قلى better to stop · ۛ ۛ stop at one of the pair.</td></tr>
</table>
<div class="note">Counting: one <b>ḥarakah</b> (count) is the time of one short vowel. Natural madd = 2; muttaṣil/munfaṣil = 4–5 (Shāṭibiyyah); lāzim = 6; ʿāriḍ and līn = 2, 4 or 6 (be consistent). Ghunnah in idghām, iqlāb and ikhfāʾ = 2 counts.</div>
""")

for sec in SECTIONS:
    parts.append(f"<div class='pb'><h2>{html.escape(sec['title'])}</h2>")
    if sec['intro']:
        parts.append(f"<p class='intro'>{html.escape(sec['intro'])}</p>")
    for r in sec['rules']:
        parts.append("<div class='rule'>")
        parts.append(f"<h3>{html.escape(r['name'])} <span class='ar'>{html.escape(r['arabic'])}</span></h3>")
        parts.append(f"<p>{html.escape(r['text'])}</p>")
        for (s, a, targets) in r['examples']:
            parts.append(f"<div class='ex'>{render_ayah(s, a, targets)}</div>")
            parts.append(f"<div class='ref'>{ref(s, a)}</div>")
        parts.append("</div>")
    parts.append("</div>")

parts.append("""
<div class="pb"><h2>Sources and method</h2>
<p>The Quranic text in every example was retrieved programmatically from the <b>quran-uthmani</b> edition (the Tanzil.net Uthmani text, served via AlQuran.cloud), which reproduces the orthography and tajweed notation of the Madinah muṣḥaf in the riwāyah of Ḥafṣ ʿan ʿĀṣim. No verse text was typed or edited by hand; each highlighted word was matched automatically against the verse before inclusion, and the build fails if a cited word is not present in the cited verse.</p>
<p>The rules follow the standard classical curriculum: <i>Tuḥfat al-Aṭfāl</i> (al-Jamzūrī), <i>al-Muqaddimah al-Jazariyyah</i> (Ibn al-Jazarī), <i>Ḥirz al-Amānī wa-Wajh al-Tahānī</i> (al-Shāṭibī), and the notation key printed at the end of the King Fahd Complex Madinah muṣḥaf.</p>
<p>Where Ḥafṣ transmits two permitted ways (e.g. the ʿayn of كٓهيعٓصٓ, ءَآلْـَٰٔنَ, تَأْمَ۫نَّا, ٱلْمُصَۣيْطِرُونَ, ضَعْف, سَلَٰسِلَا۟, and the rāʾ of فِرْقٍ / مِصْرَ / ٱلْقِطْرِ), both are stated and the wajh preferred by the Shāṭibiyyah path is noted. Rules of recitation are ultimately learned by ear from a qualified teacher (talaqqī); this document is a reference, not a substitute for that.</p>
</div></body></html>""")

if MISSES:
    print('\n'.join(MISSES)); raise SystemExit(1)
open('tajweed.html', 'w', encoding='utf-8').write(''.join(parts))
from weasyprint import HTML
HTML('tajweed.html', base_url='.').write_pdf('/mnt/user-data/outputs/Tajweed_Rules_Hafs_an_Asim.pdf')
n = sum(len(r['examples']) for s in SECTIONS for r in s['rules'])
print("built; examples:", n)
