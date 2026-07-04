import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("download docs include OS-specific install steps and checksum verification guidance", () => {
  const doc = read("docs/download.md");

  assert.match(doc, /## macOS/i);
  assert.match(doc, /drag .*Applications|open the \.dmg/i);
  assert.match(doc, /## Windows/i);
  assert.match(doc, /open the \.msi|run the installer/i);
  assert.match(doc, /## Linux/i);
  assert.match(doc, /chmod \+x .*AppImage|install the \.deb/i);
  assert.match(doc, /shasum -a 256|sha256sum|certutil -hashfile/i);
  assert.match(doc, /SHA256SUMS\.txt/);
});

test("download docs explain no-account use, offline use, and update behavior", () => {
  const doc = read("docs/download.md");
  const roadmap = read("docs/implementation-roadmap.md");

  assert.match(doc, /without a KobeanREST account|no account/i);
  assert.match(doc, /usable offline|fully usable offline/i);
  assert.match(doc, /disable automatic update checks|Check now|signed release metadata/i);
  assert.match(doc, /GitHub Releases\/latest|releases\/latest/i);

  assert.match(roadmap, /Phase 1N: Download Docs Finalization/);
  assert.match(roadmap, /Checksum verification notes/);
  assert.match(roadmap, /Update behavior explanation/);
});
