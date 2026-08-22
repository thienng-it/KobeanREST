#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const ROOT_DIR = process.cwd();

/**
 * Ignored file paths that never trigger an automated release bump on their own.
 */
const IGNORED_PATHS = [
  "docs-site/public/qa-history.json",
  "qa-summary.md",
  "test-output.log",
  "e2e-output.log",
  ".betterleak",
];

/**
 * Executes a shell command and returns trimmed stdout string.
 */
export function exec(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT_DIR, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

/**
 * Finds the latest semantic version tag (e.g. v0.1.35).
 */
export function getLatestReleaseTag() {
  const allTags = exec('git tag -l "v*.*.*" --sort=-v:refname')
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);

  if (allTags.length > 0) {
    return allTags[0];
  }

  // Fallback to package.json version
  try {
    const pkg = JSON.parse(readFileSync(path.join(ROOT_DIR, "package.json"), "utf8"));
    return `v${pkg.version}`;
  } catch {
    return "v0.1.0";
  }
}

/**
 * Scans git commits between a base ref (e.g. tag) and target ref (e.g. HEAD).
 */
export function scanCommitsSince(baseRef, targetRef = "HEAD") {
  const logFormat = "%H%x1f%an%x1f%ae%x1f%s%x1f%b%x1e";
  const rawLog = exec(`git log ${baseRef}..${targetRef} --pretty=format:"${logFormat}"`);

  if (!rawLog) return [];

  const rawEntries = rawLog.split("\x1e").filter((e) => e.trim().length > 0);
  const commits = [];

  for (const entry of rawEntries) {
    const parts = entry.trim().split("\x1f");
    const hash = parts[0]?.trim() || "";
    const author = parts[1]?.trim() || "";
    const email = parts[2]?.trim() || "";
    const subject = parts[3]?.trim() || "";
    const body = parts[4]?.trim() || "";

    if (!hash) continue;

    // Get files touched by this commit
    const filesOutput = exec(`git diff-tree --no-commit-id --name-only -r ${hash}`);
    const files = filesOutput
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);

    commits.push({ hash, author, email, subject, body, files });
  }

  return commits;
}

/**
 * Checks whether a commit represents a meaningful change that warrants a release.
 */
export function isMeaningfulCommit(commit) {
  const subject = commit.subject.toLowerCase();
  const body = (commit.body || "").toLowerCase();

  // 1. Explicit skip markers
  if (
    subject.includes("[skip release]") ||
    subject.includes("[skip bump]") ||
    body.includes("[skip release]") ||
    body.includes("[skip bump]")
  ) {
    return false;
  }

  // 2. Ignore automated release bumps and QA metrics commits
  if (subject.startsWith("chore(release):") || subject.startsWith("chore(qa):")) {
    return false;
  }

  // 3. Ignore commits that only touch non-code/ignored telemetry files
  if (commit.files.length > 0) {
    const onlyIgnoredFiles = commit.files.every((file) =>
      IGNORED_PATHS.some((ignored) => file === ignored || file.startsWith(ignored))
    );
    if (onlyIgnoredFiles) {
      return false;
    }
  }

  return true;
}

/**
 * Filters list of commits down to meaningful ones.
 */
export function filterMeaningfulCommits(commits) {
  return commits.filter(isMeaningfulCommit);
}

/**
 * Analyzes commit messages to determine the appropriate SemVer bump type.
 */
export function determineBumpType(meaningfulCommits, overrideType = "auto") {
  if (overrideType && ["major", "minor", "patch"].includes(overrideType.toLowerCase())) {
    return overrideType.toLowerCase();
  }

  if (!meaningfulCommits || meaningfulCommits.length === 0) {
    return "none";
  }

  let hasBreaking = false;
  let hasFeature = false;
  let hasPatch = false;

  for (const commit of meaningfulCommits) {
    const subject = commit.subject;
    const body = commit.body || "";

    // Breaking change detection
    if (
      body.includes("BREAKING CHANGE:") ||
      body.includes("BREAKING-CHANGE:") ||
      /^[a-zA-Z]+(\([^)]+\))?!:/.test(subject)
    ) {
      hasBreaking = true;
      break;
    }

    // Feature detection
    if (/^feat(\([^)]+\))?:/i.test(subject)) {
      hasFeature = true;
    } else {
      hasPatch = true;
    }
  }

  if (hasBreaking) return "major";
  if (hasFeature) return "minor";
  if (hasPatch) return "patch";

  return "patch";
}

