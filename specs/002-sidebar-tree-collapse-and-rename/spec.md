# Feature Specification: Sidebar Tree Collapse/Expand All & Inline Rename

- **Spec ID:** `specs/002-sidebar-tree-collapse-and-rename/spec.md`
- **Status:** `Draft`
- **Date:** `2026-11-15`
- **Mode:** `Brownfield Delta`
- **Security / Trust Boundary:** `No` (No auth, secrets, Keychain ACLs, or SQLite schema changes; reuses `CoreBridge.saveRequest`, `updateCollection`, and `updateFolder`)

## 0. Ponytail Ultra Gate ("Should This Exist?")
- **Problem Statement:**
  1. `CollectionSectionView` and `FolderTreeView` in [SidebarView.swift](file:///Users/josephnguyen/Developer/KobeanREST/macos/KobeanREST/Features/Sidebar/SidebarView.swift#L456-L568) store `isExpanded` in isolated local `@State`, making it impossible to collapse or expand all collections/folders at once when navigating large workspaces.
  2. `SidebarRequestRow` ([SidebarView.swift](file:///Users/josephnguyen/Developer/KobeanREST/macos/KobeanREST/Features/Sidebar/SidebarView.swift#L570-L601)) has no rename action in its right-click context menu, no `List(selection:)` / keyboard `Return` rename support, and no `AppState.renameRequest(id:name:)` method. Folders and collections force a modal `.sheet` (`SidebarPromptAction`) instead of smooth macOS Finder-style inline editing.
- **Existing Alternatives Checked:**
  - `CoreBridge` and `crates/kobean-core/src/persistence.rs` already provide `updateCollection(id:name:)`, `updateFolder(id:name:)`, and `saveRequest(_:)` (`ON CONFLICT(id) DO UPDATE SET name = excluded.name ...` while preserving `position` and separate `scripts` rows). Zero Rust or UniFFI changes are needed.
- **Smallest Viable Scope:**
  - Centralize sidebar collapse state and inline rename directly in `AppState` + `SidebarView` without adding new FFI functions, SQLite migrations, or drag-and-drop reordering.

## 1. User Scenarios & Acceptance Criteria

### Scenario 1 — Collapse All / Expand All Tree Containers (Priority: P1)
- **Given** a workspace in the Collections sidebar containing collections, nested folders, and/or orphan folders where at least one container is expanded
- **When** the user clicks the Collapse/Expand All toggle button next to `"Filter requests…"` (or chooses `"Collapse All"` from the sidebar context menu)
- **Then** all collections and nested folders collapse smoothly (`withAnimation(.easeInOut(duration: 0.16))`), and the toggle button icon/tooltip flips to Expand All (`rectangle.expand.vertical` / `"Expand All Folders"`).
- **When** all containers are collapsed and the user clicks the toggle button again (or chooses `"Expand All"`)
- **Then** all collections and nested folders expand cleanly.

### Scenario 2 — Search Filter Temporarily Expands Matches & Restores State (Priority: P1)
- **Given** one or more folders/collections are collapsed and the user types a non-empty query in `"Filter requests…"`
- **When** matching requests exist inside collapsed containers
- **Then** ancestor containers temporarily expand to reveal matching requests without mutating the user's saved collapsed set; clearing the search query restores the prior collapsed/expanded state.

### Scenario 3 — Auto-Expand Parent on New Folder or New Request (Priority: P2)
- **Given** a collapsed collection or folder
- **When** the user creates a new folder or new request inside it from the context menu
- **Then** that parent container automatically expands so the newly created item is immediately visible.

### Scenario 4 — Inline Rename via Keyboard `Return` (`Enter`) (Priority: P1)
- **Given** the sidebar `List` has keyboard focus and a request (or folder/collection) row is selected
- **When** the user presses `Return` (without modifier keys, and no sheet or search field is focused)
- **Then** the row label switches in-place to a focused `TextField` seeded with the current name (text pre-selected).
- **When** the user edits the name and presses `Return` (or clicks away to commit on focus loss)
- **Then** the trimmed non-empty name persists via `CoreBridge`, updates `AppState.workspace` and any matching open `RequestTab` title without discarding unsaved tab edits, and returns focus to the sidebar `List`.
- **When** the user presses `Escape` (or submits an empty/whitespace-only or unchanged name)
- **Then** inline editing cancels with zero persistence writes and restores the original label.

### Scenario 5 — Inline Rename via Right-Click Context Menu (Priority: P1)
- **Given** any request, folder, or collection row in the Collections tree
- **When** the user right-clicks the row and selects `"Rename"`
- **Then** the row enters the exact same inline `TextField` rename mode in-place (focused and ready to type), committing on `Return`/blur and cancelling on `Escape`.

## 2. Delta Summary (Brownfield)
- **ADDED:**
  - `SidebarNodeID` (`collection(String) | folder(String) | request(String)`) and pure `SidebarTreeBuilder` helper for deterministic flattened tree rows (`depth`, disclosure state, search ancestor filtering).
  - `AppState` state & actions: `collapsedSidebarNodeIDs`, `areAllSidebarNodesCollapsed`, `toggleCollapseExpandAll()`, `setSidebarNodeExpanded(_:expanded:)`, `renameRequest(id:name:)`.
  - Collapse/Expand All icon button beside `"Filter requests…"` and context menu action in `SidebarView`.
  - `"Rename"` context menu item on `SidebarRequestRow` and unified inline `TextField` editing across requests, folders, and collections.
- **MODIFIED:**
  - `SidebarView.swift`: replace isolated `@State isExpanded` in `DisclosureGroup` with centralized `List(visibleRows, id: \.id, selection: $selectedNodeID)` backed by `SidebarTreeBuilder`, `@FocusState` focus isolation (`isSidebarListFocused`, `focusedRenameNodeID`), `.onKeyPress(.return)`, `.onExitCommand`, and commit-on-blur guard.
  - `AppState.swift`: auto-expand target parent on `createFolder` / `createRequestInFolder`; preserve `tab.isDirty` and non-name edits when `renameRequest(id:name:)` updates matching open tabs.
- **REMOVED:**
  - Modal sheet cases `.renameCollection` and `.renameFolder` from `SidebarPromptAction` (replaced by unified inline rename; `.createWorkspace`, `.createCollection`, `.createFolder` remain sheets).

## 3. Edge Cases & Failure Modes
- **Invalid / Empty Input:** Trimming whitespace yields empty string -> cancel inline rename silently, keep original name, make zero bridge calls.
- **Dirty Open Tab Conflict:** Renaming a request in the sidebar while its tab has unsaved URL/headers/body edits (`tab.isDirty == true`) MUST read the persisted `SavedRequest` from `workspace?.requests` (falling back to persisted tab only if needed), update only `.name` via `bridge.saveRequest`, and update `tabs[idx].request.name` in place without resetting `tab.isDirty` or overwriting unsaved tab fields.
- **Keyboard Focus Leakage:** Pressing `Return` in `"Filter requests…"`, the Workbench URL bar, body/script editors, or a modal sheet MUST NOT trigger sidebar rename (`guard isSidebarListFocused, renamingNodeID == nil`). `Cmd+Return` (`Send Request`) remains unaffected.
- **Escape vs Focus-Loss Race:** `cancelRename()` clears `renamingNodeID` and marks cancellation *before* `focusedRenameNodeID` drops to `nil` so `.onChange(of: focusedRenameID)` does not commit on `Escape`.
- **Workspace Switch:** Switching workspaces clears `renamingNodeID` and `selectedNodeID` cleanly.
- **Persistence Error:** On `bridge.saveRequest` / `updateFolder` / `updateCollection` failure, surface `statusMessage = error.localizedDescription` and do not leave stale optimistic state out of sync with SQLite.

## 4. Out of Scope
- Persisting collapsed folder state across app restarts in SQLite (in-memory `AppState` during session only; easy future follow-up if requested).
- Multi-select batch rename or drag-and-drop tree reordering.
- Renaming History entries (history is read-only execution log).

