#!/usr/bin/env python3
"""Verse boundaries for a Dūrī recording, found by matching audio to audio.

For each verse, the Ḥafṣ recitation of Mishari al-ʿAfasy (quran.com, with known per-verse and
per-word timings) provides a template: the sound of that verse. A subsequence match (DTW on
log-mel frames) finds where that sound occurs in the Dūrī recording inside a window around the
previous estimate, verse after verse in order. Word alignment stays by hand (PROMPT.md §6); this
gives verse starts and ends accurate to a fraction of a second, which is what playback needs.

    python3 scripts/align_guided.py --surahs 2 3          # needs data/hafs_audio/<n>.mp3 (fetched on demand)
    python3 scripts/align_guided.py                       # every sūrah that has a cached Dūrī recording
"""
import argparse, json, re, subprocess, sys, urllib.request
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'scripts'))
import segment_verses as sv  # noqa: E402  (pcm, envelope, segments, templates for istiʿādhah/basmalah, proportional)

APP = ROOT / 'app'
HAFS_DIR = ROOT / 'data' / 'hafs_audio'
TIMINGS = json.load(open(ROOT / 'data' / 'timings_hafs.json', encoding='utf-8'))
QURAN = json.load(open(ROOT / 'data' / 'quran.json', encoding='utf-8'))['data']
SR = 16000
FPS = 50
HOP = SR // FPS
NFFT = 640
BANDS = 20
import os
DEBUG = bool(os.environ.get('ALIGN_DEBUG'))
COST_MAX = float(os.environ.get('ALIGN_COST_MAX', '9'))
SLOPE = float(os.environ.get('ALIGN_SLOPE', '2.0'))
REFINE = bool(os.environ.get('ALIGN_REFINE'))
DIAG = bool(os.environ.get('ALIGN_DIAG'))
ENERGY_W = float(os.environ.get('ALIGN_ENERGY', '3.0'))


def hafs_audio(n: int) -> Path:
    HAFS_DIR.mkdir(parents=True, exist_ok=True)
    f = HAFS_DIR / f'{n}.mp3'
    if not f.exists() or f.stat().st_size < 10_000:
        url = f'https://download.quranicaudio.com/qdc/mishari_al_afasy/murattal/{n}.mp3'
        print(f'  fetching {url}')
        with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'nutq-tajweed/1.0'}), timeout=600) as r:
            f.write_bytes(r.read())
    return f


_FB = None


def filterbank():
    global _FB
    if _FB is None:
        f = np.fft.rfftfreq(NFFT, 1 / SR)
        edges = np.geomspace(100, 4000, BANDS + 2)
        fb = np.zeros((len(f), BANDS), dtype=np.float32)
        for i in range(BANDS):
            lo, c, hi = edges[i], edges[i + 1], edges[i + 2]
            fb[:, i] = np.clip(np.minimum((f - lo) / (c - lo), (hi - f) / (hi - c)), 0, 1)
        _FB = fb
    return _FB


NCEP = 12
_DCT = None


def dct_matrix():
    global _DCT
    if _DCT is None:
        k = np.arange(1, NCEP + 1)[:, None]
        nn = np.arange(BANDS)[None, :]
        _DCT = (np.cos(np.pi * k * (nn + 0.5) / BANDS) * np.sqrt(2.0 / BANDS)).astype(np.float32)
    return _DCT