/**
 * Calculates next SemVer string given current version and bump type.
 */
export function calculateNextVersion(currentVersion, bumpType) {
  const clean = currentVersion.replace(/^v/, "");
  const parts = clean.split(".").map((p) => parseInt(p, 10) || 0);

  while (parts.length < 3) parts.push(0);

  let [major, minor, patch] = parts;

  switch (bumpType) {
    case "major":
      major += 1;
      minor = 0;
      patch = 0;
      break;
    case "minor":
      minor += 1;
      patch = 0;
      break;
    case "patch":
    default:
      patch += 1;
      break;
  }

  return `${major}.${minor}.${patch}`;
}

/**
 * Categorizes commits into structured changelog sections.
 */
export function categorizeCommits(commits) {
  const categories = {
    breaking: [],
    features: [],
    fixes: [],
    perf: [],
    refactor: [],
    docs: [],
    maintenance: [],
  };

  for (const commit of commits) {
    const subject = commit.subject;
    const body = commit.body || "";
    const shortHash = commit.hash.slice(0, 7);
    const item = { hash: shortHash, fullHash: commit.hash, subject, author: commit.author };

    if (body.includes("BREAKING CHANGE:") || /^[a-zA-Z]+(\([^)]+\))?!:/.test(subject)) {
      categories.breaking.push(item);
    } else if (/^feat(\([^)]+\))?:/i.test(subject)) {
      categories.features.push(item);
    } else if (/^fix(\([^)]+\))?:/i.test(subject)) {
      categories.fixes.push(item);
    } else if (/^perf(\([^)]+\))?:/i.test(subject)) {
      categories.perf.push(item);
    } else if (/^refactor(\([^)]+\))?:/i.test(subject)) {
      categories.refactor.push(item);
    } else if (/^docs(\([^)]+\))?:/i.test(subject)) {
      categories.docs.push(item);
    } else {
      categories.maintenance.push(item);
    }
  }

  return categories;
}

/**
 * Formats a clean, professional Markdown changelog entry.
 */
export function generateReleaseNotes(commits, nextVersion, prevTag = "") {
  const dateStr = new Date().toISOString().split("T")[0];
  const categories = categorizeCommits(commits);
  const lines = [];

  lines.push(`## [v${nextVersion}] - ${dateStr}`);
  if (prevTag) {
    lines.push(`*Comparing changes against ${prevTag}*`);
  }
  lines.push("");

  const formatList = (items) => {
    return items.map((i) => `- ${i.subject} (\`${i.hash}\`) - *${i.author}*`).join("\n");
  };

  if (categories.breaking.length > 0) {
    lines.push("### 💥 Breaking Changes");
    lines.push(formatList(categories.breaking));
    lines.push("");
  }

  if (categories.features.length > 0) {
    lines.push("### 🚀 New Features & Enhancements");
    lines.push(formatList(categories.features));
    lines.push("");
  }

  if (categories.fixes.length > 0) {
    lines.push("### 🐛 Bug Fixes");
    lines.push(formatList(categories.fixes));
    lines.push("");
  }

  if (categories.perf.length > 0) {
    lines.push("### ⚡ Performance Improvements");
    lines.push(formatList(categories.perf));
    lines.push("");
  }

  if (categories.refactor.length > 0) {
    lines.push("### ♻️ Code Refactoring & Architecture");
    lines.push(formatList(categories.refactor));
    lines.push("");
  }

  if (categories.docs.length > 0) {
    lines.push("### 📝 Documentation");
    lines.push(formatList(categories.docs));
    lines.push("");
  }

  if (categories.maintenance.length > 0) {
    lines.push("### 🔧 Build & Maintenance");
    lines.push(formatList(categories.maintenance));
    lines.push("");
  }

  if (commits.length === 0) {
    lines.push("Automated release build with cross-platform installer packages and signed update metadata.");
    lines.push("");
  }

  return lines.join("\n").trim();
}

