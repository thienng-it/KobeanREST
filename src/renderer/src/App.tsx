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
import { useDeferredValue, useEffect, useRef, useState, useTransition, type ClipboardEvent, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { PRODUCT_AUTHENTICATION_MODEL, PRODUCT_DOCS_URL } from "./product-contract";
import { executeHttpRequest } from "./services/http-client";
import { resolveRequestVariables, UnresolvedVariableError, activeEnvironmentVariables, buildVariableMap, resolveString } from "./services/variables";
import { VariableInput, VariableTextarea } from "./components/VariableInput";
import { MethodSelector, methodClass, resolvedMethodLabel } from "./components/MethodSelector";
import { ScriptEditor } from "./components/ScriptEditor";
import { ResponseViewer } from "./components/ResponseViewer";
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
import type { ApiAuthMode, AuthConfig, AppSettings, ExecuteHttpResponse, HistoryEntry, SavedRequest, UpdateStatus, WorkspaceSummary } from "./types";

type RequestHeader = SavedRequest["headers"][number];

const HEADER_PRESET_MENU_GAP = 6;
const HEADER_PRESET_MENU_PADDING = 16;
const HEADER_PRESET_MENU_MIN_WIDTH = 212;
const HEADER_PRESET_MENU_MIN_HEIGHT = 120;
const HEADER_PRESET_MENU_MAX_HEIGHT = 280;

const commonHeaderPresets = [
  { label: "Accept", key: "Accept", value: "application/json" },
  { label: "Content-Type", key: "Content-Type", value: "application/json" },
  { label: "Authorization", key: "Authorization", value: "Bearer " },
  { label: "X-Request-Id", key: "X-Request-Id", value: "" },
];

const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_DEFAULT_WIDTH = 280;
const SIDEBAR_MAX_WIDTH = 460;

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

function createBlankHeader(): RequestHeader {
  return { key: "", value: "", enabled: true };
}

interface HeaderPresetMenuLayout {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  placement: "top" | "bottom";
}

function getHeaderPresetMenuLayout(
  triggerRect: Pick<DOMRect, "top" | "bottom" | "left" | "right" | "width">,
  menuHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): HeaderPresetMenuLayout {
  const width = Math.max(Math.round(triggerRect.width), HEADER_PRESET_MENU_MIN_WIDTH);
  const left = Math.min(
    Math.max(HEADER_PRESET_MENU_PADDING, Math.round(triggerRect.right - width)),
    Math.max(HEADER_PRESET_MENU_PADDING, viewportWidth - width - HEADER_PRESET_MENU_PADDING),
  );
  const availableBelow = Math.max(viewportHeight - triggerRect.bottom - HEADER_PRESET_MENU_PADDING, 0);
  const availableAbove = Math.max(triggerRect.top - HEADER_PRESET_MENU_PADDING, 0);
  const placement =
    availableBelow < Math.min(menuHeight, 220) && availableAbove > availableBelow
      ? "top"
      : "bottom";
  const availableSpace = placement === "top" ? availableAbove : availableBelow;
  const maxHeight = Math.max(
    HEADER_PRESET_MENU_MIN_HEIGHT,
    Math.min(HEADER_PRESET_MENU_MAX_HEIGHT, Math.floor(availableSpace)),
  );
  const renderedHeight = Math.min(menuHeight, maxHeight);
  const top =
    placement === "top"
      ? Math.max(HEADER_PRESET_MENU_PADDING, Math.round(triggerRect.top - HEADER_PRESET_MENU_GAP - renderedHeight))
      : Math.min(
          Math.round(triggerRect.bottom + HEADER_PRESET_MENU_GAP),
          Math.max(HEADER_PRESET_MENU_PADDING, viewportHeight - HEADER_PRESET_MENU_PADDING - renderedHeight),
        );

  return { left, top, width, maxHeight, placement };
}

function parsePastedHeaders(text: string): RequestHeader[] {
  const parsed: RequestHeader[] = [];

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const separatorIndex = trimmed.indexOf(":");
    if (separatorIndex <= 0) continue;

    parsed.push({
      key: trimmed.slice(0, separatorIndex).trim(),
      value: trimmed.slice(separatorIndex + 1).trim(),
      enabled: true,
    });
  }

  return parsed;
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

function describeAuthTarget(mode: ApiAuthMode, config: AuthConfig): string {
  switch (mode) {
    case "basic":
      return config.username || config.password ? "Authorization header" : "Username or password missing";
    case "bearer":
      return config.token ? "Authorization: Bearer [hidden]" : "Token missing";
    case "oauth2":
      if (config.token) return "Authorization: Bearer [hidden]";
      return config.accessTokenUrl ? "Token requested before send" : "Access token missing";
    case "apiKey":
      if (!config.keyName) return "Key name missing";
      if (!config.keyValue) return `${config.keyName} value missing`;
      return config.placement === "query" ? `Query param: ${config.keyName}` : `Header: ${config.keyName}`;
    case "ntlm":
    case "kerberos":
      return "Not applied by sender yet";
    default:
      return "No auth will be sent";
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
  const [previewMode, setPreviewMode] = useState<'rendered' | 'xml' | 'html' | 'json' | 'raw'>('rendered');
  const [responseTab, setResponseTab] = useState<'preview' | 'headers' | 'timeline' | 'download' | 'copy'>('preview');
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
  const [headersPresetMenuLayout, setHeadersPresetMenuLayout] = useState<HeaderPresetMenuLayout | null>(null);
  const scriptEditorActionsRef = useRef<{ insertText: (text: string) => void } | null>(null);

  const [authEditorOpen, setAuthEditorOpen] = useState(false);
  const [authEditorTarget, setAuthEditorTarget] = useState<{ id: string; type: 'collection' | 'folder' } | null>(null);
  const [authDraft, setAuthDraft] = useState<{ mode: ApiAuthMode; config: AuthConfig }>({ mode: 'none', config: {} });
  const headersPresetMenuRef = useRef<HTMLDivElement | null>(null);
  const headersPresetTriggerRef = useRef<HTMLButtonElement | null>(null);
  const headersPresetDropdownRef = useRef<HTMLDivElement | null>(null);

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
    if (!headersPresetMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (headersPresetMenuRef.current?.contains(target) || headersPresetDropdownRef.current?.contains(target)) {
        return;
      }
      setHeadersPresetMenuOpen(false);
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [headersPresetMenuOpen]);

  useEffect(() => {
    if (!headersPresetMenuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setHeadersPresetMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [headersPresetMenuOpen]);

  useEffect(() => {
    if (!headersPresetMenuOpen) return;

    const updateLayout = () => {
      if (!headersPresetTriggerRef.current) return;
      const triggerRect = headersPresetTriggerRef.current.getBoundingClientRect();
      const menuHeight = headersPresetDropdownRef.current?.scrollHeight ?? 220;
      setHeadersPresetMenuLayout(
        getHeaderPresetMenuLayout(triggerRect, menuHeight, window.innerWidth, window.innerHeight),
      );
    };

    updateLayout();
    const frame = window.requestAnimationFrame(updateLayout);
    window.addEventListener("resize", updateLayout);
    window.addEventListener("scroll", updateLayout, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateLayout);
      window.removeEventListener("scroll", updateLayout, true);
    };
  }, [headersPresetMenuOpen]);

  useEffect(() => {
    if (!headersPresetMenuOpen) {
      setHeadersPresetMenuLayout(null);
    }
  }, [headersPresetMenuOpen]);

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
  const scriptRuntimeTokens = activeRequestScript === "pre"
    ? ["request", "variables"]
    : ["request", "response", "variables"];
  const scriptVariableTokens = activeVars.map((variable) => `{{${variable.key}}}`);
  const currentScriptValue = activeRequestScript === "pre" ? preScript : postScript;
  const currentScriptTitle = activeRequestScript === "pre" ? "Pre-request Script" : "Post-request Script";
  const requestFolder = draftRequest
    ? workspace.folders.find((folder) => folder.id === draftRequest.folderId) ?? null
    : null;
  const requestPath = requestFolder && draftRequest ? `${requestFolder.name} / ${draftRequest.name}` : draftRequest?.name ?? "";
  const deferredCollectionSearch = useDeferredValue(collectionSearch);
  const normalizedCollectionSearch = deferredCollectionSearch.trim().toLowerCase();
  const isCollectionSearchActive = normalizedCollectionSearch.length > 0;

  function matchesCollectionSearch(value: string | undefined) {
    return !isCollectionSearchActive || value?.toLowerCase().includes(normalizedCollectionSearch);
  }

  function requestMatchesCollectionSearch(request: SavedRequest) {
    return (
      matchesCollectionSearch(request.name) ||
      matchesCollectionSearch(request.url) ||
      matchesCollectionSearch(resolvedMethodLabel(request.method, request.customMethod))
    );
  }

  function folderMatchesCollectionSearch(folderId: string): boolean {
    const folder = workspace?.folders.find((item) => item.id === folderId);
    if (!folder) return false;
    if (matchesCollectionSearch(folder.name)) return true;
    if (workspace?.requests.some((request) => request.folderId === folderId && requestMatchesCollectionSearch(request))) return true;
    return workspace?.folders.some((child) => child.parentId === folderId && folderMatchesCollectionSearch(child.id));
  }

  const visibleCollections = (workspace?.collections ?? []).filter((collection) => {
    if (matchesCollectionSearch(collection.name)) return true;
    return workspace?.folders.some((folder) => folder.collectionId === collection.id && folderMatchesCollectionSearch(folder.id));
  });
  const effectiveAuth = draftRequest ? getEffectiveAuth(draftRequest, workspace) : null;

  function updateDraft(fields: Partial<SavedRequest>) {
    if (draftRequest) {
      setDraftRequest({ ...draftRequest, ...fields });
    }
  }

  function updateHeaderField(index: number, field: "key" | "value", value: string) {
    if (!draftRequest) return;
    const headers = [...draftRequest.headers];
    headers[index] = { ...headers[index], [field]: value };
    updateDraft({ headers });
  }

  function toggleHeaderEnabled(index: number, enabled: boolean) {
    if (!draftRequest) return;
    const headers = [...draftRequest.headers];
    headers[index] = { ...headers[index], enabled };
    updateDraft({ headers });
  }

  function removeHeader(index: number) {
    if (!draftRequest) return;
    updateDraft({ headers: draftRequest.headers.filter((_, headerIndex) => headerIndex !== index) });
  }

  function addHeader(nextHeader: RequestHeader = createBlankHeader()) {
    if (!draftRequest) return;
    updateDraft({ headers: [...draftRequest.headers, nextHeader] });
  }

  function insertCommonHeader(key: string, value: string) {
    addHeader({ key, value, enabled: true });
    setHeadersPresetMenuOpen(false);
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

  function handleHeaderPaste(index: number, event: ClipboardEvent<HTMLInputElement>) {
    if (!draftRequest) return;

    const text = event.clipboardData.getData("text");
    if (!text) return;

    const parsedHeaders = parsePastedHeaders(text);
    const looksLikeStructuredPaste =
      parsedHeaders.length > 1 ||
      (parsedHeaders.length === 1 &&
        (text.includes("\n") ||
          (draftRequest.headers[index].key.trim() === "" && draftRequest.headers[index].value.trim() === "")));

    if (!looksLikeStructuredPaste || parsedHeaders.length === 0) {
      return;
    }

    event.preventDefault();

    const headers = [...draftRequest.headers];
    headers[index] = parsedHeaders[0];
    if (parsedHeaders.length > 1) {
      headers.splice(index + 1, 0, ...parsedHeaders.slice(1));
    }
    updateDraft({ headers });
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
        setWorkspace((prev) => ({
          ...prev,
          folders: prev.folders.map((folder) =>
            folder.id === target.id ? { ...folder, name: nextName } : folder,
          ),
        }));
      } else {
        await updateCollection(target.id, nextName);
        setWorkspace((prev) => ({
          ...prev,
          collections: prev.collections?.map((collection) =>
            collection.id === target.id ? { ...collection, name: nextName } : collection,
          ) ?? [],
        }));
      }
      cancelSidebarRename();
    } catch (err) {
      console.error("Failed to rename sidebar item", diagnosticMessage(err));
      alert("Failed to rename: " + diagnosticMessage(err));
    }
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

  function handleResponseTabChange(tab: typeof responseTab) {
    if (tab === responseTab) return;
    startResponseTabTransition(() => setResponseTab(tab));
  }

  function renderResponseBody() {
    if (responseState.kind === "error") {
      return <pre className="response-body">{'// No response — see error above.'}</pre>;
    }

    if (!currentResponse) {
      return <pre className="response-body">{'// Send a request to see a response.'}</pre>;
    }

    return (
      <div
        className={isResponseTabPending ? "response-body-container transitioning" : "response-body-container"}
        aria-busy={isResponseTabPending}
      >
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
    );
  }

  function renderResponsePanel({ modal }: { modal: boolean }) {
    const shell = (
      <div className={modal ? "response-viewer response-viewer-window" : "response-viewer"}>
        <div className="panel-heading">
          <div>
            <span className="muted-label">Response</span>
            <h2 style={{ color: responseTitleColor }}>
              {responseTitle}
            </h2>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {!modal && (
              <button
                className="ghost-button"
                type="button"
                onClick={() => setResponseWindowOpen(true)}
                style={{ padding: '4px 8px', fontSize: '11px' }}
              >
                <Eye size={12} /> Open in Window
              </button>
            )}
            {currentResponse && responseState.kind !== "error" && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={downloadCurrentResponse}
                  style={{ padding: '4px 8px', fontSize: '11px' }}
                >
                  <Download size={12} /> Download
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => void copyCurrentResponse()}
                  style={{ padding: '4px 8px', fontSize: '11px' }}
                >
                  <span style={{ fontSize: '10px' }}>📋</span> Copy
                </button>
              </div>
            )}
            {currentResponse && responseState.kind !== "error" && responseTab === 'preview' && (
              <select
                value={previewMode}
                onChange={(e) => setPreviewMode(e.target.value as typeof previewMode)}
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

        <div className="response-tabs">
          {(['preview', 'headers', 'timeline'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => handleResponseTabChange(tab)}
              className={responseTab === tab ? 'response-tab active' : 'response-tab'}
              type="button"
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

        {renderResponseBody()}
      </div>
    );

    if (modal) {
      return <div className="response-window-shell" aria-label="Response window">{shell}</div>;
    }

    return (
      <section
        className={activeBottomDock === 'response' ? "response-layout" : "response-layout hidden"}
        aria-label="Response"
      >
        <button
          className="response-panel-resizer"
          type="button"
          aria-label="Resize response panel"
          onMouseDown={handleResponsePanelResizerMouseDown}
        />
        {shell}
      </section>
    );
  }

  function renderBottomDock() {
    return (
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
          {renderResponsePanel({ modal: false })}
        </div>
      </section>
    );
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
    const name = "New Folder";
    try {
      const targetCollectionId = collectionId ?? workspace.collections?.[0]?.id;
      const newFolder = await createFolder(name, targetCollectionId, parentId);
      setWorkspace(prev => ({
        ...prev,
        folders: [...prev.folders, newFolder]
      }));
    } catch (err) {
      console.error("Failed to create folder", diagnosticMessage(err));
      alert("Failed to create folder: " + diagnosticMessage(err));
    }
  }

  async function handleCreateCollection() {
    const name = "New Collection";
    try {
      const collectionId = await createCollection(name);
      setWorkspace(prev => ({
        ...prev,
        collections: [...(prev.collections ?? []), { id: collectionId, name }]
      }));
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

  async function confirmDeleteCollection(collectionId: string) {
    setDeleteError(null);
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
      setWorkspace((prev) => ({
        ...prev,
        collections: prev.collections?.filter((collection) => collection.id !== collectionId) ?? [],
        folders: prev.folders.filter((folder) => folder.collectionId !== collectionId),
        requests: prev.requests.filter((request) => !folderIds.has(request.folderId)),
      }));
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
      setWorkspace(prev => ({ ...prev, activeEnvironment: name }));
    } catch (err) {
      console.error("Failed to set active environment", diagnosticMessage(err));
    }
  }

  async function handleCreateEnvironment() {
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

    if (workspace.environments.some((environment) => environment.name === newName && environment.name !== oldName)) {
      alert(`Environment "${newName}" already exists.`);
      return;
    }

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
            const environments = prev.environments.filter(e => e.name !== name);
            return {
              ...prev,
              activeEnvironment: prev.activeEnvironment === name ? environments[0]?.name ?? "" : prev.activeEnvironment,
              environments,
            };
          });
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
    setActiveBottomDock('response');
    
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
      <aside className="sidebar" aria-label="Workspace navigation">
        <div className="brand-row">
          <div className="brand-mark">KR</div>
          <div className="brand-copy">
            <strong>KobeanREST</strong>
            <span>{PRODUCT_AUTHENTICATION_MODEL.headline}</span>
          </div>
        </div>

        <div
          className="sidebar-content"
        >
        <div className="environment-switcher">
          <Globe size={15} className="environment-switcher-icon" />
          <select
            className="environment-select"
            aria-label="Active environment"
            value={workspace?.activeEnvironment || ""}
            onChange={e => handleSetActiveEnvironment(e.target.value)}
          >
            {workspace?.environments?.map(env => (
              <option key={env.name} value={env.name}>{env.name}</option>
            ))}
          </select>
          <button
            type="button"
            className="environment-manage-button"
            aria-label="Manage environments"
            onClick={() => { setEnvEditorTarget(workspace?.activeEnvironment); setEnvEditorOpen(true); }}
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
          <button className="primary-action" type="button" onClick={handleCreateCollection} style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}>
            <Plus size={16} />
            New collection
          </button>
        </div>

        <label className={collectionSearch ? "search-field has-value" : "search-field"}>
          <Search size={15} />
          <input
            placeholder="Search collections, folders, requests"
            aria-label="Search collections"
            value={collectionSearch}
            onChange={(event) => setCollectionSearch(event.target.value)}
          />
          {collectionSearch && (
            <button
              type="button"
              className="search-clear-button"
              aria-label="Clear collection search"
              onClick={() => setCollectionSearch("")}
            >
              <X size={13} />
            </button>
          )}
        </label>
        {isCollectionSearchActive && (
          <div className="search-status" role="status">
            {visibleCollections.length === 0 ? "No matches" : `${visibleCollections.length} collection${visibleCollections.length === 1 ? "" : "s"} found`}
          </div>
        )}

        <section className="nav-section">
          <h2>
            <FolderTree size={15} />
            Collections
          </h2>
          {visibleCollections.map(collection => (
            <div className="collection-group" key={collection.id} style={{ marginBottom: '20px' }}>
              <div className="folder-title sidebar-tree-row collection-title">
                {renamingSidebarItem?.type === "collection" && renamingSidebarItem.id === collection.id ? (
                  <input
                    value={sidebarNameDraft}
                    aria-label={`Rename collection ${collection.name}`}
                    autoFocus
                    onChange={(event) => setSidebarNameDraft(event.target.value)}
                    onBlur={() => void applySidebarRename()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        event.currentTarget.blur();
                      } else if (event.key === "Escape") {
                        event.preventDefault();
                        cancelSidebarRename();
                      }
                    }}
                    style={{ flex: 1, minWidth: 0, border: '1px solid var(--color-border-tint)', borderRadius: '6px', background: 'var(--color-surface)', color: 'var(--color-text)', padding: '4px 8px', fontWeight: 700 }}
                  />
                ) : (
                  <strong onDoubleClick={() => startSidebarRename("collection", collection.id, collection.name)}>{collection.name}</strong>
                )}
                <div className="sidebar-row-actions">
                  <button
                    type="button"
                    className="sidebar-icon-button"
                    aria-label={`Rename collection ${collection.name}`}
                    onClick={() => startSidebarRename("collection", collection.id, collection.name)}
                  >
                    <Edit2 size={12} />
                  </button>
		                  <button 
		                    type="button" 
		                    className="sidebar-icon-button"
		                    aria-label={`New folder in ${collection.name}`} 
		                    onClick={() => void handleCreateFolder(collection.id)} 
		                  >
		                    <Plus size={12} />
		                  </button>
		                  <button
		                    type="button"
		                    className="sidebar-icon-button danger"
		                    aria-label={`Delete collection ${collection.name}`}
		                    onClick={() => void handleDeleteCollection(collection.id)}
		                  >
		                    <Trash2 size={12} />
		                  </button>
	                </div>
	              </div>
              
	              {(() => {
	                const collectionNameMatches = matchesCollectionSearch(collection.name);
	                const renderFolders = (parentId: string | undefined, depth = 0, forceShowAll = false) => {
	                  const folders = workspace.folders
	                    .filter(f => (parentId === undefined ? f.collectionId === collection.id && !f.parentId : f.parentId === parentId))
	                    .filter(f => forceShowAll || folderMatchesCollectionSearch(f.id));

                  if (folders.length === 0) return null;

                  return (
                    <div style={{ paddingLeft: `${depth * 12}px` }}>
	                      {folders.map(folder => {
	                        const folderNameMatches = matchesCollectionSearch(folder.name);
	                        const showFolderContents = forceShowAll || folderNameMatches;
	                        const isFolderCollapsed = !isCollectionSearchActive && collapsedFolders[folder.id];
	                        const folderRequests = workspace.requests
	                          .filter(r => r.folderId === folder.id)
	                          .filter(r => showFolderContents || requestMatchesCollectionSearch(r));
                        return (
                          <div className="folder-group" key={folder.id}>
	                            <div className="folder-title sidebar-tree-row"
                                  onContextMenu={e => {
                                    e.preventDefault();
                                    setContextMenu({ x: e.clientX, y: e.clientY, target: { id: folder.id, type: 'folder' } });
                                  }}
	                            >
		                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
			                                <button
			                                  type="button"
				                                  aria-expanded={!isFolderCollapsed}
			                                  onClick={() => toggleFolder(folder.id)}
			                                  className="folder-toggle-button"
			                                >
			                                  <ChevronDown
			                                    size={14}
			                                    className={isFolderCollapsed ? "folder-chevron collapsed" : "folder-chevron"}
			                                  />
			                                </button>
		                                {renamingSidebarItem?.type === "folder" && renamingSidebarItem.id === folder.id ? (
		                                  <input
		                                    value={sidebarNameDraft}
		                                    aria-label={`Rename folder ${folder.name}`}
		                                    autoFocus
		                                    onChange={(event) => setSidebarNameDraft(event.target.value)}
		                                    onBlur={() => void applySidebarRename()}
		                                    onKeyDown={(event) => {
		                                      if (event.key === "Enter") {
		                                        event.preventDefault();
		                                        event.currentTarget.blur();
		                                      } else if (event.key === "Escape") {
		                                        event.preventDefault();
		                                        cancelSidebarRename();
		                                      }
		                                    }}
		                                    style={{ minWidth: 0, width: '120px', border: '1px solid var(--color-border-tint)', borderRadius: '6px', background: 'var(--color-surface)', color: 'var(--color-text)', padding: '4px 8px', fontWeight: 700 }}
		                                  />
		                                ) : (
		                                  <button
		                                    type="button"
		                                    onClick={() => toggleFolder(folder.id)}
		                                    onDoubleClick={(event) => {
		                                      event.stopPropagation();
		                                      startSidebarRename("folder", folder.id, folder.name);
		                                    }}
		                                    style={{ all: 'unset', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
		                                  >
		                                    {folder.name}
		                                    {scriptStatus[folder.id] && (
		                                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2563eb', marginLeft: '4px' }} title="Has scripts" />
		                                    )}
		                                  </button>
		                                )}
		                              </div>
		                              <div className="sidebar-row-actions">
		                              <button
		                                type="button"
		                                className="sidebar-icon-button"
		                                aria-label={`Rename folder ${folder.name}`}
		                                onClick={() => startSidebarRename("folder", folder.id, folder.name)}
		                              >
		                                <Edit2 size={12} />
		                              </button>
		                              <button
		                                type="button"
		                                className="sidebar-icon-button danger"
		                                aria-label={`Delete folder ${folder.name}`}
		                                onClick={() => void handleDeleteFolder(folder.id)}
		                              >
		                                <Trash2 size={12} />
		                              </button>
		                              </div>
		                            </div>
	                            <div
		                              className={isFolderCollapsed ? "folder-children collapsed" : "folder-children"}
		                              aria-hidden={isFolderCollapsed}
		                            >
		                              <div className="folder-children-inner">
		                                {renderFolders(folder.id, depth + 1, showFolderContents)}
	                                {folderRequests.map(request => (
	                                  <div key={request.id} className={request.id === selectedRequestId ? "request-row sidebar-tree-row active" : "request-row sidebar-tree-row"} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
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
	                                    <div className="sidebar-row-actions">
	                                      <button type="button" className="sidebar-icon-button" aria-label={`Rename ${request.name}`} onClick={() => startRequestRename(request)}>
	                                        <Edit2 size={12} />
	                                      </button>
	                                      <button type="button" className="sidebar-icon-button danger" aria-label="Delete request" onClick={() => handleDeleteRequest(request.id)}>
	                                        <Trash2 size={12} />
	                                      </button>
	                                    </div>
                                  </div>
	                                ))}
	                              </div>
	                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                };

	                return renderFolders(undefined, 0, collectionNameMatches);
	              })()}
            </div>
          ))}
        </section>
        </div>
      </aside>

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
                  <div className="headers-editor" aria-label="Request headers">
                    <div className="headers-table">
                      <div className="headers-table-toolbar">
                        <div className="headers-toolbar-actions">
                          <div className="headers-common-menu-wrap" ref={headersPresetMenuRef}>
                            <button
                              ref={headersPresetTriggerRef}
                              type="button"
                              className="ghost-button"
                              aria-label="Common header presets"
                              aria-haspopup="listbox"
                              aria-expanded={headersPresetMenuOpen}
                              onClick={() => setHeadersPresetMenuOpen((open) => !open)}
                            >
                              Common
                              <ChevronDown size={14} />
                            </button>
                            {headersPresetMenuOpen && createPortal(
                              <div
                                ref={headersPresetDropdownRef}
                                className="headers-common-menu"
                                role="listbox"
                                aria-label="Common header presets"
                                data-placement={headersPresetMenuLayout?.placement ?? "bottom"}
                                style={{
                                  top: headersPresetMenuLayout?.top ?? 0,
                                  left: headersPresetMenuLayout?.left ?? 0,
                                  width: headersPresetMenuLayout?.width,
                                  maxHeight: headersPresetMenuLayout?.maxHeight,
                                  visibility: headersPresetMenuLayout ? "visible" : "hidden",
                                }}
                              >
                                {commonHeaderPresets.map((preset) => (
                                  <button
                                    key={preset.label}
                                    type="button"
                                    className="headers-common-option"
                                    onClick={() => insertCommonHeader(preset.key, preset.value)}
                                  >
                                    <span>{preset.label}</span>
                                    <small>{preset.value || "Custom value"}</small>
                                  </button>
                                ))}
                              </div>,
                              document.body,
                            )}
                          </div>
                          <button
                            type="button"
                            className="ghost-button headers-add-button"
                            onClick={() => addHeader()}
                          >
                            <Plus size={14} /> Add Header
                          </button>
                        </div>
                      </div>

                      <div className="headers-grid-body">
                        <div className="headers-grid-header" aria-hidden="true">
                          <span>On</span>
                          <span>Key</span>
                          <span>Value</span>
                          <span>Actions</span>
                        </div>

                        <div className="headers-rows">
                          {draftRequest.headers.map((header, idx) => {
                            return (
                              <div className={header.enabled ? "headers-row" : "headers-row headers-row-disabled"} key={idx}>
                                <label className="headers-toggle">
                                  <input
                                    type="checkbox"
                                    checked={header.enabled}
                                    onChange={(e) => toggleHeaderEnabled(idx, e.target.checked)}
                                  />
                                </label>

                                <VariableInput
                                  activeVariables={activeVars}
                                  value={header.key}
                                  placeholder="Header key"
                                  onChange={(e) => updateHeaderField(idx, "key", e.target.value)}
                                  onPaste={(e) => handleHeaderPaste(idx, e)}
                                  className="headers-row-input-field"
                                  containerClassName="headers-row-input"
                                />

                                <VariableInput
                                  activeVariables={activeVars}
                                  value={header.value}
                                  placeholder="Header value"
                                  onChange={(e) => updateHeaderField(idx, "value", e.target.value)}
                                  onPaste={(e) => handleHeaderPaste(idx, e)}
                                  className="headers-row-input-field"
                                  containerClassName="headers-row-input"
                                />

                                <div className="headers-actions">
                                  <button
                                    type="button"
                                    className="icon-button headers-delete-button"
                                    aria-label={`Delete header ${header.key || idx + 1}`}
                                    onClick={() => removeHeader(idx)}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
          {activeTab === "auth" && (
            <div className="request-tab-panel auth-panel" aria-label="API request authentication">
                  <div className="auth-panel-grid">
                    <label className="auth-method-card">
                      <span>Authentication Method</span>
                      <select
                        value={draftRequest.authMode}
                        onChange={(e) => updateDraft({ authMode: e.target.value as import("./types").ApiAuthMode })}
                      >
                        {authModes.map((mode) => (
                          <option key={AUTH_MODE_MAP[mode]} value={AUTH_MODE_MAP[mode]}>{mode}</option>
                        ))}
                      </select>
                    </label>

                    <div className="auth-effective-card">
                      <span>Will Send</span>
                      <strong>{effectiveAuth ? describeAuthTarget(effectiveAuth.mode, effectiveAuth.config) : "No auth will be sent"}</strong>
                      {effectiveAuth && <small>{effectiveAuth.source} · {AUTH_MODE_LABELS[effectiveAuth.mode]}</small>}
                    </div>
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
              <div className="request-tab-panel request-scripts-panel">
                <div className="script-workspace">
                  <div className="script-workspace-toolbar">
                    <div className="script-type-segment" role="tablist" aria-label="Request script type">
                      <button
                        className={activeRequestScript === "pre" ? "script-type-option active" : "script-type-option"}
                        onClick={() => setActiveRequestScript("pre")}
                        role="tab"
                        type="button"
                      >
                        Pre-request
                      </button>
                      <button
                        className={activeRequestScript === "post" ? "script-type-option active" : "script-type-option"}
                        onClick={() => setActiveRequestScript("post")}
                        role="tab"
                        type="button"
                      >
                        Post-request
                      </button>
                    </div>
                    <div className="script-helper-strip" aria-label={`${currentScriptTitle} helpers`}>
                      {scriptRuntimeTokens.map((token) => (
                        <button
                          key={token}
                          type="button"
                          className="script-helper-chip"
                          onClick={() => insertScriptToken(token)}
                        >
                          {token}
                        </button>
                      ))}
                      {scriptVariableTokens.map((token) => (
                        <button
                          key={token}
                          type="button"
                          className="script-helper-chip"
                          onClick={() => insertScriptToken(token)}
                        >
                          {token}
                        </button>
                      ))}
                    </div>
                    <button
                      className="ghost-button script-workspace-save"
                      type="button"
                      onClick={handleSaveScripts}
                      aria-label={`Save ${currentScriptTitle}`}
                    >
                      <Save size={14} />
                      <span>Save Scripts</span>
                    </button>
                  </div>
                  <div className="script-editor-shell">
                    <ScriptEditor 
                      key={activeRequestScript}
                      value={currentScriptValue}
                      onChange={activeRequestScript === "pre" ? setPreScript : setPostScript}
                      variables={activeVars.map(v => v.key)}
                      placeholder={activeRequestScript === "pre" ? "// JavaScript only (no TypeScript types) to run before the request" : "// JavaScript only (no TypeScript types) to run after the request"}
                      height="100%"
                      onReady={(actions) => {
                        scriptEditorActionsRef.current = actions;
                      }}
                    />
                  </div>
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

          {renderBottomDock()}
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
            {renderResponsePanel({ modal: true })}
          </div>
        </div>
      )}

      {confirmDialog && (
        <div className="modal-overlay confirm-modal-overlay" role="dialog" aria-modal="true" aria-label="Confirm action" onClick={() => setConfirmDialog(null)}>
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
                {workspace.environments.map(env => (
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
                        {workspace.activeEnvironment === env.name && (
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
                {envEditorTarget && workspace.activeEnvironment !== envEditorTarget && (
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
                  const env = workspace.environments.find(e => e.name === envEditorTarget);
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
