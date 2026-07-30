import { useEffect, useState, useTransition, useRef, useMemo, type ClipboardEvent, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { ChevronDown, ChevronUp, Download, History, RefreshCw, Settings, PanelLeftOpen } from "lucide-react";
import { PRODUCT_AUTHENTICATION_MODEL } from "./product-contract";
import { executeHttpRequest } from "./services/http-client";
import { resolveRequestVariables, resolveRequestFields, resolveRequestFieldsSafe, UnresolvedVariableError, activeEnvironmentVariables, buildVariableMap, buildScopedVariableMap, activeScopedVariablesList, resolveString } from "./services/variables";
import { type ResponseTab } from "./components/ResponsePanel";
import { ModalManager } from "./components/ModalManager";
import { ContextMenu } from "./components/ContextMenu";
import { SetEnvVarModal } from "./components/SetEnvVarModal";
import { MoveToModal } from "./components/MoveToModal";
import { Topbar } from "./components/Topbar";
import { BottomDock } from "./components/BottomDock";
import { statusColor, type ResponseState, type PreviewMode } from "./response-utils";
import {
  formatTimestamp,
  openProductDocs,
  createScriptVariablesObject,
  getEffectiveAuth,
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
import { UniversalImportModal } from "./components/UniversalImportModal";
import { applyAuth, resolveAuthConfig, redactAuthFromUrl, obtainOAuth2Token } from "./services/auth";

import {
  SCRIPT_SNIPPETS,
  generateRequestCodeSnippet,
  parseCurlCommand,
} from "./services/script-tools";
import type { CurlImportResult } from "./services/script-tools";
import {
  recordRequestHistory,
  getScripts,
  loadHistoryResponse,
  importWorkspaceData,
} from "./services/local-store";
import type { SavedRequest, Tab } from "./types";
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
  const [activeBottomDock, setActiveBottomDock] = useState<'response' | 'console' | null>('response');
  const [bottomDockHeight, setBottomDockHeight] = useState(320);
  const [isResponsePanelResizing, setIsResponsePanelResizing] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const [headersPresetMenuOpen, setHeadersPresetMenuOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<import("./components/ConfirmDialog").ConfirmDialogState | null>(null);
  const [newVarKey, setNewVarKey] = useState("");
  const [newVarValue, setNewVarValue] = useState("");
  const [newVarSecret, setNewVarSecret] = useState(false);
  const [envEditorOpen, setEnvEditorOpen] = useState(false);
  const [setEnvVarModal, setSetEnvVarModal] = useState<{ open: boolean; text: string }>({ open: false, text: "" });
  const [collectionEditorOpen, setCollectionEditorOpen] = useState(false);
  const [collectionEditorTarget, setCollectionEditorTarget] = useState<string>("");
  const [curlImportOpen, setCurlImportOpen] = useState(false);
  const [createRequestModalOpen, setCreateRequestModalOpen] = useState(false);
  const [createRequestInitialFolderId, setCreateRequestInitialFolderId] = useState<string | undefined>(undefined);
  const [workspaceSwitcherOpen, setWorkspaceSwitcherOpen] = useState(false);
  const [moveToModal, setMoveToModal] = useState<{ type: "request" | "folder"; id: string } | null>(null);

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
    handleDeleteCollection,
    toggleFolder,
    expandAllFolders,
    collapseAllFolders,
    handleCreateRequest,
    handleCreateRequestWithDetails,
    importCurlRequest,
    handleSetActiveEnvironment,
    handleCreateEnvironment,
    handleDeleteEnvironment,
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

  const {
    historyOpen, setHistoryOpen,
    historyEntries, setHistoryEntries,
    historySearch, setHistorySearch,
    historyLoading, setHistoryLoading,
    handleOpenHistory,
    handleClearHistory,
    handleReplayFromHistory,
  } = useHistory(workspace, setSelectedRequestId);



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

  function updateDraft(fields: Partial<SavedRequest>) {
    if (draftRequest) {
      setDraftRequest({ ...draftRequest, ...fields });
    }
  }

  function handleCurlImport(result: CurlImportResult) {
    importCurlRequest({
      method: result.method,
      customMethod: result.customMethod,
      url: result.url,
      queryParams: [], // We can just rely on the url being parsed later, wait, no! We need deriveQueryParamsFromUrl here if we want to be perfect, but `createRequest` returns an empty array which is fine. Wait, `url` is what matters, but when the UI renders, it might depend on `queryParams` array being correctly set. I will leave this as empty array for now, or maybe just omit it so it uses `newReq.queryParams`. Actually I'll use `[]` as fallback.
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
    const scopeWorkspace = workspace ?? { id: "tmp", name: "Temporary", activeEnvironment: "", environments: [], folders: [], requests: [] };
    const scopedFolder = scopeWorkspace.folders.find((f) => f.id === draftRequest.folderId);
    const variableMap = buildScopedVariableMap(scopeWorkspace, {
      collectionId: scopedFolder?.collectionId,
      folderId: draftRequest.folderId,
      request: draftRequest,
    });

    // 1. Execute Pre-scripts (Hierarchy: Collection -> Folder -> Request)
    const persistVariable = (key: string, value: string) => {
      const envName = workspace?.activeEnvironment;
      if (!envName) return;
      void handleSaveVariable(envName, key, value);
    };
    const removeVariable = (key: string) => {
      const envName = workspace?.activeEnvironment;
      if (!envName) return;
      void handleDeleteVariable(envName, key);
    };
    const preScriptsContext: KbScriptContext = {
      request: { ...draftRequest },
      variables: Object.fromEntries(variableMap),
      setVariable: persistVariable,
      deleteVariable: removeVariable,
    };
    
    try {
      if (scopedFolder?.collectionId) {
        const collectionScripts = await getScripts(scopedFolder.collectionId, 'collection');
        const preCollection = collectionScripts.find(s => s.scriptType === 'pre')?.content;
        if (preCollection) {
          const resolved = resolveString(preCollection, variableMap).resolved;
          scriptOutputEntries.push(...(await runScript(resolved, preScriptsContext, "Collection pre-request")));
        }
      }

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

    // Rebuild scoped map using the (possibly script-modified) requestId for request-level vars.
    const scopedFolder2 = scopeWorkspace.folders.find((f) => f.id === requestToSend.folderId);
    const updatedVariableMap = buildScopedVariableMap(scopeWorkspace, {
      collectionId: scopedFolder2?.collectionId,
      folderId: requestToSend.folderId,
      request: requestToSend,
    });

    let resolvedUrl: string;
    let resolvedHeaders: Array<{ key: string; value: string; enabled: boolean }>;
    let resolvedBody: string | undefined;

    try {
      const resolved = resolveRequestFields(
        updatedVariableMap,
        requestToSend.url,
        requestToSend.headers,
        requestToSend.body || undefined,
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

    // variableMap already holds the scoped + secret-resolved values built above.
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

    // Log the outgoing request
    scriptOutputEntries.push({
      type: "request",
      tone: "info",
      message: `${effectiveMethod} ${authUrl}`,
      request: {
        method: effectiveMethod,
        url: authUrl,
        headers: authHeaders,
        queryParams: requestToSend.queryParams || [],
        body: resolvedBody,
        authMode: finalAuthMode,
        timeoutMs: requestToSend.timeoutMs,
        followRedirects: requestToSend.followRedirects,
        timestamp: new Date().toISOString(),
      },
    });

    try {
      const response = await executeHttpRequest({
        method: effectiveMethod,
        url: authUrl,
        headers: authHeaders,
        body: resolvedBody,
        bodyMimeType: requestToSend.bodyMimeType,
        bodyForm: requestToSend.bodyForm,
        timeoutMs: requestToSend.timeoutMs,
        followRedirects: requestToSend.followRedirects,
      });
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
        variables: Object.fromEntries(updatedVariableMap),
        setVariable: persistVariable,
        deleteVariable: removeVariable,
      };
      
      try {
        const reqScripts = await getScripts(requestToSend.id, 'request');
        const postReq = reqScripts.find(s => s.scriptType === 'post')?.content;
        if (postReq) {
          const resolved = resolveString(postReq, updatedVariableMap).resolved;
          scriptOutputEntries.push(...(await runScript(resolved, postScriptsContext, "Request post-response")));
        }
        
        const folderScripts = await getScripts(requestToSend.folderId, 'folder');
        const postFolder = folderScripts.find(s => s.scriptType === 'post')?.content;
        if (postFolder) {
          const resolved = resolveString(postFolder, updatedVariableMap).resolved;
          scriptOutputEntries.push(...(await runScript(resolved, postScriptsContext, "Folder post-response")));
        }

        if (scopedFolder2?.collectionId) {
          const collectionScripts = await getScripts(scopedFolder2.collectionId, 'collection');
          const postCollection = collectionScripts.find(s => s.scriptType === 'post')?.content;
          if (postCollection) {
            const resolved = resolveString(postCollection, updatedVariableMap).resolved;
            scriptOutputEntries.push(...(await runScript(resolved, postScriptsContext, "Collection post-response")));
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

      const historyUrl = redactAuthFromUrl(authUrl, finalAuthMode, resolvedAuth);
      void recordRequestHistory({
        requestId: requestToSend.id,
        method: effectiveMethod,
        url: historyUrl,
        status: response.status,
        durationMs: response.durationMs,
        sizeBytes: response.sizeBytes,
        responseHeaders: JSON.stringify(response.headers),
        responseBodyText: response.bodyText,
        responseBodyBase64: response.bodyBase64,
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
    if (!original) return false;
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
  useEffect(() => {
    if (!selectedRequestId) {
      return;
    }
    // If this request is already in a tab, just activate that tab
    const existingTab = tabs.find((tab) => tab.type === "request" && tab.entityId === selectedRequestId);
    if (existingTab) {
      if (activeTabId !== existingTab.id) {
        setActiveTabId(existingTab.id);
      }
      return;
    }
    // Otherwise, create a new tab for this request
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
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, [selectedRequestId, tabs, activeTabId, workspace]);

  function openFolderTab(folderId: string) {
    const folder = workspace?.folders.find((f) => f.id === folderId);
    if (!folder) return;

    const existingTab = tabs.find((tab) => tab.type === "folder" && tab.entityId === folderId);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      setFolderScriptsTarget(folderId);
      setFolderScriptsOpen(true);
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
    setFolderScriptsTarget(folderId);
    setFolderScriptsOpen(true);
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

      const newTabs = prev.filter((tab) => tab.id !== tabId);

      if (activeTabId === tabId) {
        if (newTabs.length > 0) {
          const newIndex = Math.min(index, newTabs.length - 1);
          const nextTab = newTabs[newIndex];
          setActiveTabId(nextTab.id);
          if (nextTab.type === "request") {
            setSelectedRequestId(nextTab.entityId);
          } else if (nextTab.type === "folder") {
            setFolderScriptsTarget(nextTab.entityId);
            setFolderScriptsOpen(true);
          }
        } else {
          setActiveTabId(null);
          setSelectedRequestId(null);
        }
      }

      return newTabs;
    });
  }

  function promptSaveRequest() {
    if (!draftRequest) return;
    if (!isDraftDirty) {
      void handleSaveRequest();
      return;
    }
    setConfirmDialog({
      title: "Save Request Changes",
      message: `Do you want to save the changes made to "${draftRequest.name}"?`,
      confirmLabel: "Save Changes",
      confirmVariant: "primary",
      onConfirm: () => {
        void handleSaveRequest();
      },
    });
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
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [draftRequest, isDraftDirty, workspace]);

  const selectionReplaceFnRef = useRef<((varName: string) => void) | null>(null);
  const pendingSelectionRef = useRef<{ text: string; replaceFn: ((varName: string) => void) | null } | null>(null);

  // Capture text selection on right-mousedown BEFORE the browser clears it
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 2) return;
      let text = window.getSelection()?.toString().trim() || "";
      let replaceFn: ((varName: string) => void) | null = null;

      const target = e.target as HTMLElement;
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

  const handleGlobalContextMenu = (_e: React.MouseEvent<HTMLElement>) => {
    // Handled by the native listener in useEffect above
  };

  return (
    <main
      className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${isSidebarResizing ? "sidebar-resizing" : ""}`}
      style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
      onContextMenu={handleGlobalContextMenu}
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
        onSelectRequest={setSelectedRequestId}
        onDeleteRequest={handleDeleteRequest}
        onCreateRequest={(folderId) => {
          setCreateRequestInitialFolderId(folderId);
          setCreateRequestModalOpen(true);
          return Promise.resolve();
        }}
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
        onExpandAll={expandAllFolders}
        onCollapseAll={collapseAllFolders}
        onContextMenu={(target, x, y) => setContextMenu({ x, y, target })}
        onDismissDeleteError={() => setDeleteError(null)}
        onOpenDocs={openProductDocs}
        onOpenHistory={() => void handleOpenHistory()}
        onCheckForUpdates={() => void handleCheckForUpdates("manual")}
        onOpenSettings={() => setSettingsOpen(true)}
        onExport={() => void handleExport()}
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

        <div className="workspace-main">
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId}
            onTabClick={(tab) => {
              setActiveTabId(tab.id);
              if (tab.type === "request") {
                setSelectedRequestId(tab.entityId);
              } else if (tab.type === "folder") {
                setFolderScriptsTarget(tab.entityId);
                setFolderScriptsOpen(true);
              }
            }}
            onTabClose={closeTab}
          />
          {draftRequest ? (
            <RequestPanel
              draftRequest={draftRequest}
              activeVars={activeVars}
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
                    onClick={() => {
                      setCreateRequestInitialFolderId(undefined);
                      setCreateRequestModalOpen(true);
                    }}
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
          )}

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
        folderScripts={{
          open: folderScriptsOpen,
          folderId: folderScriptsTarget ?? "",
          preScript: folderPreScript,
          postScript: folderPostScript,
          activeVars,
          folderVariables: folderScriptsTarget
            ? (workspace?.folders.find((f) => f.id === folderScriptsTarget)?.variables ?? [])
            : [],
          onClose: () => setFolderScriptsOpen(false),
          onPreScriptChange: setFolderPreScript,
          onPostScriptChange: setFolderPostScript,
          onSave: handleSaveFolderScripts,
          onSaveScopedVariable: handleSaveScopedVariable,
          onDeleteScopedVariable: handleDeleteScopedVariable,
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
          collectionId: collectionEditorTarget,
          collectionName: workspace?.collections?.find((c) => c.id === collectionEditorTarget)?.name ?? "",
          collectionVariables: workspace?.collections?.find((c) => c.id === collectionEditorTarget)?.variables ?? [],
          onClose: () => setCollectionEditorOpen(false),
          onSaveScopedVariable: handleSaveScopedVariable,
          onDeleteScopedVariable: handleDeleteScopedVariable,
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
          onEditFolderAuth={(folderId) => {
            setAuthEditorTarget({ id: folderId, type: 'folder' });
            setAuthEditorOpen(true);
          }}
          onEditFolderScripts={handleOpenFolderScripts}
          onEditFolderVariables={(folderId) => handleOpenFolderScripts(folderId)}
          onEditCollectionAuth={(collectionId) => {
            setAuthEditorTarget({ id: collectionId, type: 'collection' });
            setAuthEditorOpen(true);
          }}
          onEditCollectionScripts={handleOpenCollectionScripts}
          onEditCollectionVariables={(collectionId) => {
            setCollectionEditorTarget(collectionId);
            setCollectionEditorOpen(true);
          }}
          onDeleteFolder={handleDeleteFolder}
          onStartRequestRename={startRequestRename}
          onViewRequest={setSelectedRequestId}
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
        onClose={() => setCreateRequestModalOpen(false)}
        onCreate={async (name, method, locationTarget, targetWorkspaceId) => {
          setCollectionSearch("");
          await handleCreateRequestWithDetails(name, method, locationTarget, targetWorkspaceId);
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
        onSwitch={(id) => { void handleSwitchWorkspace(id); setWorkspaceSwitcherOpen(false); }}
        onRename={(id, name) => void handleRenameWorkspace(id, name)}
        onDelete={(id) => void handleDeleteWorkspace(id)}
        onClose={() => setWorkspaceSwitcherOpen(false)}
      />

      <UniversalImportModal
        isOpen={universalImportModalOpen}
        onClose={() => setUniversalImportModalOpen(false)}
        initialContent={universalImportInitialContent}
        onImportCollection={handleImportPostmanCollection}
        onImportEnvironment={handleImportPostmanEnvironment}
        onImportSuccess={async (jsonPayload) => {
          await importWorkspaceData(jsonPayload);
          await loadWorkspace();
        }}
      />
    </main>
  );
}
