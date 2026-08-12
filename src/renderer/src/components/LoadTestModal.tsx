import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Play, Square, Activity, Download, BarChart3, Clock, TrendingUp, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import type { SavedRequest, WorkspaceSummary } from "../types";
import { prepareRequestForExecution } from "../services/request-executor";
import { executeHttpRequest } from "../services/http-client";
import { buildScopedVariableMap } from "../services/variables";
import { formatTimestamp } from "../app-utils";

// ── Types ────────────────────────────────────────────────────────────────────

export interface LoadTestHistoryRecord {
  id: string;
  requestId: string;
  timestamp: string;
  iterations: number;
  concurrency: number;
  mode: "iterations" | "duration";
  durationSecs?: number;
  completedCount: number;
  successCount: number;
  errorCount: number;
  avgDurationMs: string;
  p50DurationMs: string;
  p95DurationMs: string;
  p99DurationMs: string;
  minDurationMs: string;
  maxDurationMs: string;
  rps?: string;
  statusBreakdown?: Record<string, number>;
  chartData?: ChartDataPoint[];
}

export interface ChartDataPoint {
  t: number;           // bin index
  rps: number;
  avgDuration: number;
  errorRate: number;   // 0-100
}

interface RawResult {
  duration: number;
  timeOffset: number;
  status: number;
  error?: string;
}

// ── Chart Data Builder ────────────────────────────────────────────────────────

function generateChartData(results: RawResult[], targetBins = 80): ChartDataPoint[] {
  if (results.length === 0) return [];
  const maxTime = Math.max(...results.map(r => r.timeOffset), 1);
  const binMs = Math.max(10, maxTime / targetBins);
  const n = Math.ceil(maxTime / binMs) + 1;

  const bins = Array.from({ length: n }, () => ({ count: 0, errors: 0, sumDur: 0 }));
  for (const r of results) {
    const idx = Math.min(n - 1, Math.max(0, Math.floor(r.timeOffset / binMs)));
    bins[idx].count++;
    bins[idx].sumDur += r.duration;
    if (r.status < 200 || r.status >= 300) bins[idx].errors++;
  }

  return bins.map((b, t) => ({
    t,
    rps: b.count / (binMs / 1000),
    avgDuration: b.count > 0 ? b.sumDur / b.count : 0,
    errorRate: b.count > 0 ? (b.errors / b.count) * 100 : 0,
  }));
}

// ── Percentile Helper ─────────────────────────────────────────────────────────

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.floor(sorted.length * p)] ?? 0;
}

// ── SVG Chart ────────────────────────────────────────────────────────────────

