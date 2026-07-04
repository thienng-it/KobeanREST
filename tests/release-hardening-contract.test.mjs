import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

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
