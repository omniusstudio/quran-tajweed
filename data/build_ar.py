import json, unicodedata, html, sys
from content_ar import SECTIONS

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
    return f"{su['name']} – الآية {a} &nbsp;<span style='color:#999'>({s}:{a})</span>"

css = """
@font-face { font-family: 'AmiriQ'; src: url('fonts/AmiriQuran.ttf'); }
@font-face { font-family: 'Amiri'; src: url('fonts/Amiri-Regular.ttf'); }
@font-face { font-family: 'Amiri'; src: url('fonts/Amiri-Bold.ttf'); font-weight: bold; }
@page { size: A4; margin: 18mm 16mm 20mm 16mm;
  @bottom-center { content: counter(page); font-family: 'Amiri'; font-size: 9pt; color:#777; }
  @bottom-right { content: "أحكام التجويد برواية حفص عن عاصم"; font-family:'Amiri'; font-size:9pt; color:#999; }
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
 <div class="basm">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</div>
 <div class="big">أَحْكَامُ التَّجْوِيدِ<br/>بِرِوَايَةِ حَفْصٍ عَنْ عَاصِمٍ</div>
 <p style="font-size:15pt;color:#7a4b12;">من طريق الشاطبية</p>
 <p>مرجع شامل لأحكام التجويد، كل حكم مقرون بأمثلته من القرآن الكريم<br/>
 مع باب في المقارنة بين رواية حفص عن عاصم ورواية الدوري عن أبي عمرو.<br/>
 الأمثلة كلها منقولة بنصها من المصحف بالرسم العثماني (مصحف المدينة)، والكلمات التي يقع فيها الحكم مميزة باللون.</p>
 <p style="margin-top:60pt;font-size:10pt;color:#888;">سبتمبر ٢٠٢٦ · نص القرآن: طبعة quran-uthmani (Tanzil / AlQuran.cloud) دون تعديل</p>
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
<h2 style="margin-top:16pt;">دليل علامات الضبط في المصحف المستعملة في هذا الكتاب</h2>
<table class="key">
<tr><td class="sym">أَنْعَمْتَ &nbsp; كُفُوًا أَحَدٌۢ</td><td>السكون على النون / تركيب التنوين = <b>إظهار</b>.</td></tr>
<tr><td class="sym">مِن رَّبِّهِمْ &nbsp; مِن قَبْلِكَ</td><td>تعرية النون من السكون: إن شُدد الحرف بعدها = <b>إدغام</b>، وإلا = <b>إخفاء</b>. وكذلك تتابع التنوين.</td></tr>
<tr><td class="sym">مِنۢ بَعْدِ &nbsp; سَمِيعًۢا بَصِيرًا</td><td>ميم صغيرة فوق النون أو بعد التنوين = <b>إقلاب</b>.</td></tr>
<tr><td class="sym">جَآءَ &nbsp; بِمَآ أُنزِلَ &nbsp; ٱلضَّآلِّينَ</td><td>علامة المد = مد يزيد على حركتين (متصل، منفصل، لازم).</td></tr>
<tr><td class="sym">ٱلصَّلَوٰةَ &nbsp; دَاوُۥدُ &nbsp; بِهِۦ</td><td>الألف الخنجرية والواو والياء الصغيرتان = حروف تُنطق ولم تُرسم؛ وعلى هاء الكناية تدل على الصلة.</td></tr>
<tr><td class="sym">قَالُوا۟ &nbsp; أَنَا۠</td><td>الدائرة المستديرة = حرف لا يُنطق أبداً. والمستطيلة = يُنطق وقفاً فقط.</td></tr>
<tr><td class="sym">عِوَجَا ۜ &nbsp; مَجْر۪ىٰهَا &nbsp; ءَا۬عْجَمِىٌّ &nbsp; تَأْمَ۫نَّا &nbsp; يَبْصُۜطُ</td><td>السكت · الإمالة · التسهيل · الإشمام · السين الصغيرة فوق الصاد = تُقرأ سيناً.</td></tr>
<tr><td class="sym">فِيهِ ۛ هُدًى &nbsp; ٱلْقَيُّومُ ۚ &nbsp; كَلَّا ۖ</td><td>علامات الوقف: مـ لازم · لا ممنوع · ج جائز · صلى الوصل أولى · قلى الوقف أولى · النقاط المتعانقة: الوقف على أحدهما.</td></tr>
</table>
<div class="note">الحركة: زمن النطق بحرف متحرك. المد الطبيعي = حركتان؛ المتصل والمنفصل = ٤–٥ (الشاطبية)؛ اللازم = ٦؛ العارض واللين = ٢ أو ٤ أو ٦ (مع الاطراد). والغنة في الإدغام والإقلاب والإخفاء = حركتان.</div>
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
            parts.append(f"<div class='ex'>{render_ayah(s, a, targets)}</div>")
            parts.append(f"<div class='ref'>{ref(s, a)}</div>")
        parts.append("</div>")
    parts.append("</div>")

parts.append("""
<div class="pb"><h2>المصادر والمنهج</h2>
<p>نص القرآن في كل الأمثلة مسحوب آلياً من طبعة <b>quran-uthmani</b> (نص تنزيل بالرسم العثماني عبر AlQuran.cloud)، وهي تحاكي رسم مصحف المدينة وضبطه برواية حفص عن عاصم. ولم يُكتب نص آية بخط اليد ولم يُعدَّل؛ وكل كلمة مميزة قُوبلت آلياً بنص الآية قبل إدراجها، ويتوقف البناء إن لم تُوجد الكلمة في الآية المذكورة.</p>
<p>الأحكام على المنهج المتداول: تحفة الأطفال للجمزوري، والمقدمة الجزرية لابن الجزري، وحرز الأماني (الشاطبية) للشاطبي، ودليل الضبط المطبوع في آخر مصحف المدينة (مجمع الملك فهد). وفي باب المقارنة اعتُمد ما في الشاطبية وشروحها في أصول أبي عمرو وفرشه.</p>
<p>وحيث ورد عن حفص وجهان (كالعين في ﴿كٓهيعٓصٓ﴾، و﴿ءَآلْـَٰٔنَ﴾، و﴿تَأْمَ۫نَّا﴾، و﴿ٱلْمُصَۣيْطِرُونَ﴾، و﴿ضَعْف﴾، و﴿سَلَٰسِلَا۟﴾، وراء ﴿فِرْقٍ﴾ و﴿مِصْرَ﴾ و﴿ٱلْقِطْرِ﴾) ذُكر الوجهان مع بيان المقدم من طريق الشاطبية. والتجويد يُتلقى مشافهةً عن شيخ متقن؛ وهذا الكتاب مرجعٌ لا بديل عن التلقي.</p>
</div></body></html>""")

if MISSES:
    print('\n'.join(MISSES)); raise SystemExit(1)
open('tajweed.html', 'w', encoding='utf-8').write(''.join(parts))
from weasyprint import HTML
HTML('tajweed.html', base_url='.').write_pdf('/mnt/user-data/outputs/أحكام_التجويد_رواية_حفص.pdf')
n = sum(len(r['examples']) for s in SECTIONS for r in s['rules'])
print("built; examples:", n)
