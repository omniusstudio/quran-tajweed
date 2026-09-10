#!/usr/bin/env python3
"""Verse and word alignment by speech recognition (traceable, repeat-tolerant).

    scripts/align_ctc.py --surahs 1 2 3        # or: all
    scripts/align_ctc.py --check                # sūrah 1 against the hand-aligned file

How it works, in order:
  1. The recording is cut at silences into chunks of ~10–25 s and each chunk is run through a
     Qur'an-tuned wav2vec2 CTC model (rabah2026/wav2vec2-large-xlsr-53-arabic-quran-v_final),
     giving a letter-by-letter transcript with a time and a probability for every letter.
  2. The recognised words are matched to the muṣḥaf words (Ḥafṣ spelling, which the model was
     trained on; the Dūrī muṣḥaf has the same word count in every verse) by a banded
     sequence alignment. Recognised words that match nothing in order are checked against the
     preceding words: a reciter going back a few words is logged as a *repeat*, not drift.
  3. Muṣḥaf words the recogniser missed are placed by forced alignment inside the gap between
     their matched neighbours (local repair), and marked with low confidence.
  4. Verse ends are extended through the last word's sound to the pause. Word spans tile the
     verse (each word keeps the pause after it, which is how the app highlights).
Every sūrah also gets a report at data/ctc_reports/<reciter>/<NNN>.tsv: one line per word with
the recognised text, similarity, probability and how it was placed.

Output files carry source: 'ctc', a per-verse conf, quality {...} and repeats [...].
The hand-aligned file (source: hand) is never overwritten.
"""
from __future__ import annotations
import argparse, json, os, subprocess, sys, time
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / 'app'
MUSHAF = {s['number']: s for s in json.load(open(APP / 'src' / 'content' / 'mushaf.json', encoding='utf-8'))['surahs']}
MODEL = os.environ.get('CTC_MODEL', 'rabah2026/wav2vec2-large-xlsr-53-arabic-quran-v_final')
SR = 16000
HOP = 320            # model frame = 20 ms
FT = HOP / SR
ISTI = 'أَعُوذُ بِٱللَّهِ مِنَ ٱلشَّيْطَٰنِ ٱلرَّجِيمِ'
MIN_CHUNK, MAX_CHUNK = 1.5, 24.0
BAND = int(os.environ.get('CTC_BAND', 300))
LETTERS = set('ءآأؤإئابةتثجحخدذرزسشصضطظعغفقكلمنهوىي')


def pcm(mp3: Path) -> np.ndarray:
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(mp3), '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.float32)


def rms_db(x: np.ndarray) -> np.ndarray:
    n = len(x) // HOP
    fr = x[: n * HOP].reshape(n, HOP)
    return 20 * np.log10(np.sqrt((fr ** 2).mean(axis=1)) + 1e-7)


