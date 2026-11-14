#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

export MACOSX_DEPLOYMENT_TARGET="${MACOSX_DEPLOYMENT_TARGET:-15.0}"

UNIVERSAL=false
if [[ "${1:-}" == "--universal" ]]; then
  UNIVERSAL=true
fi

echo "==> Building kobean-ffi (aarch64-apple-darwin)..."
cargo build --release -p kobean-ffi --target aarch64-apple-darwin

ARM64_LIB="$ROOT_DIR/target/aarch64-apple-darwin/release/libkobean_ffi.a"
LIB_PATH="$ARM64_LIB"

if [[ "$UNIVERSAL" == "true" ]]; then
  echo "==> Building kobean-ffi (x86_64-apple-darwin)..."
  cargo build --release -p kobean-ffi --target x86_64-apple-darwin
  X64_LIB="$ROOT_DIR/target/x86_64-apple-darwin/release/libkobean_ffi.a"
  UNIVERSAL_LIB="$ROOT_DIR/target/libkobean_ffi_universal.a"
  lipo -create "$ARM64_LIB" "$X64_LIB" -output "$UNIVERSAL_LIB"
  LIB_PATH="$UNIVERSAL_LIB"
fi

GENERATED_DIR="$ROOT_DIR/macos/Generated"
rm -rf "$GENERATED_DIR"
mkdir -p "$GENERATED_DIR"

echo "==> Generating Swift UniFFI bindings..."
cargo run -p kobean-ffi --bin uniffi-bindgen -- generate \
  --library "$ARM64_LIB" \
  --language swift \
  --out-dir "$GENERATED_DIR"

HEADERS_DIR="$ROOT_DIR/target/xcframework-headers"
rm -rf "$HEADERS_DIR"
mkdir -p "$HEADERS_DIR"

cp "$GENERATED_DIR/kobean_ffiFFI.h" "$HEADERS_DIR/kobean_ffiFFI.h"
cp "$GENERATED_DIR/kobean_ffiFFI.modulemap" "$HEADERS_DIR/module.modulemap"

FRAMEWORKS_DIR="$ROOT_DIR/macos/Frameworks"
mkdir -p "$FRAMEWORKS_DIR"
XCFRAMEWORK_PATH="$FRAMEWORKS_DIR/KobeanFFI.xcframework"
rm -rf "$XCFRAMEWORK_PATH"

echo "==> Creating KobeanFFI.xcframework..."
xcodebuild -create-xcframework \
  -library "$LIB_PATH" \
  -headers "$HEADERS_DIR" \
  -output "$XCFRAMEWORK_PATH"

echo "==> Done: $XCFRAMEWORK_PATH"
