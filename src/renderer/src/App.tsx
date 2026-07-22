import { useEffect, useState, useTransition, type ClipboardEvent, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { PRODUCT_AUTHENTICATION_MODEL } from "./product-contract";
import { executeHttpRequest } from "./services/http-client";
import { resolveRequestVariables, UnresolvedVariableError, activeEnvironmentVariables, buildVariableMap, resolveString } from "./services/variables";
import { type PreviewMode, type ResponseTab } from "./components/ResponsePanel";
import { ModalManager } from "./components/ModalManager";
import { ContextMenu } from "./components/ContextMenu";
import { Topbar } from "./components/Topbar";
import { BottomDock } from "./components/BottomDock";
import { statusColor, type ResponseState } from "./response-utils";
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
import { applyAuth, resolveAuthConfig, redactAuthFromUrl, obtainOAuth2Token } from "./services/auth";

import {
  SCRIPT_SNIPPETS,
  generateRequestCodeSnippet,
} from "./services/script-tools";
import {
  recordRequestHistory,
  getScripts,
} from "./services/local-store";
import type { SavedRequest } from "./types";

type ScriptOutputEntry = { tone: "info" | "error"; message: string };

const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_DEFAULT_WIDTH = 280;
const SIDEBAR_MAX_WIDTH = 460;

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
  const [isSidebarResizing, setIsSidebarResizing] = useState(false);
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

  const [headersPresetMenuOpen, setHeadersPresetMenuOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [newVarKey, setNewVarKey] = useState("");
  const [newVarValue, setNewVarValue] = useState("");
  const [newVarSecret, setNewVarSecret] = useState(false);
  const [envEditorOpen, setEnvEditorOpen] = useState(false);

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
        void handleCheckForUpdates("automatic", { ...appSettings, updateChecksEnabled: loadedSettings.updateChecksEnabled });
      }
    },
  });
  const {
    workspace, setWorkspace,
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
    handleCreateFolder,
    handleCreateCollection,
    handleCreateSubFolder,
    handleDeleteFolder,
    handleDeleteCollection,
    toggleFolder,
    handleCreateRequest,
    handleSetActiveEnvironment,
    handleCreateEnvironment,
    handleDeleteEnvironment,
    handleSaveVariable,
    handleDeleteVariable,
    handleAddSecretVariable,
    handleRenameEnvironment,
    applyEnvironmentRename,
    cancelEnvironmentRename,
  } = ws;

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
    scriptEditorActionsRef,
    insertScriptToken, setCurrentScriptValue, handlePrettifyScript,
    handleOpenFolderScripts, handleSaveFolderScripts, handleSaveScripts, runScript
  } = useScripts(selectedRequestId);

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
    
    let variableMap = buildVariableMap(activeEnvironmentVariables(workspace));
    const scriptOutputEntries: ScriptOutputEntry[] = [];

    // 1. Execute Pre-scripts (Hierarchy: Folder -> Request)
    // Note: Collection level is not yet fully implemented in the store, focusing on Folder -> Request
    const persistVariable = (key: string, value: string) => {
      const envName = workspace?.activeEnvironment;
      if (!envName) return;
      void handleSaveVariable(envName, key, value);
    };
    const preScriptsContext: KbScriptContext = {
      request: { ...draftRequest },
      variables: createScriptVariablesObject(activeVars),
      setVariable: persistVariable,
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
      const postScriptsContext: KbScriptContext = {
        request: requestToSend,
        response: response,
        variables: createScriptVariablesObject(activeVars),
        setVariable: persistVariable,
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
        <Topbar
          onOpenDocs={openProductDocs}
          onOpenHistory={() => void handleOpenHistory()}
          onCheckForUpdates={() => void handleCheckForUpdates("manual")}
          onOpenSettings={() => setSettingsOpen(true)}
        />

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
            onActiveBottomDockChange={setActiveBottomDock}
            onTabChange={handleResponseTabChange}
            onPreviewModeChange={setPreviewMode}
            onDownload={downloadCurrentResponse}
            onCopy={() => void copyCurrentResponse()}
            onOpenWindow={() => setResponseWindowOpen(true)}
            onResizerMouseDown={handleResponsePanelResizerMouseDown}
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
          newVarKey,
          newVarValue,
          newVarSecret,
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
          onNewVarKeyChange: setNewVarKey,
          onNewVarValueChange: setNewVarValue,
          onNewVarSecretChange: setNewVarSecret,
          onSaveVariable: handleSaveVariable,
          onAddSecretVariable: handleAddSecretVariable,
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
          preScript: folderPreScript,
          postScript: folderPostScript,
          activeVars,
          onClose: () => setFolderScriptsOpen(false),
          onPreScriptChange: setFolderPreScript,
          onPostScriptChange: setFolderPostScript,
          onSave: handleSaveFolderScripts,
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
          onOpenWindow: () => setResponseWindowOpen(true),
          onResizerMouseDown: handleResponsePanelResizerMouseDown,
          onClose: () => setResponseWindowOpen(false),
        }}
      />

      {contextMenu && (
        <ContextMenu
          menu={contextMenu}
          requests={workspace?.requests ?? []}
          onClose={() => setContextMenu(null)}
          onCreateRequest={handleCreateRequest}
          onCreateSubFolder={handleCreateSubFolder}
          onEditFolderAuth={(folderId) => {
            setAuthEditorTarget({ id: folderId, type: 'folder' });
            setAuthEditorOpen(true);
          }}
          onEditFolderScripts={handleOpenFolderScripts}
          onDeleteFolder={handleDeleteFolder}
          onStartRequestRename={startRequestRename}
          onViewRequest={setSelectedRequestId}
          onDeleteRequest={handleDeleteRequest}
        />
      )}
    </main>
  );
}
