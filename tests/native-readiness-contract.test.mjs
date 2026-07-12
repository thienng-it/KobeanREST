import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");
const hasFile = (path) => existsSync(new URL(path, root));

test("native readiness includes a pinned Rust toolchain and Cargo lockfile", () => {
  assert.equal(hasFile("rust-toolchain.toml"), true);
  assert.equal(hasFile("src-tauri/Cargo.lock"), true);

  const toolchain = read("rust-toolchain.toml");
  assert.match(toolchain, /channel = "stable"/);
  assert.match(toolchain, /profile = "minimal"/);
});

test("package scripts expose native verification commands", () => {
  const manifest = JSON.parse(read("package.json"));

  assert.equal(manifest.scripts["check:native"], "cargo check --manifest-path src-tauri/Cargo.toml");
  assert.equal(manifest.scripts["tauri:dev"], "tauri dev");
  assert.equal(manifest.scripts["tauri:build"], "tauri build");
});

test("Tauri window defaults give the request and response workspace a usable launch size", () => {
  const config = JSON.parse(read("src-tauri/tauri.conf.json"));
  const mainWindow = config.app.windows[0];

  assert.equal(mainWindow.width, 1440);
  assert.equal(mainWindow.height, 960);
  assert.equal(mainWindow.minWidth, 1280);
  assert.equal(mainWindow.minHeight, 860);
});

test("native readiness docs explain the macOS Xcode license prerequisite", () => {
  assert.equal(hasFile("docs/native-readiness.md"), true);

  const docs = read("docs/native-readiness.md");
  assert.match(docs, /sudo xcodebuild -license/i);
  assert.match(docs, /cargo check/i);
  assert.match(docs, /npm run tauri:dev/i);
});

test("Tauri native context has a required PNG icon", () => {
  assert.equal(hasFile("src-tauri/icons/icon.png"), true);

  const icon = readFileSync(new URL("src-tauri/icons/icon.png", root));
  assert.equal(icon.toString("ascii", 1, 4), "PNG");
  assert.equal(icon[25], 6, "Tauri expects icon.png to use RGBA color type");
});

test("Stronghold plugin uses the supported Argon2 password hashing setup", () => {
  const lib = read("src-tauri/src/lib.rs");

  assert.match(lib, /Builder::with_argon2/);
  assert.doesNotMatch(lib, /hash_blake2b/);
});
