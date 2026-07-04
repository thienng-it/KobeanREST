import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("Rust native core exposes load and clear history commands", () => {
  const persistence = read("src-tauri/src/persistence.rs");

  assert.match(persistence, /pub struct HistoryEntry/);
  assert.match(persistence, /pub request_id: String/);
  assert.match(persistence, /pub method: String/);
  assert.match(persistence, /pub url: String/);
  assert.match(persistence, /pub status: i64/);
  assert.match(persistence, /pub duration_ms: i64/);
  assert.match(persistence, /pub size_bytes: i64/);
  assert.match(persistence, /pub created_at: String/);

  assert.match(persistence, /pub fn load_request_history/);
  assert.match(persistence, /ORDER BY created_at DESC/);
  assert.match(persistence, /LIMIT 200/);

  assert.match(persistence, /pub fn clear_request_history/);
  assert.match(persistence, /DELETE FROM request_history WHERE workspace_id/);

  const lib = read("src-tauri/src/lib.rs");
  assert.match(lib, /load_request_history/);
  assert.match(lib, /clear_request_history/);
});

test("history entry includes all display fields", () => {
  const types = read("src/renderer/src/types.ts");
  assert.match(types, /export interface HistoryEntry/);
  assert.match(types, /requestId: string/);
  assert.match(types, /method: string/);
  assert.match(types, /url: string/);
  assert.match(types, /status: number/);
  assert.match(types, /durationMs: number/);
  assert.match(types, /sizeBytes: number/);
  assert.match(types, /createdAt: string/);
});

test("frontend service invokes load and clear history commands", () => {
  const localStore = read("src/renderer/src/services/local-store.ts");

  assert.match(localStore, /export async function loadHistory/);
  assert.match(localStore, /invoke.*"load_request_history"/);

  assert.match(localStore, /export async function clearHistory/);
  assert.match(localStore, /invoke.*"clear_request_history"/);
});

test("App.tsx implements history viewer state and handlers", () => {
  const app = read("src/renderer/src/App.tsx");

  assert.match(app, /const \[historyOpen, setHistoryOpen\] = useState/);
  assert.match(app, /const \[historyEntries, setHistoryEntries\] = useState/);
  assert.match(app, /const \[historySearch, setHistorySearch\] = useState/);

  assert.match(app, /async function handleOpenHistory/);
  assert.match(app, /async function handleClearHistory/);
  assert.match(app, /function handleReplayFromHistory/);

  assert.match(app, /aria-label="Request history"/);
  assert.match(app, /aria-label="Search history"/);
  assert.match(app, /aria-label="Replay request"/);
  assert.match(app, /aria-label="Open request history"/);
});

test("history clear deletes rows and replay selects the saved request", () => {
  const app = read("src/renderer/src/App.tsx");

  // Clear wipes the local state
  const clearFn = app.slice(app.indexOf("async function handleClearHistory"), app.indexOf("function handleReplayFromHistory"));
  assert.match(clearFn, /clearHistory/);
  assert.match(clearFn, /setHistoryEntries\(\[\]\)/);

  // Replay selects the request by ID
  const replayFn = app.slice(app.indexOf("function handleReplayFromHistory"), app.indexOf("async function sendSelectedRequest"));
  assert.match(replayFn, /setSelectedRequestId/);
  assert.match(replayFn, /setHistoryOpen\(false\)/);
});

test("successful requests continue to create history rows after Phase 1J", () => {
  const app = read("src/renderer/src/App.tsx");
  assert.match(app, /recordRequestHistory/);
  assert.match(app, /url: historyUrl/);
});
