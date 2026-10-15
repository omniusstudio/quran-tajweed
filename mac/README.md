# شريط نُطق — the native ticker

A SwiftUI + AppKit menu-bar app (no browser, no server needed) that keeps one verse on a strip above every
app, follows the recitation word by word, and runs the repeat-to-memorize sessions.

- Build and install: `bash scripts/build_mac_ticker.sh` → `~/Applications/شريط نُطق.app`
- The muṣḥaf text (with its tajwīd colours), the verse numbering and the alignments are exported from the
  web app's own sources (`mac/tools/export_data.ts`), so the two never drift.
- Recordings: reuses the web app's cache in `~/Library/Application Support/nutq/` when it has the sūrah,
  otherwise fetches it once from the reciter's server and converts it to AAC (exact seeking) into
  `~/Library/Application Support/NutqTicker/audio/`.
- The memorized ledger is kept in `~/Library/Application Support/NutqTicker/ledger.json` and merged with the
  web app's through its local server (`http://127.0.0.1:7373/__state`) whenever that is running.
- Shortcuts (⌃⌥ + …): Space play/pause, ← next verse, → previous verse, H hide/show, M mute, R open the menu.
- Development: `NUTQ_RES=mac/build/Resources NUTQ_SUPPORT=/tmp/x NUTQ_NOSYNC=1 NUTQ_MUTE=1 swift run`;
  `--selftest` plays a short muted session; `NUTQ_DEMO=<scenario>:<out.png>` renders the strip to a PNG
  (idle, hover, veil, veil3, gap, prompt, loading, long, dark, play, click).

## Packaging for other people

`bash scripts/package_mac_ticker.sh 1.0.0` builds a universal (Apple silicon + Intel, macOS 14+) app, signs it with the
Omnius Studio Developer ID with the hardened runtime, notarizes it with the `soli-notary` keychain profile, staples it and
puts it in a signed, notarized disk image at `mac/dist/NutqTicker-<version>.dmg` (about 3 MB; recordings are fetched on first
use). Set `NUTQ_SKIP_NOTARIZE=1` for a signed-only local build.
