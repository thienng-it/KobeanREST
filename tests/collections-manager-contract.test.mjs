import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");
const hasFile = (path) => existsSync(new URL(path, root));

test("CollectionsManager component exists and provides full collection dashboard capabilities", () => {
  assert.equal(hasFile("src/renderer/src/components/CollectionsManager.tsx"), true);
  const manager = read("src/renderer/src/components/CollectionsManager.tsx");

  assert.match(manager, /export function CollectionsManager/);
  assert.match(manager, /Collections Hub/);
  assert.match(manager, /Total Collections/);
  assert.match(manager, /Total Requests/);
  assert.match(manager, /Folders & Groups/);
  assert.match(manager, /Protected Collections/);
  assert.match(manager, /searchQuery/);
  assert.match(manager, /viewMode/);
  assert.match(manager, /onOpenCollection/);
  assert.match(manager, /onRunCollection/);
  assert.match(manager, /onCreateRequestInCollection/);
  assert.match(manager, /onCreateFolderInCollection/);
  assert.match(manager, /onLockCollectionToggle/);
  assert.match(manager, /onDeleteCollection/);
});

test("Sidebar has interactive Collections header and LayoutGrid overview trigger", () => {
  const sidebar = read("src/renderer/src/components/Sidebar.tsx");

  assert.match(sidebar, /onOpenCollectionsOverview/);
  assert.match(sidebar, /LayoutGrid/);
  assert.match(sidebar, /View all collections/);
});

test("TabBar supports collections-overview tab type and icon", () => {
  const tabBar = read("src/renderer/src/components/TabBar.tsx");

  assert.match(tabBar, /tab\.type === "collections-overview"/);
  assert.match(tabBar, /FolderTree/);
});

test("App manages collections-overview tab state and renders CollectionsManager", () => {
  const app = read("src/renderer/src/App.tsx");

  assert.match(app, /import { CollectionsManager } from "\.\/components\/CollectionsManager"/);
  assert.match(app, /openCollectionsOverviewTab/);
  assert.match(app, /currentTab\?\.type === "collections-overview"/);
  assert.match(app, /<CollectionsManager/);
  assert.match(app, /Browse Collections/);
});

test("Tab type includes collections-overview in types.ts", () => {
  const types = read("src/renderer/src/types.ts");

  assert.match(types, /"collections-overview"/);
});
