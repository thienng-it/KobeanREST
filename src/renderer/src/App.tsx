import {
  ChevronDown,
  Download,
  FolderTree,
  History,
  KeyRound,
  RefreshCw,
  Save,
  Search,
  Settings,
  Plus,
  Trash2,
  Edit2,
  X, Eye
} from "lucide-react";
import { useEffect, useRef, useState, useTransition, type ClipboardEvent, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { PRODUCT_AUTHENTICATION_MODEL, PRODUCT_DOCS_URL } from "./product-contract";
import { executeHttpRequest } from "./services/http-client";
import { resolveRequestVariables, UnresolvedVariableError, activeEnvironmentVariables, buildVariableMap, resolveString } from "./services/variables";
import { VariableInput, VariableTextarea } from "./components/VariableInput";
import { MethodSelector, methodClass } from "./components/MethodSelector";
import { ResponsePanel, type PreviewMode, type ResponseTab } from "./components/ResponsePanel";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { RequestCodeModal } from "./components/RequestCodeModal";
import { FolderScriptsModal } from "./components/FolderScriptsModal";
import { UpdateDialogModal } from "./components/UpdateDialogModal";
import { formatBytes, statusColor, type ResponseState } from "./response-utils";
import { RequestPanel } from "./components/RequestPanel";
import { Sidebar } from "./components/Sidebar";
import { applyAuth, resolveAuthConfig, redactAuthFromUrl, obtainOAuth2Token } from "./services/auth";
import { redactDiagnosticError } from "./services/redaction";
import { checkForAppUpdate, downloadAndInstallUpdate, type AvailableUpdate } from "./services/updater";

const authModes = ["None", "Basic Auth", "Bearer Token", "API Key", "OAuth 2.0", "NTLM", "Kerberos"] as const;
const AUTH_MODE_LABELS: Record<string, string> = {
  none: "None", basic: "Basic Auth", bearer: "Bearer Token",
  apiKey: "API Key", oauth2: "OAuth 2.0", ntlm: "NTLM", kerberos: "Kerberos"
};
const AUTH_MODE_MAP: Record<string, string> = {
  "None": "none", "Basic Auth": "basic", "Bearer Token": "bearer",
  "API Key": "apiKey", "OAuth 2.0": "oauth2", "NTLM": "ntlm", "Kerberos": "kerberos"
};
import {
  SCRIPT_EDITOR_MODES,
  SCRIPT_SNIPPETS,
  generateRequestCodeSnippet,
  prettifyScriptContent,
  type RequestCodeSnippetTarget,
  type ScriptEditorMode,
} from "./services/script-tools";
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
  saveFolderAuth,
  saveCollectionAuth, createCollection, createWorkspace,
} from "./services/local-store";
import { storeSecret } from "./services/secrets";
import type { ApiAuthMode, AuthConfig, AppSettings, EnvironmentVariable, ExecuteHttpResponse, HistoryEntry, SavedRequest, UpdateStatus, WorkspaceSummary } from "./types";

type RequestHeader = SavedRequest["headers"][number];
type ScriptOutputEntry = { tone: "info" | "error"; message: string };

const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_DEFAULT_WIDTH = 280;
const SIDEBAR_MAX_WIDTH = 460;

function formatTimestamp(createdAt: string): string {
  try {
    return new Date(createdAt.replace(' ', 'T') + 'Z').toLocaleString();
  } catch {
    return createdAt;
  }
}

function openProductDocs() {
  const popup = window.open(PRODUCT_DOCS_URL, "_blank", "noopener,noreferrer");
  if (!popup) {
    window.location.assign(PRODUCT_DOCS_URL);
  }
}

function createScriptVariablesObject(variables: EnvironmentVariable[]): Record<string, string> {
  return Object.fromEntries(
    variables
      .filter((variable) => !(variable.secret && variable.secretRef))
      .map((variable) => [variable.key, variable.value]),
  );
}

