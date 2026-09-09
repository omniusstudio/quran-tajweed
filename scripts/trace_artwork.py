#!/usr/bin/env python3
"""Trace the approved artwork (images/A*, B*, C*) into animation data for the viewer.

Outputs
  app/src/assets/art/*.png       clean raster backgrounds (tongue / uvula / lips removed)
  app/src/viewer/artwork.json    resampled contours per state, contact dots from the
                                 annotated images, and a coarse "allowed tongue" grid
                                 used by the anatomical guard test.
Debug overlays go to --debug DIR.

Requires numpy, Pillow, opencv-python-headless.
"""
import argparse, json, sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / 'images'
ASSETS = ROOT / 'app' / 'src' / 'assets' / 'art'
OUT_JSON = ROOT / 'app' / 'src' / 'viewer' / 'artwork.json'

N_SIDE = 120  # points per side-view tongue contour
N_TOP = 96
N_LIPS = 96

A_FILES = {
    'rest': 'A01_rest', 'throat_mid': 'A02_throat_mid', 'throat_upper': 'A03_throat_upper', 'qaf': 'A04_qaf',
    'kaf': 'A05_kaf', 'jim_shin_ya': 'A06_jim_shin_ya', 'lam_nun_ra': 'A07_lam_nun_ra', 'ghunnah': 'A08_ghunnah',
    'ta_dal_tta': 'A09_ta_dal_tta', 'sad_sin_zay': 'A10_sad_sin_zay', 'tha_dhal_zha': 'A11_tha_dhal_zha',
    'heavy': 'A12_heavy', 'light': 'A13_light', 'alif_open': 'A14_alif_open', 'imalah': 'A15_imalah',
}
B_FILES = {'rest': 'B01_rest', 'sides': 'B02_sides', 'front_edge': 'B03_front_edge', 'tip': 'B04_tip', 'back': 'B05_back'}
C_FILES = {'closed': 'C01_closed', 'rounded': 'C02_rounded', 'teeth_on_lip': 'C03_teeth_on_lip', 'open': 'C04_open', 'narrow': 'C05_narrow'}
# side-view backgrounds by jaw opening
BG_FILES = {'closed': 'A01_rest', 'half': 'A15_imalah', 'open': 'A14_alif_open'}
ANNOTATED_DOTS = [
    'qaf', 'kaf', 'jim_shin_ya', 'lam_nun_ra', 'ghunnah', 'ta_dal_tta', 'sad_sin_zay', 'tha_dhal_zha',
    'throat_upper', 'throat_zones', 'heavy', 'imalah', 'top_tip',
]


def load(name):
    p = IMG / f'{name}.png'
    im = cv2.imread(str(p))
    if im is None:
        sys.exit(f'missing {p}')
    return cv2.cvtColor(im, cv2.COLOR_BGR2RGB)


def hsv(rgb):
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)


def red_mask(rgb, smin, vmin=120, hmax=9):
    h, s, v = cv2.split(hsv(rgb))
    return (((h <= hmax) | (h >= 180 - hmax)) & (s >= smin) & (v >= vmin)).astype(np.uint8)


def largest_cc(mask, seed=None):
    n, lab, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    if n <= 1:
        return np.zeros_like(mask)
    if seed is not None and lab[seed[1], seed[0]] != 0:
        k = lab[seed[1], seed[0]]
    else:
        k = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    return (lab == k).astype(np.uint8)


def fill_holes(mask):
    h, w = mask.shape
    ff = mask.copy()
    m = np.zeros((h + 2, w + 2), np.uint8)
    cv2.floodFill(ff, m, (0, 0), 1)
    return mask | (1 - ff)


def clean(mask, k=5):
    ker = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
    m = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, ker)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, ker)
    return fill_holes(m)


def outer_contour(mask):
    cs, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not cs:
        return None
    c = max(cs, key=cv2.contourArea)
    return c[:, 0, :].astype(np.float64)


