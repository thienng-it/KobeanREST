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
const hasFile = (path) => existsSync(new URL(path, root));

test("KobeanREST declares a local-only product contract with no user account auth", () => {
  assert.equal(hasFile("src/renderer/src/product-contract.ts"), true);

  const contract = read("src/renderer/src/product-contract.ts");
  assert.match(contract, /download, launch, use/i);
  assert.match(contract, /no login/i);
  assert.match(contract, /no registration/i);
  assert.match(contract, /offline/i);
  assert.match(contract, /automatic update checks/i);
  assert.doesNotMatch(contract, /Auth0|Firebase Auth|Supabase Auth|Clerk|Cognito/);
});

test("app source exposes API request authentication without creating app-user auth", () => {
  assert.equal(hasFile("src/renderer/src/constants.ts"), true);

  const workspace = read("src/renderer/src/constants.ts");
  assert.match(workspace, /Basic Auth/);
  assert.match(workspace, /Bearer Token/);
  assert.match(workspace, /API Key/);
  assert.match(workspace, /OAuth 2\.0/);
  assert.doesNotMatch(workspace, /login|logout|register|sign in|sign up/i);
});

test("download documentation points users to GitHub Release artifacts for all desktop platforms", () => {
  assert.equal(hasFile("docs/download.md"), true);

  const downloadDoc = read("docs/download.md");
  assert.match(downloadDoc, /GitHub Releases/);
  assert.match(downloadDoc, /macOS/i);
  assert.match(downloadDoc, /\.dmg/);
  assert.match(downloadDoc, /Windows/i);
  assert.match(downloadDoc, /\.exe|\.msi/);
  assert.match(downloadDoc, /Linux/i);
  assert.match(downloadDoc, /\.AppImage/);
  assert.match(downloadDoc, /checksums/i);
});

test("topbar Docs button opens the public docs portal", () => {
  const contract = read("src/renderer/src/product-contract.ts");
  const app = read("src/renderer/src/app-utils.ts") + read("src/renderer/src/components/Topbar.tsx");

  assert.match(contract, /PRODUCT_DOCS_URL/);
  assert.match(contract, /https:\/\/thienng-it\.github\.io\/KobeanREST\//);
  assert.match(app, /PRODUCT_DOCS_URL/);
  assert.match(app, /function openProductDocs\(/);
  assert.match(app, /window\.open\(PRODUCT_DOCS_URL/);
  assert.match(app, /onClick=\{onOpenDocs\}/);
});

test("release workflow builds cross-platform installers and update metadata", () => {
  assert.equal(hasFile(".github/workflows/release.yml"), true);

  const workflow = read(".github/workflows/release.yml");
  assert.match(workflow, /macos-latest/);
  assert.match(workflow, /windows-latest/);
  assert.match(workflow, /ubuntu-latest/);
  assert.match(workflow, /tauri-action/);
  assert.match(workflow, /latest\.json/);
  assert.match(workflow, /GITHUB_TOKEN/);
});

test("source tree does not introduce app-user authentication surfaces", () => {
  const files = [
    "package.json",
    "src/renderer/src/App.tsx",
    "src/renderer/src/product-contract.ts",
    "src-tauri/src/lib.rs",
    "src-tauri/src/local_only.rs",
  ];

  const combined = files.filter(hasFile).map(read).join("\n");
  assert.doesNotMatch(combined, /\/login|\/logout|\/register|createUser|signIn|signOut|sessionToken/i);
  assert.doesNotMatch(combined, /Auth0|Firebase Auth|Supabase Auth|Clerk|Cognito/);
});
