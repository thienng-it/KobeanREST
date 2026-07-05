#!/usr/bin/env node
// Merges per-platform Tauri updater signatures produced by the release matrix
// build into a single, correct latest.json covering macOS, Windows, and Linux.
//
// This exists because tauri-action's built-in `includeUpdaterJson` uploads a
// fresh latest.json per matrix job directly to the shared GitHub release.
// Since the macOS/Windows/Linux build jobs run in parallel, each upload
// clobbers the previous one, so the final latest.json only ever reflects
// whichever platform finished last. Building the manifest once, after all
// platform artifacts are collected, avoids that race.

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
const files = readdirSync(artifactsDir);

function findFile(predicate) {
  return files.find((name) => predicate(name) && !name.endsWith(".sig"));
}

function readSignature(assetFileName) {
  const sigName = `${assetFileName}.sig`;
  if (!files.includes(sigName)) {
    return null;
  }
  return readFileSync(join(artifactsDir, sigName), "utf8").trim();
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

const dmg = findFile((name) => name.endsWith(".dmg"));
addPlatformEntries(["darwin-x86_64", "darwin-aarch64"], dmg);

const msi = findFile((name) => name.endsWith(".msi"));
addPlatformEntries(["windows-x86_64", "windows-x86_64-msi"], msi);

const appImage = findFile((name) => name.endsWith(".AppImage"));
addPlatformEntries(["linux-x86_64", "linux-x86_64-appimage"], appImage);

const deb = findFile((name) => name.endsWith(".deb"));
addPlatformEntries(["linux-x86_64-deb"], deb);

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
