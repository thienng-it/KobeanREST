import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");
const hasFile = (path) => existsSync(new URL(path, root));

test("SQLite migration creates MVP local persistence tables", () => {
  assert.equal(hasFile("src-tauri/migrations/001_initial.sql"), true);

  const migration = read("src-tauri/migrations/001_initial.sql");
  for (const table of [
    "workspaces",
    "collections",
    "folders",
    "requests",
    "request_headers",
    "environments",
    "variables",
    "request_history",
    "settings",
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
});

test("Rust native core exposes SQLite persistence commands", () => {
  assert.equal(hasFile("src-tauri/src/persistence.rs"), true);

  const persistence = read("src-tauri/src/persistence.rs");
  assert.match(persistence, /rusqlite::Connection/);
  assert.match(persistence, /include_str!\("\.\.\/migrations\/001_initial\.sql"\)/);
  assert.match(persistence, /app_local_data_dir/);
  assert.match(persistence, /pub fn initialize_persistence/);
  assert.match(persistence, /pub fn load_workspace/);
  assert.match(persistence, /pub fn record_request_history/);
  assert.match(persistence, /pub fn create_collection\(app: AppHandle, name: String, workspace_id: Option<String>\)/);
  assert.match(persistence, /None => first_workspace_id\(&connection\)\?/);
  assert.match(persistence, /pub fn update_collection\(app: AppHandle, collection_id: String, name: String\)/);
  assert.match(persistence, /UPDATE collections SET name = \?2 WHERE id = \?1/);
  assert.match(persistence, /pub fn delete_collection\(app: AppHandle, collection_id: String\)/);
  assert.match(persistence, /DELETE FROM scripts WHERE/);
  assert.match(persistence, /DELETE FROM request_headers WHERE request_id IN/);
  assert.match(persistence, /DELETE FROM collections WHERE id = \?1/);

  const lib = read("src-tauri/src/lib.rs");
  assert.match(lib, /mod persistence;/);
  assert.match(lib, /update_collection/);
  assert.match(lib, /delete_collection/);
  assert.match(lib, /initialize_persistence/);
  assert.match(lib, /load_workspace/);
  assert.match(lib, /record_request_history/);
});

test("renderer local store service invokes persistence commands without sample-data fallback", () => {
  assert.equal(hasFile("src/renderer/src/services/local-store.ts"), true);

  const service = read("src/renderer/src/services/local-store.ts");
  assert.match(service, /invoke<PersistenceStatus>\("initialize_persistence"/);
  assert.match(service, /invoke<WorkspaceSummary>\("load_workspace"/);
  assert.match(service, /invoke<void>\("record_request_history"/);
  assert.match(service, /window\.__TAURI_INTERNALS__/);
  assert.match(service, /throw new Error\("Workspace loading is not available in browser preview"\)/);
  assert.doesNotMatch(service, /sampleWorkspace/);
});

test("request UI loads workspace data and records request history after send", () => {
  const app = read("src/renderer/src/App.tsx");

  assert.match(app, /loadLocalWorkspace/);
  assert.match(app, /recordRequestHistory/);
  assert.match(app, /useEffect/);
  assert.match(app, /setWorkspace/);
  assert.match(app, /requestId: (requestToSend|draftRequest)\.id/);
});

test("environment persistence keeps active environment valid", () => {
  const persistence = read("src-tauri/src/persistence.rs");
  const renameBlock = persistence.match(/pub fn rename_environment\([\s\S]*?\n\}/);
  const deleteBlock = persistence.match(/pub fn delete_environment\([\s\S]*?\n\}/);

  assert.ok(renameBlock);
  assert.ok(deleteBlock);
  assert.match(renameBlock[0], /let next_name = new_name\.trim\(\);/);
  assert.match(renameBlock[0], /environment name cannot be blank/);
  assert.match(renameBlock[0], /environment '\{next_name\}' already exists/);
  assert.match(deleteBlock[0], /SELECT name FROM environments/);
  assert.match(deleteBlock[0], /UPDATE workspaces SET active_environment = \?1 WHERE id = \?2 AND active_environment = \?3/);
});
