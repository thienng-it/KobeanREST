import { useEffect, useState, useTransition, useRef, useMemo, useCallback, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { PanelLeftOpen, Sparkles } from "lucide-react";
import { PRODUCT_AUTHENTICATION_MODEL } from "./product-contract";
import { executeHttpRequest } from "./services/http-client";
import { resolveRequestFieldsSafe, UnresolvedVariableError, buildScopedVariableMap, activeScopedVariablesList, resolveString } from "./services/variables";
import { type ResponseTab } from "./components/ResponsePanel";
import { ModalManager } from "./components/ModalManager";
import { ContextMenu } from "./components/ContextMenu";
import { SetEnvVarModal } from "./components/SetEnvVarModal";
import { MoveToModal } from "./components/MoveToModal";
import { ChainRequestModal } from "./components/ChainRequestModal";
import { BottomDock } from "./components/BottomDock";
import { statusColor, type ResponseState, type PreviewMode } from "./response-utils";
import {
  formatTimestamp,
  openProductDocs,
  diagnosticMessage,
} from "./app-utils";
import type { KbScriptContext } from "./services/script-runtime";
import { useWorkspace } from "./hooks/useWorkspace";
import { useAppSettings } from "./hooks/useAppSettings";
import { useHistory } from "./hooks/useHistory";
import { useScripts } from "./hooks/useScripts";
import { useAuth } from "./hooks/useAuth";
import { RequestPanel } from "./components/RequestPanel";
import { Sidebar } from "./components/Sidebar";
import { WorkspaceSwitcherModal } from "./components/WorkspaceSwitcherModal";
import { CreateRequestModal } from "./components/CreateRequestModal";
import { TabBar } from "./components/TabBar";
import { AIChatSidebar } from "./components/AIChatSidebar";
import { EnvironmentEditor } from "./components/EnvironmentEditor";
import { FolderEditor } from "./components/FolderEditor";
import { CollectionEditor } from "./components/CollectionEditor";
import { UniversalImportModal } from "./components/UniversalImportModal";
import { ApiToolsModal } from "./components/ApiToolsModal";
import { resolveAuthConfig, getEffectiveAuth } from "./services/auth";
import { prepareRequestForExecution } from "./services/request-executor";
import { CollectionRunner } from "./components/CollectionRunner";

import {
  SCRIPT_SNIPPETS,
  generateRequestCodeSnippet,
} from "./services/script-tools";
import type { CurlImportResult } from "./services/script-tools";
import {
  recordRequestHistory,
  getScripts,
  loadHistoryResponse,
  importWorkspaceData,
  saveRequest,
  loadLocalWorkspace,
} from "./services/local-store";
import type {SavedRequest, Tab, WorkspaceSummary} from "./types";
import type { ScriptOutputEntry } from "./hooks/useScripts";

const SIDEBAR_MIN_WIDTH = 260;
const SIDEBAR_DEFAULT_WIDTH = 320;
const SIDEBAR_MAX_WIDTH = 540;

export function App() {
  const {
    settingsOpen, setSettingsOpen,
    appSettings, setAppSettings, updateAppSettings, handleSaveSettings,
    updateStatus, setUpdateStatus,
    availableUpdate,
    updateDialogOpen, setUpdateDialogOpen,
    updateBusy,
    updateProgressLabel,
    updateToast,
    handleCheckForUpdates, handleInstallUpdate
  } = useAppSettings();

  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem("kr_sidebar_collapsed") === "true";
  });
  const [isSidebarResizing, setIsSidebarResizing] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("kr_sidebar_collapsed", String(next));
      if (!next && sidebarWidth < 300) {
        setSidebarWidth(SIDEBAR_DEFAULT_WIDTH);
      }
      return next;
    });
  };
  const [activeTab, setActiveTab] = useState<"params" | "body" | "headers" | "auth" | "scripts" | "settings" | "variables" | "code">("params");
  const [responseState, setResponseState] = useState<ResponseState>({
    kind: "idle",
  });
  const [previewMode, setPreviewMode] = useState<PreviewMode>('rendered');
  const [responseTab, setResponseTab] = useState<ResponseTab>('preview');
  const [isResponseTabPending, startResponseTabTransition] = useTransition();
  const [responseWindowOpen, setResponseWindowOpen] = useState(false);
  const [activeBottomDock, setActiveBottomDock] = useState<'response' | 'console' | null>(null);
  const [bottomDockHeight, setBottomDockHeight] = useState(320);
  const [isResponsePanelResizing, setIsResponsePanelResizing] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [unsavedRequests, setUnsavedRequests] = useState<Record<string, SavedRequest>>({});

  const [headersPresetMenuOpen, setHeadersPresetMenuOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<import("./components/ConfirmDialog").ConfirmDialogState | null>(null);
  const [envEditorOpen, setEnvEditorOpen] = useState(false);
  const [setEnvVarModal, setSetEnvVarModal] = useState<{ open: boolean; text: string }>({ open: false, text: "" });
  const [collectionEditorOpen, setCollectionEditorOpen] = useState(false);
  const [collectionEditorTarget, setCollectionEditorTarget] = useState<string>("");
  const [curlImportOpen, setCurlImportOpen] = useState(false);
  const [createRequestModalOpen, setCreateRequestModalOpen] = useState(false);
  const [apiToolsOpen, setApiToolsOpen] = useState(false);
  const [createRequestInitialFolderId, setCreateRequestInitialFolderId] = useState<string | undefined>(undefined);
  const [workspaceSwitcherOpen, setWorkspaceSwitcherOpen] = useState(false);
  const [moveToModal, setMoveToModal] = useState<{ type: "request" | "folder"; id: string } | null>(null);
  const [collectionRunner, setCollectionRunner] = useState<{ scopeId: string; scopeType: "folder" | "collection" } | null>(null);
  const [chainRequestModal, setChainRequestModal] = useState<{ open: boolean, initialValue: string, onSave: (val: string) => void } | null>(null);
  const [appToast, setAppToast] = useState<{ message: string; tone: "info" | "success" | "error" } | null>(null);

  useEffect(() => {
    const handleAppToast = (e: any) => {
      setAppToast({ message: e.detail.message, tone: e.detail.tone });
      setTimeout(() => setAppToast(null), e.detail.durationMs || 4000);
    };
    window.addEventListener("app-toast", handleAppToast);
    return () => window.removeEventListener("app-toast", handleAppToast);
  }, []);

  useEffect(() => {
    const handleOpenChainModal = (e: any) => {
      setChainRequestModal({
        open: true,
        initialValue: e.detail.initialValue,
        onSave: e.detail.onSave,
      });
    };
    window.addEventListener("open-chain-modal", handleOpenChainModal);
    return () => window.removeEventListener("open-chain-modal", handleOpenChainModal);
  }, []);

  const ws = useWorkspace({
    setConfirmDialog,
    onWorkspaceLoaded: (loadedSettings) => {
      setAppSettings((prev) => ({ ...prev, updateChecksEnabled: loadedSettings.updateChecksEnabled }));
      setUpdateStatus({
        enabled: loadedSettings.updateChecksEnabled,
        lastCheckedLabel: loadedSettings.updateChecksEnabled
          ? "Automatic checks run after launch."
          : "Automatic checks are off.",
        channel: "stable",
      });
      if (loadedSettings.updateChecksEnabled) {
        void handleCheckForUpdates("automatic", loadedSettings);
      }
    },
    autoSaveEnabled: appSettings.autoSaveEnabled,
  });
  const {
    workspace, setWorkspace,
    workspaceList,
    handleCreateWorkspace,
    handleSwitchWorkspace,
    handleRenameWorkspace,
    handleDeleteWorkspace,
    updateCollectionDefaultEnvironment,
    selectedRequestId, setSelectedRequestId,
    draftRequest, setDraftRequest,
    databasePath,
    scriptStatus,
    collapsedFolders,
    collectionSearch, setCollectionSearch,
    deleteError, setDeleteError,
    renamingSidebarItem,
    sidebarNameDraft, setSidebarNameDraft,
    renamingRequestId,
    renameDraft, setRenameDraft,
    contextMenu, setContextMenu,
    envEditorTarget, setEnvEditorTarget,
    renamingEnvironment, setRenamingEnvironment,
    environmentNameDraft, setEnvironmentNameDraft,
    startRequestRename,
    stopRequestRename,
    applyRequestRename,
    startSidebarRename,
    cancelSidebarRename,
    applySidebarRename,
    handleSaveRequest,
    handleDeleteRequest,
    handleDuplicateRequest,
    handleCreateFolder,
    handleCreateCollection,
    handleCreateSubFolder,
    handleDeleteFolder,
    handleUpdateFolder,
    handleUpdateCollection,
    handleDeleteCollection,
    toggleFolder,
    expandAllFolders,
    collapseAllFolders,
    expandCollectionFolders,
    collapseCollectionFolders,
    handleCreateRequest,
    handleCreateRequestWithDetails,
    importCurlRequest,
    handleSetActiveEnvironment,
    handleCreateEnvironment,
    handleDeleteEnvironment,
    handleSetEnvironmentColor,
    handleSaveVariable,
    handleDeleteVariable,
    handleSaveScopedVariable,
    handleDeleteScopedVariable,
    handleRenameEnvironment,
    applyEnvironmentRename,
    cancelEnvironmentRename,
    handleExport,
    handleImport,
    handleImportPostmanCollection,
    handleImportPostmanEnvironment,
    handleMoveItem,
    importToast,
    loadWorkspace
  } = ws;

  const [universalImportModalOpen, setUniversalImportModalOpen] = useState(false);
  const [universalImportInitialContent, setUniversalImportInitialContent] = useState("");

  const handleSelectRequest = useCallback((id: string) => {
    const request = workspace?.requests.find((r) => r.id === id);
    if (request) {
      const folder = workspace?.folders.find((f) => f.id === request.folderId);
      if (folder && folder.collectionId) {
        const collection = workspace?.collections?.find((c) => c.id === folder.collectionId);
        if (collection && collection.defaultEnvironment) {
          if (workspace?.activeEnvironment !== collection.defaultEnvironment) {
            handleSetActiveEnvironment(collection.defaultEnvironment);
          }
        }
      }
    }
    setSelectedRequestId(id);
  }, [workspace, handleSetActiveEnvironment, setSelectedRequestId]);

  const {
    historyOpen, setHistoryOpen,
    historyEntries, setHistoryEntries,
    historySearch, setHistorySearch,
    historyLoading, setHistoryLoading,
    handleOpenHistory,
    handleClearHistory,
    handleReplayFromHistory,
  } = useHistory(workspace, handleSelectRequest);



  const {
    authEditorOpen, setAuthEditorOpen,
    authEditorTarget, setAuthEditorTarget,
    authDraft, setAuthDraft,
    handleSaveEntityAuth
  } = useAuth(workspace, setWorkspace);

  const {
    preScript, setPreScript,
    postScript, setPostScript,
    savedPreScript, savedPostScript,
    preScriptDirty, postScriptDirty, scriptsDirty,
    activeRequestScript, setActiveRequestScript,
    scriptEditorMode, setScriptEditorMode,
    activeSnippetId, setActiveSnippetId,
    requestCodeTarget, setRequestCodeTarget,
    scriptOutputLog, setScriptOutputLog,
    requestCodeOpen, setRequestCodeOpen,
    scriptOutputExpanded, setScriptOutputExpanded,
    folderScriptsOpen, setFolderScriptsOpen,
    folderScriptsTarget, setFolderScriptsTarget,
    folderPreScript, setFolderPreScript,
    folderPostScript, setFolderPostScript,
    collectionScriptsOpen, setCollectionScriptsOpen,
    collectionScriptsTarget, setCollectionScriptsTarget,
    collectionPreScript, setCollectionPreScript,
    collectionPostScript, setCollectionPostScript,
    scriptEditorActionsRef,
    insertScriptToken, setCurrentScriptValue, handlePrettifyScript,
    handleOpenFolderScripts, handleSaveFolderScripts,
    handleOpenCollectionScripts, handleSaveCollectionScripts,
    handleSaveScripts, runScript
  } = useScripts(selectedRequestId);

  const responseCacheRef = useRef<Record<string, { state: ResponseState, log: ScriptOutputEntry[] }>>({});

  const handleViewHistoryResponse = async (entry: import("./types").HistoryEntry) => {
    if (!workspace) return;
    const exists = workspace.requests.some((r) => r.id === entry.requestId);
    if (!exists) return; // Cannot view if request was deleted

    const payload = await loadHistoryResponse(entry.id);
    console.log("HISTORY PAYLOAD:", payload);
    if (payload) {
      const responseStatusText = entry.status === 200 ? "OK" : "Unknown"; // Mock status text based on status code
      const responseHeaders = payload.responseHeaders ? JSON.parse(payload.responseHeaders) : [];
      
      const newCacheEntry = {
        state: {
          kind: "success" as const,
          response: {
            status: entry.status,
            statusText: responseStatusText,
            headers: responseHeaders,
            bodyText: payload.responseBodyText || undefined,
            bodyBase64: payload.responseBodyBase64 || undefined,
            durationMs: entry.durationMs,
            dnsMs: 0,
            connectMs: 0,
            tlsMs: 0,
            requestMs: 0,
            sizeBytes: entry.sizeBytes,
          },
        },
        log: [],
      };
      
      responseCacheRef.current[entry.requestId] = newCacheEntry;

      if (selectedRequestId === entry.requestId) {
        setResponseState(newCacheEntry.state);
        setScriptOutputLog(newCacheEntry.log);
      } else {
        setSelectedRequestId(entry.requestId);
      }
      
      setHistoryOpen(false);
    }
  };

  useEffect(() => {
    // Prevent default drag behaviors globally so OS doesn't intercept drops
    const handleGlobalDragOver = (e: DragEvent) => e.preventDefault();
    const handleGlobalDrop = (e: DragEvent) => e.preventDefault();
    
    window.addEventListener("dragover", handleGlobalDragOver);
    window.addEventListener("drop", handleGlobalDrop);
    
    return () => {
      window.removeEventListener("dragover", handleGlobalDragOver);
      window.removeEventListener("drop", handleGlobalDrop);
    };
  }, []);

  useEffect(() => {
    if (selectedRequestId && responseCacheRef.current[selectedRequestId]) {
      const cache = responseCacheRef.current[selectedRequestId];
      setResponseState(cache.state);
      setScriptOutputLog(cache.log);
    } else {
      setResponseState({ kind: "idle" });
      setScriptOutputLog([]);
    }
  }, [selectedRequestId, setScriptOutputLog]);

  useEffect(() => {
    if (!isSidebarResizing) return;

    const handleMouseMove = (event: MouseEvent) => {
      if (event.clientX < 140) {
        setSidebarCollapsed(true);
        localStorage.setItem("kr_sidebar_collapsed", "true");
        setIsSidebarResizing(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        return;
      }
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
      const maxHeight = Math.max(160, window.innerHeight - 280);
      const nextHeight = Math.min(maxHeight, Math.max(140, window.innerHeight - e.clientY - 24));
      setBottomDockHeight(nextHeight);
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
    const handleGlobalClick = () => {
      if (!workspace) return;
      setContextMenu(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
    };
  }, [workspace]);

  const isSending = responseState.kind === "loading";
  const currentResponse = responseState.kind === "error" ? undefined : responseState.response;
  const responseTitle = responseState.kind === "error"
    ? "Request failed"
    : currentResponse
      ? `${currentResponse.status} ${currentResponse.statusText}`
      : "No response";
  const responseTitleColor = responseState.kind === 'error'
    ? 'var(--color-status-error)'
    : currentResponse
      ? statusColor(currentResponse.status)
      : 'var(--color-text)';
  const envList = workspace?.environments ?? [];
  const scopeFolder = workspace?.folders.find((f) => f.id === draftRequest?.folderId);
  const activeVars = activeScopedVariablesList(workspace, {
    collectionId: scopeFolder?.collectionId,
    folderId: draftRequest?.folderId,
    request: draftRequest ?? undefined,
  });
  const bottomDockStripHeight = 36;
  const currentScriptValue = activeRequestScript === "pre" ? preScript : postScript;
  const selectedScriptSnippet = SCRIPT_SNIPPETS.find((snippet) => snippet.id === activeSnippetId) ?? SCRIPT_SNIPPETS[0];
  const requestFolder = draftRequest
    ? workspace?.folders.find((folder) => folder.id === draftRequest.folderId) ?? null
    : null;
  const requestCollection = requestFolder
    ? workspace?.collections?.find((col) => col.id === requestFolder.collectionId) ?? null
    : null;
  const folderPath = [requestCollection?.name, requestFolder?.name].filter(Boolean).join(" / ");
  const effectiveAuth = draftRequest ? getEffectiveAuth(draftRequest, workspace) : null;
  const requestCodeSnippet = draftRequest ? (() => {
    const scopeWorkspace = workspace ?? { id: "tmp", name: "Temporary", activeEnvironment: "", environments: [], folders: [], requests: [] };
    const scopedFolder = scopeWorkspace.folders.find((f) => f.id === draftRequest.folderId);
    const variableMap = buildScopedVariableMap(scopeWorkspace, {
      collectionId: scopedFolder?.collectionId,
      folderId: draftRequest.folderId,
      request: draftRequest,
    });
    const resolved = resolveRequestFieldsSafe(variableMap, draftRequest.url, draftRequest.headers, draftRequest.body);
    const resolvedDraft = { ...draftRequest, url: resolved.url, headers: resolved.headers, body: resolved.body ?? "" };
    const resolvedAuth = effectiveAuth ? {
      mode: effectiveAuth.mode,
      config: resolveAuthConfig(effectiveAuth.config, variableMap)
    } : undefined;
    return generateRequestCodeSnippet(resolvedDraft, requestCodeTarget, resolvedAuth);
  })() : "";

  const handleNewTab = useCallback(() => {
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const tempReq: SavedRequest = {
      id: tempId,
      folderId: "",
      name: "New Request",
      method: "GET",
      url: "",
      headers: [
        { key: "Accept", value: "*/*", enabled: true },
        { key: "User-Agent", value: "KobeanREST/0.1.14", enabled: true },
      ],
      body: "",
      bodyMimeType: "text/plain",
      bodyForm: [],
      queryParams: [],
      authMode: "none",
      authConfig: {},
      timeoutMs: 30000,
      followRedirects: true,
    };
    setUnsavedRequests((prev) => ({ ...prev, [tempId]: tempReq }));
    const newTab: Tab = {
      id: `tab-${tempId}`,
      type: "request",
      entityId: tempId,
      name: tempReq.name,
      method: tempReq.method,
      isDirty: true,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setSelectedRequestId(tempId);
    setDraftRequest(tempReq);
  }, []);

  const handleImportCurlAsDraft = useCallback((fields: Partial<SavedRequest>) => {
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const tempReq: SavedRequest = {
      id: tempId,
      folderId: "",
      name: fields.name || "Imported cURL",
      method: fields.method || "GET",
      url: fields.url || "",
      headers: fields.headers || [],
      body: fields.body || "",
      bodyMimeType: fields.bodyMimeType || "text/plain",
      bodyForm: fields.bodyForm || [],
      queryParams: fields.queryParams || [],
      authMode: fields.authMode || "none",
      authConfig: fields.authConfig || {},
      timeoutMs: fields.timeoutMs || 30000,
      followRedirects: fields.followRedirects ?? true,
      position: 0
    };
    setUnsavedRequests((prev) => ({ ...prev, [tempId]: tempReq }));
    const newTab: Tab = {
      id: `tab-${tempId}`,
      type: "request",
      entityId: tempId,
      name: tempReq.name,
      method: tempReq.method,
      isDirty: true,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setSelectedRequestId(tempId);
    setDraftRequest(tempReq);
  }, []);

  function updateDraft(fields: Partial<SavedRequest> | ((prev: SavedRequest) => Partial<SavedRequest>)) {
    setDraftRequest((current) => {
      if (!current) return current;
      const newFields = typeof fields === 'function' ? fields(current) : fields;
      const updated = { ...current, ...newFields };
      
      setUnsavedRequests((prev) => {
        if (prev[current.id]) {
          return { ...prev, [current.id]: updated };
        }
        return prev;
      });
      
      setTabs((prev) =>
        prev.map((t) =>
          t.entityId === current.id
            ? { ...t, isDirty: true, method: updated.method, name: updated.name }
            : t
        )
      );
      
      return updated;
    });
  }

  function handleCurlImport(result: CurlImportResult) {
    handleImportCurlAsDraft({
      method: result.method,
      customMethod: result.customMethod,
      url: result.url,
      queryParams: [],
      headers: result.headers,
      body: result.body,
      bodyMimeType: result.bodyMimeType,
      bodyForm: result.bodyForm,
      authMode: result.authMode,
      authConfig: result.authConfig,
    });
    setCurlImportOpen(false);
  }

  function insertSelectedScriptSnippet() {
    if (!selectedScriptSnippet) return;
    setScriptEditorMode(selectedScriptSnippet.mode);

    // Templates are scope-aware: a post-response template belongs in the post
    // script, a pre-request template in the pre script. When the active editor
    // already matches (or the template is scope: "both"), insert at the cursor.
    // When it differs, switch the tab and append to the target script directly —
    // the editor is keyed by activeRequestScript, so the ref would otherwise
    // still point at the editor we're about to unmount.
    const target =
      selectedScriptSnippet.scope === "both"
        ? activeRequestScript
        : selectedScriptSnippet.scope;
    const matchesActive = target === activeRequestScript;

    if (matchesActive) {
      insertScriptToken(selectedScriptSnippet.body);
      return;
    }

    const current = target === "pre" ? preScript : postScript;
    const next = current.trimEnd()
      ? `${current.trimEnd()}${current.endsWith("\n") ? "" : "\n"}${selectedScriptSnippet.body}`
      : selectedScriptSnippet.body;
    if (target === "pre") {
      setPreScript(next);
    } else {
      setPostScript(next);
    }
    setActiveRequestScript(target);
  }

  function insertRequestCodeSnippet() {
    if (!requestCodeSnippet) return;
    insertScriptToken(requestCodeSnippet);
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

  async function sendSelectedRequest() {
    if (!draftRequest) return;
    setActiveBottomDock('response');
    setScriptOutputLog([]);
    
    const scriptOutputEntries: ScriptOutputEntry[] = [];

    // Build the full scoped variable map (env → collection → folder → request)
    // upfront so scripts see all variables, not just environment variables.
    const scopeWorkspace = workspace 
      ? (JSON.parse(JSON.stringify(workspace)) as WorkspaceSummary)
      : { id: "tmp", name: "Temporary", activeEnvironment: "", environments: [], folders: [], requests: [] };
    const scopedFolder = scopeWorkspace.folders.find((f) => f.id === draftRequest.folderId);
    const scopedCollection = scopeWorkspace.collections?.find((c) => c.id === draftRequest.folderId);
    const resolvedCollectionId = scopedFolder ? scopedFolder.collectionId : (scopedCollection ? scopedCollection.id : undefined);
    
    const variableMap = buildScopedVariableMap(scopeWorkspace, {
      collectionId: resolvedCollectionId,
      folderId: draftRequest.folderId,
      request: draftRequest,
    });

    // 1. Execute Pre-scripts (Hierarchy: Collection -> Folder -> Request)
    const setLocalVariable = (key: string, value: string) => {
      preScriptsContext.variables[key] = value;
      variableMap.set(key, value);
    };
    const deleteLocalVariable = (key: string) => {
      delete preScriptsContext.variables[key];
      variableMap.delete(key);
    };
    const setEnvironmentVariable = (key: string, value: string) => {
      const envName = workspace?.activeEnvironment;
      if (!envName) return;
      void handleSaveVariable(envName, key, value);
      
      const env = scopeWorkspace.environments.find(e => e.name === envName);
      if (env) {
        const existing = env.variables.find(v => v.key === key);
        if (existing) {
          existing.value = value;
        } else {
          env.variables.push({ key, value });
        }
      }
    };
    const deleteEnvironmentVariable = (key: string) => {
      const envName = workspace?.activeEnvironment;
      if (!envName) return;
      void handleDeleteVariable(envName, key);
      
      const env = scopeWorkspace.environments.find(e => e.name === envName);
      if (env) {
        env.variables = env.variables.filter(v => v.key !== key);
      }
    };
    const preScriptsContext: KbScriptContext = {
      request: { ...draftRequest },
      variables: Object.fromEntries(variableMap),
      setLocalVariable,
      deleteLocalVariable,
      setEnvironmentVariable,
      deleteEnvironmentVariable,
    };
    
    try {
      if (resolvedCollectionId) {
        const collectionScripts = await getScripts(resolvedCollectionId, 'collection');
        const preCollection = collectionScripts.find(s => s.scriptType === 'pre')?.content;
        if (preCollection) {
          const resolved = resolveString(preCollection, variableMap).resolved;
          scriptOutputEntries.push(...(await runScript(resolved, preScriptsContext, "Collection pre-request")));
        }
      }

      const folderPath: import('./types').FolderSummary[] = [];
      let currentFolder = scopedFolder;
      while (currentFolder) {
        folderPath.push(currentFolder);
        currentFolder = scopeWorkspace.folders.find((f) => f.id === currentFolder?.parentId);
      }
      folderPath.reverse(); // root folder first

      for (const folder of folderPath) {
        const folderScripts = await getScripts(folder.id, 'folder');
        const preFolder = folderScripts.find(s => s.scriptType === 'pre')?.content;
        if (preFolder) {
          const resolved = resolveString(preFolder, variableMap).resolved;
          scriptOutputEntries.push(...(await runScript(resolved, preScriptsContext, `Folder (${folder.name}) pre-request`)));
        }
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
      setResponseState({ kind: "error", message: `Pre-script execution failed: ${diagnosticMessage(err)}` });
      setScriptOutputLog(scriptOutputEntries);
      return;
    }

    if (preScriptsContext.skipRequest) {
      setResponseState({ kind: "error", message: "Request skipped by script." });
      setScriptOutputLog(scriptOutputEntries);
      return;
    }

    // Use the modified request from scripts
    const requestToSend = preScriptsContext.request;
    let executedRequest;
    let historyUrlToSave = "";
    try {
      const { request, updatedAuth, updatedAuthEntityId, updatedAuthEntityType, historyUrl } = await prepareRequestForExecution(requestToSend, scopeWorkspace!, variableMap);
      executedRequest = request;
      historyUrlToSave = historyUrl;
      
      // Update the source of truth to persist the token (request, folder, or collection)
      if (updatedAuth && updatedAuthEntityId && updatedAuthEntityType) {
        if (updatedAuthEntityType === "request" && updatedAuthEntityId === requestToSend.id) {
          updateDraft({ authConfig: { ...requestToSend.authConfig, ...updatedAuth } });
        } else if (updatedAuthEntityType === "folder") {
          const folderToUpdate = scopeWorkspace!.folders.find(f => f.id === updatedAuthEntityId);
          if (folderToUpdate) {
            const { saveFolderAuth } = await import("./services/local-store");
            const newConfig = { ...folderToUpdate.authConfig, ...updatedAuth };
            await saveFolderAuth(folderToUpdate.id, folderToUpdate.authMode, newConfig);
            handleUpdateFolder({ ...folderToUpdate, authConfig: newConfig });
          }
        } else if (updatedAuthEntityType === "collection") {
          const colToUpdate = scopeWorkspace!.collections?.find(c => c.id === updatedAuthEntityId);
          if (colToUpdate) {
            const { saveCollectionAuth } = await import("./services/local-store");
            const newConfig = { ...colToUpdate.authConfig, ...updatedAuth };
            await saveCollectionAuth(colToUpdate.id, colToUpdate.authMode, newConfig);
            handleUpdateCollection({ ...colToUpdate, authConfig: newConfig });
          }
        }
      }
    } catch (error) {
      if (error instanceof UnresolvedVariableError) {
        setResponseState({ kind: "error", message: error.message });
      } else {
        setResponseState({ kind: "error", message: error instanceof Error ? error.message : String(error) });
      }
      return;
    }

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

    // Log the outgoing request
    scriptOutputEntries.push({
      type: "request",
      tone: "info",
      message: `${executedRequest.method} ${executedRequest.url}`,
      request: {
        method: executedRequest.method,
        url: executedRequest.url,
        headers: executedRequest.headers,
        queryParams: requestToSend.queryParams || [],
        body: executedRequest.body,
        authMode: requestToSend.authMode,
        timeoutMs: executedRequest.timeoutMs,
        followRedirects: executedRequest.followRedirects,
        timestamp: new Date().toISOString(),
      },
    });

    try {
      const response = await executeHttpRequest(executedRequest);
      // Auto-detect preview mode from content type
      if (response.contentType && typeof response.contentType === 'string') {
        const ct = response.contentType.toLowerCase();
        if (ct.includes('json')) {
          setPreviewMode('json');
        } else if (ct.includes('xml')) {
          setPreviewMode('xml');
        } else if (ct.includes('html')) {
          setPreviewMode('rendered');
        } else {
          setPreviewMode('raw');
        }
      } else {
        setPreviewMode('raw');
      }

      setResponseState({ kind: "success", response });
      setAbortController(null);

      // Log the full response
      scriptOutputEntries.push({
        type: "response",
        tone: response.status >= 400 ? "error" : "info",
        message: `${response.status} ${response.statusText} — ${response.durationMs}ms`,
        response: {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          body: response.bodyText,
          durationMs: response.durationMs,
          dnsMs: response.dnsMs,
          connectMs: response.connectMs,
          tlsMs: response.tlsMs,
          requestMs: response.requestMs,
          sizeBytes: response.sizeBytes,
          contentType: typeof response.contentType === 'string' ? response.contentType : undefined,
        },
      });
      // 2. Execute Post-scripts (Hierarchy: Request -> Folder -> Collection)
      const postScriptsContext: KbScriptContext = {
        request: requestToSend,
        response: Object.freeze(response),
        variables: Object.fromEntries(variableMap),
        setLocalVariable: (key, value) => {
          postScriptsContext.variables[key] = value;
          variableMap.set(key, value);
        },
        deleteLocalVariable: (key) => {
          delete postScriptsContext.variables[key];
          variableMap.delete(key);
        },
        setEnvironmentVariable,
        deleteEnvironmentVariable,
      };
      
      try {
        const reqScripts = await getScripts(requestToSend.id, 'request');
        const postReq = reqScripts.find(s => s.scriptType === 'post')?.content;
        if (postReq) {
          const resolved = resolveString(postReq, variableMap).resolved;
          scriptOutputEntries.push(...(await runScript(resolved, postScriptsContext, "Request post-response")));
        }

        if (!postScriptsContext.skipRequest) {
          const folderPath2: import('./types').FolderSummary[] = [];
          let currentFolder2 = scopedFolder;
          while (currentFolder2) {
            folderPath2.push(currentFolder2);
            currentFolder2 = scopeWorkspace.folders.find((f) => f.id === currentFolder2?.parentId);
          }
          // No reverse here, because post-scripts run from immediate folder up to root folder
          for (const folder of folderPath2) {
            if (postScriptsContext.skipRequest) break;
            const folderScripts = await getScripts(folder.id, 'folder');
            const postFolder = folderScripts.find(s => s.scriptType === 'post')?.content;
            if (postFolder) {
              const resolved = resolveString(postFolder, variableMap).resolved;
              scriptOutputEntries.push(...(await runScript(resolved, postScriptsContext, `Folder (${folder.name}) post-response`)));
            }
          }

          if (!postScriptsContext.skipRequest && resolvedCollectionId) {
            const collectionScripts = await getScripts(resolvedCollectionId, 'collection');
            const postCollection = collectionScripts.find(s => s.scriptType === 'post')?.content;
            if (postCollection) {
              const resolved = resolveString(postCollection, variableMap).resolved;
              scriptOutputEntries.push(...(await runScript(resolved, postScriptsContext, "Collection post-response")));
            }
          }
        }
      } catch (err) {
        console.error("Post-script execution failed", diagnosticMessage(err));
        scriptOutputEntries.push({ tone: "error", message: `Post-script execution failed: ${diagnosticMessage(err)}` });
      }
      setScriptOutputLog(scriptOutputEntries);
      responseCacheRef.current[requestToSend.id] = {
        state: { kind: "success", response },
        log: scriptOutputEntries,
      };

      let passed = response.status < 400;
      const expectedCodesVar = variableMap.get("expectedStatusCodes");
      if (expectedCodesVar) {
        try {
          const parsed = JSON.parse(expectedCodesVar);
          if (Array.isArray(parsed)) {
            passed = parsed.includes(response.status);
          } else if (typeof parsed === 'number') {
            passed = response.status === parsed;
          }
        } catch {
          const codes = expectedCodesVar.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
          if (codes.length > 0) {
            passed = codes.includes(response.status);
          }
        }
      }

      const testFails = scriptOutputEntries.filter(s => s.type === "test_fail");
      const testPasses = scriptOutputEntries.filter(s => s.type === "test_pass");
      const totalTests = testFails.length + testPasses.length;
      if (totalTests > 0) {
        passed = testFails.length === 0;
      }

      const testResults = scriptOutputEntries
        .filter(s => s.type === "test_pass" || s.type === "test_fail")
        .map(s => ({
          name: (s as any).name || (s as any).message || "Unknown test",
          passed: s.type === "test_pass",
          error: (s as any).errMessage,
        }));

      void recordRequestHistory({
        requestId: requestToSend.id,
        method: executedRequest.method,
        url: historyUrlToSave,
        status: response.status,
        durationMs: response.durationMs,
        sizeBytes: response.sizeBytes,
        responseHeaders: JSON.stringify(response.headers),
        responseBodyText: response.bodyText,
        responseBodyBase64: response.bodyBase64,
        testPassed: passed,
        passedTests: testPasses.length,
        failedTests: testFails.length,
        testResults,
      });
    } catch (error) {
      const isAbort = error instanceof Error && error.message.includes("aborted");
      const errState: ResponseState = {
        kind: "error",
        message: isAbort ? "Request cancelled by user" : (error instanceof Error ? error.message : String(error))
      };
      setResponseState(errState);
      setScriptOutputLog(scriptOutputEntries);
      responseCacheRef.current[requestToSend.id] = {
        state: errState,
        log: scriptOutputEntries,
      };
      setAbortController(null);
    }
  }

  const isDraftDirty = useMemo(() => {
    if (!draftRequest || !workspace) return false;
    const original = workspace.requests.find((r) => r.id === draftRequest.id);
    if (!original) return true;
    return JSON.stringify(original) !== JSON.stringify(draftRequest);
  }, [draftRequest, workspace]);

  // Update tab dirty state
  useEffect(() => {
    if (!activeTabId || !draftRequest) return;
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId ? { ...tab, isDirty: isDraftDirty } : tab
      )
    );
  }, [isDraftDirty, activeTabId, draftRequest]);

  // Handle requests that are selected outside of openRequestTab (e.g., after creation, deletion, etc.)
  const lastSelectedRequestIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (selectedRequestId === lastSelectedRequestIdRef.current) {
      return;
    }
    lastSelectedRequestIdRef.current = selectedRequestId;
    if (!selectedRequestId) return;
    
    const existingTab = tabs.find((tab) => tab.type === "request" && tab.entityId === selectedRequestId);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      return;
    }
    
    const request = workspace?.requests.find((r) => r.id === selectedRequestId);
    if (!request) return;
    const newTab: Tab = {
      id: `request-${request.id}-${Date.now()}`,
      type: "request",
      entityId: request.id,
      name: request.name,
      method: request.method,
      isDirty: false,
    };
    setTabs((prev) => {
      if (prev.some((t) => t.type === "request" && t.entityId === request.id)) {
        return prev;
      }
      return [...prev, newTab];
    });
    setActiveTabId(newTab.id);
  }, [selectedRequestId, tabs, workspace]);

  function openFolderTab(folderId: string) {
    const folder = workspace?.folders.find((f) => f.id === folderId);
    if (!folder) return;
    setSelectedRequestId(null);
    lastSelectedRequestIdRef.current = null;

    const existingTab = tabs.find((tab) => tab.type === "folder" && tab.entityId === folderId);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      return;
    }

    const newTab: Tab = {
      id: `folder-${folderId}-${Date.now()}`,
      type: "folder",
      entityId: folderId,
      name: folder.name,
      isDirty: false,
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }

  function openCollectionTab(collectionId: string) {
    const collection = workspace?.collections?.find((c) => c.id === collectionId);
    if (!collection) return;
    setSelectedRequestId(null);
    lastSelectedRequestIdRef.current = null;

    const existingTab = tabs.find((tab) => tab.type === "collection" && tab.entityId === collectionId);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      return;
    }

    const newTab: Tab = {
      id: `collection-${collectionId}-${Date.now()}`,
      type: "collection",
      entityId: collectionId,
      name: collection.name,
      isDirty: false,
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }

  function openEnvironmentTab(envName: string) {
    setSelectedRequestId(null);
    lastSelectedRequestIdRef.current = null;
    const existingTab = tabs.find((t) => t.type === "environment" && t.entityId === envName);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      return;
    }
    const newTab: Tab = {
      id: `env-${Date.now()}`,
      type: "environment",
      entityId: envName,
      name: envName,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }

  function handleDeleteEnvironmentAndCloseTabs(envName: string) {
    handleDeleteEnvironment(envName, () => {
      setTabs((prev) => {
        const tabToClose = prev.find((t) => t.type === "environment" && t.entityId === envName);
        if (tabToClose) {
          // Instead of calling performCloseTab, we directly remove it here to avoid asynchronous issues with state
          const newTabs = prev.filter((t) => t.id !== tabToClose.id);
          if (activeTabId === tabToClose.id) {
            if (newTabs.length > 0) {
              const nextTab = newTabs[newTabs.length - 1];
              setActiveTabId(nextTab.id);
              if (nextTab.type === "request") {
                setSelectedRequestId(nextTab.entityId);
                lastSelectedRequestIdRef.current = nextTab.entityId;
              } else if (nextTab.type === "folder") {
                setSelectedRequestId(null);
                lastSelectedRequestIdRef.current = null;
              } else if (nextTab.type === "environment") {
                setSelectedRequestId(null);
                lastSelectedRequestIdRef.current = null;
              }
            } else {
              setActiveTabId("");
              setSelectedRequestId(null);
              lastSelectedRequestIdRef.current = null;
            }
          }
          return newTabs;
        }
        return prev;
      });
    });
  }

  function actuallyCloseTabs(tabIdsToClose: string[]) {
    setTabs((prev) => {
      const newTabs = prev.filter((t) => !tabIdsToClose.includes(t.id));

      if (activeTabId && tabIdsToClose.includes(activeTabId)) {
        if (newTabs.length > 0) {
          const nextTab = newTabs[newTabs.length - 1];
          setActiveTabId(nextTab.id);
          if (nextTab.type === "request") {
            setSelectedRequestId(nextTab.entityId);
            lastSelectedRequestIdRef.current = nextTab.entityId;
          } else if (nextTab.type === "folder") {
            setSelectedRequestId(null);
            lastSelectedRequestIdRef.current = null;
          } else if (nextTab.type === "environment") {
            setSelectedRequestId(null);
            lastSelectedRequestIdRef.current = null;
          }
        } else {
          setActiveTabId(null);
          setSelectedRequestId(null);
          lastSelectedRequestIdRef.current = null;
        }
      }

      return newTabs;
    });
  }

  function handleCloseOtherTabs(excludeTabId: string) {
    const tabsToClose = tabs.filter((t) => t.id !== excludeTabId);
    if (tabsToClose.length === 0) return;

    const dirtyCount = tabsToClose.filter((t) => t.isDirty).length;
    const tabIdsToClose = tabsToClose.map((t) => t.id);

    if (dirtyCount > 0) {
      setConfirmDialog({
        message: `You have unsaved changes in ${dirtyCount} tab(s). Are you sure you want to discard them?`,
        confirmVariant: "danger",
        onConfirm: () => actuallyCloseTabs(tabIdsToClose),
      });
    } else {
      actuallyCloseTabs(tabIdsToClose);
    }
  }

  function handleCloseAllTabs() {
    if (tabs.length === 0) return;

    const dirtyCount = tabs.filter((t) => t.isDirty).length;
    const tabIdsToClose = tabs.map((t) => t.id);

    if (dirtyCount > 0) {
      setConfirmDialog({
        message: `You have unsaved changes in ${dirtyCount} tab(s). Are you sure you want to discard them?`,
        confirmVariant: "danger",
        onConfirm: () => actuallyCloseTabs(tabIdsToClose),
      });
    } else {
      actuallyCloseTabs(tabIdsToClose);
    }
  }

  function closeTab(tabId: string, e?: React.MouseEvent) {
    e?.stopPropagation();

    const tabToClose = tabs.find((tab) => tab.id === tabId);
    if (tabToClose?.isDirty) {
      setConfirmDialog({
        title: "Unsaved Changes",
        message: `You have unsaved changes in "${tabToClose.name}". Are you sure you want to close it? Your changes will be lost.`,
        confirmLabel: "Close Tab",
        confirmVariant: "danger",
        onConfirm: () => performCloseTab(tabId),
      });
      return;
    }

    performCloseTab(tabId);
  }

  function performCloseTab(tabId: string) {
    setTabs((prev) => {
      const index = prev.findIndex((tab) => tab.id === tabId);
      if (index === -1) return prev;
      const tabToClose = prev[index];
      const newTabs = prev.filter((tab) => tab.id !== tabId);

      if (unsavedRequests[tabToClose.entityId]) {
        setUnsavedRequests((prevUnsaved) => {
          const next = { ...prevUnsaved };
          delete next[tabToClose.entityId];
          return next;
        });
      }

      if (activeTabId === tabId) {
        if (newTabs.length > 0) {
          const newIndex = Math.min(index, newTabs.length - 1);
          const nextTab = newTabs[newIndex];
          setActiveTabId(nextTab.id);
          if (nextTab.type === "request") {
            setSelectedRequestId(nextTab.entityId);
            lastSelectedRequestIdRef.current = nextTab.entityId;
            if (unsavedRequests[nextTab.entityId]) {
              setDraftRequest(unsavedRequests[nextTab.entityId]);
            }
          } else if (nextTab.type === "folder") {
            setSelectedRequestId(null);
            lastSelectedRequestIdRef.current = null;
          } else if (nextTab.type === "environment") {
            setSelectedRequestId(null);
            lastSelectedRequestIdRef.current = null;
          }
        } else {
          setActiveTabId(null);
          setSelectedRequestId(null);
          lastSelectedRequestIdRef.current = null;
          setDraftRequest(null);
        }
      } else {
        if (tabToClose.type === "request" && tabToClose.entityId === selectedRequestId) {
          setSelectedRequestId(null);
          lastSelectedRequestIdRef.current = null;
          setDraftRequest(null);
        }
      }
      return newTabs;
    });
  }

  function promptSaveRequest() {
    if (!draftRequest) return;
    const isUnsaved = Boolean(unsavedRequests[draftRequest.id]);
    if (isUnsaved) {
      setCreateRequestInitialFolderId(undefined);
      setCreateRequestModalOpen(true);
      return;
    }
    void handleSaveRequest();
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, isDirty: false } : t))
    );
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        promptSaveRequest();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "t") {
        e.preventDefault();
        handleNewTab();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [draftRequest, isDraftDirty, workspace, unsavedRequests, handleNewTab]);

  const selectionReplaceFnRef = useRef<((varName: string) => void) | null>(null);
  const pendingSelectionRef = useRef<{ text: string; replaceFn: ((varName: string) => void) | null } | null>(null);

  // Capture text selection on right-mousedown BEFORE the browser clears it
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 2) return;
      
      const target = e.target as HTMLElement;
      if (target.closest(".sidebar")) {
        pendingSelectionRef.current = null;
        return;
      }

      let text = window.getSelection()?.toString().trim() || "";
      let replaceFn: ((varName: string) => void) | null = null;

      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        const input = target as HTMLInputElement | HTMLTextAreaElement;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        if (start !== null && end !== null && end > start) {
          text = input.value.substring(start, end).trim();
          replaceFn = (varName: string) => {
            const newVal = input.value.substring(0, start) + `{{${varName}}}` + input.value.substring(end);
            // Trigger React's synthetic onChange by using native setter
            const proto = target.tagName === "INPUT" ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
            setter?.call(input, newVal);
            input.dispatchEvent(new Event("input", { bubbles: true }));
          };
        }
      }

      pendingSelectionRef.current = text ? { text, replaceFn } : null;
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      const pending = pendingSelectionRef.current;
      if (pending?.text) {
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          target: { id: "selection", type: "selection", selectionText: pending.text },
        });
        selectionReplaceFnRef.current = pending.replaceFn;
      } else {
        setContextMenu(null);
      }
    };

    window.addEventListener("mousedown", onMouseDown, { capture: true });
    window.addEventListener("contextmenu", onContextMenu, { capture: true });
    return () => {
      window.removeEventListener("mousedown", onMouseDown, { capture: true });
      window.removeEventListener("contextmenu", onContextMenu, { capture: true });
    };
  }, []);

  // Auto-remove open tabs when items (requests, folders, collections, environments) are deleted from the workspace
  useEffect(() => {
    if (!workspace) return;
    const validRequestIds = new Set(workspace.requests.map((r) => r.id));
    const validFolderIds = new Set(workspace.folders.map((f) => f.id));
    const validCollectionIds = new Set((workspace.collections ?? []).map((c) => c.id));
    const validEnvironmentNames = new Set(workspace.environments.map((e) => e.name));

    setTabs((prevTabs) => {
      const filtered = prevTabs.filter((tab) => {
        if (unsavedRequests[tab.entityId]) return true;
        if (tab.type === "request") return validRequestIds.has(tab.entityId);
        if (tab.type === "folder") return validFolderIds.has(tab.entityId);
        if (tab.type === "collection") return validCollectionIds.has(tab.entityId);
        if (tab.type === "environment") return validEnvironmentNames.has(tab.entityId);
        return true;
      });

      if (filtered.length !== prevTabs.length) {
        if (activeTabId && !filtered.some((t) => t.id === activeTabId)) {
          if (filtered.length > 0) {
            const nextTab = filtered[filtered.length - 1];
            setActiveTabId(nextTab.id);
            if (nextTab.type === "request") {
              setSelectedRequestId(nextTab.entityId);
              lastSelectedRequestIdRef.current = nextTab.entityId;
            } else {
              setSelectedRequestId(null);
              lastSelectedRequestIdRef.current = null;
            }
          } else {
            setActiveTabId(null);
            setSelectedRequestId(null);
            lastSelectedRequestIdRef.current = null;
            setDraftRequest(null);
          }
        }
      }
      return filtered;
    });
  }, [workspace, unsavedRequests, activeTabId]);

  const handleGlobalContextMenu = (_e: React.MouseEvent<HTMLElement>) => {
    // Handled by the native listener in useEffect above
  };
  
  const currentTab = activeTabId ? tabs.find((t) => t.id === activeTabId) : null;
  const unsavedEntityIds = useMemo(() => new Set(Object.keys(unsavedRequests)), [unsavedRequests]);

  return (
    <main
      className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${isSidebarResizing ? "sidebar-resizing" : ""}`}
      style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
      onContextMenu={handleGlobalContextMenu}
    >
      {appToast && (
        <div 
          className={`update-toast import-toast import-toast-${appToast.tone}`} 
          role="status" 
          aria-live="polite"
        >
          {appToast.message}
        </div>
      )}
      {updateToast && (
        <div
          className={`update-toast update-toast-${updateToast.tone}`}
          role="status"
          aria-live="polite"
        >
          {updateToast.message}
        </div>
      )}
      {importToast && (
        <div
          className={`update-toast import-toast import-toast-${importToast.tone}`}
          role="status"
          aria-live="polite"
        >
          {importToast.message}
        </div>
      )}
      <Sidebar
        workspace={workspace}
        selectedRequestId={selectedRequestId}
        selectedEnvironmentTab={currentTab?.type === 'environment' ? currentTab.entityId : null}
        activeEnvironment={workspace?.activeEnvironment || ""}
        sidebarWidth={sidebarWidth}
        isResizing={isSidebarResizing}
        theme={appSettings.theme}
        onThemeChange={(nextTheme) => updateAppSettings({ theme: nextTheme })}
        onToggleSidebar={toggleSidebar}
        collectionSearch={collectionSearch}
        collapsedFolders={collapsedFolders}
        scriptStatus={scriptStatus}
        draftRequest={draftRequest}
        isDraftDirty={isDraftDirty}
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
        onSelectRequest={handleSelectRequest}
        onDeleteRequest={handleDeleteRequest}
        onCreateRequest={(folderId) => {
          setCreateRequestInitialFolderId(folderId);
          setCreateRequestModalOpen(true);
          return Promise.resolve();
        }}
        onOpenFolder={openFolderTab}
        onOpenCollection={openCollectionTab}
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
        onOpenEnvironmentTab={openEnvironmentTab}
        onCreateEnvironment={handleCreateEnvironment}
        onDeleteEnvironment={handleDeleteEnvironmentAndCloseTabs}
        onCollectionSearchChange={setCollectionSearch}
        onToggleFolder={toggleFolder}
        onExpandAll={expandAllFolders}
        onCollapseAll={collapseAllFolders}
        onContextMenu={(target, x, y) => setContextMenu({ x, y, target })}
        onDismissDeleteError={() => setDeleteError(null)}
        onOpenDocs={openProductDocs}
        onOpenHistory={() => void handleOpenHistory()}
        onCheckForUpdates={() => void handleCheckForUpdates("manual")}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenApiTools={() => setApiToolsOpen(true)}
        onExport={() => {void handleExport()}}
        onImport={() => {
          setUniversalImportInitialContent("");
          setUniversalImportModalOpen(true);
        }}
        onCurlImport={() => {
          setUniversalImportInitialContent("");
          setUniversalImportModalOpen(true);
        }}
        onOpenWorkspaceSwitcher={() => setWorkspaceSwitcherOpen(true)}
        onMoveItem={handleMoveItem}
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
        {sidebarCollapsed && (
          <div className="workspace-collapsed-bar">
            <button
              type="button"
              className="sidebar-expand-btn"
              aria-label="Show sidebar (Cmd+B)"
              title="Show sidebar (Cmd+B)"
              onClick={toggleSidebar}
            >
              <PanelLeftOpen size={15} />
              <span>Sidebar</span>
            </button>
          </div>
        )}

        <div className="workspace-main" style={{ display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-sidebar)", alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <TabBar
            tabs={tabs}
            activeTabId={activeTabId}
            unsavedEntityIds={unsavedEntityIds}
            onNewTab={handleNewTab}
            onTabClick={(tab) => {
              setActiveTabId(tab.id);
              if (tab.type === "request") {
                if (unsavedRequests[tab.entityId]) {
                  setSelectedRequestId(tab.entityId);
                  setDraftRequest(unsavedRequests[tab.entityId]);
                } else {
                  handleSelectRequest(tab.entityId);
                }
                lastSelectedRequestIdRef.current = tab.entityId;
              } else if (tab.type === "folder") {
                setSelectedRequestId(null);
                lastSelectedRequestIdRef.current = null;
              } else if (tab.type === "collection") {
                setSelectedRequestId(null);
                lastSelectedRequestIdRef.current = null;
              } else if (tab.type === "environment") {
                setSelectedRequestId(null);
                lastSelectedRequestIdRef.current = null;
              }
            }}
            onTabClose={closeTab}
            onTabContextMenu={(tabId, x, y) => {
              setContextMenu({ x, y, target: { id: tabId, type: "tab" } });
            }}
          />
              </div>
              <button
                onClick={() => setAiChatOpen(prev => !prev)}
                className="icon-btn"
                title="Toggle AI Chat"
                style={{
                   margin: '0 8px',
                   padding: '4px 8px',
                   display: 'flex',
                   alignItems: 'center',
                   gap: '6px',
                   background: aiChatOpen ? 'var(--color-surface-active)' : 'transparent',
                   border: 'none',
                   borderRadius: '6px',
                   color: aiChatOpen ? 'var(--color-text-active)' : 'var(--color-text-muted)',
                   cursor: 'pointer',
                   flexShrink: 0
                }}
              >
                <Sparkles size={14} />
                <span style={{ fontSize: '12px', fontWeight: 500 }}>AI Chat</span>
              </button>
            </div>
          {(() => {
            let scopedVarsArray = activeVars;
            if (workspace) {
              if (currentTab?.type === "request" && draftRequest) {
                // activeVars is already scoped to draftRequest
              } else if (currentTab?.type === "folder") {
                const folder = workspace.folders.find(f => f.id === currentTab.entityId);
                scopedVarsArray = activeScopedVariablesList(workspace, {
                  collectionId: folder?.collectionId,
                  folderId: currentTab.entityId
                });
              } else if (currentTab?.type === "collection") {
                scopedVarsArray = activeScopedVariablesList(workspace, {
                  collectionId: currentTab.entityId
                });
              }
            }

            if (currentTab?.type === "environment") {
              return (
                <EnvironmentEditor
                  environmentName={currentTab.entityId}
                  variables={
                    workspace?.environments.find((e) => e.name === currentTab.entityId)
                      ?.variables ?? []
                  }
                  onUpdateVariables={(newVars) => {
                    if (!workspace) return;
                    
                    const env = workspace.environments.find((e) => e.name === currentTab.entityId);
                    if (env) {
                      const oldVars = env.variables;
                      const newKeys = new Set(newVars.map(v => v.key));
                      
                      // Delete variables that are no longer in newVars
                      const deletedVars = oldVars.filter(v => !newKeys.has(v.key));
                      for (const dv of deletedVars) {
                        if (dv.key.trim()) {
                          void handleDeleteVariable(currentTab.entityId, dv.key);
                        }
                      }
                      
                      // Save new or updated variables
                      for (const nv of newVars) {
                        if (!nv.key.trim()) continue;
                        const ov = oldVars.find(v => v.key === nv.key);
                        if (!ov || ov.value !== nv.value || ov.secret !== nv.secret || ov.masked !== nv.masked) {
                          void handleSaveVariable(currentTab.entityId, nv.key, nv.value, nv.masked);
                        }
                      }
                    }

                    const updatedEnvs = workspace.environments.map((e) =>
                      e.name === currentTab.entityId ? { ...e, variables: newVars } : e
                    );
                    setWorkspace({ ...workspace, environments: updatedEnvs });
                  }}
                  isActiveEnvironment={workspace?.activeEnvironment === currentTab.entityId}
                  onSetActiveEnvironment={() => handleSetActiveEnvironment(currentTab.entityId)}
                  onDeleteEnvironment={() => handleDeleteEnvironmentAndCloseTabs(currentTab.entityId)}
                  onRenameEnvironment={(newName) => { /* rename is mostly handled in sidebar, but we can call applyEnvironmentRename */ }}
                  collections={workspace?.collections}
                  onUpdateCollectionDefaultEnvironment={updateCollectionDefaultEnvironment}
                />
              );
            }
            
            if (currentTab?.type === "folder") {
              const folder = workspace?.folders.find(f => f.id === currentTab.entityId);
              if (!folder) return null;
              return (
                <FolderEditor
                  folder={folder}
                  activeVars={scopedVarsArray}
                  onUpdateFolder={handleUpdateFolder}
                  onSaveScopedVariable={handleSaveScopedVariable}
                  onDeleteScopedVariable={handleDeleteScopedVariable}
                />
              );
            }

            if (currentTab?.type === "collection") {
              const collection = workspace?.collections?.find(c => c.id === currentTab.entityId);
              if (collection) {
                return (
                  <CollectionEditor
                    collection={collection}
                    activeVars={scopedVarsArray}
                    onUpdateCollection={handleUpdateCollection}
                    onSaveScopedVariable={handleSaveScopedVariable}
                    onDeleteScopedVariable={handleDeleteScopedVariable}
                  />
                );
              }
            }

            if (currentTab?.type === "request" && !draftRequest) {
              return null; // prevent ghosting while useWorkspace fetches the draftRequest
            }

            return draftRequest ? (
            <RequestPanel
              workspace={workspace}
              draftRequest={draftRequest}
              activeVars={scopedVarsArray}
              activeEnvironmentName={workspace?.activeEnvironment}
              onSaveVariable={handleSaveVariable}
              isSending={isSending}
              folderPath={folderPath}
              effectiveAuth={effectiveAuth}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              preScript={preScript}
              setPreScript={setPreScript}
              postScript={postScript}
              setPostScript={setPostScript}
              preScriptDirty={preScriptDirty}
              postScriptDirty={postScriptDirty}
              scriptsDirty={scriptsDirty}
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
              isDirty={isDraftDirty}
              isUnsaved={Boolean(draftRequest && unsavedRequests[draftRequest.id])}
              onUpdateDraft={updateDraft}
              onSaveRequest={promptSaveRequest}
              onSendRequest={sendSelectedRequest}
              onSaveScripts={handleSaveScripts}
              scriptEditorActionsRef={scriptEditorActionsRef}
              onInsertScriptToken={insertScriptToken}
              onPrettifyScript={handlePrettifyScript}
              onInsertSelectedScriptSnippet={insertSelectedScriptSnippet}
              codeSnippet={requestCodeSnippet}
              codeTarget={requestCodeTarget}
              onTargetChange={setRequestCodeTarget}
              onInsertCode={insertRequestCodeSnippet}
              diagnosticMessage={diagnosticMessage}
              onSaveScopedVariable={handleSaveScopedVariable}
              onDeleteScopedVariable={handleDeleteScopedVariable}
            />
            ) : (
            <div className="workspace-empty-hero">
              <div className="workspace-empty-card">
                <div className="workspace-empty-mark">KR</div>
                <h2>KobeanREST Workspace</h2>
                <p>Select a request from the sidebar or create a new one to start testing your APIs.</p>
                <div className="workspace-empty-actions">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={handleNewTab}
                  >
                    + New Request
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setCurlImportOpen(true)}
                  >
                    Import
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void handleCreateCollection()}
                  >
                    + New Collection
                  </button>
                </div>
              </div>
            </div>
            );
          })()}

          {currentTab && currentTab.type !== "folder" && currentTab.type !== "collection" && (
            <BottomDock
              activeBottomDock={activeBottomDock}
              bottomDockHeight={bottomDockHeight}
              bottomDockStripHeight={bottomDockStripHeight}
              responseState={responseState}
              currentResponse={currentResponse}
              responseTitle={responseTitle}
              responseTitleColor={responseTitleColor}
              isResponseTabPending={isResponseTabPending}
              responseTab={responseTab}
              previewMode={previewMode}
              scriptOutputLog={scriptOutputLog}
              onActiveBottomDockChange={setActiveBottomDock}
              onTabChange={handleResponseTabChange}
              onPreviewModeChange={setPreviewMode}
              onDownload={downloadCurrentResponse}
              onCopy={() => void copyCurrentResponse()}
              onOpenHistory={() => {
                if (selectedRequestId) {
                  setHistorySearch(selectedRequestId);
                  handleOpenHistory();
                }
              }}
              onOpenWindow={() => setResponseWindowOpen(true)}
              onResizerMouseDown={handleResponsePanelResizerMouseDown}
              onClearConsole={() => setScriptOutputLog([])}
            />
          )}
          </div>
          <AIChatSidebar isOpen={aiChatOpen} onClose={() => setAiChatOpen(false)} draftRequest={draftRequest} workspace={workspace} />
        </div>
      </section>

      <ModalManager
        confirmDialog={confirmDialog}
        onCancelConfirmDialog={() => setConfirmDialog(null)}
        history={{
          open: historyOpen,
          historyEntries,
          historySearch,
          historyLoading,
          workspace,
          onClose: () => setHistoryOpen(false),
          onSearchChange: setHistorySearch,
          onClear: handleClearHistory,
          onReplay: handleReplayFromHistory,
          onViewResponse: handleViewHistoryResponse,
          formatTimestamp,
        }}
        settings={{
          open: settingsOpen,
          appSettings,
          databasePath,
          updateStatus,
          onClose: () => setSettingsOpen(false),
          onSettingsChange: updateAppSettings,
          onCheckForUpdates: () => void handleCheckForUpdates("manual"),
          onSave: handleSaveSettings,
        }}
        auth={{
          open: authEditorOpen,
          target: authEditorTarget,
          draft: authDraft,
          activeVars,
          onClose: () => setAuthEditorOpen(false),
          onDraftChange: setAuthDraft,
          onSave: handleSaveEntityAuth,
        }}
        update={{
          open: updateDialogOpen,
          availableUpdate,
          updateBusy,
          progressLabel: updateProgressLabel,
          publishedDateLabel: availableUpdate?.date ? formatTimestamp(availableUpdate.date) : null,
          onClose: () => setUpdateDialogOpen(false),
          onInstall: handleInstallUpdate,
        }}
        env={{
          open: envEditorOpen,
          workspace,
          envEditorTarget,
          renamingEnvironment,
          environmentNameDraft,
          onClose: () => setEnvEditorOpen(false),
          onEnvEditorTargetChange: setEnvEditorTarget,
          onRenameEnvironment: handleRenameEnvironment,
          onApplyEnvironmentRename: applyEnvironmentRename,
          onCancelEnvironmentRename: cancelEnvironmentRename,
          onEnvironmentNameDraftChange: setEnvironmentNameDraft,
          onCreateEnvironment: handleCreateEnvironment,
          onDeleteEnvironment: handleDeleteEnvironment,
          onSetActiveEnvironment: handleSetActiveEnvironment,
          onSetEnvironmentColor: handleSetEnvironmentColor,
          onDeleteVariable: handleDeleteVariable,
          onNewVarKeyChange: () => {},
          onNewVarValueChange: () => {},
          onSaveVariable: handleSaveVariable,
        }}
        requestCode={{
          open: requestCodeOpen,
          codeSnippet: requestCodeSnippet,
          codeTarget: requestCodeTarget,
          onClose: () => setRequestCodeOpen(false),
          onTargetChange: setRequestCodeTarget,
          onInsert: insertRequestCodeSnippet,
        }}
        collectionScripts={{
          open: collectionScriptsOpen,
          collectionId: collectionScriptsTarget ?? "",
          collectionName: workspace?.collections?.find((c) => c.id === collectionScriptsTarget)?.name ?? "",
          preScript: collectionPreScript,
          postScript: collectionPostScript,
          activeVars,
          collectionVariables: collectionScriptsTarget
            ? (workspace?.collections?.find((c) => c.id === collectionScriptsTarget)?.variables ?? [])
            : [],
          onClose: () => setCollectionScriptsOpen(false),
          onPreScriptChange: setCollectionPreScript,
          onPostScriptChange: setCollectionPostScript,
          onSave: handleSaveCollectionScripts,
          onSaveScopedVariable: handleSaveScopedVariable,
          onDeleteScopedVariable: handleDeleteScopedVariable,
        }}
        collectionEditor={{
          open: collectionEditorOpen,
          collectionId: collectionEditorTarget ?? "",
          collectionName: workspace?.collections?.find((c) => c.id === collectionEditorTarget)?.name ?? "",
          collectionVariables: collectionEditorTarget
            ? (workspace?.collections?.find((c) => c.id === collectionEditorTarget)?.variables ?? [])
            : [],
          defaultEnvironment: workspace?.collections?.find((c) => c.id === collectionEditorTarget)?.defaultEnvironment,
          environments: workspace?.environments ?? [],
          onClose: () => setCollectionEditorOpen(false),
          onSaveScopedVariable: handleSaveScopedVariable,
          onDeleteScopedVariable: handleDeleteScopedVariable,
          onUpdateCollectionDefaultEnvironment: updateCollectionDefaultEnvironment,
        }}
        curlImport={{
          open: curlImportOpen,
          onClose: () => setCurlImportOpen(false),
          onImport: handleCurlImport,
        }}
        responseWindow={{
          open: responseWindowOpen,
          responseState,
          currentResponse,
          responseTitle,
          responseTitleColor,
          isResponseTabPending,
          responseTab,
          previewMode,
          activeBottomDock,
          onTabChange: handleResponseTabChange,
          onPreviewModeChange: setPreviewMode,
          onDownload: downloadCurrentResponse,
          onCopy: () => void copyCurrentResponse(),
          onOpenHistory: () => {
            if (selectedRequestId) {
              setHistorySearch(selectedRequestId);
              handleOpenHistory();
            }
          },
          onOpenWindow: () => {},
          onResizerMouseDown: handleResponsePanelResizerMouseDown,
          onClose: () => setResponseWindowOpen(false),
        }}
      />

      {contextMenu && (
        <ContextMenu
          menu={contextMenu}
          requests={workspace?.requests ?? []}
          onClose={() => setContextMenu(null)}
          onCreateRequest={(folderId) => {
            setCreateRequestInitialFolderId(folderId);
            setCreateRequestModalOpen(true);
          }}
          onCreateFolder={handleCreateFolder}
          onCreateSubFolder={handleCreateSubFolder}
          onEditFolder={openFolderTab}
          onEditCollection={openCollectionTab}
          onDeleteFolder={handleDeleteFolder}
          onStartRequestRename={startRequestRename}
          onViewRequest={handleSelectRequest}
          onDeleteRequest={handleDeleteRequest}
          onDuplicateRequest={handleDuplicateRequest}
          onDeleteCollection={handleDeleteCollection}
          onCurlImport={() => {
            setUniversalImportInitialContent("");
            setUniversalImportModalOpen(true);
          }}
          onImport={() => {
            setUniversalImportInitialContent("");
            setUniversalImportModalOpen(true);
          }}
          onExport={() => void handleExport()}
          onSetSelectionAsVariable={(text) => {
            if (!workspace?.activeEnvironment) {
              alert("No active environment. Please set one first.");
              return;
            }
            setSetEnvVarModal({ open: true, text });
          }}
          onMoveItemTo={(reqId, type) => setMoveToModal({ id: reqId, type })}
          onRunFolder={(folderId) => setCollectionRunner({ scopeId: folderId, scopeType: "folder" })}
          onRunCollection={(collectionId) => setCollectionRunner({ scopeId: collectionId, scopeType: "collection" })}
          onCloseTab={closeTab}
          onCloseOtherTabs={handleCloseOtherTabs}
          onCloseAllTabs={handleCloseAllTabs}
          onExpandCollectionFolders={expandCollectionFolders}
          onCollapseCollectionFolders={collapseCollectionFolders}
        />
      )}

      {collectionRunner && workspace && (
        <CollectionRunner
          workspace={workspace}
          scopeId={collectionRunner.scopeId}
          scopeType={collectionRunner.scopeType}
          onClose={() => setCollectionRunner(null)}
          runScript={runScript}
          persistVariable={(key, value) => {
            const envName = workspace.activeEnvironment;
            if (!envName) return;
            void handleSaveVariable(envName, key, value);
          }}
          removeVariable={(key) => {
            const envName = workspace.activeEnvironment;
            if (!envName) return;
            void handleDeleteVariable(envName, key);
          }}
        />
      )}

      {moveToModal && workspace && (
        <MoveToModal
          workspace={workspace}
          itemType={moveToModal.type}
          itemId={moveToModal.id}
          onClose={() => setMoveToModal(null)}
          onMove={handleMoveItem}
        />
      )}

      <CreateRequestModal
        open={createRequestModalOpen}
        workspace={workspace}
        workspaces={workspaceList}
        initialFolderId={createRequestInitialFolderId}
        initialName={draftRequest && unsavedRequests[draftRequest.id] ? draftRequest.name : "New Request"}
        initialMethod={draftRequest && unsavedRequests[draftRequest.id] ? draftRequest.method : "GET"}
        onClose={() => setCreateRequestModalOpen(false)}
        onCreate={async (name, method, locationTarget, targetWorkspaceId) => {
          setCollectionSearch("");
          const isUnsaved = Boolean(draftRequest && unsavedRequests[draftRequest.id]);
          const oldTempId = isUnsaved ? draftRequest!.id : null;
          const oldDraftData = isUnsaved ? { ...draftRequest! } : null;

          const createdReq = await handleCreateRequestWithDetails(name, method, locationTarget, targetWorkspaceId);

          if (oldTempId && oldDraftData && createdReq) {
            lastSelectedRequestIdRef.current = createdReq.id;
            const targetLocId = locationTarget.replace(/^(collection|folder|new_col):/, "").trim();
            const fullReq: SavedRequest = {
              ...oldDraftData,
              id: createdReq.id,
              name: createdReq.name,
              method: createdReq.method,
              folderId: createdReq.folderId || targetLocId,
            };
            await saveRequest(fullReq);
            try {
              const freshWorkspace = await loadLocalWorkspace();
              setWorkspace(freshWorkspace);
            } catch (e) {
              console.error(e);
            }
            setDraftRequest(fullReq);
            setTabs((prev) => {
              const mapped = prev.map((t) => {
                if (t.entityId === oldTempId || t.id === `tab-${oldTempId}`) {
                  return {
                    ...t,
                    id: `tab-${createdReq.id}`,
                    entityId: createdReq.id,
                    name: createdReq.name,
                    method: createdReq.method,
                    isDirty: false,
                  };
                }
                return t;
              });
              const seen = new Set<string>();
              return mapped.filter((t) => {
                const key = `${t.type}:${t.entityId}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
              });
            });
            setActiveTabId(`tab-${createdReq.id}`);
            setSelectedRequestId(createdReq.id);
            setUnsavedRequests((prev) => {
              const next = { ...prev };
              delete next[oldTempId];
              return next;
            });
          }
          setCreateRequestModalOpen(false);
        }}
      />

      <SetEnvVarModal
        open={setEnvVarModal.open}
        selectedText={setEnvVarModal.text}
        environments={workspace?.environments ?? []}
        activeEnvironment={workspace?.activeEnvironment ?? ""}
        requestId={draftRequest?.id}
        requestName={draftRequest?.name}
        folderId={requestFolder?.id}
        folderName={requestFolder?.name}
        collectionId={requestCollection?.id}
        collectionName={requestCollection?.name}
        onConfirm={(scope, varName, value) => {
          if (scope.type === "environment") {
            void handleSaveVariable(scope.envName, varName, value);
          } else {
            void handleSaveScopedVariable(scope.entityId, scope.type, varName, value);
          }
          if (selectionReplaceFnRef.current) {
            selectionReplaceFnRef.current(varName);
          }
        }}
        onClose={() => setSetEnvVarModal({ open: false, text: "" })}
      />

      <WorkspaceSwitcherModal
        open={workspaceSwitcherOpen}
        activeWorkspaceId={workspace?.id ?? ""}
        workspaceList={workspaceList}
        onCreate={(name) => void handleCreateWorkspace(name)}
        onSwitch={(id) => {
          const dirtyCount = tabs.filter((t) => t.isDirty).length;
          if (dirtyCount > 0) {
            setConfirmDialog({
              title: "Unsaved Changes",
              message: `You have unsaved changes in ${dirtyCount} tab(s). Are you sure you want to discard them and switch workspaces?`,
              confirmVariant: "danger",
              confirmLabel: "Discard & Switch",
              onConfirm: () => {
                void handleSwitchWorkspace(id);
                setWorkspaceSwitcherOpen(false);
              },
            });
          } else {
            void handleSwitchWorkspace(id);
            setWorkspaceSwitcherOpen(false);
          }
        }}
        onRename={(id, name) => void handleRenameWorkspace(id, name)}
          onDelete={(id, name) => {
            setConfirmDialog({
              title: "Delete Workspace",
              message: `Delete workspace "${name}"? All its data will be permanently removed.`,
              confirmVariant: "danger",
              confirmLabel: "Delete",
              onConfirm: () => void handleDeleteWorkspace(id),
            });
          }}
        onClose={() => setWorkspaceSwitcherOpen(false)}
      />

      <ApiToolsModal
        open={apiToolsOpen}
        onClose={() => setApiToolsOpen(false)}
        collections={workspace?.collections || []}
      />

      <UniversalImportModal
        isOpen={universalImportModalOpen}
        onClose={() => setUniversalImportModalOpen(false)}
        initialContent={universalImportInitialContent}
        onImportCollection={handleImportPostmanCollection}
        onImportEnvironment={handleImportPostmanEnvironment}
        onImportCurl={handleImportCurlAsDraft}
        onImportSuccess={async (jsonPayload) => {
          await importWorkspaceData(jsonPayload);
          await loadWorkspace();
        }}
      />

      <ChainRequestModal
        isOpen={chainRequestModal?.open || false}
        initialValue={chainRequestModal?.initialValue || ""}
        workspace={workspace}
        onClose={() => setChainRequestModal(null)}
        onSave={(newVal) => {
          chainRequestModal?.onSave(newVal);
        }}
      />
    </main>
  );
}
