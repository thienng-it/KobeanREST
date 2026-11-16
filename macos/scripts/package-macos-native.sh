#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# KobeanREST Native macOS App Builder & Release Packager (.dmg & .zip)
# ==============================================================================
# Builds or packages the native SwiftUI + AppKit macOS app (powered by
# KobeanFFI.xcframework), applies Developer ID or ad-hoc code signing, and
# produces downloadable GitHub Release artifacts:
#   - macos/build/KobeanREST-macOS-Native.dmg
#   - macos/build/KobeanREST-<VERSION>-macOS-Native.dmg
#   - macos/build/KobeanREST-macOS-Native.zip
#   - macos/build/KobeanREST-<VERSION>-macOS-Native.zip
# ==============================================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

export MACOSX_DEPLOYMENT_TARGET="${MACOSX_DEPLOYMENT_TARGET:-15.0}"
if ! xcodebuild -version >/dev/null 2>&1 && [ -d "/Applications/Xcode.app/Contents/Developer" ]; then
  export DEVELOPER_DIR="/Applications/Xcode.app/Contents/Developer"
fi

UNIVERSAL=false
SKIP_BUILD=false

for arg in "$@"; do
  case "$arg" in
    --universal)
      UNIVERSAL=true
      ;;
    --skip-build)
      SKIP_BUILD=true
      ;;
  esac
done

if [ -n "${VERSION:-}" ]; then
  CLEAN_VERSION="${VERSION#v}"
elif command -v node >/dev/null 2>&1 && [ -f "$ROOT_DIR/package.json" ]; then
  CLEAN_VERSION="$(node -p "require('$ROOT_DIR/package.json').version")"
else
  CLEAN_VERSION="0.4.0"
fi

echo "==> Packaging KobeanREST Native macOS v${CLEAN_VERSION} (universal=${UNIVERSAL}, skip_build=${SKIP_BUILD})"

if [ "$SKIP_BUILD" != "true" ]; then
  if [ "$UNIVERSAL" = "true" ]; then
    ./macos/scripts/build-rust-xcframework.sh --universal
    DESTINATION="generic/platform=macOS"
  else
    ./macos/scripts/build-rust-xcframework.sh
    DESTINATION="platform=macOS,arch=$(uname -m)"
  fi

  if command -v xcodegen >/dev/null 2>&1; then
    (cd "$ROOT_DIR/macos" && xcodegen generate)
  fi

  xcodebuild build \
    -project "$ROOT_DIR/macos/KobeanREST.xcodeproj" \
    -scheme KobeanREST \
    -configuration Release \
    -destination "$DESTINATION" \
    -derivedDataPath "$ROOT_DIR/macos/DerivedData" \
    MARKETING_VERSION="$CLEAN_VERSION" \
    CODE_SIGNING_ALLOWED=NO
fi

APP_BUNDLE="$ROOT_DIR/macos/DerivedData/Build/Products/Release/KobeanREST.app"
if [ ! -d "$APP_BUNDLE" ]; then
  echo "ERROR: Built app bundle not found at $APP_BUNDLE" >&2
  exit 1
fi

# Ensure Info.plist carries the resolved semantic version
INFO_PLIST="$APP_BUNDLE/Contents/Info.plist"
if [ -f "$INFO_PLIST" ] && [ -x /usr/libexec/PlistBuddy ]; then
  /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $CLEAN_VERSION" "$INFO_PLIST" 2>/dev/null || true
fi

ENTITLEMENTS="$ROOT_DIR/macos/KobeanREST/Resources/KobeanREST.entitlements"
xattr -cr "$APP_BUNDLE" 2>/dev/null || true

if [ -n "${APPLE_DEVELOPER_IDENTITY:-}" ]; then
  echo "==> Signing KobeanREST.app with Developer ID identity"
  codesign --force --options runtime --timestamp \
    --entitlements "$ENTITLEMENTS" \
    --sign "$APPLE_DEVELOPER_IDENTITY" \
    "$APP_BUNDLE"
else
  echo "==> Applying ad-hoc signature to KobeanREST.app (no Apple Developer account required)"
  codesign --force --deep --sign - \
    --entitlements "$ENTITLEMENTS" \
    "$APP_BUNDLE"
fi

codesign --verify --deep --strict --verbose=2 "$APP_BUNDLE"

OUT_DIR="$ROOT_DIR/macos/build"
mkdir -p "$OUT_DIR"

ZIP_LATEST="$OUT_DIR/KobeanREST-macOS-Native.zip"
ZIP_VERSIONED="$OUT_DIR/KobeanREST-${CLEAN_VERSION}-macOS-Native.zip"
rm -f "$ZIP_LATEST" "$ZIP_VERSIONED"

echo "==> Creating Native macOS ZIP archive..."
ditto -c -k --sequesterRsrc --keepParent "$APP_BUNDLE" "$ZIP_LATEST"
cp "$ZIP_LATEST" "$ZIP_VERSIONED"

DMG_LATEST="$OUT_DIR/KobeanREST-macOS-Native.dmg"
DMG_VERSIONED="$OUT_DIR/KobeanREST-${CLEAN_VERSION}-macOS-Native.dmg"
DMG_STAGING="$OUT_DIR/dmg-staging"
rm -rf "$DMG_STAGING" "$DMG_LATEST" "$DMG_VERSIONED"
mkdir -p "$DMG_STAGING"

cp -R "$APP_BUNDLE" "$DMG_STAGING/KobeanREST.app"
ln -s /Applications "$DMG_STAGING/Applications"

cat > "$DMG_STAGING/Install KobeanREST (No Apple Dev Account).command" <<'INSTALLER_EOF'
#!/usr/bin/env bash
set -euo pipefail
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_SRC="$SRC_DIR/KobeanREST.app"
if [ -w "/Applications" ]; then
  DEST_DIR="/Applications"
else
  DEST_DIR="$HOME/Applications"
  mkdir -p "$DEST_DIR"
fi
DEST_APP="$DEST_DIR/KobeanREST.app"
echo "==> Installing KobeanREST to $DEST_APP"
rm -rf "$DEST_APP"
ditto "$APP_SRC" "$DEST_APP"
echo "==> Removing browser quarantine attribute & verifying local signature"
xattr -cr "$DEST_APP" 2>/dev/null || true
codesign --force --deep --sign - "$DEST_APP" 2>/dev/null || true
echo "==> Installed! Launching KobeanREST..."
open "$DEST_APP"
INSTALLER_EOF
chmod +x "$DMG_STAGING/Install KobeanREST (No Apple Dev Account).command"

echo "==> Creating Native macOS DMG installer..."
hdiutil create \
  -volname "KobeanREST" \
  -srcfolder "$DMG_STAGING" \
  -ov -format UDZO \
  "$DMG_LATEST" >/dev/null

cp "$DMG_LATEST" "$DMG_VERSIONED"
rm -rf "$DMG_STAGING"

echo "==> Native macOS packaging complete:"
echo "    DMG (latest)    : $DMG_LATEST"
echo "    DMG (versioned) : $DMG_VERSIONED"
echo "    ZIP (latest)    : $ZIP_LATEST"
echo "    ZIP (versioned) : $ZIP_VERSIONED"