def resample_closed(c, n, start='root'):
    """Resample a closed contour to n points by arc length, clockwise (image coords), starting at a canonical point."""
    # orientation: make signed area positive in image coordinates (y down) => clockwise on screen
    x, y = c[:, 0], c[:, 1]
    area = 0.5 * np.sum(x * np.roll(y, -1) - np.roll(x, -1) * y)
    if area < 0:
        c = c[::-1]
    if start == 'root':
        k = int(np.argmax(c[:, 0] + c[:, 1]))  # bottom-right-most
    elif start == 'left':
        k = int(np.argmin(c[:, 0] - 0.05 * c[:, 1]))
    elif start == 'top':
        k = int(np.argmin(c[:, 1] - 0.05 * c[:, 0]))
    else:
        k = 0
    c = np.roll(c, -k, axis=0)
    c = np.vstack([c, c[:1]])
    d = np.sqrt(np.sum(np.diff(c, axis=0) ** 2, axis=1))
    cum = np.concatenate([[0], np.cumsum(d)])
    total = cum[-1]
    out = []
    for i in range(n):
        t = total * i / n
        j = int(np.searchsorted(cum, t, side='right') - 1)
        j = min(j, len(d) - 1)
        f = (t - cum[j]) / d[j] if d[j] > 0 else 0
        out.append(c[j] + (c[j + 1] - c[j]) * f)
    return np.array(out)


def smooth_closed(pts, passes=2):
    p = pts.copy()
    for _ in range(passes):
        p = 0.25 * np.roll(p, 1, axis=0) + 0.5 * p + 0.25 * np.roll(p, -1, axis=0)
    return p


def rnd(pts):
    return [[round(float(x), 1), round(float(y), 1)] for x, y in pts]


def flat_fill(rgb, mask, color, feather=3):
    """Paint `mask` with a flat colour (the artwork is flat-shaded), feathering the edge slightly."""
    m = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), feather)[:, :, None]
    col = np.array(color, np.float32)[None, None, :]
    out = rgb.astype(np.float32) * (1 - m) + col * m
    return np.clip(out, 0, 255).astype(np.uint8)


CAVITY = (232, 158, 150)  # mouth interior above the tongue in A01
GUM = (208, 79, 57)  # palate / gum colour in the B images
SKIN = (229, 181, 143)  # face colour in the C images


def save_png(path, rgb, alpha=None):
    path.parent.mkdir(parents=True, exist_ok=True)
    if alpha is None:
        cv2.imwrite(str(path), cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR))
    else:
        bgra = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGRA)
        bgra[:, :, 3] = alpha
        cv2.imwrite(str(path), bgra)


def debug_overlay(rgb, pts_list, path):
    im = cv2.cvtColor(rgb.copy(), cv2.COLOR_RGB2BGR)
    for pts, col in pts_list:
        p = np.round(pts).astype(np.int32).reshape(-1, 1, 2)
        cv2.polylines(im, [p], True, col, 2)
        cv2.circle(im, tuple(p[0, 0]), 8, (255, 255, 0), -1)
    path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(path), im)


# ---------------------------------------------------------------------------
# Side view (A)

UVULA_POLY = np.array([[636, 468], [668, 470], [704, 486], [712, 520], [706, 556], [688, 566], [672, 548], [652, 508]], np.int32)


def side_tongue_mask(rgb):
    h, s, v = cv2.split(hsv(rgb))
    m = ((h <= 9) & (s >= 135) & (v >= 120)).astype(np.uint8)
    m[:, :150] = 0  # never the lips
    m[:430, :] = 0  # never the nasal cavity
    m[:, 724:] = 0  # never the pharynx wall
    m[640:, 706:] = 0  # never the pharynx column below the tongue root
    m[:478, 698:] = 0  # never the soft palate / upper pharynx
    m[:472, 680:] = 0
    m[790:, :] = 0
    return body_component(m, 15)


def body_component(m, k):
    """The main body of a mask: open with a large kernel to cut thin bridges, keep the largest piece, restore detail."""
    ker = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
    core = largest_cc(cv2.morphologyEx(m, cv2.MORPH_OPEN, ker))
    m = m & cv2.dilate(core, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k + 4, k + 4)))
    return clean(largest_cc(m), 7)


