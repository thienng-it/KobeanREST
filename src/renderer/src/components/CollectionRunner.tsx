import { createPortal } from "react-dom";
import { useEffect, useRef, useState, useCallback, type CSSProperties } from "react";
import {
  X, Play, Square, CheckCircle, XCircle, Clock, ChevronDown, ChevronRight,
  Loader, RefreshCw, Filter, CheckSquare, Square as SquareIcon, History
} from "lucide-react";
import type { SavedRequest, WorkspaceSummary, ExecuteHttpResponse } from "../types";
import { executeHttpRequest } from "../services/http-client";
import { buildScopedVariableMap, resolveRequestFields, resolveString, UnresolvedVariableError, injectAsyncVariables } from "../services/variables";
import { applyAuth, resolveAuthConfig, obtainOAuth2Token } from "../services/auth";
import { getScripts, recordRequestHistory, loadCollectionRuns, loadCollectionRunDetails } from "../services/local-store";
import type { KbScriptContext } from "../services/script-runtime";
import { formatResponseBody } from "../response-utils";

export interface CollectionRunnerProps {
  workspace: WorkspaceSummary;
  /** If set, pre-filters the runner to a specific folder or collection id */
  scopeId: string;
  /** "folder" | "collection" */
  scopeType: "folder" | "collection";
  onClose: () => void;
  runScript: (script: string, ctx: KbScriptContext, label: string) => Promise<any[]>;
  persistVariable: (key: string, value: string) => void;
  removeVariable: (key: string) => void;
}

interface RequestResult {
  request: SavedRequest;
  status: "pending" | "running" | "passed" | "failed" | "skipped";
  response?: ExecuteHttpResponse;
  executedRequest?: import("../types").ExecuteHttpRequest;
  error?: string;
  durationMs?: number;
}

