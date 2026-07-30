import { useState, useRef } from "react";
import { FileText, X, Upload, AlertTriangle, Check, Shield } from "lucide-react";
import {
  parsePostmanCollection,
  parsePostmanEnvironment,
  isPostmanCollection,
  isPostmanEnvironment,
  type PostmanCollectionImportResult,
  type PostmanEnvironmentImportResult,
} from "../services/postman-import";

export interface PostmanImportModalProps {
  open: boolean;
  onClose: () => void;
  onImportCollection: (result: PostmanCollectionImportResult, options: { stripScripts: boolean }) => void;
  onImportEnvironment: (result: PostmanEnvironmentImportResult) => void;
  existingCollectionNames?: string[];
  existingEnvironmentNames?: string[];
}

type ImportMode = "collection" | "environment" | "auto";
type ImportResult = {
  kind: "collection";
  data: PostmanCollectionImportResult;
  scriptCount: number;
} | {
  kind: "environment";
  data: PostmanEnvironmentImportResult;
} | {
  kind: "error";
  error: string;
};

function countScripts(data: PostmanCollectionImportResult): number {
  let count = 0;
  if (data.collectionPreScript) count++;
  if (data.collectionPostScript) count++;
  for (const folder of data.folders) {
    if (folder.preScript) count++;
    if (folder.postScript) count++;
  }
  for (const req of data.requests) {
    if (req.preScript) count++;
    if (req.postScript) count++;
  }
  return count;
}

