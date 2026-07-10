import {
  ChevronDown,
  Clock3,
  Download,
  FolderTree,
  Globe,
  History,
  KeyRound,
  Play,
  RefreshCw,
  Save,
  Search,
  Settings,
  Plus,
  Trash2,
  Edit2,
  X, Eye
} from "lucide-react";
import { useEffect, useState } from "react";
import { PRODUCT_AUTHENTICATION_MODEL, PRODUCT_DOCS_URL } from "./product-contract";
import { authModes, sampleWorkspace, AUTH_MODE_MAP, AUTH_MODE_LABELS } from "./data/sample-workspace";
import { executeHttpRequest } from "./services/http-client";
import { resolveRequestVariables, UnresolvedVariableError, activeEnvironmentVariables, buildVariableMap, resolveString } from "./services/variables";
import { VariableInput, VariableTextarea } from "./components/VariableInput";
import { MethodSelector, methodClass, resolvedMethodLabel } from "./components/MethodSelector";
import { ScriptEditor } from "./components/ScriptEditor";
import { ResponseViewer } from "./components/ResponseViewer";
import { applyAuth, resolveAuthConfig, redactAuthFromUrl, obtainOAuth2Token } from "./services/auth";
import { redactDiagnosticError } from "./services/redaction";
import { checkForAppUpdate, downloadAndInstallUpdate, type AvailableUpdate } from "./services/updater";
import {
  initializeLocalStore,
  loadLocalWorkspace,
  recordRequestHistory,
  saveRequest,
  deleteRequest,
  createFolder,
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
import type { ApiAuthMode, AuthConfig, AppSettings, ExecuteHttpResponse, HistoryEntry, SavedRequest, UpdateStatus, WorkspaceSummary } from "./types";

type ResponseState =
  | { kind: "idle"; response?: ExecuteHttpResponse }
  | { kind: "loading"; response?: ExecuteHttpResponse }
  | { kind: "success"; response: ExecuteHttpResponse }
  | { kind: "error"; message: string };

// initialResponse is no longer used as a default for the state


function formatBytes(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  return `${(sizeBytes / 1024).toFixed(1)} KB`;
}

function formatTimestamp(createdAt: string): string {
  try {
    return new Date(createdAt.replace(' ', 'T') + 'Z').toLocaleString();
  } catch {
    return createdAt;
  }
}

function statusColor(status: number): string {
  if (status >= 500) return '#991b1b';
  if (status >= 400) return '#92400e';
  if (status >= 300) return '#1e40af';
  if (status >= 200) return '#14532d';
  return '#334155';
}

function openProductDocs() {
  const popup = window.open(PRODUCT_DOCS_URL, "_blank", "noopener,noreferrer");
  if (!popup) {
    window.location.assign(PRODUCT_DOCS_URL);
  }
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
    <div
      aria-label="Add variable"
      style={{ padding: '8px', background: 'var(--color-surface-muted)', borderTop: '1px solid var(--color-border)' }}
    >
      <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
        <input
          value={newVarKey}
          onChange={e => setNewVarKey(e.target.value)}
          placeholder="New key"
          aria-label="Variable key"
          style={{ flex: 1, fontSize: '12px', fontFamily: 'monospace', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '3px', padding: '4px 6px' }}
        />
        <input
          value={newVarValue}
          onChange={e => setNewVarValue(e.target.value)}
          placeholder={newVarSecret ? 'Secret value' : 'Value'}
          aria-label="Variable value"
          type={newVarSecret ? 'password' : 'text'}
          style={{ flex: 2, fontSize: '12px', fontFamily: 'monospace', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '3px', padding: '4px 6px' }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#64748b', cursor: 'pointer' }}>
          <input type="checkbox" checked={newVarSecret} onChange={e => setNewVarSecret(e.target.checked)} />
          Secret
        </label>
        <button
          type="button"
          className="ghost-button"
          onClick={() => void onSave(newVarKey, newVarValue, newVarSecret)}
          style={{ minHeight: '30px', padding: '0 10px', fontSize: '12px' }}
        >
          <Plus size={12} /> Add
        </button>
      </div>
    </div>
  );
}

export function App() {
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceSummary>(() => sampleWorkspace);
  const [selectedRequestId, setSelectedRequestId] = useState(sampleWorkspace.requests[0]?.id ?? "");
  const [activeTab, setActiveTab] = useState<"body" | "headers" | "auth" | "scripts" | "settings">("body");
  const [responseState, setResponseState] = useState<ResponseState>({
    kind: "idle",
  });
  const [previewMode, setPreviewMode] = useState<'rendered' | 'xml' | 'html' | 'json' | 'raw'>('rendered');
  const [responseTab, setResponseTab] = useState<'preview' | 'headers' | 'timeline' | 'download' | 'copy'>('preview');
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const [draftRequest, setDraftRequest] = useState<SavedRequest | null>(null);
  const [renamingRequestId, setRenamingRequestId] = useState("");
  const [renameDraft, setRenameDraft] = useState("");
  const [preScript, setPreScript] = useState("");
  const [postScript, setPostScript] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [envEditorOpen, setEnvEditorOpen] = useState(false);
  const [envEditorTarget, setEnvEditorTarget] = useState<string>("");
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
  const [folderScriptsOpen, setFolderScriptsOpen] = useState(false);
  const [folderScriptsTarget, setFolderScriptsTarget] = useState<string>("");
  const [folderPreScript, setFolderPreScript] = useState("");
  const [folderPostScript, setFolderPostScript] = useState("");

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
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX;
      if (newWidth > 150 && newWidth < 600) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  function handleResizerMouseDown() {
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  useEffect(() => {
    const req = workspace.requests.find(r => r.id === selectedRequestId);
    setDraftRequest(req ? JSON.parse(JSON.stringify(req)) : null);
  }, [selectedRequestId, workspace.requests]);

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
  const activeVars = activeEnvironmentVariables(workspace);
  const requestFolder = draftRequest
    ? workspace.folders.find((folder) => folder.id === draftRequest.folderId) ?? null
    : null;
  const requestPath = requestFolder && draftRequest ? `${requestFolder.name} / ${draftRequest.name}` : draftRequest?.name ?? "";
  function updateDraft(fields: Partial<SavedRequest>) {
    if (draftRequest) {
      setDraftRequest({ ...draftRequest, ...fields });
    }
  }

  function startRequestRename(request: SavedRequest) {
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
      const request = workspace.requests.find((item) => item.id === requestId);
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

  function updateAuthConfig(fields: Partial<import("./types").AuthConfig>) {
    if (draftRequest) {
      setDraftRequest({ ...draftRequest, authConfig: { ...draftRequest.authConfig, ...fields } });
    }
  }

  function updateAppSettings(fields: Partial<AppSettings>) {
    setAppSettings(prev => ({ ...prev, ...fields }));
  }

  function diagnosticMessage(error: unknown) {
    return redactDiagnosticError(error);
  }

  async function handleSaveRequest() {
    if (!draftRequest) return;
    try {
      await saveRequest(draftRequest);
      setWorkspace(prev => ({
        ...prev,
        requests: prev.requests.map(r => r.id === draftRequest.id ? draftRequest : r)
      }));
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
      setWorkspace(prev => ({
        ...prev,
        requests: prev.requests.filter(r => r.id !== reqId)
      }));
      if (selectedRequestId === reqId) {
        setSelectedRequestId(prev => {
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
    console.log(collectionId, parentId);
    const name = prompt("Enter folder name:");
    if (!name) return;
    try {
      const newFolder = await createFolder(name, collectionId, parentId);
      setWorkspace(prev => ({
        ...prev,
        folders: [...prev.folders, newFolder]
      }));
    } catch (err) { 
      console.error("Failed to create folder:", err);
      alert("Failed to create folder: " + diagnosticMessage(err));
    }
  }

  async function handleCreateCollection() {
    const name = prompt("Enter collection name:");
    if (!name) return;
    try {
      console.log("Creating collection:", name);
      // Using a fallback since WorkspaceSummary doesn't have an id. 
      // In a real app, the workspace would likely have a unique ID.
      const workspaceId = "local-workspace"; 
      await createCollection(workspaceId, name);
      console.log("Collection created successfully, reloading workspace...");
      const updatedWorkspace = await loadLocalWorkspace();
      setWorkspace(updatedWorkspace);
    } catch (err) {
      console.error("Failed to create collection:", err);
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
      console.error("Failed to create workspace:", err);
      alert("Failed to create workspace: " + diagnosticMessage(err));
    }
  }

  async function handleCreateSubFolder(folderId: string) {
    try {
      const parentFolder = workspace.folders?.find(f => f.id === folderId);
      const collectionId = parentFolder?.collectionId;
      await handleCreateFolder(collectionId, folderId);
    } catch (err) {
      console.error("Failed to create subfolder:", err);
      alert("Failed to create subfolder: " + diagnosticMessage(err));
    }
  }

  async function handleDeleteFolder(folderId: string) {
    setConfirmDialog({
      message: 'Are you sure you want to delete this folder and all its requests?',
      onConfirm: () => confirmDeleteFolder(folderId),
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
      setWorkspace(prev => ({
        ...prev,
        folders: prev.folders.filter(f => f.id !== folderId),
        requests: prev.requests.filter(r => r.folderId !== folderId)
      }));
    } catch (err) {
      console.error(diagnosticMessage(err));
      setDeleteError("Failed to delete folder: " + diagnosticMessage(err));
    }
  }

  async function handleSetActiveEnvironment(name: string) {
    try {
      await setActiveEnvironment(name);
      setWorkspace(prev => ({ ...prev, activeEnvironment: name }));
    } catch (err) {
      console.error("Failed to set active environment", diagnosticMessage(err));
    }
  }

  async function handleCreateEnvironment() {
    const name = prompt("Enter environment name:");
    if (!name) return;
    try {
      await createEnvironment(name);
      setWorkspace(prev => ({
        ...prev,
        environments: [...prev.environments, { name, variables: [] }],
      }));
      setEnvEditorTarget(name);
    } catch (err) {
      console.error("Failed to create environment", diagnosticMessage(err));
      alert("Failed to create environment: " + diagnosticMessage(err));
    }
  }

  async function handleRenameEnvironment(oldName: string) {
    const newName = prompt("Enter new name:", oldName);
    if (!newName || newName === oldName) return;
    try {
      await renameEnvironment(oldName, newName);
      setWorkspace(prev => ({
        ...prev,
        activeEnvironment: prev.activeEnvironment === oldName ? newName : prev.activeEnvironment,
        environments: prev.environments.map(e =>
          e.name === oldName ? { ...e, name: newName } : e
        ),
      }));
      if (envEditorTarget === oldName) setEnvEditorTarget(newName);
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
          setWorkspace(prev => ({
            ...prev,
            environments: prev.environments.filter(e => e.name !== name),
          }));
          if (envEditorTarget === name) {
            setEnvEditorTarget(prev => {
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
      setWorkspace(prev => ({
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
      }));
    } catch (err) {
      console.error("Failed to save variable", diagnosticMessage(err));
      alert("Failed to save variable: " + diagnosticMessage(err));
    }
  }

  async function handleDeleteVariable(envName: string, key: string) {
    try {
      await deleteVariable(envName, key);
      setWorkspace(prev => ({
        ...prev,
        environments: prev.environments.map(e =>
          e.name === envName
            ? { ...e, variables: e.variables.filter(v => v.key !== key) }
            : e
        ),
      }));
    } catch (err) {
      console.error("Failed to delete variable", diagnosticMessage(err));
      alert("Failed to delete variable: " + diagnosticMessage(err));
    }
  }

  async function handleAddSecretVariable(envName: string, key: string, value: string) {
    try {
      const { refId } = await storeSecret({ scope: envName, key, value });
      await saveSecretVariable(envName, key, refId);
      setWorkspace(prev => ({
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
      }));
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
      setWorkspace(prev => ({
        ...prev,
        requests: [...prev.requests, newReq]
      }));
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
    if (authEditorTarget) {
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
        setWorkspace(prev => ({
          ...prev,
          folders: prev.folders.map(f => f.id === id ? { ...f, authMode: authDraft.mode, authConfig: authDraft.config } : f)
        }));
      } else {
        await saveCollectionAuth(id, authDraft.mode, authDraft.config);
        setWorkspace(prev => ({
          ...prev,
          collections: prev.collections?.map(c => c.id === id ? { ...c, authMode: authDraft.mode, authConfig: authDraft.config } : c) || []
        }));
      }
      setAuthEditorOpen(false);
    } catch (err) {
      console.error("Failed to save entity auth", diagnosticMessage(err));
      alert("Failed to save authentication: " + diagnosticMessage(err));
    }
  }

  async function runScript(content: string, context: any) {
    if (!content) return;
    try {
      const fn = new Function("context", `
        try {
          ${content}
        } catch (e) {
          console.error("Script execution error:", e);
        }
      `);
      fn(context);
    } catch (err) {
      console.error("Failed to parse script:", diagnosticMessage(err));
    }
  }

  async function sendSelectedRequest() {
    if (!draftRequest) return;
    
    let variableMap = buildVariableMap(activeEnvironmentVariables(workspace));

    // 1. Execute Pre-scripts (Hierarchy: Folder -> Request)
    // Note: Collection level is not yet fully implemented in the store, focusing on Folder -> Request
    const preScriptsContext = { 
      request: { ...draftRequest },
      variables: { ...activeVars } 
    };
    
    try {
      const folderScripts = await getScripts(draftRequest.folderId, 'folder');
      const preFolder = folderScripts.find(s => s.scriptType === 'pre')?.content;
      if (preFolder) {
        const resolved = resolveString(preFolder, variableMap).resolved;
        await runScript(resolved, preScriptsContext);
      }
      
      const reqScripts = await getScripts(draftRequest.id, 'request');
      const preReq = reqScripts.find(s => s.scriptType === 'pre')?.content;
      if (preReq) {
        const resolved = resolveString(preReq, variableMap).resolved;
        await runScript(resolved, preScriptsContext);
      }
    } catch (err) {
      console.error("Pre-script execution failed", diagnosticMessage(err));
      if (err instanceof UnresolvedVariableError) {
        setResponseState({ kind: "error", message: err.message });
        return;
      }
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
        workspace,
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
      const folder = workspace.folders.find(f => f.id === requestToSend.folderId);
      if (folder && folder.authMode && folder.authMode !== "none") {
        finalAuthMode = folder.authMode;
        finalAuthConfig = folder.authConfig || {};
      } else {
        const collection = workspace.collections?.find(c => folder?.collectionId === c.id);
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
        variables: { ...activeVars }
      };
      
      try {
        const reqScripts = await getScripts(requestToSend.id, 'request');
        const postReq = reqScripts.find(s => s.scriptType === 'post')?.content;
        if (postReq) {
          const resolved = resolveString(postReq, variableMap).resolved;
          await runScript(resolved, postScriptsContext);
        }
        
        const folderScripts = await getScripts(requestToSend.folderId, 'folder');
        const postFolder = folderScripts.find(s => s.scriptType === 'post')?.content;
        if (postFolder) {
          const resolved = resolveString(postFolder, variableMap).resolved;
          await runScript(resolved, postScriptsContext);
        }
      } catch (err) {
        console.error("Post-script execution failed", diagnosticMessage(err));
      }

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
    <main className="app-shell">
      {updateToast && (
        <div
          className={`update-toast update-toast-${updateToast.tone}`}
          role="status"
          aria-live="polite"
        >
          {updateToast.message}
        </div>
      )}
      <aside className="sidebar" aria-label="Workspace navigation">
        <div className="brand-row">
          <div className="brand-mark">KR</div>
          <div>
            <strong>KobeanREST</strong>
            <span>{PRODUCT_AUTHENTICATION_MODEL.headline}</span>
          </div>
        </div>

        <div style={{ padding: '0 10px 8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Globe size={14} style={{ flexShrink: 0, opacity: 0.6 }} />
          <select
            aria-label="Active environment"
            value={workspace.activeEnvironment}
            onChange={e => handleSetActiveEnvironment(e.target.value)}
            style={{ flex: 1, fontSize: '12px', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '3px 4px' }}
          >
            {workspace.environments.map(env => (
              <option key={env.name} value={env.name}>{env.name}</option>
            ))}
          </select>
          <button
            type="button"
            className="ghost-button"
            aria-label="Manage environments"
            onClick={() => { setEnvEditorTarget(workspace.activeEnvironment); setEnvEditorOpen(true); }}
            style={{ padding: '3px 6px', fontSize: '11px' }}
          >
            Manage
          </button>
        </div>

        {deleteError && (
          <div role="alert" style={{ padding: '8px 10px', borderRadius: '6px', background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <span>{deleteError}</span>
            <button type="button" aria-label="Dismiss error" onClick={() => setDeleteError(null)} style={{ all: 'unset', cursor: 'pointer', fontWeight: 700 }}>✕</button>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button className="primary-action" type="button" onClick={() => void handleCreateFolder()}>
            <Plus size={16} />
            New folder
          </button>
          <button className="primary-action" type="button" onClick={handleCreateCollection} style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}>
            <Plus size={16} />
            New collection
          </button>
        </div>

        <label className="search-field">
          <Search size={15} />
          <input placeholder="Search collections" aria-label="Search collections" />
        </label>

        <section className="nav-section">
          <h2>
            <FolderTree size={15} />
            Collections
          </h2>
          {workspace.collections?.map(collection => (
            <div className="collection-group" key={collection.id} style={{ marginBottom: '20px' }}>
              <div className="folder-title" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', opacity: 0.8 }}>
                <strong>{collection.name}</strong>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button 
                    type="button" 
                    aria-label={`New folder in ${collection.name}`} 
                    onClick={() => void handleCreateFolder(collection.id)} 
                    style={{ all: 'unset', cursor: 'pointer', padding: '2px' }}
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>
              
              {(() => {
                const renderFolders = (parentId: string | undefined, depth = 0) => {
                  const folders = workspace.folders.filter(f => 
                    (parentId === undefined ? f.collectionId === collection.id && !f.parentId : f.parentId === parentId)
                  );

                  if (folders.length === 0) return null;

                  return (
                    <div style={{ paddingLeft: `${depth * 12}px` }}>
                      {folders.map(folder => {
                        const folderRequests = workspace.requests.filter(r => r.folderId === folder.id);
                        return (
                          <div className="folder-group" key={folder.id}>
                            <div className="folder-title" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}
                                  onContextMenu={e => {
                                    e.preventDefault();
                                    setContextMenu({ x: e.clientX, y: e.clientY, target: { id: folder.id, type: 'folder' } });
                                  }}
                            >
                              <button
                                type="button"
                                aria-expanded={!collapsedFolders[folder.id]}
                                onClick={() => toggleFolder(folder.id)}
                                style={{ all: 'unset', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                              >
                                <ChevronDown size={14} style={{ transform: collapsedFolders[folder.id] ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
                                {folder.name}
                                {scriptStatus[folder.id] && (
                                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2563eb', marginLeft: '4px' }} title="Has scripts" />
                                )}
                              </button>
                            </div>
                            {!collapsedFolders[folder.id] && (
                              <>
                                {renderFolders(folder.id, depth + 1)}
                                {folderRequests.map(request => (
                                  <div key={request.id} className={request.id === selectedRequestId ? "request-row active" : "request-row"} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                      onContextMenu={e => {
                                        e.preventDefault();
                                        setContextMenu({ x: e.clientX, y: e.clientY, target: { id: request.id, type: 'request' } });
                                      }}
                                >
                                    {renamingRequestId === request.id ? (
                                      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span className={`method method-${methodClass(resolvedMethodLabel(request.method, request.customMethod))}`}>{resolvedMethodLabel(request.method, request.customMethod)}</span>
                                        <input
                                          value={renameDraft}
                                          aria-label={`Rename ${request.name}`}
                                          placeholder="Request Name"
                                          autoFocus
                                          onChange={(event) => setRenameDraft(event.target.value)}
                                          onBlur={() => applyRequestRename(request.id)}
                                          onKeyDown={(event) => {
                                            if (event.key === "Enter") {
                                              event.preventDefault();
                                              applyRequestRename(request.id);
                                            } else if (event.key === "Escape") {
                                              event.preventDefault();
                                              stopRequestRename();
                            }
                                          }}
                                          style={{ flex: 1, minWidth: 0, width: '100%', boxSizing: 'border-box', border: '1px solid var(--color-border-tint)', borderRadius: '6px', background: 'var(--color-surface)', color: 'var(--color-text)', padding: '4px 8px' }}
                                        />
                                        {scriptStatus[request.id] && (
                                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2563eb', marginLeft: '4px' }} title="Has scripts" />
                                        )}
                                      </div>
                                    ) : (
                                      <button
                                        style={{ all: 'unset', flex: 1, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                                        onClick={() => setSelectedRequestId(request.id)}
                                        type="button"
                                      >
                                        <span className={`method method-${methodClass(resolvedMethodLabel(request.method, request.customMethod))}`}>{resolvedMethodLabel(request.method, request.customMethod)}</span>
                                        <span onDoubleClick={() => startRequestRename(request)}>{request.id === draftRequest?.id ? draftRequest.name : request.name}</span>
                                        {scriptStatus[request.id] && (
                                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2563eb', marginLeft: '4px' }} title="Has scripts" />
                                        )}
                                      </button>
                                    )}
                                    <div style={{ display: 'flex', flexShrink: 0, gap: '4px' }}>
                                      <button type="button" aria-label={`Rename ${request.name}`} onClick={() => startRequestRename(request)} style={{ all: 'unset', cursor: 'pointer', padding: '2px', opacity: 0.6 }}>
                                        <Edit2 size={12} />
                                      </button>
                                      <button type="button" aria-label="Delete request" onClick={() => handleDeleteRequest(request.id)} style={{ all: 'unset', cursor: 'pointer', padding: '2px', opacity: 0.6 }}>
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                };

                return renderFolders(undefined);
              })()}
            </div>
          ))}
        </section>
      </aside>

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

        <div className="workspace-main">
          {draftRequest && (
            <section className="request-panel" aria-label="Request builder">
              <div className="request-header">
                <div className="request-identity">
                  <span className="muted-label">Request</span>
                  <div className="request-title-row">
                    <h1>{draftRequest.name}</h1>
                  </div>
                  <div className="request-path">{requestPath}</div>
                </div>
                <div className="request-header-actions">
                  <button
                    className="ghost-button request-save-button"
                    type="button"
                    onClick={handleSaveRequest}
                    title="Save (Cmd/Ctrl + S)"
                  >
                    <Save size={17} />
                    Save
                  </button>
                </div>
              </div>

              <div className="request-command-bar">
                <MethodSelector
                  method={draftRequest.method}
                  customMethod={draftRequest.customMethod}
                  onChange={(m, cm) => updateDraft({ method: m, customMethod: cm })}
                />
                <VariableInput
                  activeVariables={activeVars}
                  value={draftRequest.url}
                  aria-label="Request URL"
                  onChange={(e) => updateDraft({ url: e.target.value })}
                  placeholder="https://api.example.com"
                  containerClassName="request-command-input"
                  className="request-command-input-field"
                  containerStyle={{ flex: 1 }}
                />
                <button
                  className="send-button request-send-button"
                  type="button"
                  onClick={sendSelectedRequest}
                  disabled={isSending}
                >
                  <Play size={17} />
                  {isSending ? "Sending" : "Send"}
                </button>
              </div>

              <div className="request-workspace">
                <div className="tab-row" role="tablist" aria-label="Request configuration">
                  {(["body", "headers", "auth", "scripts", "settings"] as const).map((tab) => (
                    <button
                      className={activeTab === tab ? "tab active" : "tab"}
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      role="tab"
                      type="button"
                    >
                      {tab === "scripts" ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-text-active)' }} />
                          {tab}
                        </div>
                      ) : (
                        tab
                      )}
                    </button>
                  ))}
                </div>

                {activeTab === "body" && (
                  <div className="request-tab-panel request-body-panel">
                    <div className="request-body-toolbar">
                      <label>Content-Type</label>
                      <select
                        value={draftRequest.bodyMimeType}
                        onChange={(e) => {
                          const newMimeType = e.target.value;
                          const updates: any = { bodyMimeType: newMimeType };
                          if (["application/x-www-form-urlencoded", "multipart/form-data"].includes(newMimeType)) {
                            updates.bodyForm = draftRequest.bodyForm ?? [];
                          }
                          updateDraft(updates);
                        }}
                      >
                        <option value="text/plain">Text (plain)</option>
                        <option value="application/json">JSON</option>
                        <option value="application/xml">XML</option>
                        <option value="text/xml">XML</option>
                        <option value="application/x-www-form-urlencoded">Form URL Encoded</option>
                        <option value="multipart/form-data">Multipart Form Data</option>
                        <option value="application/octet-stream">Binary</option>
                      </select>
                    </div>

                    {["application/x-www-form-urlencoded", "multipart/form-data"].includes(draftRequest.bodyMimeType) ? (
                      <div className="table-like" aria-label="Body form data">
                        {(draftRequest.bodyForm ?? []).map((item, idx) => (
                          <div className="table-row" key={idx} style={{ display: 'flex', gap: '8px', padding: '4px 0', borderBottom: '1px solid var(--color-border)' }}>
                            <input
                              type="checkbox"
                              checked={item.enabled}
                              onChange={(e) => {
                                const form = [...(draftRequest.bodyForm ?? [])];
                                form[idx].enabled = e.target.checked;
                                updateDraft({ bodyForm: form });
                              }}
                            />
                            <VariableInput
                              activeVariables={activeVars}
                              value={item.key}
                              placeholder="Key"
                              onChange={(e) => {
                                const form = [...(draftRequest.bodyForm ?? [])];
                                form[idx].key = e.target.value;
                                updateDraft({ bodyForm: form });
                              }}
                              style={{ backgroundColor: 'transparent', border: 'none' }}
                              containerStyle={{ flex: 1 }}
                            />
                            <VariableInput
                              activeVariables={activeVars}
                              value={item.value}
                              placeholder="Value"
                              onChange={(e) => {
                                const form = [...(draftRequest.bodyForm ?? [])];
                                form[idx].value = e.target.value;
                                updateDraft({ bodyForm: form });
                              }}
                              style={{ backgroundColor: 'transparent', border: 'none' }}
                              containerStyle={{ flex: 2 }}
                            />
                            <button type="button" onClick={() => {
                              const form = (draftRequest.bodyForm ?? []).filter((_, i) => i !== idx);
                              updateDraft({ bodyForm: form });
                            }} style={{ all: 'unset', cursor: 'pointer', padding: '4px', opacity: 0.7 }}><Trash2 size={14}/></button>
                          </div>
                        ))}
                        <button type="button" className="ghost-button" onClick={() => {
                          updateDraft({ bodyForm: [...(draftRequest.bodyForm ?? []), { key: '', value: '', enabled: true }] });
                        }} style={{ marginTop: '8px' }}>
                          <Plus size={14}/> Add Field
                        </button>
                      </div>
                    ) : (
                      <VariableTextarea
                        activeVariables={activeVars}
                        className="editor request-body-editor"
                        containerClassName="request-body-editor-shell"
                        containerStyle={{ flex: 1, minHeight: 0 }}
                        aria-label="Request body"
                        value={draftRequest.body}
                        onChange={(e) => updateDraft({ body: e.target.value })}
                        placeholder="// Request body"
                        style={{ width: '100%', height: '100%', minHeight: '100%', padding: '12px 14px', fontFamily: 'monospace', resize: 'none' }}
                      />
                    )}
                  </div>
                )}
              {activeTab === "headers" && (
                <div className="request-tab-panel">
                  <div className="table-like" aria-label="Request headers">
                {draftRequest.headers.map((header, idx) => (
                  <div className="table-row" key={idx} style={{ display: 'flex', gap: '8px', padding: '4px 0', borderBottom: '1px solid var(--color-border)' }}>
                    <input 
                      type="checkbox" 
                      checked={header.enabled}
                      onChange={(e) => {
                        const h = [...draftRequest.headers];
                        h[idx].enabled = e.target.checked;
                        updateDraft({ headers: h });
                      }}
                    />
                    <VariableInput 
                      activeVariables={activeVars}
                      value={header.key} 
                      placeholder="Header key"
                      onChange={(e) => {
                        const h = [...draftRequest.headers];
                        h[idx].key = e.target.value;
                        updateDraft({ headers: h });
                      }}
                      style={{ backgroundColor: 'transparent', border: 'none' }}
                      containerStyle={{ flex: 1 }}
                    />
                    <VariableInput 
                      activeVariables={activeVars}
                      value={header.value} 
                      placeholder="Header value"
                      onChange={(e) => {
                        const h = [...draftRequest.headers];
                        h[idx].value = e.target.value;
                        updateDraft({ headers: h });
                      }}
                      style={{ backgroundColor: 'transparent', border: 'none' }}
                      containerStyle={{ flex: 2 }}
                    />
                    <button type="button" onClick={() => {
                      const h = draftRequest.headers.filter((_, i) => i !== idx);
                      updateDraft({ headers: h });
                    }} style={{ all: 'unset', cursor: 'pointer', padding: '4px', opacity: 0.7 }}><Trash2 size={14}/></button>
                  </div>
                ))}
                <button type="button" className="ghost-button" onClick={() => {
                  updateDraft({ headers: [...draftRequest.headers, { key: '', value: '', enabled: true }] });
                }} style={{ marginTop: '8px' }}>
                  <Plus size={14}/> Add Header
                </button>
              </div>
            </div>
          )}
          {activeTab === "auth" && (
            <div className="request-tab-panel" aria-label="API request authentication">
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                      Authentication Method
                      <select
                        value={draftRequest.authMode}
                        onChange={(e) => updateDraft({ authMode: e.target.value as import("./types").ApiAuthMode })}
                        style={{
                          padding: '8px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--color-surface)',
                          color: 'var(--color-text)',
                          border: '1px solid var(--color-border)',
                          cursor: 'pointer',
                          fontSize: '13px'
                        }}
                      >
                        {authModes.map((mode) => {
                          const modeVal = mode === "None" ? "none" : mode === "Basic Auth" ? "basic" : mode === "Bearer Token" ? "bearer" : mode === "API Key" ? "apiKey" : "oauth2";
                          return <option key={modeVal} value={modeVal}>{mode}</option>;
                        })}
                      </select>
                    </label>
                  </div>

                  <div style={{ 
                    fontSize: '12px', 
                    padding: '8px 12px', 
                    borderRadius: '6px', 
                    backgroundColor: 'var(--color-surface-muted)', 
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>Effective Auth:</span>
                    {(() => {
                      if (draftRequest.authMode !== "none") return <span>Request Level ({AUTH_MODE_LABELS[draftRequest.authMode]})</span>;
                      const folder = workspace.folders.find(f => f.id === draftRequest.folderId);
                      if (folder && folder.authMode && folder.authMode !== "none") return <span>Inherited from Folder: {folder.name} ({AUTH_MODE_LABELS[folder.authMode]})</span>;
                      const collection = workspace.collections?.find(c => folder?.collectionId === c.id);
                      if (collection && collection.authMode && collection.authMode !== "none") return <span>Inherited from Collection: {collection.name} ({AUTH_MODE_LABELS[collection.authMode]})</span>;
                      return <span>None</span>;
                    })()}
                  </div>

                  {draftRequest.authMode === "basic" && (
                    <div className="auth-config-fields" aria-label="Basic auth credentials">
                      <label>
                        <span>Username</span>
                        <VariableInput activeVariables={activeVars} value={draftRequest.authConfig?.username ?? ""} onChange={e => updateAuthConfig({ username: e.target.value })} placeholder="username or {{variable}}" autoComplete="off" />
                      </label>
                      <label>
                        <span>Password</span>
                        <VariableInput type="password" activeVariables={activeVars} value={draftRequest.authConfig?.password ?? ""} onChange={e => updateAuthConfig({ password: e.target.value })} placeholder="password or {{variable}}" autoComplete="new-password" />
                      </label>
                    </div>
                  )}
                  {draftRequest.authMode === "bearer" && (
                    <div className="auth-config-fields" aria-label="Bearer token credential">
                      <label>
                        <span>Token</span>
                        <VariableInput activeVariables={activeVars} value={draftRequest.authConfig?.token ?? ""} onChange={e => updateAuthConfig({ token: e.target.value })} placeholder="token or {{variable}}" autoComplete="off" />
                      </label>
                    </div>
                  )}
                  {draftRequest.authMode === "oauth2" && (
                    <div className="auth-config-fields" aria-label="OAuth 2.0 credentials" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <label>
                        <span>Token</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <VariableInput activeVariables={activeVars} value={draftRequest.authConfig?.token ?? ""} onChange={e => updateAuthConfig({ token: e.target.value })} placeholder="access token or {{variable}}" autoComplete="off" style={{ flex: 1 }} />
                          <button className="primary-action" type="button" onClick={async () => {
                            try {
                              const token = await obtainOAuth2Token(draftRequest.authConfig ?? {}, buildVariableMap(activeVars));
                              updateAuthConfig({ token });
                              alert("Access token obtained successfully!");
                            } catch (err) {
                              alert("Failed to obtain OAuth 2.0 token: " + (err instanceof Error ? err.message : String(err)));
                            }
                          }}>
                            Get Token
                          </button>
                        </div>
                      </label>
                      <label>
                        <span>Grant Type</span>
                        <select value={draftRequest.authConfig?.grantType ?? "client_credentials"} onChange={e => updateAuthConfig({ grantType: e.target.value as "client_credentials" | "password" })}>
                          <option value="client_credentials">Client Credentials</option>
                          <option value="password">Password</option>
                        </select>
                      </label>
                      <label>
                        <span>Access Token URL</span>
                        <VariableInput activeVariables={activeVars} value={draftRequest.authConfig?.accessTokenUrl ?? ""} onChange={e => updateAuthConfig({ accessTokenUrl: e.target.value })} placeholder="https://example.com/oauth/token or {{variable}}" autoComplete="off" />
                      </label>
                      <label>
                        <span>Client ID</span>
                        <VariableInput activeVariables={activeVars} value={draftRequest.authConfig?.clientId ?? ""} onChange={e => updateAuthConfig({ clientId: e.target.value })} placeholder="client_id or {{variable}}" autoComplete="off" />
                      </label>
                      <label>
                        <span>Client Secret</span>
                        <VariableInput type="password" activeVariables={activeVars} value={draftRequest.authConfig?.clientSecret ?? ""} onChange={e => updateAuthConfig({ clientSecret: e.target.value })} placeholder="client_secret or {{variable}}" autoComplete="new-password" />
                      </label>
                      {(draftRequest.authConfig?.grantType === "password") && (
                        <>
                          <label>
                            <span>Username</span>
                            <VariableInput activeVariables={activeVars} value={draftRequest.authConfig?.username ?? ""} onChange={e => updateAuthConfig({ username: e.target.value })} placeholder="username or {{variable}}" autoComplete="off" />
                          </label>
                          <label>
                            <span>Password</span>
                            <VariableInput type="password" activeVariables={activeVars} value={draftRequest.authConfig?.password ?? ""} onChange={e => updateAuthConfig({ password: e.target.value })} placeholder="password or {{variable}}" autoComplete="new-password" />
                          </label>
                        </>
                      )}
                      <label>
                        <span>Scope</span>
                        <VariableInput activeVariables={activeVars} value={draftRequest.authConfig?.scope ?? ""} onChange={e => updateAuthConfig({ scope: e.target.value })} placeholder="read write or {{variable}}" autoComplete="off" />
                      </label>
                      <label>
                        <span>Audience</span>
                        <VariableInput activeVariables={activeVars} value={draftRequest.authConfig?.audience ?? ""} onChange={e => updateAuthConfig({ audience: e.target.value })} placeholder="audience or {{variable}}" autoComplete="off" />
                      </label>
                    </div>
                  )}
                  {draftRequest.authMode === "apiKey" && (
                    <div className="auth-config-fields" aria-label="API key credentials">
                      <label>
                        <span>Key name</span>
                        <VariableInput activeVariables={activeVars} value={draftRequest.authConfig?.keyName ?? ""} onChange={e => updateAuthConfig({ keyName: e.target.value })} placeholder="X-API-Key or {{variable}}" autoComplete="off" />
                      </label>
                      <label>
                        <span>Key value</span>
                        <VariableInput activeVariables={activeVars} value={draftRequest.authConfig?.keyValue ?? ""} onChange={e => updateAuthConfig({ keyValue: e.target.value })} placeholder="value or {{variable}}" autoComplete="off" />
                      </label>
                      <label>
                        <span>Add to</span>
                        <select value={draftRequest.authConfig?.placement ?? "header"} onChange={e => updateAuthConfig({ placement: e.target.value as "header" | "query" })}>
                          <option value="header">Header</option>
                          <option value="query">Query parameter</option>
                        </select>
                      </label>
                    </div>
                  )}
                </div>
              )}
              {activeTab === "scripts" && (
              <div className="request-tab-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-text-active)' }} />
                    Pre-request Script
                  </label>
                  <ScriptEditor 
                    value={preScript}
                    onChange={setPreScript}
                    variables={activeVars.map(v => v.key)}
                    placeholder="// JavaScript only (no TypeScript types) to run before the request"
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-text-active)' }} />
                    Post-request Script
                  </label>
                  <ScriptEditor 
                    value={postScript}
                    onChange={setPostScript}
                    variables={activeVars.map(v => v.key)}
                    placeholder="// JavaScript only (no TypeScript types) to run after the request"
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="ghost-button" type="button" onClick={handleSaveScripts} style={{ padding: '6px 12px', fontSize: '12px' }}>
                    <Save size={14} /> Save Scripts
                  </button>
                </div>
              </div>
              )}
              {activeTab === "settings" && (
                <div className="request-tab-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Settings size={14} /> Request Settings
                    </label>
                    <div style={{ display: 'grid', gap: '12px', padding: '12px', borderRadius: '6px', background: 'var(--color-surface-muted)', border: '1px solid var(--color-border)' }}>
                      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', fontSize: '13px', color: 'var(--color-text)' }}>
                        <span>Timeout (ms)</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="number"
                            value={draftRequest.timeoutMs ?? ""}
                            onChange={(e) => updateDraft({ timeoutMs: parseInt(e.target.value) || undefined })}
                            style={{ width: '80px', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '4px' }}
                          />
                          <button 
                            type="button" 
                            className="ghost-button" 
                            onClick={() => updateDraft({ timeoutMs: undefined })}
                            disabled={draftRequest.timeoutMs === undefined}
                            style={{ padding: '2px 6px', fontSize: '11px' }}
                          >
                            Reset
                          </button>
                        </div>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', fontSize: '13px', color: 'var(--color-text)' }}>
                        <span>Follow Redirects</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="checkbox"
                            checked={draftRequest.followRedirects ?? false}
                            onChange={e => updateDraft({ followRedirects: e.target.checked })}
                            style={{ cursor: 'pointer' }}
                          />
                          <button 
                            type="button" 
                            className="ghost-button" 
                            onClick={() => updateDraft({ followRedirects: undefined })}
                            disabled={draftRequest.followRedirects === undefined}
                            style={{ padding: '2px 6px', fontSize: '11px' }}
                          >
                            Reset
                          </button>
                        </div>
                      </label>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                      Values are inherited from Folder or Global settings if not overridden.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

          <section className="response-layout" aria-label="Response">
            <div className="response-viewer">
            <div className="panel-heading">
              <div>
                <span className="muted-label">Response</span>
                <h2 style={{
                  color: responseState.kind === 'error' ? '#991b1b'
                    : currentResponse ? statusColor(currentResponse.status)
                    : 'var(--color-text)'
                }}>
                  {responseState.kind === "error"
                    ? "Request failed"
                    : currentResponse
                      ? `${currentResponse.status} ${currentResponse.statusText}`
                      : "No response"}
                </h2>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {currentResponse && responseState.kind !== "error" && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      className="ghost-button" 
                      onClick={() => {
                        const blob = new Blob([currentResponse.bodyText || ''], { type: currentResponse.contentType || 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `response_${currentResponse.status}.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                    >
                      <Download size={12} /> Download
                    </button>
                    <button 
                      className="ghost-button" 
                      onClick={() => {
                        navigator.clipboard.writeText(currentResponse.bodyText || '');
                        alert('Response body copied to clipboard!');
                      }}
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                    >
                      <span style={{ fontSize: '10px' }}>📋</span> Copy
                    </button>
                  </div>
                )}
                {currentResponse && responseState.kind !== "error" && responseTab === 'preview' && (
                  <select 
                    value={previewMode} 
                    onChange={(e) => setPreviewMode(e.target.value as any)}
                    style={{ 
                      fontSize: '12px', 
                      padding: '2px 6px', 
                      borderRadius: '4px', 
                      backgroundColor: 'var(--color-surface-muted)', 
                      color: 'var(--color-text)', 
                      border: '1px solid var(--color-border)',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="rendered">Rendered</option>
                    <option value="json">JSON</option>
                    <option value="xml">XML</option>
                    <option value="html">HTML</option>
                    <option value="raw">Raw</option>
                  </select>
                )}
                {currentResponse && responseState.kind !== "error" && (
                  <div className="response-stats">
                    <span>
                      <Clock3 size={14} />
                      {currentResponse.durationMs} ms
                    </span>
                    <span>{formatBytes(currentResponse.sizeBytes)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="response-tabs" style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--color-border)', marginBottom: '16px' }}>
              {(['preview', 'headers', 'timeline'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setResponseTab(tab)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    backgroundColor: responseTab === tab ? 'var(--color-surface)' : 'transparent',
                    color: responseTab === tab ? 'var(--color-text)' : 'var(--color-text-muted)',
                    border: 'none',
                    borderBottom: responseTab === tab ? '2px solid var(--color-accent)' : '2px solid transparent',
                    borderRadius: '4px 4px 0 0',
                    transition: 'all 0.2s'
                  }}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {responseState.kind === "success" && (
              <div className="response-banner success">Response received from the native HTTP engine.</div>
            )}
            {responseState.kind === "error" && (
              <div className="response-banner error">{responseState.message}</div>
            )}

            {responseState.kind === "error" ? (
              <pre className="response-body">{'// No response — see error above.'}</pre>
            ) : currentResponse ? (
              <div className="response-body-container">
                {responseTab === 'preview' && (
                  <>
                    {previewMode === 'rendered' ? (
                      <div 
                        className="response-body rendered" 
                        dangerouslySetInnerHTML={{ __html: currentResponse.bodyText || '' }} 
                      />
                    ) : (
                      <ResponseViewer 
                        value={currentResponse.bodyText ?? (currentResponse.bodyBase64 ? `[binary response base64]\n${currentResponse.bodyBase64}` : "// Empty response body")}
                        contentType={currentResponse.contentType ?? "text/plain"}
                        height="100%"
                      />
                    )}
                  </>
                )}
                {responseTab === 'headers' && (
                  <div className="response-body" style={{ 
                    display: 'grid', 
                    gap: '8px', 
                    fontSize: '13px', 
                    color: 'var(--color-text)'
                  }}>
                    {currentResponse.headers.map((h, i) => (
                      <div key={i} style={{ 
                        display: 'flex', 
                        gap: '12px', 
                        borderBottom: '1px solid var(--color-border)', 
                        paddingBottom: '6px',
                        paddingTop: '4px'
                      }}>
                        <span style={{ 
                          fontWeight: 600, 
                          color: 'var(--color-text-muted)', 
                          minWidth: '140px',
                          flexShrink: 0
                        }}>{h.key}:</span>
                        <span style={{ 
                          color: 'var(--color-text)', 
                          wordBreak: 'break-all' 
                        }}>{h.value}</span>
                      </div>
                    ))}
                  </div>
                )}
                {responseTab === 'timeline' && (
                  <div className="response-body" style={{ 
                    fontSize: '13px', 
                    color: 'var(--color-text)',
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '12px' 
                  }}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      padding: '8px 12px',
                      backgroundColor: 'var(--color-surface-muted)',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border)'
                    }}>
                      <span>Total Duration:</span>
                      <span style={{ fontWeight: 600, color: 'var(--color-accent)' }}>{currentResponse.durationMs} ms</span>
                    </div>
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '4px'
                    }}>
                      {[
                        { label: 'DNS Lookup', value: currentResponse.dnsMs },
                        { label: 'TCP Connection', value: currentResponse.connectMs },
                        { label: 'TLS Handshake', value: currentResponse.tlsMs },
                        { label: 'Request/Response', value: currentResponse.requestMs },
                      ].map(item => (
                        <div key={item.label} style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          padding: '4px 0'
                        }}>
                          <span style={{ color: 'var(--color-text-muted)' }}>{item.label}</span>
                          <span style={{ fontWeight: 500 }}>{item.value} ms</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <pre className="response-body">{'// Send a request to see a response.'}</pre>
            )}
            </div>
          </section>
        </div>
      </section>

      {confirmDialog && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Confirm action" onClick={() => setConfirmDialog(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <p className="modal-message">{confirmDialog.message}</p>
            <div className="modal-actions">
              <button
                className="modal-cancel"
                type="button"
                onClick={() => setConfirmDialog(null)}
              >
                Cancel
              </button>
              <button
                className="modal-confirm"
                type="button"
                onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

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
                  const canReplay = workspace.requests.some(r => r.id === entry.requestId);
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
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{ width: '560px', maxWidth: '95vw', display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '16px' }}>App settings</h2>
              <button type="button" onClick={() => setSettingsOpen(false)} style={{ all: 'unset', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', fontSize: '13px', color: 'var(--color-text)' }}>
              <span>Update checks after launch</span>
              <input
                type="checkbox"
                checked={appSettings.updateChecksEnabled}
                onChange={e => updateAppSettings({ updateChecksEnabled: e.target.checked })}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'var(--color-text)' }}>
              <span>Theme</span>
              <select
                value={appSettings.theme}
                onChange={e => updateAppSettings({ theme: e.target.value as AppSettings["theme"] })}
                style={{ minHeight: '38px', border: '1px solid var(--color-border)', borderRadius: '6px', background: 'var(--color-surface)', color: 'var(--color-text)', padding: '0 10px' }}
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>

            <div style={{ display: 'grid', gap: '6px' }}>
              <span style={{ fontSize: '13px', color: 'var(--color-text)' }}>Data location</span>
              <code style={{ padding: '10px 12px', borderRadius: '6px', background: 'var(--color-surface-muted)', color: 'var(--color-text)', border: '1px solid var(--color-border)', wordBreak: 'break-all' }}>
                {databasePath}
              </code>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', fontSize: '13px', color: 'var(--color-text)' }}>
              <span>Export redaction</span>
              <input
                type="checkbox"
                checked={appSettings.exportRedactionEnabled}
                onChange={e => updateAppSettings({ exportRedactionEnabled: e.target.checked })}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', fontSize: '13px', color: 'var(--color-text)' }}>
              <span>Diagnostics redaction</span>
              <input
                type="checkbox"
                checked={appSettings.diagnosticsRedactionEnabled}
                onChange={e => updateAppSettings({ diagnosticsRedactionEnabled: e.target.checked })}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'var(--color-text)' }}>
              <span>Offline behavior</span>
              <select
                value={appSettings.offlineBehavior}
                onChange={e => updateAppSettings({ offlineBehavior: e.target.value as AppSettings["offlineBehavior"] })}
                style={{ minHeight: '38px', border: '1px solid var(--color-border)', borderRadius: '6px', background: 'var(--color-surface)', color: 'var(--color-text)', padding: '0 10px' }}
              >
                <option value="silent">Stay quiet when offline</option>
                <option value="notice">Show a notice when update checks fail</option>
              </select>
            </label>

            <div style={{ display: 'grid', gap: '12px', padding: '12px', borderRadius: '6px', backgroundColor: 'var(--color-surface-muted)', border: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>Network Defaults</span>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', fontSize: '13px', color: 'var(--color-text)' }}>
                <span>Default Timeout (ms)</span>
                <input
                  type="number"
                  value={appSettings.timeoutMs}
                  onChange={(e) => updateAppSettings({ timeoutMs: parseInt(e.target.value) || 30000 })}
                  style={{ width: '80px', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '4px' }}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', fontSize: '13px', color: 'var(--color-text)' }}>
                <span>Default Follow Redirects</span>
                <input
                  type="checkbox"
                  checked={appSettings.followRedirects}
                  onChange={e => updateAppSettings({ followRedirects: e.target.checked })}
                />
              </label>
            </div>

            <div style={{ padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: '6px', background: 'var(--color-surface-muted)', color: 'var(--color-muted)', fontSize: '12px', lineHeight: 1.5 }}>
              {updateStatus.lastCheckedLabel}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
              <button
                type="button"
                className="ghost-button"
                onClick={() => void handleCheckForUpdates("manual")}
              >
                <RefreshCw size={14} />
                Check now
              </button>
              <div style={{ display: 'flex', gap: '10px' }}>
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

      {updateDialogOpen && availableUpdate && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Update available"
          onClick={() => {
            if (!updateBusy) setUpdateDialogOpen(false);
          }}
        >
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{ width: '560px', maxWidth: '95vw', display: 'flex', flexDirection: 'column', gap: '14px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '16px' }}>Update available</h2>
              <button
                type="button"
                onClick={() => setUpdateDialogOpen(false)}
                disabled={updateBusy}
                style={{ all: 'unset', cursor: updateBusy ? 'not-allowed' : 'pointer', opacity: updateBusy ? 0.4 : 1 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gap: '6px', fontSize: '13px', color: 'var(--color-text)' }}>
              <div>Current version: <strong>{availableUpdate.currentVersion}</strong></div>
              <div>New version: <strong>{availableUpdate.version}</strong></div>
              {availableUpdate.date ? <div>Published: <strong>{formatTimestamp(availableUpdate.date)}</strong></div> : null}
            </div>

            <div style={{ padding: '10px 12px', borderRadius: '6px', background: 'var(--color-surface-muted)', border: '1px solid var(--color-border)', color: 'var(--color-text)', fontSize: '12px', lineHeight: 1.5 }}>
              Signed release metadata is verified by the Tauri updater plugin before install.
            </div>

            {availableUpdate.body ? (
              <pre className="response-body" style={{ minHeight: '120px', maxHeight: '220px' }}>
                {availableUpdate.body}
              </pre>
            ) : null}

            <div style={{ padding: '10px 12px', borderRadius: '6px', background: 'var(--color-surface-muted)', border: '1px solid var(--color-border)', color: 'var(--color-muted)', fontSize: '12px', lineHeight: 1.5 }}>
              {updateProgressLabel}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="modal-cancel"
                type="button"
                disabled={updateBusy}
                onClick={() => setUpdateDialogOpen(false)}
              >
                Later
              </button>
              <button
                className="modal-confirm"
                type="button"
                disabled={updateBusy}
                onClick={() => void handleInstallUpdate()}
              >
                {updateBusy ? "Installing update" : "Install update"}
              </button>
            </div>
          </div>
        </div>
      )}

      {envEditorOpen && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Environment editor"
          onClick={() => setEnvEditorOpen(false)}
        >
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{ width: '680px', maxWidth: '95vw', maxHeight: '80vh', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '15px' }}>Environments</h2>
              <button type="button" onClick={() => setEnvEditorOpen(false)} style={{ all: 'unset', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0 }}>
              {/* Environment list */}
              <div style={{ width: '170px', flexShrink: 0 }}>
                <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', opacity: 0.5, marginBottom: '6px' }}>Environments</div>
                {workspace.environments.map(env => (
                  <div
                    key={env.name}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}
                  >
                    <button
                      type="button"
                      onClick={() => setEnvEditorTarget(env.name)}
                      style={{
                        all: 'unset',
                        flex: 1,
                        padding: '5px 8px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        backgroundColor: envEditorTarget === env.name ? 'var(--color-surface-hover)' : 'transparent',
                        fontWeight: workspace.activeEnvironment === env.name ? 700 : 400,
                      }}
                    >
                      {env.name}
                      {workspace.activeEnvironment === env.name && (
                        <span style={{ fontSize: '9px', marginLeft: '4px', opacity: 0.5 }}>●</span>
                      )}
                    </button>
                    <button type="button" aria-label={`Rename ${env.name}`} onClick={() => handleRenameEnvironment(env.name)} style={{ all: 'unset', cursor: 'pointer', opacity: 0.5 }}><Edit2 size={11} /></button>
                    <button type="button" aria-label={`Delete ${env.name}`} onClick={() => handleDeleteEnvironment(env.name)} style={{ all: 'unset', cursor: 'pointer', opacity: 0.5 }}><Trash2 size={11} /></button>
                  </div>
                ))}
                <button
                  type="button"
                  className="ghost-button"
                  onClick={handleCreateEnvironment}
                  style={{ width: '100%', marginTop: '8px', fontSize: '12px' }}
                >
                  <Plus size={12} /> New
                </button>
                {envEditorTarget && workspace.activeEnvironment !== envEditorTarget && (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => handleSetActiveEnvironment(envEditorTarget)}
                    style={{ width: '100%', marginTop: '4px', fontSize: '12px' }}
                  >
                    Set active
                  </button>
                )}
              </div>

              {/* Variable editor */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {envEditorTarget ? (() => {
                  const env = workspace.environments.find(e => e.name === envEditorTarget);
                  if (!env) return null;
                  return (
                    <>
                      <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', opacity: 0.5, marginBottom: '6px' }}>
                        Variables — {env.name}
                      </div>
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'visible' }}>
                        {env.variables.map(v => (
                          <div key={v.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', borderBottom: '1px solid var(--color-border)' }}>
                            <span style={{ flex: '0 0 140px', fontSize: '12px', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.key}</span>
                            <span style={{ flex: 1, fontSize: '12px', fontFamily: 'monospace', opacity: v.secret ? 0.5 : 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {v.secret ? '[secret stored outside SQLite]' : v.value}
                            </span>
                            <span style={{ fontSize: '10px', opacity: 0.4 }}>{v.secret ? 'secret' : ''}</span>
                            <button type="button" aria-label={`Delete variable ${v.key}`} onClick={() => handleDeleteVariable(env.name, v.key)} style={{ all: 'unset', cursor: 'pointer', opacity: 0.5 }}><Trash2 size={12} /></button>
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
                  <p style={{ opacity: 0.5, fontSize: '13px' }}>Select an environment to edit its variables.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {folderScriptsOpen && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Folder scripts"
          onClick={() => setFolderScriptsOpen(false)}
        >
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{ width: '560px', maxWidth: '95vw', display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '16px' }}>Folder Scripts</h2>
              <button type="button" onClick={() => setFolderScriptsOpen(false)} style={{ all: 'unset', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-text-active)' }} />
                  Pre-request Script
                </label>
                <ScriptEditor 
                  value={folderPreScript}
                  onChange={setFolderPreScript}
                  variables={activeVars.map(v => v.key)}
                  placeholder="// JavaScript only (no TypeScript types) to run before any request in this folder"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-text-active)' }} />
                  Post-request Script
                </label>
                <ScriptEditor 
                  value={folderPostScript}
                  onChange={setFolderPostScript}
                  variables={activeVars.map(v => v.key)}
                  placeholder="// JavaScript only (no TypeScript types) to run after any request in this folder"
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="modal-cancel" type="button" onClick={() => setFolderScriptsOpen(false)}>
                Cancel
              </button>
              <button className="modal-confirm" type="button" onClick={handleSaveFolderScripts}>
                Save Scripts
              </button>
            </div>
          </div>
        </div>
      )}

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
                  if (reqId) startRequestRename(workspace.requests.find(r => r.id === reqId)!);
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
