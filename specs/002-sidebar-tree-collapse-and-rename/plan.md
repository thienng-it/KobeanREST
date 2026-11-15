# Technical Plan: Sidebar Tree Collapse/Expand All & Inline Rename

- **Plan Path:** `specs/002-sidebar-tree-collapse-and-rename/plan.md`
- **Spec Reference:** `specs/002-sidebar-tree-collapse-and-rename/spec.md`
- **Date:** `2026-11-15`

## 1. Codebase Context & Blast Radius
- **Graphify / Codebase Findings:**
  - Sidebar tree lives entirely in [SidebarView.swift](file:///Users/josephnguyen/Developer/KobeanREST/macos/KobeanREST/Features/Sidebar/SidebarView.swift) (`CollectionSectionView`, `FolderTreeView`, `SidebarRequestRow`).
  - Workspace, tab, and CRUD orchestration live in [AppState.swift](file:///Users/josephnguyen/Developer/KobeanREST/macos/KobeanREST/App/AppState.swift).
  - Existing persistence calls in [CoreBridge.swift](file:///Users/josephnguyen/Developer/KobeanREST/macos/KobeanREST/Services/CoreBridge.swift) (`updateCollection`, `updateFolder`, `saveRequest`) already map to `crates/kobean-core/src/persistence.rs` (`ON CONFLICT(id) DO UPDATE` preserving `position` and `scripts`). No Rust, UniFFI, `src-tauri/`, or `tests/*.test.mjs` changes are required.
  - Project targets `macOS 15.0` with `SWIFT_VERSION: 6.0` and `SWIFT_STRICT_CONCURRENCY: complete` ([project.yml](file:///Users/josephnguyen/Developer/KobeanREST/macos/project.yml)).

- **Files to Create:**
  - `macos/KobeanREST/Features/Sidebar/SidebarTreeModel.swift` — Pure `Sendable` `SidebarNodeID`, `SidebarTreeRow`, and `SidebarTreeBuilder` (flattened tree projection, search ancestor expansion, collapsible ID collection) for zero-flicker SwiftUI rendering and unit testability.
  - `macos/KobeanRESTTests/SidebarTreeTests.swift` — Swift Testing (`Testing`) unit tests for `SidebarTreeBuilder`, collapse/expand-all state, search auto-expand/restore, and `AppState.renameRequest` (including dirty-tab preservation and whitespace rejection).

- **Files to Modify:**
  - `macos/KobeanREST/App/AppState.swift` — Add `collapsedSidebarNodeIDs`, `allCollapsibleSidebarNodeIDs`, `areAllSidebarNodesCollapsed`, `toggleCollapseExpandAll()`, `setSidebarNodeExpanded(_:expanded:)`, `renameRequest(id:name:)`, plus parent auto-expand in `createFolder` / `createRequestInFolder` and state reset on `switchWorkspace`.
  - `macos/KobeanREST/Features/Sidebar/SidebarView.swift` — Add Collapse/Expand All button in `sectionAndSearchBar`, migrate `collectionsList` to `List(visibleRows, id: \.id, selection: $selectedNodeID)` with keyboard navigation (`Return` to rename, `←`/`→` to collapse/expand), unified inline `TextField` rename with `@FocusState` + `Escape` cancel + commit-on-blur, and `"Rename"` in request/folder/collection context menus.
  - Note on XcodeGen: after adding `SidebarTreeModel.swift` and `SidebarTreeTests.swift`, run `xcodegen generate` in `macos/` so `KobeanREST.xcodeproj` picks up the new Swift files cleanly.

## 2. Contracts, State Model & SwiftUI Architecture

### 2.1 Why Flattened `List(selection:)` Beats Nested `DisclosureGroup` Here
In macOS SwiftUI `List(.sidebar)`:
1. Nested `DisclosureGroup` rows do not expose parent rows as first-class selectable items for `↑`/`↓` keyboard navigation or `Return`-to-rename across collections/folders/requests.
2. Decentralized `@State isExpanded` inside recursive `FolderTreeView` cannot be toggled atomically by a parent Collapse/Expand All action.

By projecting `WorkspaceSummary` + `collapsedSidebarNodeIDs` + `searchQuery` through a pure `SidebarTreeBuilder.buildRows(...)`:
- Every visible row (`collection`, `folder`, `orphanFolder`, `unfiledSection` or unfiled `request`) has a stable `SidebarNodeID` and `depth: Int`.
- `List(rows, id: \.id, selection: $selectedNodeID)` gives native macOS selection highlight, `↑`/`↓` navigation across every row, `←`/`→` folder collapse/expand, and `Return` to enter inline rename on the focused selected row.
- Collapsing/expanding all is an O(N) `Set<SidebarNodeID>` swap wrapped in `withAnimation(.easeInOut(duration: 0.16))`.
- When `searchQuery` is non-empty, `SidebarTreeBuilder` includes matching requests (and matching folder/collection names) together with their ancestor chain in expanded state *without* mutating `appState.collapsedSidebarNodeIDs`.

### 2.2 State & Actions in `AppState`
```swift
public var collapsedSidebarNodeIDs: Set<SidebarNodeID> = []
```
- `allCollapsibleSidebarNodeIDs`: computed from `workspace?.collections` and `workspace?.folders`.
- `areAllSidebarNodesCollapsed`: `!allCollapsibleSidebarNodeIDs.isEmpty && allCollapsibleSidebarNodeIDs.isSubset(of: collapsedSidebarNodeIDs)`.
- `toggleCollapseExpandAll()`:
  - If `areAllSidebarNodesCollapsed` -> `collapsedSidebarNodeIDs.removeAll()`
  - Else -> `collapsedSidebarNodeIDs = allCollapsibleSidebarNodeIDs`
- `setSidebarNodeExpanded(_ id: SidebarNodeID, expanded: Bool)`: inserts or removes `id`.
- `renameRequest(id: String, name: String) async`:
  1. `let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)` -> guard non-empty.
  2. Locate persisted `SavedRequest` from `workspace?.requests.first(where: { $0.id == id })` (fallback to persisted `tabs`). Guard `target.name != trimmed`.
  3. Save copy with `updated.name = trimmed` via `try await bridge.saveRequest(updated)`.
  4. Update matching `workspace?.requests[idx].name = trimmed` and every matching `tabs[idx].request.name = trimmed` (preserving `tabs[idx].isDirty` and unsaved request body/headers/URL), then `await refreshWorkspace()`.

### 2.3 Inline Rename Interaction Contract in `SidebarView`
- `@State private var selectedNodeID: SidebarNodeID?`
- `@State private var renamingNodeID: SidebarNodeID?`
- `@State private var renameDraft: String = ""`
- `@State private var renameCancelled: Bool = false`
- `@FocusState private var isSidebarListFocused: Bool`
- `@FocusState private var focusedRenameNodeID: SidebarNodeID?`
- **Triggers to enter rename (`beginRename(for:)`):**
  1. Keyboard `Return` on `List`: `.onKeyPress(.return)` when `isSidebarListFocused && renamingNodeID == nil`, if `selectedNodeID` resolves to a renameable node (request, folder, or collection).
  2. Context menu `"Rename"` button on any request, folder, or collection row.
- **Focus & Select-All:**
  - Set `renameCancelled = false`, `renameDraft = currentName`, `renamingNodeID = nodeID`, then `Task { @MainActor in focusedRenameNodeID = nodeID }`.
  - Use a narrow `NSText.didBeginEditingNotification` observer (active only while `renamingNodeID != nil`) or small `NSViewRepresentable` wrapper so initial focus selects the full name Finder-style.
- **Commit vs Cancel:**
  - `.onSubmit` on the inline `TextField` -> `commitRename()`.
  - `.onExitCommand` -> `cancelRename()` (sets `renameCancelled = true`, clears `renamingNodeID = nil`, `focusedRenameNodeID = nil`, restores `isSidebarListFocused = true`).
  - `.onChange(of: focusedRenameNodeID)` -> when transitioning away from an active `renamingNodeID` with `!renameCancelled`, call `commitRename()`.
  - Opening a request tab: triggered when `selectedNodeID` becomes `.request(id)` (via click or `↑`/`↓`) while not renaming.

### 2.4 Collapse/Expand All Control Placement
- Place a compact `Button` (`24×24`, `.buttonStyle(.borderless)`) at the trailing end of the `sectionAndSearchBar` search `HStack` (right beside the `"Filter requests…"` field):
  - Icon: `appState.areAllSidebarNodesCollapsed ? "rectangle.expand.vertical" : "rectangle.compress.vertical"`
  - Help tooltip: `appState.areAllSidebarNodesCollapsed ? "Expand All Folders" : "Collapse All Folders"`
  - Accessibility label matching tooltip; disabled when `allCollapsibleSidebarNodeIDs.isEmpty` or `!appState.searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty`.
- Also expose `"Collapse All"` / `"Expand All"` in the sidebar background `.contextMenu`.

## 3. Role Assignment & Write Ownership
| Role | Assigned Scope | Write Paths |
| :--- | :--- | :--- |
| `frontend` (Slice A: Tree Model & AppState) | `SidebarNodeID`, `SidebarTreeBuilder`, `AppState` collapse/rename actions | `macos/KobeanREST/Features/Sidebar/SidebarTreeModel.swift`, `macos/KobeanREST/App/AppState.swift` |
| `frontend` (Slice B: Sidebar UI) | Collapse/Expand All button, flattened `List(selection:)`, inline rename & context menus | `macos/KobeanREST/Features/Sidebar/SidebarView.swift` |
| `qa` / `frontend` (TDD Tests) | Unit tests for tree projection, collapse/expand all, and `renameRequest` + `xcodegen` & `xcodebuild test` | `macos/KobeanRESTTests/SidebarTreeTests.swift`, `macos/KobeanREST.xcodeproj/**` |
| `reviewer` | Ponytail & Swift 6 strict concurrency review after `kb-build` | Read-only |

## 4. Verification Strategy (TDD)
1. **Red Phase (`SidebarTreeTests.swift`):**
   - `SidebarTreeBuilder` expands all by default (`collapsedSidebarNodeIDs == []`), flattens nested collections -> folders -> subfolders -> requests + orphan folders + unfiled requests with exact `depth`.
   - `toggleCollapseExpandAll()` collapses all collections/folders when any are expanded, and expands all when all are collapsed.
   - Non-empty `searchQuery` auto-expands ancestor folders/collections of matching requests without mutating `collapsedSidebarNodeIDs`, and clearing `searchQuery` restores the exact prior collapsed set.
   - `AppState.renameRequest(id:name:)` trims whitespace, ignores empty/unchanged names without calling `CoreBridge.saveRequest`, persists updated name via `MockCoreBridge`, updates matching `workspace.requests` and `tabs[i].request.name`, and preserves `tabs[i].isDirty` and unsaved URL/body edits.
   - `AppState.createFolder` / `createRequestInFolder` clears parent ID from `collapsedSidebarNodeIDs`.
2. **Green Phase:**
   - Implement `SidebarTreeModel.swift`, `AppState.swift` additions, and `SidebarView.swift` updates; regenerate Xcode project via `xcodegen generate`.
   - Run `xcodebuild test -project macos/KobeanREST.xcodeproj -scheme KobeanREST -destination 'platform=macOS'` and verify all suites pass with Swift 6 strict concurrency enabled.
3. **Interactive Smoke Verification:**
   - Launch `KobeanREST.app` and verify:
     - Collapse All / Expand All button next to `"Filter requests…"` collapses/expands nested collections and folders smoothly.
     - Selecting a request and pressing `Return` opens inline edit with text selected; `Return` saves, `Escape` cancels.
     - Right-clicking a request, folder, or collection and choosing `"Rename"` opens inline edit in place.
     - Pressing `Return` in `"Filter requests…"` or the Workbench URL bar does NOT trigger sidebar rename.

## 5. Beads Task Graph (`.beads/`)
> Tracked solely in `.beads/` via `bd`.
- `KobeanREST-efc` — Red TDD tests for `SidebarTreeBuilder`, collapse/expand all, and `AppState.renameRequest` (`[role:frontend]`)
- `KobeanREST-gb0` — Add `SidebarTreeModel.swift` and `AppState` collapse/rename actions (`[role:frontend]`, blocked by `KobeanREST-efc`)
- `KobeanREST-1ij` — Update `SidebarView.swift` with Collapse/Expand All, `List(selection:)`, `Return` & right-click inline rename (`[role:frontend]`, blocked by `KobeanREST-gb0`)
- `KobeanREST-ugz` — Run `xcodegen generate`, `xcodebuild test`, and `kb-review` (`[role:qa]`, blocked by `KobeanREST-1ij`)

