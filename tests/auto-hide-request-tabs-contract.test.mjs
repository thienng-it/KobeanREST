import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function read(relPath) {
  return fs.readFileSync(relPath, "utf-8");
}

test("App.tsx contract: maintains isRequestTabsCollapsed state and auto-collapses on large response", () => {
  const app = read("src/renderer/src/App.tsx");
  assert.match(app, /isRequestTabsCollapsed/);
  assert.match(app, /isLargeResponse/);
  assert.match(app, /setIsRequestTabsCollapsed\(true\)/);
  assert.match(app, /isTabsCollapsed=\{isRequestTabsCollapsed\}/);
  assert.match(app, /isRequestTabsCollapsed=\{isRequestTabsCollapsed\}/);
});

test("RequestPanel.tsx contract: supports isTabsCollapsed and renders toggle button + collapsed bar", () => {
  const panel = read("src/renderer/src/components/RequestPanel.tsx");
  assert.match(panel, /isTabsCollapsed\?: boolean;/);
  assert.match(panel, /onToggleTabsCollapsed\?: \(collapsed: boolean\) => void;/);
  assert.match(panel, /request-tabs-toggle-btn/);
  assert.match(panel, /request-workspace-collapsed-bar/);
  assert.match(panel, /request-workspace-expand-btn/);
});

test("BottomDock.tsx contract: supports isRequestTabsCollapsed with expanded-view styling", () => {
  const dock = read("src/renderer/src/components/BottomDock.tsx");
  assert.match(dock, /isRequestTabsCollapsed\?: boolean;/);
  assert.match(dock, /expanded-view/);
});

test("styles.css contract: contains styles for collapsed request panel and collapsed bar", () => {
  const styles = read("src/renderer/src/styles.css");
  assert.match(styles, /\.request-panel\.collapsed/);
  assert.match(styles, /\.request-tabs-toggle-btn/);
  assert.match(styles, /\.request-workspace-collapsed-bar/);
  assert.match(styles, /\.request-workspace-expand-btn/);
});
