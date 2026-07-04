import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");
const hasFile = (path) => existsSync(new URL(path, root));

test("Rust native core exposes fine-grained editing commands", () => {
  const lib = read("src-tauri/src/lib.rs");
  assert.match(lib, /save_request/);
  assert.match(lib, /delete_request/);
  assert.match(lib, /create_folder/);
  assert.match(lib, /update_folder/);
  assert.match(lib, /delete_folder/);
  assert.match(lib, /create_request/);
});

test("frontend API client invokes native editing commands", () => {
  const localStore = read("src/renderer/src/services/local-store.ts");
  
  assert.match(localStore, /export async function saveRequest/);
  assert.match(localStore, /invoke<void>\("save_request", \{ request \}\)/);
  
  assert.match(localStore, /export async function deleteRequest/);
  assert.match(localStore, /invoke<void>\("delete_request", \{ requestId \}\)/);

  assert.match(localStore, /export async function createFolder/);
  assert.match(localStore, /export async function deleteFolder/);
  assert.match(localStore, /export async function createRequest/);
});

test("App.tsx implements editable state management", () => {
  const app = read("src/renderer/src/App.tsx");

  // Check for the draft request state
  assert.match(app, /const \[draftRequest, setDraftRequest\] = useState<SavedRequest \| null>\(null\);/);

  // Check that inputs are bound to draftRequest, e.g. URL
  assert.match(app, /value=\{draftRequest\.url\}/);
  
  // Check for save functions
  assert.match(app, /async function handleSaveRequest\(\)/);
  assert.match(app, /async function handleCreateFolder\(\)/);
  assert.match(app, /async function handleDeleteFolder/);
  assert.match(app, /async function handleCreateRequest/);
  assert.match(app, /async function handleDeleteRequest/);
});
