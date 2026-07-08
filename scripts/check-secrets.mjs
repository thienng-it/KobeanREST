import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const config = JSON.parse(readFileSync(path.join(root, ".betterleak"), "utf8"));
const includeRoots = config.include;
const ignoredDirs = new Set(config.ignoreDirs);
const ignoredFiles = new Set(config.ignoreFiles);
const allowedExtensions = new Set(config.allowedExtensions);
const patterns = config.patterns.map((pattern) => ({
  label: pattern.label,
  regex: new RegExp(pattern.regex),
  allow: pattern.allow ? new RegExp(pattern.allow, "i") : undefined,
}));

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
