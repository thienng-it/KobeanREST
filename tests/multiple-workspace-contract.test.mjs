import { readFileSync, lstatSync, readdirSync, existsSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const readSource = (dir) => {
  let result = "";
  for (const entry of readdirSync(new URL(dir, root))) {
    const entryUrl = new URL(`${dir}/${entry}`, root);
    const stats = lstatSync(entryUrl);
    if (stats.isDirectory()) {
      result += readSource(`${dir}/${entry}`);
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx") || entry.endsWith(".css")) {
      result += readFileSync(entryUrl, "utf8").replace(/\r\n/g, "\n") + "\n";
    }
  }
  return result;
};

const read = (path) => {
  if (path === "src/renderer/src/App.tsx") {
    return readSource("src/renderer/src");
  }
  return readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");
};

test("persistence.rs exposes multi-workspace commands", () => {
  const p = read("src-tauri/src/persistence.rs");
  assert.match(p, /pub struct WorkspaceListItem/);
  assert.match(p, /pub fn list_workspaces\(app: AppHandle\)/);
  assert.match(p, /pub fn rename_workspace\(app: AppHandle, workspace_id: String, name: String\)/);
  assert.match(p, /pub fn delete_workspace\(app: AppHandle, workspace_id: String\)/);
  assert.match(p, /pub fn switch_workspace\(app: AppHandle, workspace_id: String\)/);
  assert.match(p, /pub fn load_workspace_by_id\(\s*app: AppHandle,\s*workspace_id: String,?\s*\)/);
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

test("useWorkspace.ts exports multi-workspace handlers", () => {
  const h = read("src/renderer/src/hooks/useWorkspace.ts");
  assert.match(h, /workspaceList/);
  assert.match(h, /handleCreateWorkspace/);
  assert.match(h, /handleSwitchWorkspace/);
  assert.match(h, /handleRenameWorkspace/);
  assert.match(h, /handleDeleteWorkspace/);
  assert.match(h, /listWorkspaces/);
  assert.match(h, /switchWorkspace/);
});

test("WorkspaceSwitcherModal component exists and has required props", () => {
  assert.ok(existsSync(new URL("src/renderer/src/components/WorkspaceSwitcherModal.tsx", root)));
  const c = read("src/renderer/src/components/WorkspaceSwitcherModal.tsx");
  assert.match(c, /WorkspaceSwitcherModal/);
  assert.match(c, /modal-overlay/);
  assert.match(c, /onCreate/);
  assert.match(c, /onSwitch/);
  assert.match(c, /onRename/);
  assert.match(c, /onDelete/);
});

test("App.tsx imports and renders WorkspaceSwitcherModal", () => {
  const app = read("src/renderer/src/App.tsx");
  assert.match(app, /WorkspaceSwitcherModal/);
  assert.match(app, /workspaceList/);
  assert.match(app, /handleSwitchWorkspace/);
  assert.match(app, /handleCreateWorkspace/);
  assert.match(app, /workspaceSwitcherOpen/);
});

test("Sidebar.tsx has onOpenWorkspaceSwitcher prop", () => {
  const s = read("src/renderer/src/components/Sidebar.tsx");
  assert.match(s, /onOpenWorkspaceSwitcher/);
});

test("architecture docs describe multi-workspace support", () => {
  const arch = read("docs/architecture/ARCHITECTURE.md");
  assert.match(arch, /[Mm]ultiple [Ww]orkspace/);
  assert.match(arch, /WorkspaceSwitcherModal/);
  assert.match(arch, /list_workspaces/);
  assert.match(arch, /last_active_workspace_id/);
});





