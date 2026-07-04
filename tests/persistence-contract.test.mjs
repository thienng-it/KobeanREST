import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
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

  const lib = read("src-tauri/src/lib.rs");
  assert.match(lib, /mod persistence;/);
  assert.match(lib, /initialize_persistence/);
  assert.match(lib, /load_workspace/);
  assert.match(lib, /record_request_history/);
});

test("renderer local store service invokes persistence commands with preview fallback", () => {
  assert.equal(hasFile("src/renderer/src/services/local-store.ts"), true);

  const service = read("src/renderer/src/services/local-store.ts");
  assert.match(service, /invoke<PersistenceStatus>\("initialize_persistence"/);
  assert.match(service, /invoke<WorkspaceSummary>\("load_workspace"/);
  assert.match(service, /invoke<void>\("record_request_history"/);
  assert.match(service, /window\.__TAURI_INTERNALS__/);
  assert.match(service, /sampleWorkspace/);
});

test("request UI loads workspace data and records request history after send", () => {
  const app = read("src/renderer/src/App.tsx");

  assert.match(app, /loadLocalWorkspace/);
  assert.match(app, /recordRequestHistory/);
  assert.match(app, /useEffect/);
  assert.match(app, /setWorkspace/);
  assert.match(app, /requestId: (requestToSend|draftRequest)\.id/);
});
