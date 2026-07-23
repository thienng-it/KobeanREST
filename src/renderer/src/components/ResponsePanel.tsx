import { useState, useEffect } from "react";
import { Clock3, Download, Eye, Search, HelpCircle } from "lucide-react";
import jq from "jq-web";
import { JqHelpModal } from "./JqHelpModal";
import { ResponseViewer } from "./ResponseViewer";
import { formatBytes, formatResponseBody, type ResponseState, type PreviewMode } from "../response-utils";
import type { ExecuteHttpResponse } from "../types";
import type { ScriptOutputEntry } from "../hooks/useScripts";

export type ResponseTab = "preview" | "headers" | "timeline" | "download" | "copy" | "tests";

interface ResponsePanelProps {
  variant: "dock" | "modal";
  responseState: ResponseState;
  currentResponse: ExecuteHttpResponse | undefined;
  responseTitle: string;
  responseTitleColor: string;
  isResponseTabPending: boolean;
  responseTab: ResponseTab;
  previewMode: PreviewMode;
  activeBottomDock: "response" | null;
  scriptOutputLog?: ScriptOutputEntry[];

  onTabChange: (tab: ResponseTab) => void;
  onPreviewModeChange: (mode: PreviewMode) => void;
  onDownload: () => void;
  onCopy: () => void;
  onOpenWindow: () => void;
  onResizerMouseDown: () => void;
}

