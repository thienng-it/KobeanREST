import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");

test("updater service uses the Tauri updater plugin with browser-preview fallback", () => {
  const updater = read("src/renderer/src/services/updater.ts");

  assert.match(updater, /from "@tauri-apps\/plugin-updater"/);
  assert.match(updater, /export interface AvailableUpdate/);
  assert.match(updater, /currentVersion: string/);
  assert.match(updater, /version: string/);
  assert.match(updater, /signatureVerified: boolean/);
  assert.match(updater, /export async function checkForAppUpdate/);
  assert.match(updater, /const update = await check\(/);
  assert.match(updater, /return null;/);
  assert.match(updater, /export async function downloadAndInstallUpdate/);
  assert.match(updater, /await update\.downloadAndInstall/);
});

test("native update preview exposes release-readiness diagnostics", () => {
  const localOnly = read("src-tauri/src/local_only.rs");
  const localStore = read("src/renderer/src/services/local-store.ts");
  const types = read("src/renderer/src/types.ts");

  assert.match(localOnly, /pub struct UpdateCheckPreview/);
  assert.match(localOnly, /pub release_ready: bool/);
  assert.match(localOnly, /pub message: String/);
  assert.match(localOnly, /REPLACE_WITH_TAURI_UPDATER_PUBLIC_KEY_BEFORE_PUBLIC_RELEASE/);

  assert.match(types, /releaseReady: boolean/);
  assert.match(types, /message: string/);

  assert.match(localStore, /export async function checkForUpdates/);
  assert.match(localStore, /releaseReady: false/);
  assert.match(localStore, /return invoke<UpdateCheckPreview>\("check_for_update"\)/);
});

test("App.tsx adds update prompt state and handlers", () => {
  const app = read("src/renderer/src/App.tsx");

  assert.match(app, /const \[availableUpdate, setAvailableUpdate\] = useState/);
  assert.match(app, /const \[updateDialogOpen, setUpdateDialogOpen\] = useState/);
  assert.match(app, /const \[updateBusy, setUpdateBusy\] = useState/);
  assert.match(app, /const \[updateProgressLabel, setUpdateProgressLabel\] = useState/);

  assert.match(app, /async function handleCheckForUpdates/);
  assert.match(app, /async function handleInstallUpdate/);
});

test("update checks open a user-controlled prompt only when a signed newer update exists", () => {
  const app = read("src/renderer/src/App.tsx");

  assert.match(app, /const preview = await checkForUpdates\(\)/);
  assert.match(app, /if \(!preview\.releaseReady\) \{/);
  assert.match(app, /setUpdateProgressLabel\(preview\.message\)/);
  assert.match(app, /setUpdateStatus\(/);
  assert.match(app, /const update = await checkForAppUpdate\(\)/);
  assert.match(app, /if \(update\) \{/);
  assert.match(app, /setAvailableUpdate\(update\)/);
  assert.match(app, /setUpdateDialogOpen\(true\)/);
  assert.match(app, /No signed updates available\./);
});

test("install flow downloads and installs through the updater plugin and reports progress", () => {
  const app = read("src/renderer/src/App.tsx");

  assert.match(app, /await downloadAndInstallUpdate\(availableUpdate/);
  assert.match(app, /setUpdateBusy\(true\)/);
  assert.match(app, /setUpdateProgressLabel/);
  assert.match(app, /Restart to finish update install|Installing update/);
});

test("update prompt UI explains signed metadata and keeps offline failures non-blocking", () => {
  const app = read("src/renderer/src/App.tsx");

  assert.match(app, /aria-label="Update available"/);
  assert.match(app, /Signed release metadata/);
  assert.match(app, /Install update/);
  assert.match(app, /Later/);
  assert.match(app, /The app remains usable offline\./);
});

test("roadmap confirms Phase 1L complete with real updater key and signed release published", () => {
  const config = read("src-tauri/tauri.conf.json");
  const roadmap = read("docs/implementation-roadmap.md");

  assert.doesNotMatch(config, /REPLACE_WITH_TAURI_UPDATER_PUBLIC_KEY_BEFORE_PUBLIC_RELEASE/);
  assert.match(roadmap, /Phase 1L[\s\S]{0,50}Status: complete/);
  assert.match(roadmap, /latest\.json.*published|Signed.*latest\.json/);
});
