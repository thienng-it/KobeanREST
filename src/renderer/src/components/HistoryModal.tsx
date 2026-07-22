import { History, RefreshCw, Search, X } from "lucide-react";
import { formatBytes, statusColor } from "../response-utils";
import { methodClass } from "./MethodSelector";
import type { HistoryEntry, WorkspaceSummary } from "../types";

export interface HistoryModalProps {
  open: boolean;
  historyEntries: HistoryEntry[];
  historySearch: string;
  historyLoading: boolean;
  workspace: WorkspaceSummary | null;
  onClose: () => void;
  onSearchChange: (value: string) => void;
  onClear: () => void;
  onReplay: (entry: HistoryEntry) => void;
  formatTimestamp: (createdAt: string) => string;
}

export function HistoryModal({
  open,
  historyEntries,
  historySearch,
  historyLoading,
  workspace,
  onClose,
  onSearchChange,
  onClear,
  onReplay,
  formatTimestamp,
}: HistoryModalProps) {
  if (!open) return null;

  const q = historySearch.toLowerCase();
  const filtered = historyEntries.filter((e) =>
    !q || e.url.toLowerCase().includes(q) || e.method.toLowerCase().includes(q),
  );

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Request history"
      onClick={onClose}
    >
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "740px", maxWidth: "95vw", maxHeight: "80vh", display: "flex", flexDirection: "column", gap: 0, padding: "24px 24px 16px" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <h2 style={{ margin: 0, fontSize: "15px", display: "flex", alignItems: "center", gap: "8px" }}>
            <History size={16} /> Request History
          </h2>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              type="button"
              className="ghost-button"
              onClick={onClear}
              style={{ fontSize: "12px", minHeight: "30px", padding: "0 10px", color: "var(--color-status-error)", borderColor: "color-mix(in srgb, var(--color-status-error) 40%, transparent)" }}
            >
              Clear all
            </button>
            <button type="button" onClick={onClose} style={{ all: "unset", cursor: "pointer" }}><X size={18} /></button>
          </div>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", padding: "6px 10px", border: "1px solid var(--color-border)", borderRadius: "6px", background: "var(--color-surface-muted)" }}>
          <Search size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
          <input
            value={historySearch}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filter by URL or method…"
            aria-label="Search history"
            style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: "13px", color: "var(--color-text)" }}
          />
        </label>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {historyLoading ? (
            <p style={{ textAlign: "center", opacity: 0.5, fontSize: "13px", padding: "24px 0" }}>Loading…</p>
          ) : filtered.length === 0 ? (
            <p style={{ textAlign: "center", opacity: 0.5, fontSize: "13px", padding: "24px 0" }}>No history yet.</p>
          ) : (
            filtered.map((entry) => {
              const canReplay = workspace?.requests.some((r) => r.id === entry.requestId) ?? false;
              return (
                <div
                  key={entry.id}
                  style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 4px", borderBottom: "1px solid var(--color-border)" }}
                >
                  <span
                    className="history-status-badge"
                    style={{ flexShrink: 0, fontSize: "12px", fontWeight: 700, minWidth: "36px", textAlign: "center", padding: "2px 5px", borderRadius: "4px", color: statusColor(entry.status) }}
                  >
                    {entry.status}
                  </span>
                  <span className={`method method-${methodClass(entry.method)}`} style={{ flexShrink: 0 }}>{entry.method}</span>
                  <span style={{ flex: 1, fontSize: "12px", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--color-text)" }} title={entry.url}>{entry.url}</span>
                  <span style={{ flexShrink: 0, fontSize: "11px", color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>{entry.durationMs} ms</span>
                  <span style={{ flexShrink: 0, fontSize: "11px", color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>{formatBytes(entry.sizeBytes)}</span>
                  <span style={{ flexShrink: 0, fontSize: "11px", color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>{formatTimestamp(entry.createdAt)}</span>
                  <button
                    type="button"
                    onClick={() => onReplay(entry)}
                    disabled={!canReplay}
                    title={canReplay ? "Replay request" : "Saved request was deleted"}
                    style={{ all: "unset", cursor: canReplay ? "pointer" : "not-allowed", opacity: canReplay ? 0.7 : 0.3, flexShrink: 0 }}
                    aria-label="Replay request"
                  >
                    <RefreshCw size={13} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