export function ResponsePanel({
  variant,
  responseState,
  currentResponse,
  responseTitle,
  responseTitleColor,
  isResponseTabPending,
  responseTab,
  previewMode,
  activeBottomDock,
  scriptOutputLog = [],
  onTabChange,
  onPreviewModeChange,
  onDownload,
  onCopy,
  onOpenWindow,
  onResizerMouseDown,
}: ResponsePanelProps) {
  const modal = variant === "modal";

  const [jqFilter, setJqFilter] = useState("");
  const [jqResult, setJqResult] = useState("");
  const [jqError, setJqError] = useState("");
  const [isJqLoading, setIsJqLoading] = useState(false);
  const [isJqHelpOpen, setIsJqHelpOpen] = useState(false);

  useEffect(() => {
    if (previewMode !== "json" || !jqFilter.trim() || !currentResponse?.bodyText) {
      setJqResult("");
      setJqError("");
      return;
    }

    let isMounted = true;
    setIsJqLoading(true);
    setJqError("");

    const timeout = setTimeout(() => {
      if (!isMounted) return;
      jq.then((j: any) => {
        if (!isMounted) return;
        try {
          const obj = JSON.parse(currentResponse.bodyText!);
          const res = j.json(obj, jqFilter);
          setJqResult(JSON.stringify(res, null, 2));
        } catch (err: any) {
          if (isMounted) setJqError(err.message || String(err));
        } finally {
          if (isMounted) setIsJqLoading(false);
        }
      }).catch((err: any) => {
        if (isMounted) {
          setJqError(err.message || String(err));
          setIsJqLoading(false);
        }
      });
    }, 300); // debounce

    return () => { 
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [jqFilter, previewMode, currentResponse?.bodyText]);

  const renderResponseBody = () => {
    if (responseState.kind === "error") {
      return <pre className="response-body">{"// No response — see error above."}</pre>;
    }
    if (!currentResponse) {
      return <pre className="response-body">{"// Send a request to see a response."}</pre>;
    }

    return (
      <div
        className={isResponseTabPending ? "response-body-container transitioning" : "response-body-container"}
        aria-busy={isResponseTabPending}
      >
        {responseTab === "preview" && (
          <>
            {previewMode === "rendered" ? (
              <div
                className="response-body rendered"
                dangerouslySetInnerHTML={{ __html: currentResponse.bodyText || "" }}
              />
            ) : (
              <ResponseViewer
                value={
                  previewMode === "json" && jqFilter.trim()
                    ? (jqError ? `// jq error:\n${jqError}` : isJqLoading ? "// Filtering..." : jqResult)
                    : currentResponse.bodyText 
                      ? formatResponseBody(currentResponse.bodyText, previewMode) 
                      : (currentResponse.bodyBase64 ? `[binary response base64]\n${currentResponse.bodyBase64}` : "// Empty response body")
                }
                contentType={currentResponse.contentType ?? "text/plain"}
                height="100%"
              />
            )}
          </>
        )}
        {responseTab === "headers" && (
          <div className="response-body" style={{ display: "grid", gap: "8px", fontSize: "13px", color: "var(--color-text)" }}>
            {currentResponse.headers.map((h, i) => (
              <div key={i} style={{ display: "flex", gap: "12px", borderBottom: "1px solid var(--color-border)", paddingBottom: "6px", paddingTop: "4px" }}>
                <span style={{ fontWeight: 600, color: "var(--color-text-muted)", minWidth: "140px", flexShrink: 0 }}>{h.key}:</span>
                <span style={{ color: "var(--color-text)", wordBreak: "break-all" }}>{h.value}</span>
              </div>
            ))}
          </div>
        )}
        {responseTab === "timeline" && (
          <div className="response-body" style={{ fontSize: "13px", color: "var(--color-text)", display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", backgroundColor: "var(--color-surface-muted)", borderRadius: "6px", border: "1px solid var(--color-border)" }}>
              <span>Total Duration:</span>
              <span style={{ fontWeight: 600, color: "var(--color-accent)" }}>{currentResponse.durationMs} ms</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {[
                { label: "DNS Lookup", value: currentResponse.dnsMs },
                { label: "TCP Connection", value: currentResponse.connectMs },
                { label: "TLS Handshake", value: currentResponse.tlsMs },
                { label: "Request/Response", value: currentResponse.requestMs },
              ].map((item) => (
                <div key={item.label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                  <span style={{ color: "var(--color-text-muted)" }}>{item.label}</span>
                  <span style={{ fontWeight: 500 }}>{item.value} ms</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {responseTab === "tests" && (
          <div className="response-body" style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px", color: "var(--color-text)", padding: "12px" }}>
            {scriptOutputLog.length === 0 ? (
              <span style={{ color: "var(--color-text-muted)" }}>No script output or tests.</span>
            ) : (
              scriptOutputLog.map((log, i) => {
                if (log.type === "test_pass" || log.type === "test_fail") {
                  const passed = log.type === "test_pass";
                  return (
                    <div key={i} style={{ 
                      display: "flex", flexDirection: "column", gap: "4px",
                      backgroundColor: passed ? "color-mix(in srgb, var(--color-status-2xx) 5%, transparent)" : "color-mix(in srgb, var(--color-status-error) 5%, transparent)",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      borderLeft: passed ? "3px solid var(--color-status-2xx)" : "3px solid var(--color-status-error)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ 
                          fontWeight: 800, fontSize: "10px", padding: "2px 6px", borderRadius: "4px",
                          backgroundColor: passed ? "color-mix(in srgb, var(--color-status-2xx) 15%, transparent)" : "color-mix(in srgb, var(--color-status-error) 15%, transparent)",
                          color: passed ? "var(--color-status-2xx)" : "var(--color-status-error)",
                          border: `1px solid ${passed ? "color-mix(in srgb, var(--color-status-2xx) 40%, transparent)" : "color-mix(in srgb, var(--color-status-error) 40%, transparent)"}`
                        }}>{passed ? "PASSED" : "FAILED"}</span>
                        <span style={{ fontWeight: 600, color: "var(--color-text)" }}>{log.name}</span>
                      </div>
                      {!passed && log.errMessage && (
                        <div style={{ fontFamily: "monospace", color: "var(--color-danger)", marginTop: "4px", fontSize: "12px" }}>
                          {log.errMessage}
                        </div>
                      )}
                    </div>
                  );
                }
                return (
                  <div key={i} style={{ 
                    color: log.tone === "error" ? "var(--color-status-error)" : "var(--color-text)",
                    backgroundColor: log.tone === "error" ? "color-mix(in srgb, var(--color-status-error) 10%, transparent)" : "var(--color-surface-muted)",
                    padding: "8px",
                    borderRadius: "4px",
                    borderLeft: log.tone === "error" ? "3px solid var(--color-status-error)" : "3px solid var(--color-accent)",
                    fontFamily: "monospace",
                    whiteSpace: "pre-wrap"
                  }}>
                    {log.message}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  };

  const shell = (
    <div className={modal ? "response-viewer response-viewer-window" : "response-viewer"}>
      <div className="panel-heading">
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end", width: "100%" }}>
          {currentResponse && responseState.kind !== "error" && responseTab === "preview" && (
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginRight: "auto" }}>
              <select
                value={previewMode}
                onChange={(e) => onPreviewModeChange(e.target.value as PreviewMode)}
                style={{ fontSize: "12px", padding: "2px 6px", borderRadius: "4px", backgroundColor: "var(--color-surface-muted)", color: "var(--color-text)", border: "1px solid var(--color-border)", cursor: "pointer" }}
              >
                <option value="rendered">Rendered</option>
                <option value="json">JSON</option>
                <option value="xml">XML</option>
                <option value="html">HTML</option>
                <option value="raw">Raw</option>
              </select>
            </div>
          )}

          {currentResponse && responseState.kind !== "error" && (
            <div className="response-stats" style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <span style={{ color: responseTitleColor, fontWeight: 600 }}>{responseTitle}</span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <Clock3 size={14} />
                {currentResponse.durationMs} ms
              </span>
              <span>{formatBytes(currentResponse.sizeBytes)}</span>
            </div>
          )}

          {currentResponse && responseState.kind !== "error" && (
            <div style={{ display: "flex", gap: "8px" }}>
              <button className="ghost-button" type="button" onClick={onDownload} style={{ padding: "4px 8px", fontSize: "11px" }}>
                <Download size={12} /> Download
              </button>
              <button className="ghost-button" type="button" onClick={onCopy} style={{ padding: "4px 8px", fontSize: "11px" }}>
                <span style={{ fontSize: "10px" }}>📋</span> Copy
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="tab-row" role="tablist" aria-label="Response views">
        {(["preview", "headers", "timeline", "tests"] as const).map((tab) => {
          const hasErrors = tab === "tests" && scriptOutputLog.some(e => e.tone === "error");
          const totalTests = tab === "tests" ? scriptOutputLog.filter(e => e.type === "test_pass" || e.type === "test_fail").length : 0;
          const passedTests = tab === "tests" ? scriptOutputLog.filter(e => e.type === "test_pass").length : 0;
          
          return (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={responseTab === tab ? "tab active" : "tab"}
              type="button"
              role="tab"
            >
              {tab === "tests" && totalTests > 0 ? `Tests (${passedTests}/${totalTests})` : tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === "tests" && totalTests > 0 && (
                <span 
                  className="tab-script-indicator" 
                  style={{ 
                    display: "inline-block", 
                    marginLeft: "6px",
                    backgroundColor: passedTests === totalTests ? "var(--color-status-2xx)" : "var(--color-status-error)",
                    opacity: 1
                  }} 
                />
              )}
            </button>
          );
        })}
      </div>

      {responseState.kind === "error" && (
        <div className="response-banner error">{responseState.message}</div>
      )}

      {renderResponseBody()}
      
      {currentResponse && responseState.kind !== "error" && responseTab === "preview" && previewMode === "json" && (
        <div className="tab-row" role="tablist" aria-label="Response views">
          <Search size={14} style={{ color: "var(--color-text-muted)" }} />
          <input
            type="text"
            value={jqFilter}
            onChange={(e) => setJqFilter(e.target.value)}
            placeholder="jq filter (e.g. .data[0])"
            style={{
              flex: 1,
              fontSize: "12px",
              padding: "4px 8px",
              borderRadius: "4px",
              backgroundColor: "var(--color-input-bg)",
              color: "var(--color-text)",
              border: "1px solid var(--color-border)",
            }}
          />
          <button
            type="button"
            onClick={() => setIsJqHelpOpen(true)}
            className="ghost-button"
            style={{ padding: "4px 8px", fontSize: "12px", display: "flex", gap: "4px", alignItems: "center" }}
            title="jq Filter Help"
          >
            <HelpCircle size={14} /> Help
          </button>
        </div>
      )}

      <JqHelpModal 
        open={isJqHelpOpen} 
        onClose={() => setIsJqHelpOpen(false)} 
      />
    </div>
  );

  if (modal) {
    return <div className="response-window-shell" aria-label="Response window">{shell}</div>;
  }

  return (
    <section
      className={activeBottomDock === "response" ? "response-layout" : "response-layout hidden"}
      aria-label="Response"
    >
      <button className="response-panel-resizer" type="button" aria-label="Resize response panel" onMouseDown={onResizerMouseDown} />
      {shell}
    </section>
  );
}
