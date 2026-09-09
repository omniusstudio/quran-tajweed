# -*- coding: utf-8 -*-
# Schematic side view of the mouth (face pointing LEFT). Coordinates in a 420x330 viewBox.
# Tongue shapes are parameterised; contact points are marked with a red dot; airflow with a blue arrow.

INK = "#2b2b2b"; SKIN = "#f3d9c4"; TONGUE = "#d9736a"; TONGUE_EDGE = "#a9403a"; TEETH = "#ffffff"
RED = "#c81e1e"; BLUE = "#1d63b5"; GREEN = "#1f7a4d"; GREY = "#bbbbbb"

def smooth_path(pts, close_pts=None):
    """Catmull-Rom -> cubic bezier through pts (top surface), then straight segments through close_pts."""
    def cr(p0,p1,p2,p3):
        c1=(p1[0]+(p2[0]-p0[0])/6, p1[1]+(p2[1]-p0[1])/6)
        c2=(p2[0]-(p3[0]-p1[0])/6, p2[1]-(p3[1]-p1[1])/6)
        return f"C {c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {p2[0]:.1f} {p2[1]:.1f}"
    d=f"M {pts[0][0]} {pts[0][1]} "
    ext=[pts[0]]+pts+[pts[-1]]
    for k in range(1,len(ext)-2):
        d+=cr(ext[k-1],ext[k],ext[k+1],ext[k+2])+" "
    for p in (close_pts or []):
        d+=f"L {p[0]} {p[1]} "
    return d+"Z"

def head_outline():
    return f"""
  <rect x="0" y="0" width="420" height="330" fill="#fff"/>
  <!-- profile -->
  <path d="M 170 14 C 110 14 76 50 74 100 C 74 112 66 120 56 128 C 46 136 50 146 62 150 L 74 152
           C 78 158 74 166 66 170 C 60 176 66 184 76 186 C 70 192 66 200 74 208 C 84 218 104 232 124 244
           C 148 258 176 266 176 330 L 420 330 L 420 14 Z" fill="{SKIN}" stroke="{INK}" stroke-width="2.2"/>
  <!-- nasal cavity -->
  <path d="M 80 120 C 120 74 220 62 300 86 L 302 118 C 240 106 150 108 112 138 Z" fill="#fff7f2" stroke="{INK}" stroke-width="1.4"/>
  <!-- oral cavity (dark) -->
  <path d="M 104 150 C 120 136 150 124 200 118 C 250 114 288 122 306 142 C 316 156 314 176 306 190
           C 300 200 296 214 300 240 L 296 300 L 270 300 C 262 262 220 238 168 226 C 130 218 110 206 100 196 Z"
        fill="#6b2f2b"/>
  <!-- hard palate (bone) -->
  <path d="M 104 150 C 120 136 150 124 200 118 C 236 115 264 118 282 126" fill="none" stroke="{INK}" stroke-width="3"/>
  <!-- soft palate + uvula -->
  <path d="M 282 126 C 300 134 310 148 308 166 C 306 180 298 188 292 184" fill="none" stroke="#b56b5e" stroke-width="3" stroke-linecap="round"/>
  <!-- pharynx back wall -->
  <path d="M 322 92 L 322 300" fill="none" stroke="{INK}" stroke-width="2.4"/>
  <!-- vocal folds -->
  <path d="M 268 302 C 280 292 306 292 318 302" fill="none" stroke="{INK}" stroke-width="2.2"/>
  <line x1="272" y1="300" x2="314" y2="300" stroke="{INK}" stroke-width="3"/>
  <!-- upper front teeth -->
  <path d="M 92 150 L 88 176 L 102 176 L 106 150 Z" fill="{TEETH}" stroke="{INK}" stroke-width="1.5"/>
  <!-- lower front teeth -->
  <path d="M 96 208 L 92 184 L 106 184 L 108 208 Z" fill="{TEETH}" stroke="{INK}" stroke-width="1.5"/>
  <!-- upper molars -->
  <rect x="200" y="116" width="26" height="12" rx="3" fill="{TEETH}" stroke="{INK}" stroke-width="1.2"/>
  <rect x="232" y="118" width="24" height="12" rx="3" fill="{TEETH}" stroke="{INK}" stroke-width="1.2"/>
  <!-- floor of mouth -->
  <path d="M 100 196 C 110 206 130 218 168 226 C 220 238 262 262 270 300" fill="none" stroke="{INK}" stroke-width="2"/>
"""

