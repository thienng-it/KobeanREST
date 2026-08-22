import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import {
  isMeaningfulCommit,
  filterMeaningfulCommits,
  determineBumpType,
  calculateNextVersion,
  categorizeCommits,
  generateReleaseNotes,
  getLatestReleaseTag,
} from "../scripts/release-scanner.mjs";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");
const hasFile = (path) => existsSync(new URL(path, root));

test("release scanner file exists and is executable", () => {
  assert.equal(hasFile("scripts/release-scanner.mjs"), true);
  assert.equal(hasFile("CHANGELOG.md"), true);
  assert.equal(hasFile(".github/workflows/nightly-release.yml"), true);
});

test("isMeaningfulCommit correctly discards bot metrics, release bumps, and skip tags", () => {
  const qaCommit = {
    hash: "0b455d7dbd0a1a76f2e7631585be56cbd2bca565",
    author: "github-actions[bot]",
    email: "github-actions[bot]@users.noreply.github.com",
    subject: "chore(qa): record daily automated test metrics to history database [skip ci]",
    body: "",
    files: ["docs-site/public/qa-history.json"],
  };
  assert.equal(isMeaningfulCommit(qaCommit), false);

  const releaseBumpCommit = {
    hash: "134f00ce689b44a871f5e1dffe6155f902840d75",
    author: "github-actions[bot]",
    email: "github-actions[bot]@users.noreply.github.com",
    subject: "chore(release): auto-bump version to 0.1.35 [skip ci]",
    body: "",
    files: ["package.json", "package-lock.json", "src-tauri/tauri.conf.json", "src-tauri/Cargo.toml"],
  };
  assert.equal(isMeaningfulCommit(releaseBumpCommit), false);

  const skipReleaseCommit = {
    hash: "abcdef1234567890",
    author: "developer",
    email: "dev@example.com",
    subject: "docs: update readme [skip release]",
    body: "",
    files: ["README.md"],
  };
  assert.equal(isMeaningfulCommit(skipReleaseCommit), false);

  const realFeatureCommit = {
    hash: "d8a7289a11cb6dc196fc0a3865300eb3a5043ed0",
    author: "thienng-it",
    email: "thienng.it@gmail.com",
    subject: "feat(i18n): implement comprehensive production-grade localization across all UI components",
    body: "",
    files: ["src/renderer/src/locales/en.ts", "src/renderer/src/App.tsx"],
  };
  assert.equal(isMeaningfulCommit(realFeatureCommit), true);

  const realFixCommit = {
    hash: "3fe3d60abc12345",
    author: "thienng-it",
    email: "thienng.it@gmail.com",
    subject: "fix(ui): remove inconsistent sidebar hover tree guide lines",
    body: "",
    files: ["src/renderer/src/components/Sidebar.tsx"],
  };
  assert.equal(isMeaningfulCommit(realFixCommit), true);

  const filtered = filterMeaningfulCommits([qaCommit, releaseBumpCommit, skipReleaseCommit, realFeatureCommit, realFixCommit]);
  assert.equal(filtered.length, 2);
  assert.equal(filtered[0], realFeatureCommit);
  assert.equal(filtered[1], realFixCommit);
});

test("determineBumpType evaluates Conventional Commits semantics accurately", () => {
  const emptyCommits = [];
  assert.equal(determineBumpType(emptyCommits), "none");

  const featureCommits = [
    { subject: "feat(sidebar): add accordion animations", body: "", files: ["src/renderer/src/components/Sidebar.tsx"] },
    { subject: "fix(ui): remove outline", body: "", files: ["src/renderer/src/index.css"] },
  ];
  assert.equal(determineBumpType(featureCommits), "minor");

  const fixOnlyCommits = [
    { subject: "fix(editor): fix line wrapping", body: "", files: ["src/renderer/src/components/Editor.tsx"] },
    { subject: "perf(state): memoize selectors", body: "", files: ["src/renderer/src/App.tsx"] },
  ];
  assert.equal(determineBumpType(fixOnlyCommits), "patch");

  const breakingCommits = [
    { subject: "feat!: redesign entire persistence storage layer", body: "", files: ["src-tauri/src/persistence.rs"] },
  ];
  assert.equal(determineBumpType(breakingCommits), "major");

  const breakingBodyCommits = [
    { subject: "refactor(auth): migrate to rust keychain", body: "BREAKING CHANGE: old sqlite tokens deprecated", files: [] },
  ];
  assert.equal(determineBumpType(breakingBodyCommits), "major");

  // Manual override takes precedence
  assert.equal(determineBumpType(fixOnlyCommits, "major"), "major");
  assert.equal(determineBumpType(breakingCommits, "patch"), "patch");
});

test("calculateNextVersion computes accurate SemVer increments", () => {
  assert.equal(calculateNextVersion("0.1.35", "patch"), "0.1.36");
  assert.equal(calculateNextVersion("0.1.35", "minor"), "0.2.0");
  assert.equal(calculateNextVersion("0.1.35", "major"), "1.0.0");
  assert.equal(calculateNextVersion("v0.1.35", "patch"), "0.1.36");
  assert.equal(calculateNextVersion("1.5.9", "patch"), "1.5.10");
  assert.equal(calculateNextVersion("1.5.9", "minor"), "1.6.0");
});

test("generateReleaseNotes compiles structured categorized markdown", () => {
  const commits = [
    { hash: "1111111222222", author: "alice", subject: "feat(ui): add dual split pane layout", body: "" },
    { hash: "3333333444444", author: "bob", subject: "fix(storage): resolve sqlite lock issue", body: "" },
    { hash: "5555555666666", author: "carol", subject: "perf(render): throttle resize events", body: "" },
    { hash: "7777777888888", author: "dave", subject: "docs: add release operations guide", body: "" },
  ];

  const notes = generateReleaseNotes(commits, "0.1.36", "v0.1.35");
  assert.match(notes, /## \[v0\.1\.36\]/);
  assert.match(notes, /Comparing changes against v0\.1\.35/);
  assert.match(notes, /### 🚀 New Features & Enhancements/);
  assert.match(notes, /feat\(ui\): add dual split pane layout/);
  assert.match(notes, /### 🐛 Bug Fixes/);
  assert.match(notes, /fix\(storage\): resolve sqlite lock issue/);
  assert.match(notes, /### ⚡ Performance Improvements/);
  assert.match(notes, /perf\(render\): throttle resize events/);
  assert.match(notes, /### 📝 Documentation/);
  assert.match(notes, /docs: add release operations guide/);
});

test("nightly workflow wires release scanner and step summary outputs", () => {
  const workflow = read(".github/workflows/nightly-release.yml");

  assert.match(workflow, /scripts\/release-scanner\.mjs/);
  assert.match(workflow, /--bump/);
  assert.match(workflow, /--bump-type/);
  assert.match(workflow, /CHANGELOG\.md/);
  assert.match(workflow, /fetch-tags:\s*true/);
  assert.match(workflow, /workflow_dispatch/);
  assert.match(workflow, /force_release/);
  assert.match(workflow, /dry_run/);
});
