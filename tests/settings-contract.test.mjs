import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("Rust native core exposes app settings commands with privacy-preserving defaults", () => {
  const persistence = read("src-tauri/src/persistence.rs");

  assert.match(persistence, /pub struct AppSettings/);
  assert.match(persistence, /pub update_checks_enabled: bool/);
  assert.match(persistence, /pub theme: String/);
  assert.match(persistence, /pub export_redaction_enabled: bool/);
  assert.match(persistence, /pub diagnostics_redaction_enabled: bool/);
  assert.match(persistence, /pub offline_behavior: String/);

  assert.match(persistence, /fn default_app_settings\(\) -> AppSettings/);
  assert.match(persistence, /update_checks_enabled: false/);
  assert.match(persistence, /theme: "system"/);
  assert.match(persistence, /export_redaction_enabled: true/);
  assert.match(persistence, /diagnostics_redaction_enabled: true/);
  assert.match(persistence, /offline_behavior: "silent"/);

  assert.match(persistence, /pub fn load_app_settings/);
  assert.match(persistence, /pub fn save_app_settings/);

  const lib = read("src-tauri/src/lib.rs");
  assert.match(lib, /load_app_settings/);
  assert.match(lib, /save_app_settings/);
});

test("frontend service invokes app settings commands with preview defaults", () => {
  const localStore = read("src/renderer/src/services/local-store.ts");

  assert.match(localStore, /export const defaultAppSettings/);
  assert.match(localStore, /updateChecksEnabled: false/);
  assert.match(localStore, /theme: "system"/);
  assert.match(localStore, /exportRedactionEnabled: true/);
  assert.match(localStore, /diagnosticsRedactionEnabled: true/);
  assert.match(localStore, /offlineBehavior: "silent"/);

  assert.match(localStore, /export async function loadAppSettings/);
  assert.match(localStore, /invoke.*"load_app_settings"/);

  assert.match(localStore, /export async function saveAppSettings/);
  assert.match(localStore, /invoke.*"save_app_settings"/);

  assert.match(localStore, /export async function checkForUpdates/);
  assert.match(localStore, /invoke.*"check_for_update"/);
});

test("renderer types include app settings and update preview models", () => {
  const types = read("src/renderer/src/types.ts");

  assert.match(types, /export interface AppSettings/);
  assert.match(types, /updateChecksEnabled: boolean/);
  assert.match(types, /theme: "system" \| "light" \| "dark"/);
  assert.match(types, /exportRedactionEnabled: boolean/);
  assert.match(types, /diagnosticsRedactionEnabled: boolean/);
  assert.match(types, /offlineBehavior: "silent" \| "notice"/);

  assert.match(types, /export interface UpdateCheckPreview/);
  assert.match(types, /enabledByDefault: boolean/);
  assert.match(types, /requiresAccount: boolean/);
  assert.match(types, /metadata: string/);
});

test("App.tsx implements settings state, persistence, and theme application", () => {
  const app = read("src/renderer/src/App.tsx");

  assert.match(app, /const \[settingsOpen, setSettingsOpen\] = useState/);
  assert.match(app, /const \[appSettings, setAppSettings\] = useState/);
  assert.match(app, /const \[databasePath, setDatabasePath\] = useState/);
  assert.match(app, /const \[updateStatus, setUpdateStatus\] = useState/);

  assert.match(app, /async function handleSaveSettings/);
  assert.match(app, /async function handleCheckForUpdates/);

  assert.match(app, /document\.documentElement\.dataset\.theme/);
  assert.match(app, /document\.documentElement\.style\.colorScheme/);

  assert.match(app, /aria-label="Settings"/);
  assert.match(app, /aria-label="App settings"/);
  assert.match(app, /Update checks after launch/);
  assert.match(app, /Theme/);
  assert.match(app, /Data location/);
  assert.match(app, /Export redaction/);
  assert.match(app, /Diagnostics redaction/);
  assert.match(app, /Offline behavior/);
});

test("automatic update checks are gated by the saved preference", () => {
  const app = read("src/renderer/src/App.tsx");

  assert.match(app, /if \(loadedSettings\.updateChecksEnabled\)/);
  assert.match(app, /void handleCheckForUpdates\("automatic", loadedSettings\)/);
  assert.match(app, /if \(!settingsOverride\.updateChecksEnabled && trigger === "automatic"\) return;/);
});
