import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");
const hasFile = (path) => existsSync(new URL(path, root));

test("docs site has a GitHub Pages-ready Vite app with hash routes", () => {
  assert.equal(hasFile("docs-site/package.json"), true);
  assert.equal(hasFile("docs-site/src/App.tsx"), true);
  assert.equal(hasFile("docs-site/src/site.ts"), true);
  assert.equal(hasFile("docs-site/src/styles.css"), true);

  const pkg = read("package.json");
  const site = read("docs-site/src/site.ts");
  const app = read("docs-site/src/App.tsx");

  assert.match(pkg, /"build:docs": "npm --prefix docs-site run build"/);
  assert.match(site, /parseRoute\(hash: string\)/);
  assert.match(site, /#\/product/);
  assert.match(site, /#\/downloads/);
  assert.match(site, /#\/developer/);
  assert.match(site, /#\/release/);
  assert.match(site, /#\/roadmap/);
  assert.match(site, /#\/qa/);
  assert.match(app, /hashchange/);
});

test("docs site includes product, download, developer, release, roadmap, and QA content", () => {
  const combined = [
    "docs-site/src/content/product.tsx",
    "docs-site/src/content/downloads.tsx",
    "docs-site/src/content/developer.tsx",
    "docs-site/src/content/release.tsx",
    "docs-site/src/content/roadmap.tsx",
    "docs-site/src/content/qa.tsx",
  ].map(read).join("\n");

  assert.match(combined, /local-first desktop REST client/i);
  assert.match(combined, /GitHub Releases/);
  assert.match(combined, /KobeanREST_0\.1\.0_universal\.dmg/);
  assert.match(combined, /KobeanREST_0\.1\.0_x64_en-US\.msi/);
  assert.match(combined, /KobeanREST_0\.1\.0_amd64\.AppImage/);
  assert.match(combined, /KobeanREST_0\.1\.0_amd64\.deb/);
  assert.match(combined, /curl -L -o KobeanREST\.dmg/);
  assert.match(combined, /Invoke-WebRequest/);
  assert.match(combined, /Tauri 2/);
  assert.match(combined, /TAURI_SIGNING_PRIVATE_KEY/);
  assert.match(combined, /phases 1A through 1P complete/i);
  assert.match(combined, /Release QA checklist/i);
  assert.doesNotMatch(combined, /KobeanREST user accounts are supported/i);
});

test("docs site deployment workflow publishes the built portal to GitHub Pages", () => {
  assert.equal(hasFile(".github/workflows/docs-site.yml"), true);

  const workflow = read(".github/workflows/docs-site.yml");
  assert.match(workflow, /Build docs site/);
  assert.match(workflow, /npm run build:docs/);
  assert.match(workflow, /actions\/configure-pages@v6/);
  assert.match(workflow, /actions\/upload-pages-artifact@v5/);
  assert.match(workflow, /actions\/deploy-pages@v5/);
  assert.match(workflow, /docs-site\/dist/);
});