function LoadTestChart({ data, height = 160 }: { data: ChartDataPoint[]; height?: number }) {
  if (!data || data.length < 2) {
    return (
      <div style={{ height, background: "var(--color-surface-hover)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "var(--color-text-muted)" }}>
        Waiting for data…
      </div>
    );
  }

  const maxDur = Math.max(...data.map(d => d.avgDuration), 1);
  const maxRps = Math.max(...data.map(d => d.rps), 1);

  const pts = (key: "avgDuration" | "rps", max: number) =>
    data.map((d, i) => {
      const x = (i / Math.max(1, data.length - 1)) * 100;
      const y = 100 - (d[key] / max) * 96;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ");

  const durPts = pts("avgDuration", maxDur);
  const rpsPts = pts("rps", maxRps);

  // Y-axis labels
  const yLabels = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    y: f,
    durLabel: `${(maxDur * (1 - f)).toFixed(0)}ms`,
    rpsLabel: `${(maxRps * (1 - f)).toFixed(1)}`,
  }));

  return (
    <div style={{ background: "var(--color-surface-hover)", borderRadius: 10, padding: "12px 8px 8px 0", userSelect: "none" }}>
      {/* Legend */}
      <div style={{ display: "flex", gap: "16px", marginBottom: 8, paddingLeft: 52, fontSize: 11 }}>
        <span style={{ color: "#3b82f6", display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 18, height: 2, background: "#3b82f6", display: "inline-block", borderRadius: 1 }} />Avg Response (ms)</span>
        <span style={{ color: "#8b5cf6", display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 18, height: 2, background: "#8b5cf6", display: "inline-block", borderRadius: 1 }} />Throughput (req/s)</span>
        <span style={{ color: "#ef4444", display: "flex", alignItems: "center", gap: 5, marginLeft: "auto", paddingRight: 8 }}><span style={{ width: 10, height: 10, background: "#ef4444", display: "inline-block", borderRadius: 2, opacity: 0.5 }} />Error Rate</span>
      </div>

      <div style={{ display: "flex", gap: 0 }}>
        {/* Left Y-axis: response time */}
        <div style={{ width: 52, flexShrink: 0, position: "relative", height }}>
          {yLabels.map(({ y, durLabel }) => (
            <div key={y} style={{ position: "absolute", right: 6, bottom: `${y * 100}%`, fontSize: 10, color: "#3b82f6", transform: "translateY(50%)", whiteSpace: "nowrap" }}>
              {durLabel}
            </div>
          ))}
        </div>

        {/* Chart area */}
        <div style={{ flex: 1, position: "relative", height }}>
          <svg preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }} viewBox="0 0 100 100">
            {/* Grid lines */}
            {[0.25, 0.5, 0.75].map(f => (
              <line key={f} x1="0" y1={`${f * 100}`} x2="100" y2={`${f * 100}`} stroke="var(--color-border)" strokeWidth="0.4" strokeDasharray="2,2" vectorEffect="non-scaling-stroke" />
            ))}
            {/* Error rate bars */}
            {data.map((d, i) => {
              if (d.errorRate === 0) return null;
              const x = (i / Math.max(1, data.length - 1)) * 100;
              const errH = (d.errorRate / 100) * 100;
              return <rect key={i} x={`${x - 0.4}`} y={`${100 - errH}`} width="0.8" height={`${errH}`} fill="#ef4444" opacity="0.35" />;
            })}
            {/* RPS area */}
            <polygon points={`0,100 ${rpsPts} 100,100`} fill="#8b5cf615" />
            <polyline points={rpsPts} fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            {/* Duration line */}
            <polygon points={`0,100 ${durPts} 100,100`} fill="#3b82f610" />
            <polyline points={durPts} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>

        {/* Right Y-axis: rps */}
        <div style={{ width: 40, flexShrink: 0, position: "relative", height }}>
          {yLabels.map(({ y, rpsLabel }) => (
            <div key={y} style={{ position: "absolute", left: 4, bottom: `${y * 100}%`, fontSize: 10, color: "#8b5cf6", transform: "translateY(50%)", whiteSpace: "nowrap" }}>
              {rpsLabel}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Status Breakdown Bar ──────────────────────────────────────────────────────

function StatusBreakdown({ breakdown }: { breakdown: Record<string, number> }) {
  const entries = Object.entries(breakdown).sort((a, b) => Number(a[0]) - Number(b[0]));
  const total = entries.reduce((s, [, v]) => s + v, 0);
  const color = (code: string) => {
    const n = Number(code);
    if (n < 300) return "#10b981";
    if (n < 400) return "#f59e0b";
    if (n < 500) return "#f97316";
    return "#ef4444";
  };
  return (
    <div>
      {/* Stacked bar */}
      <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
        {entries.map(([code, count]) => (
          <div key={code} style={{ flex: count / total, background: color(code), transition: "flex 0.3s" }} title={`${code}: ${count}`} />
        ))}
      </div>
      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px" }}>
        {entries.map(([code, count]) => (
          <span key={code} style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: color(code), display: "inline-block" }} />
            <span style={{ fontWeight: 600, color: color(code) }}>{code}</span>
            <span style={{ color: "var(--color-text-muted)" }}>— {count} ({((count / total) * 100).toFixed(1)}%)</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, unit, color, sub }: { label: string; value: string; unit?: string; color?: string; sub?: string }) {
  return (
    <div style={{ padding: "12px 16px", background: "var(--color-surface-hover)", borderRadius: 10, display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ fontSize: 10, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.6px", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || "var(--color-text)", lineHeight: 1.1 }}>
        {value}
        {unit && <span style={{ fontSize: 11, fontWeight: 400, color: "var(--color-text-muted)", marginLeft: 4 }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>{sub}</div>}
    </div>
  );
}

// ── Stats Grid ────────────────────────────────────────────────────────────────

function StatsGrid({ avg, p50, p95, p99, min, max, rps, successRate, errorCount, completed }: {
  avg: string; p50: string; p95: string; p99: string; min: string; max: string;
  rps: string; successRate: number; errorCount: number; completed: number;
}) {
  const srColor = successRate === 100 ? "#10b981" : successRate >= 95 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
      <StatCard label="Success Rate" value={`${successRate.toFixed(1)}%`} color={srColor} sub={errorCount > 0 ? `${errorCount} errors` : `${completed} ok`} />
      <StatCard label="Throughput" value={rps} unit="req/s" />
      <StatCard label="Avg Response" value={avg} unit="ms" />
      <StatCard label="P50 Response" value={p50} unit="ms" />
      <StatCard label="P95 Response" value={p95} unit="ms" />
      <StatCard label="P99 Response" value={p99} unit="ms" />
      <StatCard label="Min Response" value={min} unit="ms" color="#10b981" />
      <StatCard label="Max Response" value={max} unit="ms" color="#ef4444" />
    </div>
  );
}

// ── CSV Export ────────────────────────────────────────────────────────────────

function exportCsv(results: RawResult[], requestName: string) {
  const lines = ["index,duration_ms,status,time_offset_ms,ok"];
  results.forEach((r, i) => {
    lines.push(`${i + 1},${r.duration},${r.status},${r.timeOffset},${r.status >= 200 && r.status < 300 ? "true" : "false"}`);
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `load-test-${requestName.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 19)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── History helpers ───────────────────────────────────────────────────────────

function loadHistory(reqId: string): LoadTestHistoryRecord[] {
  try {
    const all = JSON.parse(localStorage.getItem("kr_load_test_history") || "{}");
    return all[reqId] || [];
  } catch { return []; }
}

function saveHistoryRecord(record: LoadTestHistoryRecord) {
  try {
    const all = JSON.parse(localStorage.getItem("kr_load_test_history") || "{}");
    const list = all[record.requestId] || [];
    list.unshift(record);
    if (list.length > 20) list.length = 20;
    all[record.requestId] = list;
    localStorage.setItem("kr_load_test_history", JSON.stringify(all));
    return list as LoadTestHistoryRecord[];
  } catch { return []; }
}

// ── Main Component ────────────────────────────────────────────────────────────

export interface LoadTestModalProps {
  isOpen: boolean;
  request: SavedRequest | null;
  workspace: WorkspaceSummary | null;
  onClose: () => void;
}

type TestMode = "iterations" | "duration";

export function LoadTestModal({ isOpen, request, workspace, onClose }: LoadTestModalProps) {
  // Config
  const [mode, setMode] = useState<TestMode>("iterations");
  const [concurrency, setConcurrency] = useState(10);
  const [iterations, setIterations] = useState(100);
  const [durationSecs, setDurationSecs] = useState(30);
  const [rampUpSecs, setRampUpSecs] = useState(0);
  const [thinkTimeMs, setThinkTimeMs] = useState(0);

  // Run state
  const [status, setStatus] = useState<"configuring" | "running" | "completed">("configuring");
  const [completedCount, setCompletedCount] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [results, setResults] = useState<RawResult[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [statusBreakdown, setStatusBreakdown] = useState<Record<string, number>>({});

  // History
  const [history, setHistory] = useState<LoadTestHistoryRecord[]>([]);
  const [selectedRun, setSelectedRun] = useState<LoadTestHistoryRecord | null>(null);
  const [activeTab, setActiveTab] = useState<"results" | "history">("results");

  const abortRef = useRef<AbortController | null>(null);
  const rawResultsRef = useRef<RawResult[]>([]);

  // Live timer
  useEffect(() => {
    let interval: any;
    if (status === "running" && startTime) {
      interval = setInterval(() => setElapsedMs(Date.now() - startTime), 200);
    }
    return () => clearInterval(interval);
  }, [status, startTime]);

  useEffect(() => {
    if (!isOpen) {
      setStatus("configuring");
      setCompletedCount(0); setSuccessCount(0); setErrorCount(0);
      setResults([]); setStartTime(null); setElapsedMs(0);
      setSelectedRun(null); setStatusBreakdown({});
      rawResultsRef.current = [];
      abortRef.current?.abort();
      abortRef.current = null;
    } else if (request) {
      setHistory(loadHistory(request.id));
    }
  }, [isOpen, request]);

  // Derived stats
  const durations = results.map(r => r.duration);
  const sorted = [...durations].sort((a, b) => a - b);
  const avg = sorted.length > 0 ? (sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(0) : "0";
  const p50 = pct(sorted, 0.50).toFixed(0);
  const p95 = pct(sorted, 0.95).toFixed(0);
  const p99 = pct(sorted, 0.99).toFixed(0);
  const minD = sorted.length > 0 ? sorted[0].toFixed(0) : "0";
  const maxD = sorted.length > 0 ? sorted[sorted.length - 1].toFixed(0) : "0";
  const rps = elapsedMs > 0 ? (completedCount / (elapsedMs / 1000)).toFixed(1) : "0.0";
  const successRate = completedCount > 0 ? (successCount / completedCount) * 100 : 0;

  const chartData = useCallback(
    () => generateChartData(results, 80),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [results.length]
  )();

  const handleStart = async () => {
    if (!request || !workspace) return;
    setStatus("running");
    setCompletedCount(0); setSuccessCount(0); setErrorCount(0);
    setResults([]); setStatusBreakdown({});
    rawResultsRef.current = [];
    const start = Date.now();
    setStartTime(start);
    setElapsedMs(0);

    const controller = new AbortController();
    abortRef.current = controller;

    let currentIteration = 0;
    let done = false;

    // Duration mode: stop after N seconds
    let durationTimer: any;
    if (mode === "duration") {
      durationTimer = setTimeout(() => {
        done = true;
        controller.abort();
      }, durationSecs * 1000);
    }

    const allCounts = { completed: 0, success: 0, error: 0 };
    const sdBreakdown: Record<string, number> = {};

    const flush = () => {
      setCompletedCount(allCounts.completed);
      setSuccessCount(allCounts.success);
      setErrorCount(allCounts.error);
      setStatusBreakdown({ ...sdBreakdown });
      setResults([...rawResultsRef.current]);
    };

    const runWorker = async (workerIndex: number) => {
      // Ramp-up: stagger worker starts
      if (rampUpSecs > 0 && concurrency > 1) {
        const stagger = (rampUpSecs * 1000 * workerIndex) / Math.max(1, concurrency - 1);
        await new Promise(res => setTimeout(res, stagger));
      }

      while (!controller.signal.aborted) {
        // Iterations mode: check count
        if (mode === "iterations") {
          const myIteration = ++currentIteration;
          if (myIteration > iterations) break;
        }

        const reqStart = Date.now();
        try {
          const variableMap = buildScopedVariableMap(workspace, {
            collectionId: workspace.folders.find(f => f.id === request.folderId)?.collectionId,
            folderId: request.folderId,
            request,
          });
          const { request: execReq } = await prepareRequestForExecution(request, workspace, variableMap);
          if (controller.signal.aborted) break;
          const res = await executeHttpRequest(execReq);
          if (controller.signal.aborted) break;

          const dur = Date.now() - reqStart;
          const offset = Date.now() - start;
          rawResultsRef.current.push({ duration: dur, timeOffset: offset, status: res.status });

          allCounts.completed++;
          if (res.status >= 200 && res.status < 300) allCounts.success++;
          else allCounts.error++;
          sdBreakdown[String(res.status)] = (sdBreakdown[String(res.status)] || 0) + 1;
        } catch (err) {
          if (controller.signal.aborted) break;
          const dur = Date.now() - reqStart;
          rawResultsRef.current.push({ duration: dur, timeOffset: Date.now() - start, status: 0 });
          allCounts.completed++;
          allCounts.error++;
          sdBreakdown["Error"] = (sdBreakdown["Error"] || 0) + 1;
        }

        // Think time
        if (thinkTimeMs > 0 && !controller.signal.aborted) {
          await new Promise(res => setTimeout(res, thinkTimeMs));
        }

        // Batch flush every ~concurrency/2 completions
        if (allCounts.completed % Math.max(1, Math.floor(concurrency / 2)) === 0) {
          flush();
        }
      }
    };

    const actualConc = mode === "iterations" ? Math.min(concurrency, iterations) : concurrency;
    const workers = Array.from({ length: actualConc }, (_, i) => runWorker(i));
    await Promise.all(workers);

    clearTimeout(durationTimer);
    flush();

    if (!done || mode === "iterations") {
      setElapsedMs(Date.now() - start);
    }
    setStatus("completed");

    const finalDurations = rawResultsRef.current.map(r => r.duration).sort((a, b) => a - b);
    const finalElapsed = Date.now() - start;
    const finalRps = finalElapsed > 0 ? (allCounts.completed / (finalElapsed / 1000)).toFixed(1) : "0";

    const record: LoadTestHistoryRecord = {
      id: crypto.randomUUID(),
      requestId: request.id,
      timestamp: new Date().toISOString(),
      iterations: mode === "iterations" ? iterations : allCounts.completed,
      concurrency,
      mode,
      durationSecs: mode === "duration" ? durationSecs : undefined,
      completedCount: allCounts.completed,
      successCount: allCounts.success,
      errorCount: allCounts.error,
      avgDurationMs: finalDurations.length > 0 ? (finalDurations.reduce((a, b) => a + b, 0) / finalDurations.length).toFixed(0) : "0",
      p50DurationMs: pct(finalDurations, 0.50).toFixed(0),
      p95DurationMs: pct(finalDurations, 0.95).toFixed(0),
      p99DurationMs: pct(finalDurations, 0.99).toFixed(0),
      minDurationMs: finalDurations.length > 0 ? finalDurations[0].toFixed(0) : "0",
      maxDurationMs: finalDurations.length > 0 ? finalDurations[finalDurations.length - 1].toFixed(0) : "0",
      rps: finalRps,
      statusBreakdown: sdBreakdown,
      chartData: generateChartData(rawResultsRef.current, 80),
    };
    const newHistory = saveHistoryRecord(record);
    setHistory(newHistory);
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setStatus("completed");
    if (startTime) setElapsedMs(Date.now() - startTime);
  };

  const handleClose = () => { abortRef.current?.abort(); onClose(); };

  if (!isOpen) return null;

  const progressPct = mode === "iterations"
    ? (completedCount / Math.max(1, iterations)) * 100
    : Math.min(100, (elapsedMs / Math.max(1, durationSecs * 1000)) * 100);

  return createPortal(
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal settings-modal"
        onClick={e => e.stopPropagation()}
        style={{ width: "900px", maxWidth: "96vw", height: "88vh", display: "flex", flexDirection: "column" }}
      >
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="settings-header">
          <div>
            <span className="settings-kicker">Performance Testing</span>
            <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Activity size={18} style={{ color: "var(--color-accent)" }} />
              Load Test: {request?.name || "Request"}
            </h2>
            <p>{request?.method} {request?.url}</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {status === "completed" && results.length > 0 && (
              <button
                type="button"
                onClick={() => exportCsv(rawResultsRef.current, request?.name || "request")}
                style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-surface-hover)", color: "var(--color-text)", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
              >
                <Download size={13} /> Export CSV
              </button>
            )}
            <button className="settings-close" type="button" onClick={handleClose}><X size={18} /></button>
          </div>
        </div>

        <div className="settings-content" style={{ flex: 1, overflowY: "auto", paddingBottom: 0 }}>
          {/* ── Tab bar ────────────────────────────────────────────── */}
          {status !== "running" && (
            <div style={{ display: "flex", borderBottom: "1px solid var(--color-border)", marginBottom: 0, flexShrink: 0 }}>
              {(["results", "history"] as const).map(t => (
                <button key={t} onClick={() => setActiveTab(t)} style={{ padding: "10px 20px", border: "none", borderBottom: `2px solid ${activeTab === t ? "var(--color-accent)" : "transparent"}`, background: "none", color: activeTab === t ? "var(--color-text)" : "var(--color-text-muted)", cursor: "pointer", fontSize: 13, fontWeight: activeTab === t ? 600 : 400, textTransform: "capitalize" }}>
                  {t === "history" ? `History (${history.length})` : t === "results" && status === "completed" ? "Results" : "Configure"}
                </button>
              ))}
            </div>
          )}

          {/* ── Configure ──────────────────────────────────────────── */}
          {(status === "configuring" && activeTab === "results") && (
            <section className="settings-section">
              {/* Mode toggle */}
              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                {(["iterations", "duration"] as const).map(m => (
                  <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: `2px solid ${mode === m ? "var(--color-accent)" : "var(--color-border)"}`, background: mode === m ? "rgba(99,102,241,0.08)" : "transparent", color: mode === m ? "var(--color-accent)" : "var(--color-text-muted)", cursor: "pointer", fontWeight: mode === m ? 700 : 500, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    {m === "iterations" ? <><BarChart3 size={14} /> Iteration-based</> : <><Clock size={14} /> Duration-based</>}
                  </button>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
                {/* Left column */}
                <div>
                  {mode === "iterations" ? (
                    <label className="settings-row" style={{ borderBottom: "none" }}>
                      <span style={{ flex: 1 }}>
                        <strong>Total Iterations</strong>
                        <small>Total number of requests to send</small>
                      </span>
                      <input type="number" min="1" className="input" style={{ width: 100 }} value={iterations} onChange={e => setIterations(Math.max(1, parseInt(e.target.value) || 1))} />
                    </label>
                  ) : (
                    <label className="settings-row" style={{ borderBottom: "none" }}>
                      <span style={{ flex: 1 }}>
                        <strong>Test Duration</strong>
                        <small>How long to run (seconds)</small>
                      </span>
                      <input type="number" min="1" max="3600" className="input" style={{ width: 100 }} value={durationSecs} onChange={e => setDurationSecs(Math.max(1, parseInt(e.target.value) || 30))} />
                    </label>
                  )}
                  <label className="settings-row" style={{ borderBottom: "none", paddingBottom: 0 }}>
                    <span style={{ flex: 1 }}>
                      <strong>Virtual Users (Concurrency)</strong>
                      <small>Simultaneous parallel requests</small>
                    </span>
                    <input type="number" min="1" max="500" className="input" style={{ width: 100 }} value={concurrency} onChange={e => setConcurrency(Math.max(1, parseInt(e.target.value) || 1))} />
                  </label>
                </div>

                {/* Right column: advanced */}
                <div>
                  <label className="settings-row" style={{ borderBottom: "none" }}>
                    <span style={{ flex: 1 }}>
                      <strong>Ramp-up Duration</strong>
                      <small>Seconds to gradually start all VUs (0 = instant)</small>
                    </span>
                    <input type="number" min="0" max="300" className="input" style={{ width: 100 }} value={rampUpSecs} onChange={e => setRampUpSecs(Math.max(0, parseInt(e.target.value) || 0))} />
                  </label>
                  <label className="settings-row" style={{ borderBottom: "none", paddingBottom: 0 }}>
                    <span style={{ flex: 1 }}>
                      <strong>Think Time</strong>
                      <small>Wait between requests per VU (ms)</small>
                    </span>
                    <input type="number" min="0" max="60000" className="input" style={{ width: 100 }} value={thinkTimeMs} onChange={e => setThinkTimeMs(Math.max(0, parseInt(e.target.value) || 0))} />
                  </label>
                </div>
              </div>

              {/* Summary preview */}
              <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 8, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", fontSize: 12, color: "var(--color-text-muted)", display: "flex", gap: 24, flexWrap: "wrap" }}>
                <span>🔀 <strong>{concurrency}</strong> virtual users</span>
                {mode === "iterations"
                  ? <span>🔁 <strong>{iterations}</strong> total requests</span>
                  : <span>⏱ <strong>{durationSecs}s</strong> duration</span>}
                {rampUpSecs > 0 && <span>📈 <strong>{rampUpSecs}s</strong> ramp-up</span>}
                {thinkTimeMs > 0 && <span>💤 <strong>{thinkTimeMs}ms</strong> think time / VU</span>}
              </div>
            </section>
          )}

          {/* ── Running ────────────────────────────────────────────── */}
          {status === "running" && (
            <section className="settings-section" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Progress */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                  <strong>
                    {mode === "iterations" ? `${completedCount} / ${iterations} requests` : `${(elapsedMs / 1000).toFixed(1)}s / ${durationSecs}s`}
                  </strong>
                  <span style={{ color: "var(--color-text-muted)", fontFamily: "monospace" }}>
                    {rps} req/s · {elapsedMs > 0 ? (elapsedMs / 1000).toFixed(1) : "0"}s elapsed
                  </span>
                </div>
                <div style={{ width: "100%", height: 8, background: "var(--color-surface-hover)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${progressPct}%`, height: "100%", background: "var(--color-accent)", transition: "width 0.3s", borderRadius: 4 }} />
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 11, color: "var(--color-text-muted)" }}>
                  <span style={{ color: "#10b981" }}>✓ {successCount} ok</span>
                  {errorCount > 0 && <span style={{ color: "#ef4444" }}>✗ {errorCount} errors</span>}
                  <span style={{ marginLeft: "auto", color: "var(--color-accent)" }}>{concurrency} VUs active{rampUpSecs > 0 ? " (ramping up)" : ""}</span>
                </div>
              </div>

              {/* Live chart */}
              <LoadTestChart data={chartData} height={200} />

              {/* Live stats */}
              <StatsGrid avg={avg} p50={p50} p95={p95} p99={p99} min={minD} max={maxD} rps={rps} successRate={successRate} errorCount={errorCount} completed={completedCount} />
            </section>
          )}

          {/* ── Completed Results ──────────────────────────────────── */}
          {status === "completed" && activeTab === "results" && (
            <section className="settings-section" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Completion banner */}
              <div style={{ padding: "10px 16px", borderRadius: 8, background: successRate === 100 ? "rgba(16,185,129,0.08)" : successRate >= 95 ? "rgba(245,158,11,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${successRate === 100 ? "rgba(16,185,129,0.2)" : successRate >= 95 ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.2)"}`, display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                {successRate === 100 ? <CheckCircle2 size={16} style={{ color: "#10b981" }} /> : <AlertTriangle size={16} style={{ color: successRate >= 95 ? "#f59e0b" : "#ef4444" }} />}
                <span>
                  Test complete · <strong>{completedCount}</strong> requests in <strong>{(elapsedMs / 1000).toFixed(2)}s</strong> · <strong>{successCount}</strong> succeeded · <strong>{errorCount}</strong> failed
                </span>
              </div>

              {/* Chart */}
              <LoadTestChart data={chartData} height={200} />

              {/* Stats grid */}
              <StatsGrid avg={avg} p50={p50} p95={p95} p99={p99} min={minD} max={maxD} rps={rps} successRate={successRate} errorCount={errorCount} completed={completedCount} />

              {/* Status breakdown */}
              {Object.keys(statusBreakdown).length > 1 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", marginBottom: 8, letterSpacing: "0.5px" }}>Status Code Breakdown</div>
                  <StatusBreakdown breakdown={statusBreakdown} />
                </div>
              )}
            </section>
          )}

          {/* ── History tab ────────────────────────────────────────── */}
          {activeTab === "history" && status !== "running" && (
            <section className="settings-section">
              {selectedRun ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ margin: 0, fontSize: 14 }}>Run: {formatTimestamp(selectedRun.timestamp)}</h3>
                    <button type="button" onClick={() => setSelectedRun(null)} style={{ padding: "4px 12px", fontSize: 12, background: "var(--color-surface-hover)", border: "1px solid var(--color-border)", borderRadius: 4, cursor: "pointer", color: "var(--color-text)" }}>← Back</button>
                  </div>

                  {selectedRun.chartData && <LoadTestChart data={selectedRun.chartData} height={180} />}

                  <StatsGrid
                    avg={selectedRun.avgDurationMs} p50={selectedRun.p50DurationMs || "–"} p95={selectedRun.p95DurationMs}
                    p99={selectedRun.p99DurationMs || "–"} min={selectedRun.minDurationMs} max={selectedRun.maxDurationMs}
                    rps={selectedRun.rps || "0"} successRate={selectedRun.completedCount > 0 ? (selectedRun.successCount / selectedRun.completedCount) * 100 : 0}
                    errorCount={selectedRun.errorCount || 0} completed={selectedRun.completedCount}
                  />

                  {selectedRun.statusBreakdown && Object.keys(selectedRun.statusBreakdown).length > 1 && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", marginBottom: 8, letterSpacing: "0.5px" }}>Status Breakdown</div>
                      <StatusBreakdown breakdown={selectedRun.statusBreakdown} />
                    </div>
                  )}
                </div>
              ) : history.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 16px", color: "var(--color-text-muted)", fontSize: 13 }}>
                  No previous runs for this request yet.
                </div>
              ) : (
                <div style={{ border: "1px solid var(--color-border)", borderRadius: 8, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
                    <thead>
                      <tr style={{ background: "var(--color-surface-hover)", borderBottom: "1px solid var(--color-border)" }}>
                        {["Date", "Mode", "VUs", "Requests", "Success %", "RPS", "Avg", "P95", "P99"].map(h => (
                          <th key={h} style={{ padding: "8px 10px", fontWeight: 600, color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {history.map(run => {
                        const sr = run.completedCount > 0 ? (run.successCount / run.completedCount) * 100 : 0;
                        const srColor = sr === 100 ? "#10b981" : sr >= 95 ? "#f59e0b" : "#ef4444";
                        return (
                          <tr key={run.id} onClick={() => setSelectedRun(run)} style={{ borderBottom: "1px solid var(--color-border)", cursor: "pointer" }} className="load-test-row">
                            <td style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>{formatTimestamp(run.timestamp)}</td>
                            <td style={{ padding: "7px 10px" }}>{run.mode === "duration" ? `${run.durationSecs}s` : "iter"}</td>
                            <td style={{ padding: "7px 10px" }}>{run.concurrency}</td>
                            <td style={{ padding: "7px 10px" }}>{run.completedCount}</td>
                            <td style={{ padding: "7px 10px", fontWeight: 700, color: srColor }}>{sr.toFixed(1)}%</td>
                            <td style={{ padding: "7px 10px" }}>{run.rps || "–"}</td>
                            <td style={{ padding: "7px 10px" }}>{run.avgDurationMs}ms</td>
                            <td style={{ padding: "7px 10px" }}>{run.p95DurationMs}ms</td>
                            <td style={{ padding: "7px 10px" }}>{run.p99DurationMs || "–"}ms</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <div className="settings-footer" style={{ justifyContent: "flex-end" }}>
          <div className="settings-footer-actions">
            {status === "configuring" && activeTab === "results" && (
              <>
                <button className="modal-cancel" type="button" onClick={handleClose}>Cancel</button>
                <button className="modal-confirm" type="button" onClick={handleStart} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Play size={14} />
                  {mode === "iterations" ? `Run ${iterations} Requests` : `Run for ${durationSecs}s`}
                </button>
              </>
            )}
            {status === "running" && (
              <button className="modal-cancel" type="button" onClick={handleStop} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Square size={14} /> Stop Test
              </button>
            )}
            {status === "completed" && activeTab === "results" && (
              <>
                <button className="modal-cancel" type="button" onClick={handleClose}>Close</button>
                <button className="modal-confirm" type="button" onClick={() => { setStatus("configuring"); setActiveTab("results"); }} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <RefreshCw size={14} /> New Test
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  , document.body);
}
