import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function read(relPath) {
  return fs.readFileSync(relPath, "utf-8");
}

test("LayoutControls.tsx contract: renders decoupled layout mode toggle for split and stacked views", () => {
  const controls = read("src/renderer/src/components/LayoutControls.tsx");
  assert.match(controls, /layoutMode:\s*["']stacked["']\s*\|\s*["']split["']/);
  assert.match(controls, /onLayoutModeChange:\s*\(mode:\s*["']stacked["']\s*\|\s*["']split["']\)\s*=>\s*void/);
  assert.match(controls, /layout-mode-btn/);
});

test("App.tsx contract: composes decoupled LayoutControls in top toolbar and supports Cmd+\\ shortcut", () => {
  const app = read("src/renderer/src/App.tsx");
  assert.match(app, /import\s*\{\s*LayoutControls\s*\}\s*from\s*["']\.\/components\/LayoutControls["']/);
  assert.match(app, /<LayoutControls/);
  assert.match(app, /e\.key === "\\\\"/);
  assert.match(app, /workspace-panes/);
  assert.match(app, /layoutMode=\{appSettings\.layoutMode \?\? ["']stacked["']\}/);
  assert.match(app, /splitResponseWidth=\{splitResponseWidth\}/);
});

test("BottomDock.tsx contract: supports layoutMode prop and split-mode class", () => {
  const dock = read("src/renderer/src/components/BottomDock.tsx");
  assert.match(dock, /layoutMode\?:\s*["']stacked["']\s*\|\s*["']split["']/);
  assert.match(dock, /splitResponseWidth\?:/);
  assert.match(dock, /split-mode/);
  assert.match(dock, /bottom-dock-toggle-chevron/);
});

test("types.ts contract: AppSettings includes layoutMode and uiDensity", () => {
  const types = read("src/renderer/src/types.ts");
  assert.match(types, /layoutMode\?:\s*["']stacked["']\s*\|\s*["']split["']/);
  assert.match(types, /uiDensity\?:\s*["']comfortable["']\s*\|\s*["']compact["']/);
});

test("styles.css contract: contains styles for workspace panes, split layout, and layout controls", () => {
  const styles = read("src/renderer/src/styles.css");
  assert.match(styles, /\.workspace-panes/);
  assert.match(styles, /\.workspace-panes\.layout-split/);
  assert.match(styles, /\.workspace-panes\.layout-stacked/);
  assert.match(styles, /\.bottom-dock\.split-mode\s*\.bottom-dock-resizer/);
  assert.match(styles, /\.bottom-dock\.split-mode\s*\.bottom-dock-collapse\.expanded\s*\.bottom-dock-toggle-chevron/);
  assert.match(styles, /\.bottom-dock\.split-mode\.dock-collapsed/);
  assert.match(styles, /\.collection-children/);
  assert.match(styles, /\.layout-controls/);
  assert.match(styles, /\[data-density=["']compact["']\]/);
});

test("Sidebar.tsx contract: renders collection-children animated accordion container", () => {
  const sidebar = read("src/renderer/src/components/Sidebar.tsx");
  assert.match(sidebar, /collection-children/);
  assert.match(sidebar, /collection-children-inner/);
});
