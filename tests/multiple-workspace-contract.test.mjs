import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");

test("persistence.rs exposes multi-workspace commands", () => {
  const p = read("src-tauri/src/persistence.rs");
  assert.match(p, /pub struct WorkspaceListItem/);
  assert.match(p, /pub fn list_workspaces\(app: AppHandle\)/);
  assert.match(p, /pub fn rename_workspace\(app: AppHandle, workspace_id: String, name: String\)/);
  assert.match(p, /pub fn delete_workspace\(app: AppHandle, workspace_id: String\)/);
  assert.match(p, /pub fn switch_workspace\(app: AppHandle, workspace_id: String\)/);
  assert.match(p, /pub fn load_workspace_by_id\(app: AppHandle, workspace_id: String\)/);
});

test("lib.rs registers all multi-workspace commands", () => {
  const lib = read("src-tauri/src/lib.rs");
  assert.match(lib, /list_workspaces/);
  assert.match(lib, /rename_workspace/);
  assert.match(lib, /delete_workspace/);
  assert.match(lib, /switch_workspace/);
  assert.match(lib, /load_workspace_by_id/);
});

test("last_active_workspace_id is persisted in settings table", () => {
  const p = read("src-tauri/src/persistence.rs");
  assert.match(p, /last_active_workspace_id/);
});

test("delete_workspace prevents deleting last workspace", () => {
  const p = read("src-tauri/src/persistence.rs");
  assert.match(p, /cannot delete the last workspace/);
});

test("local-store.ts exposes multi-workspace service functions", () => {
  const s = read("src/renderer/src/services/local-store.ts");
  assert.match(s, /export async function listWorkspaces/);
  assert.match(s, /invoke<WorkspaceListItem\[\]>\("list_workspaces"/);
  assert.match(s, /export async function renameWorkspace/);
  assert.match(s, /invoke<void>\("rename_workspace"/);
  assert.match(s, /export async function deleteWorkspace/);
  assert.match(s, /invoke<void>\("delete_workspace"/);
  assert.match(s, /export async function switchWorkspace/);
  assert.match(s, /invoke<WorkspaceSummary>\("switch_workspace"/);
  assert.match(s, /export async function loadWorkspaceById/);
  assert.match(s, /invoke<WorkspaceSummary>\("load_workspace_by_id"/);
});

test("types.ts has WorkspaceListItem interface", () => {
  const t = read("src/renderer/src/types.ts");
  assert.match(t, /export interface WorkspaceListItem/);
  assert.match(t, /id: string;/);
});

