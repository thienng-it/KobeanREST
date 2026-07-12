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
  assert.match(app, /async function handleCreateFolder\(/);
  assert.match(app, /async function handleDeleteFolder/);
  assert.match(app, /async function handleCreateRequest/);
  assert.match(app, /async function handleDeleteRequest/);
  assert.match(app, /const \[collapsedFolders, setCollapsedFolders\] = useState<Record<string, boolean>>\(\{\}\);/);
  assert.match(app, /aria-expanded=\{!collapsedFolders\[folder\.id\]\}/);
  assert.match(app, /\{!collapsedFolders\[folder\.id\] && \(/);
  assert.match(app, /folderRequests\.map\(request => \(/);
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
  assert.match(styles, /\.workspace-main\s*\{[\s\S]*grid-template-rows:\s*auto\s+minmax\(280px,\s*1fr\);/);
  assert.match(styles, /\.workspace-main\s*\{[\s\S]*overflow-y:\s*auto;/);
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
  assert.match(styles, /\.execution-options\s*\{[\s\S]*padding-top:\s*12px;/);
  assert.match(styles, /\.execution-options\s*\{[\s\S]*border-top:\s*1px solid var\(--color-border\);/);
  assert.match(styles, /\.request-body-panel\s*\{[\s\S]*min-height:\s*220px;/);
  assert.match(styles, /\.request-body-editor-shell\s*\{[\s\S]*min-height:\s*220px;/);
  assert.match(styles, /\.editor\.request-body-editor\s*\{[\s\S]*min-height:\s*220px;/);
});

test("scripts tab uses one editor with a pre/post selector", () => {
  const app = read("src/renderer/src/App.tsx");
  const styles = read("src/renderer/src/styles.css");
  const scriptEditor = read("src/renderer/src/components/ScriptEditor.tsx");

  assert.match(app, /const \[activeRequestScript, setActiveRequestScript\] = useState<"pre" \| "post">\("pre"\);/);
  assert.match(app, /className="request-tab-panel request-scripts-panel"/);
  assert.match(app, /className="script-editor-header"/);
  assert.match(app, /className="script-type-segment"/);
  assert.match(app, /setActiveRequestScript\("pre"\)/);
  assert.match(app, /setActiveRequestScript\("post"\)/);
  assert.match(app, /className="script-editor-group"/);
  assert.match(app, /className="script-editor-shell"/);
  assert.match(app, /key=\{activeRequestScript\}/);
  assert.match(app, /value=\{activeRequestScript === "pre" \? preScript : postScript\}/);
  assert.match(app, /onChange=\{activeRequestScript === "pre" \? setPreScript : setPostScript\}/);
  assert.match(app, /<ScriptEditor[\s\S]*height="100%"/);
  assert.match(app, /className="script-editor-actions"/);
  assert.match(styles, /\.request-scripts-panel\s*\{[\s\S]*flex:\s*1;/);
  assert.match(styles, /\.request-scripts-panel\s*\{[\s\S]*min-height:\s*0;/);
  assert.match(styles, /\.request-scripts-panel\s*\{[\s\S]*overflow:\s*hidden;/);
  assert.match(styles, /\.script-type-segment\s*\{/);
  assert.match(styles, /\.script-type-option\.active\s*\{/);
  assert.match(styles, /\.script-editor-group\s*\{[\s\S]*flex:\s*1;/);
  assert.match(styles, /\.script-editor-group\s*\{[\s\S]*min-height:\s*0;/);
  assert.match(styles, /\.script-editor-shell\s*\{[\s\S]*flex:\s*1;/);
  assert.match(styles, /\.script-editor-shell\s*\{[\s\S]*min-height:\s*168px;/);
  assert.match(styles, /\.script-editor-actions\s*\{[\s\S]*flex-shrink:\s*0;/);
  assert.match(scriptEditor, /return <div ref=\{editorRef\} style=\{\{ width: '100%', height \}\} \/>;/);
});

test("request tabs keep visible hover and active contrast", () => {
  const app = read("src/renderer/src/App.tsx");
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
  const app = read("src/renderer/src/App.tsx");
  const styles = read("src/renderer/src/styles.css");

  assert.match(app, /<div className="response-tabs">/);
  assert.match(app, /className=\{responseTab === tab \? 'response-tab active' : 'response-tab'\}/);
  assert.match(styles, /\.response-tabs\s*\{/);
  assert.match(styles, /\.response-tab\s*\{[\s\S]*color:\s*var\(--color-muted\);/);
  assert.match(styles, /\.response-tab:hover\s*\{[\s\S]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.82\);/);
  assert.match(styles, /\.response-tab:hover\s*\{[\s\S]*color:\s*var\(--color-text\);/);
  assert.match(styles, /\.response-tab\.active\s*\{[\s\S]*border-bottom-color:\s*var\(--color-text-active\);/);
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
