import { CheckCircle, XCircle, Clock, ChevronRight, ChevronDown } from "lucide-react";
import type { CollectionRunSummary, HistoryEntry } from "../../types";
import { formatTimestamp } from "../../app-utils";

export interface RunnerHistoryViewProps {
  pastRuns: CollectionRunSummary[];
  loadingHistory: boolean;
  selectedRun: CollectionRunSummary | null;
  runDetails: HistoryEntry[];
  historyFilter: "all" | "passed" | "failed";
  expandedHistoryItems: Set<number>;
  onSelectRun: (run: CollectionRunSummary) => void;
  onFilterChange: (filter: "all" | "passed" | "failed") => void;
  onToggleExpand: (index: number) => void;
}

export function RunnerHistoryView({
  pastRuns,
  loadingHistory,
  selectedRun,
  runDetails,
  historyFilter,
  expandedHistoryItems,
  onSelectRun,
  onFilterChange,
  onToggleExpand,
}: RunnerHistoryViewProps) {
  if (loadingHistory) {
    return <div style={{ padding: "20px", color: "var(--color-text-muted)", textAlign: "center" }}>Loading run history...</div>;
  }

  if (pastRuns.length === 0) {
    return <div style={{ padding: "20px", color: "var(--color-text-muted)", textAlign: "center" }}>No previous collection runs found.</div>;
  }

  const filteredDetails = runDetails.filter((entry) => {
    if (historyFilter === "passed") return entry.status >= 200 && entry.status < 400;
    if (historyFilter === "failed") return entry.status >= 400 || entry.status === 0;
    return true;
  });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: "16px", height: "420px" }}>
      <div style={{ borderRight: "1px solid var(--color-border)", overflowY: "auto", paddingRight: "10px" }}>
        <h4 style={{ margin: "0 0 10px 0", fontSize: "13px", color: "var(--color-text-muted)" }}>Past Executions</h4>
        {pastRuns.map((run) => (
          <div
            key={run.runId}
            onClick={() => onSelectRun(run)}
            style={{
              padding: "8px 10px",
              marginBottom: "6px",
              borderRadius: "6px",
              background: selectedRun?.runId === run.runId ? "var(--color-surface-active)" : "var(--color-surface-muted)",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span style={{ fontWeight: 600 }}>{formatTimestamp(run.createdAt)}</span>
            </div>
            <div style={{ display: "flex", gap: "10px", color: "var(--color-text-muted)", fontSize: "11px" }}>
              <span style={{ color: "var(--color-success)" }}>✓ {run.passedRequests} reqs</span>
              <span style={{ color: "var(--color-danger)" }}>✗ {run.failedRequests} reqs</span>
              <span>Total: {run.totalRequests} reqs</span>
            </div>
            {((run.passedTests ?? 0) > 0 || (run.failedTests ?? 0) > 0) && (
              <div style={{ display: "flex", gap: "10px", color: "var(--color-text-muted)", fontSize: "11px", marginTop: "2px" }}>
                <span>Tests: {run.passedTests || 0} passed, {run.failedTests || 0} failed</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
        {selectedRun ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h4 style={{ margin: 0, fontSize: "13px" }}>Run Details ({selectedRun.runId})</h4>
              <div style={{ display: "flex", gap: "6px" }}>
                {(["all", "passed", "failed"] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    className={`btn-secondary ${historyFilter === filter ? "active" : ""}`}
                    onClick={() => onFilterChange(filter)}
                    style={{ fontSize: "11px", padding: "2px 8px" }}
                  >
                    {filter.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {filteredDetails.map((entry, idx) => {
              const isExpanded = expandedHistoryItems.has(idx);
              const isSuccess = entry.status >= 200 && entry.status < 400;
              return (
                <div
                  key={idx}
                  style={{
                    border: "1px solid var(--color-border)",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    background: "var(--color-surface)",
                  }}
                >
                  <div
                    onClick={() => onToggleExpand(idx)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      {isSuccess ? <CheckCircle size={14} style={{ color: "var(--color-status-success)" }} /> : <XCircle size={14} style={{ color: "var(--color-status-error)" }} />}
                      <span style={{ fontWeight: 600 }}>{entry.method}</span>
                      <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: "300px" }}>
                        {entry.url}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "12px", color: "var(--color-text-muted)" }}>
                      {((entry.passedTests ?? 0) > 0 || (entry.failedTests ?? 0) > 0) && (
                        <span>({entry.passedTests || 0} test passed, {entry.failedTests || 0} failed)</span>
                      )}
                      <span style={{
                        color: entry.status >= 200 && entry.status < 400 ? "var(--color-status-success)" : "var(--color-status-error)",
                        fontWeight: 600, }}>
                        {entry.status}
                      </span>
                      <span style={{ color: "var(--color-text-muted)" }}>
                        <Clock size={12} style={{ display: "inline", marginRight: "3px" }} />
                        {entry.durationMs}ms
                      </span>
                    </div>
                  </div>
                  {isExpanded && (
                    <div style={{
                      marginTop: "12px",
                      paddingTop: "12px",
                      borderTop: "1px solid var(--color-border)",
                      fontSize: "12px"
                    }}>
                      {typeof entry.testResults === 'string' && entry.testResults.length > 0 && (
                        <div>
                          <div style={{ fontWeight: 600, marginBottom: "4px", color: "var(--color-text)" }}>Test Results</div>
                          {(() => {
                            try {
                              const tests = JSON.parse(entry.testResults);
                              if (!Array.isArray(tests) || tests.length === 0) return <span style={{ color: "var(--color-text-muted)" }}>No tests found</span>;
                              
                              return tests.map((t: any, i: number) => (
                                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginTop: "4px" }}>
                                  {t.passed 
                                    ? <CheckCircle size={14} style={{ color: "var(--color-status-success)", flexShrink: 0, marginTop: "1px" }} />
                                    : <XCircle size={14} style={{ color: "var(--color-status-error)", flexShrink: 0, marginTop: "1px" }} />}
                                  <div>
                                    <div style={{ color: t.passed ? "var(--color-status-success)" : "var(--color-status-error)" }}>
                                      {t.name}
                                    </div>
                                    {t.error && (
                                      <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "2px", whiteSpace: "pre-wrap" }}>
                                        {t.error}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ));
                            } catch {
                              return <span style={{ color: "var(--color-text-muted)" }}>Failed to parse test results</span>;
                            }
                          })()}
                        </div>
                      )}

                      <div style={{
                        padding: "8px 14px", display: "flex", gap: "16px",
                        borderBottom: "1px solid var(--color-border)",
                        color: "var(--color-text-muted)",
                      }}>
                        <span>Status: <strong style={{ color: entry.status < 400 ? "var(--color-status-success, #22c55e)" : "var(--color-status-error, #ef4444)" }}>{entry.status}</strong></span>
                        <span>Time: <strong style={{ color: "var(--color-text)" }}>{entry.durationMs}ms</strong></span>
                        <span>Size: <strong style={{ color: "var(--color-text)" }}>{(entry.sizeBytes / 1024).toFixed(1)}kb</strong></span>
                      </div>
                      
                      {entry.responseHeaders && (
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
                            {(() => {
                              try {
                                const headers = JSON.parse(entry.responseHeaders);
                                return Object.entries(headers).map(([key, val], i) => (
                                  <div 
                                    key={i} 
                                    style={{ 
                                      padding: "6px 12px",
                                      borderBottom: i < Object.keys(headers).length - 1 ? "1px solid var(--color-border)" : "none",
                                      color: "var(--color-text-muted)",
                                    }}
                                  >
                                    <strong style={{ color: "var(--color-text)" }}>{key}</strong>: {String(val)}
                                  </div>
                                ));
                              } catch {
                                return <div style={{ padding: "6px 12px", color: "var(--color-text-muted)" }}>{entry.responseHeaders}</div>;
                              }
                            })()}
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
                        {entry.responseBodyText || "(empty body)"}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        ) : (
          <div style={{ padding: "20px", color: "var(--color-text-muted)", textAlign: "center" }}>
            Select a run from the list to view detailed execution results.
          </div>
        )}
      </div>
    </div>
  );
}
