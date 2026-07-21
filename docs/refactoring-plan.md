# App.tsx Refactoring Plan

## Current State Analysis

### File Overview
- **Location**: `src/renderer/src/App.tsx`
- **Lines**: 4,009 lines
- **Complexity**: 38+ useState hooks, 25+ event handlers, 15+ useEffect hooks

### Current Responsibilities
1. **Application state management** (20+ useState hooks)
2. **Workspace data management** (loading, CRUD operations)
3. **Request execution** (HTTP calls, auth, variables)
4. **UI state management** (modals, panels, menus)
5. **Event handling** (keyboard, mouse, context)
6. **Sidebar navigation** (collections, folders, requests tree)

### Existing Components
- `ResponseViewer.tsx` - Response display component
- `MethodSelector.tsx` - HTTP method selector
- `ScriptEditor.tsx` - Script editing component  
- `VariableInput.tsx` - Variable input component

### Existing Services
- `local-store.ts` - Database operations
- `secrets.ts` - Secret management
- `updater.ts` - App update handling
- `variables.ts` - Variable resolution
- `script-tools.ts` - Script utilities
- `http-client.ts` - HTTP execution
- `auth.ts` - Authentication
- `redaction.ts` - Error redaction

---

## Refactoring Phases

### Phase 2: Sidebar Extraction ✅ COMPLETE (re-integrated)

**Goal**: Extract sidebar UI into `components/Sidebar.tsx`

**Status**: Done (properly). The original Phase 2 commit (f9c5fca) only added an
import of `<Sidebar>` but never rendered it — the sidebar stayed inline in
App.tsx. Re-integrated: rewrote `Sidebar.tsx` to faithfully reproduce the inline
block including rename-in-place inputs (collection/folder/request), the
`deleteError` banner, right-click context-menu triggers, and live draft request
names. App retains the rename state + handlers and the floating context-menu
render (which is triggered from the sidebar). App.tsx reduced to ~2,704 lines.


#### Current Sidebar Code (Lines ~2063-2360)
- Environment switcher
- Collection/folder/request tree rendering
- Search and filtering logic
- Context menu handling
- Rename/delete operations UI

#### State to Extract
```typescript
// Sidebar-specific state
const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
const [collectionSearch, setCollectionSearch] = useState("");
const [contextMenu, setContextMenu] = useState<{...} | null>(null);
const [renamingSidebarItem, setRenamingSidebarItem] = useState<{...} | null>(null);
const [sidebarNameDraft, setSidebarNameDraft] = useState("");
const [scriptStatus, setScriptStatus] = useState<Record<string, boolean>>({});
```

#### Functions to Extract
- `startSidebarRename()` / `cancelSidebarRename()` / `applySidebarRename()`
- `handleCreateFolder()` / `handleCreateSubFolder()` / `handleDeleteFolder()`
- `handleCreateCollection()` / `handleDeleteCollection()`
- `toggleFolder()`
- `matchesCollectionSearch()` / `requestMatchesCollectionSearch()` / `folderMatchesCollectionSearch()`
- Context menu handlers

#### Props Interface
```typescript
interface SidebarProps {
  workspace: WorkspaceSummary | null;
  selectedRequestId: string | null;
  activeEnvironment: string;
  
  // CRUD callbacks
  onCreateFolder: (collectionId?: string, parentId?: string) => Promise<void>;
  onDeleteFolder: (folderId: string) => void;
  onCreateCollection: () => Promise<void>;
  onDeleteCollection: (collectionId: string) => void;
  onSelectRequest: (requestId: string) => void;
  
  // Rename callbacks
  onRenameCollection: (collectionId: string, newName: string) => Promise<void>;
  onRenameFolder: (folderId: string, newName: string) => Promise<void>;
  
  // Environment management
  onSetActiveEnvironment: (name: string) => Promise<void>;
  
  // Additional handlers
  onOpenFolderScripts: (folderId: string) => void;
  onEditFolderAuth: (folderId: string) => void;
  onEditCollectionAuth: (collectionId: string) => void;
}
```