def features(x: np.ndarray) -> np.ndarray:
    """MFCC frames (12 cepstra + deltas, FPS/s) with per-file mean/variance normalisation, so two
    reciters' voices compare by what is said rather than by timbre and channel."""
    fb = filterbank()
    win = np.hanning(NFFT).astype(np.float32)
    out = []
    chunk = HOP * 20000  # ~400 s of frames per chunk
    for start in range(0, max(1, len(x) - NFFT), chunk):
        seg = x[start:start + chunk + NFFT]
        if len(seg) < NFFT:
            break
        frames = np.lib.stride_tricks.sliding_window_view(seg, NFFT)[::HOP] * win
        spec = np.abs(np.fft.rfft(frames, axis=1)) ** 2
        logmel = np.log(spec @ fb + 1e-6).astype(np.float32)
        energy = np.log(spec.sum(axis=1) + 1e-6).astype(np.float32)[:, None]
        out.append(np.concatenate([logmel @ dct_matrix().T, energy], axis=1))
    if not out:
        return np.zeros((1, 2 * NCEP + 2), dtype=np.float32)
    c = np.concatenate(out)
    c = (c - c.mean(axis=0)) / (c.std(axis=0) + 1e-6)
    c[:, -1] *= ENERGY_W  # loudness weighs more: silence must meet silence
    d = np.zeros_like(c)
    d[2:-2] = (c[4:] - c[:-4]) / 4.0
    return np.concatenate([c, d], axis=1).astype(np.float32)


def subsequence_dtw(T: np.ndarray, S: np.ndarray):
    """Best match of the whole template T inside S (free start and end). Returns (cost/len, start, end) in frames."""
    n, m = len(T), len(S)
    if m < 4 or n < 2:
        return 9e9, 0, m
    S2 = (S ** 2).sum(axis=1)
    idx = np.arange(m)

    def row(i):
        d = S2 - 2 * (S @ T[i]) + (T[i] ** 2).sum()
        return np.sqrt(np.maximum(d, 0))

    # step weights: a diagonal step costs d, a vertical or horizontal step costs SLOPE·d, so the
    # path follows the recording's tempo instead of stacking a whole verse onto one similar frame
    prev = row(0)
    start_prev = idx.copy()
    for i in range(1, n):
        d = row(i)
        up = prev + SLOPE * d
        diag = np.empty(m, dtype=np.float32)
        diag[0] = np.inf
        diag[1:] = prev[:-1] + d[1:]
        use_diag = diag <= up
        base = np.where(use_diag, diag, up)
        base_start = np.where(use_diag, np.concatenate(([0], start_prev[:-1])), start_prev)
        # horizontal moves: cur[j] = S[j] + min_{k<=j}(base[k] - S[k]) where S is the running sum of SLOPE·d
        cs = np.cumsum(SLOPE * d)
        val = base - cs
        acc = np.minimum.accumulate(val)
        k = np.maximum.accumulate(np.where(val <= acc, idx, 0))
        prev = cs + acc
        start_prev = base_start[k]
    j = int(np.argmin(prev))
    return float(prev[j] / n), int(start_prev[j]), j + 1


_LETTERS = re.compile('[\u0621-\u064A\u0671]')


def hafs_words(text: str) -> list:
    """Real words only: the Ḥafṣ text carries pause and sajdah marks as separate tokens."""
    return [w for w in text.split() if _LETTERS.search(w)]