FLOOR = [(292,300),(270,300),(230,244),(168,228),(120,214),(104,200)]
TOP = {
 "rest":          [(108,186),(150,182),(200,180),(250,186),(290,206),(296,240)],
 "throat":        [(108,188),(150,186),(200,186),(250,192),(288,214),(296,246)],
 "tip_ridge":     [(104,150),(118,150),(150,176),(200,182),(250,188),(290,206),(296,240)],
 "tip_teeth_root":[(100,156),(114,156),(150,178),(200,182),(250,188),(290,206),(296,240)],
 "tip_between":   [(84,178),(110,180),(150,184),(200,184),(250,190),(290,208),(296,240)],
 "tip_lower":     [(100,186),(120,180),(150,182),(200,182),(250,190),(290,208),(296,240)],
 "mid_palate":    [(108,184),(140,164),(180,128),(215,122),(250,140),(284,176),(296,220),(296,244)],
 "back_soft":     [(108,186),(150,178),(200,168),(250,138),(284,128),(300,150),(298,220),(296,244)],
 "back_hard":     [(108,186),(150,176),(200,156),(236,126),(262,122),(290,150),(298,220),(296,244)],
 "heavy":         [(108,188),(150,186),(200,176),(240,154),(272,140),(292,160),(298,220),(296,244)],
 "light":         [(108,186),(150,182),(200,182),(250,188),(290,208),(296,240)],
 "imalah":        [(108,184),(140,168),(180,148),(220,142),(256,154),(282,180),(294,212),(296,244)],
 "closed_jaw":    [(108,184),(150,178),(200,174),(250,182),(290,204),(296,240)],
}
def tongue(shape):
    return f'<path d="{smooth_path(TOP[shape], FLOOR)}" fill="{TONGUE}" stroke="{TONGUE_EDGE}" stroke-width="2"/>'

def dot(x, y, n=None):
    s = f'<circle cx="{x}" cy="{y}" r="9" fill="{RED}" fill-opacity="0.85" stroke="#fff" stroke-width="2"/>'
    if n is not None:
        s += f'<text x="{x}" y="{y+4}" font-size="11" font-family="Arial" font-weight="bold" fill="#fff" text-anchor="middle">{n}</text>'
    return s

def ring(x, y, r=14):
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="none" stroke="{RED}" stroke-width="3" stroke-dasharray="4 3"/>'

def arrow(points, color=BLUE):
    pts = " ".join(f"{x},{y}" for x, y in points)
    (x1, y1), (x2, y2) = points[-2], points[-1]
    import math
    a = math.atan2(y2 - y1, x2 - x1)
    L = 10
    p1 = (x2 - L * math.cos(a - 0.5), y2 - L * math.sin(a - 0.5))
    p2 = (x2 - L * math.cos(a + 0.5), y2 - L * math.sin(a + 0.5))
    return (f'<polyline points="{pts}" fill="none" stroke="{color}" stroke-width="3" stroke-linecap="round"/>'
            f'<polygon points="{x2},{y2} {p1[0]:.1f},{p1[1]:.1f} {p2[0]:.1f},{p2[1]:.1f}" fill="{color}"/>')

def side_view(shape, marks=(), rings=(), arrows=(), letters="", w=300):
    """marks: list of (x,y,label); arrows: list of point-lists."""
    body = head_outline() + tongue(shape)
    for pts in arrows: body += arrow(pts)
    for (x, y, r) in rings: body += ring(x, y, r)
    for m in marks: body += dot(*m)
    if letters:
        body += f'<text x="360" y="60" font-size="34" font-family="AmiriQ, Amiri" fill="{GREEN}" text-anchor="middle" direction="rtl">{letters}</text>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 330" width="{w}">{body}</svg>'