#### Success Criteria
- ✅ Sidebar tree renders correctly
- ✅ Search filtering works
- ✅ Context menus function
- ✅ Rename operations work
- ✅ Create/delete operations work
- ✅ No TypeScript errors
- ✅ All existing functionality preserved

---

### Phase 3: Request Panel Extraction ✅ COMPLETE

**Goal**: Extract request composer into `components/RequestPanel.tsx`

**Status**: Done. App.tsx reduced from 4,009 → 3,215 lines. `<RequestPanel />`
mounted in `workspace-main`, owning the body/headers/auth/scripts/settings tabs,
header preset menu (+refs/effects), and local editing helpers. App retains
cross-cutting state (drafts, scripts, script-insertion handlers) passed as props.

#### Current Request Panel Code (Lines ~2415-3016)
- URL, method, headers, body editors
- Auth configuration UI
- Script tabs and editors
- Request execution controls
- Request settings

#### State to Extract
```typescript
// Request panel state
const [activeTab, setActiveTab] = useState<"body" | "headers" | "auth" | "scripts" | "settings">("body");
const [preScript, setPreScript] = useState("");
const [postScript, setPostScript] = useState("");
const [activeRequestScript, setActiveRequestScript] = useState<"pre" | "post">("pre");
const [scriptEditorMode, setScriptEditorMode] = useState<ScriptEditorMode>("javascript");
const [activeSnippetId, setActiveSnippetId] = useState("set-header");
const [requestCodeTarget, setRequestCodeTarget] = useState<RequestCodeSnippetTarget>("curl");
const [requestCodeOpen, setRequestCodeOpen] = useState(false);
const [scriptOutputLog, setScriptOutputLog] = useState<ScriptOutputEntry[]>([]);
const [scriptOutputExpanded, setScriptOutputExpanded] = useState(false);
```

#### Functions to Extract
- `updateDraft()` / `updateHeaderField()` / `toggleHeaderEnabled()` / `removeHeader()` / `addHeader()`
- `handlePrettifyScript()` / `insertSelectedScriptSnippet()` / `insertRequestCodeSnippet()`
- `insertScriptToken()` / `setCurrentScriptValue()`
- `handleHeaderPaste()` / `insertCommonHeader()`
- `updateAuthConfig()` / `getEffectiveAuth()` / `describeAuthTarget()`
- `runScript()`
- Script execution handlers

#### Props Interface
```typescript
interface RequestPanelProps {
  draftRequest: SavedRequest | null;
  workspace: WorkspaceSummary | null;
  activeEnvironmentVariables: EnvironmentVariable[];
  isSending: boolean;
  
  // Update callbacks
  onUpdateDraft: (fields: Partial<SavedRequest>) => void;
  onSaveRequest: () => Promise<void>;
  onDeleteRequest: () => void;
  
  // Execution callbacks
  onSendRequest: () => void;
  onCancelRequest: () => void;
  
  // Script callbacks
  onSaveScripts: () => Promise<void>;
}
```

#### Success Criteria
- ✅ Request composer renders correctly
- ✅ All tabs work (body, headers, auth, scripts, settings)
- ✅ Method selector functions
- ✅ Headers editor works
- ✅ Auth configuration UI works
- ✅ Script editor functions
- ✅ Request execution works
- ✅ All existing functionality preserved

---

### Phase 4: Response Panel Extraction ✅ COMPLETE

**Goal**: Extract response viewer into `components/ResponsePanel.tsx`

**Status**: Done. App.tsx reduced from 3,215 → 2,993 lines. `renderResponseBody`,
`renderResponsePanel`, and `renderBottomDock` collapsed into a single presentational
`<ResponsePanel variant="dock" | "modal" />`. Shared `ResponseState` type and
`formatBytes`/`statusColor` helpers moved to `response-utils.ts`. App retains layout
(bottom dock strip, resize effect, window modal shell) and passes response state +
handlers as props.

#### Current Response Panel Code (Lines ~1042-1189)
- Response display with syntax highlighting
- Tab management (preview/headers/timeline)
- Download and copy functionality
- Response window modal

