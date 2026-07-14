# App.tsx Architecture

## Current State (Pre-Refactoring)

### Overview
`App.tsx` is a large monolithic React component (~4000 lines) that serves as the main application shell. It handles:

- **Application state management** (20+ useState hooks)
- **Workspace data management** (loading, CRUD operations)
- **Request execution** (HTTP calls, auth, variables)
- **UI state management** (modals, panels, menus)
- **Event handling** (keyboard, mouse, context)
- **Sidebar navigation** (collections, folders, requests tree)

### Current Structure

```typescript
// Lines 1-50: Imports and Constants
import { ... } from "lucide-react";
import { useDeferredValue, useEffect, useRef, useState, useTransition, ... } from "react";
import { createPortal } from "react-dom";
import { ... } from "./product-contract";
import { ... } from "./services/http-client";
import { ... } from "./services/variables";
import { ... } from "./components/VariableInput";
import { ... } from "./components/MethodSelector";
import { ... } from "./components/ScriptEditor";
import { ... } from "./components/ResponseViewer";
import { ... } from "./services/auth";
import { ... } from "./services/redaction";
import { ... } from "./services/updater";
import { ... } from "./services/local-store";

// Local constants (Lines 32-40)
const authModes = [...] as const;
const AUTH_MODE_LABELS: Record<string, string> = {...};
const AUTH_MODE_MAP: Record<string, string> = {...};

// Lines 41-70: Local Store Import
import {
  initializeLocalStore,
  loadLocalWorkspace,
  recordRequestHistory,
  saveRequest,
  deleteRequest,
  createFolder,
  updateFolder,
  updateCollection,
  deleteCollection,
  deleteFolder,
  createRequest,
  createEnvironment,
  renameEnvironment,
  deleteEnvironment,
  setActiveEnvironment,
  saveVariable,
  deleteVariable,
  saveSecretVariable,
  loadHistory,
  clearHistory,
  defaultAppSettings,
  loadAppSettings,
  saveAppSettings,
  checkForUpdates,
  getScripts,
  saveScript,
  deleteScript,
  saveFolderAuth,
  saveCollectionAuth,
  createCollection,
  createWorkspace,
  updateCollection,
  deleteCollection,
} from "./services/local-store";

// Lines 71-100: Type Definitions
type RequestHeader = SavedRequest["headers"][number];

const HEADER_PRESET_MENU_GAP = 6;
const HEADER_PRESET_MENU_PADDING = 16;
const HEADER_PRESET_MENU_MIN_WIDTH = 212;
const HEADER_PRESET_MENU_MIN_HEIGHT = 120;
const HEADER_PRESET_MENU_MAX_HEIGHT = 280;

const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_DEFAULT_WIDTH = 280;
const SIDEBAR_MAX_WIDTH = 460;

const SIDEBAR_BOTTOM_HEIGHT = 36;

type ResponseState =
  | { kind: "idle"; response?: ExecuteHttpResponse }
  | { kind: "loading"; response?: ExecuteHttpResponse }
  | { kind: "success"; response: ExecuteHttpResponse }
  | { kind: "error"; message: string };

// Lines 101-150: Helper Functions
function formatBytes(sizeBytes: number): string { ... }
function formatTimestamp(createdAt: string): string { ... }
function statusColor(status: number): string { ... }
function openProductDocs(): void { ... }
function createBlankHeader(): RequestHeader { ... }
interface HeaderPresetMenuLayout { ... }
function getHeaderPresetMenuLayout(...): HeaderPresetMenuLayout { ... }
function parsePastedHeaders(text: string): RequestHeader[] { ... }

// Lines 151-250: Advanced Helper Functions
function getEffectiveAuth(request: SavedRequest, workspace: WorkspaceSummary | null): { mode: ApiAuthMode; config: AuthConfig; source: string } { ... }
function describeAuthTarget(mode: ApiAuthMode, config: AuthConfig): string { ... }

// Lines 251-260: Component Props
interface AddVariableRowProps { ... }

// Lines 261-280: App Function Component
export function App() {
  // Lines 262-300: State Management (38+ useState hooks)
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [isSidebarResizing, setIsSidebarResizing] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  // ... 30+ more state hooks

  // Lines 300-400: Helper Functions (35+ functions)
  function updateDraft(fields: Partial<SavedRequest>): void { ... }
  function updateHeaderField(index: number, field: "key" | "value", value: string): void { ... }
  function toggleHeaderEnabled(index: number, enabled: boolean): void { ... }
  function removeHeader(index: number): void { ... }
  function addHeader(nextHeader?: RequestHeader): void { ... }
  // ... 30+ more helper functions

  // Lines 400-800: Event Handlers (25+ functions)
  function handleSaveRequest(): void { ... }
  function handleDeleteRequest(reqId: string): void { ... }
  async function handleCreateFolder(...): void { ... }
  async function handleCreateCollection(): void { ... }
  async function handleRenameCollection(...): void { ... }
  async function handleDeleteCollection(collectionId: string): void { ... }
  async function handleCreateWorkspace(): void { ... }
  async function handleCreateSubFolder(folderId: string): void { ... }
  async function handleDeleteFolder(folderId: string): void { ... }
  function toggleFolder(folderId: string): void { ... }
  async function handleSetActiveEnvironment(...): void { ... }
  async function handleCreateEnvironment(): void { ... }
  function startEnvironmentRename(name: string): void { ... }
  async function handleRenameEnvironment(...): void { ... }
  async function handleDeleteEnvironment(name: string): void { ... }
  async function handleSaveVariable(...): void { ... }
  async function handleDeleteVariable(...): void { ... }
  async function handleAddSecretVariable(...): void { ... }
  async function handleCreateRequest(folderId: string): void { ... }
  async function handleOpenHistory(): void { ... }
  async function handleClearHistory(): void { ... }
  function handleReplayFromHistory(entry: HistoryEntry): void { ... }
  async function handleCheckForUpdates(...): void { ... }
  async function handleInstallUpdate(): void { ... }
  async function handleSaveSettings(): void { ... }
  async function handleOpenFolderScripts(folderId: string): void { ... }
  async function handleSaveFolderScripts(): void { ... }
  async function handleSaveScripts(): void { ... }
  async function handleSaveEntityAuth(): void { ... }
  async function sendSelectedRequest(): void { ... }

  // Lines 800-900: Effects (15+ useEffect hooks)
  useEffect(() => { /* Sidebar resizing */ }, [isSidebarResizing]);
  useEffect(() => { /* Draft request sync */ }, [selectedRequestId, workspace?.requests]);
  useEffect(() => { /* Request script loading */ }, [selectedRequestId]);
  useEffect(() => { /* Global click handler */ }, []);
  useEffect(() => { /* Header preset menu */ }, [headersPresetMenuOpen]);
  useEffect(() => { /* Header preset menu positioning */ }, [headersPresetMenuOpen]);
  useEffect(() => { /* Theme application */ }, [appSettings.theme]);
  useEffect(() => { /* Workspace loading */ }, []);  // Loads workspace from database
  useEffect(() => { /* Script status loading */ }, []);  // Loads script indicators for folders/requests
  useEffect(() => { /* Context menu */ }, []);
  useEffect(() => { /* Response tab transitions */ }, []);
  // ... 7+ more useEffect hooks

  // Lines 900-2000: UI Components and Rendering (1000+ lines)
  if (!workspace) { return (<main>...</main>); }

  // Sidebar rendering (Lines 1000-1300)
  // Environment switcher and search
  // Collection/folder/request tree with search
  // Context menu handling

  // Workspace management panel (Lines 1300-1600)
  // Environment variables editor

  // Request panel (Lines 1600-2700)
  // Request composer UI (URL, method, headers, body, auth, scripts, settings)

  // Response panel (Lines 2700-1100)
  // Response viewer with tabs (preview/headers/timeline)
  // Response window modal

  // Modal dialogs (Lines 1100-1000)
  // // Confirmation dialogs
  // // History modal
  // // Settings modal
  // // Environment editor modal
  // // Folder scripts modal
  // // Response window modal
  // // Update available modal
  // // Auth editor modal (collections/folders)
}
```