def chunks(db: np.ndarray, floor: float):
    """[(start_frame, end_frame)]: one breath group per chunk — cut in the middle of every pause of
    ≥ 0.3 s (the recogniser is sensitive to loudness changes inside a chunk, and a reciter drops the
    voice for the basmalah or the end of a verse), merged to ≥ MIN_CHUNK s, split at the quietest
    frame if a stretch has no pause for MAX_CHUNK s."""
    quiet = db < floor + 10
    n = len(db)
    cuts, run_start = [], None
    for i in range(n):
        if quiet[i]:
            if run_start is None: run_start = i
        elif run_start is not None:
            if i - run_start >= int(0.3 / FT): cuts.append((run_start + i) // 2)
            run_start = None
    out, a = [], 0
    for c in cuts + [n]:
        while c - a > int(MAX_CHUNK / FT):
            lo, hi = a + int(MIN_CHUNK / FT), a + int(MAX_CHUNK / FT)
            cut = lo + int(np.argmin(db[lo:hi]))
            out.append((a, cut)); a = cut
        if c - a >= int(MIN_CHUNK / FT) or c == n:
            if c > a: out.append((a, c))
            a = c
    return out


def bare(w: str) -> str:
    """Letters only, hamzah forms and the dagger alif folded, for comparing recognised and muṣḥaf words."""
    w = w.replace('ٱ', 'ا').replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا').replace('ٰ', 'ا').replace('ـ', '').replace('ى', 'ي')
    return ''.join(c for c in w if c in LETTERS)


def norm_text(w: str, vocab: dict) -> str:
    """A muṣḥaf word in the recogniser's alphabet: Dūrī small marks folded or dropped."""
    w = w.replace('ۡ', 'ْ').replace('ٗ', 'ٌ').replace('ٖ', 'ٍ').replace('ٞ', 'ً')
    w = w.replace('اِ۬', 'ٱ').replace('اَ۬', 'ٱ').replace('اُ۪', 'ٱ').replace('اُ۬', 'ٱ')
    return ''.join(c for c in w if c in vocab)


class Recogniser:
    def __init__(self, device: str | None):
        import torch
        from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor
        self.torch = torch
        self.proc = Wav2Vec2Processor.from_pretrained(MODEL)
        self.model = Wav2Vec2ForCTC.from_pretrained(MODEL).eval()
        self.dev = device or ('mps' if torch.backends.mps.is_available() else 'cpu')
        self.model.to(self.dev)
        self.vocab = self.proc.tokenizer.get_vocab()
        self.inv = {i: c for c, i in self.vocab.items()}
        self.blank, self.sep = self.vocab['<pad>'], self.vocab['|']

    def emissions(self, x: np.ndarray, spans):
        """Log-probs for the whole file, frame-aligned to 20 ms from t=0."""
        n_frames = len(x) // HOP
        E = np.full((n_frames, len(self.vocab)), -30.0, np.float32)
        E[:, self.blank] = 0.0
        with self.torch.no_grad():
            for a, b in spans:
                seg = x[a * HOP: b * HOP]
                inp = self.proc(seg, sampling_rate=SR, return_tensors='pt').input_values.to(self.dev)
                lp = self.torch.log_softmax(self.model(inp).logits[0].float(), -1).cpu().numpy()
                m = min(len(lp), b - a)
                E[a: a + m] = lp[:m]
        return E


def greedy_words(E: np.ndarray, inv: dict, blank: int, sep: int, spans=()):
    """Recognised words: {text, t0, t1, p} from the argmax path (t in seconds); a word never crosses a chunk cut."""
    ids = E.argmax(-1)
    cut_at = {a for a, _ in spans}
    words, cur, last = [], [], blank
    def flush():
        if cur:
            words.append({'text': ''.join(c for c, _, _ in cur), 't0': cur[0][1] * FT, 't1': (cur[-1][1] + 1) * FT,
                          'p': float(np.exp(np.mean([lp for _, _, lp in cur])))})
            cur.clear()
    for i, t in enumerate(ids):
        if i in cut_at: flush(); last = blank
        if t != blank and t != last:
            if t == sep: flush()
            else:
                cur.append((inv[int(t)], i, float(E[i, t])))
        last = t
    flush()
    return words


def match(ref: list[str], rec: list[dict]):
    """Banded Needleman–Wunsch between muṣḥaf words and recognised words.
    Returns (assign: ref index -> rec index or None, extras: unmatched rec indices)."""
    from rapidfuzz.distance import Levenshtein
    R, H = len(ref), len(rec)
    rb = [bare(w) for w in ref]; hb = [bare(w['text']) for w in rec]
    cache = {}
    def sim(i, j):
        k = (rb[i], hb[j])
        s = cache.get(k)
        if s is None:
            s = Levenshtein.normalized_similarity(rb[i], hb[j]); cache[k] = s
        return s
    def sim2(i, j):   # muṣḥaf word i against recognised fragments j-1 and j joined
        return Levenshtein.normalized_similarity(rb[i], hb[j - 1] + hb[j])
    def simS(i, j):   # muṣḥaf words i-1 and i joined against recognised token j (the recogniser glued them)
        return Levenshtein.normalized_similarity(rb[i - 1] + rb[i], hb[j])
    GAP_R, GAP_H = -0.6, -0.45          # missed muṣḥaf word / extra recognised word
    NEG = -1e9
    ratio = H / max(R, 1)
    lo = [max(0, int(i * ratio) - BAND) for i in range(R + 1)]
    hi = [min(H, int(i * ratio) + BAND) for i in range(R + 1)]
    S = [dict() for _ in range(R + 1)]
    B = [dict() for _ in range(R + 1)]
    S[0][0] = 0.0
    for j in range(1, hi[0] + 1): S[0][j] = j * GAP_H; B[0][j] = 'h'
    for i in range(1, R + 1):
        for j in range(lo[i], hi[i] + 1):
            best, arg = NEG, None
            v = S[i - 1].get(j)
            if v is not None and v + GAP_R > best: best, arg = v + GAP_R, 'r'
            v = S[i].get(j - 1) if j > 0 else None
            if v is not None and v + GAP_H >= best: best, arg = v + GAP_H, 'h'   # ties prefer skipping earlier recognised words (keeps the last rendition)
            if j > 0:
                v = S[i - 1].get(j - 1)
                if v is not None:
                    sc = v + (2 * sim(i - 1, j - 1) - 1)
                    if sc > best: best, arg = sc, 'm'
            if j > 1:
                v = S[i - 1].get(j - 2)
                if v is not None:
                    sc = v + (2 * sim2(i - 1, j - 1) - 1) - 0.1
                    if sc > best: best, arg = sc, 'M'
            if j > 0 and i > 1:
                v = S[i - 2].get(j - 1)
                if v is not None:
                    sc = v + 2 * (2 * simS(i - 1, j - 1) - 1) - 0.1
                    if sc > best: best, arg = sc, 'S'
            if arg: S[i][j] = best; B[i][j] = arg
    i, j = R, H
    if j not in S[i]: j = max(S[i])
    assign, used = [None] * R, set()
    while i > 0 or j > 0:
        b = B[i].get(j)
        if b == 'm':
            if sim(i - 1, j - 1) >= 0.45: assign[i - 1] = j - 1; used.add(j - 1)
            i, j = i - 1, j - 1
        elif b == 'M':
            if sim2(i - 1, j - 1) >= 0.45: assign[i - 1] = (j - 2, j - 1); used.update((j - 2, j - 1))
            i, j = i - 1, j - 2
        elif b == 'S':
            if simS(i - 1, j - 1) >= 0.45:
                assign[i - 2] = ('split', j - 1, 0, simS(i - 1, j - 1)); assign[i - 1] = ('split', j - 1, 1, simS(i - 1, j - 1)); used.add(j - 1)
            i, j = i - 2, j - 1
        elif b == 'r': i -= 1
        elif b == 'h': j -= 1
        else: break
    extras = [j for j in range(H) if j not in used]
    return assign, extras, sim


def forced(E: np.ndarray, a: int, b: int, text: str, vocab: dict, blank: int):
    """Place the letters of `text` inside frames [a, b) by forced alignment; returns per-word (t0, t1, p)."""
    import torch, torchaudio
    toks = [vocab['|'] if c == ' ' else vocab[c] for c in text if c == ' ' or c in vocab]
    if b - a < 2 * len(toks) + 2 or not toks:
        return None
    em = torch.tensor(E[a:b])[None]
    try:
        ali, sc = torchaudio.functional.forced_align(em, torch.tensor([toks]), blank=blank)
    except Exception:
        return None
    spans = torchaudio.functional.merge_tokens(ali[0], sc[0].exp())
    out, cur = [], []
    for sp in spans:
        if sp.token == vocab['|']:
            if cur: out.append(((a + cur[0].start) * FT, (a + cur[-1].end) * FT, float(np.mean([c.score for c in cur])))); cur = []
        else: cur.append(sp)
    if cur: out.append(((a + cur[0].start) * FT, (a + cur[-1].end) * FT, float(np.mean([c.score for c in cur]))))
    return out


def extend_to_pause(db: np.ndarray, floor: float, t: float, limit: float, max_ext=1.5) -> float:
    """From t, move right while the signal is above the noise floor (a held madd / ghunnah), up to limit."""
    i, end = int(t / FT), min(int(limit / FT), int((t + max_ext) / FT), len(db))
    while i < end and db[i] > floor + 10: i += 1
    return min(i * FT, limit)


def reference(n: int):
    """[(group, index, hafs_word)] — group is 'isti', 'header' or a Baṣrī verse number."""
    s = MUSHAF[n]
    ref = [('isti', i, w) for i, w in enumerate(ISTI.split())]
    if s.get('header'):
        ref += [('header', i, w) for i, w in enumerate(s['header'].split())]
    for v in s['verses']:
        # Ḥafṣ spelling (what the recogniser learned) when the muṣḥaf data has it, else the Dūrī word
        ref += [(v['basri'], i, h or w) for i, (w, h) in enumerate(zip(v['words'], v['hafs']))]
    return ref


def build(rec: Recogniser, reciter: str, n: int, mp3: Path, report_dir: Path, verbose=False):
    t0 = time.time()
    x = pcm(mp3)
    db = rms_db(x)
    floor = float(np.percentile(db, 5))
    spans = chunks(db, floor)
    E = rec.emissions(x, spans)
    words = greedy_words(E, rec.inv, rec.blank, rec.sep, spans)
    ref = reference(n)
    ref_norm = [norm_text(w, rec.vocab) for _, _, w in ref]
    assign, extras, sim = match(ref_norm, words)

    # placement: matched → recognised span; missed → forced alignment inside the gap
    place = [None] * len(ref)     # (t0, t1, prob, how, sim)
    def heard(j):
        if isinstance(j, int): return words[j]['text']
        if j[0] == 'split': return words[j[1]]['text'] + ('⌐' if j[2] == 0 else '¬')
        return words[j[0]]['text'] + '+' + words[j[1]]['text']
    for i, j in enumerate(assign):
        if isinstance(j, tuple) and j[0] == 'split':
            w = words[j[1]]; a, b = (i, i + 1) if j[2] == 0 else (i - 1, i)
            la, lb = max(1, len(bare(ref_norm[a]))), max(1, len(bare(ref_norm[b])))
            cut = w['t0'] + (w['t1'] - w['t0']) * la / (la + lb)
            place[i] = (w['t0'], cut, w['p'], 'rec', j[3]) if j[2] == 0 else (cut, w['t1'], w['p'], 'rec', j[3])
        elif isinstance(j, tuple):
            w0, w1 = words[j[0]], words[j[1]]
            place[i] = (w0['t0'], w1['t1'], min(w0['p'], w1['p']), 'rec', __import__('rapidfuzz').distance.Levenshtein.normalized_similarity(bare(ref_norm[i]), bare(w0['text'] + w1['text'])))
        elif j is not None:
            w = words[j]; place[i] = (w['t0'], w['t1'], w['p'], 'rec', sim(i, j))
    i = 0
    while i < len(ref):
        if place[i] is not None: i += 1; continue
        k = i
        while k < len(ref) and place[k] is None: k += 1
        left = place[i - 1][1] if i > 0 else 0.0
        right = place[k][0] if k < len(ref) else len(db) * FT
        got = forced(E, int(left / FT), int(right / FT), ' '.join(ref_norm[i:k]), rec.vocab, rec.blank) if right - left > 0.1 else None
        if got and len(got) == k - i:
            for m, (a, b, p) in enumerate(got): place[i + m] = (a, b, p * 0.5, 'forced', 0.0)
        else:
            step = (right - left) / (k - i)
            for m in range(k - i): place[i + m] = (left + m * step, left + (m + 1) * step, 0.0, 'spread', 0.0)
        i = k

    # repeats: unmatched recognised words that echo one of the preceding muṣḥaf words
    repeats = []
    ref_bare = [bare(w) for w in ref_norm]
    for j in extras:
        wb = bare(words[j]['text'])
        if len(wb) < 2: continue
        prev = [i for i, p in enumerate(place) if p[0] <= words[j]['t0']]
        window = prev[-14:] if prev else []
        hit = max(window, key=lambda i: __import__('rapidfuzz').distance.Levenshtein.normalized_similarity(ref_bare[i], wb), default=None)
        if hit is not None and __import__('rapidfuzz').distance.Levenshtein.normalized_similarity(ref_bare[hit], wb) >= 0.75:
            g, idx, _ = ref[hit]
            repeats.append({'at': round(words[j]['t0'], 2), 'heard': words[j]['text'], 'verse': g, 'word': idx})

    # assemble verses
    groups: dict = {}
    for (g, idx, w), p in zip(ref, place): groups.setdefault(g, []).append(p)
    out_verses, confs, ends_raw = {}, [], []
    s = MUSHAF[n]
    keys = [v['basri'] for v in s['verses']]
    starts = {}
    for k in keys:
        starts[k] = max(0.0, groups[k][0][0] - 0.04)
    prev_end = 0.0
    for vi, k in enumerate(keys):
        ps = groups[k]
        nxt = starts[keys[vi + 1]] if vi + 1 < len(keys) else len(db) * FT
        vstart = max(starts[k], prev_end)                       # never before the previous verse's end
        vend = extend_to_pause(db, floor, ps[-1][1], nxt - 0.05)
        vend = max(vend, ps[-1][1], vstart + 0.2)
        if vi + 1 < len(keys): vend = max(min(vend, nxt), vstart + 0.2)   # never past the next verse's start
        nxt = max(nxt, vend)
        bounds = [vstart] + [max(vstart, min(ps[m][0] - 0.02, nxt)) for m in range(1, len(ps))] + [vend]
        for m in range(1, len(bounds)): bounds[m] = max(bounds[m], bounds[m - 1] + 0.02)
        bounds[-1] = max(bounds[-1], bounds[-2] + 0.02)
        wspans = [[round(bounds[m], 3), round(bounds[m + 1], 3)] for m in range(len(ps))]
        conf = float(np.mean([p[2] * (0.5 + 0.5 * p[4]) for p in ps]))
        confs.append(conf)
        out_verses[str(k)] = {'start': wspans[0][0], 'end': wspans[-1][1], 'words': wspans,
                              'safe': [round(max(prev_end - 0.05, wspans[0][0] - 0.25), 3), round(min(nxt + 0.05, wspans[-1][1] + 0.25), 3)],
                              'conf': round(conf, 3)}
        prev_end = wspans[-1][1]
    matched = sum(1 for p in place if p[3] == 'rec' and p[4] >= 0.8) / len(place)
    verse_words = [p for (g, _, _), p in zip(ref, place) if g not in ('isti', 'header')]
    matched_v = sum(1 for p in verse_words if p[3] == 'rec' and p[4] >= 0.8) / len(verse_words)
    out = {'version': 1, 'reciter': reciter, 'surah': n, 'auto': True, 'source': 'ctc', 'model': MODEL}
    for g in ('isti', 'header'):
        if g in groups:
            ps = groups[g]
            ok = [p for p in ps if p[3] == 'rec' and p[4] >= 0.7]
            if len(ok) >= len(ps) - 1:
                span = [round(max(0.0, ps[0][0] - 0.04), 2), round(extend_to_pause(db, floor, ps[-1][1], starts[keys[0]] - 0.05), 2)]
                out['preamble' if g == 'isti' else 'header'] = span
    out['verses'] = out_verses
    out['quality'] = {'matched': round(matched_v, 3), 'mean_conf': round(float(np.mean(confs)), 3),
                      'low_conf_verses': [k for k, c in zip(keys, confs) if c < 0.5], 'repeats': len(repeats),
                      'extras': len(extras) - len(repeats)}
    if repeats: out['repeats'] = repeats

    # report
    report_dir.mkdir(parents=True, exist_ok=True)
    with open(report_dir / f'{n:03d}.tsv', 'w', encoding='utf-8') as f:
        f.write('group\tword\tmushaf\theard\tsim\tprob\thow\tt0\tt1\n')
        for (g, idx, w), p, j in zip(ref, place, assign):
            f.write(f"{g}\t{idx}\t{w}\t{heard(j) if j is not None else ''}\t{p[4]:.2f}\t{p[2]:.2f}\t{p[3]}\t{p[0]:.2f}\t{p[1]:.2f}\n")
        if extras:
            f.write('\n# recognised but not in the text (repeats are listed in the json)\n')
            for j in extras: f.write(f"extra\t\t\t{words[j]['text']}\t\t{words[j]['p']:.2f}\t\t{words[j]['t0']:.2f}\t{words[j]['t1']:.2f}\n")
    info = (f"{n:3d}: {len(keys)} verses, {len(words)} words heard, {matched_v:.0%} of verse words matched, "
            f"mean conf {np.mean(confs):.2f}, {len(repeats)} repeats, {len(extras) - len(repeats)} extras, {time.time() - t0:.0f}s")
    return out, info


def check(out: dict, hand: dict):
    print('preamble', out.get('preamble'), 'hand', hand.get('preamble'))
    print('header  ', out.get('header'), 'hand', hand.get('header'))
    ds = []
    for k, v in out['verses'].items():
        h = hand['verses'][k]
        ds += [abs(v['start'] - h['start']), abs(v['end'] - h['end'])]
        print(f"v{k}: ctc {v['start']:6.2f}-{v['end']:6.2f}  hand {h['start']:6.2f}-{h['end']:6.2f}  Δ {v['start'] - h['start']:+.2f}/{v['end'] - h['end']:+.2f}  conf {v['conf']}")
    print(f"verse boundaries: max |Δ| {max(ds):.2f} s, mean {np.mean(ds):.2f} s")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--surahs', nargs='+', default=['all'])
    ap.add_argument('--reciter', default='nourin_siddig')
    ap.add_argument('--device', default=None)
    ap.add_argument('--check', action='store_true', help='compare sūrah 1 with the hand-aligned file, write nothing')
    ap.add_argument('--min-matched', type=float, default=0.85)
    a = ap.parse_args()
    audio = APP / 'public' / 'audio' / a.reciter
    outdir = APP / 'src' / 'content' / 'alignments' / a.reciter
    report_dir = ROOT / 'data' / 'ctc_reports' / a.reciter
    rec = Recogniser(a.device)
    if a.check:
        out, info = build(rec, a.reciter, 1, audio / '001.mp3', report_dir)
        print(info); check(out, json.load(open(outdir / '001.json', encoding='utf-8'))); return
    nums = sorted(int(p.stem) for p in audio.glob('*.mp3')) if a.surahs == ['all'] else [int(s) for s in a.surahs]
    for n in nums:
        mp3 = audio / f'{n:03d}.mp3'
        if not mp3.exists(): print(f'{n:3d}: no recording'); continue
        dest = outdir / f'{n:03d}.json'
        if dest.exists():
            old = json.load(open(dest, encoding='utf-8'))
            if old.get('source') == 'hand': print(f'{n:3d}: hand-aligned, kept'); continue
        out, info = build(rec, a.reciter, n, mp3, report_dir)
        if out['quality']['matched'] < a.min_matched:
            print(f"{n:3d}: NOT WRITTEN, only {out['quality']['matched']:.0%} of words matched — see report; {info}"); continue
        json.dump(out, open(dest, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
        print(info, flush=True)


if __name__ == '__main__':
    main()
