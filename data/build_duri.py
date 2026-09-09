import json, unicodedata, html, sys
from content_duri import SECTIONS

Q = json.load(open('quran.json', encoding='utf-8'))['data']
SUR = {s['number']: s for s in Q['surahs']}
DURI = {int(k): v for k, v in json.load(open('duri.json', encoding='utf-8')).items()}

STRIP = set(range(0x0610, 0x061B)) | set(range(0x064B, 0x0660)) | set(range(0x06D6, 0x06EE)) | {0x0670, 0x0640, 0x06E5, 0x06E6, 0x0653, 0x0654, 0x0655, 0x08F0, 0x08F1, 0x08F2}
def norm(w):
    out = []
    for ch in w:
        o = ord(ch)
        if o in STRIP or unicodedata.category(ch) == 'Mn' or ch == '\u06de':
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
        hs = set(norm(w) for w in a['text'].replace('\ufeff','').split())
        ov = len(dset & hs) / max(1, len(dset | hs))
        if ov > best: best, bn = ov, a['numberInSurah']
    return bn

MISSES = []
def render_ayah(s, num, targets, maxwords=22):
    tn = [norm(t) for t in targets]
    cands = []
    for vn, t in DURI[s]:
        words = t.split(); nw = [norm(w) for w in words]
        if all(x in nw for x in tn):
            cands.append((abs(vn - num), vn, words, nw))
    if not cands:
        MISSES.append(f"NOT FOUND in Duri {s}:{num}: {targets}")
        return '', num, num
    _, vn, words, nw = sorted(cands)[0]
    hit_idx = [i for i, w in enumerate(nw) if w in tn]
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
    return ' '.join(parts), vn, kufi_number(s, ' '.join(words))

def ref(s, basri, kufi):
    su = SUR[s]
    k = f" · وفي مصحف حفص: {kufi}" if kufi != basri else ""
    return f"{su['name']} – الآية {basri} (عد البصرة){k} &nbsp;<span style='color:#999'>({s})</span>"

css = """
@font-face { font-family: 'AmiriQ'; src: url('fonts/AmiriQuran.ttf'); }
@font-face { font-family: 'Amiri'; src: url('fonts/Amiri-Regular.ttf'); }
@font-face { font-family: 'Amiri'; src: url('fonts/Amiri-Bold.ttf'); font-weight: bold; }
@page { size: A4; margin: 18mm 16mm 20mm 16mm;
  @bottom-center { content: counter(page); font-family: 'Amiri'; font-size: 9pt; color:#777; }
  @bottom-right { content: "رواية الدوري عن أبي عمرو – القراءة السودانية"; font-family:'Amiri'; font-size:9pt; color:#999; }
}
body { direction: rtl; text-align: right; font-family: 'Amiri', serif; font-size: 12.5pt; color: #1e1e1e; line-height: 1.45; }
h1 { font-size: 26pt; margin: 0 0 4pt 0; color:#0f3d2e; }
h2 { font-size: 18pt; color:#0f3d2e; border-bottom: 2px solid #0f3d2e; padding-bottom: 3pt; margin: 0 0 8pt 0; page-break-after: avoid; }
h3 { font-size: 14pt; margin: 12pt 0 3pt 0; color:#7a4b12; page-break-after: avoid; }

.intro { font-style: italic; color:#444; margin-bottom: 8pt; }
.rule { page-break-inside: avoid; }
.ex { direction: rtl; text-align: right; border-right: 3px solid #b08a3e; font-family: 'AmiriQ'; font-size: 17pt; line-height: 2.05;
      background:#f7f5ee; border-right: 3px solid #b08a3e; padding: 6pt 10pt 4pt 10pt; margin: 5pt 0 2pt 0; }
.hl { color:#a3230f; background:#fbe9c4; border-radius:3px; padding:0 2px; }
.ref { font-size: 10pt; color:#666; margin: 0 0 6pt 0; }
.ar-small { font-family:'AmiriQ'; font-size: 10pt; direction: rtl; unicode-bidi: embed; }
.cover { text-align:center; margin-top: 120pt; }
.cover .big { font-family:'AmiriQ'; font-size: 40pt; direction: rtl; color:#0f3d2e; line-height: 1.9; }
.cover p { color:#555; font-size: 11pt; }
.cover .basm { font-family:'AmiriQ'; font-size: 24pt; direction: rtl; color:#7a4b12; margin: 40pt 0 20pt 0; }
.toc { columns: 2; font-size: 11pt; }
.toc div { margin-bottom: 3pt; }
.note { font-size: 11pt; border-left:none; border-right: 3px solid #0f3d2e; color:#444; background:#eef3f0; padding: 8pt 10pt; border-left: 3px solid #0f3d2e; margin-top: 10pt; }
.pb { page-break-before: always; }
table.key { border-collapse: collapse; font-size: 11pt; width: 100%; margin-top: 6pt; }
table.key td { border: 1px solid #ccc; padding: 4pt 6pt; vertical-align: top; }
table.key td.sym { font-family:'AmiriQ'; font-size: 16pt; text-align:center; direction: rtl; width: 22%; }
"""

