import React, { useState, useRef, useEffect } from "react";
import { X, Play, Square, Activity } from "lucide-react";
import type { SavedRequest, WorkspaceSummary } from "../types";
import { prepareRequestForExecution } from "../services/request-executor";
import { executeHttpRequest } from "../services/http-client";
import { buildScopedVariableMap } from "../services/variables";
import { formatTimestamp } from "../app-utils";

export interface LoadTestHistoryRecord {
  id: string;
  requestId: string;
  timestamp: string;
  iterations: number;
  concurrency: number;
  completedCount: number;
  successCount: number;
  avgDurationMs: string;
  p95DurationMs: string;
  minDurationMs: string;
  maxDurationMs: string;
}

export interface LoadTestModalProps {
  isOpen: boolean;
  request: SavedRequest | null;
  workspace: WorkspaceSummary | null;
  onClose: () => void;
}

export function LoadTestModal({ isOpen, request, workspace, onClose }: LoadTestModalProps) {
  const [concurrency, setConcurrency] = useState(10);
  const [iterations, setIterations] = useState(100);
  const [status, setStatus] = useState<"configuring" | "running" | "completed">("configuring");
  
  const [completedCount, setCompletedCount] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [durations, setDurations] = useState<number[]>([]);
  const [history, setHistory] = useState<LoadTestHistoryRecord[]>([]);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadHistory = (reqId: string) => {
    try {
      const allHistory = JSON.parse(localStorage.getItem("kr_load_test_history") || "{}");
      setHistory(allHistory[reqId] || []);
    } catch {
      setHistory([]);
    }
  };

  const saveHistoryRecord = (record: LoadTestHistoryRecord) => {
    try {
      const allHistory = JSON.parse(localStorage.getItem("kr_load_test_history") || "{}");
      const reqHistory = allHistory[record.requestId] || [];
      reqHistory.unshift(record);
      if (reqHistory.length > 20) reqHistory.length = 20; // Keep last 20
      allHistory[record.requestId] = reqHistory;
      localStorage.setItem("kr_load_test_history", JSON.stringify(allHistory));
      setHistory(reqHistory);
    } catch (e) {
      console.error("Failed to save load test history", e);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setStatus("configuring");
      setCompletedCount(0);
      setSuccessCount(0);
      setDurations([]);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    } else if (request) {
      loadHistory(request.id);
    }
  }, [isOpen, request]);

  const handleStart = async () => {
    if (!request || !workspace) return;
    setStatus("running");
    setCompletedCount(0);
    setSuccessCount(0);
    setDurations([]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let currentIteration = 0;
    let currentCompleted = 0;
    let currentSuccess = 0;
    const currentDurations: number[] = [];

    const runWorker = async () => {
      while (currentIteration < iterations && !controller.signal.aborted) {
        currentIteration++;
        try {
          const variableMap = buildScopedVariableMap(workspace, {
            collectionId: workspace.folders.find(f => f.id === request.folderId)?.collectionId,
            folderId: request.folderId,
            request: request
          });
          const { request: execReq } = await prepareRequestForExecution(request, workspace, variableMap);
          
          if (controller.signal.aborted) break;

          const res = await executeHttpRequest(execReq);
          
          if (controller.signal.aborted) break;

          currentCompleted++;
          currentDurations.push(res.durationMs);
          if (res.status >= 200 && res.status < 300) {
            currentSuccess++;
          }
          
          // Batch updates to avoid freezing UI
          if (currentCompleted % Math.max(1, Math.floor(concurrency / 2)) === 0 || currentCompleted === iterations) {
            setCompletedCount(currentCompleted);
            setSuccessCount(currentSuccess);
            setDurations([...currentDurations]);
          }
        } catch (err) {
          if (controller.signal.aborted) break;
          currentCompleted++;
          // Batch updates
          if (currentCompleted % Math.max(1, Math.floor(concurrency / 2)) === 0 || currentCompleted === iterations) {
            setCompletedCount(currentCompleted);
            setSuccessCount(currentSuccess);
            setDurations([...currentDurations]);
          }
        }
      }
    };

    const workers: Promise<void>[] = [];
    const actualConcurrency = Math.min(concurrency, iterations);
    for (let i = 0; i < actualConcurrency; i++) {
      workers.push(runWorker());
    }

    await Promise.all(workers);
    
    if (!controller.signal.aborted) {
      setStatus("completed");
      
      const avgDur = currentDurations.length > 0 ? (currentDurations.reduce((a, b) => a + b, 0) / currentDurations.length).toFixed(0) : "0";
      const sortedDur = [...currentDurations].sort((a, b) => a - b);
      const p95Dur = sortedDur.length > 0 ? sortedDur[Math.floor(sortedDur.length * 0.95)]?.toFixed(0) || "0" : "0";
      const minDur = sortedDur.length > 0 ? sortedDur[0].toFixed(0) : "0";
      const maxDur = sortedDur.length > 0 ? sortedDur[sortedDur.length - 1].toFixed(0) : "0";

      saveHistoryRecord({
        id: crypto.randomUUID(),
        requestId: request.id,
        timestamp: new Date().toISOString(),
        iterations,
        concurrency,
        completedCount: currentCompleted,
        successCount: currentSuccess,
        avgDurationMs: avgDur,
        p95DurationMs: p95Dur,
        minDurationMs: minDur,
        maxDurationMs: maxDur
      });
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setStatus("completed");
  };

  const handleClose = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    onClose();
  };

  if (!isOpen) return null;

  const avgDuration = durations.length > 0 ? (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(0) : "0";
  const sortedDurations = [...durations].sort((a, b) => a - b);
  const p95 = sortedDurations.length > 0 ? sortedDurations[Math.floor(sortedDurations.length * 0.95)]?.toFixed(0) || "0" : "0";
  const max = sortedDurations.length > 0 ? sortedDurations[sortedDurations.length - 1].toFixed(0) : "0";
  const min = sortedDurations.length > 0 ? sortedDurations[0].toFixed(0) : "0";

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()} style={{ width: "600px", height: "auto", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div className="settings-header">
          <div>
            <span className="settings-kicker">Performance</span>
            <h2>Load Test: {request?.name || "Request"}</h2>
            <p>Send multiple requests concurrently to evaluate performance.</p>
          </div>
          <button className="settings-close" type="button" aria-label="Close" onClick={handleClose}>
            <X size={18} />
          </button>
        </div>

        <div className="settings-content" style={{ paddingBottom: "16px", flex: 1, overflowY: "auto" }}>
          {status === "configuring" ? (
            <>
              <section className="settings-section">
                <label className="settings-row" style={{ borderBottom: "none" }}>
                  <span style={{ flex: 1 }}>
                    <strong>Total Iterations</strong>
                    <small>Number of requests to send</small>
                  </span>
                  <input
                    type="number"
                    min="1"
                    className="input"
                    style={{ width: "100px" }}
                    value={iterations}
                    onChange={(e) => setIterations(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </label>
                <label className="settings-row" style={{ borderBottom: "none", paddingBottom: 0 }}>
                  <span style={{ flex: 1 }}>
                    <strong>Concurrency</strong>
                    <small>Virtual users (parallel requests)</small>
                  </span>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    className="input"
                    style={{ width: "100px" }}
                    value={concurrency}
                    onChange={(e) => setConcurrency(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </label>
              </section>
              
              {history.length > 0 && (
                <section className="settings-section" style={{ marginTop: "16px" }}>
                  <h3 style={{ fontSize: "13px", marginBottom: "8px", color: "var(--color-text)" }}>Past Runs</h3>
                  <div style={{ border: "1px solid var(--color-border)", borderRadius: "6px", overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
                      <thead>
                        <tr style={{ background: "var(--color-surface-hover)", borderBottom: "1px solid var(--color-border)" }}>
                          <th style={{ padding: "6px 8px", fontWeight: 600, color: "var(--color-muted)" }}>Date</th>
                          <th style={{ padding: "6px 8px", fontWeight: 600, color: "var(--color-muted)" }}>Iters</th>
                          <th style={{ padding: "6px 8px", fontWeight: 600, color: "var(--color-muted)" }}>Conc</th>
                          <th style={{ padding: "6px 8px", fontWeight: 600, color: "var(--color-muted)" }}>Success</th>
                          <th style={{ padding: "6px 8px", fontWeight: 600, color: "var(--color-muted)" }}>Avg</th>
                          <th style={{ padding: "6px 8px", fontWeight: 600, color: "var(--color-muted)" }}>P95</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map(run => (
                          <tr key={run.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                            <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{formatTimestamp(run.timestamp)}</td>
                            <td style={{ padding: "6px 8px" }}>{run.iterations}</td>
                            <td style={{ padding: "6px 8px" }}>{run.concurrency}</td>
                            <td style={{ padding: "6px 8px" }}>
                              <span style={{ color: run.successCount === run.completedCount ? "var(--color-success)" : "var(--color-warning)" }}>
                                {run.successCount}/{run.completedCount}
                              </span>
                            </td>
                            <td style={{ padding: "6px 8px" }}>{run.avgDurationMs}ms</td>
                            <td style={{ padding: "6px 8px" }}>{run.p95DurationMs}ms</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          ) : (
            <section className="settings-section">
              <div style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px" }}>
                  <strong>Progress</strong>
                  <span>{completedCount} / {iterations}</span>
                </div>
                <div style={{ width: "100%", height: "8px", background: "var(--color-surface-hover)", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ width: `${(completedCount / iterations) * 100}%`, height: "100%", background: "var(--color-accent)", transition: "width 0.2s" }} />
                </div>
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div style={{ padding: "12px", background: "var(--color-surface-hover)", borderRadius: "8px" }}>
                  <div style={{ fontSize: "11px", color: "var(--color-muted)", marginBottom: "4px" }}>Success Rate</div>
                  <div style={{ fontSize: "20px", fontWeight: "600", color: successCount === completedCount && completedCount > 0 ? "var(--color-success)" : (successCount > 0 ? "var(--color-warning)" : "var(--color-danger)") }}>
                    {completedCount > 0 ? ((successCount / completedCount) * 100).toFixed(1) : 0}%
                  </div>
                </div>
                <div style={{ padding: "12px", background: "var(--color-surface-hover)", borderRadius: "8px" }}>
                  <div style={{ fontSize: "11px", color: "var(--color-muted)", marginBottom: "4px" }}>Avg Response Time</div>
                  <div style={{ fontSize: "20px", fontWeight: "600", color: "var(--color-text)" }}>{avgDuration} ms</div>
                </div>
                <div style={{ padding: "12px", background: "var(--color-surface-hover)", borderRadius: "8px" }}>
                  <div style={{ fontSize: "11px", color: "var(--color-muted)", marginBottom: "4px" }}>P95 Response Time</div>
                  <div style={{ fontSize: "20px", fontWeight: "600", color: "var(--color-text)" }}>{p95} ms</div>
                </div>
                <div style={{ padding: "12px", background: "var(--color-surface-hover)", borderRadius: "8px" }}>
                  <div style={{ fontSize: "11px", color: "var(--color-muted)", marginBottom: "4px" }}>Min / Max</div>
                  <div style={{ fontSize: "20px", fontWeight: "600", color: "var(--color-text)" }}>{min} / {max} ms</div>
                </div>
              </div>
            </section>
          )}
        </div>

        <div className="settings-footer" style={{ justifyContent: "flex-end" }}>
          <div className="settings-footer-actions">
            {status === "configuring" && (
              <>
                <button className="modal-cancel" type="button" onClick={handleClose}>
                  Cancel
                </button>
                <button className="modal-confirm" type="button" onClick={handleStart} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <Play size={14} /> Start Load Test
                </button>
              </>
            )}
            {status === "running" && (
              <button className="modal-cancel" type="button" onClick={handleCancel} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <Square size={14} /> Stop
              </button>
            )}
            {status === "completed" && (
              <button className="modal-confirm" type="button" onClick={() => setStatus("configuring")}>
                New Test
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
