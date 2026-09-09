#!/usr/bin/env bash
# Install نُطق as a Mac app: build, copy the built app + server + recordings to
# ~/Library/Application Support/nutq (off the external drive, which Dock-launched apps and launchd
# agents may not read), install the launchd agent that serves it, and put the launcher bundle in
# ~/Applications so it can be dragged to the Dock. Re-run after changing the code.
#
#   bash scripts/install_app.sh        # or: cd app && npm run install-app
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$HOME/Library/Application Support/nutq"
LABEL="com.omniusstudio.nutq"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
APPDIR="$HOME/Applications"
PORT=7373

PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
NVM_NODE=$(ls -d "$HOME"/.nvm/versions/node/*/bin 2>/dev/null | sort -V | tail -1)
[ -n "$NVM_NODE" ] && PATH="$NVM_NODE:$PATH"
export PATH
command -v node >/dev/null || { echo "node not found; install Node.js first"; exit 1; }

echo "▸ building"
cd "$ROOT/app"
[ -d node_modules ] || npm install --no-audit --no-fund
npm run build >/dev/null

echo "▸ copying to $DEST"
mkdir -p "$DEST/public" "$DEST/.local"
rsync -a --delete "$ROOT/app/dist/" "$DEST/dist/"
rsync -a --delete "$ROOT/app/server/" "$DEST/server/"
if [ -d "$ROOT/app/public/audio" ]; then
  rsync -a "$ROOT/app/public/audio/" "$DEST/public/audio/"
else
  echo "  (no recordings yet: run \`npm run audio\` in app/ and install again)"
fi
if [ ! -d "$DEST/node_modules/qrcode" ]; then
  printf '{ "name": "nutq-runtime", "private": true, "type": "module", "dependencies": { "qrcode": "^1.5.4" } }\n' > "$DEST/package.json"
  (cd "$DEST" && npm install --omit=dev --no-audit --no-fund >/dev/null)
fi

echo "▸ launchd agent $LABEL"
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$DEST/server/start.sh</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/nutq.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/nutq.log</string>
</dict></plist>
PL
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
for i in $(seq 1 40); do lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1 && break; sleep 0.25; done
lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1 && echo "  serving http://localhost:$PORT/" || echo "  server did not start; see ~/Library/Logs/nutq.log"

echo "▸ launcher"
mkdir -p "$APPDIR"
rsync -a --delete "$ROOT/نُطق.app/" "$APPDIR/نُطق.app/"
touch "$APPDIR/نُطق.app"
# an open نُطق window gets the new build right away
if pgrep -xq "Google Chrome"; then
  osascript -e 'tell application "Google Chrome" to repeat with w in windows' -e 'repeat with t in tabs of w' -e 'if URL of t starts with "http://localhost:7373" then reload t' -e 'end repeat' -e 'end repeat' 2>/dev/null || true
fi
echo
echo "Done. Drag  $APPDIR/نُطق.app  to the Dock. Phone: Settings → على هاتفك."
