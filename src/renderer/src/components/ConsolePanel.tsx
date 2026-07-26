import { useState, useMemo, useRef, useEffect } from "react";
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
} from "lucide-react";
import type { ScriptOutputEntry } from "../hooks/useScripts";

export interface ConsolePanelProps {
  scriptOutputLog: ScriptOutputEntry[];
  onClearConsole?: () => void;
}

type FilterTone = "all" | "logs" | "tests" | "errors";

export function ConsolePanel({ scriptOutputLog, onClearConsole }: ConsolePanelProps) {
  const [filterTone, setFilterTone] = useState<FilterTone>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const counts = useMemo(() => {
    let logsCount = 0;
    let testsCount = 0;
    let errorsCount = 0;

    scriptOutputLog.forEach((entry) => {
      if (entry.tone === "error" || entry.type === "test_fail") {
        errorsCount++;
      }
      if (entry.type === "test_pass" || entry.type === "test_fail") {
        testsCount++;
      } else {
        logsCount++;
      }
    });

    return {
      all: scriptOutputLog.length,
      logs: logsCount,
      tests: testsCount,
      errors: errorsCount,
    };
  }, [scriptOutputLog]);

  const filteredLogs = useMemo(() => {
    return scriptOutputLog.filter((entry) => {
      // Category filter
      if (filterTone === "logs" && (entry.type === "test_pass" || entry.type === "test_fail")) {
        return false;
      }
      if (filterTone === "tests" && entry.type !== "test_pass" && entry.type !== "test_fail") {
        return false;
      }
      if (filterTone === "errors" && entry.tone !== "error" && entry.type !== "test_fail") {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const msgMatch = entry.message?.toLowerCase().includes(q);
        const nameMatch = entry.name?.toLowerCase().includes(q);
        const errMatch = entry.errMessage?.toLowerCase().includes(q);
        return msgMatch || nameMatch || errMatch;
      }

      return true;
    });
  }, [scriptOutputLog, filterTone, searchQuery]);

  // Auto-scroll to bottom on log updates if enabled
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [scriptOutputLog.length, autoScroll]);

  const handleCopyLogs = () => {
    if (scriptOutputLog.length === 0) return;
    const text = scriptOutputLog
      .map((entry) => {
        if (entry.type === "test_pass") return `[PASSED] ${entry.name}`;
        if (entry.type === "test_fail") return `[FAILED] ${entry.name}${entry.errMessage ? ` - ${entry.errMessage}` : ""}`;
        return `[${entry.tone.toUpperCase()}] ${entry.message}`;
      })
      .join("\n");

    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="console-panel" role="region" aria-label="Console logs viewer">
      {/* Console Toolbar */}
      <div className="console-toolbar">
        <div className="console-filter-group">
          <button
            type="button"
            className={`console-filter-btn ${filterTone === "all" ? "active" : ""}`}
            onClick={() => setFilterTone("all")}
          >
            All <span className="console-count">{counts.all}</span>
          </button>
          <button
            type="button"
            className={`console-filter-btn ${filterTone === "logs" ? "active" : ""}`}
            onClick={() => setFilterTone("logs")}
          >
            Logs <span className="console-count">{counts.logs}</span>
          </button>
          <button
            type="button"
            className={`console-filter-btn ${filterTone === "tests" ? "active" : ""}`}
            onClick={() => setFilterTone("tests")}
          >
            Tests <span className="console-count">{counts.tests}</span>
          </button>
          <button
            type="button"
            className={`console-filter-btn ${filterTone === "errors" ? "active" : ""} ${counts.errors > 0 ? "has-errors" : ""}`}
            onClick={() => setFilterTone("errors")}
          >
            Errors <span className="console-count">{counts.errors}</span>
          </button>
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
            <button
              type="button"
              className="console-search-clear"
              onClick={() => setSearchQuery("")}
              title="Clear search"
            >
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
            title="Copy console logs to clipboard"
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
              title="Clear console output"
            >
              <Trash2 size={12} />
              <span className="action-label">Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Console Log List */}
      <div className="console-body" ref={logContainerRef}>
        {filteredLogs.length === 0 ? (
          <div className="console-empty-state">
            <Terminal size={32} className="console-empty-icon" />
            <span className="console-empty-title">
              {scriptOutputLog.length === 0
                ? "Console output will appear here after prettify or sending requests"
                : "No log entries match your filter"}
            </span>
            <span className="console-empty-desc">
              Pre-request scripts, post-request scripts, console.log() output, and test assertions will be displayed live.
            </span>
          </div>
        ) : (
          filteredLogs.map((entry, index) => {
            if (entry.type === "test_pass" || entry.type === "test_fail") {
              const passed = entry.type === "test_pass";
              return (
                <div
                  key={`${entry.name}-${index}`}
                  className={`console-log-row test-entry ${passed ? "passed" : "failed"}`}
                >
                  <div className="console-row-header">
                    <span className={`console-badge ${passed ? "badge-success" : "badge-error"}`}>
                      {passed ? (
                        <>
                          <CheckCircle2 size={11} /> PASSED
                        </>
                      ) : (
                        <>
                          <XCircle size={11} /> FAILED
                        </>
                      )}
                    </span>
                    <span className="console-test-name">{entry.name}</span>
                  </div>
                  {!passed && entry.errMessage && (
                    <div className="console-error-box">
                      <AlertTriangle size={12} className="error-box-icon" />
                      <span>{entry.errMessage}</span>
                    </div>
                  )}
                </div>
              );
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
}
