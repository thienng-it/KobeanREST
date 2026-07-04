import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");
const hasFile = (path) => existsSync(new URL(path, root));

test("release operations doc covers updater key generation and GitHub secret setup", () => {
  assert.equal(hasFile("docs/release-operations.md"), true);

  const doc = read("docs/release-operations.md");
  assert.match(doc, /node_modules\/\.bin\/tauri signer generate/);
  assert.match(doc, /REPLACE_WITH_TAURI_UPDATER_PUBLIC_KEY_BEFORE_PUBLIC_RELEASE/);
  assert.match(doc, /TAURI_SIGNING_PRIVATE_KEY/);
  assert.match(doc, /TAURI_SIGNING_PRIVATE_KEY_PASSWORD/);
  assert.match(doc, /tauri\.conf\.json/);
  assert.match(doc, /GitHub Actions secrets/i);
});

test("release operations doc covers tagged release flow and post-release verification", () => {
  const doc = read("docs/release-operations.md");
  const roadmap = read("docs/implementation-roadmap.md");

  assert.match(doc, /git tag v/i);
  assert.match(doc, /git push .*--tags|git push origin .*tag/i);
  assert.match(doc, /latest\.json/);
  assert.match(doc, /SHA256SUMS\.txt/);
  assert.match(doc, /Check now|update prompt|signed release metadata/i);
  assert.match(doc, /docs\/release-qa\.md/);

  assert.match(roadmap, /docs\/release-operations\.md/);
  assert.match(roadmap, /Remaining blocker:/);
  assert.match(roadmap, /Remaining:/);
});
