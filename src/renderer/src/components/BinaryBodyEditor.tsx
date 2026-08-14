import React, { useState, useRef, useCallback } from "react";
import {
  UploadCloud,
  File,
  Trash2,
  Copy,
  Check,
  RotateCcw,
  Binary,
  Code2,
  PackageCheck
} from "lucide-react";
import type { EnvironmentVariable } from "../types";
import { BodyEditor } from "./BodyEditor";

export interface BinaryFileInfo {
  fileName: string;
  fileSize: number;
  fileType: string;
  base64: string;
}

export function parseBinaryBody(value: string): BinaryFileInfo | null {
  if (!value || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && typeof parsed.base64 === "string") {
      return {
        fileName: parsed.fileName || "unnamed.bin",
        fileSize: typeof parsed.fileSize === "number" ? parsed.fileSize : Math.round((parsed.base64.length * 3) / 4),
        fileType: parsed.fileType || "application/octet-stream",
        base64: parsed.base64,
      };
    }
  } catch {
    // Check if it's a data URL
    if (value.startsWith("data:")) {
      const match = value.match(/^data:([^;]+);base64,(.*)$/);
      if (match) {
        const base64 = match[2];
        return {
          fileName: "binary_payload.bin",
          fileSize: Math.round((base64.length * 3) / 4),
          fileType: match[1] || "application/octet-stream",
          base64: base64,
        };
      }
    }
  }
  return null;
}

function formatBytes(bytes: number, decimals = 2): string {
  if (!+bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function generateHexDump(base64Str: string, maxBytes = 256): string {
  try {
    const binStr = atob(base64Str.slice(0, Math.ceil((maxBytes * 4) / 3) + 8));
    const bytesToProcess = Math.min(binStr.length, maxBytes);
    const lines: string[] = [];

    for (let i = 0; i < bytesToProcess; i += 16) {
      const offset = i.toString(16).padStart(8, "0");
      const chunkBytes: number[] = [];
      for (let j = 0; j < 16 && i + j < bytesToProcess; j++) {
        chunkBytes.push(binStr.charCodeAt(i + j));
      }

      const hexParts: string[] = [];
      for (let j = 0; j < 16; j++) {
        if (j < chunkBytes.length) {
          hexParts.push(chunkBytes[j].toString(16).padStart(2, "0"));
        } else {
          hexParts.push("  ");
        }
      }
      const hexGroup1 = hexParts.slice(0, 8).join(" ");
      const hexGroup2 = hexParts.slice(8, 16).join(" ");
      const hexStr = `${hexGroup1}  ${hexGroup2}`;

      const asciiStr = chunkBytes
        .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : "."))
        .join("");

      lines.push(`${offset}  ${hexStr}  |${asciiStr}|`);
    }

    if (binStr.length > maxBytes) {
      lines.push(`... (${binStr.length - maxBytes} additional bytes truncated from preview)`);
    }

    return lines.join("\n");
  } catch (err) {
    return "// Unable to decode binary preview";
  }
}

interface BinaryBodyEditorProps {
  value: string;
  onChange: (value: string) => void;
  variables: EnvironmentVariable[];
}

