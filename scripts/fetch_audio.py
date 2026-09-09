#!/usr/bin/env python3
"""Download the Dūrī ʿan Abī ʿAmr sūrah recordings needed for v1 (PROMPT.md §6) at build time.

Files land in app/public/audio/<reciter>/<NNN>.mp3 (git-ignored; the app serves them from
/audio/...). Existing files are skipped, so re-running is cheap. Never hot-linked at runtime.

    python3 scripts/fetch_audio.py                 # default reciter, v1 sūrahs
    python3 scripts/fetch_audio.py --all-reciters  # every reciter in reciters.json
    python3 scripts/fetch_audio.py --surahs 1 112 114
"""
import argparse, json, sys, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CFG = json.load(open(ROOT / 'app' / 'src' / 'content' / 'reciters.json', encoding='utf-8'))
OUT = ROOT / 'app' / 'public' / 'audio'


def fetch(url: str, dst: Path) -> bool:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists() and dst.stat().st_size > 10_000:
        return True
    req = urllib.request.Request(url, headers={'User-Agent': 'nutq-tajweed/1.0 (build-time cache)'})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            ctype = r.headers.get('Content-Type', '')
            data = r.read()
        if 'audio' not in ctype or len(data) < 10_000:
            print(f'  ! unexpected response for {url}: {ctype} {len(data)} bytes', file=sys.stderr)
            return False
        tmp = dst.with_suffix('.part')
        tmp.write_bytes(data)
        tmp.replace(dst)
        print(f'  ok {dst.relative_to(ROOT)} ({len(data) // 1024} KB)')
        return True
    except Exception as e:  # noqa: BLE001
        print(f'  ! {url}: {e}', file=sys.stderr)
        return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--all-reciters', action='store_true')
    ap.add_argument('--reciter', action='append')
    ap.add_argument('--surahs', type=int, nargs='*')
    a = ap.parse_args()
    reciters = CFG['reciters']
    if not a.all_reciters:
        wanted = set(a.reciter or [CFG['default']])
        reciters = [r for r in reciters if r['id'] in wanted]
    surahs = a.surahs or CFG['v1Surahs']
    failed = 0
    for r in reciters:
        print(f'{r["nameEn"]} ({r["id"]})')
        for s in surahs:
            if not fetch(f'{r["server"]}{s:03d}.mp3', OUT / r['id'] / f'{s:03d}.mp3'):
                failed += 1
    if failed:
        print(f'{failed} file(s) failed; re-run to retry.', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
