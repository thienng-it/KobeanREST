import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const includeRoots = [
  ".github",
  "docs",
  "src",
  "src-tauri",
  "README.md",
  "package.json",
  "tsconfig.json",
  "vite.config.ts",
  "rust-toolchain.toml",
];
const ignoredDirs = new Set([
  ".git",
  ".agents",
  ".codex",
  "dist",
  "node_modules",
  "src-tauri/target",
]);
const ignoredFiles = new Set(["package-lock.json"]);
const allowedExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".rs",
  ".sql",
  ".toml",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);

const patterns = [
  { label: "private-key", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { label: "openai-key", regex: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { label: "github-token", regex: /\bghp_[A-Za-z0-9]{20,}\b/ },
  { label: "github-pat", regex: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/ },
  { label: "aws-key", regex: /\bAKIA[0-9A-Z]{16}\b/ },
  {
    label: "literal-secret-assignment",
    regex: /\b(?:API[_-]?KEY|ACCESS[_-]?TOKEN|REFRESH[_-]?TOKEN|CLIENT[_-]?SECRET|PASSWORD)\b\s*[:=]\s*["']?([^\s"',`]{8,})/,
    allow: /\$\{\{|REPLACE_|YOUR_|example|placeholder|redacted|dummy|changeme/i,
  },
];

function shouldSkip(relativePath) {
  if (ignoredFiles.has(relativePath)) return true;
  return Array.from(ignoredDirs).some((ignored) => relativePath === ignored || relativePath.startsWith(`${ignored}/`));
}

function collectFiles(relativePath, files) {
  if (shouldSkip(relativePath)) return;
  const absolutePath = path.join(root, relativePath);
  const stats = statSync(absolutePath);
  if (stats.isDirectory()) {
    for (const entry of readdirSync(absolutePath)) {
      collectFiles(path.join(relativePath, entry), files);
    }
    return;
  }

  if (!allowedExtensions.has(path.extname(relativePath))) return;
  files.push(relativePath);
}

const files = [];
for (const entry of includeRoots) {
  collectFiles(entry, files);
}

const findings = [];
for (const relativePath of files) {
  const text = readFileSync(path.join(root, relativePath), "utf8");
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    for (const pattern of patterns) {
      const match = line.match(pattern.regex);
      if (!match) continue;
      if (pattern.allow?.test(match[0])) continue;
      findings.push(`${relativePath}:${index + 1} ${pattern.label}: ${line.trim()}`);
    }
  }
}

if (findings.length > 0) {
  console.error("Potential secrets found:");
  for (const finding of findings) {
    console.error(finding);
  }
  process.exit(1);
}

console.log(`Secret scan passed across ${files.length} source/config files.`);
