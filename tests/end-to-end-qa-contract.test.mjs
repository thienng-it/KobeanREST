import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");
const hasFile = (path) => existsSync(new URL(path, root));

test("release QA checklist covers the required desktop smoke scenarios", () => {
  assert.equal(hasFile("docs/release-qa.md"), true);

  const doc = read("docs/release-qa.md");
  assert.match(doc, /Desktop launch smoke test/i);
  assert.match(doc, /Offline launch test/i);
  assert.match(doc, /Valid request send test/i);
  assert.match(doc, /Failed request UX test/i);
  assert.match(doc, /Save\/reopen persistence test/i);
  assert.match(doc, /Import\/export round trip test/i);
  assert.match(doc, /Update offline failure test/i);
  assert.match(doc, /Installer smoke tests/i);
  assert.match(doc, /without an account|no account/i);
  assert.match(doc, /secrets remain outside SQLite/i);
});

test("roadmap marks end-to-end QA complete and points to the release checklist", () => {
  const roadmap = read("docs/implementation-roadmap.md");

  assert.match(roadmap, /### Phase 1P: End-to-End QA/);
  assert.match(roadmap, /Status: complete\./);
  assert.match(roadmap, /docs\/release-qa\.md/);
});
