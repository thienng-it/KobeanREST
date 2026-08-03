import { createPortal } from "react-dom";
import { useEffect, useRef, useState, useCallback, type CSSProperties } from "react";
import {
  X, Play, Square, CheckCircle, XCircle, Clock, ChevronDown, ChevronRight,
  Loader, RefreshCw, Filter, CheckSquare, Square as SquareIcon
} from "lucide-react";
import type { SavedRequest, WorkspaceSummary, ExecuteHttpResponse } from "../types";
import { executeHttpRequest } from "../services/http-client";
import { buildScopedVariableMap, resolveRequestFields, resolveString, UnresolvedVariableError, injectAsyncVariables } from "../services/variables";
import { applyAuth, resolveAuthConfig, obtainOAuth2Token } from "../services/auth";
import { getScripts } from "../services/local-store";
import type { KbScriptContext } from "../services/script-runtime";

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
  }, [scopeId]);

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

  async function executeOne(req: SavedRequest, runWorkspace: WorkspaceSummary): Promise<RequestResult> {
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
      const textsToScan = [requestToSend.url, requestToSend.body, ...requestToSend.headers.map((h: any) => h.value)];
      await injectAsyncVariables(variableMap, textsToScan, runWorkspace);
      
      const resolved = resolveRequestFields(variableMap, requestToSend.url, requestToSend.headers, requestToSend.body);
      resolvedUrl = resolved.url;
      resolvedHeaders = resolved.headers;
      resolvedBody = resolved.body;
    } catch (err) {
      return { request: req, status: "failed", error: err instanceof Error ? err.message : String(err) };
    }

    let finalAuthMode = requestToSend.authMode;
    let finalAuthConfig = requestToSend.authConfig;
    if (finalAuthMode === "none") {
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

      const result = await executeOne(req, runWorkspace);
      updatedResults[idx] = result;
      setResults([...updatedResults]);

      if (delay > 0 && i < toRun.length - 1) {
        await new Promise((res) => setTimeout(res, delay));
      }
    }

    setIsRunning(false);
    setFinished(true);
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
          <div style={{ marginLeft: "auto" }}>
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
            {/* Progress bar */}
            {(isRunning || finished) && (
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
                      : "var(--color-text-active)",
                    transition: "width 200ms ease",
                  }} />
                </div>
              </div>
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
                {results.map((result) => {
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
                                <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>
                                  <div style={{ fontSize: "10px", textTransform: "uppercase", opacity: 0.7, marginBottom: "4px" }}>Response Headers</div>
                                  <div style={{ maxHeight: "120px", overflowY: "auto" }}>
                                    {result.response.headers.map((h, i) => (
                                      <div key={i}><strong>{h.key}</strong>: {h.value}</div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div style={{ padding: "8px 14px 4px 14px", fontSize: "10px", textTransform: "uppercase", color: "var(--color-text-muted)", opacity: 0.7 }}>
                                Response Body
                              </div>
                              <pre style={{
                                margin: 0, padding: "0 14px 10px 14px",
                                maxHeight: "160px", overflowY: "auto",
                                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                fontSize: "11px", color: "var(--color-text)",
                                whiteSpace: "pre-wrap", wordBreak: "break-all",
                              }}>
                                {result.response.bodyText?.slice(0, 2000) || "(empty body)"}
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
      </div>
    </div>,
    document.body
  );
}
