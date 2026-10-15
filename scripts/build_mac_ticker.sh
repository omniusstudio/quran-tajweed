#!/usr/bin/env bash
# Builds the native always-on-top ticker (mac/NutqTicker, SwiftUI + AppKit) into an app bundle and
# installs it to ~/Applications. The text, tajwīd colours and alignments come from the web app's own
# sources, so the two never drift. Needs Xcode's command-line tools; no ffmpeg or browser at run time.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MAC="$ROOT/mac"
RES="$MAC/build/Resources"
APP_NAME="شريط نُطق"
APP="$MAC/build/$APP_NAME.app"
DEST="$HOME/Applications"

echo "▸ data (muṣḥaf text with tajwīd colours)"
mkdir -p "$RES/data" "$RES/alignments" "$RES/fonts"
( cd "$ROOT/app" && npx vite-node ../mac/tools/export_data.ts "$RES/data/quran.json" )
cp "$ROOT/app/src/content/reciters.json" "$RES/data/reciters.json"
rm -rf "$RES/alignments" && mkdir -p "$RES/alignments"
cp -R "$ROOT/app/src/content/alignments/"* "$RES/alignments/"
cp "$ROOT/fonts/UthmanicDouri-v2.ttf" "$RES/fonts/"

echo "▸ swift build (release)"
( cd "$MAC/NutqTicker" && swift build -c release )
BIN="$MAC/NutqTicker/.build/release/NutqTicker"

echo "▸ bundle"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN" "$APP/Contents/MacOS/NutqTicker"
cp -R "$RES/"* "$APP/Contents/Resources/"
[ -f "$ROOT/نُطق.app/Contents/Resources/Nutq.icns" ] && cp "$ROOT/نُطق.app/Contents/Resources/Nutq.icns" "$APP/Contents/Resources/Nutq.icns"
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>$APP_NAME</string>
  <key>CFBundleDisplayName</key><string>$APP_NAME</string>
  <key>CFBundleIdentifier</key><string>com.omniusstudio.nutq.ticker</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>NutqTicker</string>
  <key>CFBundleIconFile</key><string>Nutq</string>
  <key>LSMinimumSystemVersion</key><string>14.0</string>
  <key>LSUIElement</key><true/>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict>
</dict></plist>
PLIST
codesign --force --deep -s - "$APP" >/dev/null 2>&1 || echo "  (ad-hoc signing skipped)"

echo "▸ install to $DEST"
mkdir -p "$DEST"
pkill -f "$APP_NAME.app/Contents/MacOS/NutqTicker" 2>/dev/null || true
rm -rf "$DEST/$APP_NAME.app"
cp -R "$APP" "$DEST/$APP_NAME.app"
echo "done: $DEST/$APP_NAME.app"
