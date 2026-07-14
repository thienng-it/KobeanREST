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
  assert.match(app, /const \[renamingEnvironment, setRenamingEnvironment\] = useState\(""\);/);
  assert.match(app, /const \[environmentNameDraft, setEnvironmentNameDraft\] = useState\(""\);/);
  assert.match(app, /function startEnvironmentRename\(name: string\)/);
  assert.match(app, /async function applyEnvironmentRename\(oldName: string\)/);
  const createEnvironmentBlock = app.match(/async function handleCreateEnvironment\(\) \{[\s\S]*?\n  \}/);
  const renameEnvironmentBlock = app.match(/async function handleRenameEnvironment\(oldName: string\) \{[\s\S]*?\n  \}/);
  const applyEnvironmentRenameBlock = app.match(/async function applyEnvironmentRename\(oldName: string\) \{[\s\S]*?\n  \}/);
  const deleteEnvironmentBlock = app.match(/async function handleDeleteEnvironment\(name: string\) \{[\s\S]*?\n  \}/);
  assert.ok(createEnvironmentBlock);
  assert.ok(renameEnvironmentBlock);
  assert.ok(applyEnvironmentRenameBlock);
  assert.ok(deleteEnvironmentBlock);
  assert.match(createEnvironmentBlock[0], /const baseName = "New Environment";/);
  assert.match(createEnvironmentBlock[0], /while \(existingNames\.has\(name\)\)/);
  assert.match(createEnvironmentBlock[0], /await createEnvironment\(name\);/);
  assert.match(createEnvironmentBlock[0], /setEnvEditorTarget\(name\);/);
  assert.doesNotMatch(createEnvironmentBlock[0], /prompt\(/);
  assert.match(renameEnvironmentBlock[0], /startEnvironmentRename\(oldName\);/);
  assert.doesNotMatch(renameEnvironmentBlock[0], /prompt\(/);
  assert.match(applyEnvironmentRenameBlock[0], /environment\.name === newName && environment\.name !== oldName/);
  assert.match(deleteEnvironmentBlock[0], /activeEnvironment: prev\.activeEnvironment === name \?/);

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

test("environment switcher uses polished class-based controls", () => {
  const app = read("src/renderer/src/App.tsx");
  const styles = read("src/renderer/src/styles.css");
  const switcherBlock = app.match(/<div className="environment-switcher">[\s\S]*?<\/div>/);

  assert.ok(switcherBlock);
  assert.match(switcherBlock[0], /className="environment-switcher-icon"/);
  assert.match(switcherBlock[0], /className="environment-select"/);
  assert.match(switcherBlock[0], /className="environment-manage-button"/);
  assert.doesNotMatch(switcherBlock[0], /style=\{\{/);
  assert.match(styles, /\.environment-switcher\s*\{/);
  assert.match(styles, /\.environment-select:focus-visible/);
  assert.match(styles, /\.environment-manage-button:hover/);
});

test("environment editor uses modern modal structure instead of inline chrome", () => {
  const app = read("src/renderer/src/App.tsx");
  const styles = read("src/renderer/src/styles.css");

  assert.match(app, /className="modal env-modal"/);
  assert.match(app, /className="env-modal-header"/);
  assert.match(app, /className="env-modal-close"/);
  assert.match(app, /className="env-modal-body"/);
  assert.match(app, /className="env-list-panel"/);
  assert.match(app, /className=\{envEditorTarget === env\.name \? "env-list-row selected" : "env-list-row"\}/);
  assert.match(app, /className="env-row-actions"/);
  assert.match(app, /className="env-rename-input"/);
  assert.match(app, /className="env-variable-panel"/);
  assert.match(app, /className="env-variable-card"/);
  assert.match(app, /className="env-add-variable"/);

  assert.match(styles, /\.modal\.env-modal\s*\{/);
  assert.match(styles, /\.env-modal-header\s*\{/);
  assert.match(styles, /\.env-modal-body\s*\{[\s\S]*grid-template-columns:\s*230px minmax\(0, 1fr\);/);
  assert.match(styles, /\.env-list-row\.selected\s*\{/);
  assert.match(styles, /\.env-rename-input\s*\{/);
  assert.match(styles, /\.env-variable-card\s*\{/);
  assert.match(styles, /\.env-add-variable-fields\s*\{/);
  assert.match(styles, /@media \(max-width:\s*1120px\)\s*\{[\s\S]*\.env-modal-body\s*\{[\s\S]*grid-template-columns:\s*1fr;/);
});

test("environment edit and delete actions are always clickable", () => {
  const styles = read("src/renderer/src/styles.css");
  const actionsBlock = styles.match(/\.env-row-actions\s*\{([\s\S]*?)\n\}/);

  assert.ok(actionsBlock);
  assert.doesNotMatch(actionsBlock[1], /opacity:\s*0;/);
  assert.doesNotMatch(actionsBlock[1], /pointer-events:\s*none;/);
});

test("environment delete confirmation renders above the editor modal", () => {
  const app = read("src/renderer/src/App.tsx");
  const styles = read("src/renderer/src/styles.css");

  assert.match(app, /className="modal-overlay confirm-modal-overlay"/);
  assert.match(styles, /\.confirm-modal-overlay\s*\{[\s\S]*z-index:\s*1100;/);
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
