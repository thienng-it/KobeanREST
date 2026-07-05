import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const rootDir = fileURLToPath(root);
const read = (path) => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");
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
  assert.match(script, /tauri\.conf\.json version/);
  assert.match(script, /Cargo\.toml version/);
  assert.match(script, /package-lock\.json version metadata/);
  assert.match(roadmap, /Release preflight command before tagging/);
});

test("release preflight passes once the updater public key is configured", () => {
  const pkg = JSON.parse(read("package.json"));
  const tauriConfig = JSON.parse(read("src-tauri/tauri.conf.json"));
  const cargoToml = read("src-tauri/Cargo.toml");
  const lockfile = JSON.parse(read("package-lock.json"));

  assert.equal(tauriConfig.version, pkg.version);
  assert.match(cargoToml, new RegExp(`version = "${pkg.version.replace(/\./g, "\\.")}"`));
  assert.equal(lockfile.version, pkg.version);
  assert.equal(lockfile.packages[""].version, pkg.version);

  const run = spawnSync("node", ["scripts/check-release-preflight.mjs"], {
    cwd: rootDir,
    encoding: "utf8",
  });

  assert.equal(run.status, 0);
  assert.match(run.stdout, new RegExp(`Release preflight passed for version ${pkg.version.replace(/\./g, "\\.")}`));
  assert.match(run.stdout, new RegExp(`git tag v${pkg.version.replace(/\./g, "\\.")}`));
});
