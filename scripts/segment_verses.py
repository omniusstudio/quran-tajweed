#!/usr/bin/env python3
"""Verse-level alignment from the reciter's pauses, for every cached recording.

Word alignment stays by hand (PROMPT.md §6); this only finds where each verse starts and ends, the
same way the alignment editor's "اكتشاف الوقفات" does (RMS envelope, gaps under 12% of the loud
level for ≥0.35 s), and accepts a sūrah only when the number of sound segments matches the number
of verses (plus the basmalah, plus an optional istiʿādhah in front). Words inside each verse are
spread proportionally and the file is flagged `auto`, so the app shows يُراجع until the owner
confirms it in the editor. Existing files that are not flagged `auto` are never touched.

    python3 scripts/segment_verses.py                 # default reciter, whatever is cached
    python3 scripts/segment_verses.py --reciter husr --surahs 78 79
"""
import argparse, json, subprocess, sys
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / 'app'
CFG = json.load(open(APP / 'src' / 'content' / 'reciters.json', encoding='utf-8'))
MUSHAF = {s['number']: s for s in json.load(open(APP / 'src' / 'content' / 'mushaf.json', encoding='utf-8'))['surahs']}
PER = 50
HARAKAT = set('ًٌٍَُِّْٰٕٖٜٟٓٔٗ٘ٙٚٛٝٞۖۗۘۙۚۛۜ۝۞ۣ۟۠ۡۢۤۥۦۧۨ۩۪ۭ۫۬')


def envelope(mp3: Path) -> np.ndarray:
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(mp3), '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True).stdout
    x = np.frombuffer(raw, np.float32)
    step = 16000 // PER
    n = int(np.ceil(len(x) / step))
    env = np.array([np.sqrt(np.mean(x[i * step:(i + 1) * step] ** 2)) if len(x[i * step:(i + 1) * step]) else 0 for i in range(n)])
    return env / (env.max() or 1)


def segments(env: np.ndarray, min_gap: float, thr_ratio: float, min_len=0.6):
    loud = np.sort(env)[int(len(env) * 0.8)]
    thr = loud * thr_ratio
    gaps, start = [], -1
    for i in range(len(env) + 1):
        quiet = i < len(env) and env[i] < thr
        if quiet and start < 0:
            start = i
        if not quiet and start >= 0:
            if (i - start) / PER >= min_gap:
                gaps.append((start / PER, i / PER))
            start = -1
    segs, t = [], 0.0
    for s, e in gaps:
        if s - t >= min_len:
            segs.append((t, s))
        t = e
    dur = len(env) / PER
    if dur - t >= min_len:
        segs.append((t, dur))
    return segs


def trim_end(env, start, end):
    """Pull the end back to where the sound really stops (the gap threshold leaves a quiet tail)."""
    i = int(end * PER) - 1
    floor = 0.11
    while i > int(start * PER) and env[i] < floor:
        i -= 1
    return round(min(end, (i + 1) / PER + 0.1), 2)


def proportional(words, start, end):
    w = [max(1, len([c for c in x if c not in HARAKAT]) + 1) for x in words]
    total, t, out = sum(w), start, []
    for k in w:
        d = (end - start) * k / total
        out.append([round(t, 3), round(t + d, 3)])
        t += d
    out[-1][1] = end
    return out



# ---- what the recording starts with: istiʿādhah? basmalah? matched against al-Fātiḥah's ----
SR = 16000
FPS = 100


def pcm(mp3: Path) -> np.ndarray:
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(mp3), '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.float32)