def hafs_spans(n: int, verses):
    """Absolute [t0, t1] in the Ḥafṣ file for each Baṣrī verse, via the Ḥafṣ word stream."""
    t = TIMINGS[str(n)]
    hafs = QURAN['surahs'][n - 1]['ayahs']
    by_ayah = {x['ayah']: x for x in t}
    # the Ḥafṣ text carries the basmalah inside verse 1 (and in al-Fātiḥah it IS verse 1) while the
    # recording and its timings do not; the Dūrī verses never include it (it is the header)
    hafs = [dict(a) for a in hafs]
    if n == 1:
        hafs = hafs[1:]
    elif n != 9 and len(hafs_words(hafs[0]['text'])) >= 4:
        hafs[0]['text'] = ' '.join(hafs_words(hafs[0]['text'])[4:])
    first_ayah = hafs[0]['numberInSurah']
    pts = [(0, by_ayah[first_ayah]['from'] / 1000.0 if first_ayah in by_ayah else 0.0)]
    wc = 0
    for a in hafs:
        nw = len(hafs_words(a['text']))
        tm = by_ayah.get(a['numberInSurah'])
        if tm and tm.get('words') and len(tm['words']) == nw:
            for k, (w0, w1) in enumerate(tm['words']):
                pts.append((wc + k + 1, w1 / 1000.0))
        elif tm:
            for k in range(nw):
                pts.append((wc + k + 1, (tm['from'] + (tm['to'] - tm['from']) * (k + 1) / nw) / 1000.0))
        else:
            for k in range(nw):
                pts.append((wc + k + 1, pts[-1][1]))
        wc += nw
    xs = np.array([p[0] for p in pts], dtype=float)
    ts = np.array([p[1] for p in pts], dtype=float)
    total_dw = sum(len(v['words']) for v in verses) or 1
    acc, spans = 0, []
    for v in verses:
        f0 = acc / total_dw
        acc += len(v['words'])
        f1 = acc / total_dw
        spans.append((float(np.interp(f0 * wc, xs, ts)), float(np.interp(f1 * wc, xs, ts))))
    return spans


COARSE = int(os.environ.get('ALIGN_COARSE', '5'))  # frames averaged for the global pass: 10 per second
BAND_S = float(os.environ.get('ALIGN_BAND', '150'))  # seconds either side of the expected tempo line


