#!/usr/bin/env bash
# Converts the cached MP3 recordings in app/public/audio/<reciter>/ to AAC (.m4a) next to them.
# Browsers seek MP3s without a seek table by estimating byte positions, which lands up to several
# seconds late deep into a long sūrah; an MP4 container has a sample table, so seeks are exact.
# The server does the same conversion on demand for a recording fetched later.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FFMPEG="$(command -v ffmpeg || ls /usr/local/bin/ffmpeg /opt/homebrew/bin/ffmpeg 2>/dev/null | head -1)"
[ -n "$FFMPEG" ] || { echo "ffmpeg not found" >&2; exit 1; }
n=0
for mp3 in "$ROOT"/app/public/audio/*/*.mp3; do
  m4a="${mp3%.mp3}.m4a"
  [ -s "$m4a" ] && continue
  "$FFMPEG" -v error -y -i "$mp3" -map 0:a -c:a aac -b:a 96k -movflags +faststart "$m4a.part.m4a" && mv "$m4a.part.m4a" "$m4a"
  n=$((n + 1)); echo "converted ${mp3#$ROOT/app/public/audio/}"
done
echo "done: $n new file(s)"
