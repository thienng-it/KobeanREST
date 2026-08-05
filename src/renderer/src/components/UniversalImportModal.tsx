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
  onImportSuccess: (jsonPayload: string) => Promise<void>;
  onImportCollection?: (result: PostmanCollectionImportResult, options: { stripScripts: boolean }) => void;
  onImportEnvironment?: (result: PostmanEnvironmentImportResult) => void;
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

interface ParsedFileItem {
  id: string;
  fileName: string;
  content: string;
  format: ImportFormatType | "unknown";
  parsedResult: NormalizedImportResult | null;
  postmanPreview: PostmanPreview | null;
  errorMsg: string;
}

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
  const [parsedFiles, setParsedFiles] = useState<ParsedFileItem[]>([]);
  const [stripScripts, setStripScripts] = useState(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  useEffect(() => {
    if (initialContent) {
      setTextContent(initialContent);
      setInputMode("paste");
      setParsedFiles([parseContent(initialContent, "Pasted Text")]);
    }
  }, [initialContent]);

  if (!isOpen) return null;

  function resetState() {
    setTextContent("");
    setParsedFiles([]);
    setStripScripts(false);
  }

  function handleClose() {
    resetState();
    onClose();
  }

  function parseContent(content: string, fileName: string): ParsedFileItem {
    const res: ParsedFileItem = {
      id: crypto.randomUUID(),
      fileName,
      content,
      format: "unknown",
      parsedResult: null,
      postmanPreview: null,
      errorMsg: "",
    };

    if (!content.trim()) return res;

    try {
      const format = detectImportFormat(content);
      res.format = format;

      if (format === "postman-collection" && onImportCollection) {
        const data = parsePostmanCollection(content);
        res.postmanPreview = { kind: "collection", data, scriptCount: countScripts(data) };
      } else if (format === "postman-environment" && onImportEnvironment) {
        const data = parsePostmanEnvironment(content);
        res.postmanPreview = { kind: "environment", data };
      } else if (format === "unknown") {
        res.errorMsg = "Unrecognized format. Supports Postman, OpenAPI/Swagger, Insomnia, HAR, cURL, Hoppscotch, Hapi.js, and KobeanREST native exports.";
      } else {
        res.parsedResult = parseUniversalImport(content);
      }
    } catch (err: any) {
      res.errorMsg = `Failed to parse: ${err.message || String(err)}`;
    }
    return res;
  }

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setTextContent(e.target.value);
    if (e.target.value.trim()) {
      setParsedFiles([parseContent(e.target.value, "Pasted Text")]);
    } else {
      setParsedFiles([]);
    }
  }

  function handleFilesSelected(files: FileList | File[]) {
    const fileArray = Array.from(files);
    Promise.all(fileArray.map(file => {
      return new Promise<ParsedFileItem>((resolve) => {
        const reader = new FileReader();
        reader.onload = (evt) => {
          const text = evt.target?.result as string;
          resolve(parseContent(text, file.name));
        };
        reader.readAsText(file);
      });
    })).then(results => {
       setParsedFiles(results);
    });
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setInputMode("file");
      handleFilesSelected(e.dataTransfer.files);
    }
  }

  async function handleImportSubmit() {
    setIsImporting(true);
    try {
      for (const file of parsedFiles) {
        if (file.postmanPreview) {
          if (file.postmanPreview.kind === "collection" && onImportCollection) {
            onImportCollection(file.postmanPreview.data, { stripScripts });
          } else if (file.postmanPreview.kind === "environment" && onImportEnvironment) {
            onImportEnvironment(file.postmanPreview.data);
          }
        } else if (file.parsedResult && file.parsedResult.format === "curl" && onImportCurl) {
          const curlResult = parseCurlCommand(file.content);
          onImportCurl(curlResult);
        } else if (file.parsedResult && file.parsedResult.format !== "unknown") {
          await onImportSuccess(JSON.stringify(file.parsedResult.exportData));
        }
      }
      handleClose();
    } catch (err: any) {
      // If error occurs, we could show it, but for now just console log
      console.error("Import error", err);
    } finally {
      setIsImporting(false);
    }
  }

  const hasScripts = parsedFiles.some(f => f.postmanPreview?.kind === "collection" && f.postmanPreview.scriptCount > 0);
  const totalScriptCount = parsedFiles.reduce((acc, f) => {
    if (f.postmanPreview?.kind === "collection") return acc + f.postmanPreview.scriptCount;
    return acc;
  }, 0);

  const canImport = !isImporting && parsedFiles.some(f => 
    f.postmanPreview != null || (f.parsedResult != null && f.parsedResult.format !== "unknown")
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

        <div className="curl-import-modal-body">
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

          {inputMode === "file" && (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              className={`universal-import-dropzone ${isDragOver ? "drag-over" : ""}`}
            >
              <FileText size={32} className="universal-import-dropzone-icon" />
              <div className="universal-import-dropzone-title">
                {parsedFiles.length > 0 
                  ? `${parsedFiles.length} file(s) selected` 
                  : "Drag and drop your API spec files here"}
              </div>
              <div className="universal-import-dropzone-hint">
                Supports .json, .yaml, .yml, .js, .ts, .curl, .har
              </div>
              <label className="universal-import-browse-btn">
                Browse Files
                <input
                  type="file"
                  multiple
                  style={{ display: "none" }}
                  accept=".json,.yaml,.yml,.js,.ts,.curl,.har,.txt"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFilesSelected(e.target.files);
                    }
                  }}
                />
              </label>
            </div>
          )}

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

          <div style={{ maxHeight: "300px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
            {parsedFiles.map((file) => {
              if (file.errorMsg) {
                return (
                  <div key={file.id} className="curl-import-error" style={{ margin: 0 }}>
                    <AlertCircle size={14} style={{ verticalAlign: "middle", marginRight: "6px" }} />
                    <strong>{file.fileName}:</strong> {file.errorMsg}
                  </div>
                );
              }

              if (file.postmanPreview?.kind === "collection") {
                return (
                  <div key={file.id} className="universal-import-preview-box" style={{ margin: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                      <Check size={16} style={{ color: "var(--color-success)" }} />
                      <span style={{ fontWeight: 500 }}>
                        {FORMAT_LABELS["postman-collection"]} — {file.postmanPreview.data.collectionName}
                      </span>
                    </div>
                    <div className="universal-import-stats-grid">
                      <div className="universal-import-stat-card">
                        <span className="universal-import-stat-num">{file.postmanPreview.data.folders.length}</span>
                        <span className="universal-import-stat-label">Folders</span>
                      </div>
                      <div className="universal-import-stat-card">
                        <span className="universal-import-stat-num">{file.postmanPreview.data.requests.length}</span>
                        <span className="universal-import-stat-label">Requests</span>
                      </div>
                      <div className="universal-import-stat-card">
                        <span className="universal-import-stat-num">{file.postmanPreview.data.collectionVariables.length}</span>
                        <span className="universal-import-stat-label">Variables</span>
                      </div>
                      <div className="universal-import-stat-card">
                        <span className="universal-import-stat-num">{file.postmanPreview.scriptCount}</span>
                        <span className="universal-import-stat-label">Scripts</span>
                      </div>
                    </div>
                  </div>
                );
              }

              if (file.postmanPreview?.kind === "environment") {
                return (
                  <div key={file.id} className="universal-import-preview-box" style={{ margin: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                      <Check size={16} style={{ color: "var(--color-success)" }} />
                      <span style={{ fontWeight: 500 }}>
                        {FORMAT_LABELS["postman-environment"]} — {file.postmanPreview.data.name}
                      </span>
                    </div>
                    <div className="universal-import-stats-grid">
                      <div className="universal-import-stat-card">
                        <span className="universal-import-stat-num">{file.postmanPreview.data.variables.length}</span>
                        <span className="universal-import-stat-label">Variables</span>
                      </div>
                      <div className="universal-import-stat-card">
                        <span className="universal-import-stat-num">{file.postmanPreview.data.variables.filter(v => v.secret).length}</span>
                        <span className="universal-import-stat-label">Secrets</span>
                      </div>
                    </div>
                  </div>
                );
              }

              if (file.parsedResult && file.parsedResult.format !== "unknown") {
                return (
                  <div key={file.id} className="universal-import-preview-box" style={{ margin: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span className="universal-import-format-badge">
                        <Check size={13} /> Detected: {FORMAT_LABELS[file.parsedResult.format]}
                      </span>
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text)" }}>
                        {file.parsedResult.title}
                      </span>
                    </div>
                    <div className="universal-import-stats-grid" style={{ marginTop: "12px" }}>
                      <div className="universal-import-stat-card">
                        <span className="universal-import-stat-num">{file.parsedResult.stats.collectionsCount}</span>
                        <span className="universal-import-stat-label">Collections</span>
                      </div>
                      <div className="universal-import-stat-card">
                        <span className="universal-import-stat-num">{file.parsedResult.stats.foldersCount}</span>
                        <span className="universal-import-stat-label">Folders</span>
                      </div>
                      <div className="universal-import-stat-card">
                        <span className="universal-import-stat-num">{file.parsedResult.stats.requestsCount}</span>
                        <span className="universal-import-stat-label">Requests</span>
                      </div>
                      <div className="universal-import-stat-card">
                        <span className="universal-import-stat-num">{file.parsedResult.stats.variablesCount}</span>
                        <span className="universal-import-stat-label">Variables</span>
                      </div>
                    </div>
                  </div>
                );
              }

              return null;
            })}
          </div>

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
                    This import contains <strong>{totalScriptCount}</strong> script(s).
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
              : `Import ${parsedFiles.length} file${parsedFiles.length > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
};