## Component Hierarchy

```
App.tsx
├── Components/
│   ├── Sidebar.tsx (will extract: collections/folders tree, search, context menus)
│   ├── RequestPanel.tsx (will extract: request composer UI)
│   ├── ResponsePanel.tsx (will extract: response viewer UI)
│   ├── EnvironmentEditor.tsx (will extract: environment variables management)
│   ├── SettingsModal.tsx (will extract: app settings dialog)
│   └── ConfirmDialog.tsx (will extract: reusable confirmation modal)
└── Services/
    ├── WorkspaceService.tsx (will extract: workspace CRUD operations)
    ├── RequestService.tsx (will extract: request execution logic)
    ├── AuthService.tsx (will extract: authentication management)
    └── ...
```

## Data Flow

```
Application Startup
     ↓
initializeLocalStore()
     ↓
loadLocalWorkspace()
     ↓
setWorkspace(workspaceData)
     ↓
UI renders workspace data

User Actions
     ↓
Workspace CRUD Operations (createCollection, createFolder, etc.)
     ↓
local-store.ts Tauri commands
     ↓
Rust backend operations
     ↓
Database operations (persistence.rs)
     ↓
State updates via setWorkspace()
     ↓
UI re-renders
```

## Key Dependencies

### External Dependencies
- `lucide-react`: Icons
- `react`: Component lifecycle, hooks
- `@tauri-apps/api/core`: Tauri command invocation

