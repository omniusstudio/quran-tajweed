#!/usr/bin/env bash
# Packages the native ticker for other people: a universal (Apple silicon + Intel) app, signed with the
# Developer ID, notarized and stapled, inside a signed, notarized disk image.
#   bash scripts/package_mac_ticker.sh [version]          # default 1.0.0
# Overrides: NUTQ_SIGN_IDENTITY, NUTQ_NOTARY_PROFILE (a `notarytool store-credentials` profile), NUTQ_SKIP_NOTARIZE=1
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MAC="$ROOT/mac"
VERSION="${1:-1.0.0}"
IDENTITY="${NUTQ_SIGN_IDENTITY:-Developer ID Application: Omnius Studio LLC (NXYKW7HM47)}"
PROFILE="${NUTQ_NOTARY_PROFILE:-soli-notary}"
APP_NAME="شريط نُطق"
RES="$MAC/build/Resources"
OUT="$MAC/dist"
APP="$OUT/$APP_NAME.app"
DMG="$OUT/NutqTicker-$VERSION.dmg"
mkdir -p "$OUT" "$RES/data" "$RES/fonts"

echo "▸ data"
( cd "$ROOT/app" && npx vite-node ../mac/tools/export_data.ts "$RES/data/quran.json" )
cp "$ROOT/app/src/content/reciters.json" "$RES/data/reciters.json"
rm -rf "$RES/alignments" && mkdir -p "$RES/alignments" && cp -R "$ROOT/app/src/content/alignments/"* "$RES/alignments/"
cp "$ROOT/fonts/UthmanicDouri-v2.ttf" "$RES/fonts/"
cp "$ROOT/fonts/OFL.txt" "$RES/fonts/" 2>/dev/null || true

echo "▸ universal build"
( cd "$MAC/NutqTicker" && swift build -c release --arch arm64 --arch x86_64 )
BIN="$MAC/NutqTicker/.build/apple/Products/Release/NutqTicker"
lipo -archs "$BIN"

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
  <key>CFBundleVersion</key><string>$VERSION</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>NutqTicker</string>
  <key>CFBundleIconFile</key><string>Nutq</string>
  <key>CFBundleDevelopmentRegion</key><string>ar</string>
  <key>LSMinimumSystemVersion</key><string>14.0</string>
  <key>LSUIElement</key><true/>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSHumanReadableCopyright</key><string>© Omnius Studio. Recitation: Sheikh Noreen Muhammad Siddiq, via mp3quran.net.</string>
  <key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict>
</dict></plist>
PLIST

echo "▸ sign (hardened runtime)"
codesign --force --options runtime --timestamp --sign "$IDENTITY" "$APP"
codesign --verify --strict --verbose=2 "$APP"

notarize() {  # $1 = file to submit
  [ "${NUTQ_SKIP_NOTARIZE:-}" = "1" ] && { echo "  (notarization skipped)"; return 0; }
  xcrun notarytool submit "$1" --keychain-profile "$PROFILE" --wait
}

echo "▸ notarize the app"
ZIP="$OUT/$APP_NAME.zip"
rm -f "$ZIP" && ditto -c -k --keepParent "$APP" "$ZIP"
notarize "$ZIP"
[ "${NUTQ_SKIP_NOTARIZE:-}" = "1" ] || xcrun stapler staple "$APP"
rm -f "$ZIP"

echo "▸ disk image"
STAGE="$(mktemp -d)"
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"
rm -f "$DMG"
hdiutil create -volname "$APP_NAME" -srcfolder "$STAGE" -fs HFS+ -format UDZO "$DMG" >/dev/null
rm -rf "$STAGE"
codesign --force --timestamp --sign "$IDENTITY" "$DMG"
notarize "$DMG"
[ "${NUTQ_SKIP_NOTARIZE:-}" = "1" ] || xcrun stapler staple "$DMG"

echo "▸ check"
spctl -a -t open --context context:primary-signature -v "$DMG" 2>&1 || true
shasum -a 256 "$DMG"
ls -la "$DMG"
echo "done: $DMG"