export function PostmanImportModal({
  open,
  onClose,
  onImportCollection,
  onImportEnvironment,
  existingCollectionNames = [],
  existingEnvironmentNames = [],
}: PostmanImportModalProps) {
  const [mode, setMode] = useState<ImportMode>("auto");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [stripScripts, setStripScripts] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  function resetState() {
    setMode("auto");
    setError(null);
    setPreview(null);
    setFileName("");
    setStripScripts(false);
  }

  function handleClose() {
    resetState();
    onClose();
  }

  function parseAndPreview(content: string, name: string) {
    setError(null);
    setFileName(name);
    setStripScripts(false);

    try {
      const isCollection = isPostmanCollection(content);
      const isEnv = isPostmanEnvironment(content);

      if (mode === "collection" || (mode === "auto" && isCollection)) {
        const result = parsePostmanCollection(content);
        setPreview({
          kind: "collection",
          data: result,
          scriptCount: countScripts(result),
        });
      } else if (mode === "environment" || (mode === "auto" && isEnv)) {
        const result = parsePostmanEnvironment(content);
        setPreview({ kind: "environment", data: result });
      } else {
        try {
          const result = parsePostmanCollection(content);
          setPreview({
            kind: "collection",
            data: result,
            scriptCount: countScripts(result),
          });
        } catch {
          try {
            const envResult = parsePostmanEnvironment(content);
            setPreview({ kind: "environment", data: envResult });
          } catch {
            setError("Could not parse as Postman Collection or Environment. Please check the file format.");
            setPreview(null);
          }
        }
      }
    } catch (err) {
      setError("Failed to parse file: " + (err instanceof Error ? err.message : String(err)));
      setPreview(null);
    }
  }

  function handleFileSelect(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      parseAndPreview(content, file.name);
    };
    reader.onerror = () => {
      setError("Failed to read file");
    };
    reader.readAsText(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }

  function handleImport() {
    if (!preview) return;

    if (preview.kind === "collection") {
      onImportCollection(preview.data, { stripScripts });
    } else if (preview.kind === "environment") {
      onImportEnvironment(preview.data);
    }

    handleClose();
  }

  const hasValidPreview = preview && preview.kind !== "error";
  const hasScripts = preview?.kind === "collection" && preview.scriptCount > 0;
  const isCollectionDuplicate = preview?.kind === "collection" && existingCollectionNames.includes(preview.data.collectionName);
  const isEnvDuplicate = preview?.kind === "environment" && existingEnvironmentNames.includes(preview.data.name);

  return (
    <div
      className="modal-overlay postman-import-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Import from Postman"
      onClick={handleClose}
    >
      <div
        className="modal postman-import-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "600px" }}
      >
        <div className="postman-import-modal-header">
          <div>
            <span className="postman-import-modal-kicker">Import</span>
            <h2><FileText size={16} /> Import from Postman</h2>
          </div>
          <button
            type="button"
            className="postman-import-modal-close"
            aria-label="Close Postman import"
            onClick={handleClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="postman-import-modal-body">
          {/* Mode selector */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", color: "var(--color-text-muted)" }}>
              Import type
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className={mode === "auto" ? "primary-button" : "ghost-button"}
                onClick={() => { setMode("auto"); setPreview(null); setError(null); }}
                style={{ padding: "8px 16px", fontSize: "13px" }}
              >
                Auto-detect
              </button>
              <button
                type="button"
                className={mode === "collection" ? "primary-button" : "ghost-button"}
                onClick={() => { setMode("collection"); setPreview(null); setError(null); }}
                style={{ padding: "8px 16px", fontSize: "13px" }}
              >
                Collection
              </button>
              <button
                type="button"
                className={mode === "environment" ? "primary-button" : "ghost-button"}
                onClick={() => { setMode("environment"); setPreview(null); setError(null); }}
                style={{ padding: "8px 16px", fontSize: "13px" }}
              >
                Environment
              </button>
            </div>
          </div>

          {/* File drop zone */}
          <div
            className={`postman-import-dropzone ${isDragging ? "dragging" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: "2px dashed var(--color-border)",
              borderRadius: "8px",
              padding: "32px 16px",
              textAlign: "center",
              cursor: "pointer",
              marginBottom: "16px",
            }}
          >
            <Upload size={32} style={{ margin: "0 auto 8px", color: "var(--color-text-muted)" }} />
            <p style={{ margin: 0, fontSize: "14px", color: "var(--color-text)" }}>
              Drag & drop a Postman JSON file here
            </p>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--color-text-muted)" }}>
              or click to browse
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleInputChange}
              style={{ display: "none" }}
            />
          </div>

          {/* File name display */}
          {fileName && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 12px",
              background: "var(--color-bg-secondary)",
              borderRadius: "6px",
              marginBottom: "12px",
              fontSize: "13px",
            }}>
              <FileText size={14} />
              <span style={{ flex: 1 }}>{fileName}</span>
              <button
                type="button"
                className="ghost-button"
                onClick={() => { setPreview(null); setFileName(""); setError(null); }}
                style={{ padding: "4px 8px", fontSize: "12px" }}
              >
                Change
              </button>
            </div>
          )}

          {/* Preview - Collection */}
          {preview && preview.kind === "collection" && (
            <div style={{
              padding: "12px",
              background: "var(--color-bg-secondary)",
              borderRadius: "8px",
              fontSize: "13px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <Check size={16} style={{ color: "var(--color-success)" }} />
                <span style={{ fontWeight: 500 }}>Collection: {preview.data.collectionName}</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "12px" }}>
                <div>
                  <div style={{ color: "var(--color-text-muted)", fontSize: "11px", marginBottom: "2px" }}>Folders</div>
                  <div>{preview.data.folders.length}</div>
                </div>
                <div>
                  <div style={{ color: "var(--color-text-muted)", fontSize: "11px", marginBottom: "2px" }}>Requests</div>
                  <div>{preview.data.requests.length}</div>
                </div>
                <div>
                  <div style={{ color: "var(--color-text-muted)", fontSize: "11px", marginBottom: "2px" }}>Variables</div>
                  <div>{preview.data.collectionVariables.length}</div>
                </div>
              </div>

              {/* Duplicate name warning */}
              {isCollectionDuplicate && (
                <div style={{
                  marginBottom: "12px",
                  padding: "8px 12px",
                  background: "rgba(251, 191, 36, 0.1)",
                  borderRadius: "6px",
                  border: "1px solid rgba(251, 191, 36, 0.25)",
                  fontSize: "12px",
                  color: "var(--color-warning)",
                  display: "flex",
                  gap: "6px",
                  alignItems: "center",
                }}>
                  <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                  A collection named <strong style={{ margin: "0 3px" }}>"{preview.data.collectionName}"</strong> already exists — it will be imported with a unique suffix.
                </div>
              )}

              {/* Script warning */}
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
                      <div style={{ fontSize: "12px", color: "var(--color-text)" }}>
                        This collection contains <strong>{preview.scriptCount}</strong> executable script(s).
                        Postman scripts can make arbitrary HTTP requests via <code>pm.sendRequest</code>.
                      </div>
                    </div>
                  </div>

                  <label style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginTop: "10px",
                    paddingTop: "10px",
                    borderTop: "1px solid rgba(239, 68, 68, 0.15)",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}>
                    <input
                      type="checkbox"
                      checked={stripScripts}
                      onChange={(e) => setStripScripts(e.target.checked)}
                      style={{ width: "16px", height: "16px" }}
                    />
                    <span>
                      <strong>Strip all scripts during import</strong> (recommended for untrusted files)
                    </span>
                  </label>
                </div>
              )}

              {/* Note about pm.* support */}
              {hasScripts && !stripScripts && (
                <div style={{
                  marginTop: "12px",
                  padding: "8px",
                  background: "rgba(251, 191, 36, 0.1)",
                  borderRadius: "4px",
                  fontSize: "11px",
                  color: "var(--color-warning)",
                  display: "flex",
                  gap: "6px",
                  alignItems: "flex-start",
                }}>
                  <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: "1px" }} />
                  <div>
                    Scripts will run with native <code>pm.*</code> API support, including <code>pm.sendRequest</code> which can make
                    HTTP calls to any destination. Only import from trusted sources.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Preview - Environment */}
          {preview && preview.kind === "environment" && (
            <div style={{
              padding: "12px",
              background: "var(--color-bg-secondary)",
              borderRadius: "8px",
              fontSize: "13px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <Check size={16} style={{ color: "var(--color-success)" }} />
                <span style={{ fontWeight: 500 }}>Environment: {preview.data.name}</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
                <div>
                  <div style={{ color: "var(--color-text-muted)", fontSize: "11px", marginBottom: "2px" }}>Variables</div>
                  <div style={{ fontWeight: 500 }}>{preview.data.variables.length}</div>
                </div>
                <div>
                  <div style={{ color: "var(--color-text-muted)", fontSize: "11px", marginBottom: "2px" }}>Secrets</div>
                  <div>{preview.data.variables.filter(v => v.secret).length}</div>
                </div>
              </div>

              {preview.data.variables.length > 0 && (
                <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--color-border)" }}>
                  <div style={{ color: "var(--color-text-muted)", fontSize: "11px", marginBottom: "6px" }}>Variables</div>
                  <div style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "6px",
                  }}>
                    {preview.data.variables.slice(0, 10).map((v, i) => (
                      <span key={i} style={{
                        padding: "2px 8px",
                        background: "var(--color-bg-tertiary)",
                        borderRadius: "4px",
                        fontSize: "11px",
                      }}>
                        {v.key}{v.secret && " 🔒"}
                      </span>
                    ))}
                    {preview.data.variables.length > 10 && (
                      <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                        +{preview.data.variables.length - 10} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              padding: "12px",
              background: "rgba(239, 68, 68, 0.1)",
              borderRadius: "8px",
              color: "var(--color-danger)",
              fontSize: "13px",
              display: "flex",
              gap: "8px",
              alignItems: "flex-start",
            }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: "1px" }} />
              <div>{error}</div>
            </div>
          )}
        </div>

        <div className="postman-import-modal-footer">
          <button
            type="button"
            className="ghost-button"
            onClick={handleClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={handleImport}
            disabled={!hasValidPreview}
          >
            {preview?.kind === "collection"
              ? `Import Collection${stripScripts ? " (No Scripts)" : ""}`
              : preview?.kind === "environment"
                ? "Import Environment"
                : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}