parts = [f"<html><head><meta charset='utf-8'><style>{css}</style></head><body>"]

# Cover
parts.append("""
<div class="cover">
 <div class="basm">بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ</div>
 <div class="big">رِوَايَةُ الدُّورِيِّ عَنْ أَبِي عَمْرٍو<br/>القِرَاءَةُ السُّودَانِيَّةُ</div>
 <p style="font-size:15pt;color:#7a4b12;">أصولها وفرشها، وما توافق فيه حفصاً وما تخالفه</p>
 <p>كل الأمثلة منقولة بنصها من مصحف الدوري عن أبي عمرو المضبوط بعلاماته (إمالة، تسهيل، إدخال، إسقاط، إسكان)،<br/>
 مرقمة على العد البصري مع ذكر رقم الآية في مصحف حفص، والكلمات التي يقع فيها الحكم مميزة باللون.</p>
 <p style="margin-top:60pt;font-size:10pt;color:#888;">سبتمبر ٢٠٢٦ · نص مصحف الدوري: surahquran.com/aldoori · نص حفص للمقابلة: طبعة quran-uthmani</p>
</div>
""")

# TOC
parts.append('<div class="pb"><h2>الفهرس</h2><div class="toc">')
for sec in SECTIONS:
    parts.append(f"<div><b>{html.escape(sec['title'])}</b></div>")
    for r in sec['rules']:
        parts.append(f"<div style='margin-right:12pt;'>{html.escape(r['name'])}</div>")
parts.append('</div>')

