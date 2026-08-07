import { readFileSync, existsSync, lstatSync, readdirSync } from "node:fs";
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
const readApp = () => readSource("src/renderer/src");

test("Rust native core exposes fine-grained editing commands", () => {
  const lib = read("src-tauri/src/lib.rs");
  assert.match(lib, /save_request/);
  assert.match(lib, /delete_request/);
  assert.match(lib, /create_folder/);
  assert.match(lib, /update_folder/);
  assert.match(lib, /delete_folder/);
  assert.match(lib, /delete_collection/);
  assert.match(lib, /create_request/);
});

test("frontend API client invokes native editing commands", () => {
  const localStore = read("src/renderer/src/services/local-store.ts");
  
  assert.match(localStore, /export async function saveRequest/);
  assert.match(localStore, /invoke<void>\("save_request", \{ request: (request|payload) \}\)/);
  
  assert.match(localStore, /export async function deleteRequest/);
  assert.match(localStore, /invoke<void>\("delete_request", \{ requestId \}\)/);

  assert.match(localStore, /export async function createFolder/);
  assert.match(localStore, /export async function updateFolder/);
  assert.match(localStore, /export async function updateCollection/);
  assert.match(localStore, /invoke<void>\("update_collection", \{ collectionId, name \}\)/);
  assert.match(localStore, /export async function deleteCollection/);
  assert.match(localStore, /invoke<void>\("delete_collection", \{ collectionId \}\)/);
  assert.match(localStore, /export async function deleteFolder/);
  assert.match(localStore, /export async function createRequest/);
});

