import json, unicodedata, html, sys
from content_beginner import SECTIONS
from content_beginner import IMG

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
@font-face { font-family: 'AmiriQ'; src: url('fonts/ScheherazadeNew-Regular.ttf'); }
@font-face { font-family: 'AmiriQ'; src: url('fonts/ScheherazadeNew-Bold.ttf'); font-weight: bold; }
@font-face { font-family: 'Amiri'; src: url('fonts/NotoSansArabic-Regular.ttf'); }
@font-face { font-family: 'Amiri'; src: url('fonts/NotoSansArabic-Bold.ttf'); font-weight: bold; }
@page { size: A4; margin: 18mm 16mm 20mm 16mm;
  @bottom-center { content: counter(page); font-family: 'Amiri'; font-size: 9pt; color:#777; }
  @bottom-right { content: "تعلم التجويد من الصفر – رواية الدوري (القراءة السودانية)"; font-family:'Amiri'; font-size:9pt; color:#999; }
}
body { direction: rtl; text-align: right; font-family: 'Amiri', sans-serif; font-size: 12pt; color: #1e1e1e; line-height: 1.75; }
h1 { font-size: 26pt; margin: 0 0 4pt 0; color:#0f3d2e; }
h2 { font-size: 17pt; color:#0f3d2e; border-bottom: 2px solid #0f3d2e; padding-bottom: 3pt; margin: 0 0 8pt 0; page-break-after: avoid; }
h3 { font-size: 13pt; margin: 12pt 0 3pt 0; color:#7a4b12; page-break-after: avoid; }

.intro { font-style: italic; color:#444; margin-bottom: 8pt; }
.rule { page-break-inside: avoid; }
.ex { direction: rtl; text-align: right; border-right: 3px solid #b08a3e; font-family: 'AmiriQ'; font-size: 21pt; line-height: 2.1;
      background:#f7f5ee; border-right: 3px solid #b08a3e; padding: 6pt 10pt 4pt 10pt; margin: 5pt 0 2pt 0; }
.hl { color:#a3230f; background:#fbe9c4; border-radius:3px; padding:0 2px; }
.ref { font-size: 10pt; color:#666; margin: 0 0 6pt 0; }
.ar-small { font-family:'AmiriQ'; font-size: 10pt; direction: rtl; unicode-bidi: embed; }
.cover { text-align:center; margin-top: 120pt; }
.cover .big { font-family:'AmiriQ'; font-size: 38pt; direction: rtl; color:#0f3d2e; line-height: 1.9; }
.cover p { color:#555; font-size: 11pt; }
.cover .basm { font-family:'AmiriQ'; font-size: 24pt; direction: rtl; color:#7a4b12; margin: 40pt 0 20pt 0; }
.toc { columns: 2; font-size: 11pt; }
.toc div { margin-bottom: 3pt; }
.note { font-size: 11pt; border-left:none; border-right: 3px solid #0f3d2e; color:#444; background:#eef3f0; padding: 8pt 10pt; border-left: 3px solid #0f3d2e; margin-top: 10pt; }
.pb { page-break-before: always; }

.figs { display: flex; flex-wrap: wrap; gap: 8pt; justify-content: center; margin: 6pt 0 4pt 0; page-break-inside: avoid; }
.fig { width: 46%; text-align: center; }
.fig.narrow { width: 30%; }
.fig svg, .fig img { width: 100%; height: auto; border: 1px solid #ddd; border-radius: 6px; background: #fff; }
.fig .cap { font-size: 10pt; color: #444; margin-top: 2pt; line-height: 1.35; }
table.key { border-collapse: collapse; font-size: 11pt; width: 100%; margin-top: 6pt; }
table.key td { border: 1px solid #ccc; padding: 4pt 6pt; vertical-align: top; }
table.key td.sym { font-family:'AmiriQ'; font-size: 16pt; text-align:center; direction: rtl; width: 22%; }
"""

parts = [f"<html><head><meta charset='utf-8'><style>{css}</style></head><body>"]

# Cover
parts.append("""
<div class="cover">
 <div class="basm">بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ</div>
 <div class="big">تَعَلَّمِ التَّجْوِيدَ مِنَ الصِّفْرِ<br/>بِرِوَايَةِ الدُّورِيِّ عَنْ أَبِي عَمْرٍو</div>
 <p style="font-size:15pt;color:#7a4b12;">القراءة السودانية – شرح مبسط لمن لا يعرف شيئاً، مع صور لوضع اللسان وشكل الفم</p>
 <p>كل مصطلح يُشرح بكلمات بسيطة قبل استعماله. وكل قاعدة معها صورة أو مثال من مصحف الدوري نفسه،<br/>والكلمة التي تنطبق عليها القاعدة ملونة.</p>
 <p style="margin-top:60pt;font-size:10pt;color:#888;">سبتمبر ٢٠٢٦ · الأمثلة من مصحف الدوري عن أبي عمرو (surahquran.com/aldoori) · الصور رسوم توضيحية</p>
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
KEY = ("<h2 style='margin-top:16pt;'>كيف تقرأ الصور في هذا الكتاب</h2><div class='figs'>"
  "<div class='fig'>" + IMG('lam_nun_ra') + "<div class='cap'>رأس ينظر إلى اليسار مقطوع من المنتصف: الأنف في الأعلى، والأسنان، واللسان الأحمر، والحلق والحنجرة في الأسفل. النقطة الحمراء: المكان الذي يلمسه اللسان عند نطق الحرف. السهم الأزرق: مسار الهواء.</div></div>"
  "<div class='fig narrow'>" + IMG('lips_rounded') + "<div class='cap'>الشفتان من الأمام.</div></div>"
  "<div class='fig narrow'>" + IMG('top_sides') + "<div class='cap'>اللسان من أعلى داخل قوس الأسنان العليا؛ الأحمر الداكن: الجزء الذي يعمل.</div></div></div>"
  "<div class='note'>الأمثلة: الآية بخط أخضر كبير، والكلمة المقصودة ملونة، وتحتها اسم السورة ورقم الآية في مصحف الدوري (ورقمها في مصحف حفص إن اختلف).</div>")
parts.append(KEY)


for sec in SECTIONS:
    parts.append(f"<div class='pb'><h2>{html.escape(sec['title'])}</h2>")
    if sec['intro']:
        parts.append(f"<p class='intro'>{html.escape(sec['intro'])}</p>")
    for r in sec['rules']:
        parts.append("<div class='rule'>")
        parts.append(f"<h3>{html.escape(r['name'])}</h3>")
        parts.append(f"<p>{html.escape(r['text'])}</p>")
        if r.get('figures'):
            parts.append("<div class='figs'>")
            for (svg, cap) in r['figures']:
                cls = 'fig narrow' if ('top_' in svg or 'lips_' in svg) else 'fig'
                parts.append(f"<div class='{cls}'>{svg}<div class='cap'>{html.escape(cap)}</div></div>")
            parts.append("</div>")
        for (s, a, targets) in r['examples']:
            h, vn, kn = render_ayah(s, a, targets)
            parts.append(f"<div class='ex'>{h}</div>")
            parts.append(f"<div class='ref'>{ref(s, vn, kn)}</div>")
        parts.append("</div>")
    parts.append("</div>")

parts.append("""
<div class="pb"><h2>كلمة أخيرة ومصادر</h2>
<p>هذا الكتاب مدخل مبسط. الأمثلة كلها منقولة آلياً من مصحف الدوري عن أبي عمرو المكتوب (surahquran.com/aldoori)، ولم تُكتب بخط اليد، وكل كلمة ملونة قوبلت بنص الآية قبل إدراجها. والصور رسوم توضيحية لوضع اللسان والشفتين وليست صوراً تشريحية دقيقة.</p>
<p>القواعد على ما في كتب التجويد المتداولة (تحفة الأطفال، المقدمة الجزرية) وكتب رواية الدوري عن أبي عمرو من طريق الشاطبية. وقد بسّطنا العبارة وحذفنا التفاصيل الدقيقة التي لا يحتاجها المبتدئ.</p>
<p>ولا غنى عن السماع والتقليد: اسمع المصحف المرتل برواية الدوري (مثل تسجيل الشيخ محمود خليل الحصري) وقلده آية آية، ثم اعرض قراءتك على شيخ متقن يصحح لك، فالتجويد يُتعلم بالأذن واللسان قبل العين.</p>
</div></body></html>""")

if MISSES:
    print('\n'.join(MISSES)); raise SystemExit(1)
open('tajweed.html', 'w', encoding='utf-8').write(''.join(parts))
from weasyprint import HTML
HTML('tajweed.html', base_url='.').write_pdf('/mnt/user-data/outputs/تعلم_التجويد_من_الصفر_رواية_الدوري.pdf')
n = sum(len(r['examples']) for s in SECTIONS for r in s['rules'])
print("built; examples:", n)