# ---------- front view of the lips ----------
def lips(kind, letters="", w=170):
    """kind: closed | rounded | teeth_on_lip | open_fatha | open_imalah | spread"""
    parts = [f'<rect x="0" y="0" width="200" height="150" fill="{SKIN}" rx="18"/>']
    if kind == "closed":
        parts.append(f'<path d="M 30 78 C 70 60 130 60 170 78 C 130 90 70 90 30 78 Z" fill="#c9605b" stroke="{INK}" stroke-width="2"/>')
        parts.append(f'<path d="M 30 78 C 70 76 130 76 170 78" fill="none" stroke="{INK}" stroke-width="2.5"/>')
    elif kind == "rounded":
        parts.append(f'<ellipse cx="100" cy="78" rx="40" ry="34" fill="#c9605b" stroke="{INK}" stroke-width="2"/>')
        parts.append(f'<ellipse cx="100" cy="78" rx="16" ry="14" fill="#5a1d1a"/>')
    elif kind == "teeth_on_lip":
        parts.append(f'<path d="M 30 70 C 70 50 130 50 170 70 C 130 76 70 76 30 70 Z" fill="#c9605b" stroke="{INK}" stroke-width="2"/>')
        for i in range(6):
            x = 52 + i * 16
            parts.append(f'<rect x="{x}" y="70" width="14" height="16" rx="2" fill="{TEETH}" stroke="{INK}" stroke-width="1.2"/>')
        parts.append(f'<path d="M 34 84 C 70 100 130 100 166 84 C 130 110 70 110 34 84 Z" fill="#c9605b" stroke="{INK}" stroke-width="2"/>')
    elif kind == "open_fatha":
        parts.append(f'<path d="M 30 70 C 70 50 130 50 170 70 C 150 118 50 118 30 70 Z" fill="#c9605b" stroke="{INK}" stroke-width="2"/>')
        parts.append(f'<path d="M 44 74 C 80 66 120 66 156 74 C 140 106 60 106 44 74 Z" fill="#5a1d1a"/>')
        for i in range(6):
            x = 52 + i * 16
            parts.append(f'<rect x="{x}" y="70" width="14" height="12" rx="2" fill="{TEETH}" stroke="{INK}" stroke-width="1"/>')
    elif kind == "open_imalah":
        parts.append(f'<path d="M 26 78 C 70 66 130 66 174 78 C 150 100 50 100 26 78 Z" fill="#c9605b" stroke="{INK}" stroke-width="2"/>')
        parts.append(f'<path d="M 44 80 C 80 76 120 76 156 80 C 140 92 60 92 44 80 Z" fill="#5a1d1a"/>')
        for i in range(6):
            x = 52 + i * 16
            parts.append(f'<rect x="{x}" y="77" width="14" height="7" rx="2" fill="{TEETH}" stroke="{INK}" stroke-width="1"/>')
    elif kind == "spread":
        parts.append(f'<path d="M 22 76 C 70 64 130 64 178 76 C 150 92 50 92 22 76 Z" fill="#c9605b" stroke="{INK}" stroke-width="2"/>')
        parts.append(f'<path d="M 40 78 C 80 74 120 74 160 78 C 140 86 60 86 40 78 Z" fill="#5a1d1a"/>')
    if letters:
        parts.append(f'<text x="100" y="138" font-size="26" font-family="AmiriQ, Amiri" fill="{GREEN}" text-anchor="middle" direction="rtl">{letters}</text>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150" width="{w}">{"".join(parts)}</svg>'

# ---------- top view of the tongue (for ض and side letters) ----------
def tongue_top(highlight, letters="", w=200):
    """highlight: 'sides' (ض), 'front_edge' (ل), 'tip' (ن ر), 'middle' (ج ش ي), 'back' (ق ك)"""
    p = [f'<rect x="0" y="0" width="200" height="230" fill="#fff" rx="10"/>']
    # upper jaw arch with teeth
    p.append(f'<path d="M 30 210 C 30 90 60 30 100 30 C 140 30 170 90 170 210" fill="none" stroke="{INK}" stroke-width="2"/>')
    import math
    for i in range(14):
        t = i / 13
        ang = math.pi * (0.05 + 0.9 * t)
        x = 100 - 70 * math.cos(ang) * (1 if True else 1)
        # place along arch
        ax = 100 + 68 * math.cos(math.pi - ang); ay = 210 - 175 * math.sin(ang) * 0.95
        r = 9 if (i < 3 or i > 10) else 6
        p.append(f'<rect x="{ax-r/2:.1f}" y="{ay-6:.1f}" width="{r}" height="12" rx="2" fill="{TEETH}" stroke="{INK}" stroke-width="1"/>')
    # tongue
    p.append(f'<path d="M 55 215 C 55 130 70 70 100 60 C 130 70 145 130 145 215 Z" fill="{TONGUE}" stroke="{TONGUE_EDGE}" stroke-width="2"/>')
    if highlight == "sides":
        p.append(f'<path d="M 60 150 C 62 110 75 78 100 62" fill="none" stroke="{RED}" stroke-width="7" stroke-linecap="round"/>')
        p.append(f'<path d="M 140 150 C 138 110 125 78 100 62" fill="none" stroke="{RED}" stroke-width="7" stroke-linecap="round"/>')
    elif highlight == "front_edge":
        p.append(f'<path d="M 76 82 C 86 66 114 66 124 82" fill="none" stroke="{RED}" stroke-width="7" stroke-linecap="round"/>')
    elif highlight == "tip":
        p.append(dot(100, 66))
    elif highlight == "middle":
        p.append(f'<ellipse cx="100" cy="120" rx="26" ry="20" fill="none" stroke="{RED}" stroke-width="5"/>')
    elif highlight == "back":
        p.append(f'<ellipse cx="100" cy="185" rx="34" ry="18" fill="none" stroke="{RED}" stroke-width="5"/>')
    if letters:
        p.append(f'<text x="100" y="24" font-size="24" font-family="AmiriQ, Amiri" fill="{GREEN}" text-anchor="middle" direction="rtl">{letters}</text>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 230" width="{w}">{"".join(p)}</svg>'

if __name__ == "__main__":
    tests = {
      "rest": side_view("rest", arrows=[[(300,250),(240,150),(150,150),(80,160)]], letters="ا"),
      "throat": side_view("throat", marks=[(300,284,1),(316,222,2),(312,150,3)], letters="ء هـ ع ح غ خ"),
      "back_soft": side_view("back_soft", marks=[(284,126)], letters="ق"),
      "mid_palate": side_view("mid_palate", marks=[(212,120)], letters="ج ش ي"),
      "tip_ridge": side_view("tip_ridge", marks=[(112,148)], letters="ل ن ر"),
      "tip_teeth_root": side_view("tip_teeth_root", marks=[(104,154)], letters="ط د ت"),
      "tip_between": side_view("tip_between", marks=[(88,178)], letters="ظ ذ ث"),
      "tip_lower": side_view("tip_lower", marks=[(100,184)], arrows=[[(200,170),(120,168),(72,172)]], letters="ص س ز"),
      "heavy": side_view("heavy", rings=[(268,144,20)], letters="ط ص ض"),
      "imalah": side_view("imalah", rings=[(214,146,20)], letters="النَّار"),
      "nasal": side_view("tip_ridge", marks=[(112,148)], arrows=[[(300,240),(300,150),(260,100),(160,84),(78,124)]], letters="نّ"),
    }
    html = "<html><head><meta charset='utf-8'></head><body style='display:flex;flex-wrap:wrap;gap:8px'>" + "".join(f"<div><div>{k}</div>{v}</div>" for k,v in tests.items())
    html += "<div>" + lips("closed","ب م") + lips("rounded","و") + lips("teeth_on_lip","ف") + lips("open_fatha","فَتْحَة") + lips("open_imalah","إمالة") + lips("spread","كسرة") + "</div>"
    html += "<div>" + tongue_top("sides","ض") + tongue_top("front_edge","ل") + tongue_top("tip","ن ر") + tongue_top("middle","ج ش ي") + tongue_top("back","ق ك") + "</div></body></html>"
    open("diag_test.html","w",encoding="utf-8").write(html)