#### State to Extract
```typescript
// Response panel state
const [responseState, setResponseState] = useState<ResponseState>({ kind: "idle" });
const [previewMode, setPreviewMode] = useState<'rendered' | 'xml' | 'html' | 'json' | 'raw'>('rendered');
const [responseTab, setResponseTab] = useState<'preview' | 'headers' | 'timeline' | 'download' | 'copy'>('preview');
const [responseWindowOpen, setResponseWindowOpen] = useState(false);
const [bottomDockHeight, setBottomDockHeight] = useState(320);
const [isResponsePanelResizing, setIsResponsePanelResizing] = useState(false);
```

#### Functions to Extract
- `renderResponseBody()`' / `renderResponsePanel()`
- `downloadCurrentResponse()` / `copyCurrentResponse()`
- `handleResponseTabChange()`
- `handleResponsePanelResizerMouseDown()`
- `renderBottomDock()`

#### Props Interface
```typescript
interface ResponsePanelProps {
  responseState: ResponseState;
  isActive: boolean;
  height: number;
  isResizing: boolean;
  
  // State update callbacks
  onResponseStateChange: (state: ResponseState) => void;
  onPreviewModeChange: (mode: 'rendered' | 'xml' | 'html' | 'json' | 'raw') => void;
  onResponseTabChange: (tab: 'preview' | 'headers' | 'timeline') => void;
  onHeightChange: (height: number) => void;
  onResizingChange: (resizing: boolean) => void;
  onOpenWindow: () => void;
  onCloseDock: () => void;
}
```

#### Success Criteria
- ✅ Response viewer renders correctly
- ✅ Tab switching works
- ✅ Preview modes work (rendered, JSON, XML, HTML, raw)
- ✅ Download functionality works
- ✅ Copy functionality works
- ✅ Timeline displays correctly
- ✅ Response window modal works
- ✅ All existing functionality preserved

---

### Phase 5: Modal System Extraction

**Goal**: Extract modal system into `components/ModalManager.tsx`

#### Current Modal Code (Lines ~3056-3801)
- Settings modal
- Environment editor modal
- Confirmation dialogs
- History modal
- Update modal
- Request code modal
- Folder scripts modal
- Auth editor modal

#### State to Extract
```typescript
// Modal state
const [confirmDialog, setConfirmDialog] = useState<{...} | null>(null);
const [envEditorOpen, setEnvEditorOpen] = useState(false);
const [envEditorTarget, setEnvEditorTarget] = useState<string>("");
const [renamingEnvironment, setRenamingEnvironment] = useState("");
const [environmentNameDraft, setEnvironmentNameDraft] = useState("");
const [newVarKey, setNewVarKey] = useState("");
const [newVarValue, setNewVarValue] = useState("");
const [newVarSecret, setNewVarSecret] = useState(false);
const [historyOpen, setHistoryOpen] = useState(false);
const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
const [historySearch, setHistorySearch] = useState("");
const [historyLoading, setHistoryLoading] = useState(false);
const [settingsOpen, setSettingsOpen] = useState(false);
const [appSettings, setAppSettings] = useState<AppSettings>(() => defaultAppSettings);
const [availableUpdate, setAvailableUpdate] = useState<AvailableUpdate | null>(null);
const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
const [updateBusy, setUpdateBusy] = useState(false);
const [updateProgressLabel, setUpdateProgressLabel] = useState("...");
const [updateToast, setUpdateToast] = useState<{...} | null>(null);
const [authEditorOpen, setAuthEditorOpen] = useState(false);
const [authEditorTarget, setAuthEditorTarget] = useState<{...} | null>(null);
const [authDraft, setAuthDraft] = useState<{...}>({ mode: 'none', config: {} });
const [folderScriptsOpen, setFolderScriptsOpen] = useState(false);
const [folderScriptsTarget, setFolderScriptsTarget] = useState<string>("");
const [folderPreScript, setFolderPreScript] = useState("");
const [folderPostScript, setFolderPostScript] = useState("");
```