/**
 * Synchronizes new version across all project manifests:
 * 1. package.json
 * 2. package-lock.json
 * 3. src-tauri/tauri.conf.json
 * 4. src-tauri/Cargo.toml
 */
export function syncAllVersionFiles(newVersion, dryRun = false) {
  const filesModified = [];

  // 1. package.json
  const pkgPath = path.join(ROOT_DIR, "package.json");
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    pkg.version = newVersion;
    if (!dryRun) {
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    }
    filesModified.push("package.json");
  }

  // 2. package-lock.json
  const lockPath = path.join(ROOT_DIR, "package-lock.json");
  if (existsSync(lockPath)) {
    const lock = JSON.parse(readFileSync(lockPath, "utf8"));
    lock.version = newVersion;
    if (lock.packages && lock.packages[""]) {
      lock.packages[""].version = newVersion;
    }
    if (!dryRun) {
      writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");
    }
    filesModified.push("package-lock.json");
  }

  // 3. src-tauri/tauri.conf.json
  const tauriPath = path.join(ROOT_DIR, "src-tauri/tauri.conf.json");
  if (existsSync(tauriPath)) {
    const tauriConfig = JSON.parse(readFileSync(tauriPath, "utf8"));
    tauriConfig.version = newVersion;
    if (!dryRun) {
      writeFileSync(tauriPath, JSON.stringify(tauriConfig, null, 2) + "\n");
    }
    filesModified.push("src-tauri/tauri.conf.json");
  }

  // 4. src-tauri/Cargo.toml
  const cargoPath = path.join(ROOT_DIR, "src-tauri/Cargo.toml");
  if (existsSync(cargoPath)) {
    let cargoToml = readFileSync(cargoPath, "utf8");
    cargoToml = cargoToml.replace(/^version = "[^"]+"/m, `version = "${newVersion}"`);
    if (!dryRun) {
      writeFileSync(cargoPath, cargoToml);
    }
    filesModified.push("src-tauri/Cargo.toml");
  }

  return filesModified;
}

/**
 * Updates CHANGELOG.md with the latest release notes.
 */
export function updateChangelog(releaseNotes, dryRun = false) {
  const changelogPath = path.join(ROOT_DIR, "CHANGELOG.md");
  let header = "# Changelog\n\nAll notable changes to KobeanREST are documented in this file.\n\n";

  if (!existsSync(changelogPath)) {
    if (!dryRun) {
      writeFileSync(changelogPath, `${header}${releaseNotes}\n`);
    }
    return changelogPath;
  }

  const existing = readFileSync(changelogPath, "utf8");
  if (existing.startsWith("# Changelog")) {
    const withoutHeader = existing.replace(/^# Changelog(\r?\n)+([^\n]+\r?\n)?(\r?\n)*/, "");
    const updated = `${header}${releaseNotes}\n\n${withoutHeader.trim()}\n`;
    if (!dryRun) {
      writeFileSync(changelogPath, updated);
    }
  } else {
    const updated = `${header}${releaseNotes}\n\n${existing.trim()}\n`;
    if (!dryRun) {
      writeFileSync(changelogPath, updated);
    }
  }

  return changelogPath;
}

/**
 * Writes key-value output to GitHub Actions GITHUB_OUTPUT environment file.
 */
export function setGitHubOutput(key, value) {
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (!githubOutput) return;

  if (typeof value === "string" && value.includes("\n")) {
    const delimiter = `DELIMITER_${Math.random().toString(36).substring(2, 10)}`;
    const multiLine = `${key}<<${delimiter}\n${value}\n${delimiter}\n`;
    appendFileSync(githubOutput, multiLine);
  } else {
    appendFileSync(githubOutput, `${key}=${value}\n`);
  }
}

/**
 * Writes markdown content to GitHub Actions GITHUB_STEP_SUMMARY.
 */
export function writeStepSummary(markdown) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  appendFileSync(summaryPath, markdown + "\n\n");
}

