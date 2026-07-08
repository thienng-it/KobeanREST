import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");

test("Rust native core exposes environment editing commands", () => {
  const persistence = read("src-tauri/src/persistence.rs");

  assert.match(persistence, /pub fn create_environment/);
  assert.match(persistence, /pub fn rename_environment/);
  assert.match(persistence, /pub fn delete_environment/);
  assert.match(persistence, /pub fn set_active_environment/);
  assert.match(persistence, /pub fn save_variable/);
  assert.match(persistence, /pub fn delete_variable/);
  assert.match(persistence, /pub fn save_secret_variable/);

  const lib = read("src-tauri/src/lib.rs");
  assert.match(lib, /create_environment/);
  assert.match(lib, /rename_environment/);
  assert.match(lib, /delete_environment/);
  assert.match(lib, /set_active_environment/);
  assert.match(lib, /save_variable/);
  assert.match(lib, /delete_variable/);
  assert.match(lib, /save_secret_variable/);
});

test("secret variable command stores only a ref, never a raw secret value", () => {
  const persistence = read("src-tauri/src/persistence.rs");

  // save_secret_variable must accept secret_ref, not a raw value
  assert.match(persistence, /save_secret_variable/);
  assert.match(persistence, /secret_ref: String/);

  // The raw value stored must be the REDACTED constant
  assert.match(persistence, /REDACTED_SECRET_VALUE/);

  // The function must NOT write arbitrary raw values — confirm it uses the constant
  const fnStart = persistence.indexOf("pub fn save_secret_variable");
  const fnBody = persistence.slice(fnStart, fnStart + 600);
  assert.match(fnBody, /REDACTED_SECRET_VALUE/);
  assert.doesNotMatch(fnBody, /value: String/);
});

test("frontend API client invokes native environment commands", () => {
  const localStore = read("src/renderer/src/services/local-store.ts");

  assert.match(localStore, /export async function createEnvironment/);
  assert.match(localStore, /invoke.*"create_environment"/);

  assert.match(localStore, /export async function renameEnvironment/);
  assert.match(localStore, /invoke.*"rename_environment"/);

  assert.match(localStore, /export async function deleteEnvironment/);
  assert.match(localStore, /invoke.*"delete_environment"/);

  assert.match(localStore, /export async function setActiveEnvironment/);
  assert.match(localStore, /invoke.*"set_active_environment"/);

  assert.match(localStore, /export async function saveVariable/);
  assert.match(localStore, /invoke.*"save_variable"/);

  assert.match(localStore, /export async function deleteVariable/);
  assert.match(localStore, /invoke.*"delete_variable"/);

  assert.match(localStore, /export async function saveSecretVariable/);
  assert.match(localStore, /invoke.*"save_secret_variable"/);
});

test("App.tsx implements environment editor state management", () => {
  const app = read("src/renderer/src/App.tsx");

  // Environment editor open state
  assert.match(app, /const \[envEditorOpen, setEnvEditorOpen\] = useState/);
  assert.match(app, /const \[envEditorTarget, setEnvEditorTarget\] = useState/);

  // Active environment switching
  assert.match(app, /async function handleSetActiveEnvironment/);
  assert.match(app, /setWorkspace.*activeEnvironment.*name/);

  // Environment CRUD
  assert.match(app, /async function handleCreateEnvironment/);
  assert.match(app, /async function handleRenameEnvironment/);
  assert.match(app, /async function handleDeleteEnvironment/);

  // Variable CRUD
  assert.match(app, /async function handleSaveVariable/);
  assert.match(app, /async function handleDeleteVariable/);

  // Secret variable goes through secret service
  assert.match(app, /async function handleAddSecretVariable/);
  assert.match(app, /storeSecret/);
  assert.match(app, /saveSecretVariable/);

  // Environment selector in the UI
  assert.match(app, /aria-label="Active environment"/);
  assert.match(app, /aria-label="Manage environments"/);
  assert.match(app, /aria-label="Environment editor"/);
});

test("secret variable writes go through secret service boundary in App.tsx", () => {
  const app = read("src/renderer/src/App.tsx");

  // storeSecret is imported from secrets service
  assert.match(app, /from "\.\/services\/secrets"/);
  assert.match(app, /storeSecret/);

  // saveSecretVariable is called with refId (from storeSecret result), not the raw value
  const fnStart = app.indexOf("async function handleAddSecretVariable");
  const fnBody = app.slice(fnStart, fnStart + 400);
  assert.match(fnBody, /storeSecret/);
  assert.match(fnBody, /refId/);
  assert.match(fnBody, /saveSecretVariable.*refId/);
});