function formatScriptLogValue(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getEffectiveAuth(request: SavedRequest, workspace: WorkspaceSummary | null) {
  if (!workspace) {
    return { mode: "none" as const, config: {}, source: "No workspace loaded" };
  }

  if (request.authMode !== "none") {
    return { mode: request.authMode, config: request.authConfig, source: "Request level" };
  }

  const folder = workspace?.folders.find((item) => item.id === request.folderId);
  if (folder?.authMode && folder.authMode !== "none") {
    return { mode: folder.authMode, config: folder.authConfig ?? {}, source: `Inherited from folder: ${folder.name}` };
  }

  const collection = workspace?.collections?.find((item) => folder?.collectionId === item.id);
  if (collection?.authMode && collection.authMode !== "none") {
    return { mode: collection.authMode, config: collection.authConfig ?? {}, source: `Inherited from collection: ${collection.name}` };
  }

  return { mode: "none" as const, config: {}, source: "No inherited auth" };
}

interface AddVariableRowProps {
  envName: string;
  newVarKey: string;
  newVarValue: string;
  newVarSecret: boolean;
  setNewVarKey: (v: string) => void;
  setNewVarValue: (v: string) => void;
  setNewVarSecret: (v: boolean) => void;
  onSave: (key: string, value: string, secret: boolean) => Promise<void>;
}

function AddVariableRow({
  newVarKey,
  newVarValue,
  newVarSecret,
  setNewVarKey,
  setNewVarValue,
  setNewVarSecret,
  onSave,
}: AddVariableRowProps) {
  return (
    <div className="env-add-variable" aria-label="Add variable">
      <div className="env-add-variable-fields">
        <input
          value={newVarKey}
          onChange={e => setNewVarKey(e.target.value)}
          placeholder="New key"
          aria-label="Variable key"
        />
        <input
          value={newVarValue}
          onChange={e => setNewVarValue(e.target.value)}
          placeholder={newVarSecret ? 'Secret value' : 'Value'}
          aria-label="Variable value"
          type={newVarSecret ? 'password' : 'text'}
        />
      </div>
      <div className="env-add-variable-actions">
        <label className="env-secret-toggle">
          <input type="checkbox" checked={newVarSecret} onChange={e => setNewVarSecret(e.target.checked)} />
          Secret
        </label>
        <button
          type="button"
          className="ghost-button"
          onClick={() => void onSave(newVarKey, newVarValue, newVarSecret)}
        >
          <Plus size={12} /> Add
        </button>
      </div>
    </div>
  );
}

export function App() {
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [isSidebarResizing, setIsSidebarResizing] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"body" | "headers" | "auth" | "scripts" | "settings">("body");
  const [responseState, setResponseState] = useState<ResponseState>({
    kind: "idle",
  });
  const [previewMode, setPreviewMode] = useState<PreviewMode>('rendered');
  const [responseTab, setResponseTab] = useState<ResponseTab>('preview');
  const [isResponseTabPending, startResponseTabTransition] = useTransition();
  const [responseWindowOpen, setResponseWindowOpen] = useState(false);
  const [activeBottomDock, setActiveBottomDock] = useState<'response' | null>('response');
  const [bottomDockHeight, setBottomDockHeight] = useState(320);
  const [isResponsePanelResizing, setIsResponsePanelResizing] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const [draftRequest, setDraftRequest] = useState<SavedRequest | null>(null);
  const [renamingRequestId, setRenamingRequestId] = useState("");
  const [renameDraft, setRenameDraft] = useState("");
  const [renamingSidebarItem, setRenamingSidebarItem] = useState<{ id: string; type: "folder" | "collection" } | null>(null);
  const [sidebarNameDraft, setSidebarNameDraft] = useState("");
  const [preScript, setPreScript] = useState("");
  const [postScript, setPostScript] = useState("");
  const [activeRequestScript, setActiveRequestScript] = useState<"pre" | "post">("pre");
  const [scriptEditorMode, setScriptEditorMode] = useState<ScriptEditorMode>("javascript");
  const [activeSnippetId, setActiveSnippetId] = useState("set-header");
  const [requestCodeTarget, setRequestCodeTarget] = useState<RequestCodeSnippetTarget>("curl");
  const [scriptOutputLog, setScriptOutputLog] = useState<ScriptOutputEntry[]>([]);
  const [requestCodeOpen, setRequestCodeOpen] = useState(false);
  const [scriptOutputExpanded, setScriptOutputExpanded] = useState(false);
  const [headersPresetMenuOpen, setHeadersPresetMenuOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
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
  const [databasePath, setDatabasePath] = useState("browser-preview");
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({
    enabled: false,
    lastCheckedLabel: "Automatic checks are off.",
    channel: "stable",
  });
  const [availableUpdate, setAvailableUpdate] = useState<AvailableUpdate | null>(null);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateProgressLabel, setUpdateProgressLabel] = useState("Signed release metadata is required before install.");
  const [updateToast, setUpdateToast] = useState<{ message: string; tone: "info" | "error" } | null>(null);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    target: {
      id: string;
      type: 'folder' | 'request';
    } | null;
  } | null>(null);

  const [scriptStatus, setScriptStatus] = useState<Record<string, boolean>>({});
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [collectionSearch, setCollectionSearch] = useState("");
  const [folderScriptsOpen, setFolderScriptsOpen] = useState(false);
  const [folderScriptsTarget, setFolderScriptsTarget] = useState<string>("");
  const [folderPreScript, setFolderPreScript] = useState("");
  const [folderPostScript, setFolderPostScript] = useState("");
  const scriptEditorActionsRef = useRef<{ insertText: (text: string) => void } | null>(null);

  const [authEditorOpen, setAuthEditorOpen] = useState(false);
  const [authEditorTarget, setAuthEditorTarget] = useState<{ id: string; type: 'collection' | 'folder' } | null>(null);
  const [authDraft, setAuthDraft] = useState<{ mode: ApiAuthMode; config: AuthConfig }>({ mode: 'none', config: {} });

  useEffect(() => {
    if (!updateToast) return;
    const timer = window.setTimeout(() => setUpdateToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [updateToast]);

  async function handleLoadScriptStatuses() {
    try {
      const statuses: Record<string, boolean> = {};
      
      if (!workspace) return;

      for (const folder of workspace.folders) {
        const scripts = await getScripts(folder.id, 'folder');
        statuses[folder.id] = scripts.length > 0;
      }
      
      for (const request of workspace.requests) {
        const scripts = await getScripts(request.id, 'request');
        statuses[request.id] = scripts.length > 0;
      }
      
      setScriptStatus(statuses);
    } catch (err) {
      console.error("Failed to load script statuses", diagnosticMessage(err));
    }
  }

  useEffect(() => {
    let isActive = true;

    async function loadWorkspace() {
      try {
        const persistence = await initializeLocalStore();
        const localWorkspace = await loadLocalWorkspace();
        const loadedSettings = await loadAppSettings();
        if (!isActive) return;
        setDatabasePath(persistence.databasePath);
        setWorkspace(localWorkspace);
        setAppSettings(loadedSettings);
        setUpdateStatus({
          enabled: loadedSettings.updateChecksEnabled,
          lastCheckedLabel: loadedSettings.updateChecksEnabled
            ? "Automatic checks run after launch."
            : "Automatic checks are off.",
          channel: "stable",
        });
        setSelectedRequestId((currentRequestId) => {
          if (localWorkspace.requests.some((request) => request.id === currentRequestId)) {
            return currentRequestId;
          }
          return localWorkspace.requests[0]?.id ?? currentRequestId;
        });
        if (loadedSettings.updateChecksEnabled) {
          void handleCheckForUpdates("automatic", loadedSettings);
        }
        void handleLoadScriptStatuses();
      } catch (error) {
        console.error("Failed to load local workspace", diagnosticMessage(error));
      }
    }
    void loadWorkspace();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!isSidebarResizing) return;

    const handleMouseMove = (event: MouseEvent) => {
      setSidebarWidth(Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, event.clientX)));
    };

    const handleMouseUp = () => {
      setIsSidebarResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isSidebarResizing]);

  function handleSidebarResizerMouseDown() {
    setIsSidebarResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  function handleSidebarResizerKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    event.preventDefault();
    const delta = event.key === "ArrowLeft" ? -16 : 16;
    setSidebarWidth((width) => Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width + delta)));
  }

  useEffect(() => {
    if (!isResponsePanelResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const nextHeight = window.innerHeight - e.clientY - 24;
      if (nextHeight >= 180 && nextHeight <= 720) {
        setBottomDockHeight(nextHeight);
      }
    };

    const handleMouseUp = () => {
      setIsResponsePanelResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResponsePanelResizing]);

  function handleResponsePanelResizerMouseDown() {
    setIsResponsePanelResizing(true);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }

  useEffect(() => {
    if (!workspace) return;
    const req = workspace.requests.find(r => r.id === selectedRequestId);
    setDraftRequest(req ? JSON.parse(JSON.stringify(req)) : null);
  }, [selectedRequestId, workspace?.requests]);

  useEffect(() => {
    async function loadScripts() {
      if (!selectedRequestId) return;
      try {
        const scripts = await getScripts(selectedRequestId, 'request');
        const pre = scripts.find(s => s.scriptType === 'pre')?.content ?? "";
        const post = scripts.find(s => s.scriptType === 'post')?.content ?? "";
        setPreScript(pre);
        setPostScript(post);
      } catch (err) {
        console.error("Failed to load scripts", diagnosticMessage(err));
      }
    }
    void loadScripts();
  }, [selectedRequestId]);

  useEffect(() => {
    const handleGlobalClick = () => {
      if (!workspace) return;
      setContextMenu(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const resolvedTheme =
        appSettings.theme === "system"
          ? (mediaQuery.matches ? "dark" : "light")
          : appSettings.theme;
      document.documentElement.dataset.theme = resolvedTheme;
      document.documentElement.style.colorScheme = resolvedTheme;
    };

    applyTheme();
    mediaQuery.addEventListener("change", applyTheme);
    return () => mediaQuery.removeEventListener("change", applyTheme);
  }, [appSettings.theme]);

  const isSending = responseState.kind === "loading";
  const currentResponse = responseState.kind === "error" ? undefined : responseState.response;
  const responseTitle = responseState.kind === "error"
    ? "Request failed"
    : currentResponse
      ? `${currentResponse.status} ${currentResponse.statusText}`
      : "No response";
  const responseTitleColor = responseState.kind === 'error'
    ? '#991b1b'
    : currentResponse
      ? statusColor(currentResponse.status)
      : 'var(--color-text)';
  const bottomDockStripHeight = 36;
  const activeVars = activeEnvironmentVariables(workspace);
  const currentScriptValue = activeRequestScript === "pre" ? preScript : postScript;
  const selectedScriptSnippet = SCRIPT_SNIPPETS.find((snippet) => snippet.id === activeSnippetId) ?? SCRIPT_SNIPPETS[0];
  const requestCodeSnippet = draftRequest ? generateRequestCodeSnippet(draftRequest, requestCodeTarget) : "";
  const requestFolder = draftRequest
    ? workspace?.folders.find((folder) => folder.id === draftRequest.folderId) ?? null
    : null;
  const requestPath = requestFolder && draftRequest ? `${requestFolder.name} / ${draftRequest.name}` : draftRequest?.name ?? "";
  const effectiveAuth = draftRequest ? getEffectiveAuth(draftRequest, workspace) : null;

  function updateDraft(fields: Partial<SavedRequest>) {
    if (draftRequest) {
      setDraftRequest({ ...draftRequest, ...fields });
    }
  }

  function insertScriptToken(token: string) {
    if (scriptEditorActionsRef.current) {
      scriptEditorActionsRef.current.insertText(token);
      return;
    }

    const nextValue = currentScriptValue.trimEnd()
      ? `${currentScriptValue.trimEnd()}${currentScriptValue.endsWith("\n") ? "" : "\n"}${token}`
      : token;

    if (activeRequestScript === "pre") {
      setPreScript(nextValue);
      return;
    }

    setPostScript(nextValue);
  }

  function setCurrentScriptValue(nextValue: string) {
    if (activeRequestScript === "pre") {
      setPreScript(nextValue);
      return;
    }

    setPostScript(nextValue);
  }

  function handlePrettifyScript() {
    try {
      const nextValue = prettifyScriptContent(currentScriptValue, scriptEditorMode);
      setCurrentScriptValue(nextValue);
      setScriptOutputLog([{ tone: "info", message: `Prettified ${scriptEditorMode.toUpperCase()} content.` }]);
    } catch (error) {
      setScriptOutputLog([{ tone: "error", message: `Prettify failed: ${diagnosticMessage(error)}` }]);
    }
  }

  function insertSelectedScriptSnippet() {
    if (!selectedScriptSnippet) return;
    setScriptEditorMode(selectedScriptSnippet.mode);
    insertScriptToken(selectedScriptSnippet.body);
  }

  function insertRequestCodeSnippet() {
    if (!requestCodeSnippet) return;
    insertScriptToken(requestCodeSnippet);
  }

  function startRequestRename(request: SavedRequest) {
    setRenamingSidebarItem(null);
    setSelectedRequestId(request.id);
    setRenameDraft(draftRequest?.id === request.id ? draftRequest.name : request.name);
    setRenamingRequestId(request.id);
  }

  function stopRequestRename() {
    setRenamingRequestId("");
  }

  function applyRequestRename(requestId: string) {
    const nextName = renameDraft.trim();
    if (!nextName) {
      const request = workspace?.requests.find((item) => item.id === requestId);
      setRenameDraft(request?.name ?? "");
      setRenamingRequestId("");
      return;
    }

    setDraftRequest((current) => {
      if (!current || current.id !== requestId) {
        return current;
      }
      return { ...current, name: nextName };
    });
    setRenamingRequestId("");
  }

  function startSidebarRename(type: "folder" | "collection", id: string, name: string) {
    setRenamingRequestId("");
    setRenamingSidebarItem({ id, type });
    setSidebarNameDraft(name);
  }

  function cancelSidebarRename() {
    setRenamingSidebarItem(null);
    setSidebarNameDraft("");
  }

  async function applySidebarRename() {
    const target = renamingSidebarItem;
    if (!target) return;

    const nextName = sidebarNameDraft.trim();
    if (!nextName) {
      cancelSidebarRename();
      return;
    }

    try {
      if (target.type === "folder") {
        await updateFolder(target.id, nextName);
        setWorkspace((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            folders: prev.folders.map((folder) =>
              folder.id === target.id ? { ...folder, name: nextName } : folder,
            ),
          };
        });
      } else {
        await updateCollection(target.id, nextName);
        setWorkspace((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            collections: prev.collections?.map((collection) =>
              collection.id === target.id ? { ...collection, name: nextName } : collection,
            ) ?? [],
          };
        });
      }
      cancelSidebarRename();
    } catch (err) {
      console.error("Failed to rename sidebar item", diagnosticMessage(err));
      alert("Failed to rename: " + diagnosticMessage(err));
    }
  }

  function updateAppSettings(fields: Partial<AppSettings>) {
    setAppSettings(prev => ({ ...prev, ...fields }));
  }

  function diagnosticMessage(error: unknown) {
    return redactDiagnosticError(error);
  }

  function downloadCurrentResponse() {
    if (!currentResponse) return;

    const blob = new Blob([currentResponse.bodyText || ''], {
      type: currentResponse.contentType || 'text/plain',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `response_${currentResponse.status}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyCurrentResponse() {
    if (!currentResponse) return;
    await navigator.clipboard.writeText(currentResponse.bodyText || '');
    alert('Response body copied to clipboard!');
  }

  function handleResponseTabChange(tab: ResponseTab) {
    if (tab === responseTab) return;
    startResponseTabTransition(() => setResponseTab(tab));
  }


  async function handleSaveRequest() {
    if (!draftRequest) return;
    try {
      await saveRequest(draftRequest);
      setWorkspace(prev => {
        if (!prev) return null;
        return {
          ...prev,
          requests: prev.requests.map(r => r.id === draftRequest.id ? draftRequest : r)
        };
      });
    } catch (err) {
      console.error("Failed to save request", diagnosticMessage(err));
      alert("Failed to save request: " + diagnosticMessage(err));
    }
  }

  async function handleDeleteRequest(reqId: string) {
    setConfirmDialog({
      message: 'Are you sure you want to delete this request?',
      onConfirm: () => confirmDeleteRequest(reqId),
    });
  }

  async function confirmDeleteRequest(reqId: string) {
    setDeleteError(null);
    try {
      await deleteRequest(reqId);
      setWorkspace(prev => {
        if (!prev) return null;
        return {
          ...prev,
          requests: prev.requests.filter(r => r.id !== reqId)
        };
      });
      if (selectedRequestId === reqId) {
        setSelectedRequestId(prev => {
          if (!workspace) return "";
          const remaining = workspace.requests.filter(r => r.id !== reqId);
          return remaining.find(r => r.id !== prev)?.id ?? remaining[0]?.id ?? "";
        });
      }
    } catch (err) {
      console.error(diagnosticMessage(err));
      setDeleteError("Failed to delete request: " + diagnosticMessage(err));
    }
  }

  async function handleCreateFolder(collectionId?: string, parentId?: string) {
    if (!workspace) return;
    const name = "New Folder";
    try {
      const targetCollectionId = collectionId ?? workspace.collections?.[0]?.id;
      const newFolder = await createFolder(name, targetCollectionId, parentId);
      setWorkspace(prev => {
        if (!prev) return null;
        return {
          ...prev,
          folders: [...prev.folders, newFolder]
        };
      });
    } catch (err) {
      console.error("Failed to create folder", diagnosticMessage(err));
      alert("Failed to create folder: " + diagnosticMessage(err));
    }
  }

  async function handleCreateCollection() {
    const name = "New Collection";
    try {
      const collectionId = await createCollection(name);
      setWorkspace(prev => {
        if (!prev) return null;
        return {
          ...prev,
          collections: [...(prev.collections ?? []), { id: collectionId, name }]
        };
      });
    } catch (err) {
      console.error("Failed to create collection", diagnosticMessage(err));
      alert("Failed to create collection: " + diagnosticMessage(err));
    }
  }

  async function handleCreateWorkspace() {
    const name = prompt("Enter workspace name:");
    if (!name) return;
    try {
      console.log("Creating workspace:", name);
      await createWorkspace(name);
      console.log("Workspace created successfully, reloading workspace...");
      const updatedWorkspace = await loadLocalWorkspace();
      setWorkspace(updatedWorkspace);
    } catch (err) {
      console.error("Failed to create workspace", diagnosticMessage(err));
      alert("Failed to create workspace: " + diagnosticMessage(err));
    }
  }

  async function handleCreateSubFolder(folderId: string) {
    if (!workspace) return;
    try {
      const parentFolder = workspace.folders?.find(f => f.id === folderId);
      const collectionId = parentFolder?.collectionId;
      await handleCreateFolder(collectionId, folderId);
    } catch (err) {
      console.error("Failed to create subfolder", diagnosticMessage(err));
      alert("Failed to create subfolder: " + diagnosticMessage(err));
    }
  }

  async function handleDeleteFolder(folderId: string) {
    setConfirmDialog({
      message: 'Are you sure you want to delete this folder and all its requests?',
      onConfirm: () => confirmDeleteFolder(folderId),
    });
  }

  async function handleDeleteCollection(collectionId: string) {
    setConfirmDialog({
      message: 'Delete this collection and all folders and requests inside it?',
      onConfirm: () => confirmDeleteCollection(collectionId),
    });
  }

  function toggleFolder(folderId: string) {
    setCollapsedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  }

  async function confirmDeleteFolder(folderId: string) {
    setDeleteError(null);
    try {
      await deleteFolder(folderId);
      setCollapsedFolders(prev => {
        const next = { ...prev };
        delete next[folderId];
        return next;
      });
      setWorkspace(prev => {
        if (!prev) return null;
        return {
          ...prev,
          folders: prev.folders.filter(f => f.id !== folderId),
          requests: prev.requests.filter(r => r.folderId !== folderId)
        };
      });
    } catch (err) {
      console.error(diagnosticMessage(err));
      setDeleteError("Failed to delete folder: " + diagnosticMessage(err));
    }
  }

  async function confirmDeleteCollection(collectionId: string) {
    setDeleteError(null);
    if (!workspace) return;
    const folderIds = new Set(
      workspace.folders
        .filter((folder) => folder.collectionId === collectionId)
        .map((folder) => folder.id),
    );

    try {
      await deleteCollection(collectionId);
      setRenamingSidebarItem((current) => (
        current?.type === "collection" && current.id === collectionId ? null : current
      ));
      setCollapsedFolders((prev) => {
        const next = { ...prev };
        for (const folderId of folderIds) {
          delete next[folderId];
        }
        return next;
      });
      setWorkspace((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          collections: prev.collections?.filter((collection) => collection.id !== collectionId) ?? [],
          folders: prev.folders.filter((folder) => folder.collectionId !== collectionId),
          requests: prev.requests.filter((request) => !folderIds.has(request.folderId)),
        };
      });
      if (draftRequest && folderIds.has(draftRequest.folderId)) {
        setDraftRequest(null);
      }
      if (selectedRequestId && workspace.requests.some((request) => request.id === selectedRequestId && folderIds.has(request.folderId))) {
        setSelectedRequestId("");
      }
    } catch (err) {
      console.error(diagnosticMessage(err));
      setDeleteError("Failed to delete collection: " + diagnosticMessage(err));
    }
  }

  async function handleSetActiveEnvironment(name: string) {
    try {
      await setActiveEnvironment(name);
      setWorkspace(prev => {
        if (!prev) return null;
        return { ...prev, activeEnvironment: name };
      });
    } catch (err) {
      console.error("Failed to set active environment", diagnosticMessage(err));
    }
  }

  async function handleCreateEnvironment() {
    if (!workspace) return;
    const existingNames = new Set(workspace.environments.map((environment) => environment.name));
    const baseName = "New Environment";
    let name = baseName;
    let suffix = 2;
    while (existingNames.has(name)) {
      name = `${baseName} ${suffix}`;
      suffix += 1;
    }

    try {
      await createEnvironment(name);
      setWorkspace(prev => {
        if (!prev) return null;
        return {
          ...prev,
          environments: [...prev.environments, { name, variables: [] }],
        };
      });
      setEnvEditorTarget(name);
    } catch (err) {
      console.error("Failed to create environment", diagnosticMessage(err));
      alert("Failed to create environment: " + diagnosticMessage(err));
    }
  }

  function startEnvironmentRename(name: string) {
    setRenamingEnvironment(name);
    setEnvironmentNameDraft(name);
  }

  function cancelEnvironmentRename() {
    setRenamingEnvironment("");
    setEnvironmentNameDraft("");
  }

  async function handleRenameEnvironment(oldName: string) {
    startEnvironmentRename(oldName);
  }

  async function applyEnvironmentRename(oldName: string) {
    const newName = environmentNameDraft.trim();
    if (!newName || newName === oldName) {
      cancelEnvironmentRename();
      return;
    }

    if (!workspace || workspace.environments.some((environment) => environment.name === newName && environment.name !== oldName)) {
      alert(`Environment "${newName}" already exists.`);
      return;
    }

    try {
      await renameEnvironment(oldName, newName);
      setWorkspace(prev => {
        if (!prev) return null;
        return {
          ...prev,
          activeEnvironment: prev.activeEnvironment === oldName ? newName : prev.activeEnvironment,
          environments: prev.environments.map(e =>
            e.name === oldName ? { ...e, name: newName } : e
          ),
        };
      });
      if (envEditorTarget === oldName) setEnvEditorTarget(newName);
      cancelEnvironmentRename();
    } catch (err) {
      console.error("Failed to rename environment", diagnosticMessage(err));
      alert("Failed to rename environment: " + diagnosticMessage(err));
    }
  }

  async function handleDeleteEnvironment(name: string) {
    setConfirmDialog({
      message: `Delete environment "${name}" and all its variables?`,
      onConfirm: async () => {
        try {
          await deleteEnvironment(name);
          setWorkspace(prev => {
            if (!prev) return null;
            const environments = prev.environments.filter(e => e.name !== name);
            return {
              ...prev,
              activeEnvironment: prev.activeEnvironment === name ? environments[0]?.name ?? "" : prev.activeEnvironment,
              environments,
            };
          });
          if (envEditorTarget === name) {
            setEnvEditorTarget(prev => {
              if (!workspace) return "";
              const remaining = workspace.environments.filter(e => e.name !== name);
              return remaining[0]?.name ?? "";
            });
          }
        } catch (err) {
          console.error("Failed to delete environment", diagnosticMessage(err));
          setDeleteError("Failed to delete environment: " + diagnosticMessage(err));
        }
      },
    });
  }

  async function handleSaveVariable(envName: string, key: string, value: string) {
    try {
      await saveVariable(envName, key, value);
      setWorkspace(prev => {
        if (!prev) return null;
        return {
          ...prev,
          environments: prev.environments.map(e => {
            if (e.name !== envName) return e;
            const exists = e.variables.some(v => v.key === key);
            return {
              ...e,
              variables: exists
                ? e.variables.map(v => v.key === key ? { ...v, value, secret: false, secretRef: undefined } : v)
                : [...e.variables, { key, value }],
            };
          }),
        };
      });
    } catch (err) {
      console.error("Failed to save variable", diagnosticMessage(err));
      alert("Failed to save variable: " + diagnosticMessage(err));
    }
  }

  async function handleDeleteVariable(envName: string, key: string) {
    try {
      await deleteVariable(envName, key);
      setWorkspace(prev => {
        if (!prev) return null;
        return {
          ...prev,
          environments: prev.environments.map(e =>
            e.name === envName
              ? { ...e, variables: e.variables.filter(v => v.key !== key) }
              : e
          ),
        };
      });
    } catch (err) {
      console.error("Failed to delete variable", diagnosticMessage(err));
      alert("Failed to delete variable: " + diagnosticMessage(err));
    }
  }

  async function handleAddSecretVariable(envName: string, key: string, value: string) {
    try {
      const { refId } = await storeSecret({ scope: envName, key, value });
      await saveSecretVariable(envName, key, refId);
      setWorkspace(prev => {
        if (!prev) return null;
        return {
          ...prev,
          environments: prev.environments.map(e => {
            if (e.name !== envName) return e;
            const exists = e.variables.some(v => v.key === key);
            const updated = { key, value: "[secret stored outside SQLite]", secret: true, secretRef: refId };
            return {
              ...e,
              variables: exists
                ? e.variables.map(v => v.key === key ? updated : v)
                : [...e.variables, updated],
            };
          }),
        };
      });
    } catch (err) {
      console.error("Failed to save secret variable", diagnosticMessage(err));
      alert("Failed to save secret variable: " + diagnosticMessage(err));
    }
  }

  async function handleCreateRequest(folderId: string) {
    try {
      const newReq = await createRequest(folderId);
      setCollapsedFolders(prev => ({
        ...prev,
        [folderId]: false,
      }));
      setWorkspace(prev => {
        if (!prev) return null;
        return {
          ...prev,
          requests: [...prev.requests, newReq]
        };
      });
      setSelectedRequestId(newReq.id);
    } catch (err) { console.error(diagnosticMessage(err)); }
  }

  async function handleOpenHistory() {
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const entries = await loadHistory();
      setHistoryEntries(entries);
    } catch (err) {
      console.error("Failed to load history", diagnosticMessage(err));
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleClearHistory() {
    try {
      await clearHistory();
      setHistoryEntries([]);
    } catch (err) {
      console.error("Failed to clear history", diagnosticMessage(err));
    }
  }

  function handleReplayFromHistory(entry: HistoryEntry) {
    if (!workspace) return;
    const exists = workspace.requests.some(r => r.id === entry.requestId);
    if (exists) {
      setSelectedRequestId(entry.requestId);
      setHistoryOpen(false);
    }
  }

  async function handleCheckForUpdates(
    trigger: "automatic" | "manual",
    settingsOverride: AppSettings = appSettings,
  ) {
    if (!settingsOverride.updateChecksEnabled && trigger === "automatic") return;

    if (trigger === "manual") {
      setUpdateToast({ message: "Checking for updates...", tone: "info" });
    }

    try {
      const preview = await checkForUpdates();
      if (!preview.releaseReady) {
        setAvailableUpdate(null);
        setUpdateDialogOpen(false);
        setUpdateProgressLabel(preview.message);
        setUpdateStatus({
          enabled: settingsOverride.updateChecksEnabled,
          lastCheckedLabel: preview.message,
          channel: "stable",
        });
        if (trigger === "manual") setUpdateToast({ message: preview.message, tone: "info" });
        return;
      }

      const update = await checkForAppUpdate();
      if (update) {
        setAvailableUpdate(update);
        setUpdateDialogOpen(true);
        setUpdateProgressLabel(`Signed release metadata found for version ${update.version}.`);
        setUpdateStatus({
          enabled: settingsOverride.updateChecksEnabled,
          lastCheckedLabel: `Update ${update.version} is ready to install.`,
          channel: "stable",
        });
        if (trigger === "manual") setUpdateToast(null);
        return;
      }

      setAvailableUpdate(null);
      setUpdateDialogOpen(false);
      setUpdateProgressLabel("No signed updates available.");
      setUpdateStatus({
        enabled: settingsOverride.updateChecksEnabled,
        lastCheckedLabel: "No signed updates available.",
        channel: "stable",
      });
      if (trigger === "manual") {
        setUpdateToast({ message: "You're already on the latest version.", tone: "info" });
      }
    } catch (error) {
      if (trigger === "manual" || settingsOverride.offlineBehavior === "notice") {
        setUpdateDialogOpen(false);
        setUpdateStatus({
          enabled: settingsOverride.updateChecksEnabled,
          lastCheckedLabel: "Update check unavailable. The app remains usable offline.",
          channel: "stable",
        });
        if (trigger === "manual") {
          setUpdateToast({ message: "Update check unavailable. The app remains usable offline.", tone: "error" });
        }
      }
      console.error("Failed to check for updates", diagnosticMessage(error));
    }
  }

  async function handleInstallUpdate() {
    if (!availableUpdate) return;

    setUpdateBusy(true);
    setUpdateProgressLabel("Downloading update...");
    try {
      await downloadAndInstallUpdate(availableUpdate, setUpdateProgressLabel);
      setUpdateStatus((current) => ({
        ...current,
        lastCheckedLabel: "Restart to finish update install.",
      }));
    } catch (error) {
      setUpdateProgressLabel("Update install failed. The app remains usable offline.");
      setUpdateStatus((current) => ({
        ...current,
        lastCheckedLabel: "Update install failed. The app remains usable offline.",
      }));
      console.error("Failed to install update", diagnosticMessage(error));
    } finally {
      setUpdateBusy(false);
    }
  }

  async function handleSaveSettings() {
    try {
      await saveAppSettings(appSettings);
      setUpdateStatus((current) => ({
        ...current,
        enabled: appSettings.updateChecksEnabled,
        lastCheckedLabel: appSettings.updateChecksEnabled
          ? current.lastCheckedLabel
          : "Automatic checks are off.",
      }));
      setSettingsOpen(false);
    } catch (error) {
      console.error("Failed to save settings", diagnosticMessage(error));
      alert("Failed to save settings: " + diagnosticMessage(error));
    }
  }

  async function handleOpenFolderScripts(folderId: string) {
    try {
      const scripts = await getScripts(folderId, 'folder');
      const pre = scripts.find(s => s.scriptType === 'pre')?.content ?? "";
      const post = scripts.find(s => s.scriptType === 'post')?.content ?? "";
      setFolderPreScript(pre);
      setFolderPostScript(post);
      setFolderScriptsTarget(folderId);
      setFolderScriptsOpen(true);
    } catch (err) {
      console.error("Failed to load folder scripts", diagnosticMessage(err));
      alert("Failed to load folder scripts: " + diagnosticMessage(err));
    }
  }

  async function handleSaveFolderScripts() {
    if (!folderScriptsTarget) return;
    try {
      await saveScript(folderScriptsTarget, "folder", "pre", folderPreScript);
      await saveScript(folderScriptsTarget, "folder", "post", folderPostScript);
      alert("Folder scripts saved successfully!");
      setFolderScriptsOpen(false);
    } catch (err) {
      console.error("Failed to save folder scripts", diagnosticMessage(err));
      alert("Failed to save folder scripts: " + diagnosticMessage(err));
    }
  }

  async function handleSaveScripts() {
    if (!selectedRequestId) return;
    try {
      await saveScript(selectedRequestId, "request", "pre", preScript);
      await saveScript(selectedRequestId, "request", "post", postScript);
      alert("Scripts saved successfully!");
    } catch (err) {
      console.error("Failed to save scripts", diagnosticMessage(err));
      alert("Failed to save scripts: " + diagnosticMessage(err));
    }
  }

  useEffect(() => {
    if (authEditorTarget && workspace) {
      const { id, type } = authEditorTarget;
      let currentMode: ApiAuthMode = 'none';
      let currentConfig: AuthConfig = {};

      if (type === 'folder') {
        const folder = workspace.folders.find(f => f.id === id);
        if (folder) {
          currentMode = folder.authMode ?? 'none';
          currentConfig = folder.authConfig ?? {};
        }
      } else {
        const collection = workspace.collections?.find(c => c.id === id);
        if (collection) {
          currentMode = collection.authMode ?? 'none';
          currentConfig = collection.authConfig ?? {};
        }
      }
      setAuthDraft({ mode: currentMode, config: currentConfig });
    }
  }, [authEditorTarget, workspace]);

  async function handleSaveEntityAuth() {
    if (!authEditorTarget) return;
    const { id, type } = authEditorTarget;
    try {
      if (type === 'folder') {
        await saveFolderAuth(id, authDraft.mode, authDraft.config);
        setWorkspace(prev => {
          if (!prev) return null;
          return {
            ...prev,
            folders: prev.folders.map(f => f.id === id ? { ...f, authMode: authDraft.mode, authConfig: authDraft.config } : f)
          };
        });
      } else {
        await saveCollectionAuth(id, authDraft.mode, authDraft.config);
        setWorkspace(prev => {
          if (!prev) return null;
          return {
            ...prev,
            collections: prev.collections?.map(c => c.id === id ? { ...c, authMode: authDraft.mode, authConfig: authDraft.config } : c) || []
          };
        });
      }
      setAuthEditorOpen(false);
    } catch (err) {
      console.error("Failed to save entity auth", diagnosticMessage(err));
      alert("Failed to save authentication: " + diagnosticMessage(err));
    }
  }

  async function runScript(content: string, context: any, label: string): Promise<ScriptOutputEntry[]> {
    if (!content) return [];
    const entries: ScriptOutputEntry[] = [];
    const scriptConsole = {
      log: (...values: unknown[]) => {
        entries.push({ tone: "info", message: `[${label}] ${values.map(formatScriptLogValue).join(" ")}` });
      },
      warn: (...values: unknown[]) => {
        entries.push({ tone: "info", message: `[${label}] ${values.map(formatScriptLogValue).join(" ")}` });
      },
      error: (...values: unknown[]) => {
        entries.push({ tone: "error", message: `[${label}] ${values.map(formatScriptLogValue).join(" ")}` });
      },
    };

    try {
      const fn = new Function("context", "console", `
        const request = context.request;
        const response = context.response;
        const variables = context.variables;
        return (async () => {
          ${content}
        })();
      `);
      await fn(context, scriptConsole);
    } catch (err) {
      console.error("Failed to parse script:", diagnosticMessage(err));
      entries.push({ tone: "error", message: `[${label}] ${diagnosticMessage(err)}` });
    }

    return entries;
  }

  async function sendSelectedRequest() {
    if (!draftRequest) return;
    setActiveBottomDock('response');
    setScriptOutputLog([]);
    
    let variableMap = buildVariableMap(activeEnvironmentVariables(workspace));
    const scriptOutputEntries: ScriptOutputEntry[] = [];

    // 1. Execute Pre-scripts (Hierarchy: Folder -> Request)
    // Note: Collection level is not yet fully implemented in the store, focusing on Folder -> Request
    const preScriptsContext = { 
      request: { ...draftRequest },
      variables: createScriptVariablesObject(activeVars),
    };
    
    try {
      const folderScripts = await getScripts(draftRequest.folderId, 'folder');
      const preFolder = folderScripts.find(s => s.scriptType === 'pre')?.content;
      if (preFolder) {
        const resolved = resolveString(preFolder, variableMap).resolved;
        scriptOutputEntries.push(...(await runScript(resolved, preScriptsContext, "Folder pre-request")));
      }
      
      const reqScripts = await getScripts(draftRequest.id, 'request');
      const preReq = reqScripts.find(s => s.scriptType === 'pre')?.content;
      if (preReq) {
        const resolved = resolveString(preReq, variableMap).resolved;
        scriptOutputEntries.push(...(await runScript(resolved, preScriptsContext, "Request pre-request")));
      }
    } catch (err) {
      console.error("Pre-script execution failed", diagnosticMessage(err));
      if (err instanceof UnresolvedVariableError) {
        setResponseState({ kind: "error", message: err.message });
        setScriptOutputLog([...scriptOutputEntries, { tone: "error", message: err.message }]);
        return;
      }
      scriptOutputEntries.push({ tone: "error", message: `Pre-script execution failed: ${diagnosticMessage(err)}` });
    }

    // Use the modified request from scripts
    const requestToSend = preScriptsContext.request;

    let resolvedUrl: string;
    let resolvedHeaders: Array<{ key: string; value: string; enabled: boolean }>;
    let resolvedBody: string | undefined;

    try {
      const resolved = resolveRequestVariables(
        requestToSend.url,
        requestToSend.headers,
        requestToSend.body || undefined,
        workspace ?? { id: "tmp", name: "Temporary", activeEnvironment: "", environments: [], folders: [], requests: [] },
      );
      resolvedUrl = resolved.url;
      resolvedHeaders = resolved.headers;
      resolvedBody = resolved.body;
    } catch (error) {
      if (error instanceof UnresolvedVariableError) {
        setResponseState({ kind: "error", message: error.message });
        return;
      }
      setResponseState({ kind: "error", message: error instanceof Error ? error.message : String(error) });
      return;
    }

    let finalAuthMode = requestToSend.authMode;
    let finalAuthConfig = requestToSend.authConfig;

    if (finalAuthMode === "none") {
      const folder = workspace?.folders.find(f => f.id === requestToSend.folderId);
      if (folder && folder.authMode && folder.authMode !== "none") {
        finalAuthMode = folder.authMode;
        finalAuthConfig = folder.authConfig || {};
      } else {
        const collection = workspace?.collections?.find(c => folder?.collectionId === c.id);
        if (collection && collection.authMode && collection.authMode !== "none") {
          finalAuthMode = collection.authMode;
          finalAuthConfig = collection.authConfig || {};
        }
      }
    }

    variableMap = buildVariableMap(activeEnvironmentVariables(workspace));
    const resolvedAuth = resolveAuthConfig(finalAuthConfig ?? {}, variableMap);

    // Automatically obtain OAuth 2.0 token if missing
    if (finalAuthMode === "oauth2" && !resolvedAuth.token) {
      try {
        const token = await obtainOAuth2Token(resolvedAuth, variableMap);
        
        // Update the source of truth to persist the token
        if (requestToSend.authMode === "oauth2") {
          updateDraft({ authConfig: { ...requestToSend.authConfig, token } });
        } else {
          // If inherited, we don't automatically update folder/collection auth 
          // to avoid unexpected side effects, but we use it for this request.
        }
      } catch (err) {
        setResponseState({ kind: "error", message: "OAuth 2.0 token retrieval failed: " + (err instanceof Error ? err.message : String(err)) });
        return;
      }
    }

    const { url: authUrl, headers: authHeaders } = applyAuth(
      finalAuthMode,
      resolvedAuth,
      resolvedUrl,
      resolvedHeaders,
    );

    setResponseState((current) => ({
      kind: "loading",
      response: 'response' in current ? current.response : undefined,
    }));

    const controller = new AbortController();
    setAbortController(controller);

    const effectiveMethod =
      requestToSend.method === "CUSTOM"
        ? (requestToSend.customMethod?.trim().toUpperCase() || "CUSTOM")
        : requestToSend.method;

    try {
      const response = await executeHttpRequest({
        method: effectiveMethod,
        url: authUrl,
        headers: authHeaders,
        body: resolvedBody,
        timeoutMs: requestToSend.timeoutMs,
        followRedirects: requestToSend.followRedirects,
      });
      setResponseState({ kind: "success", response });
      setAbortController(null);
      
      // 2. Execute Post-scripts (Hierarchy: Request -> Folder)
      const postScriptsContext = {
        request: requestToSend,
        response: response,
        variables: createScriptVariablesObject(activeVars),
      };
      
      try {
        const reqScripts = await getScripts(requestToSend.id, 'request');
        const postReq = reqScripts.find(s => s.scriptType === 'post')?.content;
        if (postReq) {
          const resolved = resolveString(postReq, variableMap).resolved;
          scriptOutputEntries.push(...(await runScript(resolved, postScriptsContext, "Request post-response")));
        }
        
        const folderScripts = await getScripts(requestToSend.folderId, 'folder');
        const postFolder = folderScripts.find(s => s.scriptType === 'post')?.content;
        if (postFolder) {
          const resolved = resolveString(postFolder, variableMap).resolved;
          scriptOutputEntries.push(...(await runScript(resolved, postScriptsContext, "Folder post-response")));
        }
      } catch (err) {
        console.error("Post-script execution failed", diagnosticMessage(err));
        scriptOutputEntries.push({ tone: "error", message: `Post-script execution failed: ${diagnosticMessage(err)}` });
      }
      setScriptOutputLog(scriptOutputEntries);

      const historyUrl = redactAuthFromUrl(authUrl, finalAuthMode, resolvedAuth);
      void recordRequestHistory({
        requestId: requestToSend.id,
        method: effectiveMethod,
        url: historyUrl,
        status: response.status,
        durationMs: response.durationMs,
        sizeBytes: response.sizeBytes,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("aborted")) {
        setResponseState({ kind: "error", message: "Request cancelled by user" });
      } else {
        setResponseState({ kind: "error", message: error instanceof Error ? error.message : String(error) });
      }
      setScriptOutputLog(scriptOutputEntries);
      setAbortController(null);
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void handleSaveRequest();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [draftRequest]);

  return (
    <main
      className={isSidebarResizing ? "app-shell sidebar-resizing" : "app-shell"}
      style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      {updateToast && (
        <div
          className={`update-toast update-toast-${updateToast.tone}`}
          role="status"
          aria-live="polite"
        >
          {updateToast.message}
        </div>
      )}
      <Sidebar
        workspace={workspace}
        selectedRequestId={selectedRequestId}
        activeEnvironment={workspace?.activeEnvironment || ""}
        sidebarWidth={sidebarWidth}
        isResizing={isSidebarResizing}
        collectionSearch={collectionSearch}
        collapsedFolders={collapsedFolders}
        scriptStatus={scriptStatus}
        draftRequest={draftRequest}
        renamingSidebarItem={renamingSidebarItem}
        sidebarNameDraft={sidebarNameDraft}
        renamingRequestId={renamingRequestId}
        renameDraft={renameDraft}
        deleteError={deleteError}
        headline={PRODUCT_AUTHENTICATION_MODEL.headline}
        onCreateFolder={handleCreateFolder}
        onDeleteFolder={handleDeleteFolder}
        onCreateCollection={handleCreateCollection}
        onDeleteCollection={handleDeleteCollection}
        onSelectRequest={setSelectedRequestId}
        onDeleteRequest={handleDeleteRequest}
        onCreateRequest={handleCreateRequest}
        onStartSidebarRename={startSidebarRename}
        onCancelSidebarRename={cancelSidebarRename}
        onApplySidebarRename={applySidebarRename}
        onSidebarNameDraftChange={setSidebarNameDraft}
        onStartRequestRename={startRequestRename}
        onStopRequestRename={stopRequestRename}
        onApplyRequestRename={applyRequestRename}
        onRenameDraftChange={setRenameDraft}
        onSetActiveEnvironment={handleSetActiveEnvironment}
        onOpenEnvironment={() => { setEnvEditorTarget(workspace?.activeEnvironment ?? ""); setEnvEditorOpen(true); }}
        onCollectionSearchChange={setCollectionSearch}
        onToggleFolder={toggleFolder}
        onContextMenu={(target, x, y) => setContextMenu({ x, y, target })}
        onDismissDeleteError={() => setDeleteError(null)}
      />

      <div
        className={isSidebarResizing ? "sidebar-resizer active" : "sidebar-resizer"}
        role="separator"
        aria-label="Resize sidebar"
        aria-orientation="vertical"
        aria-valuemin={SIDEBAR_MIN_WIDTH}
        aria-valuemax={SIDEBAR_MAX_WIDTH}
        aria-valuenow={sidebarWidth}
        tabIndex={0}
        onMouseDown={handleSidebarResizerMouseDown}
        onKeyDown={handleSidebarResizerKeyDown}
      />

      <section className="workspace">
        <header className="topbar">
          <div className="topbar-actions">
            <button className="ghost-button" type="button" onClick={() => openProductDocs()}>
              <Download size={16} />
              Docs
            </button>
            <button
              className="ghost-button"
              type="button"
              aria-label="Open request history"
              onClick={() => void handleOpenHistory()}
            >
              <History size={16} />
              History
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={() => void handleCheckForUpdates("manual")}
            >
              <RefreshCw size={16} />
              Check updates
            </button>
            <button
              className="icon-button"
              aria-label="Settings"
              type="button"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings size={18} />
            </button>
          </div>
        </header>

        <div
          className="workspace-main"
          style={{ gridTemplateRows: activeBottomDock === 'response' ? `minmax(0, 1fr) ${bottomDockHeight + bottomDockStripHeight}px` : `minmax(0, 1fr) ${bottomDockStripHeight}px` }}
        >
          {draftRequest && (
            <RequestPanel
              draftRequest={draftRequest}
              activeVars={activeVars}
              isSending={isSending}
              requestPath={requestPath}
              effectiveAuth={effectiveAuth}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              preScript={preScript}
              setPreScript={setPreScript}
              postScript={postScript}
              setPostScript={setPostScript}
              activeRequestScript={activeRequestScript}
              setActiveRequestScript={setActiveRequestScript}
              scriptEditorMode={scriptEditorMode}
              setScriptEditorMode={setScriptEditorMode}
              activeSnippetId={activeSnippetId}
              setActiveSnippetId={setActiveSnippetId}
              scriptOutputLog={scriptOutputLog}
              scriptOutputExpanded={scriptOutputExpanded}
              setScriptOutputExpanded={setScriptOutputExpanded}
              headersPresetMenuOpen={headersPresetMenuOpen}
              setHeadersPresetMenuOpen={setHeadersPresetMenuOpen}
              onUpdateDraft={updateDraft}
              onSaveRequest={handleSaveRequest}
              onSendRequest={sendSelectedRequest}
              onSaveScripts={handleSaveScripts}
              scriptEditorActionsRef={scriptEditorActionsRef}
              onInsertScriptToken={insertScriptToken}
              onPrettifyScript={handlePrettifyScript}
              onInsertSelectedScriptSnippet={insertSelectedScriptSnippet}
              onOpenRequestCode={() => setRequestCodeOpen(true)}
              diagnosticMessage={diagnosticMessage}
            />
          )}

          <section
            className="bottom-dock"
            aria-label="Bottom dock"
            style={{ height: activeBottomDock === 'response' ? `${bottomDockHeight + bottomDockStripHeight}px` : `${bottomDockStripHeight}px` }}
          >
            <div className="bottom-dock-strip">
              <button
                className={activeBottomDock === 'response' ? 'bottom-dock-tab active' : 'bottom-dock-tab'}
                type="button"
                onClick={() => setActiveBottomDock('response')}
              >
                <Eye size={14} /> Response
              </button>
              <button
                className={activeBottomDock === 'response' ? 'bottom-dock-collapse expanded' : 'bottom-dock-collapse collapsed'}
                type="button"
                aria-label={activeBottomDock === 'response' ? "Collapse response dock" : "Expand response dock"}
                onClick={() => setActiveBottomDock(activeBottomDock === 'response' ? null : 'response')}
              >
                <ChevronDown size={14} />
              </button>
            </div>
            <div className="bottom-dock-panels">
              <ResponsePanel
                variant="dock"
                responseState={responseState}
                currentResponse={currentResponse}
                responseTitle={responseTitle}
                responseTitleColor={responseTitleColor}
                isResponseTabPending={isResponseTabPending}
                responseTab={responseTab}
                previewMode={previewMode}
                activeBottomDock={activeBottomDock}
                onTabChange={handleResponseTabChange}
                onPreviewModeChange={setPreviewMode}
                onDownload={downloadCurrentResponse}
                onCopy={() => void copyCurrentResponse()}
                onOpenWindow={() => setResponseWindowOpen(true)}
                onResizerMouseDown={handleResponsePanelResizerMouseDown}
              />
            </div>
          </section>
        </div>
      </section>

      {responseWindowOpen && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Response window"
          onClick={() => setResponseWindowOpen(false)}
        >
          <div
            className="modal response-window-modal"
            onClick={e => e.stopPropagation()}
          >
            <div className="response-window-titlebar">
              <div>
                <span className="response-window-kicker">Response window</span>
                <h2 className="response-window-title" style={{ color: responseTitleColor }}>
                  {responseTitle}
                </h2>
              </div>
              <button
                className="response-window-close"
                type="button"
                onClick={() => setResponseWindowOpen(false)}
              >
                <X size={15} /> Close
              </button>
            </div>
            <ResponsePanel
              variant="modal"
              responseState={responseState}
              currentResponse={currentResponse}
              responseTitle={responseTitle}
              responseTitleColor={responseTitleColor}
              isResponseTabPending={isResponseTabPending}
              responseTab={responseTab}
              previewMode={previewMode}
              activeBottomDock={activeBottomDock}
              onTabChange={handleResponseTabChange}
              onPreviewModeChange={setPreviewMode}
              onDownload={downloadCurrentResponse}
              onCopy={() => void copyCurrentResponse()}
              onOpenWindow={() => setResponseWindowOpen(true)}
              onResizerMouseDown={handleResponsePanelResizerMouseDown}
            />
          </div>
        </div>
      )}

      <ConfirmDialog dialog={confirmDialog} onCancel={() => setConfirmDialog(null)} />

      {historyOpen && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Request history"
          onClick={() => setHistoryOpen(false)}
        >
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{ width: '740px', maxWidth: '95vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: 0, padding: '24px 24px 16px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ margin: 0, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <History size={16} /> Request History
              </h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={handleClearHistory}
                  style={{ fontSize: '12px', minHeight: '30px', padding: '0 10px', color: '#991b1b', borderColor: '#fca5a5' }}
                >
                  Clear all
                </button>
                <button type="button" onClick={() => setHistoryOpen(false)} style={{ all: 'unset', cursor: 'pointer' }}><X size={18} /></button>
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', padding: '6px 10px', border: '1px solid var(--color-border)', borderRadius: '6px', background: 'var(--color-surface-muted)' }}>
              <Search size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
              <input
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                placeholder="Filter by URL or method…"
                aria-label="Search history"
                style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', color: 'var(--color-text)' }}
              />
            </label>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {historyLoading ? (
                <p style={{ textAlign: 'center', opacity: 0.5, fontSize: '13px', padding: '24px 0' }}>Loading…</p>
              ) : (() => {
                const q = historySearch.toLowerCase();
                const filtered = historyEntries.filter(e =>
                  !q || e.url.toLowerCase().includes(q) || e.method.toLowerCase().includes(q)
                );
                if (filtered.length === 0) {
                  return <p style={{ textAlign: 'center', opacity: 0.5, fontSize: '13px', padding: '24px 0' }}>No history yet.</p>;
                }
                return filtered.map(entry => {
                  const canReplay = workspace?.requests.some(r => r.id === entry.requestId) ?? false;
                  return (
                    <div
                      key={entry.id}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 4px', borderBottom: '1px solid var(--color-border)' }}
                    >
                      <span
                        style={{ flexShrink: 0, fontSize: '12px', fontWeight: 700, minWidth: '36px', textAlign: 'center', padding: '2px 5px', borderRadius: '4px', backgroundColor: `${statusColor(entry.status)}18`, color: statusColor(entry.status) }}
                      >
                        {entry.status}
                      </span>
                      <span className={`method method-${methodClass(entry.method)}`} style={{ flexShrink: 0 }}>{entry.method}</span>
                      <span style={{ flex: 1, fontSize: '12px', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text)' }} title={entry.url}>{entry.url}</span>
                      <span style={{ flexShrink: 0, fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{entry.durationMs} ms</span>
                      <span style={{ flexShrink: 0, fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{formatBytes(entry.sizeBytes)}</span>
                      <span style={{ flexShrink: 0, fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{formatTimestamp(entry.createdAt)}</span>
                      <button
                        type="button"
                        onClick={() => handleReplayFromHistory(entry)}
                        disabled={!canReplay}
                        title={canReplay ? 'Replay request' : 'Saved request was deleted'}
                        style={{ all: 'unset', cursor: canReplay ? 'pointer' : 'not-allowed', opacity: canReplay ? 0.7 : 0.3, flexShrink: 0 }}
                        aria-label="Replay request"
                      >
                        <RefreshCw size={13} />
                      </button>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="App settings"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="modal settings-modal"
            onClick={e => e.stopPropagation()}
          >
            <div className="settings-header">
              <div>
                <span className="settings-kicker">Preferences</span>
                <h2>App settings</h2>
                <p>Control startup checks, privacy defaults, and request behavior.</p>
              </div>
              <button className="settings-close" type="button" aria-label="Close settings" onClick={() => setSettingsOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="settings-content">
              <section className="settings-section">
                <div className="settings-section-heading">
                  <h3>General</h3>
                  <p>Launch behavior and appearance.</p>
                </div>
                <label className="settings-row">
                  <span>
                    <strong>Update checks after launch</strong>
                    <small>Look for signed app updates automatically when KobeanREST starts.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={appSettings.updateChecksEnabled}
                    onChange={e => updateAppSettings({ updateChecksEnabled: e.target.checked })}
                  />
                </label>
                <label className="settings-field">
                  <span>Theme</span>
                  <select
                    className="settings-control"
                    value={appSettings.theme}
                    onChange={e => updateAppSettings({ theme: e.target.value as AppSettings["theme"] })}
                  >
                    <option value="system">System</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </label>
                <div className="settings-field">
                  <span>Data location</span>
                  <code className="settings-path">{databasePath}</code>
                </div>
              </section>

              <section className="settings-section">
                <div className="settings-section-heading">
                  <h3>Privacy</h3>
                  <p>Keep exported files and diagnostics safe by default.</p>
                </div>
                <label className="settings-row">
                  <span>
                    <strong>Export redaction</strong>
                    <small>Remove secret values from exported workspace data.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={appSettings.exportRedactionEnabled}
                    onChange={e => updateAppSettings({ exportRedactionEnabled: e.target.checked })}
                  />
                </label>
                <label className="settings-row">
                  <span>
                    <strong>Diagnostics redaction</strong>
                    <small>Sanitize URLs, headers, and tokens from error reports.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={appSettings.diagnosticsRedactionEnabled}
                    onChange={e => updateAppSettings({ diagnosticsRedactionEnabled: e.target.checked })}
                  />
                </label>
              </section>

              <section className="settings-section">
                <div className="settings-section-heading">
                  <h3>Updates</h3>
                  <p>Choose how the app behaves when update checks cannot reach the network.</p>
                </div>
                <label className="settings-field">
                  <span>Offline behavior</span>
                  <select
                    className="settings-control"
                    value={appSettings.offlineBehavior}
                    onChange={e => updateAppSettings({ offlineBehavior: e.target.value as AppSettings["offlineBehavior"] })}
                  >
                    <option value="silent">Stay quiet when offline</option>
                    <option value="notice">Show a notice when update checks fail</option>
                  </select>
                </label>
                <div className="settings-status">{updateStatus.lastCheckedLabel}</div>
              </section>

              <section className="settings-section">
                <div className="settings-section-heading">
                  <h3>Network defaults</h3>
                  <p>Defaults applied to newly created requests.</p>
                </div>
                <label className="settings-row">
                  <span>
                    <strong>Default timeout</strong>
                    <small>Maximum request duration in milliseconds.</small>
                  </span>
                  <input
                    className="settings-number"
                    type="number"
                    value={appSettings.timeoutMs}
                    onChange={(e) => updateAppSettings({ timeoutMs: parseInt(e.target.value) || 30000 })}
                  />
                </label>
                <label className="settings-row">
                  <span>
                    <strong>Default follow redirects</strong>
                    <small>Automatically follow HTTP redirects for new requests.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={appSettings.followRedirects}
                    onChange={e => updateAppSettings({ followRedirects: e.target.checked })}
                  />
                </label>
              </section>
            </div>

            <div className="settings-footer">
              <button
                type="button"
                className="ghost-button"
                onClick={() => void handleCheckForUpdates("manual")}
              >
                <RefreshCw size={14} />
                Check now
              </button>
              <div className="settings-footer-actions">
                <button className="modal-cancel" type="button" onClick={() => setSettingsOpen(false)}>
                  Cancel
                </button>
                <button className="modal-confirm" type="button" onClick={() => void handleSaveSettings()}>
                  Save settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {authEditorOpen && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Entity authentication editor"
          onClick={() => setAuthEditorOpen(false)}
        >
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{ width: '500px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '16px' }}>
                Authentication for {authEditorTarget?.type === 'folder' ? 'Folder' : 'Collection'}
              </h2>
              <button type="button" onClick={() => setAuthEditorOpen(false)} style={{ all: 'unset', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <KeyRound size={14} />
                Authentication Method
              </label>
              <select 
                value={authDraft.mode} 
                onChange={e => setAuthDraft({ ...authDraft, mode: e.target.value as ApiAuthMode })}
                style={{ 
                  padding: '8px', 
                  borderRadius: '4px', 
                  backgroundColor: 'var(--color-surface)', 
                  color: 'var(--color-text)', 
                  border: '1px solid var(--color-border)',
                  cursor: 'pointer'
                }}
              >
                {Object.entries(AUTH_MODE_MAP).map(([label, value]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {authDraft.mode === "basic" && (
              <div className="auth-config-fields" aria-label="Basic auth credentials">
                <label>
                  <span>Username</span>
                  <VariableInput activeVariables={activeVars} value={authDraft.config.username ?? ""} onChange={v => setAuthDraft({ ...authDraft, config: { ...authDraft.config, username: v.target.value } })} placeholder="username or {{variable}}" autoComplete="off" />
                </label>
                <label>
                  <span>Password</span>
                  <VariableInput type="password" activeVariables={activeVars} value={authDraft.config.password ?? ""} onChange={v => setAuthDraft({ ...authDraft, config: { ...authDraft.config, password: v.target.value } })} placeholder="password or {{variable}}" autoComplete="new-password" />
                </label>
              </div>
            )}

            {authDraft.mode === "bearer" && (
              <div className="auth-config-fields" aria-label="Token credential">
                <label>
                  <span>Token</span>
                  <VariableInput activeVariables={activeVars} value={authDraft.config.token ?? ""} onChange={v => setAuthDraft({ ...authDraft, config: { ...authDraft.config, token: v.target.value } })} placeholder="token or {{variable}}" autoComplete="off" />
                </label>
              </div>
            )}

            {authDraft.mode === "oauth2" && (
              <div className="auth-config-fields" aria-label="OAuth 2.0 credentials" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label>
                  <span>Token</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <VariableInput activeVariables={activeVars} value={authDraft.config.token ?? ""} onChange={v => setAuthDraft({ ...authDraft, config: { ...authDraft.config, token: v.target.value } })} placeholder="access token or {{variable}}" autoComplete="off" style={{ flex: 1 }} />
                    <button type="button" onClick={async () => {
                      try {
                        const token = await obtainOAuth2Token(authDraft.config, buildVariableMap(activeVars));
                        setAuthDraft({ ...authDraft, config: { ...authDraft.config, token } });
                        alert("Access token obtained successfully!");
                      } catch (err) {
                        alert("Failed to obtain OAuth 2.0 token: " + (err instanceof Error ? err.message : String(err)));
                      }
                    }} style={{ padding: '4px 12px', cursor: 'pointer', backgroundColor: 'var(--color-primary, #0066cc)', color: '#fff', border: 'none', borderRadius: '4px' }}>
                      Get Token
                    </button>
                  </div>
                </label>
                <label>
                  <span>Grant Type</span>
                  <select value={authDraft.config.grantType ?? "client_credentials"} onChange={e => setAuthDraft({ ...authDraft, config: { ...authDraft.config, grantType: e.target.value as "client_credentials" | "password" } })}>
                    <option value="client_credentials">Client Credentials</option>
                    <option value="password">Password</option>
                  </select>
                </label>
                <label>
                  <span>Access Token URL</span>
                  <VariableInput activeVariables={activeVars} value={authDraft.config.accessTokenUrl ?? ""} onChange={v => setAuthDraft({ ...authDraft, config: { ...authDraft.config, accessTokenUrl: v.target.value } })} placeholder="https://example.com/oauth/token or {{variable}}" autoComplete="off" />
                </label>
                <label>
                  <span>Client ID</span>
                  <VariableInput activeVariables={activeVars} value={authDraft.config.clientId ?? ""} onChange={v => setAuthDraft({ ...authDraft, config: { ...authDraft.config, clientId: v.target.value } })} placeholder="client_id or {{variable}}" autoComplete="off" />
                </label>
                <label>
                  <span>Client Secret</span>
                  <VariableInput type="password" activeVariables={activeVars} value={authDraft.config.clientSecret ?? ""} onChange={v => setAuthDraft({ ...authDraft, config: { ...authDraft.config, clientSecret: v.target.value } })} placeholder="client_secret or {{variable}}" autoComplete="new-password" />
                </label>
                {(authDraft.config.grantType === "password") && (
                  <>
                    <label>
                      <span>Username</span>
                      <VariableInput activeVariables={activeVars} value={authDraft.config.username ?? ""} onChange={v => setAuthDraft({ ...authDraft, config: { ...authDraft.config, username: v.target.value } })} placeholder="username or {{variable}}" autoComplete="off" />
                    </label>
                    <label>
                      <span>Password</span>
                      <VariableInput type="password" activeVariables={activeVars} value={authDraft.config.password ?? ""} onChange={v => setAuthDraft({ ...authDraft, config: { ...authDraft.config, password: v.target.value } })} placeholder="password or {{variable}}" autoComplete="new-password" />
                    </label>
                  </>
                )}
                <label>
                  <span>Scope</span>
                  <VariableInput activeVariables={activeVars} value={authDraft.config.scope ?? ""} onChange={v => setAuthDraft({ ...authDraft, config: { ...authDraft.config, scope: v.target.value } })} placeholder="read write or {{variable}}" autoComplete="off" />
                </label>
                <label>
                  <span>Audience</span>
                  <VariableInput activeVariables={activeVars} value={authDraft.config.audience ?? ""} onChange={v => setAuthDraft({ ...authDraft, config: { ...authDraft.config, audience: v.target.value } })} placeholder="audience or {{variable}}" autoComplete="off" />
                </label>
              </div>
            )}

            {authDraft.mode === "apiKey" && (
              <div className="auth-config-fields" aria-label="API key credentials">
                <label>
                  <span>Key name</span>
                  <VariableInput activeVariables={activeVars} value={authDraft.config.keyName ?? ""} onChange={v => setAuthDraft({ ...authDraft, config: { ...authDraft.config, keyName: v.target.value } })} placeholder="X-API-Key or {{variable}}" autoComplete="off" />
                </label>
                <label>
                  <span>Key value</span>
                  <VariableInput activeVariables={activeVars} value={authDraft.config.keyValue ?? ""} onChange={v => setAuthDraft({ ...authDraft, config: { ...authDraft.config, keyValue: v.target.value } })} placeholder="value or {{variable}}" autoComplete="off" />
                </label>
                <label>
                  <span>Add to</span>
                  <select value={authDraft.config.placement ?? "header"} onChange={e => setAuthDraft({ ...authDraft, config: { ...authDraft.config, placement: e.target.value as "header" | "query" } })}>
                    <option value="header">Header</option>
                    <option value="query">Query parameter</option>
                  </select>
                </label>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
              <button className="modal-cancel" type="button" onClick={() => setAuthEditorOpen(false)}>
                Cancel
              </button>
              <button className="modal-confirm" type="button" onClick={handleSaveEntityAuth}>
                Save Authentication
              </button>
            </div>
          </div>
        </div>
      )}

      <UpdateDialogModal
        open={updateDialogOpen}
        availableUpdate={availableUpdate}
        updateBusy={updateBusy}
        progressLabel={updateProgressLabel}
        publishedDateLabel={availableUpdate?.date ? formatTimestamp(availableUpdate.date) : null}
        onClose={() => setUpdateDialogOpen(false)}
        onInstall={handleInstallUpdate}
      />

      {envEditorOpen && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Environment editor"
          onClick={() => setEnvEditorOpen(false)}
        >
          <div
            className="modal env-modal"
            onClick={e => e.stopPropagation()}
          >
            <div className="env-modal-header">
              <div>
                <span className="env-modal-kicker">Workspace settings</span>
                <h2>Environments</h2>
                <p>Manage variables for request URLs, headers, auth, and scripts.</p>
              </div>
              <button
                type="button"
                className="env-modal-close"
                aria-label="Close environment editor"
                onClick={() => setEnvEditorOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="env-modal-body">
              <aside className="env-list-panel">
                <div className="env-section-label">Environments</div>
                {workspace?.environments.map(env => (
                  <div
                    key={env.name}
                    className={envEditorTarget === env.name ? "env-list-row selected" : "env-list-row"}
                  >
                    {renamingEnvironment === env.name ? (
                      <input
                        className="env-rename-input"
                        value={environmentNameDraft}
                        aria-label={`Rename ${env.name}`}
                        autoFocus
                        onChange={(event) => setEnvironmentNameDraft(event.target.value)}
                        onBlur={() => void applyEnvironmentRename(env.name)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            event.currentTarget.blur();
                          } else if (event.key === "Escape") {
                            event.preventDefault();
                            cancelEnvironmentRename();
                          }
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEnvEditorTarget(env.name)}
                        className="env-list-button"
                      >
                        {env.name}
                        {workspace?.activeEnvironment === env.name && (
                          <span className="env-active-dot" aria-label="Active environment" />
                        )}
                      </button>
                    )}
                    <div className="env-row-actions">
                      <button type="button" className="env-icon-button" aria-label={`Rename ${env.name}`} onClick={() => handleRenameEnvironment(env.name)}><Edit2 size={12} /></button>
                      <button type="button" className="env-icon-button danger" aria-label={`Delete ${env.name}`} onClick={() => handleDeleteEnvironment(env.name)}><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="ghost-button env-wide-button"
                  onClick={handleCreateEnvironment}
                >
                  <Plus size={12} /> New
                </button>
                {envEditorTarget && workspace?.activeEnvironment !== envEditorTarget && (
                  <button
                    type="button"
                    className="ghost-button env-wide-button"
                    onClick={() => handleSetActiveEnvironment(envEditorTarget)}
                  >
                    Set active
                  </button>
                )}
              </aside>

              <section className="env-variable-panel">
                {envEditorTarget ? (() => {
                  const env = workspace?.environments.find(e => e.name === envEditorTarget);
                  if (!env) return null;
                  return (
                    <>
                      <div className="env-variable-header">
                        <span className="env-section-label">Variables</span>
                        <strong>{env.name}</strong>
                        <span>{env.variables.length} {env.variables.length === 1 ? "variable" : "variables"}</span>
                      </div>
                      <div className="env-variable-card">
                        {env.variables.map(v => (
                          <div key={v.key} className="env-variable-row">
                            <span className="env-variable-key">{v.key}</span>
                            <span className={v.secret ? "env-variable-value secret" : "env-variable-value"}>
                              {v.secret ? '[secret stored outside SQLite]' : v.value}
                            </span>
                            {v.secret && <span className="env-secret-badge">Secret</span>}
                            <button type="button" className="env-icon-button danger" aria-label={`Delete variable ${v.key}`} onClick={() => handleDeleteVariable(env.name, v.key)}><Trash2 size={12} /></button>
                          </div>
                        ))}
                        <AddVariableRow
                          envName={env.name}
                          newVarKey={newVarKey}
                          newVarValue={newVarValue}
                          newVarSecret={newVarSecret}
                          setNewVarKey={setNewVarKey}
                          setNewVarValue={setNewVarValue}
                          setNewVarSecret={setNewVarSecret}
                          onSave={async (key, value, secret) => {
                            if (!key) return;
                            if (secret) {
                              await handleAddSecretVariable(env.name, key, value);
                            } else {
                              await handleSaveVariable(env.name, key, value);
                            }
                            setNewVarKey("");
                            setNewVarValue("");
                            setNewVarSecret(false);
                          }}
                        />
                      </div>
                    </>
                  );
                })() : (
                  <p className="env-empty-state">Select an environment to edit its variables.</p>
                )}
              </section>
            </div>
          </div>
        </div>
      )}

      <RequestCodeModal
        open={requestCodeOpen}
        codeSnippet={requestCodeSnippet}
        codeTarget={requestCodeTarget}
        onClose={() => setRequestCodeOpen(false)}
        onTargetChange={setRequestCodeTarget}
        onInsert={insertRequestCodeSnippet}
      />

      <FolderScriptsModal
        open={folderScriptsOpen}
        preScript={folderPreScript}
        postScript={folderPostScript}
        activeVars={activeVars}
        onClose={() => setFolderScriptsOpen(false)}
        onPreScriptChange={setFolderPreScript}
        onPostScriptChange={setFolderPostScript}
        onSave={handleSaveFolderScripts}
      />

      {contextMenu && (
        <div
          className="context-menu"
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 9999,
            border: '1px solid var(--color-border-modal)',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            minWidth: '160px',
            padding: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            pointerEvents: 'auto',
          }}
          onClick={() => alert("Container clicked!")}
        >
          {contextMenu.target?.type === 'folder' && (
            <>
              <button 
                className="context-menu-item" 
                onClick={async (e) => {
                  e.stopPropagation();
                  alert("Context Menu: New Request clicked!");
                  const folderId = contextMenu.target?.id;
                  if (folderId) void handleCreateRequest(folderId);
                  setContextMenu(null);
                }}
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  padding: '6px 10px', 
                  fontSize: '13px', 
                  cursor: 'pointer', 
                  borderRadius: '4px', 
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  pointerEvents: 'auto',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-muted)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Plus size={14} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> New Request
              </button>
              <button 
                className="context-menu-item" 
                onClick={async (e) => {
                  e.stopPropagation();
                  alert("Context Menu: New Folder clicked!");
                  const folderId = contextMenu.target?.id;
                  if (folderId) {
                    await handleCreateSubFolder(folderId);
                  }
                  setContextMenu(null);
                }}
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  padding: '6px 10px', 
                  fontSize: '13px', 
                  cursor: 'pointer', 
                  borderRadius: '4px', 
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  pointerEvents: 'auto',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-muted)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <FolderTree size={14} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> New Folder
              </button>
              <button 
                className="context-menu-item" 
                onClick={(e) => {
                  e.stopPropagation();
                  const folderId = contextMenu.target?.id;
                  if (folderId) {
                    setAuthEditorTarget({ id: folderId, type: 'folder' });
                    setAuthEditorOpen(true);
                  }
                  setContextMenu(null);
                }}
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  padding: '6px 10px', 
                  fontSize: '13px', 
                  cursor: 'pointer', 
                  borderRadius: '4px', 
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  pointerEvents: 'auto',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-muted)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <KeyRound size={14} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Edit Auth
              </button>
              <button 
                className="context-menu-item" 
                onClick={(e) => {
                  e.stopPropagation();
                  const folderId = contextMenu.target?.id;
                  if (folderId) void handleOpenFolderScripts(folderId);
                  setContextMenu(null);
                }}
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  padding: '6px 10px', 
                  fontSize: '13px', 
                  cursor: 'pointer', 
                  borderRadius: '4px', 
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  pointerEvents: 'auto',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-muted)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Edit2 size={14} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Edit Scripts
              </button>
              <div style={{ height: '1px', backgroundColor: 'var(--color-border)', margin: '4px 0' }} />
              <button 
                className="context-menu-item" 
                onClick={(e) => {
                  e.stopPropagation();
                  const folderId = contextMenu.target?.id;
                  if (folderId) handleDeleteFolder(folderId);
                  setContextMenu(null);
                }}
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  padding: '6px 10px', 
                  fontSize: '13px', 
                  cursor: 'pointer', 
                  borderRadius: '4px', 
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  pointerEvents: 'auto',
                  color: '#991b1b' 
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-muted)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Trash2 size={14} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Delete Folder
              </button>
            </>
          )}
          {contextMenu.target?.type === 'request' && (
            <>
              <button 
                className="context-menu-item" 
                onClick={() => {
                  const reqId = contextMenu.target?.id;
                  if (reqId) startRequestRename(workspace?.requests.find(r => r.id === reqId)!);
                  setContextMenu(null);
                }}
                style={{ all: 'unset', padding: '6px 10px', fontSize: '13px', cursor: 'pointer', borderRadius: '4px' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-muted)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Edit2 size={14} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Rename
              </button>
              <button 
                className="context-menu-item" 
                onClick={() => {
                  const reqId = contextMenu.target?.id;
                  if (reqId) setSelectedRequestId(reqId);
                  setContextMenu(null);
                }}
                style={{ all: 'unset', padding: '6px 10px', fontSize: '13px', cursor: 'pointer', borderRadius: '4px' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-muted)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Eye size={14} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> View Request
              </button>
              <div style={{ height: '1px', backgroundColor: 'var(--color-border)', margin: '4px 0' }} />
              <button 
                className="context-menu-item" 
                onClick={() => {
                  const reqId = contextMenu.target?.id;
                  if (reqId) handleDeleteRequest(reqId);
                  setContextMenu(null);
                }}
                style={{ all: 'unset', padding: '6px 10px', fontSize: '13px', cursor: 'pointer', borderRadius: '4px', color: '#991b1b' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-muted)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Trash2 size={14} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Delete Request
              </button>
            </>
          )}
        </div>
      )}
    </main>
  );
}
