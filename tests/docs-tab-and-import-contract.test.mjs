import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function read(relPath) {
  return fs.readFileSync(relPath, "utf-8");
}

test("SavedRequest, CollectionSummary, FolderSummary contract: includes optional description property", () => {
  const types = read("src/renderer/src/types.ts");
  assert.match(types, /export interface FolderSummary[\s\S]*?description\?:\s*string;/);
  assert.match(types, /export interface CollectionSummary[\s\S]*?description\?:\s*string;/);
  assert.match(types, /export interface SavedRequest[\s\S]*?description\?:\s*string;/);
});

test("Postman import service contract: extracts markdown documentation / description into collections, folders, and requests", () => {
  const postmanImport = read("src/renderer/src/services/postman-import.ts");
  assert.match(postmanImport, /collectionDescription\?:\s*string;/);
  assert.match(postmanImport, /collectionDesc/);
  assert.match(postmanImport, /folderDesc/);
  assert.match(postmanImport, /description:\s*folderDesc/);
  assert.match(postmanImport, /description:\s*reqDesc/);
});

test("Universal import parser contract: extracts description for OpenAPI, Postman, and Insomnia across collections, folders, requests", () => {
  const importParser = read("src/renderer/src/services/import-parser.ts");
  assert.match(importParser, /export interface CollectionRowExport[\s\S]*?description\?:\s*string;/);
  assert.match(importParser, /export interface FolderRowExport[\s\S]*?description\?:\s*string;/);
  assert.match(importParser, /description:\s*reqDesc/);
  assert.match(importParser, /description:\s*colDesc/);
  assert.match(importParser, /description:\s*folderDesc/);
  assert.match(importParser, /description:\s*openApiDesc/);
  assert.match(importParser, /description:\s*openApiCollectionDesc/);
  assert.match(importParser, /description:\s*res\.description/);
});

test("useWorkspace hook contract: persists collection, folder, and request descriptions on import and update", () => {
  const hook = read("src/renderer/src/hooks/useWorkspace.ts");
  assert.match(hook, /saveCollectionDescription\(collectionId,\s*result\.collectionDescription\)/);
  assert.match(hook, /saveFolderDescription\(newFolder\.id,\s*folder\.description\)/);
  assert.match(hook, /description:\s*req\.description/);
  assert.match(hook, /saveCollectionDescription\(collection\.id,\s*collection\.description/);
  assert.match(hook, /saveFolderDescription\(folder\.id,\s*folder\.description/);
});

test("CollectionEditor & FolderEditor contract: includes Docs tab and renders DocsEditor", () => {
  const colEditor = read("src/renderer/src/components/CollectionEditor.tsx");
  assert.match(colEditor, /id:\s*"docs",\s*label:\s*"Docs"/);
  assert.match(colEditor, /<DocsEditor/);
  assert.match(colEditor, /saveCollectionDescription/);

  const folderEditor = read("src/renderer/src/components/FolderEditor.tsx");
  assert.match(folderEditor, /id:\s*"docs",\s*label:\s*"Docs"/);
  assert.match(folderEditor, /<DocsEditor/);
  assert.match(folderEditor, /saveFolderDescription/);
});

test("Sidebar contract: searches across request, folder, and collection descriptions", () => {
  const sidebar = read("src/renderer/src/components/Sidebar.tsx");
  assert.match(sidebar, /request\.description\s*&&\s*matchesCollectionSearch\(request\.description\)/);
  assert.match(sidebar, /folder\.description\s*&&\s*matchesCollectionSearch\(folder\.description\)/);
  assert.match(sidebar, /collection\.description\s*&&\s*matchesCollectionSearch\(collection\.description\)/);
});

test("Rust persistence contract: supports description columns and commands in persistence.rs and lib.rs", () => {
  const persistence = read("src-tauri/src/persistence.rs");
  assert.match(persistence, /pub fn save_folder_description/);
  assert.match(persistence, /pub fn save_collection_description/);
  assert.match(persistence, /ensure_description_columns/);

  const lib = read("src-tauri/src/lib.rs");
  assert.match(lib, /save_folder_description/);
  assert.match(lib, /save_collection_description/);
});

test("RequestPanel contract: includes docs tab in tab-row and renders DocsEditor", () => {
  const panel = read("src/renderer/src/components/RequestPanel.tsx");
  assert.match(panel, /"docs"/);
  assert.match(panel, /import\s+\{\s*DocsEditor\s*\}\s+from\s+"\.(\/DocsEditor)";/);
  assert.match(panel, /tab === "docs"/);
  assert.match(panel, /<DocsEditor/);
  assert.match(panel, /activeTab === "docs"/);
});

test("DocsEditor component contract: supports preview, edit, and split modes with markdown rendering", () => {
  const docsEditor = read("src/renderer/src/components/DocsEditor.tsx");
  assert.match(docsEditor, /export const DocsEditor/);
  assert.match(docsEditor, /renderMarkdownContent/);
  assert.match(docsEditor, /docs-mode-segmented/);
  assert.match(docsEditor, /markdown-table/);
  assert.match(docsEditor, /markdown-alert/);
  assert.match(docsEditor, /markdown-codeblock/);
});

test("styles.css contract: defines styles for Docs tab, markdown elements, and Response Examples", () => {
  const styles = read("src/renderer/src/styles.css");
  assert.match(styles, /\.docs-tab-panel/);
  assert.match(styles, /\.docs-toolbar/);
  assert.match(styles, /\.docs-markdown-body/);
  assert.match(styles, /\.markdown-table/);
  assert.match(styles, /\.markdown-alert/);
  assert.match(styles, /\.docs-examples-section/);
  assert.match(styles, /\.docs-example-pill/);
  assert.match(styles, /\.docs-example-card/);
});

test("Response Examples contract: SavedRequest, Postman import, Universal parser, and Rust persistence preserve sample responses", () => {
  const types = read("src/renderer/src/types.ts");
  assert.match(types, /export interface ResponseExample\s*\{/);
  assert.match(types, /examples\?:\s*ResponseExample\[\];/);

  const postmanImport = read("src/renderer/src/services/postman-import.ts");
  assert.match(postmanImport, /examples\?:\s*ResponseExample\[\];/);
  assert.match(postmanImport, /item\.response/);

  const importParser = read("src/renderer/src/services/import-parser.ts");
  assert.match(importParser, /examples\?:\s*ResponseExample\[\];/);
  assert.match(importParser, /item\.response/);

  const persistence = read("src-tauri/src/persistence.rs");
  assert.match(persistence, /pub struct ResponseExample/);
  assert.match(persistence, /ensure_request_examples_column/);
  assert.match(persistence, /pub examples:\s*Option<Vec<ResponseExample>>/);

  const docsEditor = read("src/renderer/src/components/DocsEditor.tsx");
  assert.match(docsEditor, /examples\?:\s*ResponseExample\[\]/);
  assert.match(docsEditor, /docs-examples-section/);
  assert.match(docsEditor, /docs-example-pill/);
});