def trace_side(debug):
    tongues, masks = {}, {}
    for key, f in A_FILES.items():
        rgb = load(f)
        m = side_tongue_mask(rgb)
        c = outer_contour(m)
        pts = smooth_closed(resample_closed(c, N_SIDE, 'root'))
        tongues[key] = rnd(pts)
        masks[key] = m
        if debug:
            debug_overlay(rgb, [(pts, (0, 255, 0))], debug / f'side_{key}.png')
    union = np.zeros_like(masks['rest'])
    for m in masks.values():
        union |= m
    union = cv2.dilate(union, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    uv = np.zeros_like(union)
    cv2.fillPoly(uv, [UVULA_POLY], 1)
    backgrounds = {}
    for key, f in BG_FILES.items():
        rgb = load(f)
        # teeth overlay: white-ish pixels inside the dental box, drawn above the tongue
        h, s, v = cv2.split(hsv(rgb))
        teeth = ((s < 60) & (v > 150)).astype(np.uint8)
        box = np.zeros_like(teeth)
        box[470:700, 255:640] = 1
        teeth &= box
        n, lab, stats, _ = cv2.connectedComponentsWithStats(teeth, 8)
        keep = np.zeros_like(teeth)
        for k in range(1, n):
            a = stats[k, cv2.CC_STAT_AREA]
            if 150 < a < 9000:
                keep[lab == k] = 1
        keep_d = cv2.dilate(keep, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
        alpha = cv2.GaussianBlur(keep_d * 255, (3, 3), 0)
        save_png(ASSETS / f'teeth_{key}.png', rgb, alpha)
        fill = union.copy()
        fill[:, :300] = 0  # the lips stay; the protruding tip is drawn over them
        fill[keep_d == 1] = 0  # the teeth stay in the background too
        bg = flat_fill(rgb, fill, CAVITY)
        bg = flat_fill(bg, uv, (231, 164, 158), 2)  # uvula removed; drawn as a vector so it can rise
        save_png(ASSETS / f'side_{key}.png', bg)
        backgrounds[key] = f
        if debug:
            save_png(debug / f'bg_{key}.png', bg)
    # allowed-region grid for the guard test (union of all keyframe masks, generous margin)
    allowed = cv2.dilate(union, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31)))
    grid = cv2.resize(allowed, (128, 128), interpolation=cv2.INTER_AREA)
    grid = (grid > 0).astype(np.uint8)
    rows = [''.join('1' if v else '0' for v in row) for row in grid]
    return {'size': [1024, 1024], 'tongues': tongues, 'backgrounds': backgrounds, 'allowed': {'cols': 128, 'rows': 128, 'bits': rows}}


# ---------------------------------------------------------------------------
# Top view (B)

def top_tongue_mask(rgb):
    h, s, v = cv2.split(hsv(rgb))
    red = (((h <= 9) | (h >= 175)) & (s >= 110) & (v >= 140)).astype(np.uint8)
    seed = (rgb.shape[1] // 2, int(rgb.shape[0] * 0.55))
    ker = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41))
    core = largest_cc(cv2.morphologyEx(red, cv2.MORPH_OPEN, ker), seed)
    m = red & cv2.dilate(core, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31)))
    m = largest_cc(cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))), seed)
    return clean(m, 5)


def trace_top(debug):
    tongues = {}
    masks = {}
    for key, f in B_FILES.items():
        rgb = load(f)
        m = top_tongue_mask(rgb)
        c = outer_contour(m)
        pts = smooth_closed(resample_closed(c, N_TOP, 'top'))
        tongues[key] = rnd(pts)
        masks[key] = m
        if debug:
            debug_overlay(rgb, [(pts, (0, 255, 0))], debug / f'top_{key}.png')
    rgb = load(B_FILES['rest'])
    union = np.zeros_like(masks['rest'])
    for m in masks.values():
        union |= m
    bg = flat_fill(rgb, cv2.dilate(union, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))), GUM, 1.5)
    save_png(ASSETS / 'top_bg.png', bg)
    if debug:
        save_png(debug / 'top_bg.png', bg)
    h, w = rgb.shape[:2]
    return {'size': [w, h], 'tongues': tongues}


# ---------------------------------------------------------------------------
# Lips (C)