#### Functions to Extract
- `handleSaveSettings()` / `handleCheckForUpdates()` / `handleInstallUpdate()`
- `handleCreateEnvironment()` / `handleRenameEnvironment()` / `handleDeleteEnvironment()`
- `handleSaveVariable()` / `handleDeleteVariable()` / `handleAddSecretVariable()`
- `handleOpenHistory()` / `handleClearHistory()` / `handleReplayFromHistory()`
- `handleSaveScripts()` / `handleSaveFolderScripts()`
- `handleSaveEntityAuth()`
- Environment management functions

#### Props Interface
```typescript
interface ModalManagerProps {
  workspace: WorkspaceSummary | null;
  appSettings: AppSettings;
  databasePath: string;
  updateStatus: UpdateStatus;
  availableUpdate: AvailableUpdate | null;
  
  // Settings callbacks
  onAppSettingsChange: (settings: AppSettings) => void;
  onSaveSettings: () => Promise<void>;
  
  // Environment callbacks
  onCreateEnvironment: () => Promise<void>;
  onRenameEnvironment: (oldName: string, newName: string) => Promise<void>;
  onDeleteEnvironment: (name: string) => void;
  onSetActiveEnvironment: (name: string) => Promise<void>;
  onSaveVariable: (envName: string, key: string, value: string) => Promise<void>;
  onDeleteVariable: (envName: string, key: string) => Promise<void>;
  onAddSecretVariable: (envName: string, key: string, value: string) => Promise<void>;
  
  // History callbacks
  onOpenHistory: () => Promise<void>;
  onClearHistory: () => Promise<void>;
  onReplayFromHistory: (entry: HistoryEntry) => void;
  
  // Update callbacks
  onCheckForUpdates: (trigger: "automatic" | "manual") => Promise<void>;
  onInstallUpdate: () => Promise<void>;
  
  // Auth callbacks
  onSaveEntityAuth: (target: {id: string; type: 'collection' | 'folder'}, auth: {mode: ApiAuthMode; config: AuthConfig}) => Promise<void>;
  
  // Script callbacks
  onSaveFolderScripts: (folderId: string, preScript: string, postScript: string) => Promise<void>;
}
```

#### Success Criteria
- ✅ Settings modal works
- ✅ Environment editor modal works
- ✅ Confirmation dialogs work
- ✅ History modal works
- ✅ Update modal works
- ✅ Auth editor modal works
- ✅ All existing functionality preserved

---

### Phase 6: Workspace Service Layer

**Goal**: Move workspace operations from App.tsx to `services/WorkspaceService.ts`

#### Functions to Extract
- `handleCreateWorkspace()`
- `handleSaveRequest()`
- `confirmDeleteRequest()`
- Environment CRUD operations
- Collection CRUD operations
- Folder CRUD operations
- Request CRUD operations

#### Service Interface
```typescript
class WorkspaceService {
  static async loadWorkspace(): Promise<WorkspaceSummary>;
  static async createWorkspace(name: string): Promise<void>;
  static async saveRequest(request: SavedRequest): Promise<void>;
  static async deleteRequest(requestId: string): Promise<void>;
  static async createFolder(name: string, collectionId: string, parentId?: string): Promise<Folder>;
  static async updateFolder(folderId: string, name: string): Promise<void>;
  static async deleteFolder(folderId: string): Promise<void>;
  static async createCollection(name: string): Promise<string>;
  static async updateCollection(collectionId: string, name: string): Promise<void>;
  static async deleteCollection(collectionId: string): Promise<void>;
  static async createEnvironment(name: string): Promise<void>;
  static async renameEnvironment(oldName: string, newName: string): Promise<void>;
  static async deleteEnvironment(name: string): Promise<void>;
  static async setActiveEnvironment(name: string): Promise<void>;
  static async saveVariable(envName: string, key: string, value: string): Promise<void>;
  static async deleteVariable(envName: string, key: string): Promise<void>;
  static async saveSecretVariable(envName: string, key: string, refId: string): Promise<void>;
}
```

