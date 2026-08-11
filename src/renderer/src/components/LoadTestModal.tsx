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
  rps?: string;
  chartData?: any[];
}

export interface ChartDataPoint {
  rps: number;
  avgDuration: number;
}

function generateDualChartData(results: { duration: number, timeOffset: number }[], targetCount = 100): ChartDataPoint[] {
  if (results.length === 0) return [];
  let maxTime = 0;
  for (const r of results) {
    if (r.timeOffset > maxTime) maxTime = r.timeOffset;
  }
  if (maxTime === 0) maxTime = 1000;
  
  const binSizeMs = Math.max(10, maxTime / targetCount);
  const target = Math.min(targetCount, Math.ceil(maxTime / binSizeMs) + 1);
  
  const buckets = Array.from({ length: target }, () => ({
    count: 0,
    sumDuration: 0,
  }));
  
  for (const r of results) {
    let binIndex = Math.floor(r.timeOffset / binSizeMs);
    if (binIndex >= target) binIndex = target - 1;
    if (binIndex < 0) binIndex = 0;
    
    buckets[binIndex].count++;
    buckets[binIndex].sumDuration += r.duration;
  }
  
  return buckets.map(b => ({
    rps: b.count / (binSizeMs / 1000),
    avgDuration: b.count > 0 ? b.sumDuration / b.count : 0
  }));
}