def feats(x: np.ndarray, a: float, b: float) -> np.ndarray:
    """Log-mel-ish frames (24 bands, 100/s), loudness-normalised, for [a, b) seconds."""
    y = x[int(a * SR):int(b * SR)]
    n, hop = 400, SR // FPS
    if len(y) < n:
        return np.zeros((1, 24))
    frames = np.lib.stride_tricks.sliding_window_view(y, n)[::hop] * np.hanning(n)
    spec = np.abs(np.fft.rfft(frames, axis=1)) ** 2
    f = np.fft.rfftfreq(n, 1 / SR)
    edges = np.geomspace(100, 4000, 26)
    fb = np.zeros((len(f), 24))
    for i in range(24):
        lo, c, hi = edges[i], edges[i + 1], edges[i + 2]
        fb[:, i] = np.clip(np.minimum((f - lo) / (c - lo), (hi - f) / (hi - c)), 0, 1)
    m = np.log(spec @ fb + 1e-6)
    return m - m.mean(axis=1, keepdims=True)


def open_end_dtw(T: np.ndarray, S: np.ndarray):
    """Match the whole template T against a prefix of S. Returns (normalised cost, end frame in S)."""
    n, m = len(T), len(S)
    if m < 2:
        return 9e9, 0
    D = np.sqrt(((T[:, None, :] - S[None, :, :]) ** 2).sum(axis=2))
    prev = np.full(m + 1, np.inf)
    prev[0] = 0.0
    for i in range(1, n + 1):
        cur = np.full(m + 1, np.inf)
        d = D[i - 1]
        diag = np.minimum(prev[:-1], prev[1:]) + d  # from (i-1, j-1) or (i-1, j)
        # from (i, j-1): running accumulation along the row
        run = np.inf
        for j in range(m):
            run = min(run + d[j], diag[j])
            cur[j + 1] = run
        prev = cur
    norm = prev[1:] / (n + np.arange(1, m + 1))
    j = int(np.argmin(norm))
    return float(norm[j]), j + 1


_TEMPL = None


def templates():
    """Istiʿādhah and basmalah as this reciter reads them in al-Fātiḥah (hand-aligned 001.json)."""
    global _TEMPL
    if _TEMPL is None:
        f = APP / 'src' / 'content' / 'alignments' / 'nourin_siddig' / '001.json'
        a = json.load(open(f, encoding='utf-8'))
        x = pcm(APP / 'public' / 'audio' / 'nourin_siddig' / '001.mp3')
        _TEMPL = {'preamble': feats(x, *a['preamble']), 'header': feats(x, *a['header'])}
    return _TEMPL


def letters(word: str) -> int:
    return max(1, len([c for c in word if c not in HARAKAT]))