export function CollectionRunner({
  workspace,
  scopeId,
  scopeType,
  onClose,
  runScript,
  persistVariable,
  removeVariable,
}: CollectionRunnerProps) {
  // --- Collect all requests under the scope ---
  const allRequests = useRef<SavedRequest[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<RequestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const [delay, setDelay] = useState(0);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"new-run" | "history">("new-run");
  const [pastRuns, setPastRuns] = useState<import("../types").CollectionRunSummary[]>([]);
  const [selectedRun, setSelectedRun] = useState<import("../types").CollectionRunSummary | null>(null);
  const [runDetails, setRunDetails] = useState<import("../types").HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [resultFilter, setResultFilter] = useState<"all" | "passed" | "failed">("all");
  const [historyFilter, setHistoryFilter] = useState<"all" | "passed" | "failed">("all");
  const [expandedHistoryItems, setExpandedHistoryItems] = useState<Set<number>>(new Set());
  const abortRef = useRef(false);
  const pauseRef = useRef(false);
  const scopeName =
    scopeType === "folder"
      ? workspace.folders.find((f) => f.id === scopeId)?.name
      : workspace.collections?.find((c) => c.id === scopeId)?.name;

  // Build ordered list of requests under this scope
  function collectRequestsForFolder(folderId: string, depth = 0): SavedRequest[] {
    const requests = workspace.requests.filter((r) => r.folderId === folderId);
    const subFolders = workspace.folders.filter((f) => f.parentId === folderId);
    const subRequests: SavedRequest[] = [];
    for (const f of subFolders) {
      subRequests.push(...collectRequestsForFolder(f.id, depth + 1));
    }
    return [...requests, ...subRequests];
  }

  function collectRequests(): SavedRequest[] {
    if (scopeType === "folder") {
      return collectRequestsForFolder(scopeId);
    } else {
      // Collection: top-level requests + all folders
      const rootRequests = workspace.requests.filter((r) => r.folderId === scopeId);
      const rootFolders = workspace.folders.filter(
        (f) => f.collectionId === scopeId && !f.parentId
      );
      const folderRequests: SavedRequest[] = [];
      for (const f of rootFolders) {
        folderRequests.push(...collectRequestsForFolder(f.id));
      }
      return [...rootRequests, ...folderRequests];
    }
  }

  useEffect(() => {
    const reqs = collectRequests();
    allRequests.current = reqs;
    setSelectedIds(new Set(reqs.map((r) => r.id)));
    setResults(reqs.map((r) => ({ request: r, status: "pending" })));
    // Load history when component mounts
    loadHistory();
  }, [scopeId]);

  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const runs = await loadCollectionRuns(scopeId);
      setPastRuns(runs);
    } catch (err) {
      console.error("Failed to load collection run history", err);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function loadRunDetails(run: import("../types").CollectionRunSummary) {
    setSelectedRun(run);
    setLoadingHistory(true);
    try {
      const details = await loadCollectionRunDetails(run.runId);
      setRunDetails(details);
    } catch (err) {
      console.error("Failed to load run details", err);
    } finally {
      setLoadingHistory(false);
    }
  }

  // Helper to detect content type and format response body
  function formatStoredResponse(body: string | null | undefined, headers: string | null | undefined): string {
    if (!body) return "(empty body)";
    
    // Try to detect JSON from headers
    const isJson = headers?.toLowerCase().includes("application/json") || 
                   headers?.toLowerCase().includes("application/vnd.api+json");
    
    if (isJson) {
      try {
        return JSON.stringify(JSON.parse(body), null, 2);
      } catch {
        return body;
      }
    }
    
    // Try to detect XML/HTML
    const isXml = headers?.toLowerCase().includes("application/xml") || 
                  headers?.toLowerCase().includes("text/xml") ||
                  headers?.toLowerCase().includes("text/html");
    
    if (isXml) {
      return formatResponseBody(body, "xml");
    }
    
    return body;
  }

  // Helper to parse headers string into array for better display
  function parseHeadersString(headersStr: string | null | undefined): Array<{ key: string; value: string }> {
    if (!headersStr) return [];
    
    try {
      // Try parsing as JSON first (stored format from response.headers)
      const parsed = JSON.parse(headersStr);
      if (Array.isArray(parsed)) {
        return parsed.map(h => ({
          key: h.key || '',
          value: h.value || ''
        }));
      }
    } catch {
      // Fall back to newline-separated format
      try {
        const lines = headersStr.split('\n').filter(line => line.trim());
        return lines.map(line => {
          const colonIndex = line.indexOf(':');
          if (colonIndex === -1) return { key: line, value: '' };
          return {
            key: line.substring(0, colonIndex).trim(),
            value: line.substring(colonIndex + 1).trim()
          };
        });
      } catch {
        return [];
      }
    }
    
    return [];
  }

  const toggleRequest = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === allRequests.current.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allRequests.current.map((r) => r.id)));
    }
  };

  const resetRun = useCallback(() => {
    abortRef.current = false;
    pauseRef.current = false;
    setIsRunning(false);
    setIsPaused(false);
    setFinished(false);
    setResults(allRequests.current.map((r) => ({ request: r, status: "pending" })));
  }, []);

  async function executeOne(
    req: SavedRequest, 
    runWorkspace: WorkspaceSummary, 
    runId?: string,
    inMemoryResponses?: Map<string, ExecuteHttpResponse>
  ): Promise<RequestResult> {
    const folder = runWorkspace.folders.find((f) => f.id === req.folderId);
    const collectionId = folder?.collectionId;
    const variableMap = buildScopedVariableMap(runWorkspace, {
      collectionId,
      folderId: req.folderId,
      request: req,
    });

    const setLocalVariable = (key: string, value: string) => {
      preScriptsCtx.variables[key] = value;
      variableMap.set(key, value);
    };

    const deleteLocalVariable = (key: string) => {
      delete preScriptsCtx.variables[key];
      variableMap.delete(key);
    };

    const setEnvironmentVariable = (key: string, value: string) => {
      persistVariable(key, value);
      const envName = runWorkspace?.activeEnvironment;
      if (envName && runWorkspace) {
        const env = runWorkspace.environments.find(e => e.name === envName);
        if (env) {
          const existing = env.variables.find(v => v.key === key);
          if (existing) {
            existing.value = value;
          } else {
            env.variables.push({ key, value });
          }
        }
      }
    };

    const deleteEnvironmentVariable = (key: string) => {
      removeVariable(key);
      const envName = runWorkspace?.activeEnvironment;
      if (envName && runWorkspace) {
        const env = runWorkspace.environments.find(e => e.name === envName);
        if (env) {
          env.variables = env.variables.filter(v => v.key !== key);
        }
      }
    };

    const preScriptsCtx: KbScriptContext = {
      request: { ...req },
      variables: Object.fromEntries(variableMap),
      setLocalVariable,
      deleteLocalVariable,
      setEnvironmentVariable,
      deleteEnvironmentVariable,
    };

    // Pre-scripts
    try {
      if (collectionId) {
        const collScripts = await getScripts(collectionId, "collection");
        const pre = collScripts.find((s) => s.scriptType === "pre")?.content;
        if (pre) await runScript(resolveString(pre, variableMap).resolved, preScriptsCtx, "Collection pre");
      }
      
      const folderPath: import('../types').FolderSummary[] = [];
      let currentFolder = folder;
      while (currentFolder) {
        folderPath.push(currentFolder);
        currentFolder = runWorkspace?.folders.find((f) => f.id === currentFolder?.parentId);
      }
      folderPath.reverse(); // root folder first
      
      for (const f of folderPath) {
        const folderScripts = await getScripts(f.id, "folder");
        const preF = folderScripts.find((s) => s.scriptType === "pre")?.content;
        if (preF) await runScript(resolveString(preF, variableMap).resolved, preScriptsCtx, `Folder (${f.name}) pre`);
      }
      const reqScripts = await getScripts(req.id, "request");
      const preR = reqScripts.find((s) => s.scriptType === "pre")?.content;
      if (preR) await runScript(resolveString(preR, variableMap).resolved, preScriptsCtx, "Request pre");
    } catch (err) {
      return { request: req, status: "failed", error: err instanceof Error ? err.message : String(err) };
    }

    const requestToSend = preScriptsCtx.request;
    let resolvedUrl: string;
    let resolvedHeaders: Array<{ key: string; value: string; enabled: boolean }>;
    let resolvedBody: string | undefined;

    try {
      const textsToScan = [
        requestToSend.url, 
        requestToSend.body, 
        ...requestToSend.headers.map((h: any) => h.value),
        // Also scan auth config fields for $response variables
        requestToSend.authConfig?.token,
        requestToSend.authConfig?.username,
        requestToSend.authConfig?.password,
        requestToSend.authConfig?.keyValue,
        requestToSend.authConfig?.clientId,
        requestToSend.authConfig?.clientSecret,
        requestToSend.authConfig?.accessTokenUrl,
        requestToSend.authConfig?.scope,
        requestToSend.authConfig?.audience,
      ];
      await injectAsyncVariables(variableMap, textsToScan, runWorkspace, inMemoryResponses);

      // Log what's in the map
      const $responseVars = Array.from(variableMap.keys()).filter(k => k.startsWith('$response'));

      const resolved = resolveRequestFields(variableMap, requestToSend.url, requestToSend.headers, requestToSend.body);
      resolvedUrl = resolved.url;
      resolvedHeaders = resolved.headers;
      resolvedBody = resolved.body;
      
      // Log the resolved headers
      const authHeader = resolvedHeaders.find(h => h.key.toLowerCase() === 'authorization');

    } catch (err) {
      return { request: req, status: "failed", error: err instanceof Error ? err.message : String(err) };
    }

    let finalAuthMode = requestToSend.authMode;
    let finalAuthConfig = requestToSend.authConfig;

    // Check if request has a manually-set Authorization header that might contain variables
    const hasManualAuthHeader = resolvedHeaders.some(h => 
      h.key.toLowerCase() === 'authorization' && h.enabled
    );
    
    // Check if request has auth config with values set (e.g., bearer token with $response variable)
    const hasAuthConfigWithValues = finalAuthConfig && (
      finalAuthConfig.token || 
      finalAuthConfig.username || 
      finalAuthConfig.password || 
      finalAuthConfig.keyValue
    );
    
    if (finalAuthMode === "none") {
      // Don't inherit auth if:
      // 1. Request has a manual Authorization header in Headers tab, OR
      // 2. Request has auth config values set (even though mode is "none")
      if (!hasManualAuthHeader && !hasAuthConfigWithValues) {
        if (folder && folder.authMode && folder.authMode !== "none") {
          finalAuthMode = folder.authMode;
          finalAuthConfig = folder.authConfig || {};
        } else if (collectionId) {
          const coll = runWorkspace.collections?.find((c) => c.id === collectionId);
          if (coll?.authMode && coll.authMode !== "none") {
            finalAuthMode = coll.authMode;
            finalAuthConfig = coll.authConfig || {};
          }
        }
      }
    }

    const resolvedAuth = resolveAuthConfig(finalAuthConfig ?? {}, variableMap);
    if (finalAuthMode === "oauth2" && !resolvedAuth.token) {
      try {
        const token = await obtainOAuth2Token(resolvedAuth, variableMap);
        resolvedAuth.token = token;
      } catch {
        // proceed without token
      }
    }

    const effectiveMethod =
      requestToSend.method === "CUSTOM"
        ? (requestToSend.customMethod?.trim().toUpperCase() || "CUSTOM")
        : requestToSend.method;

    const { url: authUrl, headers: authHeaders } = applyAuth(finalAuthMode, resolvedAuth, resolvedUrl, resolvedHeaders);

    const executedRequest = {
      method: effectiveMethod,
      url: authUrl,
      headers: authHeaders,
      body: resolvedBody,
      bodyMimeType: requestToSend.bodyMimeType,
      bodyForm: requestToSend.bodyForm,
      timeoutMs: requestToSend.timeoutMs,
      followRedirects: requestToSend.followRedirects,
    };

    const start = performance.now();
    try {
      const response = await executeHttpRequest(executedRequest);

      // Post-scripts
      const postCtx: KbScriptContext = {
        request: requestToSend,
        response: Object.freeze(response),
        variables: Object.fromEntries(variableMap),
        setLocalVariable: (key, value) => {
          postCtx.variables[key] = value;
          variableMap.set(key, value);
        },
        deleteLocalVariable: (key) => {
          delete postCtx.variables[key];
          variableMap.delete(key);
        },
        setEnvironmentVariable,
        deleteEnvironmentVariable,
      };
      try {
        const reqScripts2 = await getScripts(requestToSend.id, "request");
        const postR = reqScripts2.find((s) => s.scriptType === "post")?.content;
        if (postR) await runScript(resolveString(postR, variableMap).resolved, postCtx, "Request post");
        const folderPath2: import('../types').FolderSummary[] = [];
        let currentFolder2 = folder;
        while (currentFolder2) {
          folderPath2.push(currentFolder2);
          currentFolder2 = runWorkspace?.folders.find((f) => f.id === currentFolder2?.parentId);
        }
        for (const f of folderPath2) {
          const folderScripts2 = await getScripts(f.id, "folder");
          const postF = folderScripts2.find((s) => s.scriptType === "post")?.content;
          if (postF) await runScript(resolveString(postF, variableMap).resolved, postCtx, `Folder (${f.name}) post`);
        }
        if (collectionId) {
          const collScripts2 = await getScripts(collectionId, "collection");
          const postC = collScripts2.find((s) => s.scriptType === "post")?.content;
          if (postC) await runScript(resolveString(postC, variableMap).resolved, postCtx, "Collection post");
        }
      } catch { /* ignore post-script errors for runner */ }

      const durationMs = Math.round(performance.now() - start);
      
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

      // Record to history
      void recordRequestHistory({
        requestId: req.id,
        method: effectiveMethod,
        url: authUrl,
        status: response.status,
        durationMs,
        sizeBytes: response.sizeBytes,
        responseHeaders: JSON.stringify(response.headers),
        responseBodyText: response.bodyText,
        responseBodyBase64: response.bodyBase64,
        runId,
        scopeId,
        scopeName: scopeName || undefined,
        testPassed: passed,
      });

      return { request: req, status: passed ? "passed" : "failed", response, executedRequest, durationMs };
    } catch (err) {
      const durationMs = Math.round(performance.now() - start);
      return { request: req, status: "failed", error: err instanceof Error ? err.message : String(err), executedRequest, durationMs };
    }
  }

  async function runAll() {
    abortRef.current = false;
    pauseRef.current = false;
    setIsRunning(true);
    setIsPaused(false);
    setFinished(false);

    // Generate unique run ID
    const runId = `run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setCurrentRunId(runId);

    const runWorkspace = workspace 
      ? (JSON.parse(JSON.stringify(workspace)) as WorkspaceSummary)
      : workspace;

    const toRun = allRequests.current.filter((r) => selectedIds.has(r.id));
    const initial: RequestResult[] = allRequests.current.map((r) => ({
      request: r,
      status: selectedIds.has(r.id) ? "pending" : "skipped",
    }));
    setResults(initial);

    const updatedResults = [...initial];
    
    // Build map of in-memory responses for $response variable resolution
    const inMemoryResponses = new Map<string, ExecuteHttpResponse>();

    for (let i = 0; i < toRun.length; i++) {
      if (abortRef.current) break;

      // Wait while paused
      while (pauseRef.current && !abortRef.current) {
        await new Promise((res) => setTimeout(res, 100));
      }
      if (abortRef.current) break;

      const req = toRun[i];
      const idx = updatedResults.findIndex((r) => r.request.id === req.id);

      updatedResults[idx] = { ...updatedResults[idx], status: "running" };
      setResults([...updatedResults]);

      const result = await executeOne(req, runWorkspace, runId, inMemoryResponses);
      updatedResults[idx] = result;
      setResults([...updatedResults]);
      
      // Store response for $response variable resolution in subsequent requests
      if (result.response) {
        inMemoryResponses.set(req.id, result.response);
        inMemoryResponses.set(req.name, result.response);
      } else {
        console.warn(`[CollectionRunner] No response for request "${req.name}" (id: ${req.id})`);
      }

      if (delay > 0 && i < toRun.length - 1) {
        await new Promise((res) => setTimeout(res, delay));
      }
    }

    setIsRunning(false);
    setFinished(true);
    
    // Reload history after run completes
    await loadHistory();
  }

  const passed = results.filter((r) => r.status === "passed").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const running = results.filter((r) => r.status === "running").length;
  const total = results.filter((r) => r.status !== "skipped").length;
  const done = passed + failed;
  const progressPct = total === 0 ? 0 : Math.round((done / total) * 100);

  function statusIcon(status: RequestResult["status"]) {
    switch (status) {
      case "passed": return <CheckCircle size={14} style={{ color: "var(--color-status-success, #22c55e)", flexShrink: 0 }} />;
      case "failed": return <XCircle size={14} style={{ color: "var(--color-status-error, #ef4444)", flexShrink: 0 }} />;
      case "running": return <Loader size={14} style={{ color: "var(--color-text-active)", animation: "spin 1s linear infinite", flexShrink: 0 }} />;
      case "skipped": return <SquareIcon size={14} style={{ color: "var(--color-muted)", flexShrink: 0 }} />;
      default: return <Clock size={14} style={{ color: "var(--color-muted)", flexShrink: 0 }} />;
    }
  }

  const methodColors: Record<string, string> = {
    GET: "#22c55e", POST: "#3b82f6", PUT: "#f59e0b", PATCH: "#a855f7",
    DELETE: "#ef4444", HEAD: "#6b7280", OPTIONS: "#0ea5e9",
  };

  return createPortal(
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 10000,
        background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: "min(900px, 96vw)", height: "min(720px, 92vh)",
          background: "var(--color-surface-solid)",
          border: "1px solid var(--color-border-modal)",
          borderRadius: "12px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: "12px",
          padding: "16px 20px",
          borderBottom: "1px solid var(--color-border)",
          background: "var(--color-surface-solid)",
          flexShrink: 0,
        }}>
          <Play size={18} style={{ color: "var(--color-text-active)" }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: "15px", color: "var(--color-text)" }}>
              Collection Runner
            </div>
            <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
              {scopeName}
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: "8px", alignItems: "center" }}>
            {/* Tabs */}
            <div style={{ display: "flex", gap: "4px", background: "var(--color-surface-muted)", borderRadius: "6px", padding: "3px" }}>
              <button
                type="button"
                onClick={() => setActiveTab("new-run")}
                style={{
                  all: "unset",
                  padding: "5px 12px",
                  borderRadius: "4px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  background: activeTab === "new-run" ? "var(--color-surface-solid)" : "transparent",
                  color: activeTab === "new-run" ? "var(--color-text)" : "var(--color-text-muted)",
                  transition: "all 150ms",
                }}
              >
                New Run
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("history")}
                style={{
                  all: "unset",
                  padding: "5px 12px",
                  borderRadius: "4px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  background: activeTab === "history" ? "var(--color-surface-solid)" : "transparent",
                  color: activeTab === "history" ? "var(--color-text)" : "var(--color-text-muted)",
                  transition: "all 150ms",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <History size={13} /> History
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                all: "unset", cursor: "pointer", padding: "6px",
                color: "var(--color-muted)", borderRadius: "6px",
                display: "flex", alignItems: "center",
              }}
            ><X size={18} /></button>
          </div>
        </div>

        {/* Body — two-column */}
        {activeTab === "new-run" ? (
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          {/* Left: request list + config */}
          <div style={{
            width: "300px", flexShrink: 0,
            borderRight: "1px solid var(--color-border)",
            display: "flex", flexDirection: "column",
          }}>
            {/* Select all + count */}
            <div style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "10px 16px",
              borderBottom: "1px solid var(--color-border)",
              fontSize: "12px", color: "var(--color-text-muted)",
            }}>
              <button
                type="button"
                onClick={toggleAll}
                style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
              >
                {selectedIds.size === allRequests.current.length
                  ? <CheckSquare size={14} style={{ color: "var(--color-text-active)" }} />
                  : <SquareIcon size={14} />}
                <span>{selectedIds.size} / {allRequests.current.length} selected</span>
              </button>
            </div>

            {/* Request list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
              {allRequests.current.map((req) => {
                const checked = selectedIds.has(req.id);
                return (
                  <button
                    key={req.id}
                    type="button"
                    onClick={() => toggleRequest(req.id)}
                    style={{
                      all: "unset", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: "8px",
                      padding: "7px 16px", width: "100%",
                      boxSizing: "border-box",
                      background: checked ? "rgba(var(--color-accent-rgb, 59 130 246) / 0.07)" : "transparent",
                    }}
                  >
                    {checked
                      ? <CheckSquare size={13} style={{ color: "var(--color-text-active)", flexShrink: 0 }} />
                      : <SquareIcon size={13} style={{ color: "var(--color-muted)", flexShrink: 0 }} />}
                    <span style={{
                      fontSize: "11px", fontWeight: 700, letterSpacing: "0.02em",
                      color: methodColors[req.method] || "var(--color-text-muted)",
                      flexShrink: 0, width: "46px",
                    }}>
                      {req.method === "CUSTOM" ? (req.customMethod || "CUST") : req.method}
                    </span>
                    <span style={{
                      fontSize: "13px", color: "var(--color-text)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{req.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Delay config */}
            <div style={{
              padding: "12px 16px",
              borderTop: "1px solid var(--color-border)",
              display: "flex", flexDirection: "column", gap: "8px",
            }}>
              <label style={{ fontSize: "12px", color: "var(--color-text-muted)", display: "flex", justifyContent: "space-between" }}>
                <span>Delay between requests</span>
                <span style={{ color: "var(--color-text)" }}>{delay}ms</span>
              </label>
              <input
                type="range" min={0} max={3000} step={50}
                value={delay}
                onChange={(e) => setDelay(Number(e.target.value))}
                style={{ width: "100%", cursor: "pointer", accentColor: "var(--color-text-active)" }}
              />
            </div>

            {/* Run controls */}
            <div style={{ padding: "12px 16px", borderTop: "1px solid var(--color-border)", display: "flex", gap: "8px" }}>
              {!isRunning && !finished && (
                <button
                  type="button"
                  onClick={runAll}
                  disabled={selectedIds.size === 0}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                    padding: "8px 12px", borderRadius: "6px",
                    background: selectedIds.size === 0 ? "var(--color-surface-muted)" : "var(--color-text-active)",
                    color: selectedIds.size === 0 ? "var(--color-muted)" : "#fff",
                    border: "none", cursor: selectedIds.size === 0 ? "not-allowed" : "pointer",
                    fontSize: "13px", fontWeight: 600,
                  }}
                >
                  <Play size={14} /> Run
                </button>
              )}
              {isRunning && (
                <>
                  <button
                    type="button"
                    onClick={() => { pauseRef.current = !pauseRef.current; setIsPaused((p) => !p); }}
                    style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                      padding: "8px 12px", borderRadius: "6px",
                      background: "var(--color-surface-muted)", color: "var(--color-text)",
                      border: "1px solid var(--color-border)", cursor: "pointer",
                      fontSize: "13px", fontWeight: 600,
                    }}
                  >
                    {isPaused ? <Play size={14} /> : <Clock size={14} />}
                    {isPaused ? "Resume" : "Pause"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { abortRef.current = true; setIsRunning(false); setFinished(true); }}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                      padding: "8px 12px", borderRadius: "6px",
                      background: "var(--color-surface-muted)", color: "var(--color-status-error, #ef4444)",
                      border: "1px solid var(--color-border)", cursor: "pointer",
                      fontSize: "13px", fontWeight: 600,
                    }}
                  >
                    <Square size={14} />
                  </button>
                </>
              )}
              {finished && !isRunning && (
                <button
                  type="button"
                  onClick={resetRun}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                    padding: "8px 12px", borderRadius: "6px",
                    background: "var(--color-surface-muted)", color: "var(--color-text)",
                    border: "1px solid var(--color-border)", cursor: "pointer",
                    fontSize: "13px", fontWeight: 600,
                  }}
                >
                  <RefreshCw size={14} /> Run Again
                </button>
              )}
            </div>
          </div>

          {/* Right: results */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            {/* Progress bar and stats */}
            {(isRunning || finished) && (
              <>
                <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--color-border)", flexShrink: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "12px" }}>
                    <div style={{ display: "flex", gap: "16px" }}>
                      <span style={{ color: "var(--color-status-success, #22c55e)" }}>
                        ✓ {passed} passed
                      </span>
                      {failed > 0 && (
                        <span style={{ color: "var(--color-status-error, #ef4444)" }}>
                          ✗ {failed} failed
                        </span>
                      )}
                      {running > 0 && (
                        <span style={{ color: "var(--color-text-active)" }}>
                          ↻ {running} running
                        </span>
                      )}
                    </div>
                    <span style={{ color: "var(--color-text-muted)" }}>
                      {done}/{total} ({progressPct}%)
                    </span>
                  </div>
                  <div style={{ height: "4px", borderRadius: "4px", background: "var(--color-border)", overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${progressPct}%`,
                      borderRadius: "4px",
                      background: failed > 0
                        ? "linear-gradient(90deg, #22c55e, #ef4444)"
                        : "var(--color-status-success, #22c55e)",
                      transition: "width 200ms ease",
                    }} />
                  </div>
                </div>
                
                {/* Filter and Graph */}
                <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--color-border)", flexShrink: 0, display: "flex", gap: "16px", alignItems: "center" }}>
                  <Filter size={14} style={{ color: "var(--color-text-muted)" }} />
                  <div style={{ display: "flex", gap: "6px" }}>
                    {["all", "passed", "failed"].map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setResultFilter(filter as any)}
                        style={{
                          all: "unset",
                          padding: "4px 10px",
                          fontSize: "11px",
                          fontWeight: 600,
                          borderRadius: "4px",
                          cursor: "pointer",
                          background: resultFilter === filter ? "var(--color-text-active)" : "var(--color-surface-muted)",
                          color: resultFilter === filter ? "#fff" : "var(--color-text-muted)",
                          transition: "all 150ms",
                        }}
                      >
                        {filter.charAt(0).toUpperCase() + filter.slice(1)}
                      </button>
                    ))}
                  </div>
                  
                  {/* Mini Graph */}
                  {finished && total > 0 && (
                    <div style={{ marginLeft: "auto", display: "flex", gap: "2px", alignItems: "flex-end", height: "24px" }}>
                      {results.filter(r => r.status !== "skipped").map((result, idx) => {
                        const height = result.durationMs 
                          ? Math.max(4, Math.min(24, (result.durationMs / Math.max(...results.filter(r => r.durationMs).map(r => r.durationMs || 0))) * 24))
                          : 4;
                        const color = result.status === "passed" 
                          ? "var(--color-status-success)" 
                          : result.status === "failed" 
                          ? "var(--color-status-error)" 
                          : "var(--color-text-muted)";
                        return (
                          <div
                            key={idx}
                            style={{
                              width: "3px",
                              height: `${height}px`,
                              background: color,
                              borderRadius: "1px",
                              opacity: 0.8,
                            }}
                            title={`${result.request.name}: ${result.durationMs}ms - ${result.status}`}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* No results yet */}
            {!isRunning && !finished && (
              <div style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                color: "var(--color-text-muted)", gap: "12px",
              }}>
                <Play size={40} style={{ opacity: 0.2 }} />
                <p style={{ fontSize: "14px", margin: 0 }}>
                  Select requests and click <strong>Run</strong> to start
                </p>
              </div>
            )}

            {/* Result rows */}
            {(isRunning || finished) && (
              <div style={{ flex: 1, overflowY: "auto" }}>
                {results
                  .filter((result) => {
                    if (resultFilter === "all") return true;
                    if (resultFilter === "passed") return result.status === "passed";
                    if (resultFilter === "failed") return result.status === "failed";
                    return true;
                  })
                  .map((result) => {
                  const isExpanded = expandedResults.has(result.request.id);
                  const hasDetail = result.response || result.error;
                  return (
                    <div key={result.request.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                      <button
                        type="button"
                        disabled={!hasDetail}
                        onClick={() => {
                          if (!hasDetail) return;
                          setExpandedResults((prev) => {
                            const next = new Set(prev);
                            if (next.has(result.request.id)) next.delete(result.request.id);
                            else next.add(result.request.id);
                            return next;
                          });
                        }}
                        style={{
                          all: "unset",
                          display: "flex", alignItems: "center", gap: "10px",
                          padding: "10px 20px", width: "100%", boxSizing: "border-box",
                          cursor: hasDetail ? "pointer" : "default",
                          background: result.status === "running" ? "rgba(var(--color-accent-rgb, 59 130 246) / 0.05)" : "transparent",
                        }}
                      >
                        {statusIcon(result.status)}
                        <span style={{
                          fontSize: "11px", fontWeight: 700,
                          color: methodColors[result.request.method] || "var(--color-text-muted)",
                          flexShrink: 0, width: "46px",
                        }}>
                          {result.request.method === "CUSTOM"
                            ? (result.request.customMethod || "CUST")
                            : result.request.method}
                        </span>
                        <span style={{
                          flex: 1, fontSize: "13px", color: "var(--color-text)",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{result.request.name}</span>
                        {result.response && (
                          <span style={{
                            fontSize: "12px", fontWeight: 600,
                            color: result.response.status < 400
                              ? "var(--color-status-success, #22c55e)"
                              : "var(--color-status-error, #ef4444)",
                          }}>
                            {result.response.status}
                          </span>
                        )}
                        {result.durationMs !== undefined && (
                          <span style={{ fontSize: "11px", color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>
                            {result.durationMs}ms
                          </span>
                        )}
                        {hasDetail && (
                          isExpanded
                            ? <ChevronDown size={13} style={{ color: "var(--color-muted)", flexShrink: 0 }} />
                            : <ChevronRight size={13} style={{ color: "var(--color-muted)", flexShrink: 0 }} />
                        )}
                      </button>

                      {/* Expanded detail */}
                      {isExpanded && hasDetail && (
                        <div style={{
                          margin: "0 20px 12px 20px",
                          borderRadius: "6px",
                          border: "1px solid var(--color-border)",
                          background: "var(--color-surface-muted)",
                          fontSize: "12px",
                          overflow: "hidden",
                        }}>
                          {result.error && (
                            <div style={{ padding: "10px 14px", color: "var(--color-status-error, #ef4444)" }}>
                              {result.error}
                            </div>
                          )}
                          
                          {result.executedRequest && (
                            <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>
                              <div style={{ fontWeight: 600, marginBottom: "4px", color: "var(--color-text)" }}>Request</div>
                              <div style={{ wordBreak: "break-all" }}><strong>{result.executedRequest.method}</strong> {result.executedRequest.url}</div>
                              {result.executedRequest.headers.length > 0 && (
                                <div style={{ marginTop: "6px" }}>
                                  <div style={{ fontSize: "10px", textTransform: "uppercase", opacity: 0.7 }}>Headers</div>
                                  {result.executedRequest.headers.map((h, i) => (
                                    <div key={i}><strong>{h.key}</strong>: {h.value}</div>
                                  ))}
                                </div>
                              )}
                              {result.executedRequest.body && (
                                <div style={{ marginTop: "6px" }}>
                                  <div style={{ fontSize: "10px", textTransform: "uppercase", opacity: 0.7 }}>Body</div>
                                  <pre style={{ margin: 0, marginTop: "2px", fontSize: "11px", fontFamily: 'ui-monospace, SFMono-Regular, monospace', whiteSpace: "pre-wrap", color: "var(--color-text)" }}>
                                    {result.executedRequest.body}
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {result.response && (
                            <>
                              <div style={{
                                padding: "8px 14px", display: "flex", gap: "16px",
                                borderBottom: "1px solid var(--color-border)",
                                color: "var(--color-text-muted)",
                              }}>
                                <span>Status: <strong style={{ color: result.response.status < 400 ? "var(--color-status-success, #22c55e)" : "var(--color-status-error, #ef4444)" }}>{result.response.status} {result.response.statusText}</strong></span>
                                <span>Time: <strong style={{ color: "var(--color-text)" }}>{result.durationMs}ms</strong></span>
                                <span>Size: <strong style={{ color: "var(--color-text)" }}>{(result.response.sizeBytes / 1024).toFixed(1)}kb</strong></span>
                              </div>
                              {result.response.headers.length > 0 && (
                                <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--color-border)" }}>
                                  <div style={{ fontSize: "10px", textTransform: "uppercase", opacity: 0.7, marginBottom: "8px", color: "var(--color-text-muted)" }}>Response Headers</div>
                                  <div style={{ 
                                    maxHeight: "200px", 
                                    overflowY: "auto",
                                    background: "var(--color-surface-muted)",
                                    borderRadius: "4px",
                                    border: "1px solid var(--color-border)",
                                    fontSize: "12px",
                                  }}>
                                    {result.response.headers.map((h, i) => (
                                      <div 
                                        key={i} 
                                        style={{ 
                                          padding: "6px 12px",
                                          borderBottom: i < (result.response?.headers.length ?? 0) - 1 ? "1px solid var(--color-border)" : "none",
                                          color: "var(--color-text-muted)",
                                        }}
                                      >
                                        <strong style={{ color: "var(--color-text)" }}>{h.key}</strong>: {h.value}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div style={{ padding: "8px 14px 4px 14px", fontSize: "10px", textTransform: "uppercase", color: "var(--color-text-muted)", opacity: 0.7 }}>
                                Response Body
                              </div>
                              <pre style={{
                                margin: 0, padding: "0 14px 10px 14px",
                                maxHeight: "300px", overflowY: "auto",
                                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                fontSize: "11px", color: "var(--color-text)",
                                whiteSpace: "pre-wrap", wordBreak: "break-all",
                              }}>
                                {(() => {
                                  if (!result.response.bodyText) return "(empty body)";
                                  
                                  // Detect content type from headers
                                  const contentType = result.response.headers.find(h => 
                                    h.key.toLowerCase() === 'content-type'
                                  )?.value.toLowerCase() || '';
                                  
                                  // Format based on content type
                                  if (contentType.includes('application/json') || contentType.includes('application/vnd.api+json')) {
                                    try {
                                      return JSON.stringify(JSON.parse(result.response.bodyText), null, 2);
                                    } catch {
                                      return result.response.bodyText;
                                    }
                                  }
                                  
                                  if (contentType.includes('xml') || contentType.includes('html')) {
                                    return formatResponseBody(result.response.bodyText, "xml");
                                  }
                                  
                                  return result.response.bodyText;
                                })()}
                              </pre>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        ) : (
        /* History Tab */
        <div style={{ display: "flex", flex: 1, minHeight: 0, flexDirection: "column" }}>
          {loadingHistory && pastRuns.length === 0 ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)" }}>
              <Loader size={24} style={{ animation: "spin 1s linear infinite" }} />
            </div>
          ) : pastRuns.length === 0 ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)", gap: "12px" }}>
              <History size={48} style={{ opacity: 0.2 }} />
              <p style={{ margin: 0, fontSize: "14px" }}>No past runs yet</p>
              <p style={{ margin: 0, fontSize: "12px" }}>Run this collection to see its history here</p>
            </div>
          ) : !selectedRun ? (
            /* List of past runs */
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
              <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: 600, color: "var(--color-text)" }}>
                Past Runs ({pastRuns.length})
              </h3>
              
              {/* Trend Chart */}
              {pastRuns.length > 1 && (
                <div style={{ 
                  marginBottom: "20px", 
                  padding: "16px", 
                  background: "var(--color-surface-muted)", 
                  borderRadius: "8px",
                  border: "1px solid var(--color-border)"
                }}>
                  <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "12px", color: "var(--color-text)" }}>
                    Pass Rate Trend
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: "80px" }}>
                    {pastRuns.slice().reverse().slice(-15).map((run, idx) => {
                      const passRate = run.totalRequests > 0 
                        ? (run.passedRequests / run.totalRequests) * 100
                        : 0;
                      const height = Math.max(8, (passRate / 100) * 80);
                      const color = passRate === 100 
                        ? "var(--color-status-success)" 
                        : passRate >= 80 
                        ? "#f59e0b" 
                        : "var(--color-status-error)";
                      return (
                        <div
                          key={idx}
                          style={{
                            flex: 1,
                            height: `${height}px`,
                            background: color,
                            borderRadius: "2px 2px 0 0",
                            opacity: 0.9,
                            transition: "all 200ms",
                            cursor: "pointer",
                          }}
                          title={`${new Date(run.createdAt).toLocaleString()}: ${Math.round(passRate)}% pass rate`}
                          onClick={() => loadRunDetails(run)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.opacity = "1";
                            e.currentTarget.style.transform = "translateY(-2px)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = "0.9";
                            e.currentTarget.style.transform = "translateY(0)";
                          }}
                        />
                      );
                    })}
                  </div>
                  <div style={{ 
                    marginTop: "8px", 
                    display: "flex", 
                    justifyContent: "space-between", 
                    fontSize: "10px", 
                    color: "var(--color-text-muted)" 
                  }}>
                    <span>Oldest</span>
                    <span>Latest</span>
                  </div>
                </div>
              )}
              
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {pastRuns.map((run) => {
                  const passRate = run.totalRequests > 0 
                    ? Math.round((run.passedRequests / run.totalRequests) * 100)
                    : 0;
                  const timestamp = new Date(run.createdAt).toLocaleString();
                  
                  return (
                    <button
                      key={run.runId}
                      type="button"
                      onClick={() => loadRunDetails(run)}
                      style={{
                        all: "unset",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        padding: "12px",
                        borderRadius: "8px",
                        border: "1px solid var(--color-border)",
                        background: "var(--color-surface-muted)",
                        cursor: "pointer",
                        transition: "all 150ms",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--color-surface-solid)";
                        e.currentTarget.style.borderColor = "var(--color-text-active)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "var(--color-surface-muted)";
                        e.currentTarget.style.borderColor = "var(--color-border)";
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text)" }}>
                          {timestamp}
                        </span>
                        <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                          {(run.totalDurationMs / 1000).toFixed(1)}s
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "12px", fontSize: "12px" }}>
                        <span style={{ color: "var(--color-text-muted)" }}>
                          {run.totalRequests} requests
                        </span>
                        <span style={{ color: "var(--color-status-success)" }}>
                          {run.passedRequests} passed
                        </span>
                        {run.failedRequests > 0 && (
                          <span style={{ color: "var(--color-status-error)" }}>
                            {run.failedRequests} failed
                          </span>
                        )}
                        <span style={{ marginLeft: "auto", fontWeight: 600, color: passRate === 100 ? "var(--color-status-success)" : "var(--color-text)" }}>
                          {passRate}% pass rate
                        </span>
                      </div>
                      {/* Visual pass/fail bar */}
                      <div style={{ display: "flex", height: "6px", borderRadius: "3px", overflow: "hidden", background: "var(--color-border)" }}>
                        {run.passedRequests > 0 && (
                          <div style={{ 
                            width: `${(run.passedRequests / run.totalRequests) * 100}%`, 
                            background: "var(--color-status-success)",
                          }} />
                        )}
                        {run.failedRequests > 0 && (
                          <div style={{ 
                            width: `${(run.failedRequests / run.totalRequests) * 100}%`, 
                            background: "var(--color-status-error)",
                          }} />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Details of a selected run */
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
              <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center", gap: "12px" }}>
                <button
                  type="button"
                  onClick={() => setSelectedRun(null)}
                  style={{
                    all: "unset",
                    cursor: "pointer",
                    padding: "6px",
                    color: "var(--color-text-muted)",
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  ← Back
                </button>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text)" }}>
                    {new Date(selectedRun.createdAt).toLocaleString()}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                    {selectedRun.passedRequests}/{selectedRun.totalRequests} passed • {(selectedRun.totalDurationMs / 1000).toFixed(1)}s
                  </div>
                </div>
              </div>
              
              {/* Filter and Graph for history */}
              {!loadingHistory && runDetails.length > 0 && (
                <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--color-border)", flexShrink: 0, display: "flex", gap: "16px", alignItems: "center" }}>
                  <Filter size={14} style={{ color: "var(--color-text-muted)" }} />
                  <div style={{ display: "flex", gap: "6px" }}>
                    {["all", "passed", "failed"].map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setHistoryFilter(filter as any)}
                        style={{
                          all: "unset",
                          padding: "4px 10px",
                          fontSize: "11px",
                          fontWeight: 600,
                          borderRadius: "4px",
                          cursor: "pointer",
                          background: historyFilter === filter ? "var(--color-text-active)" : "var(--color-surface-muted)",
                          color: historyFilter === filter ? "#fff" : "var(--color-text-muted)",
                          transition: "all 150ms",
                        }}
                      >
                        {filter.charAt(0).toUpperCase() + filter.slice(1)}
                      </button>
                    ))}
                  </div>
                  
                  {/* Mini Graph */}
                  <div style={{ marginLeft: "auto", display: "flex", gap: "2px", alignItems: "flex-end", height: "24px" }}>
                    {runDetails.map((entry, idx) => {
                      const maxDuration = Math.max(...runDetails.map(e => e.durationMs));
                      const height = Math.max(4, Math.min(24, (entry.durationMs / maxDuration) * 24));
                      const passed = entry.testPassed ?? entry.status < 400;
                      const color = passed ? "var(--color-status-success)" : "var(--color-status-error)";
                      return (
                        <div
                          key={idx}
                          style={{
                            width: "3px",
                            height: `${height}px`,
                            background: color,
                            borderRadius: "1px",
                            opacity: 0.8,
                          }}
                          title={`${entry.method} ${entry.url}: ${entry.durationMs}ms - ${passed ? 'passed' : 'failed'}`}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
              
              <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px" }}>
                {loadingHistory ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 0" }}>
                    <Loader size={24} style={{ animation: "spin 1s linear infinite", color: "var(--color-text-muted)" }} />
                  </div>
                ) : (
                  runDetails
                    .filter((entry) => {
                      if (historyFilter === "all") return true;
                      const passed = entry.testPassed ?? entry.status < 400;
                      if (historyFilter === "passed") return passed;
                      if (historyFilter === "failed") return !passed;
                      return true;
                    })
                    .map((entry, idx) => {
                      const isExpanded = expandedHistoryItems.has(entry.id);
                      const passed = entry.testPassed ?? entry.status < 400;
                      
                      return (
                        <div key={entry.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                          {/* Main row */}
                          <div
                            style={{
                              padding: "10px 20px",
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              cursor: "pointer",
                              background: isExpanded ? "var(--color-surface-muted)" : "transparent",
                            }}
                            onClick={() => {
                              const newSet = new Set(expandedHistoryItems);
                              if (isExpanded) {
                                newSet.delete(entry.id);
                              } else {
                                newSet.add(entry.id);
                              }
                              setExpandedHistoryItems(newSet);
                            }}
                          >
                            {isExpanded ? (
                              <ChevronDown size={14} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
                            ) : (
                              <ChevronRight size={14} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
                            )}
                            {passed ? (
                              <CheckCircle size={14} style={{ color: "var(--color-status-success)", flexShrink: 0 }} />
                            ) : (
                              <XCircle size={14} style={{ color: "var(--color-status-error)", flexShrink: 0 }} />
                            )}
                            <span style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              color: methodColors[entry.method] || "var(--color-text-muted)",
                              flexShrink: 0,
                              width: "46px",
                            }}>
                              {entry.method}
                            </span>
                            <span style={{
                              flex: 1,
                              fontSize: "13px",
                              color: "var(--color-text)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontFamily: "monospace",
                            }} title={entry.url}>
                              {entry.url}
                            </span>
                            <span style={{
                              fontSize: "12px",
                              fontWeight: 600,
                              color: passed
                                ? "var(--color-status-success, #22c55e)"
                                : "var(--color-status-error, #ef4444)",
                            }}>
                              {entry.status}
                            </span>
                            <span style={{
                              fontSize: "11px",
                              color: "var(--color-text-muted)",
                              whiteSpace: "nowrap",
                            }}>
                              {entry.durationMs}ms
                            </span>
                          </div>
                          
                          {/* Expanded details */}
                          {isExpanded && (
                            <div style={{ 
                              padding: "16px 20px 16px 60px", 
                              background: "var(--color-surface)", 
                              borderTop: "1px solid var(--color-border)",
                            }}>
                              {/* Response Headers */}
                              {entry.responseHeaders && (() => {
                                const headers = parseHeadersString(entry.responseHeaders);
                                return headers.length > 0 && (
                                  <div style={{ marginBottom: "16px" }}>
                                    <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", marginBottom: "8px", textTransform: "uppercase" }}>
                                      Response Headers
                                    </div>
                                    <div style={{
                                      background: "var(--color-surface-muted)",
                                      borderRadius: "4px",
                                      border: "1px solid var(--color-border)",
                                      maxHeight: "200px",
                                      overflowY: "auto",
                                      fontSize: "12px",
                                    }}>
                                      {headers.map((h, i) => (
                                        <div 
                                          key={i} 
                                          style={{ 
                                            padding: "6px 12px",
                                            borderBottom: i < headers.length - 1 ? "1px solid var(--color-border)" : "none",
                                            color: "var(--color-text-muted)",
                                          }}
                                        >
                                          <strong style={{ color: "var(--color-text)" }}>{h.key}</strong>: {h.value}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}
                              
                              {/* Response Body */}
                              {(entry.responseBodyText || entry.responseBodyBase64) && (
                                <div>
                                  <div style={{ 
                                    display: "flex", 
                                    justifyContent: "space-between", 
                                    alignItems: "center",
                                    marginBottom: "8px"
                                  }}>
                                    <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase" }}>
                                      Response Body
                                    </div>
                                    <div style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                                      {(entry.sizeBytes / 1024).toFixed(2)} KB
                                    </div>
                                  </div>
                                  <pre style={{
                                    fontSize: "11px",
                                    color: "var(--color-text)",
                                    background: "var(--color-surface-muted)",
                                    padding: "12px",
                                    borderRadius: "4px",
                                    border: "1px solid var(--color-border)",
                                    margin: 0,
                                    maxHeight: "400px",
                                    overflowY: "auto",
                                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                                    whiteSpace: "pre-wrap",
                                    wordBreak: "break-all",
                                  }}>
                                    {entry.responseBodyBase64 
                                      ? "[Binary content]" 
                                      : formatStoredResponse(entry.responseBodyText, entry.responseHeaders)
                                    }
                                  </pre>
                                </div>
                              )}
                              
                              {!entry.responseHeaders && !entry.responseBodyText && !entry.responseBodyBase64 && (
                                <div style={{ fontSize: "12px", color: "var(--color-text-muted)", fontStyle: "italic" }}>
                                  No response details available
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          )}
        </div>
        )}
      </div>
    </div>,
    document.body
  );
}
