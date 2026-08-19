import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Terminal,
  Trash2,
  Copy,
  Check,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Send,
  Inbox,
  Clock,
} from "lucide-react";
import type { ScriptOutputEntry } from "../hooks/useScripts";

export interface ConsolePanelProps {
  scriptOutputLog: ScriptOutputEntry[];
  onClearConsole?: () => void;
}

type FilterTone = "all" | "logs" | "errors" | "network";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function statusColor(status: number): string {
  if (status >= 500) return "var(--color-danger)";
  if (status >= 400) return "#f97316";
  if (status >= 300) return "#a78bfa";
  if (status >= 200) return "var(--color-success)";
  return "var(--color-text-muted)";
}

function tryFormatBody(body?: string): string {
  if (!body) return "";
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

interface CollapsibleSectionProps {
  label: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({ label, count, defaultOpen = false, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="console-detail-section">
      <button
        type="button"
        className="console-detail-toggle"
        onClick={() => setOpen(!open)}
      >
        {open ? <ArrowDown size={11} /> : <ArrowRight size={11} />}
        <span>{label}</span>
        {count !== undefined && <span className="console-detail-count">{count}</span>}
      </button>
      {open && <div className="console-detail-body">{children}</div>}
    </div>
  );
}

function RequestEntry({ entry }: { entry: Extract<ScriptOutputEntry, { type: "request" }> }) {
  const [expanded, setExpanded] = useState(true);
  const r = entry.request;
  const time = new Date(r.timestamp).toLocaleTimeString([], { hour12: false });
  const enabledHeaders = r.headers.filter(h => h.enabled);
  const enabledQueryParams = r.queryParams?.filter(q => q.enabled) || [];

  return (
    <div className="console-log-row network-entry request-entry">
      <div className="console-row-header" onClick={() => setExpanded(!expanded)} style={{ cursor: "pointer" }}>
        <span className="console-badge badge-network-req">
          <Send size={10} /> REQ
        </span>
        <span className="console-method-pill" style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8" }}>
          {r.method}
        </span>
        <span className="console-network-url">{r.url}</span>
        <span className="console-network-time">{time}</span>
        {expanded ? <ArrowDown size={11} className="console-expand-icon" /> : <ArrowRight size={11} className="console-expand-icon" />}
      </div>

      {expanded && (
        <div className="console-detail-panel">
          <CollapsibleSection label="Request Info" defaultOpen={true}>
            <div className="console-kv-row">
              <span className="console-kv-key">Method</span>
              <span className="console-kv-val">{r.method}</span>
            </div>
            <div className="console-kv-row">
              <span className="console-kv-key">URL</span>
              <span className="console-kv-val" style={{ wordBreak: "break-all", maxWidth: "60%" }}>{r.url}</span>
            </div>
            <div className="console-kv-row">
              <span className="console-kv-key">Timeout</span>
              <span className="console-kv-val">{r.timeoutMs}ms</span>
            </div>
            <div className="console-kv-row">
              <span className="console-kv-key">Follow Redirects</span>
              <span className="console-kv-val">{r.followRedirects ? "Yes" : "No"}</span>
            </div>
            <div className="console-kv-row">
              <span className="console-kv-key">Auth Mode</span>
              <span className="console-kv-val">{r.authMode}</span>
            </div>
          </CollapsibleSection>

          <CollapsibleSection label="Query Parameters" count={enabledQueryParams.length} defaultOpen={false}>
            <table className="console-headers-table">
              <tbody>
                {enabledQueryParams.map((q, i) => (
                  <tr key={i}>
                    <td className="console-header-key">{q.key}</td>
                    <td className="console-header-value">{q.value}</td>
                  </tr>
                ))}
                {enabledQueryParams.length === 0 && (
                  <tr><td colSpan={2} style={{ color: "var(--color-text-muted)", fontStyle: "italic" }}>No query parameters</td></tr>
                )}
              </tbody>
            </table>
          </CollapsibleSection>

          <CollapsibleSection label="Request Headers" count={enabledHeaders.length} defaultOpen={true}>
            <table className="console-headers-table">
              <tbody>
                {enabledHeaders.map((h, i) => (
                  <tr key={i}>
                    <td className="console-header-key">{h.key}</td>
                    <td className="console-header-value">{h.value}</td>
                  </tr>
                ))}
                {enabledHeaders.length === 0 && (
                  <tr><td colSpan={2} style={{ color: "var(--color-text-muted)", fontStyle: "italic" }}>No headers</td></tr>
                )}
              </tbody>
            </table>
          </CollapsibleSection>

          {r.body && (
            <CollapsibleSection label="Request Body" defaultOpen={true}>
              <pre className="console-body-pre">{tryFormatBody(r.body)}</pre>
            </CollapsibleSection>
          )}
        </div>
      )}
    </div>
  );
}

function ResponseEntry({ entry }: { entry: Extract<ScriptOutputEntry, { type: "response" }> }) {
  const [expanded, setExpanded] = useState(true);
  const r = entry.response;
  const isError = r.status >= 400;

  return (
    <div className={`console-log-row network-entry response-entry ${isError ? "tone-error" : ""}`}>
      <div className="console-row-header" onClick={() => setExpanded(!expanded)} style={{ cursor: "pointer" }}>
        <span className={`console-badge ${isError ? "badge-error" : "badge-success"}`}>
          <Inbox size={10} /> RES
        </span>
        <span
          className="console-status-pill"
          style={{ color: statusColor(r.status), background: `${statusColor(r.status)}18` }}
        >
          {r.status} {r.statusText}
        </span>
        <span className="console-timing-chips">
          <Clock size={10} />
          <span title="Total duration">{r.durationMs}ms</span>
          {r.dnsMs > 0 && <span className="console-timing-chip" title="DNS">DNS {r.dnsMs}ms</span>}
          {r.connectMs > 0 && <span className="console-timing-chip" title="Connect">TCP {r.connectMs}ms</span>}
          {r.tlsMs > 0 && <span className="console-timing-chip" title="TLS handshake">TLS {r.tlsMs}ms</span>}
          <span className="console-timing-chip" title="Size">{formatBytes(r.sizeBytes)}</span>
        </span>
        {expanded ? <ArrowDown size={11} className="console-expand-icon" /> : <ArrowRight size={11} className="console-expand-icon" />}
      </div>

      {expanded && (
        <div className="console-detail-panel">
          {/* Response Info */}
          <CollapsibleSection label="Response Info" defaultOpen={true}>
            <div className="console-kv-row">
              <span className="console-kv-key">Status</span>
              <span className="console-kv-val">{r.status} {r.statusText}</span>
            </div>
            {r.contentType && (
              <div className="console-kv-row">
                <span className="console-kv-key">Content-Type</span>
                <span className="console-kv-val">{r.contentType}</span>
              </div>
            )}
            <div className="console-kv-row">
              <span className="console-kv-key">Size</span>
              <span className="console-kv-val">{formatBytes(r.sizeBytes)}</span>
            </div>
          </CollapsibleSection>

          {/* Timing breakdown */}
          <CollapsibleSection label="Timing" defaultOpen={false}>
            <div className="console-timing-grid">
              <div className="console-kv-row"><span className="console-kv-key">Total</span><span className="console-kv-val">{r.durationMs} ms</span></div>
              {r.dnsMs > 0 && <div className="console-kv-row"><span className="console-kv-key">DNS Lookup</span><span className="console-kv-val">{r.dnsMs} ms</span></div>}
              {r.connectMs > 0 && <div className="console-kv-row"><span className="console-kv-key">TCP Connect</span><span className="console-kv-val">{r.connectMs} ms</span></div>}
              {r.tlsMs > 0 && <div className="console-kv-row"><span className="console-kv-key">TLS Handshake</span><span className="console-kv-val">{r.tlsMs} ms</span></div>}
              {r.requestMs > 0 && <div className="console-kv-row"><span className="console-kv-key">Request Transfer</span><span className="console-kv-val">{r.requestMs} ms</span></div>}
            </div>
          </CollapsibleSection>

          {/* Response headers */}
          <CollapsibleSection label="Response Headers" count={r.headers.length} defaultOpen={true}>
            <table className="console-headers-table">
              <tbody>
                {r.headers.map((h, i) => (
                  <tr key={i}>
                    <td className="console-header-key">{h.key}</td>
                    <td className="console-header-value">{h.value}</td>
                  </tr>
                ))}
                {r.headers.length === 0 && (
                  <tr><td colSpan={2} style={{ color: "var(--color-text-muted)", fontStyle: "italic" }}>No headers</td></tr>
                )}
              </tbody>
            </table>
          </CollapsibleSection>

          {/* Response body */}
          {r.body !== undefined && (
            <CollapsibleSection label="Response Body" defaultOpen={true}>
              {r.body ? (
                <pre className="console-body-pre">{tryFormatBody(r.body)}</pre>
              ) : (
                <span style={{ color: "var(--color-text-muted)", fontStyle: "italic", fontSize: "12px" }}>Empty body</span>
              )}
            </CollapsibleSection>
          )}
        </div>
      )}
    </div>
  );
}

export const ConsolePanel = React.memo(function ConsolePanel({ scriptOutputLog, onClearConsole }: ConsolePanelProps) {
  const [filterTone, setFilterTone] = useState<FilterTone>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const counts = useMemo(() => {
    let logsCount = 0, errorsCount = 0, networkCount = 0;
    scriptOutputLog.forEach((entry) => {
      if (entry.type === "request" || entry.type === "response") {
        networkCount++;
        if (entry.type === "response" && entry.response.status >= 400) errorsCount++;
      } else {
        logsCount++;
        if (entry.tone === "error") errorsCount++;
      }
    });
    return { all: scriptOutputLog.length, logs: logsCount, errors: errorsCount, network: networkCount };
  }, [scriptOutputLog]);

  const filteredLogs = useMemo(() => {
    return scriptOutputLog.filter((entry) => {
      const isNetwork = entry.type === "request" || entry.type === "response";
      const isTest = entry.type === "test_pass" || entry.type === "test_fail";
      const isError = entry.type === "test_fail" || entry.tone === "error" || (entry.type === "response" && entry.response.status >= 400);

      if (filterTone === "network" && !isNetwork) return false;
      if (filterTone === "logs" && (isNetwork || isTest)) return false;
      if (filterTone === "errors" && !isError) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const msg = entry.message?.toLowerCase().includes(q);
        const name = "name" in entry && entry.name?.toLowerCase().includes(q);

        let matchesNetwork = false;
        if (entry.type === "request") {
          const r = entry.request;
          const url = r.url.toLowerCase().includes(q);
          const method = r.method.toLowerCase().includes(q);
          const authMode = r.authMode.toLowerCase().includes(q);
          const headers = r.headers.some(h => h.enabled && (h.key.toLowerCase().includes(q) || h.value.toLowerCase().includes(q)));
          const queryParams = Boolean(r.queryParams?.some(qp => qp.enabled && (qp.key.toLowerCase().includes(q) || qp.value.toLowerCase().includes(q))));
          const body = Boolean(r.body?.toLowerCase().includes(q));
          matchesNetwork = url || method || authMode || headers || queryParams || body;
        } else if (entry.type === "response") {
          const r = entry.response;
          const status = String(r.status).includes(q);
          const statusText = Boolean(r.statusText?.toLowerCase().includes(q));
          const contentType = Boolean(r.contentType?.toLowerCase().includes(q));
          const headers = r.headers.some(h => h.key.toLowerCase().includes(q) || h.value.toLowerCase().includes(q));
          const body = Boolean(r.body?.toLowerCase().includes(q));
          matchesNetwork = status || statusText || contentType || headers || body;
        }

        return msg || name || matchesNetwork;
      }
      return true;
    });
  }, [scriptOutputLog, filterTone, searchQuery]);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [scriptOutputLog.length, autoScroll]);

  const handleCopyLogs = () => {
    if (scriptOutputLog.length === 0) return;
    const text = scriptOutputLog.map((entry) => {
      if (entry.type === "request") return `[REQ] ${entry.request.method} ${entry.request.url}`;
      if (entry.type === "response") return `[RES] ${entry.response.status} ${entry.response.statusText} (${entry.response.durationMs}ms)`;
      return `[${entry.tone.toUpperCase()}] ${entry.message}`;
    }).join("\n");
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="console-panel" role="region" aria-label="Console logs viewer">
      {/* Toolbar */}
      <div className="console-toolbar">
        <div className="console-filter-group">
          {(["all", "network", "logs", "errors"] as FilterTone[]).map((f) => (
            <button
              key={f}
              type="button"
              className={`console-filter-btn ${filterTone === f ? "active" : ""} ${f === "errors" && counts.errors > 0 ? "has-errors" : ""}`}
              onClick={() => setFilterTone(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <span className="console-count">{counts[f]}</span>
            </button>
          ))}
        </div>

        <div className="console-search-box">
          <Search size={12} className="console-search-icon" />
          <input
            type="text"
            className="console-search-input"
            placeholder="Filter logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            spellCheck={false}
          />
          {searchQuery && (
            <button type="button" className="console-search-clear" onClick={() => setSearchQuery("")} title="Clear search">
              ×
            </button>
          )}
        </div>

        <div className="console-actions">
          <button
            type="button"
            className={`console-action-btn ${autoScroll ? "active" : ""}`}
            onClick={() => setAutoScroll(!autoScroll)}
            title={autoScroll ? "Auto-scroll enabled" : "Auto-scroll disabled"}
          >
            <ArrowDown size={12} />
            <span className="action-label">Scroll</span>
          </button>
          <button
            type="button"
            className="console-action-btn"
            onClick={handleCopyLogs}
            disabled={scriptOutputLog.length === 0}
            title="Copy console logs"
          >
            {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
            <span className="action-label">{copied ? "Copied" : "Copy"}</span>
          </button>
          {onClearConsole && (
            <button
              type="button"
              className="console-action-btn danger"
              onClick={onClearConsole}
              disabled={scriptOutputLog.length === 0}
              title="Clear console"
            >
              <Trash2 size={12} />
              <span className="action-label">Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Log list */}
      <div className="console-body" ref={logContainerRef}>
        {filteredLogs.length === 0 ? (
          <div className="console-empty-state">
            <Terminal size={32} className="console-empty-icon" />
            <span className="console-empty-title">
              {scriptOutputLog.length === 0
                ? "Send a request to see verbose logs here"
                : "No log entries match your filter"}
            </span>
            <span className="console-empty-desc">
              Request details, response headers &amp; body, timing, test assertions, and script output will appear here.
            </span>
          </div>
        ) : (
          filteredLogs.map((entry, index) => {
            if (entry.type === "request") {
              return <RequestEntry key={`req-${index}`} entry={entry} />;
            }
            if (entry.type === "response") {
              return <ResponseEntry key={`res-${index}`} entry={entry} />;
            }

            const isError = entry.tone === "error";
            return (
              <div
                key={`${entry.message}-${index}`}
                className={`console-log-row log-entry ${isError ? "tone-error" : "tone-info"}`}
              >
                <span className={`console-badge ${isError ? "badge-error" : "badge-info"}`}>
                  {isError ? <AlertTriangle size={11} /> : <Info size={11} />}
                  {isError ? "ERROR" : "INFO"}
                </span>
                <div className="console-log-message">{entry.message}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});
