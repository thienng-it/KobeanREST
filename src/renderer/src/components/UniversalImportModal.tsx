import React, { useState, useEffect } from "react";
import { Upload, X, FileText, Check, AlertCircle, Terminal, ArrowRight } from "lucide-react";
import { parseUniversalImport, NormalizedImportResult, ImportFormatType } from "../services/import-parser";

interface UniversalImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (jsonPayload: string) => Promise<void>;
  initialContent?: string;
}

export const UniversalImportModal: React.FC<UniversalImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  initialContent = "",
}) => {
  const [inputMode, setInputMode] = useState<"file" | "paste">("file");
  const [textContent, setTextContent] = useState<string>(initialContent);
  const [fileName, setFileName] = useState<string>("");
  const [parsedResult, setParsedResult] = useState<NormalizedImportResult | null>(null);
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

  function tryParse(content: string) {
    setErrorMsg("");
    if (!content.trim()) {
      setParsedResult(null);
      return;
    }
    try {
      const res = parseUniversalImport(content);
      if (res.format === "unknown") {
        setErrorMsg("Unrecognized format. Please ensure content is a valid Postman Collection, Postman Environment, Hapi.js routes, OpenAPI spec, Insomnia export, HAR archive, or cURL command.");
      } else {
        setErrorMsg("");
      }
      setParsedResult(res);
    } catch (err: any) {
      setErrorMsg(`Failed to parse content: ${err.message || String(err)}`);
      setParsedResult(null);
    }
  }

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setTextContent(val);
    tryParse(val);
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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setInputMode("file");
      handleFileSelected(e.dataTransfer.files[0]);
    }
  }

  async function handleImportSubmit() {
    if (!parsedResult || parsedResult.format === "unknown") return;
    setIsImporting(true);
    try {
      const jsonString = JSON.stringify(parsedResult.exportData);
      await onImportSuccess(jsonString);
      onClose();
    } catch (err: any) {
      setErrorMsg(`Import error: ${err.message || String(err)}`);
    } finally {
      setIsImporting(false);
    }
  }

  const formatLabels: Record<ImportFormatType, string> = {
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

  return (
    <div
      className="modal-overlay universal-import-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Import API Specification"
      onClick={onClose}
    >
      <div className="modal universal-import-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="universal-import-modal-header">
          <div>
            <span className="curl-import-modal-kicker">Import Workspace & Spec</span>
            <h2>
              <Upload size={16} /> Import API Specification
            </h2>
            <div className="universal-import-modal-subtitle">
              Supports Postman, Hapi.js Routes, OpenAPI/Swagger, Insomnia, HAR, cURL & KobeanREST
            </div>
          </div>
          <button
            type="button"
            className="curl-import-modal-close"
            aria-label="Close import modal"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="curl-import-modal-body">
          {/* Mode Switcher Tabs */}
          <div className="universal-import-tabs">
            <button
              type="button"
              onClick={() => setInputMode("file")}
              className={`universal-import-tab ${inputMode === "file" ? "active" : ""}`}
            >
              Upload File / Drag & Drop
            </button>
            <button
              type="button"
              onClick={() => setInputMode("paste")}
              className={`universal-import-tab ${inputMode === "paste" ? "active" : ""}`}
            >
              Paste Text / cURL / Code
            </button>
          </div>

          {/* File Upload Dropzone */}
          {inputMode === "file" && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              className={`universal-import-dropzone ${isDragOver ? "drag-over" : ""}`}
            >
              <FileText size={32} className="universal-import-dropzone-icon" />
              <div className="universal-import-dropzone-title">
                {fileName ? `Selected: ${fileName}` : "Drag and drop your API spec file here"}
              </div>
              <div className="universal-import-dropzone-hint">
                Supports .json, .yaml, .js, .ts, .curl, .har
              </div>
              <label className="universal-import-browse-btn">
                Browse Files
                <input
                  type="file"
                  style={{ display: "none" }}
                  accept=".json,.yaml,.yml,.js,.ts,.curl,.har,.txt"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelected(e.target.files[0]);
                    }
                  }}
                />
              </label>
            </div>
          )}

          {/* Raw Text / Code Paste Area */}
          {inputMode === "paste" && (
            <div>
              <label className="curl-import-label" htmlFor="universal-import-textarea">
                Paste JSON, Hapi.js route definitions, OpenAPI, or cURL command below
              </label>
              <textarea
                id="universal-import-textarea"
                className="curl-import-textarea"
                value={textContent}
                onChange={handleTextChange}
                placeholder="Paste Postman collection JSON, Hapi.js routes [ { method: 'GET', path: '/users' } ], OpenAPI YAML, or cURL command..."
                spellCheck={false}
                autoFocus
              />
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="curl-import-error">
              <AlertCircle size={14} style={{ verticalAlign: "middle", marginRight: "6px" }} />
              {errorMsg}
            </div>
          )}

          {/* Parsed Result Preview */}
          {parsedResult && parsedResult.format !== "unknown" && (
            <div className="universal-import-preview-box">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="universal-import-format-badge">
                  <Check size={13} /> Detected: {formatLabels[parsedResult.format]}
                </span>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text)" }}>
                  {parsedResult.title}
                </span>
              </div>

              {/* Stats Grid */}
              <div className="universal-import-stats-grid">
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
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={!parsedResult || parsedResult.format === "unknown" || isImporting}
            onClick={handleImportSubmit}
          >
            {isImporting ? "Importing..." : "Import API Specification"}
          </button>
        </div>
      </div>
    </div>
  );
};