# Mushaf notation key
parts.append("""
<h2 style="margin-top:16pt;">دليل علامات الضبط في مصحف الدوري</h2>
<table class="key">
<tr><td class="sym">اُ۬لنّ۪ارِ &nbsp; بِالۡكٰ۪فِرِينَ</td><td>المعين الصغير تحت الحرف = <b>إمالة</b> (ينحى بالفتحة نحو الكسرة والألف نحو الياء).</td></tr>
<tr><td class="sym">ءَٰا۬نذَرۡتَهُمۡ</td><td>ألف صغيرة بعد الهمزة الأولى = <b>إدخال</b> ألف؛ والنقطة المستديرة على الثانية = <b>تسهيل</b> بين الهمزة والألف.</td></tr>
<tr><td class="sym">هَٰٓؤُلَآ إِن</td><td>حذف الهمزة من الرسم = <b>إسقاط</b> الهمزة الأولى من همزتين متفقتين من كلمتين.</td></tr>
<tr><td class="sym">بَارِئۡكُمۡ &nbsp; يَأۡمُرۡكُم &nbsp; يُؤَدِّهۡ</td><td>رأس خاء صغيرة (ۡ) = <b>سكون</b>؛ توضع على ما يسكنه أبو عمرو من الهمز والراء وهاء الكناية.</td></tr>
<tr><td class="sym">فَقَد ضَّلَّ &nbsp; كَذَّبَت ثَّمُودُ</td><td>تعرية الأول من السكون وتشديد الثاني = <b>إدغام</b> (ومنه ما يزيد به أبو عمرو على حفص).</td></tr>
<tr><td class="sym">اَ۬لدَّاعِۦٓ &nbsp; يَرۡضَهُۥ</td><td>ياء أو واو صغيرة = حرف يُنطق ولم يُرسم: <b>ياء زائدة</b> تُثبت وصلاً، أو <b>صلة</b> هاء الكناية.</td></tr>
<tr><td class="sym">اِ۬لۡحَمۡدُ &nbsp; اُ۪هۡدِنَا</td><td>حركة صغيرة على همزة الوصل = بيان حركتها عند الابتداء بها.</td></tr>
<tr><td class="sym">مَلِكِ &nbsp; نُنشِرُهَا &nbsp; ضُعۡفٖ</td><td>كلمات <b>الفرش</b> مضبوطة كما تُقرأ في الرواية، لا كما في مصحف حفص.</td></tr>
</table>
<div class="note">المقادير عند الدوري: الطبيعي حركتان؛ المنفصل حركتان أو أربع؛ المتصل أربع؛ اللازم ست؛ العارض واللين ٢ أو ٤ أو ٦. والغنة في الإدغام والإقلاب والإخفاء حركتان كحفص.</div>
""")

for sec in SECTIONS:
    parts.append(f"<div class='pb'><h2>{html.escape(sec['title'])}</h2>")
    if sec['intro']:
        parts.append(f"<p class='intro'>{html.escape(sec['intro'])}</p>")
    for r in sec['rules']:
        parts.append("<div class='rule'>")
        parts.append(f"<h3>{html.escape(r['name'])}</h3>")
        parts.append(f"<p>{html.escape(r['text'])}</p>")
        for (s, a, targets) in r['examples']:
            h, vn, kn = render_ayah(s, a, targets)
            parts.append(f"<div class='ex'>{h}</div>")
            parts.append(f"<div class='ref'>{ref(s, vn, kn)}</div>")
        parts.append("</div>")
    parts.append("</div>")

parts.append("""
<div class="pb"><h2>المصادر والمنهج</h2>
<p>نص الأمثلة مسحوب آلياً من مصحف الدوري عن أبي عمرو المكتوب على موقع surahquran.com (١١٤ سورة، ٦٢٠٤ آيات على العد البصري)، وهو مضبوط بعلامات الرواية. ولم يُكتب نص آية بخط اليد ولم يُعدَّل؛ وكل كلمة مميزة قُوبلت آلياً بنص الآية قبل إدراجها، ويتوقف البناء إن لم تُوجد. ورقم الآية في مصحف حفص محسوب بمقابلة نص الآية مع طبعة quran-uthmani (العد الكوفي).</p>
<p>الأصول والفرش على ما في حرز الأماني (الشاطبية) وشروحها، وتقريب النشر لابن الجزري، وكتب رواية الدوري المعاصرة (منها: غاية سروري في رواية الدوري)، والمصحف المطبوع بهذه الرواية في مجمع الملك فهد. وحيث ذُكر وجهان عن الدوري فكلاهما من طريق الشاطبية.</p>
<p>وهذا الكتاب مرجعٌ مكتوب، والرواية إنما تُؤخذ بالتلقي عن شيخ متقن بالسند المتصل، ولا سيما الإمالة والتسهيل فإنهما لا يُضبطان إلا بالمشافهة.</p>
</div></body></html>""")

if MISSES:
    print('\n'.join(MISSES)); raise SystemExit(1)
open('tajweed.html', 'w', encoding='utf-8').write(''.join(parts))
from weasyprint import HTML
HTML('tajweed.html', base_url='.').write_pdf('/mnt/user-data/outputs/رواية_الدوري_القراءة_السودانية.pdf')
n = sum(len(r['examples']) for s in SECTIONS for r in s['rules'])
print("built; examples:", n)
