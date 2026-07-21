import { Clock3, Download, Eye } from "lucide-react";
import { ResponseViewer } from "./ResponseViewer";
import { formatBytes, type ResponseState } from "../response-utils";
import type { ExecuteHttpResponse } from "../types";

export type ResponseTab = "preview" | "headers" | "timeline" | "download" | "copy";
export type PreviewMode = "rendered" | "xml" | "html" | "json" | "raw";

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
  onTabChange,
  onPreviewModeChange,
  onDownload,
  onCopy,
  onOpenWindow,
  onResizerMouseDown,
}: ResponsePanelProps) {
  const modal = variant === "modal";

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
                value={currentResponse.bodyText ?? (currentResponse.bodyBase64 ? `[binary response base64]\n${currentResponse.bodyBase64}` : "// Empty response body")}
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
      </div>
    );
  };

  const shell = (
    <div className={modal ? "response-viewer response-viewer-window" : "response-viewer"}>
      <div className="panel-heading">
        <div>
          <span className="muted-label">Response</span>
          <h2 style={{ color: responseTitleColor }}>{responseTitle}</h2>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {!modal && (
            <button className="ghost-button" type="button" onClick={onOpenWindow} style={{ padding: "4px 8px", fontSize: "11px" }}>
              <Eye size={12} /> Open in Window
            </button>
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
          {currentResponse && responseState.kind !== "error" && responseTab === "preview" && (
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
          )}
          {currentResponse && responseState.kind !== "error" && (
            <div className="response-stats">
              <span>
                <Clock3 size={14} />
                {currentResponse.durationMs} ms
              </span>
              <span>{formatBytes(currentResponse.sizeBytes)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="response-tabs">
        {(["preview", "headers", "timeline"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={responseTab === tab ? "response-tab active" : "response-tab"}
            type="button"
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {responseState.kind === "success" && (
        <div className="response-banner success">Response received from the native HTTP engine.</div>
      )}
      {responseState.kind === "error" && (
        <div className="response-banner error">{responseState.message}</div>
      )}

      {renderResponseBody()}
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