function DualK6Chart({ data }: { data: any[] }) {
  if (!data || data.length === 0) return <div style={{ height: "110px", minHeight: "110px", background: 'var(--color-surface-hover)', borderRadius: 8, padding: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "var(--color-muted)" }}>Waiting for data...</div>;
  
  const isOldData = typeof data[0] === "number";
  const normalizedData: ChartDataPoint[] = isOldData ? data.map(d => ({ rps: 0, avgDuration: d })) : data;
  
  const maxDur = Math.max(...normalizedData.map(d => d.avgDuration), 1);
  const maxRps = Math.max(...normalizedData.map(d => d.rps), 1);
  
  const durPoints = normalizedData.map((d, i) => {
    const x = (i / Math.max(1, normalizedData.length - 1)) * 100;
    const y = 100 - (d.avgDuration / maxDur) * 100;
    return `${x},${y}`;
  }).join(" ");

  const rpsPoints = normalizedData.map((d, i) => {
    const x = (i / Math.max(1, normalizedData.length - 1)) * 100;
    const y = 100 - (d.rps / maxRps) * 100;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div style={{ padding: "8px 12px", background: "var(--color-surface-hover)", borderRadius: "8px", display: "flex", flexDirection: "column", height: "110px", minHeight: "110px", flexShrink: 0, overflow: "hidden" }}>
      <div style={{ fontSize: "11px", marginBottom: "4px", display: "flex", justifyContent: "space-between", flexShrink: 0 }}>
        <span style={{ color: "#3b82f6", fontWeight: 600 }}>Response Time (Max: {maxDur.toFixed(0)}ms)</span>
        {maxRps > 1 && <span style={{ color: "#8b5cf6", fontWeight: 600 }}>Throughput (Max: {maxRps.toFixed(0)} req/s)</span>}
      </div>
      <div style={{ flex: 1, position: "relative" }}>
        <svg preserveAspectRatio="none" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", overflow: "visible" }} viewBox="0 0 100 100">
          {maxRps > 1 && (
            <>
              <polygon points={`0,100 ${rpsPoints} 100,100`} fill="#8b5cf633" />
              <polyline points={rpsPoints} fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </>
          )}
          <polyline points={durPoints} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
    </div>
  );
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
  const [results, setResults] = useState<{ duration: number, timeOffset: number }[]>([]);
  const [history, setHistory] = useState<LoadTestHistoryRecord[]>([]);
  const [selectedRun, setSelectedRun] = useState<LoadTestHistoryRecord | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let interval: any;
    if (status === "running" && startTime) {
      interval = setInterval(() => {
        setElapsedMs(Date.now() - startTime);
      }, 200);
    } else if (status === "completed" && startTime) {
      setElapsedMs(Date.now() - startTime);
    }
    return () => clearInterval(interval);
  }, [status, startTime]);

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
      setResults([]);
      setStartTime(null);
      setElapsedMs(0);
      setSelectedRun(null);
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
    setResults([]);
    const start = Date.now();
    setStartTime(start);
    setElapsedMs(0);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let currentIteration = 0;
    let currentCompleted = 0;
    let currentSuccess = 0;
    const currentResults: { duration: number, timeOffset: number }[] = [];

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
          const endTime = Date.now();
          currentResults.push({ duration: res.durationMs, timeOffset: endTime - start });
          
          if (res.status >= 200 && res.status < 300) {
            currentSuccess++;
          }
          
          // Batch updates to avoid freezing UI
          if (currentCompleted % Math.max(1, Math.floor(concurrency / 2)) === 0 || currentCompleted === iterations) {
            setCompletedCount(currentCompleted);
            setSuccessCount(currentSuccess);
            setResults([...currentResults]);
          }
        } catch (err) {
          if (controller.signal.aborted) break;
          currentCompleted++;
          // Batch updates
          if (currentCompleted % Math.max(1, Math.floor(concurrency / 2)) === 0 || currentCompleted === iterations) {
            setCompletedCount(currentCompleted);
            setSuccessCount(currentSuccess);
            setResults([...currentResults]);
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
      
      const currentDurations = currentResults.map(r => r.duration);
      const avgDur = currentDurations.length > 0 ? (currentDurations.reduce((a, b) => a + b, 0) / currentDurations.length).toFixed(0) : "0";
      const sortedDur = [...currentDurations].sort((a, b) => a - b);
      const p95Dur = sortedDur.length > 0 ? sortedDur[Math.floor(sortedDur.length * 0.95)]?.toFixed(0) || "0" : "0";
      const minDur = sortedDur.length > 0 ? sortedDur[0].toFixed(0) : "0";
      const maxDur = sortedDur.length > 0 ? sortedDur[sortedDur.length - 1].toFixed(0) : "0";

      const finalElapsedMs = Date.now() - start;
      setElapsedMs(finalElapsedMs);
      const rps = finalElapsedMs > 0 ? (currentCompleted / (finalElapsedMs / 1000)).toFixed(1) : "0";

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
        maxDurationMs: maxDur,
        rps,
        chartData: generateDualChartData(currentResults, 100)
      });
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setStatus("completed");
    if (startTime) {
      setElapsedMs(Date.now() - startTime);
    }
  };

  const handleClose = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    onClose();
  };

  if (!isOpen) return null;

  const durations = results.map(r => r.duration);
  const avgDuration = durations.length > 0 ? (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(0) : "0";
  const sortedDurations = [...durations].sort((a, b) => a - b);
  const p95 = sortedDurations.length > 0 ? sortedDurations[Math.floor(sortedDurations.length * 0.95)]?.toFixed(0) || "0" : "0";
  const max = sortedDurations.length > 0 ? sortedDurations[sortedDurations.length - 1].toFixed(0) : "0";
  const min = sortedDurations.length > 0 ? sortedDurations[0].toFixed(0) : "0";
  const currentRps = elapsedMs > 0 ? (completedCount / (elapsedMs / 1000)).toFixed(1) : "0.0";

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
          {selectedRun ? (
            <section className="settings-section">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ fontSize: "14px", color: "var(--color-text)", margin: 0 }}>Run: {formatTimestamp(selectedRun.timestamp)}</h3>
                <button type="button" onClick={() => setSelectedRun(null)} style={{ padding: "4px 8px", fontSize: "12px", background: "var(--color-surface-hover)", border: "1px solid var(--color-border)", borderRadius: "4px", color: "var(--color-text)", cursor: "pointer" }}>Back to History</button>
              </div>

              {selectedRun.chartData && (
                <div style={{ marginBottom: "16px", flexShrink: 0 }}>
                  <DualK6Chart data={selectedRun.chartData} />
                </div>
              )}
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
                <div style={{ padding: "8px 12px", background: "var(--color-surface-hover)", borderRadius: "8px" }}>
                  <div style={{ fontSize: "11px", color: "var(--color-muted)", marginBottom: "4px" }}>Success Rate</div>
                  <div style={{ fontSize: "18px", fontWeight: "600", color: selectedRun.successCount === selectedRun.completedCount && selectedRun.completedCount > 0 ? "var(--color-success)" : (selectedRun.successCount > 0 ? "var(--color-warning)" : "var(--color-danger)") }}>
                    {selectedRun.completedCount > 0 ? ((selectedRun.successCount / selectedRun.completedCount) * 100).toFixed(1) : 0}%
                  </div>
                </div>
                <div style={{ padding: "8px 12px", background: "var(--color-surface-hover)", borderRadius: "8px" }}>
                  <div style={{ fontSize: "11px", color: "var(--color-muted)", marginBottom: "4px" }}>Avg Response</div>
                  <div style={{ fontSize: "18px", fontWeight: "600", color: "var(--color-text)" }}>{selectedRun.avgDurationMs} ms</div>
                </div>
                <div style={{ padding: "8px 12px", background: "var(--color-surface-hover)", borderRadius: "8px" }}>
                  <div style={{ fontSize: "11px", color: "var(--color-muted)", marginBottom: "4px" }}>Min / Max</div>
                  <div style={{ fontSize: "18px", fontWeight: "600", color: "var(--color-text)" }}>{selectedRun.minDurationMs}/{selectedRun.maxDurationMs} ms</div>
                </div>
                <div style={{ padding: "8px 12px", background: "var(--color-surface-hover)", borderRadius: "8px" }}>
                  <div style={{ fontSize: "11px", color: "var(--color-muted)", marginBottom: "4px" }}>Throughput</div>
                  <div style={{ fontSize: "18px", fontWeight: "600", color: "var(--color-text)" }}>{selectedRun.rps || "-"} <span style={{ fontSize: "11px", fontWeight: "normal", color: "var(--color-muted)" }}>req/s</span></div>
                </div>
              </div>
              
            </section>
          ) : status === "configuring" ? (
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
                          <th style={{ padding: "6px 8px", fontWeight: 600, color: "var(--color-muted)" }}>RPS</th>
                          <th style={{ padding: "6px 8px", fontWeight: 600, color: "var(--color-muted)" }}>Avg</th>
                          <th style={{ padding: "6px 8px", fontWeight: 600, color: "var(--color-muted)" }}>P95</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map(run => (
                          <tr key={run.id} onClick={() => setSelectedRun(run)} style={{ borderBottom: "1px solid var(--color-border)", cursor: "pointer" }} className="load-test-row">
                            <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{formatTimestamp(run.timestamp)}</td>
                            <td style={{ padding: "6px 8px" }}>{run.iterations}</td>
                            <td style={{ padding: "6px 8px" }}>{run.concurrency}</td>
                            <td style={{ padding: "6px 8px" }}>
                              <span style={{ color: run.successCount === run.completedCount ? "var(--color-success)" : "var(--color-warning)" }}>
                                {run.successCount}/{run.completedCount}
                              </span>
                            </td>
                            <td style={{ padding: "6px 8px" }}>{run.rps || "-"}</td>
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

              <div style={{ marginBottom: "16px", flexShrink: 0 }}>
                <DualK6Chart data={generateDualChartData(results, 100)} />
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
                <div style={{ padding: "8px 12px", background: "var(--color-surface-hover)", borderRadius: "8px" }}>
                  <div style={{ fontSize: "11px", color: "var(--color-muted)", marginBottom: "4px" }}>Success Rate</div>
                  <div style={{ fontSize: "18px", fontWeight: "600", color: successCount === completedCount && completedCount > 0 ? "var(--color-success)" : (successCount > 0 ? "var(--color-warning)" : "var(--color-danger)") }}>
                    {completedCount > 0 ? ((successCount / completedCount) * 100).toFixed(1) : 0}%
                  </div>
                </div>
                <div style={{ padding: "8px 12px", background: "var(--color-surface-hover)", borderRadius: "8px" }}>
                  <div style={{ fontSize: "11px", color: "var(--color-muted)", marginBottom: "4px" }}>Avg Response</div>
                  <div style={{ fontSize: "18px", fontWeight: "600", color: "var(--color-text)" }}>{avgDuration} ms</div>
                </div>
                <div style={{ padding: "8px 12px", background: "var(--color-surface-hover)", borderRadius: "8px" }}>
                  <div style={{ fontSize: "11px", color: "var(--color-muted)", marginBottom: "4px" }}>P95 Response</div>
                  <div style={{ fontSize: "18px", fontWeight: "600", color: "var(--color-text)" }}>{p95} ms</div>
                </div>
                <div style={{ padding: "8px 12px", background: "var(--color-surface-hover)", borderRadius: "8px" }}>
                  <div style={{ fontSize: "11px", color: "var(--color-muted)", marginBottom: "4px" }}>Min / Max</div>
                  <div style={{ fontSize: "18px", fontWeight: "600", color: "var(--color-text)" }}>{min}/{max} ms</div>
                </div>
                <div style={{ padding: "8px 12px", background: "var(--color-surface-hover)", borderRadius: "8px" }}>
                  <div style={{ fontSize: "11px", color: "var(--color-muted)", marginBottom: "4px" }}>Throughput</div>
                  <div style={{ fontSize: "18px", fontWeight: "600", color: "var(--color-text)" }}>{currentRps} <span style={{ fontSize: "11px", fontWeight: "normal", color: "var(--color-muted)" }}>req/s</span></div>
                </div>
              </div>
              
            </section>
          )}
        </div>

        <div className="settings-footer" style={{ justifyContent: "flex-end" }}>
          <div className="settings-footer-actions">
            {status === "configuring" && !selectedRun && (
              <>
                <button className="modal-cancel" type="button" onClick={handleClose}>
                  Cancel
                </button>
                <button className="modal-confirm" type="button" onClick={handleStart} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <Play size={14} /> Start Load Test
                </button>
              </>
            )}
            {status === "running" && !selectedRun && (
              <button className="modal-cancel" type="button" onClick={handleCancel} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <Square size={14} /> Stop
              </button>
            )}
            {status === "completed" && !selectedRun && (
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
