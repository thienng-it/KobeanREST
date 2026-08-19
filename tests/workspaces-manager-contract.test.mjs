import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");
const hasFile = (path) => existsSync(new URL(path, root));

test("WorkspacesManager component exists and implements full workspaces list view and hub", () => {
  assert.equal(hasFile("src/renderer/src/components/WorkspacesManager.tsx"), true);
  const code = read("src/renderer/src/components/WorkspacesManager.tsx");

  assert.match(code, /export function WorkspacesManager/);
  assert.match(code, /Workspaces Hub/);
  assert.match(code, /Total Workspaces/);
  assert.match(code, /Active Workspace/);
  assert.match(code, /Active Collections/);
  assert.match(code, /Active Requests/);
  assert.match(code, /Environments/);
  assert.match(code, /New Workspace/);
  assert.match(code, /onSwitchWorkspace/);
  assert.match(code, /onRenameWorkspace/);
  assert.match(code, /onDeleteWorkspace/);
  assert.match(code, /onCloseHub/);
  assert.match(code, /Back to Workspace/);
});

test("WorkspacesManager supports grid/list view switcher, search filtering, and sorting", () => {
  const code = read("src/renderer/src/components/WorkspacesManager.tsx");

  assert.match(code, /viewMode/);
  assert.match(code, /grid/);
  assert.match(code, /list/);
  assert.match(code, /searchQuery/);
  assert.match(code, /filterType/);
  assert.match(code, /active_first/);
  assert.match(code, /name_asc/);
});

test("Sidebar has Workspaces Hub trigger button in brand-row", () => {
  const sidebar = read("src/renderer/src/components/Sidebar.tsx");

  assert.match(sidebar, /onOpenWorkspacesOverview/);
  assert.match(sidebar, /title="Open Workspaces Hub"/);
  assert.match(sidebar, /aria-label="Workspaces Hub"/);
});

test("TabBar supports workspaces-overview tab type and icon", () => {
  const tabbar = read("src/renderer/src/components/TabBar.tsx");

  assert.match(tabbar, /tab\.type === ["']workspaces-overview["']/);
});

test("App manages workspaces-overview tab state and renders WorkspacesManager", () => {
  const app = read("src/renderer/src/App.tsx");

  assert.match(app, /import \{ WorkspacesManager \} from ["']\.\/components\/WorkspacesManager["']/);
  assert.match(app, /openWorkspacesOverviewTab/);
  assert.match(app, /currentTab\?\.type === ["']workspaces-overview["']/);
  assert.match(app, /<WorkspacesManager/);
  assert.match(app, /handleSwitchWorkspace/);
});

test("App renders WorkspacesManager in dedicated full-screen workspaces-hub-layer", () => {
  const app = read("src/renderer/src/App.tsx");

  assert.match(app, /class(Name)?=["']workspaces-hub-layer["']/);
  assert.match(app, /<WorkspacesManager/);
});

test("Tab type in types.ts includes workspaces-overview", () => {
  const types = read("src/renderer/src/types.ts");

  assert.match(types, /["']workspaces-overview["']/);
});

test("ContextMenu and WorkspaceSwitcherModal integrate Workspaces Hub entry points", () => {
  const menu = read("src/renderer/src/components/ContextMenu.tsx");
  assert.match(menu, /onOpenWorkspacesOverview/);
  assert.match(menu, /Workspaces Hub/);

  const switcher = read("src/renderer/src/components/WorkspaceSwitcherModal.tsx");
  assert.match(switcher, /onOpenWorkspacesOverview/);
  assert.match(switcher, /Open Workspaces Hub/);
});
