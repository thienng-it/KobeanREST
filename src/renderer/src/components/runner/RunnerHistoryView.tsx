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
              <span style={{ color: "var(--color-success)" }}>✓ {run.passedRequests}</span>
              <span style={{ color: "var(--color-danger)" }}>✗ {run.failedRequests}</span>
              <span>Total: {run.totalRequests}</span>
            </div>
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
                      {isSuccess ? <CheckCircle size={14} color="var(--color-success)" /> : <XCircle size={14} color="var(--color-danger)" />}
                      <span style={{ fontWeight: 600, fontSize: "12px" }}>{entry.method}</span>
                      <span style={{ fontSize: "12px", color: "var(--color-text)" }}>{entry.url}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "11px" }}>
                      <span style={{ color: isSuccess ? "var(--color-success)" : "var(--color-danger)", fontWeight: 600 }}>
                        {entry.status}
                      </span>
                      <span style={{ color: "var(--color-text-muted)" }}>
                        <Clock size={12} style={{ display: "inline", marginRight: "3px" }} />
                        {entry.durationMs}ms
                      </span>
                    </div>
                  </div>
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
