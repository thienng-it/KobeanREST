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

test("Universal import parser service is registered and supports all major API formats", () => {
  assert.equal(hasFile("src/renderer/src/services/import-parser.ts"), true);

  const parserCode = read("src/renderer/src/services/import-parser.ts");

  // Format type enum / string checks
  assert.match(parserCode, /"postman-collection"/);
  assert.match(parserCode, /"postman-environment"/);
  assert.match(parserCode, /"hapi-routes"/);
  assert.match(parserCode, /"openapi"/);
  assert.match(parserCode, /"insomnia"/);
  assert.match(parserCode, /"har"/);
  assert.match(parserCode, /"curl"/);
  assert.match(parserCode, /"kobeanrest-native"/);

  // Auto-detection logic checks
  assert.match(parserCode, /export function detectImportFormat/);
  assert.match(parserCode, /export function parseUniversalImport/);
  assert.match(parserCode, /server/);
  assert.match(parserCode, /openapi/);
});

test("Universal Import Modal UI component supports file drag-drop, text paste and format preview", () => {
  assert.equal(hasFile("src/renderer/src/components/UniversalImportModal.tsx"), true);

  const modalCode = read("src/renderer/src/components/UniversalImportModal.tsx");

  assert.match(modalCode, /UniversalImportModal/);
  assert.match(modalCode, /Upload File \/ Drag &amp; Drop/);
  assert.match(modalCode, /Paste Text \/ cURL \/ Code/);
  assert.match(modalCode, /Detected:/);
  assert.match(modalCode, /Import API Specification/);
});

test("App.tsx integrates UniversalImportModal for workspace and cURL imports", () => {
  const appCode = read("src/renderer/src/App.tsx");

  assert.match(appCode, /UniversalImportModal/);
  assert.match(appCode, /universalImportModalOpen/);
  assert.match(appCode, /importWorkspaceData/);
});