// CLI Execution handler
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const args = process.argv.slice(2);
  const isCheckMode = args.includes("--check");
  const isBumpMode = args.includes("--bump");
  const isDryRun = args.includes("--dry-run");
  const isForce = args.includes("--force");
  const bumpTypeArg = args.find((a, i) => args[i - 1] === "--bump" || a.startsWith("--bump-type="))?.replace("--bump-type=", "") || "auto";

  const pkg = JSON.parse(readFileSync(path.join(ROOT_DIR, "package.json"), "utf8"));
  const currentVersion = pkg.version;
  const latestTag = getLatestReleaseTag();

  console.log(`[Release Scanner] Current package version: ${currentVersion}`);
  console.log(`[Release Scanner] Latest release tag: ${latestTag}`);

  const allCommits = scanCommitsSince(latestTag, "HEAD");
  const meaningfulCommits = filterMeaningfulCommits(allCommits);

  console.log(`[Release Scanner] Total commits since ${latestTag}: ${allCommits.length}`);
  console.log(`[Release Scanner] Meaningful code changes: ${meaningfulCommits.length}`);

  for (const c of allCommits) {
    const meaningful = isMeaningfulCommit(c);
    console.log(`  - [${meaningful ? "INCLUDE" : "SKIP"}] ${c.hash.slice(0, 7)}: ${c.subject}`);
  }

  const shouldRelease = meaningfulCommits.length > 0 || isForce;
  const bumpType = determineBumpType(meaningfulCommits, bumpTypeArg);
  const nextVersion = shouldRelease ? calculateNextVersion(currentVersion, bumpType) : currentVersion;
  const newTag = `v${nextVersion}`;
  const releaseNotes = generateReleaseNotes(meaningfulCommits, nextVersion, latestTag);

  console.log(`[Release Scanner] Decision: should_release=${shouldRelease}`);
  console.log(`[Release Scanner] Calculated bump: ${bumpType} -> v${nextVersion}`);

  setGitHubOutput("should_release", String(shouldRelease));
  setGitHubOutput("commits_count", String(meaningfulCommits.length));
  setGitHubOutput("total_commits_count", String(allCommits.length));
  setGitHubOutput("bump_type", bumpType);
  setGitHubOutput("current_version", currentVersion);
  setGitHubOutput("next_version", nextVersion);
  setGitHubOutput("tag_name", newTag);
  setGitHubOutput("release_name", `KobeanREST ${newTag}`);
  setGitHubOutput("is_prerelease", "false");
  setGitHubOutput("release_notes", releaseNotes);

  if (!shouldRelease && !isForce) {
    console.log("\n[Release Scanner] No qualifying code changes found. Skipping automated bump.");
    writeStepSummary(`### ⏭️ Release Skipped\n\nNo meaningful code commits detected since **${latestTag}** (${allCommits.length} total commits analyzed, ${allCommits.length - meaningfulCommits.length} skipped as bot/telemetry updates).`);
    process.exit(0);
  }

  if (isBumpMode || (!isCheckMode && shouldRelease)) {
    console.log(`\n[Release Scanner] Synchronizing manifests to v${nextVersion} (dry-run: ${isDryRun})...`);
    const modified = syncAllVersionFiles(nextVersion, isDryRun);
    console.log(`[Release Scanner] Updated files: ${modified.join(", ")}`);

    console.log(`[Release Scanner] Updating CHANGELOG.md...`);
    updateChangelog(releaseNotes, isDryRun);

    const notesFile = path.join(ROOT_DIR, "RELEASE_NOTES.md");
    if (!isDryRun) {
      writeFileSync(notesFile, releaseNotes);
    }
    setGitHubOutput("release_notes_file", notesFile);

    writeStepSummary(`### 🚀 KobeanREST Automated Release Prepared\n\n- **Previous Tag:** \`${latestTag}\`\n- **Target Version:** \`${nextVersion}\` (\`${newTag}\`)\n- **Bump Type:** \`${bumpType}\`\n- **Meaningful Commits:** \`${meaningfulCommits.length}\`\n\n#### Release Notes Preview:\n\n${releaseNotes}`);
  }
}