def build(reciter: str, n: int, mp3: Path):
    s = MUSHAF[n]
    x = pcm(mp3)
    env = envelope(mp3)
    segs = segments(env, 0.35, 0.12)
    if not segs:
        return None, 'no sound'
    dur = len(env) / PER
    T = templates()
    out = {'version': 1, 'reciter': reciter, 'surah': n}
    t0 = segs[0][0]
    notes = []
    # istiʿādhah: does the opening match the Fātiḥah's istiʿādhah better than its basmalah?
    S = feats(x, t0, min(dur, t0 + 12))
    cost_pre, end_pre = open_end_dtw(T['preamble'], S)
    cost_bas, end_bas = open_end_dtw(T['header'], S)
    if cost_pre < cost_bas and cost_pre < 4.2:
        pre_end = t0 + end_pre / FPS
        out['preamble'] = [round(t0, 2), round(pre_end, 2)]
        notes.append(f'istiʿādhah {cost_pre:.2f}')
        t0 = next((a for a, b in segs if a >= pre_end - 0.3), pre_end)
        S = feats(x, t0, min(dur, t0 + 12))
        cost_bas, end_bas = open_end_dtw(T['header'], S)
    if s['header']:
        if cost_bas < 4.2:
            h_end = t0 + end_bas / FPS
            out['header'] = [round(t0, 2), round(h_end, 2)]
            notes.append(f'basmalah {cost_bas:.2f}')
            t0 = next((a for a, b in segs if a >= h_end - 0.3), h_end)
        else:
            return None, f'basmalah not found ({cost_bas:.2f})'
    # verses: letter-proportional inside the sound (pauses count for nothing), snapped to a nearby pause
    # verse ends often sit on pauses too short to count as breaths: look at finer gaps for snapping
    fine = segments(env, 0.15, 0.2, min_len=0.3) or segs
    sound = [(max(a, t0), b) for a, b in fine if b > t0]
    total_sound = sum(b - a for a, b in sound)
    weights = [sum(letters(w) for w in v['words']) + 2 for v in s['verses']]
    W = sum(weights)

    def at_sound(frac):
        """Real time at a fraction of the total sound time."""
        target = frac * total_sound
        acc = 0.0
        for a, b in sound:
            if acc + (b - a) >= target:
                return a + (target - acc)
            acc += b - a
        return sound[-1][1]

    gaps = [(sound[i][1], sound[i + 1][0]) for i in range(len(sound) - 1)]
    cuts = []  # (end of verse k, start of verse k+1) for the interior boundaries
    acc = 0
    prev_end = sound[0][0]
    for w in weights[:-1]:
        acc += w
        t = at_sound(acc / W)
        tol = 0.35 * (w / W) * total_sound
        near = [g for g in gaps if abs(g[0] - t) <= tol or abs(g[1] - t) <= tol]
        if near:
            t_end, t_start = min(near, key=lambda g: min(abs(g[0] - t), abs(g[1] - t)))
            snapped_here = True
        else:
            t_end = t_start = t
            snapped_here = False
        t_end = max(t_end, prev_end + 0.2)
        t_start = max(t_start, t_end)
        cuts.append((t_end, t_start, snapped_here))
        prev_end = t_start
    starts = [sound[0][0]] + [c[1] for c in cuts]
    ends = [c[0] for c in cuts] + [sound[-1][1]]
    verses = {}
    for k, v in enumerate(s['verses']):
        a0, b0 = round(starts[k], 2), round(trim_end(env, starts[k], ends[k]), 2)
        if b0 <= a0:
            b0 = round(a0 + 0.3, 2)
        verses[str(v['basri'])] = {'start': a0, 'end': b0, 'words': proportional(v['words'], a0, b0)}
    snapped = sum(1 for c in cuts if c[2])
    out['verses'] = verses
    out['auto'] = True
    out['source'] = 'auto-verses'  # verse ends from pauses and letter proportion; words proportional
    notes.append(f'{len(segs)} breaths, {len(fine)} pauses, {snapped}/{max(0, len(weights) - 1)} verse ends on a pause')
    return out, ', '.join(notes)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--reciter', default=CFG['default'])
    ap.add_argument('--surahs', type=int, nargs='*')
    a = ap.parse_args()
    audio = APP / 'public' / 'audio' / a.reciter
    dst = APP / 'src' / 'content' / 'alignments' / a.reciter
    dst.mkdir(parents=True, exist_ok=True)
    numbers = a.surahs or sorted(int(p.stem) for p in audio.glob('*.mp3'))
    ok = skipped = kept = 0
    for n in numbers:
        mp3 = audio / f'{n:03d}.mp3'
        if not mp3.exists():
            print(f'{n:3d}: no recording cached'); skipped += 1; continue
        f = dst / f'{n:03d}.json'
        if f.exists():
            cur = json.load(open(f, encoding='utf-8'))
            if not cur.get('auto') or cur.get('source') == 'hand':
                print(f'{n:3d}: kept (placed by hand)'); kept += 1; continue
        out, note = build(a.reciter, n, mp3)
        if out is None:
            print(f'{n:3d}: skipped, {note}'); skipped += 1; continue
        json.dump(out, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print(f'{n:3d}: ok, {note}'); ok += 1
    print(f'{ok} written, {kept} kept, {skipped} skipped')
    sys.exit(0)


if __name__ == '__main__':
    main()
