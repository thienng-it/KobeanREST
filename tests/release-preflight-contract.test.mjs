import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const rootDir = fileURLToPath(root);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const hasFile = (path) => existsSync(new URL(path, root));

test("repo exposes a release preflight command", () => {
  assert.equal(hasFile("scripts/check-release-preflight.mjs"), true);

  const pkg = read("package.json");
  const testFile = read("tests/release-preflight-contract.test.mjs");
  const script = read("scripts/check-release-preflight.mjs");
  const roadmap = read("docs/implementation-roadmap.md");

  assert.match(pkg, /"check:release": "node scripts\/check-release-preflight\.mjs"/);
  assert.match(testFile, /const rootDir = fileURLToPath\(root\)/);
  assert.match(testFile, /cwd: rootDir/);
  assert.match(script, /REPLACE_WITH_TAURI_UPDATER_PUBLIC_KEY_BEFORE_PUBLIC_RELEASE/);
  assert.match(script, /TAURI_SIGNING_PRIVATE_KEY/);
  assert.match(script, /TAURI_SIGNING_PRIVATE_KEY_PASSWORD/);
  assert.match(script, /latest\.json/);
  assert.match(script, /git tag v\$\{version\}/);
  assert.match(roadmap, /Release preflight command before tagging/);
});

test("release preflight passes once the updater public key is configured", () => {
  const run = spawnSync("node", ["scripts/check-release-preflight.mjs"], {
    cwd: rootDir,
    encoding: "utf8",
  });

  assert.equal(run.status, 0);
  assert.match(run.stdout, /Release preflight passed for version 0\.1\.0/);
  assert.match(run.stdout, /git tag v0\.1\.0/);
});
