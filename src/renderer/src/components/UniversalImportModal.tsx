import React, { useState, useEffect } from "react";
import { Upload, X, FileText, Check, AlertCircle, Shield, AlertTriangle } from "lucide-react";
import {
  parseUniversalImport,
  detectImportFormat,
  type NormalizedImportResult,
  type ImportFormatType,
} from "../services/import-parser";
import {
  parsePostmanCollection,
  parsePostmanEnvironment,
  type PostmanCollectionImportResult,
  type PostmanEnvironmentImportResult,
} from "../services/postman-import";
import { parseCurlCommand, type CurlImportResult } from "../services/script-tools";

interface UniversalImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** For non-Postman formats — raw JSON payload path */
  onImportSuccess: (jsonPayload: string) => Promise<void>;
  /** For Postman collections — uses the dedicated handler with scripts/scoped vars */
  onImportCollection?: (result: PostmanCollectionImportResult, options: { stripScripts: boolean }) => void;
  /** For Postman environments — uses the dedicated handler */
  onImportEnvironment?: (result: PostmanEnvironmentImportResult) => void;
  /** For cURL commands — imports directly into active workspace */
  onImportCurl?: (result: CurlImportResult) => void;
  initialContent?: string;
}

type PostmanPreview =
  | { kind: "collection"; data: PostmanCollectionImportResult; scriptCount: number }
  | { kind: "environment"; data: PostmanEnvironmentImportResult };

function countScripts(data: PostmanCollectionImportResult): number {
  let n = 0;
  if (data.collectionPreScript) n++;
  if (data.collectionPostScript) n++;
  for (const f of data.folders) { if (f.preScript) n++; if (f.postScript) n++; }
  for (const r of data.requests) { if (r.preScript) n++; if (r.postScript) n++; }
  return n;
}

const FORMAT_LABELS: Record<ImportFormatType, string> = {
  "kobeanrest-native": "KobeanREST Native Export",
  "postman-collection": "Postman Collection v2.0/v2.1",
  "postman-environment": "Postman Environment",
  "hapi-routes": "Hapi.js Routes Spec",
  "openapi": "OpenAPI / Swagger Spec",
  "insomnia": "Insomnia Export",
  "hoppscotch": "Hoppscotch Export",
  "har": "HAR Network Archive",
  "curl": "cURL Command",
  "unknown": "Unknown Format",
};