def lips_layers(rgb):
    h, s, v = cv2.split(hsv(rgb))
    redh = (h <= 7) | (h >= 173)
    lips = (redh & (s >= 82) & (s <= 148) & (v >= 140)).astype(np.uint8)
    tongue = (redh & (s > 148) & (v >= 140)).astype(np.uint8)
    dark = (v < 95).astype(np.uint8)
    # restrict everything to the mouth area: below the nose, central
    box = np.zeros_like(lips)
    box[150:470, 280:760] = 1
    lips &= box
    tongue &= box
    dark &= box
    lips = cv2.morphologyEx(lips, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(lips, 8)
    keep = np.zeros_like(lips)
    for k in range(1, n):
        if stats[k, cv2.CC_STAT_AREA] > 2500:
            keep[lab == k] = 1
    lips = cv2.morphologyEx(keep, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    # the whole mouth = lips + everything between them (dark interior, teeth, tongue), holes filled
    bright = ((s < 70) & (v > 120)).astype(np.uint8) & box
    mouthish = lips | dark | bright | tongue
    whole = cv2.morphologyEx(mouthish, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11)))
    whole = largest_cc(fill_holes(whole))
    whole = cv2.morphologyEx(whole, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    opening = ((whole == 1) & (lips == 0)).astype(np.uint8)
    opening = cv2.morphologyEx(opening, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
    opening = largest_cc(opening) if opening.sum() > 400 else np.zeros_like(opening)
    teeth = ((s < 70) & (v > 120) & (opening == 1)).astype(np.uint8)
    teeth = cv2.morphologyEx(teeth, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    tongue = ((tongue == 1) & (opening == 1)).astype(np.uint8)
    tongue = clean(tongue, 7) if tongue.sum() > 300 else np.zeros_like(tongue)
    return lips, whole, opening, teeth, tongue


def split_teeth(teeth, opening):
    """Upper and lower rows of teeth by position relative to the opening's centre line."""
    n, lab, stats, cents = cv2.connectedComponentsWithStats(teeth, 8)
    ys, xs = np.nonzero(opening)
    mid = ys.mean() if len(ys) else 0
    up = np.zeros_like(teeth)
    lo = np.zeros_like(teeth)
    for k in range(1, n):
        if stats[k, cv2.CC_STAT_AREA] < 80:
            continue
        (up if cents[k][1] < mid else lo)[lab == k] = 1
    return up, lo


def poly_or_degenerate(mask, fallback_pts, n):
    if mask.sum() < 200:
        # zero-area polygon along the fallback (so it can still be interpolated)
        f = np.array(fallback_pts)
        idx = np.linspace(0, len(f) - 1, n // 2).astype(int)
        line = f[idx]
        return np.vstack([line, line[::-1]]), False
    m = fill_holes(cv2.morphologyEx(mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))))
    c = outer_contour(m)
    return smooth_closed(resample_closed(c, n, 'left')), True


def lip_line(rgb, lips):
    """The line between the closed lips, as a left→right polyline."""
    h, s, v = cv2.split(hsv(rgb))
    line = ((v < 190) & (s > 105) & (lips == 1)).astype(np.uint8)
    line = largest_cc(line)
    ys, xs = np.nonzero(line)
    pts = []
    for x in range(xs.min(), xs.max() + 1, 4):
        col = ys[xs == x]
        if len(col):
            pts.append([x, col.mean()])
    return np.array(pts)


def trace_lips(debug):
    states = {}
    union = None
    line = None
    for key, f in C_FILES.items():
        rgb = load(f)
        lips, whole, opening, teeth, tongue = lips_layers(rgb)
        union = whole.copy() if union is None else (union | whole)
        outer = smooth_closed(resample_closed(outer_contour(whole), N_LIPS, 'left'))
        if key == 'closed':
            line = lip_line(rgb, lips)
        st = {'outer': rnd(outer)}
        if opening.sum() > 400:
            inner = smooth_closed(resample_closed(outer_contour(opening), N_LIPS, 'left'))
            st['inner'] = rnd(inner)
            st['open'] = True
            top_edge = inner[np.argsort(inner[:, 0])][:, :]  # unused placeholder
            up, lo = split_teeth(teeth, opening)
            # fallbacks: the top / bottom edge of the opening
            xs = np.round(inner[:, 0]).astype(int)
            top_pts, bot_pts = [], []
            for x in range(xs.min(), xs.max() + 1, 6):
                sel = inner[np.abs(inner[:, 0] - x) < 3]
                if len(sel):
                    top_pts.append([x, sel[:, 1].min()])
                    bot_pts.append([x, sel[:, 1].max()])
            tu, has_u = poly_or_degenerate(up, top_pts, 48)
            tl, has_l = poly_or_degenerate(lo, bot_pts, 48)
            tg, has_t = poly_or_degenerate(tongue, bot_pts, 48)
            st.update({'teethUpper': rnd(tu), 'hasTeethUpper': has_u, 'teethLower': rnd(tl), 'hasTeethLower': has_l, 'tongue': rnd(tg), 'hasTongue': has_t})
        else:
            st['open'] = False
        states[key] = st
        if debug:
            layers = [(outer, (0, 255, 0))]
            if 'inner' in st:
                layers.append((np.array(st['inner']), (255, 0, 0)))
                layers.append((np.array(st['teethUpper']), (0, 0, 255)))
                layers.append((np.array(st['teethLower']), (0, 128, 255)))
                layers.append((np.array(st['tongue']), (255, 0, 255)))
            debug_overlay(rgb, layers, debug / f'lips_{key}.png')
    # closed state: inner = the lip line as a zero-area polygon; teeth/tongue degenerate on the line
    ln = line[np.linspace(0, len(line) - 1, N_LIPS // 2).astype(int)]
    closed_inner = np.vstack([ln, ln[::-1]])
    deg = np.vstack([ln[np.linspace(0, len(ln) - 1, 24).astype(int)], ln[np.linspace(0, len(ln) - 1, 24).astype(int)][::-1]])
    states['closed'].update({'inner': rnd(closed_inner), 'teethUpper': rnd(deg), 'hasTeethUpper': False, 'teethLower': rnd(deg), 'hasTeethLower': False, 'tongue': rnd(deg), 'hasTongue': False})
    for st in states.values():
        for k in ('teethUpper', 'teethLower', 'tongue'):
            if k not in st:
                st[k] = rnd(deg)
                st['has' + k[0].upper() + k[1:]] = False
    rgb = load(C_FILES['closed'])
    bg = flat_fill(rgb, cv2.dilate(union, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))), SKIN, 2)
    save_png(ASSETS / 'lips_bg.png', bg)
    if debug:
        save_png(debug / 'lips_bg.png', bg)
    h, w = rgb.shape[:2]
    return {'size': [w, h], 'states': states, 'lipLine': rnd(line[::3])}


# ---------------------------------------------------------------------------
# Marks from the annotated images

def trace_dots():
    out = {}
    for name in ANNOTATED_DOTS:
        rgb = load(f'annotated/{name}')
        m = ((rgb[:, :, 0] > 185) & (rgb[:, :, 1] < 45) & (rgb[:, :, 2] < 45)).astype(np.uint8)
        m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
        n, lab, stats, cents = cv2.connectedComponentsWithStats(m, 8)
        dots, ring_px = [], []
        for k in range(1, n):
            x, y, w, h, a = stats[k]
            if a >= 500 and w < 80 and h < 80:
                dots.append([round(x + w / 2, 1), round(y + h / 2, 1)])
            elif 20 <= a < 500:
                ring_px.append(k)
        rings = []
        if ring_px:
            sel = np.isin(lab, ring_px)
            ys, xs = np.nonzero(sel)
            rings.append([round(float(xs.mean()), 1), round(float(ys.mean()), 1), round(float((xs.max() - xs.min()) / 2), 1)])
        if not dots and rings and rings[0][2] < 25:
            dots, rings = [[rings[0][0], rings[0][1]]], []
        dots.sort(key=lambda p: -p[1])  # bottom first (throat zones 1,2,3 are numbered bottom → top)
        out[name] = {'dots': dots, 'rings': rings}
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--debug', type=Path)
    args = ap.parse_args()
    data = {
        'side': trace_side(args.debug),
        'top': trace_top(args.debug),
        'lips': trace_lips(args.debug),
        'marks': trace_dots(),
    }
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    json.dump(data, open(OUT_JSON, 'w'), separators=(',', ':'))
    print(f'wrote {OUT_JSON.relative_to(ROOT)} ({OUT_JSON.stat().st_size // 1024} KB) and {len(list(ASSETS.glob("*.png")))} PNGs in {ASSETS.relative_to(ROOT)}')
    for k, v in data['marks'].items():
        print(f'  marks {k:14s} dots={v["dots"]} rings={v["rings"]}')


if __name__ == '__main__':
    main()