export function BinaryBodyEditor({ value, onChange, variables }: BinaryBodyEditorProps) {
  const fileInfo = parseBinaryBody(value);
  const [mode, setMode] = useState<"file" | "raw">(fileInfo || !value.trim() ? "file" : "raw");
  const [isDragOver, setIsDragOver] = useState(false);
  const [showHexDump, setShowHexDump] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64Index = result.indexOf(";base64,");
        const base64 = base64Index !== -1 ? result.substring(base64Index + 8) : btoa(result);
        const payload: BinaryFileInfo = {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || "application/octet-stream",
          base64: base64,
        };
        onChange(JSON.stringify(payload, null, 2));
        setMode("file");
      };
      reader.readAsDataURL(file);
    },
    [onChange]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileChange(file);
    }
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileChange(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleClearFile = () => {
    onChange("");
  };

  const handleCopyBase64 = () => {
    if (fileInfo?.base64) {
      navigator.clipboard.writeText(fileInfo.base64);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%", minHeight: 0 }}>
      {/* Sub-header / Mode switch */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            type="button"
            className={`tab ${mode === "file" ? "active" : ""}`}
            onClick={() => setMode("file")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              padding: "4px 12px",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            <File size={13} /> Binary File
          </button>
          <button
            type="button"
            className={`tab ${mode === "raw" ? "active" : ""}`}
            onClick={() => setMode("raw")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              padding: "4px 12px",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            <Code2 size={13} /> Raw / Base64 Text
          </button>
        </div>

        {mode === "file" && fileInfo && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              className="ghost-button"
              onClick={() => setShowHexDump((prev) => !prev)}
              style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, padding: "3px 8px" }}
              title="Toggle Hex Dump inspector"
            >
              <Binary size={13} />
              {showHexDump ? "Hide Hex Dump" : "Inspect Hex Dump"}
            </button>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        style={{ display: "none" }}
        onChange={handleInputChange}
      />

      {mode === "file" ? (
        fileInfo ? (
          /* File Loaded Card */
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              padding: "16px 18px",
              borderRadius: 10,
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 8,
                    background: "rgba(99, 102, 241, 0.12)",
                    color: "var(--color-accent)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <PackageCheck size={22} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)", wordBreak: "break-all" }}>
                    {fileInfo.fileName}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 7px",
                        borderRadius: 4,
                        background: "var(--color-surface-hover)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-text-muted)",
                        fontWeight: 600,
                      }}
                    >
                      {formatBytes(fileInfo.fileSize)} ({fileInfo.fileSize.toLocaleString()} bytes)
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 7px",
                        borderRadius: 4,
                        background: "rgba(16, 185, 129, 0.1)",
                        border: "1px solid rgba(16, 185, 129, 0.2)",
                        color: "#10b981",
                        fontWeight: 600,
                      }}
                    >
                      {fileInfo.fileType}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "5px 10px" }}
                  title="Replace with another file"
                >
                  <RotateCcw size={13} /> Change File
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={handleCopyBase64}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "5px 10px" }}
                  title="Copy base64 string to clipboard"
                >
                  {copied ? <Check size={13} style={{ color: "#10b981" }} /> : <Copy size={13} />}
                  {copied ? "Copied" : "Copy Base64"}
                </button>
                <button
                  type="button"
                  className="icon-button headers-delete-button"
                  onClick={handleClearFile}
                  title="Remove file"
                  aria-label="Remove file"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Hex Dump / Byte Inspection */}
            {showHexDump && (
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  flex: 1,
                  minHeight: 180,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                  <Binary size={13} /> Binary Byte Stream (First 256 bytes):
                </div>
                <pre
                  style={{
                    margin: 0,
                    padding: "12px 14px",
                    borderRadius: 8,
                    background: "var(--color-surface-input, #0d1117)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: 12,
                    lineHeight: 1.45,
                    overflowX: "auto",
                    overflowY: "auto",
                    flex: 1,
                  }}
                >
                  {generateHexDump(fileInfo.base64, 256)}
                </pre>
              </div>
            )}
          </div>
        ) : (
          /* Empty Dropzone */
          <div
            className={`universal-import-dropzone ${isDragOver ? "drag-over" : ""}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            style={{
              flex: 1,
              minHeight: 220,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              border: `2px dashed ${isDragOver ? "var(--color-accent)" : "var(--color-border)"}`,
              borderRadius: 12,
              background: isDragOver ? "rgba(99, 102, 241, 0.08)" : "var(--color-surface)",
              cursor: "pointer",
              transition: "all 0.2s ease",
              padding: "32px 20px",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "rgba(99, 102, 241, 0.1)",
                color: "var(--color-accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 10,
              }}
            >
              <UploadCloud size={24} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)", marginBottom: 4 }}>
              Choose a Binary File or Drag & Drop
            </div>
            <div style={{ fontSize: 12, color: "var(--color-muted)", textAlign: "center", maxWidth: 440, lineHeight: 1.5, marginBottom: 12 }}>
              Upload any binary file (images, documents, archives, firmware, audio, etc.). It will be dispatched directly as raw binary octets with <code>application/octet-stream</code>.
            </div>
            <button
              type="button"
              className="ghost-button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 16px",
                borderRadius: 8,
                border: "1px solid var(--color-border)",
                background: "var(--color-surface-hover)",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <File size={14} /> Browse File...
            </button>
          </div>
        )
      ) : (
        /* Raw / Base64 Editor Mode */
        <div className="request-body-editor-shell" style={{ flex: 1, minHeight: 0 }}>
          <BodyEditor
            value={value}
            onChange={onChange}
            variables={variables}
            mimeType="application/octet-stream"
            placeholder="// Paste raw base64 or enter variable {{binaryData}}"
            height="100%"
          />
        </div>
      )}
    </div>
  );
}
