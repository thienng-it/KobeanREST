import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");
const hasFile = (path) => existsSync(new URL(path, root));

test("Rust native core exposes fine-grained editing commands", () => {
  const lib = read("src-tauri/src/lib.rs");
  assert.match(lib, /save_request/);
  assert.match(lib, /delete_request/);
  assert.match(lib, /create_folder/);
  assert.match(lib, /update_folder/);
  assert.match(lib, /delete_folder/);
  assert.match(lib, /create_request/);
});

test("frontend API client invokes native editing commands", () => {
  const localStore = read("src/renderer/src/services/local-store.ts");
  
  assert.match(localStore, /export async function saveRequest/);
  assert.match(localStore, /invoke<void>\("save_request", \{ request \}\)/);
  
  assert.match(localStore, /export async function deleteRequest/);
  assert.match(localStore, /invoke<void>\("delete_request", \{ requestId \}\)/);

  assert.match(localStore, /export async function createFolder/);
  assert.match(localStore, /export async function deleteFolder/);
  assert.match(localStore, /export async function createRequest/);
});

test("App.tsx implements editable state management", () => {
  const app = read("src/renderer/src/App.tsx");

  // Check for the draft request state
  assert.match(app, /const \[draftRequest, setDraftRequest\] = useState<SavedRequest \| null>\(null\);/);

  // Check that inputs are bound to draftRequest, e.g. URL
  assert.match(app, /value=\{draftRequest\.url\}/);
  
  // Check for save functions
  assert.match(app, /async function handleSaveRequest\(\)/);
  assert.match(app, /async function handleCreateFolder\(\)/);
  assert.match(app, /async function handleDeleteFolder/);
  assert.match(app, /async function handleCreateRequest/);
  assert.match(app, /async function handleDeleteRequest/);
  assert.match(app, /const \[collapsedFolders, setCollapsedFolders\] = useState<Record<string, boolean>>\(\{\}\);/);
  assert.match(app, /aria-expanded=\{!collapsedFolders\[folder\.id\]\}/);
  assert.match(app, /\{!collapsedFolders\[folder\.id\] && folderRequests\.map\(request => \(/);
});

test("App.tsx keeps request renaming in the sidebar instead of the main editor header", () => {
  const app = read("src/renderer/src/App.tsx");

  assert.match(app, /const \[renamingRequestId, setRenamingRequestId\] = useState\(""\);/);
  assert.match(app, /const \[renameDraft, setRenameDraft\] = useState\(""\);/);
  assert.match(app, /onDoubleClick=\{\(\) => startRequestRename\(request\)\}/);
  assert.match(app, /aria-label=\{`Rename \$\{request\.name\}`\}/);
  assert.match(app, /value=\{renameDraft\}/);
  assert.match(app, /placeholder="Request Name"/);
  assert.match(app, /style=\{\{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px' \}\}/);
  assert.match(app, /boxSizing: 'border-box'/);
  assert.doesNotMatch(app, /aria-label="Request Name"/);
});

test("App.tsx topbar no longer renders the workspace title block", () => {
  const app = read("src/renderer/src/App.tsx");

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
  assert.match(styles, /\.workspace-main\s*\{[\s\S]*grid-template-rows:\s*minmax\(0,\s*1\.1fr\)\s+minmax\(0,\s*0\.9fr\);/);
  assert.match(styles, /\.request-panel\s*\{[\s\S]*min-height:\s*0;/);
  assert.match(styles, /\.response-layout\s*\{[\s\S]*min-height:\s*0;/);
  assert.match(styles, /\.response-viewer\s*\{[\s\S]*min-height:\s*0;/);
  assert.match(styles, /\.response-body\s*\{[\s\S]*min-height:\s*0;/);
});

test("request composer uses a compact header and unified command bar", () => {
  const app = read("src/renderer/src/App.tsx");

  assert.match(app, /<div className="workspace-main">/);
  assert.match(app, /className="request-header"/);
  assert.match(app, /className="request-identity"/);
  assert.match(app, /const requestFolder = draftRequest/);
  assert.match(app, /const requestPath = requestFolder && draftRequest \? `\$\{requestFolder\.name\} \/ \$\{draftRequest\.name\}` : draftRequest\?\.name \?\? "";/);
  assert.match(app, /className="request-path"/);
  assert.doesNotMatch(app, /Saved locally/);
  assert.doesNotMatch(app, /Unsaved changes/);
  assert.doesNotMatch(app, /request-meta-separator/);
  assert.match(app, /className="request-command-bar"/);
  assert.match(app, /className="request-workspace"/);
  assert.match(app, /containerClassName="request-body-editor-shell"/);
  assert.match(app, /className="request-body-toolbar"/);
  assert.match(app, /className="request-header-actions"/);
});

test("request composer keeps save secondary and send inside the command bar", () => {
  const app = read("src/renderer/src/App.tsx");
  const headerBlock = app.match(/<div className="request-header">([\s\S]*?)<\/div>\s*<div className="request-command-bar">/);

  assert.ok(headerBlock);
  assert.match(headerBlock[1], /<div className="request-header-actions">[\s\S]*Save[\s\S]*<\/div>/);
  assert.doesNotMatch(headerBlock[1], /Send/);
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
});
