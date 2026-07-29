#!/usr/bin/env node
// Merges per-platform Tauri updater signatures produced by the release matrix
// build into a single, correct latest.json covering macOS, Windows, and Linux.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const artifactsDir = process.argv[2];
const tag = process.argv[3];
const repo = process.argv[4];
const outFile = process.argv[5] ?? join(artifactsDir, "latest.json");

if (!artifactsDir || !tag || !repo) {
  console.error("Usage: build-updater-manifest.mjs <artifactsDir> <tag> <owner/repo> [outFile]");
  process.exit(1);
}

const version = tag.replace(/^v/, "");

function getAllFiles(dirPath) {
  let fileList = [];
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        fileList = fileList.concat(getAllFiles(fullPath));
      } else {
        fileList.push(entry.name);
      }
    }
  } catch {
    // ignore
  }
  return fileList;
}

function findFileInDir(dirPath, filename) {
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        const found = findFileInDir(fullPath, filename);
        if (found) return found;
      } else if (entry.name === filename) {
        return fullPath;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

const files = getAllFiles(artifactsDir);

function findSignedArtifact(predicates) {
  // First priority: find a candidate that has a matching .sig file in artifactsDir
  for (const predicate of predicates) {
    const candidate = files.find(
      (name) => predicate(name) && !name.endsWith(".sig") && files.includes(`${name}.sig`)
    );
    if (candidate) return candidate;
  }

  // Fallback: return candidate matching predicate even without .sig for logging diagnostic warning
  for (const predicate of predicates) {
    const candidate = files.find((name) => predicate(name) && !name.endsWith(".sig"));
    if (candidate) return candidate;
  }

  return null;
}

function readSignature(assetFileName) {
  const sigName = `${assetFileName}.sig`;
  const sigPath = findFileInDir(artifactsDir, sigName);
  if (!sigPath) {
    return null;
  }
  return readFileSync(sigPath, "utf8").trim();
}

function downloadUrl(assetFileName) {
  return `https://github.com/${repo}/releases/download/${tag}/${assetFileName}`;
}

const platforms = {};

function addPlatformEntries(entryNames, assetFileName) {
  if (!assetFileName) return;
  const signature = readSignature(assetFileName);
  if (!signature) {
    console.warn(`Skipping ${assetFileName}: no matching .sig file found`);
    return;
  }
  const url = downloadUrl(assetFileName);
  for (const entryName of entryNames) {
    platforms[entryName] = { signature, url };
  }
}

// macOS Updater Artifacts (.app.tar.gz, .tar.gz, or .dmg)
const macOSArtifact = findSignedArtifact([
  (name) => name.endsWith(".app.tar.gz"),
  (name) => name.endsWith(".tar.gz"),
  (name) => name.endsWith(".dmg"),
]);
addPlatformEntries(["darwin-x86_64", "darwin-aarch64"], macOSArtifact);

// Windows Updater Artifacts (.msi, .nsis.zip, .zip)
const windowsArtifact = findSignedArtifact([
  (name) => name.endsWith(".msi"),
  (name) => name.endsWith(".zip"),
]);
addPlatformEntries(["windows-x86_64", "windows-x86_64-msi"], windowsArtifact);

// Linux AppImage Artifacts (.AppImage.tar.gz, .AppImage)
const linuxAppImageArtifact = findSignedArtifact([
  (name) => name.endsWith(".AppImage.tar.gz"),
  (name) => name.endsWith(".AppImage"),
]);
addPlatformEntries(["linux-x86_64", "linux-x86_64-appimage"], linuxAppImageArtifact);

// Linux DEB Package (.deb)
const linuxDebArtifact = findSignedArtifact([
  (name) => name.endsWith(".deb"),
]);
addPlatformEntries(["linux-x86_64-deb"], linuxDebArtifact);

const requiredPlatforms = ["darwin-x86_64", "darwin-aarch64", "windows-x86_64", "linux-x86_64"];
const missing = requiredPlatforms.filter((name) => !platforms[name]);
if (missing.length > 0) {
  console.error(`Missing updater metadata for required platform(s): ${missing.join(", ")}`);
  process.exit(1);
}

const manifest = {
  version,
  notes: "Local-first KobeanREST desktop release. See latest.json for signed updater metadata.",
  pub_date: new Date().toISOString(),
  platforms,
};

writeFileSync(outFile, JSON.stringify(manifest, null, 2));
console.log(`Wrote ${outFile} with platforms: ${Object.keys(platforms).join(", ")}`);
