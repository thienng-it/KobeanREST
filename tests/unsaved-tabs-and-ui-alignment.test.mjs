import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");

test("TabBar renders amber dot, italic font, and tooltips for unsaved and dirty tabs", () => {
  const tabBar = read("src/renderer/src/components/TabBar.tsx");

  // Verify unsavedEntityIds prop support
  assert.match(tabBar, /unsavedEntityIds\?: Set<string>;/);
  
  // Verify unsaved draft status detection
  assert.match(tabBar, /const isUnsaved = Boolean\(unsavedEntityIds\?\.has\(tab\.entityId\) \|\| tab\.entityId\.startsWith\("temp_"\)\);/);
  
  // Verify italic font style for draft tabs
  assert.match(tabBar, /fontStyle: isUnsaved \? "italic" : "normal"/);

  // Verify rich tooltip text
  assert.match(tabBar, /tab\.draftTooltip|Draft \(Unsaved\)\. Press Cmd\+S to save/);
  assert.match(tabBar, /tab\.unsavedTooltip|Unsaved changes\. Press Cmd\+S to save/);

  // Verify amber dirty dot rendering
  assert.match(tabBar, /backgroundColor:\s*"#f59e0b"/);
});

test("RequestPanel header displays DRAFT badge, helper text, and Save to Collection button", () => {
  const requestPanel = read("src/renderer/src/components/RequestPanel.tsx");

  // Verify isUnsaved prop support
  assert.match(requestPanel, /isUnsaved\?: boolean;/);

  // Verify DRAFT badge rendering
  assert.match(requestPanel, /className="request-type-badge draft-badge"/);
  assert.match(requestPanel, /request\.badgeDraft|DRAFT/);

  // Verify helper text
  assert.match(requestPanel, /request\.unsavedHeaderHint|Unsaved request • Press Cmd\+S or click Save to store in a collection/);

  // Verify Save button text and style for unsaved draft
  assert.match(requestPanel, /request\.saveToCollection|Save to Collection\.\.\./);
  assert.match(requestPanel, /request\.saveChanges|Save Changes/);
});

test("App.tsx implements in-memory unsaved drafts, modal save flow, and tab deduplication", () => {
  const app = read("src/renderer/src/App.tsx");

  // Verify unsavedRequests state
  assert.match(app, /const \[unsavedRequests, setUnsavedRequests\] = useState<Record<string, SavedRequest>>\(\{\}\);/);

  // Verify new tab handler instantiates temp requests
  assert.match(app, /const tempId = `temp_\$\{Date\.now\(\)\}_/);
  assert.match(app, /isDirty: true/);

  // Verify promptSaveRequest triggers CreateRequestModal for unsaved drafts
  assert.match(app, /const isUnsaved = Boolean\(unsavedRequests\[draftRequest\.id\]\);/);
  assert.match(app, /setCreateRequestModalOpen\(true\);/);

  // Verify tab deduplication in useEffect and onCreate
  assert.match(app, /if \(prev\.some\(\(t\) => t\.type === "request" && t\.entityId === request\.id\)\)/);
  assert.match(app, /lastSelectedRequestIdRef\.current = createdReq\.id;/);
  assert.match(app, /const key = `\$\{t\.type\}:\$\{t\.entityId\}`;/);
});

test("App.tsx automatically removes open tabs when items are deleted from workspace", () => {
  const app = read("src/renderer/src/App.tsx");

  // Verify useEffect for tab cleanup on workspace deletion
  assert.match(app, /validRequestIds = new Set\(workspace\.requests\.map\(/);
  assert.match(app, /validFolderIds = new Set\(workspace\.folders\.map\(/);
  assert.match(app, /validCollectionIds = new Set\(\(workspace\.collections \?\? \[\]\)\.map\(/);
  assert.match(app, /validEnvironmentNames = new Set\(workspace\.environments\.map\(/);
  assert.match(app, /unsavedRequests\[tab\.entityId\]/);
});


test("search field input has zero-outline border resets preventing square outline artifacts", () => {
  const styles = read("src/renderer/src/styles.css");

  // Verify reset styles on search-field input
  assert.match(styles, /\.search-field input\s*\{[\s\S]*border:\s*0 !important;/);
  assert.match(styles, /\.search-field input\s*\{[\s\S]*outline:\s*0 !important;/);
  assert.match(styles, /\.search-field input\s*\{[\s\S]*box-shadow:\s*none !important;/);
  assert.match(styles, /\.search-field input:focus[\s\S]*outline:\s*0 !important;/);
});
