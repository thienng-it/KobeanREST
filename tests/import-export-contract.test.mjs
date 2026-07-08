import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");
const hasFile = (path) => existsSync(new URL(path, root));

test("Rust native core exposes export and import commands", () => {
  const lib = read("src-tauri/src/lib.rs");
  assert.match(lib, /export_workspace_data/);
  assert.match(lib, /import_workspace_data/);
});

test("export command explicitly redacts secret values", () => {
  const persistence = read("src-tauri/src/persistence.rs");
  
  // Checking that export logic explicitly checks secret and sets it to redacted
  const exportBlock = persistence.slice(persistence.indexOf("pub fn export_workspace_data"));
  assert.match(exportBlock, /let mut variable_value: String = row\.get\(2\)\?;/);
  assert.match(exportBlock, /if secret != 0 \{/);
  assert.match(exportBlock, /variable_value = REDACTED_SECRET_VALUE\.to_string\(\);/);
});

test("export struct includes workspace data components", () => {
  const persistence = read("src-tauri/src/persistence.rs");

  const structBlock = persistence.slice(persistence.indexOf("pub struct ExportData"));
  assert.match(structBlock, /pub workspaces: Vec<WorkspaceRow>/);
  assert.match(structBlock, /pub collections: Vec<CollectionRow>/);
  assert.match(structBlock, /pub folders: Vec<FolderRow>/);
  assert.match(structBlock, /pub requests: Vec<RequestRow>/);
  assert.match(structBlock, /pub request_headers: Vec<RequestHeaderRow>/);
  assert.match(structBlock, /pub environments: Vec<EnvironmentRow>/);
  assert.match(structBlock, /pub variables: Vec<VariableRow>/);
});

test("import command uses a transaction and maps IDs to prevent collisions", () => {
  const persistence = read("src-tauri/src/persistence.rs");

  const importBlock = persistence.slice(persistence.indexOf("pub fn import_workspace_data"));
  assert.match(importBlock, /\.transaction\(\)/);
  assert.match(importBlock, /uuid::Uuid::new_v4\(\)/);
  assert.match(importBlock, /let mut workspace_id_map = HashMap::new\(\);/);
  assert.match(importBlock, /\.commit\(\)/);
});

test("import command validates file shape by requiring version 1", () => {
  const persistence = read("src-tauri/src/persistence.rs");

  const importBlock = persistence.slice(persistence.indexOf("pub fn import_workspace_data"));
  assert.match(importBlock, /export_data\.version != 1/);
});

test("frontend API client invokes the export and import Tauri commands", () => {
  const localStore = read("src/renderer/src/services/local-store.ts");
  
  assert.match(localStore, /export async function exportWorkspaceData/);
  assert.match(localStore, /invoke<string>\("export_workspace_data"\)/);
  
  assert.match(localStore, /export async function importWorkspaceData/);
  assert.match(localStore, /invoke<void>\("import_workspace_data", \{ json \}\)/);
});