### Internal Dependencies
- `./services/local-store.ts`: All workspace operations
- `./services/http-client.ts`: HTTP request execution
- `./services/variables.ts`: Variable resolution
- `./services/auth.ts`: Authentication management
- `./components/*`: UI components
- `./types.ts`: TypeScript type definitions

## State Management Pattern

Current pattern: Direct useState in App.tsx
```typescript
const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
// Direct manipulation throughout component
```

## Integration Points

### Service Layer Boundaries
- All workspace operations go through `local-store.ts`
- No direct database access from App.tsx
- Service functions are TypeScript, not Rust commands
- Clear separation between UI and business logic

### Event Handler Boundaries
- Event handlers in App.tsx call service functions
- Service functions update state via setWorkspace()
- No side effects or direct database calls

## Future Refactoring Goals

### Immediate Goals (Phase 2- Sidebar Extraction)
1. Extract sidebar UI into `components/Sidebar.tsx`
   - Collection/folder/request tree rendering
   - Search and filtering logic
   - Context menu handling
   - Rename/delete operations UI
   - Keep sidebar state local to Sidebar component
   - Lift sidebar CRUD operations to service layer

### Future Goals (Phase 3- Request Panel Extraction)
2. Extract request composer into `components/RequestPanel.tsx`
   - URL, method, headers, body editors
   - Auth configuration UI
   - Script tabs and editors
   - Request execution controls
   - Keep request state local to RequestPanel component
   - Move request execution logic to service layer

### Future Goals (Phase 4- Response Panel Extraction)
3. Extract response viewer into `components/ResponsePanel.tsx`
   - Response display with syntax highlighting
   - Tab management (preview/headers/timeline)
   - Download and copy functionality
   - Keep response state local to ResponsePanel component

### Future Goals (Phase 5- Modal System Extraction)
4. Extract modal system into `components/ModalManager.tsx`
   - Settings modal (app configuration)
   - Environment editor (variables management)
   - Confirmations (dangerous actions)
   - Unify modal state management pattern
   - Reduce modal code duplication

### Future Goals (Phase 6: Workspace Service Layer)
5. Move workspace operations from App.tsx to `services/Workspace` service
   - Environment CRUD operations
   - Collection CRUD operations
   - Folder CRUD operations
   - Request CRUD operations
   - Clearer separation of concerns
   - Type-safe service functions with proper error handling

### Future Goals (Phase 7: Simplified App.tsx)
6. Reduce App.tsx to core application shell
   - Component composition with extracted components
   - Main layout structure
   - Global event coordination
   - Reduced state management complexity

## Challenges and Considerations

### Current Challenges
1. **Monolithic file size**: Hard to navigate and understand
2. **Mixed concerns**: UI, business logic, state all in one place
3. **Tight coupling**: Direct database access scattered throughout
4. **Testing difficulties**: Hard to isolate and test specific features
5. **Merge conflicts**: Large file causes frequent conflicts

### Refactoring Strategy
1. **Incremental extraction**: Extract one component at a time
2. **Maintain functionality**: Each extraction must keep all features working
3. **Test thoroughly**: Test extracted component in isolation
4. **Update dependencies**: Update App.tsx to use new component
5. **Repeat**: Continue until App.tsx is simplified

### Risk Mitigation
1. **Feature flags**: Use feature flags to enable/disable new components during transition
2. **Backward compatibility**: Keep old service functions working while extracting
3. **Parallel development**: Work on multiple extractions simultaneously
4. **Rollback capability**: Keep git commits for easy rollback

## Success Criteria

✅ **Compilation**: No TypeScript or build errors
✅ **Runtime**: No runtime errors or crashes
✅ **Functionality**: All features working as before
✅ **Performance**: No performance degradation
✅ **Tests**: All existing tests passing
✅ **UI**: All UI elements rendering correctly