export const UniversalImportModal: React.FC<UniversalImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  onImportCollection,
  onImportCurl,
  onImportEnvironment,
  initialContent = "",
}) => {
  const [inputMode, setInputMode] = useState<"file" | "paste">("file");
  const [textContent, setTextContent] = useState<string>(initialContent);
  const [fileName, setFileName] = useState<string>("");
  const [detectedFormat, setDetectedFormat] = useState<ImportFormatType | null>(null);
  const [parsedResult, setParsedResult] = useState<NormalizedImportResult | null>(null);
  const [postmanPreview, setPostmanPreview] = useState<PostmanPreview | null>(null);
  const [stripScripts, setStripScripts] = useState(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  useEffect(() => {
    if (initialContent) {
      setTextContent(initialContent);
      setInputMode("paste");
      tryParse(initialContent);
    }
  }, [initialContent]);

  if (!isOpen) return null;

  function resetState() {
    setTextContent("");
    setFileName("");
    setDetectedFormat(null);
    setParsedResult(null);
    setPostmanPreview(null);
    setStripScripts(false);
    setErrorMsg("");
  }

  function handleClose() {
    resetState();
    onClose();
  }

  function tryParse(content: string) {
    setErrorMsg("");
    setPostmanPreview(null);
    setParsedResult(null);
    setDetectedFormat(null);

    if (!content.trim()) return;

    try {
      const format = detectImportFormat(content);
      setDetectedFormat(format);

      if (format === "postman-collection" && onImportCollection) {
        const data = parsePostmanCollection(content);
        setPostmanPreview({ kind: "collection", data, scriptCount: countScripts(data) });
      } else if (format === "postman-environment" && onImportEnvironment) {
        const data = parsePostmanEnvironment(content);
        setPostmanPreview({ kind: "environment", data });
      } else if (format === "unknown") {
        setErrorMsg("Unrecognized format. Supports Postman, OpenAPI/Swagger, Insomnia, HAR, cURL, Hoppscotch, Hapi.js, and KobeanREST native exports.");
      } else {
        const res = parseUniversalImport(content);
        setParsedResult(res);
      }
    } catch (err: any) {
      setErrorMsg(`Failed to parse: ${err.message || String(err)}`);
    }
  }

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setTextContent(e.target.value);
    tryParse(e.target.value);
  }

  function handleFileSelected(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setTextContent(text);
      tryParse(text);
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files?.[0]) {
      setInputMode("file");
      handleFileSelected(e.dataTransfer.files[0]);
    }
  }

  async function handleImportSubmit() {
    setIsImporting(true);
    try {
      if (postmanPreview) {
        if (postmanPreview.kind === "collection" && onImportCollection) {
          onImportCollection(postmanPreview.data, { stripScripts });
        } else if (postmanPreview.kind === "environment" && onImportEnvironment) {
          onImportEnvironment(postmanPreview.data);
        }
        handleClose();
      } else if (parsedResult && parsedResult.format === "curl" && onImportCurl) {
        const curlResult = parseCurlCommand(textContent);
        onImportCurl(curlResult);
        handleClose();
      } else if (parsedResult && parsedResult.format !== "unknown") {
        await onImportSuccess(JSON.stringify(parsedResult.exportData));
        handleClose();
      }
    } catch (err: any) {
      setErrorMsg(`Import error: ${err.message || String(err)}`);
    } finally {
      setIsImporting(false);
    }
  }

  const hasScripts = postmanPreview?.kind === "collection" && postmanPreview.scriptCount > 0;
  const canImport = !isImporting && (
    (postmanPreview != null) ||
    (parsedResult != null && parsedResult.format !== "unknown")
  );

  return (
    <div
      className="modal-overlay universal-import-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Import API Specification"
      onClick={handleClose}
    >
      <div className="modal universal-import-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="universal-import-modal-header">
          <div>
            <span className="curl-import-modal-kicker">Import</span>
            <h2><Upload size={16} /> Import API Specification</h2>
            <div className="universal-import-modal-subtitle">
              Postman, OpenAPI/Swagger, Insomnia, HAR, cURL, Hoppscotch, Hapi.js &amp; KobeanREST
            </div>
          </div>
          <button type="button" className="curl-import-modal-close" aria-label="Close import modal" onClick={handleClose}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="curl-import-modal-body">
          {/* Mode tabs */}
          <div className="universal-import-tabs">
            <button
              type="button"
              onClick={() => setInputMode("file")}
              className={`universal-import-tab ${inputMode === "file" ? "active" : ""}`}
            >
              Upload File / Drag &amp; Drop
            </button>
            <button
              type="button"
              onClick={() => setInputMode("paste")}
              className={`universal-import-tab ${inputMode === "paste" ? "active" : ""}`}
            >
              Paste Text / cURL / Code
            </button>
          </div>

          {/* File dropzone */}
          {inputMode === "file" && (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              className={`universal-import-dropzone ${isDragOver ? "drag-over" : ""}`}
            >
              <FileText size={32} className="universal-import-dropzone-icon" />
              <div className="universal-import-dropzone-title">
                {fileName ? `Selected: ${fileName}` : "Drag and drop your API spec file here"}
              </div>
              <div className="universal-import-dropzone-hint">
                Supports .json, .yaml, .yml, .js, .ts, .curl, .har
              </div>
              <label className="universal-import-browse-btn">
                Browse Files
                <input
                  type="file"
                  style={{ display: "none" }}
                  accept=".json,.yaml,.yml,.js,.ts,.curl,.har,.txt"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFileSelected(e.target.files[0]);
                  }}
                />
              </label>
            </div>
          )}

          {/* Paste area */}
          {inputMode === "paste" && (
            <div>
              <label className="curl-import-label" htmlFor="universal-import-textarea">
                Paste JSON, OpenAPI, Hapi.js routes, or cURL command below
              </label>
              <textarea
                id="universal-import-textarea"
                className="curl-import-textarea"
                value={textContent}
                onChange={handleTextChange}
                placeholder="Paste Postman collection JSON, OpenAPI YAML, cURL command..."
                spellCheck={false}
                autoFocus
              />
            </div>
          )}

          {/* Error */}
          {errorMsg && (
            <div className="curl-import-error">
              <AlertCircle size={14} style={{ verticalAlign: "middle", marginRight: "6px" }} />
              {errorMsg}
            </div>
          )}

          {/* Postman Collection preview */}
          {postmanPreview?.kind === "collection" && (
            <div className="universal-import-preview-box">
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <Check size={16} style={{ color: "var(--color-success)" }} />
                <span style={{ fontWeight: 500 }}>
                  {FORMAT_LABELS["postman-collection"]} — {postmanPreview.data.collectionName}
                </span>
              </div>
              <div className="universal-import-stats-grid">
                <div className="universal-import-stat-card">
                  <span className="universal-import-stat-num">{postmanPreview.data.folders.length}</span>
                  <span className="universal-import-stat-label">Folders</span>
                </div>
                <div className="universal-import-stat-card">
                  <span className="universal-import-stat-num">{postmanPreview.data.requests.length}</span>
                  <span className="universal-import-stat-label">Requests</span>
                </div>
                <div className="universal-import-stat-card">
                  <span className="universal-import-stat-num">{postmanPreview.data.collectionVariables.length}</span>
                  <span className="universal-import-stat-label">Variables</span>
                </div>
                <div className="universal-import-stat-card">
                  <span className="universal-import-stat-num">{postmanPreview.scriptCount}</span>
                  <span className="universal-import-stat-label">Scripts</span>
                </div>
              </div>

              {/* Security warning */}
              {hasScripts && (
                <div style={{
                  marginTop: "12px",
                  padding: "12px",
                  background: "rgba(239, 68, 68, 0.08)",
                  borderRadius: "6px",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                    <Shield size={16} style={{ color: "var(--color-danger)", flexShrink: 0, marginTop: "1px" }} />
                    <div>
                      <div style={{ fontWeight: 500, marginBottom: "4px", color: "var(--color-danger)" }}>
                        Security Warning
                      </div>
                      <div style={{ fontSize: "12px" }}>
                        This collection contains <strong>{postmanPreview.scriptCount}</strong> script(s).
                        Postman scripts can make arbitrary HTTP requests via <code>pm.sendRequest</code>.
                        Only import from trusted sources.
                      </div>
                    </div>
                  </div>
                  <label style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    marginTop: "10px", paddingTop: "10px",
                    borderTop: "1px solid rgba(239, 68, 68, 0.15)",
                    cursor: "pointer", fontSize: "12px",
                  }}>
                    <input
                      type="checkbox"
                      checked={stripScripts}
                      onChange={(e) => setStripScripts(e.target.checked)}
                      style={{ width: "16px", height: "16px" }}
                    />
                    <span><strong>Strip all scripts during import</strong> (recommended for untrusted files)</span>
                  </label>
                </div>
              )}

              {hasScripts && !stripScripts && (
                <div style={{
                  marginTop: "10px", padding: "8px",
                  background: "rgba(251, 191, 36, 0.1)",
                  borderRadius: "4px", fontSize: "11px",
                  color: "var(--color-warning)",
                  display: "flex", gap: "6px", alignItems: "flex-start",
                }}>
                  <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: "1px" }} />
                  <div>
                    Scripts will run with native <code>pm.*</code> API support, including <code>pm.sendRequest</code>.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Postman Environment preview */}
          {postmanPreview?.kind === "environment" && (
            <div className="universal-import-preview-box">
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <Check size={16} style={{ color: "var(--color-success)" }} />
                <span style={{ fontWeight: 500 }}>
                  {FORMAT_LABELS["postman-environment"]} — {postmanPreview.data.name}
                </span>
              </div>
              <div className="universal-import-stats-grid">
                <div className="universal-import-stat-card">
                  <span className="universal-import-stat-num">{postmanPreview.data.variables.length}</span>
                  <span className="universal-import-stat-label">Variables</span>
                </div>
                <div className="universal-import-stat-card">
                  <span className="universal-import-stat-num">{postmanPreview.data.variables.filter(v => v.secret).length}</span>
                  <span className="universal-import-stat-label">Secrets</span>
                </div>
              </div>
              {postmanPreview.data.variables.length > 0 && (
                <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--color-border)" }}>
                  <div style={{ color: "var(--color-text-muted)", fontSize: "11px", marginBottom: "6px" }}>Variables</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {postmanPreview.data.variables.slice(0, 10).map((v, i) => (
                      <span key={i} style={{
                        padding: "2px 8px",
                        background: "var(--color-bg-tertiary)",
                        borderRadius: "4px", fontSize: "11px",
                      }}>
                        {v.key}{v.secret && " 🔒"}
                      </span>
                    ))}
                    {postmanPreview.data.variables.length > 10 && (
                      <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                        +{postmanPreview.data.variables.length - 10} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Non-Postman parsed result */}
          {parsedResult && parsedResult.format !== "unknown" && (
            <div className="universal-import-preview-box">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="universal-import-format-badge">
                  <Check size={13} /> Detected: {FORMAT_LABELS[parsedResult.format]}
                </span>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text)" }}>
                  {parsedResult.title}
                </span>
              </div>
              <div className="universal-import-stats-grid" style={{ marginTop: "12px" }}>
                <div className="universal-import-stat-card">
                  <span className="universal-import-stat-num">{parsedResult.stats.collectionsCount}</span>
                  <span className="universal-import-stat-label">Collections</span>
                </div>
                <div className="universal-import-stat-card">
                  <span className="universal-import-stat-num">{parsedResult.stats.foldersCount}</span>
                  <span className="universal-import-stat-label">Folders</span>
                </div>
                <div className="universal-import-stat-card">
                  <span className="universal-import-stat-num">{parsedResult.stats.requestsCount}</span>
                  <span className="universal-import-stat-label">Requests</span>
                </div>
                <div className="universal-import-stat-card">
                  <span className="universal-import-stat-num">{parsedResult.stats.variablesCount}</span>
                  <span className="universal-import-stat-label">Variables</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="curl-import-modal-footer">
          <button type="button" className="ghost-button" onClick={handleClose}>Cancel</button>
          <button
            type="button"
            className="primary-button"
            disabled={!canImport}
            onClick={handleImportSubmit}
          >
            {isImporting
              ? "Importing…"
              : postmanPreview?.kind === "collection"
                ? `Import Collection${stripScripts ? " (No Scripts)" : ""}`
                : postmanPreview?.kind === "environment"
                  ? "Import Environment"
                  : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
};