def coarsen(F: np.ndarray) -> np.ndarray:
    k = (len(F) // COARSE) * COARSE
    return F[:k].reshape(-1, COARSE, F.shape[1]).mean(axis=1)


def global_path(A: np.ndarray, B: np.ndarray, band: int, center=None):
    """Monotone alignment of the whole of A (Ḥafṣ) to the whole of B (Dūrī) inside a band around
    `center` (expected B frame per A frame; the tempo line when None); returns, for every frame
    of A, the matched frame of B, and how many rows touched the band edge."""
    n, m = len(A), len(B)
    ratio = m / max(1, n)
    if center is None:
        center = np.round(np.arange(n) * ratio).astype(np.int64)
    B2 = (B ** 2).sum(axis=1)
    INF = np.float32(1e30)
    width = 2 * band + 1
    cost = np.full((n, width), INF, dtype=np.float32)
    back = np.zeros((n, width), dtype=np.int8)  # 0 diag, 1 up (vertical), 2 left (horizontal)
    lo = np.zeros(n, dtype=np.int64)
    for i in range(n):
        lo[i] = max(0, min(m - width, int(center[i]) - band))
        j0, j1 = lo[i], min(m, lo[i] + width)
        d = np.sqrt(np.maximum(B2[j0:j1] - 2 * (B[j0:j1] @ A[i]) + (A[i] ** 2).sum(), 0)).astype(np.float32)
        if i == 0:
            cost[0, : j1 - j0] = np.cumsum(SLOPE * d)  # start at (0,0) only if band covers it: allow free start on row 0
            cost[0, : j1 - j0] = d + np.concatenate(([0], np.cumsum(SLOPE * d)[:-1]))
            back[0, : j1 - j0] = 2
            continue
        shift = lo[i] - lo[i - 1]
        prev = np.full(width + 1, INF, dtype=np.float32)
        # previous row re-indexed to this row's band (prev[k] = cost at column lo[i]+k-1 ... )
        src = cost[i - 1]
        k = np.arange(width)
        pk = k + shift  # index in previous band of the same column
        valid = (pk >= 0) & (pk < width)
        up = np.full(width, INF, dtype=np.float32)
        up[valid] = src[pk[valid]]
        pkd = pk - 1  # previous row, previous column (diagonal)
        validd = (pkd >= 0) & (pkd < width)
        diag = np.full(width, INF, dtype=np.float32)
        diag[validd] = src[pkd[validd]]
        dd = np.full(width, INF, dtype=np.float32)
        dd[: j1 - j0] = d
        up = up + SLOPE * dd
        diag = diag + dd
        use_diag = diag <= up
        base = np.where(use_diag, diag, up)
        bptr = np.where(use_diag, 0, 1).astype(np.int8)
        cs = np.cumsum(SLOPE * dd)
        val = base - cs
        acc = np.minimum.accumulate(val)
        kk = np.maximum.accumulate(np.where(val <= acc, k, 0))
        cur = cs + acc
        horiz = kk < k
        cost[i] = cur
        back[i] = np.where(horiz, 2, bptr)
        # for horizontal moves remember where we came from by storing the origin offset in a side table
        origin[i] = kk
    # end: both recordings end together, so the path must reach the last column of B
    i = n - 1
    kend = (m - 1) - lo[i]
    kbest = int(max(0, min(width - 1, kend)))
    if cost[i, kbest] >= INF:  # the band missed the corner: fall back to the cheapest reachable column
        kbest = int(np.argmin(cost[i]))
    match = np.zeros(n, dtype=np.int64)
    edge = 0
    while i >= 0:
        match[i] = lo[i] + kbest
        if kbest <= 1 or kbest >= width - 2:
            edge += 1
        mv = back[i, kbest]
        if mv == 2:
            kbest = int(origin[i, kbest])
            mv = 0 if True else mv
            # after a horizontal run we are at the diagonal/vertical cell that started it
            mv = back[i, kbest]
        if i == 0:
            break
        if mv == 0:
            kbest = kbest + (lo[i] - lo[i - 1]) - 1
        else:
            kbest = kbest + (lo[i] - lo[i - 1])
        kbest = max(0, min(width - 1, kbest))
        i -= 1
    return match, edge


origin = None


def align(reciter: str, n: int, mp3: Path):
    global origin
    s = sv.MUSHAF[n]
    verses = s['verses']
    x = sv.pcm(mp3)
    env = sv.envelope(mp3)
    dur = len(env) / sv.PER
    fine = sv.segments(env, 0.15, 0.2, min_len=0.3)
    gap_starts = np.array([b for a, b in fine[:-1]] if len(fine) > 1 else [])
    gap_ends = np.array([a for a, b in fine[1:]] if len(fine) > 1 else [])
    F = features(x)
    H = features(sv.pcm(hafs_audio(n)))
    # istiʿādhah / basmalah as before
    T = sv.templates()
    segs = sv.segments(env, 0.35, 0.12)
    t0 = segs[0][0] if segs else 0.0
    out = {'version': 1, 'reciter': reciter, 'surah': n}
    Sx = sv.feats(x, t0, min(dur, t0 + 12))
    cost_pre, end_pre = sv.open_end_dtw(T['preamble'], Sx)
    cost_bas, end_bas = sv.open_end_dtw(T['header'], Sx)
    if cost_pre < cost_bas and cost_pre < 4.2:
        pre_end = t0 + end_pre / sv.FPS
        out['preamble'] = [round(t0, 2), round(pre_end, 2)]
        t0 = next((a for a, b in segs if a >= pre_end - 0.3), pre_end)
        Sx = sv.feats(x, t0, min(dur, t0 + 12))
        cost_bas, end_bas = sv.open_end_dtw(T['header'], Sx)
    if s['header'] and cost_bas < 4.2:
        h_end = t0 + end_bas / sv.FPS
        out['header'] = [round(t0, 2), round(h_end, 2)]
        t0 = next((a for a, b in segs if a >= h_end - 0.3), h_end)
    hs = hafs_spans(n, verses)
    # global alignment of the recited part of both files (Ḥafṣ from its first verse, Dūrī from t0)
    h0 = hs[0][0]
    h1 = hs[-1][1]
    A = coarsen(H[int(h0 * FPS):int(h1 * FPS)])
    B = coarsen(F[int(t0 * FPS):])
    cfps = FPS / COARSE
    band = max(20, int(BAND_S * cfps))
    origin = np.zeros((len(A), 2 * band + 1), dtype=np.int32)
    # centre the band on the rough estimate we already have for each verse (proportional + pauses),
    # so a long sūrah's drift in pace does not pin the path to the band edge
    prior_file = APP / 'src' / 'content' / 'alignments' / reciter / f'{n:03d}.json'
    center = None
    if prior_file.exists():
        pj = json.load(open(prior_file, encoding='utf-8'))
        if pj.get('source') in ('auto-verses', 'hafs-dtw'):
            xs = np.array([hs[k][0] for k in range(len(verses))] + [h1])
            ys = np.array([pj['verses'][str(v['basri'])]['start'] for v in verses] + [dur])
            rows = np.arange(len(A)) / cfps + h0
            center = np.round((np.interp(rows, xs, ys) - t0) * cfps).astype(np.int64)
    match, edge = global_path(A, B, band, center)
    if DEBUG or edge:
        print(f'    band edge touched on {edge}/{len(A)} rows')

    def to_duri(t_hafs: float) -> float:
        i = (t_hafs - h0) * cfps
        i0 = int(max(0, min(len(match) - 1, np.floor(i))))
        i1 = int(max(0, min(len(match) - 1, i0 + 1)))
        frac = i - i0
        j = match[i0] + (match[i1] - match[i0]) * frac
        return t0 + j / cfps

    def refine_end(t_h: float, guess: float) -> float:
        """The last 1.6 s of the Ḥafṣ verse matched at full resolution near the coarse guess."""
        Tk = H[int(max(0, t_h - 1.6) * FPS):int(t_h * FPS)]
        w0, w1 = max(t0, guess - 4.0), min(dur, guess + 4.0)
        Sk = F[int(w0 * FPS):int(w1 * FPS)]
        if len(Tk) < 10 or len(Sk) < 20:
            return guess
        cost, _, b_f = subsequence_dtw(Tk, Sk)
        return w0 + b_f / FPS if cost < COST_MAX else guess

    def refine_start(t_h: float, guess: float) -> float:
        """The first 1.2 s of the Ḥafṣ verse matched at full resolution near the coarse guess."""
        Tk = H[int(t_h * FPS):int((t_h + 1.2) * FPS)]
        w0, w1 = max(t0, guess - 4.0), min(dur, guess + 4.0)
        Sk = F[int(w0 * FPS):int(w1 * FPS)]
        if len(Tk) < 10 or len(Sk) < 20:
            return guess
        cost, a_f, _ = subsequence_dtw(Tk, Sk)
        return w0 + a_f / FPS if cost < COST_MAX else guess

    # how well the path found the recording's own verse ends, before any snapping: the acceptance test
    quality = {'median': 9.0, 'within': 0.0}
    if len(gap_starts) and len(hs) > 1:
        raw_ends = np.array([to_duri(hb) for ha, hb in hs[:-1]])
        dist = np.abs(raw_ends[:, None] - gap_starts[None, :]).min(axis=1)
        quality = {'median': float(np.median(dist)), 'within': float(np.mean(dist <= 0.5))}
        if DIAG:
            d = np.sort(dist)
            print(f'    raw ends → nearest pause: median {quality["median"]:.2f}s  p90 {d[int(len(d)*0.9)]:.2f}s  within 0.5s {quality["within"]:.0%}')
    result = []
    prev_end = t0
    for k, v in enumerate(verses):
        ha, hb = hs[k]
        a, b = to_duri(ha), to_duri(hb)
        if REFINE:
            a = refine_start(ha, a) if k > 0 else a
            b = refine_end(hb, b) if k < len(verses) - 1 else b
        # inside a pause both recordings are silent and the path wanders, so: the verse starts at
        # the first sound after the mapped start, and ends at the last sound before the mapped end
        # snap: the nearest pause when one is close, else the first sound after / last sound before
        if len(gap_ends):
            j = int(np.argmin(np.abs(gap_ends - a)))
            if abs(gap_ends[j] - a) <= 0.8:
                a = float(gap_ends[j])
            else:
                after = gap_ends[gap_ends >= a - 0.4]
                if len(after) and after[0] - a <= 1.5:
                    a = float(after[0])
        if len(gap_starts):
            j = int(np.argmin(np.abs(gap_starts - b)))
            if abs(gap_starts[j] - b) <= 0.8:
                b = float(gap_starts[j])
            else:
                before = gap_starts[gap_starts <= b + 0.3]
                if len(before) and b - before[-1] <= 1.5:
                    b = float(before[-1])
        a = max(a, prev_end)
        b = max(b, a + 0.3)
        a, b = round(a, 2), round(b, 2)
        result.append((a, b))
        prev_end = b
    out['verses'] = {}
    for k, v in enumerate(verses):
        a, b = result[k]
        nxt = result[k + 1][0] if k + 1 < len(result) else dur
        prv = result[k - 1][1] if k > 0 else t0
        out['verses'][str(v['basri'])] = {'start': a, 'end': b, 'words': sv.proportional(v['words'], a, b), 'safe': [round(max(prv - 0.1, a - 0.35), 2), round(min(nxt + 0.1, b + 0.35), 2)]}
    out['auto'] = True
    out['source'] = 'hafs-dtw'
    out['quality'] = {'median_s': round(quality['median'], 2), 'within_half_s': round(quality['within'], 2)}
    return out, f'{len(verses)} verses aligned globally; raw ends a median {quality["median"]:.2f} s from a pause, {quality["within"]:.0%} within 0.5 s'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--reciter', default=sv.CFG['default'])
    ap.add_argument('--surahs', type=int, nargs='*')
    ap.add_argument('--check', action='store_true', help='align al-Fātiḥah and compare with the hand-placed file')
    a = ap.parse_args()
    audio = APP / 'public' / 'audio' / a.reciter
    dst = APP / 'src' / 'content' / 'alignments' / a.reciter
    if a.check:
        out, note = align(a.reciter, 1, audio / '001.mp3')
        hand = json.load(open(dst / '001.json', encoding='utf-8'))
        print('al-Fātiḥah:', note)
        for k in hand['verses']:
            h, g = hand['verses'][k], out['verses'][k]
            print(f"  v{k}: hand {h['start']:6.2f}–{h['end']:6.2f}   guided {g['start']:6.2f}–{g['end']:6.2f}   Δ {g['start']-h['start']:+.2f} / {g['end']-h['end']:+.2f}")
        return
    numbers = a.surahs or sorted(int(p.stem) for p in audio.glob('*.mp3'))
    for n in numbers:
        mp3 = audio / f'{n:03d}.mp3'
        if not mp3.exists():
            print(f'{n:3d}: no recording cached'); continue
        f = dst / f'{n:03d}.json'
        if f.exists() and json.load(open(f, encoding='utf-8')).get('source') == 'hand':
            print(f'{n:3d}: kept (placed by hand)'); continue
        try:
            out, note = align(a.reciter, n, mp3)
        except Exception as e:  # noqa: BLE001
            print(f'{n:3d}: failed: {e}'); continue
        # accept the guided file only when the path clearly found the recording's verse ends; a
        # sūrah of very short verses can defeat it, and then the pause-based file stays
        q = out['quality']
        # long sūrahs: the alternative (letter-proportional) drifts by whole verses, so a path whose
        # verse ends sit within a second of a pause is accepted even if fewer sit right on one
        long_surah = len(out['verses']) >= 50
        if q['median_s'] > 1.0 or (q['within_half_s'] < 0.3 and not long_surah):
            print(f'{n:3d}: guided path not trusted ({note}); kept the existing file', flush=True)
            continue
        json.dump(out, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print(f'{n:3d}: ok, {note}', flush=True)


if __name__ == '__main__':
    main()