#### Success Criteria
- ✅ Service layer compiles
- ✅ All workspace operations work through service
- ✅ Proper error handling
- ✅ Type-safe interfaces
- ✅ No direct database calls outside service

---

### Phase 7: Simplified App.tsx

**Goal**: Reduce App.tsx to core application shell

#### Final Structure
```typescript
export function App() {
  // Core state only
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  
  // Load workspace on mount
  useEffect(() => {
    async function loadWorkspace() {
      const localWorkspace = await WorkspaceService.loadWorkspace();
      setWorkspace(localWorkspace);
    }
    void loadWorkspace();
  }, []);
  
  // Handle workspace updates
  const handleWorkspaceUpdate = useCallback((updatedWorkspace: WorkspaceSummary) => {
    setWorkspace(updatedWorkspace);
  }, []);
  
  // Render extracted components
  return (
    <main className="app-shell">
      <Sidebar
        workspace={workspace}
        selectedRequestId={selectedRequestId}
        onSelectRequest={setSelectedRequestId}
        onWorkspaceUpdate={handleWorkspaceUpdate}
        {...sidebarProps}
      />
      <RequestPanel
        draftRequest={getSelectedRequest(workspace, selectedRequestId)}
        workspace={workspace}
        onUpdateRequest={handleWorkspaceUpdate}
        {...requestPanelProps}
      />
      <ResponsePanel
        responseState={responseState}
        {...responsePanelProps}
      />
      <ModalManager
        workspace={workspace}
        appSettings={appSettings}
        {...modalProps}
      />
    </main>
  );
}
```

#### Success Criteria
- ✅ App.tsx reduced to <500 lines
- ✅ Component composition clean
- ✅ Main layout structure clear
- ✅ Global event coordination minimal
- ✅ Reduced state management complexity

---

## Implementation Strategy

### Risk Mitigation
1. **Incremental extraction**: Extract one component at a time
2. **Maintain functionality**: Each extraction must keep all features working
3. **Test thoroughly**: Test extracted component in isolation
4. **Update dependencies**: Update App.tsx to use new component
5. **Git commits**: Commit after each successful phase

### Testing Strategy
1. **Unit tests**: Test extracted components with mocks
2. **Integration tests**: Test App.tsx with extracted components
3. **Manual testing**: Test all UI interactions
4. **Performance**: Ensure no performance degradation

### Rollback Plan
1. Keep git history for each phase
2. Tag commits before major changes
3. Quick rollback procedure documented

---

## Success Criteria

### Compilation
- ✅ No TypeScript errors
- ✅ No build errors
- ✅ Proper type safety

### Runtime
- ✅ No runtime errors
- ✅ No crashes
- ✅ All features working

### Functionality
- ✅ All existing features preserved
- ✅ No regressions
- ✅ User workflows unchanged

### Performance
- ✅ No performance degradation
- ✅ Smooth UI interactions
- ✅ Responsive sidebar and panels

### Code Quality
- ✅ Improved maintainability
- ✅ Better separation of concerns
- ✅ Clear component boundaries
- ✅ Reduced complexity

---

## Estimated Timeline

- **Phase 2 (Sidebar)**: 2-3 days
- **Phase 3 (Request Panel)**: 3-4 days
- **Phase 4 (Response Panel)**: 2-3 days
- **Phase 5 (Modal System)**: 3-4 days
- **Phase 6 (Service Layer)**: 2-3 days
- **Phase 7 (Simplified App)**: 1-2 days

**Total**: 13-19 days

---

## Next Steps

1. **Start with Phase 2**: Create `components/Sidebar.tsx`
2. **Test thoroughly**: Ensure sidebar functionality is preserved
3. **Commit**: Create git commit for sidebar extraction
4. **Continue phases**: Follow the planned sequence
5. **Document changes**: Update documentation as needed

## Verification Commands

```bash
# Type checking
npm run build

# Run tests
npm test

# Native checks
source ~/.cargo/env && npm run check:native
source ~/.cargo/env && cargo fmt --check
```
