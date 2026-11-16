import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");

test("release workflow collects platform bundles and publishes SHA256 checksums", () => {
  const workflow = read(".github/workflows/release.yml");

  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.match(workflow, /name:\s*bundle-/);
  assert.match(workflow, /actions\/download-artifact@v4/);
  assert.match(workflow, /pattern:\s*bundle-\*/);
  assert.match(workflow, /SHA256SUMS\.txt/);
  assert.match(workflow, /shasum -a 256|sha256sum/);
  assert.match(workflow, /gh release upload/);
});

test("release hardening docs and roadmap mention checksum publishing", () => {
  const roadmap = read("docs/implementation-roadmap.md");
  const downloadDoc = read("docs/download.md");

  assert.match(roadmap, /Phase 1M: Packaging and Release Hardening/);
  assert.match(roadmap, /Checksums/);
  assert.match(downloadDoc, /SHA256SUMS\.txt/);
  assert.match(downloadDoc, /latest\.json/);
});

test("GitHub workflows build and publish Native macOS DMG and ZIP release artifacts", () => {
  const macosNativeWorkflow = read(".github/workflows/macos-native.yml");
  const releaseWorkflow = read(".github/workflows/release.yml");
  const nightlyWorkflow = read(".github/workflows/nightly-release.yml");
  const packageScript = read("macos/scripts/package-macos-native.sh");

  assert.match(packageScript, /KobeanREST-macOS-Native\.dmg/);
  assert.match(packageScript, /KobeanREST-macOS-Native\.zip/);
  assert.match(packageScript, /codesign --force --deep --sign -/);

  for (const wf of [macosNativeWorkflow, releaseWorkflow, nightlyWorkflow]) {
    assert.match(wf, /package-macos-native\.sh/);
    assert.match(wf, /KobeanREST-macOS-Native\.dmg/);
    assert.match(wf, /KobeanREST-macOS-Native\.zip/);
    assert.match(wf, /gh release upload/);
  }
});