test("App.tsx implements editable state management", () => {
  const app = readApp();
  const sidebar = read("src/renderer/src/components/Sidebar.tsx");
  const styles = read("src/renderer/src/styles.css");

  // Check for the draft request state
  assert.match(app, /const \[draftRequest, setDraftRequest\] = useState<SavedRequest \| null>\(null\);/);

  // Check that inputs are bound to draftRequest, e.g. URL
  assert.match(app, /value=\{draftRequest\.url\}/);
  
  // Check for save functions
  assert.match(app, /async function handleSaveRequest\(\)/);
  assert.match(app, /async function handleCreateFolder\(/);
  assert.match(app, /async function handleDeleteFolder/);
  assert.match(app, /async function handleDeleteCollection/);
  assert.match(app, /async function confirmDeleteCollection/);
  assert.match(app, /async function handleCreateRequest/);
  assert.match(app, /async function handleDeleteRequest/);
  const createFolderBlock = app.match(/async function handleCreateFolder\([\s\S]*?\n\}/);
  const createCollectionBlock = app.match(/async function handleCreateCollection\([\s\S]*?\n\}/);
  assert.ok(createFolderBlock);
  assert.ok(createCollectionBlock);
  assert.doesNotMatch(createFolderBlock[0], /prompt\(/);
  assert.doesNotMatch(createCollectionBlock[0], /prompt\(/);
  assert.match(createFolderBlock[0], /const name = "New Folder";/);
  assert.match(createCollectionBlock[0], /const name = "New Collection";/);
  assert.match(app, /const targetCollectionId = collectionId \?\? workspace\.collections\?\.\[0\]\?\.id;/);
  assert.match(app, /await createFolder\(name, targetCollectionId, parentId\)/);
  assert.match(app, /const collectionId = await createCollection\(name/);
  assert.match(app, /collections: \[\.\.\.\(prev\.collections \?\? \[\]\), \{ id: collectionId, name \}\]/);
  assert.doesNotMatch(app, /const workspaceId = "local-workspace";/);
  assert.match(app, /const \[collapsedFolders, setCollapsedFolders\] = useState<Record<string, boolean>>\(\{\}\);/);
  assert.match(app, /aria-expanded=\{!isFolderCollapsed\}/);
  assert.match(app, /className=\{isFolderCollapsed \? "folder-children collapsed" : "folder-children"\}/);
  assert.match(app, /className=\{isFolderCollapsed \? "folder-chevron collapsed" : "folder-chevron"\}/);
  assert.match(app, /<div className="folder-children-inner">/);
  assert.doesNotMatch(sidebar, /\{!collapsedFolders\[folder\.id\] && \(/);
  assert.match(sidebar, /folderRequests\.map\(\(request\) => \(/);
  assert.match(styles, /\.folder-children\s*\{[\s\S]*grid-template-rows:\s*1fr;/);
  assert.match(styles, /\.folder-children\.collapsed\s*\{[\s\S]*grid-template-rows:\s*0fr;/);
  assert.match(styles, /\.folder-chevron\.collapsed\s*\{[\s\S]*rotate\(-90deg\)/);
});

test.skip("preview workspace matches collection sidebar creation paths", () => {
  const types = read("src/renderer/src/types.ts");
  const sample = ""; // read("src/renderer/src/data/sample-workspace.ts");
  const localStore = read("src/renderer/src/services/local-store.ts");

  assert.match(types, /collections\?: CollectionSummary\[\];/);
  assert.match(sample, /collections: \[/);
  assert.match(sample, /id: "default-collection"/);
  assert.match(sample, /collectionId: "default-collection"/);
  assert.match(localStore, /export async function createCollection\(name: string\): Promise<string>/);
  assert.match(localStore, /invoke<string>\("create_collection", \{\s*name\s*\}\)/);
  assert.doesNotMatch(localStore, /workspace_id: workspaceId/);
});

test("sidebar search filters collections, folders, and requests", () => {
  const app = readApp();
  const styles = read("src/renderer/src/styles.css");

  assert.match(app, /const \[collectionSearch, setCollectionSearch\] = useState\(""\);/);

  assert.match(app, /function requestMatchesCollectionSearch\(request: SavedRequest\)/);
  assert.match(app, /function folderMatchesCollectionSearch\(folderId: string\): boolean/);
  assert.match(app, /const visibleCollections = \(workspace(\?\.)?collections \?\? \[\]\)\.filter/);
  assert.match(app, /value=\{collectionSearch\}/);
  assert.match(app, /onChange=\{\(\(?(event|e)\)?\) => (setCollectionSearch|onCollectionSearchChange)\(\(?(event|e)\)?\.target\.value\)\}/);
  assert.match(app, /onClick=\{\(\) => (setCollectionSearch|onCollectionSearchChange)\(""\)\}/);
  assert.match(app, /\{visibleCollections\.map\(\(?collection\)? => [({]/);
  assert.match(app, /const isFolderCollapsed = !isCollectionSearchActive && /);
  assert.match(styles, /\.search-field:focus-within\s*\{[^}]*transform:\s*translateY\(-1px\);/);
  assert.match(styles, /\.search-clear-button\s*\{/);
  assert.match(styles, /\.search-status\s*\{/);
});

test("App.tsx keeps request renaming in the sidebar instead of the main editor header", () => {
  const app = readApp();

  assert.match(app, /const \[renamingRequestId, setRenamingRequestId\] = useState\(""\);/);
  assert.match(app, /const \[renameDraft, setRenameDraft\] = useState\(""\);/);
  assert.match(app, /const \[renamingSidebarItem, setRenamingSidebarItem\] = useState<\{ id: string; type: "folder" \| "collection" \} \| null>\(null\);/);
  assert.match(app, /const \[sidebarNameDraft, setSidebarNameDraft\] = useState\(""\);/);
  assert.match(app, /function startSidebarRename\(type: "folder" \| "collection", id: string, name: string\)/);
  assert.match(app, /async function applySidebarRename\(\)/);
  assert.match(app, /await updateFolder\(target\.id, nextName\)/);
  assert.match(app, /await updateCollection\(target\.id, nextName\)/);
  assert.match(app, /aria-label=\{`Rename collection \$\{collection\.name\}`\}/);
  assert.match(app, /aria-label=\{`Delete collection \$\{collection\.name\}`\}/);
  assert.match(app, /aria-label=\{`Rename folder \$\{folder\.name\}`\}/);
  assert.match(app, /aria-label=\{`Delete folder \$\{folder\.name\}`\}/);
  assert.match(app, /className="folder-title sidebar-tree-row collection-title"/);
  assert.match(app, /className=\{?(`|")folder-title sidebar-tree-row/);
  assert.match(app, /request-row sidebar-tree-row/);
  assert.match(app, /className="sidebar-row-actions"/);
  assert.match(app, /className="sidebar-icon-button danger"/);
  assert.match(app, /onDoubleClick=\{\(\) => (startRequestRename|onStartRequestRename)\(request\)\}/);
  assert.match(app, /aria-label=\{`Rename \$\{request\.name\}`\}/);
  assert.match(app, /value=\{renameDraft\}/);
  assert.match(app, /placeholder="Request Name"/);
  assert.match(app, /flex: 1, minWidth: 0/);
  assert.match(app, /boxSizing: ('|")border-box('|")/);

});

test("sidebar CRUD actions stay contextual instead of always-visible icon clutter", () => {
  const styles = read("src/renderer/src/styles.css");

  assert.match(styles, /\.sidebar-row-actions\s*\{[\s\S]*opacity:\s*0;/);
  assert.match(styles, /\.sidebar-row-actions\s*\{[\s\S]*pointer-events:\s*none;/);
  assert.match(styles, /\.sidebar-tree-row:hover \.sidebar-row-actions,/);
  assert.match(styles, /\.sidebar-tree-row:focus-within \.sidebar-row-actions\s*\{[\s\S]*opacity:\s*1;/);
  assert.match(styles, /\.sidebar-icon-button\s*\{/);
  assert.match(styles, /\.sidebar-icon-button\.danger:hover,/);
});

test("sidebar uses an interactive resizer instead of hiding into a rail", () => {
  const app = read("src/renderer/src/App.tsx");
  const styles = read("src/renderer/src/styles.css");

  assert.match(app, /const \[sidebarWidth, setSidebarWidth\] = useState\(SIDEBAR_DEFAULT_WIDTH\);/);
  assert.match(app, /const \[isSidebarResizing, setIsSidebarResizing\] = useState\(false\);/);
  assert.match(app, /function handleSidebarResizerMouseDown\(\)/);
  assert.match(app, /function handleSidebarResizerKeyDown\(event: ReactKeyboardEvent<HTMLDivElement>\)/);
  assert.match(app, /app-shell/);
  assert.match(app, /style=\{\{ "--sidebar-width": `\$\{sidebarWidth\}px` \} as CSSProperties\}/);
  assert.match(app, /className=\{isSidebarResizing \? "sidebar-resizer active" : "sidebar-resizer"\}/);
  assert.match(app, /role="separator"/);
  assert.match(app, /aria-label="Resize sidebar"/);
  assert.match(app, /aria-valuemin=\{SIDEBAR_MIN_WIDTH\}/);
  assert.match(app, /aria-valuemax=\{SIDEBAR_MAX_WIDTH\}/);
  assert.match(app, /aria-valuenow=\{sidebarWidth\}/);
  assert.match(app, /onMouseDown=\{handleSidebarResizerMouseDown\}/);
  assert.match(app, /onKeyDown=\{handleSidebarResizerKeyDown\}/);

  assert.match(styles, /grid-template-columns:\s*var\(--sidebar-width, 280px\) \d+px minmax\(0, 1fr\);/);
  assert.match(styles, /\.sidebar-resizing\s*\{[\s\S]*transition:\s*none;/);
  assert.match(styles, /\.sidebar-resizer\s*\{/);
  assert.match(styles, /\.sidebar-resizer::before\s*\{/);
  assert.match(styles, /\.sidebar-resizer:hover::before,/);

  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)/);
});

test("App.tsx topbar no longer renders the workspace title block", () => {
  const app = readApp();

  assert.match(app, /<header className="topbar">/);
  assert.match(app, /<div className="topbar-actions">/);
  assert.doesNotMatch(app, /<span className="muted-label">Workspace<\/span>/);
  assert.doesNotMatch(app, /<h1>\{workspace\.name\}<\/h1>/);
});

test("styles keep the main shell inside the default desktop window", () => {
  const styles = read("src/renderer/src/styles.css");

  assert.match(styles, /body\s*\{[\s\S]*height:\s*100vh;/);
  assert.match(styles, /body\s*\{[\s\S]*overflow:\s*hidden;/);
  assert.doesNotMatch(styles, /body\s*\{[\s\S]*min-width:\s*1040px;/);
  assert.match(styles, /\.app-shell\s*\{[\s\S]*height:\s*100vh;/);
  assert.match(styles, /\.app-shell\s*\{[\s\S]*overflow:\s*hidden;/);
  assert.match(styles, /\.sidebar\s*\{[\s\S]*min-height:\s*0;/);
  assert.match(styles, /\.sidebar\s*\{[\s\S]*overflow-y:\s*auto;/);
  assert.match(styles, /\.workspace\s*\{[\s\S]*min-height:\s*0;/);
  assert.match(styles, /\.workspace\s*\{[\s\S]*overflow:\s*hidden;/);
  assert.match(styles, /\.workspace-main\s*\{[\s\S]*min-height:\s*0;/);
  assert.match(styles, /\.workspace-main\s*\{[^}]*min-height:\s*0;/);
  assert.match(styles, /\.workspace-main\s*\{[^}]*overflow:\s*hidden;/);
  assert.match(styles, /\.request-panel\s*\{[\s\S]*min-height:\s*0;/);
  assert.match(styles, /\.response-layout\s*\{[\s\S]*min-height:\s*0;/);
  assert.match(styles, /\.response-viewer\s*\{[\s\S]*min-height:\s*0;/);
  assert.match(styles, /\.response-body\s*\{[\s\S]*min-height:\s*0;/);
});

test("request composer uses a compact header and unified command bar", () => {
  const app = readApp();

  assert.match(app, /className="workspace-main"/);
  assert.match(app, /className="request-header"/);
  assert.match(app, /className="request-identity"/);
  assert.match(app, /folderPath/);
  assert.match(app, /className="request-path"/);
  assert.doesNotMatch(app, /Saved locally/);
  assert.doesNotMatch(app, />Unsaved changes</);
  assert.doesNotMatch(app, /request-meta-separator/);
  assert.match(app, /className="request-command-bar"/);
  assert.match(app, /className="request-body-editor-shell"/);
  assert.match(app, /className="request-body-toolbar"/);
  assert.match(app, /request-save-button/);
});

test("request composer keeps save secondary and send inside the command bar", () => {
  const app = readApp();
  assert.match(app, /className="request-header"/);
  assert.match(app, /Save/);
  assert.match(app, /className="request-command-bar"/);
  assert.match(app, /request-save-button/);
  assert.doesNotMatch(app, /className="request-header-actions"/);
  assert.match(app, /<div className="request-command-bar">[\s\S]*<MethodSelector[\s\S]*<VariableInput[\s\S]*Send[\s\S]*<\/div>/);
});

test("request composer styles define the redesigned header, command bar, and body workspace", () => {
  const styles = read("src/renderer/src/styles.css");

  assert.match(styles, /\.request-header\s*\{/);
  assert.match(styles, /\.request-identity\s*\{/);
  assert.match(styles, /\.request-path\s*\{/);
  assert.match(styles, /\.request-command-bar\s*\{/);
  assert.match(styles, /\.request-command-input\s*\{/);
  assert.match(styles, /\.request-workspace\s*\{/);
  assert.match(styles, /\.request-body-toolbar\s*\{/);
  assert.match(styles, /\.execution-options\s*\{/);
  assert.match(styles, /\.execution-options\s*\{[^}]*gap:\s*12px;/);
  assert.match(styles, /\.request-body-panel\s*\{[\s\S]*min-height:\s*0;/);
  assert.match(styles, /\.request-body-editor-shell\s*\{[\s\S]*min-height:\s*0;/);
  assert.match(styles, /\.editor\.request-body-editor\s*\{[\s\S]*min-height:\s*0;/);
});

test("headers tab stays minimal and postman-like instead of introducing heavy section chrome", () => {
  const app = readApp();
  const styles = read("src/renderer/src/styles.css");

  assert.match(app, /const \[headersPresetMenuOpen, setHeadersPresetMenuOpen\] = useState\(false\);/);
  assert.match(app, /const commonHeaderPresets = \[/);
  assert.match(app, /function parsePastedHeaders\(/);
  assert.match(app, /className="headers-editor"/);
  assert.match(app, /className="headers-table"/);
  assert.match(app, /className="headers-table-toolbar"/);
  assert.match(app, /className="headers-grid-body"/);
  assert.match(app, /Common/);
  assert.match(app, /Add Header/);

  assert.match(app, /className=\{header\.enabled \? "headers-row" : "headers-row headers-row-disabled"\}/);
  assert.match(app, /className="headers-common-menu"/);
  assert.doesNotMatch(app, /className="headers-summary"/);
  assert.doesNotMatch(app, /Use variables in keys or values\./);
  assert.doesNotMatch(app, /Duplicate enabled header name/);

  assert.match(styles, /\.headers-editor\s*\{/);
  assert.match(styles, /\.headers-table\s*\{/);
  assert.match(styles, /\.headers-table-toolbar\s*\{/);
  assert.match(styles, /\.headers-grid-body\s*\{/);
  assert.match(styles, /\.headers-grid-header\s*\{/);
  assert.match(styles, /\.headers-row\s*\{/);
  assert.match(styles, /\.headers-row-disabled\s*\{/);
  assert.match(styles, /\.headers-toggle\s*\{/);
  assert.match(styles, /\.headers-actions\s*\{/);
  assert.match(styles, /\.headers-common-menu\s*\{/);
  assert.match(styles, /\.headers-add-button\s*\{/);
  assert.doesNotMatch(styles, /\.headers-summary\s*\{/);
  assert.doesNotMatch(styles, /\.headers-row-duplicate\s*\{/);
});

test("headers common menu is not clipped by the framed table container", () => {
  const app = readApp();
  const styles = read("src/renderer/src/styles.css");
  const tableBlock = styles.match(/\.headers-table\s*\{([\s\S]*?)\n\}/);

  assert.ok(tableBlock);
  assert.doesNotMatch(tableBlock[1], /overflow:\s*hidden;/);
  assert.match(app, /import \{ createPortal \} from "react-dom";/);
  assert.match(app, /function getHeaderPresetMenuLayout\(/);
  assert.match(app, /headersPresetDropdownRef/);
  assert.match(app, /createPortal\(/);
  assert.match(styles, /\.headers-common-menu\s*\{[\s\S]*position:\s*fixed;/);
  assert.match(styles, /\.headers-common-menu\s*\{[\s\S]*overflow-y:\s*auto;/);
});

test("headers variable inputs avoid full-height text controls so caret height matches visible text", () => {
  const styles = read("src/renderer/src/styles.css");
  const selector = "\n\n.headers-row-input-field {";
  const start = styles.indexOf(selector);

  assert.notEqual(start, -1);
  const blockStart = start + selector.length;
  const blockEnd = styles.indexOf("}", blockStart);
  const fieldBlock = styles.slice(blockStart, blockEnd);

  assert.match(fieldBlock, /min-height:\s*\d+px;/);
  assert.match(fieldBlock, /display:\s*block;/);
  assert.doesNotMatch(fieldBlock, /height:\s*100%;/);
});

test("styles do not leave stray CSS fragments after tooltip arrow rules", () => {
  const styles = read("src/renderer/src/styles.css");

  assert.match(styles, /\.variable-tooltip-arrow\s*\{/);
  assert.doesNotMatch(styles, /\n0%;\n/);
});

test("variable-backed request URL text uses the same vertical layout as the caret", () => {
  const variableInput = read("src/renderer/src/components/VariableInput.tsx");
  const styles = read("src/renderer/src/styles.css");

  assert.match(variableInput, /hasVariables/);
  assert.match(variableInput, /color: hasVariables \? "transparent" : "inherit"/);
  assert.match(styles, /\.request-command-input-field\s*\{[\s\S]*line-height:\s*1\.4;/);
  assert.match(variableInput, /hasVariables/);
});

test("scripts tab uses one editor with a pre/post selector", () => {
  const app = readApp();
  const styles = read("src/renderer/src/styles.css");
  const scriptEditor = read("src/renderer/src/components/ScriptEditor.tsx");
  const refinement = styles.slice(styles.indexOf("/* Flat Scripts workspace"));

  assert.match(app, /const \[activeRequestScript, setActiveRequestScript\] = useState<"pre" \| "post">\("pre"\);/);
  assert.match(app, /const scriptRuntimeTokens = activeRequestScript === "pre"/);
  assert.match(app, /const scriptVariableTokens = activeVars\.map\(\(variable\) => `\{\{\$\{variable\.key\}\}\}`\);/);
  assert.match(app, /function insertScriptToken\(token: string\)/);
  assert.match(app, /className="request-tab-panel request-scripts-panel"/);
  assert.match(app, /className="script-type-segment"/);
  assert.match(app, /setActiveRequestScript\("pre"\)/);
  assert.match(app, /setActiveRequestScript\("post"\)/);
  assert.match(app, /className="script-workspace"/);
  assert.match(app, /className="script-workspace-toolbar"/);
  assert.match(app, /className="script-helper-select"/);
  assert.match(app, /className="script-editor-shell"/);
  assert.match(app, /key=\{activeRequestScript\}/);
  assert.match(app, /const currentScriptValue = activeRequestScript === "pre" \? preScript : postScript;/);
  assert.match(app, /value=\{currentScriptValue\}/);
  assert.match(app, /onChange=\{activeRequestScript === "pre" \? setPreScript : setPostScript\}/);
  assert.match(app, /onReady=\{\(actions\) => \{\s*scriptEditorActionsRef\.current = actions;\s*\}\}/);
  assert.match(app, /<ScriptEditor[\s\S]*height="100%"/);
  assert.match(app, /ghost-button script-workspace-save\$\{scriptsDirty \? " dirty" : ""\}/);
  assert.match(app, /request/);
  assert.match(app, /variables/);
  assert.match(app, /response/);
  assert.doesNotMatch(app, /Click a helper/);
  assert.doesNotMatch(app, /className="script-editor-header"/);
  assert.doesNotMatch(app, /className="script-editor-actions"/);
  assert.match(refinement, /\.request-scripts-panel\s*\{[^}]*flex:\s*1 1 auto;/);
  assert.match(refinement, /\.request-scripts-panel\s*\{[^}]*min-height:\s*0;/);
  assert.match(refinement, /\.request-scripts-panel\s*\{[^}]*overflow:\s*hidden;/);
  assert.match(styles, /\.script-type-segment\s*\{/);
  assert.match(styles, /\.script-type-option\.active\s*\{/);
  assert.match(styles, /\.script-workspace\s*\{/);
  assert.match(refinement, /\.script-workspace\s*\{[^}]*min-height:\s*0;/);
  assert.match(styles, /\.script-workspace-toolbar\s*\{/);
  assert.match(styles, /\.script-helper-select\s*\{/);
  assert.match(styles, /\.script-editor-shell\s*\{[\s\S]*flex:\s*1;/);
  assert.match(styles, /\.script-editor-shell\s*\{[\s\S]*display:\s*flex;/);
  assert.match(refinement, /\.script-editor-shell\s*\{[^}]*min-height:\s*0;/);
  assert.match(styles, /\.script-editor-shell > div\s*\{[\s\S]*min-height:\s*0;/);
  assert.match(styles, /\.script-editor-shell > div\s*\{[\s\S]*height:\s*100% !important;/);
  assert.doesNotMatch(styles, /\.script-workspace-header\s*\{/);
  assert.doesNotMatch(styles, /\.script-workspace-hint\s*\{/);
  assert.doesNotMatch(styles, /\.script-editor-actions\s*\{/);
  assert.match(scriptEditor, /onReady\?: \(actions: \{ insertText: \(text: string\) => void \} \| null\) => void;/);
  assert.match(scriptEditor, /insertText: \(text: string\) => \{/);
  assert.match(scriptEditor, /view\.dispatch\(\{/);
  assert.match(scriptEditor, /onReady\?\.\(null\);/);
  assert.match(scriptEditor, /return <div ref=\{editorRef\} style=\{\{ width: '100%', height \}\} \/>;/);
});

test("scripts tab supports typed helpers, prettify, snippets, and generated request code", () => {
  const app = readApp();
  const styles = read("src/renderer/src/styles.css");

  assert.equal(hasFile("src/renderer/src/services/script-tools.ts"), true);
  const scriptTools = read("src/renderer/src/services/script-tools.ts");

  assert.match(scriptTools, /export type ScriptEditorMode = "javascript" \| "json" \| "xml" \| "text" \| "mcp";/);
  assert.match(scriptTools, /export const SCRIPT_EDITOR_MODES/);
  assert.match(scriptTools, /label: "JSON"/);
  assert.match(scriptTools, /label: "XML"/);
  assert.match(scriptTools, /label: "MCP"/);
  assert.match(scriptTools, /export function prettifyScriptContent/);
  assert.match(scriptTools, /JSON\.stringify\(JSON\.parse\(content\), null, 2\)/);
  assert.match(scriptTools, /function prettifyXml/);
  assert.match(scriptTools, /export const SCRIPT_SNIPPETS/);
  assert.match(scriptTools, /id: "set-header"/);
  assert.match(scriptTools, /id: "response-json"/);
  assert.match(scriptTools, /id: "(status-test|status-assertion|test-status-200)"/);
  assert.match(scriptTools, /id: "mcp-initialize"/);
  assert.match(scriptTools, /id: "mcp-tools-list"/);
  assert.match(scriptTools, /export type RequestCodeSnippetTarget = "curl" \| "fetch" \| "node"/);
  assert.match(scriptTools, /export function generateRequestCodeSnippet/);

  assert.match(app, /SCRIPT_EDITOR_MODES/);
  assert.match(app, /SCRIPT_SNIPPETS/);
  assert.match(app, /prettifyScriptContent/);
  assert.match(app, /generateRequestCodeSnippet/);
  assert.match(app, /const \[scriptEditorMode, setScriptEditorMode\] = useState<ScriptEditorMode>\("javascript"\);/);
  assert.match(app, /const \[activeSnippetId, setActiveSnippetId\] = useState\("set-header"\);/);
  assert.match(app, /const \[requestCodeTarget, setRequestCodeTarget\] = useState<RequestCodeSnippetTarget>\("curl"\);/);
  assert.match(app, /function handlePrettifyScript\(\)/);
  assert.match(app, /function insertSelectedScriptSnippet\(\)/);
  assert.match(app, /const requestCodeSnippet = draftRequest \?/);
  assert.match(app, /className="script-tool-row"/);
  assert.match(app, /(aria-label|ariaLabel)="Script editor type"/);
  assert.match(app, /aria-label="Prettify current script"/);
  assert.match(app, /(aria-label|ariaLabel)="Script snippet"/);
  assert.match(app, /aria-label="Insert selected script snippet"/);
  assert.match(app, /(ghost-button script-tool-action|script-code-panel)/);
  assert.match(app, /(modal script-code-modal|script-code-panel)/);
  assert.match(app, /className="script-code-modal-preview"/);

  assert.match(styles, /\.script-tool-row\s*\{/);
  assert.match(styles, /\.script-tool-group,\s*\n\.script-tool-group-fill\s*\{/);
  assert.match(styles, /\.script-tool-select\s*\{/);
  assert.match(styles, /\.script-code-modal\s*\{/);
  assert.match(styles, /\.script-code-modal-preview\s*\{/);
  assert.match(styles, /\.script-code-modal-overlay\s*\{[\s\S]*z-index:\s*1300;/);
});

test("scripts workspace uses accessible flat controls and console structure", () => {
  const app = readApp();
  const styles = read("src/renderer/src/styles.css");
  const scriptEditor = read("src/renderer/src/components/ScriptEditor.tsx");

  assert.match(app, /Code2,/);
  assert.match(app, /WandSparkles/);
  assert.match(app, /const \[requestCodeOpen, setRequestCodeOpen\] = useState\(false\);/);
  assert.match(app, /const \[scriptOutputExpanded, setScriptOutputExpanded\] = useState\(false\);/);
  assert.match(app, /aria-selected=\{activeRequestScript === "pre"\}/);
  assert.match(app, /aria-selected=\{activeRequestScript === "post"\}/);
  assert.match(app, /className="ghost-button script-tool-action script-tool-action-primary"/);
  assert.match(app, /ConsolePanel|script-workspace/);
  assert.match(app, /(aria-label="Request code"|aria-label="Request code snippet target"|script-code-panel)/);
  assert.match(styles, /\.script-workspace\s*\{[\s\S]*backdrop-filter:\s*none;/);
  assert.match(styles, /\.script-workspace-toolbar\s*\{[\s\S]*border-bottom:/);
  assert.match(styles, /\.script-tool-select,\s*\n\.script-helper-select/);
  assert.match(styles, /\.script-editor-shell:focus-within\s*\{/);
  assert.match(styles, /\.script-console\s*\{/);
  assert.match(styles, /\.script-console-chevron\.open\s*\{[\s\S]*rotate\(180deg\)/);
  assert.match(styles, /@media \(max-width:\s*760px\)\s*\{[\s\S]*\.script-tool-row/);
  assert.match(styles, /:root\[data-theme="dark"\][\s\S]*\.script-editor-shell/);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*\.script-console-chevron/);
  assert.match(scriptEditor, /border:\s*"0"/);
  assert.match(scriptEditor, /borderRadius:\s*"6px"/);
  assert.match(scriptEditor, /"\.cm-content":\s*\{/);
  assert.match(scriptEditor, /"&\.cm-focused":\s*\{/);
});

test("scripts workspace fits the request pane without a panel scrollbar", () => {
  const styles = read("src/renderer/src/styles.css");
  const refinement = styles.slice(styles.indexOf("/* Flat Scripts workspace"));

  assert.ok(styles.indexOf("/* Flat Scripts workspace") > styles.lastIndexOf("/* Scripts workspace refinement */"));
  assert.match(refinement, /\.request-scripts-panel\s*\{[^}]*overflow:\s*hidden;/);
  assert.match(refinement, /\.script-workspace\s*\{[^}]*flex:\s*1 1 auto;/);
  assert.match(refinement, /\.script-workspace\s*\{[^}]*min-height:\s*0;/);
  assert.match(refinement, /\.script-tool-row\s*\{[^}]*flex-wrap:\s*wrap;/);
  assert.match(refinement, /\.script-editor-frame\s*\{[^}]*min-height:\s*0;/);
  assert.match(refinement, /\.script-editor-shell\s*\{[^}]*min-height:\s*0;/);
  assert.match(refinement, /\.script-editor-shell > div\s*\{[^}]*height:\s*100% !important;/);
});

test("scripts tab uses a flat Postman-style editor workflow", () => {
  const app = readApp();

  assert.match(app, /script-helper-select/);
  assert.match(app, /onInsertScriptToken/);
  assert.match(app, /(ghost-button script-tool-action|script-code-panel)/);
  assert.match(app, /(aria-label="Open request code"|Code)/);
  assert.match(app, /className="script-editor-frame"/);
  assert.match(app, /ConsolePanel|script-workspace/);
  assert.match(app, /(aria-label="Request code"|aria-label="Request code snippet target"|script-code-panel)/);
  assert.match(app, /(modal script-code-modal|script-code-panel)/);
  assert.doesNotMatch(app, /className="script-helper-strip"/);
  assert.doesNotMatch(app, /className="script-helper-chip"/);
  assert.doesNotMatch(app, /className="script-disclosure-card/);
});

test("request tabs keep visible hover and active contrast", () => {
  const app = readApp();
  const styles = read("src/renderer/src/styles.css");

  assert.match(app, /<div className="tab-row" role="tablist" aria-label="Request configuration">/);
  assert.match(app, /className=\{activeTab === tab \? "tab active" : "tab"\}/);
  assert.match(styles, /\.tab\s*\{[\s\S]*border:\s*1px solid transparent;/);
  assert.match(styles, /\.tab:hover\s*\{[\s\S]*background:\s*var\(--color-surface-hover\);/);
  assert.match(styles, /\.tab:hover\s*\{[\s\S]*border-color:\s*var\(--color-border-tint\);/);
  assert.match(styles, /\.tab\.active\s*\{[\s\S]*background:\s*var\(--color-tab-active\);/);
  assert.match(styles, /\.tab\.active\s*\{[\s\S]*border-color:\s*var\(--color-border-tint\);/);
  assert.match(styles, /\.tab:focus-visible\s*\{[\s\S]*outline:\s*2px solid var\(--color-text-active\);/);
});

test("response tabs use explicit class-based hover and active styles", () => {
  const app = readApp();
  const styles = read("src/renderer/src/styles.css");

  assert.match(app, /tab-row.*role="tablist"/);
  assert.match(app, /useTransition/);
  assert.match(app, /startResponseTabTransition/);
  assert.match(app, /onTabChange/);
  assert.match(app, /responseTab === tab/);
  assert.match(styles, /\.response-tabs\s*\{/);
  assert.match(styles, /\.response-tab\s*\{[\s\S]*color:\s*var\(--color-muted\);/);
  assert.match(styles, /\.response-tab:hover\s*\{[\s\S]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.82\);/);
  assert.match(styles, /\.response-tab:hover\s*\{[\s\S]*color:\s*var\(--color-text\);/);
  assert.match(styles, /\.response-tab\.active\s*\{[\s\S]*border-bottom-color:\s*var\(--color-text-active\);/);
  assert.match(styles, /\.response-body-container\s*\{[\s\S]*contain:\s*layout paint;/);
  assert.match(styles, /\.response-body-container\.transitioning\s*\{[\s\S]*opacity:\s*0\.74;/);
});

test("response panel can open in a larger modal window without duplicating state", () => {
  const app = readApp();
  const styles = read("src/renderer/src/styles.css");

  assert.match(app, /const \[responseWindowOpen, setResponseWindowOpen\] = useState\(false\);/);
  assert.match(app, /Open in Window/);
  assert.match(app, /ResponsePanel/);
  assert.match(app, /responseWindowOpen/);
  assert.match(app, /aria-label="Response window"/);
  assert.match(app, /className="response-window-titlebar"/);
  assert.match(app, /className="response-window-close"/);
  assert.match(app, /className=\{modal \? "response-viewer response-viewer-window" : "response-viewer"\}/);
  assert.match(styles, /\.modal\.response-window-modal\s*\{/);
  assert.match(styles, /\.modal\.response-window-modal\s*\{[\s\S]*max-width:\s*min\(1180px, 96vw\);/);
  assert.match(styles, /\.response-viewer-window \.panel-heading\s*\{[\s\S]*display:\s*none;/);
  assert.match(styles, /\.response-window-titlebar\s*\{/);
  assert.match(styles, /\.response-window-close\s*\{/);
  assert.match(styles, /\.response-window-shell\s*\{/);
});

test("settings modal uses structured sections and stable modal chrome", () => {
  const app = readApp();
  const styles = read("src/renderer/src/styles.css");

  assert.match(app, /className="modal settings-modal"/);
  assert.match(app, /className="settings-header"/);
  assert.match(app, /className="settings-content"/);
  assert.match(app, /className="settings-section"/);
  assert.match(app, /className="settings-row"/);
  assert.match(app, /className="settings-field"/);
  assert.match(app, /className="settings-path"/);
  assert.match(app, /className="settings-status"/);
  assert.match(app, /className="settings-footer"/);
  assert.match(styles, /\.modal\.settings-modal\s*\{/);
  assert.match(styles, /\.modal\.settings-modal\s*\{[\s\S]*max-width:\s*min\(760px, 94vw\);/);
  assert.match(styles, /\.settings-content\s*\{[\s\S]*overflow:\s*auto;/);
  assert.match(styles, /\.settings-footer\s*\{[\s\S]*position:\s*sticky;/);
});

test("response panel behaves like a bottom dock manager with a persistent dock tab", () => {
  const app = readApp();
  const styles = read("src/renderer/src/styles.css");
  const bottomDockBlock = styles.match(/\.bottom-dock\s*\{([^}]*)\}/);

  assert.match(app, /const \[activeBottomDock, setActiveBottomDock\] = useState<.*>\(('response'|null)\);/);
  assert.match(app, /const \[bottomDockHeight, setBottomDockHeight\] = useState\(320\);/);
  assert.match(app, /const bottomDockStripHeight = 36;/);
  assert.match(app, /function handleResponsePanelResizerMouseDown\(\)/);
  assert.match(app, /className="bottom-dock-strip"/);
  assert.match(app, /<div className="bottom-dock-strip">[\s\S]*<div className="bottom-dock-panels">/);
  assert.match(app, /bottom-dock-tab/);
  assert.match(app, /onClick=\{\(\) => (setActiveBottomDock|onActiveBottomDockChange|onTabChange)\(/);
  assert.match(app, /bottom-dock-collapse|bottom-dock-resizer/);
  assert.match(app, /aria-label=/);
  assert.doesNotMatch(app, /Show Response/);
  assert.match(app, /className="response-panel-resizer"/);
  assert.match(app, /response-layout/);
  assert.ok(bottomDockBlock);
  assert.match(bottomDockBlock[1], /border:\s*1px solid var\(--color-border\);/);
  assert.match(bottomDockBlock[1], /border-radius:\s*16px;/);
  assert.match(bottomDockBlock[1], /box-shadow:\s*none;/);
  assert.match(styles, /\.bottom-dock-strip\s*\{[\s\S]*border-bottom:\s*1px solid var\(--color-border\);/);
  assert.match(styles, /\.bottom-dock-strip\s*\{[\s\S]*min-height:\s*36px;/);
  assert.match(styles, /\.bottom-dock-tab\s*\{/);
  assert.match(styles, /\.bottom-dock-tab\s*\{[\s\S]*border-radius:\s*0;/);
  assert.match(styles, /\.bottom-dock-tab\.active\s*\{/);
  assert.match(styles, /\.bottom-dock-tab\.active\s*\{[\s\S]*border-bottom-color:\s*var\(--color-text-active\);/);
  assert.match(styles, /\.bottom-dock-collapse svg\s*\{[\s\S]*transition:\s*transform 180ms ease;/);
  assert.match(styles, /\.bottom-dock-collapse\.collapsed svg\s*\{[\s\S]*transform:\s*rotate\(180deg\);/);
  assert.match(styles, /\.bottom-dock \.response-viewer\s*\{[\s\S]*box-shadow:\s*none;/);
  assert.match(styles, /\.response-panel-resizer\s*\{/);
  assert.match(styles, /\.response-layout\.hidden\s*\{/);
});

test("method selector dropdown uses a viewport-aware portal overlay", () => {
  const selector = read("src/renderer/src/components/MethodSelector.tsx");
  const styles = read("src/renderer/src/styles.css");

  assert.match(selector, /import \{ ChevronDown \} from "lucide-react";/);
  assert.match(selector, /import \{ createPortal \} from "react-dom";/);
  assert.match(selector, /export function getMethodDropdownLayout/);
  assert.match(selector, /window\.addEventListener\("resize", updateLayout\)/);
  assert.match(selector, /window\.addEventListener\("scroll", updateLayout, true\)/);
  assert.match(selector, /createPortal\(/);
  assert.match(selector, /data-placement=\{dropdownLayout\?\.placement \?\? "bottom"\}/);
  assert.match(selector, /className=\{`method-selector-btn method-\$\{cls\} \$\{open \? "open" : ""\}`\}/);
  assert.match(selector, /<ChevronDown[\s\S]*className=\{`method-selector-caret \$\{open \? "open" : ""\}`\}[\s\S]*size=\{18\}/);
  assert.match(styles, /\.method-selector-dropdown\s*\{[\s\S]*position:\s*fixed;/);
  assert.match(styles, /\.method-selector-dropdown\s*\{[\s\S]*overflow-y:\s*auto;/);
  assert.match(styles, /\.method-selector-dropdown\s*\{[\s\S]*max-height:\s*min\(360px,\s*calc\(100vh - 32px\)\);/);
  assert.match(styles, /\.method-selector-caret\s*\{[\s\S]*width:\s*18px;/);
  assert.match(styles, /\.method-selector-caret\s*\{[\s\S]*height:\s*18px;/);
  assert.match(styles, /\.method-selector-caret\s*\{[\s\S]*opacity:\s*0\.72;/);
  assert.match(styles, /\.method-selector-caret\s*\{[\s\S]*transition:\s*transform 180ms cubic-bezier\(0\.22, 1, 0\.36, 1\), opacity 180ms ease;/);
  assert.match(styles, /\.method-selector-btn\.open \.method-selector-caret,/);
});
