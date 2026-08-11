import React, { useState, useMemo, useEffect } from "react";
import { X, Key, ClipboardPaste, Trash2, Code, Braces, Lock } from "lucide-react";
import { CustomSelect } from "./CustomSelect";

interface ApiToolsModalProps {
  open: boolean;
  onClose: () => void;
  collections?: { id: string; name: string }[];
}

function b64DecodeUnicode(str: string) {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
  return decodeURIComponent(
    atob(padded)
      .split("")
      .map(function (c) {
        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join("")
  );
}

function JwtDecoder() {
  const [token, setToken] = useState("");

  const decoded = useMemo(() => {
    if (!token.trim()) return null;
    try {
      const parts = token.trim().split(".");
      if (parts.length !== 3) return { error: "Invalid JWT format (must have 3 parts separated by dots)." };
      
      const headerStr = b64DecodeUnicode(parts[0]);
      const payloadStr = b64DecodeUnicode(parts[1]);
      
      const header = JSON.parse(headerStr);
      const payload = JSON.parse(payloadStr);
      
      return {
        header: JSON.stringify(header, null, 2),
        payload: JSON.stringify(payload, null, 2),
        signature: parts[2]
      };
    } catch (e: any) {
      return { error: `Failed to decode: ${e.message}` };
    }
  }, [token]);

  return (
    <div style={{ display: "flex", gap: "24px", height: "100%", width: "100%" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", gap: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label style={{ fontWeight: "600", color: "var(--color-text)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px", margin: 0 }}>
            Encoded JWT
          </label>
          <div style={{ display: "flex", gap: "4px" }}>
            <button type="button" className="icon-button" onClick={async () => {
              try {
                const text = await navigator.clipboard.readText();
                setToken(text);
              } catch (e) {
                console.error("Failed to read clipboard", e);
              }
            }} title="Paste from Clipboard" aria-label="Paste Token">
              <ClipboardPaste size={14} />
            </button>
            <button type="button" className="icon-button" onClick={() => setToken("")} title="Clear Token" aria-label="Clear Token">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        <textarea
          className="api-tools-textarea"
          style={{ flex: 1, wordBreak: "break-all" }}
          placeholder="Paste your JWT here... (e.g. eyJhbGci...)"
          value={token}
          onChange={e => setToken(e.target.value)}
          autoFocus
        />
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "20px", overflowY: "auto", paddingRight: "8px" }}>
        <label style={{ fontWeight: "600", color: "var(--color-text)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Decoded
        </label>
        
        {decoded?.error ? (
          <div style={{ color: "#ef4444", padding: "16px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "8px", fontSize: "14px" }}>
            {decoded.error}
          </div>
        ) : decoded ? (
          <>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--color-text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Header <span style={{ textTransform: "none", opacity: 0.7, fontWeight: "normal" }}>(Algorithm & Token Type)</span>
              </div>
              <pre className="api-tools-pre" style={{ color: "#ec4899" }}>
                {decoded.header}
              </pre>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--color-text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Payload <span style={{ textTransform: "none", opacity: 0.7, fontWeight: "normal" }}>(Data)</span>
              </div>
              <pre className="api-tools-pre" style={{ color: "#8b5cf6" }}>
                {decoded.payload}
              </pre>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--color-text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Signature
              </div>
              <pre className="api-tools-pre" style={{ color: "#0ea5e9", wordBreak: "break-all", whiteSpace: "pre-wrap" }}>
                {decoded.signature}
              </pre>
            </div>
          </>
        ) : (
          <div style={{ color: "var(--color-text-muted)", fontStyle: "italic", padding: "32px 16px", textAlign: "center", border: "1px dashed var(--color-border-tint)", borderRadius: "8px", fontSize: "14px", background: "var(--color-surface-hover)" }}>
            Paste a token to see the decoded data
          </div>
        )}
      </div>
    </div>
  );
}

function EncoderDecoder() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"base64" | "url">("base64");
  const [action, setAction] = useState<"encode" | "decode">("encode");

  const result = useMemo(() => {
    if (!input) return "";
    try {
      if (mode === "base64") {
        return action === "encode" ? btoa(input) : atob(input);
      } else {
        return action === "encode" ? encodeURIComponent(input) : decodeURIComponent(input);
      }
    } catch (e: any) {
      return `Error: ${e.message}`;
    }
  }, [input, mode, action]);

  return (
    <div style={{ display: "flex", gap: "24px", height: "100%", width: "100%" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", gap: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label style={{ fontWeight: "600", color: "var(--color-text)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px", margin: 0 }}>
            Input String
          </label>
        </div>
        <textarea
          className="api-tools-textarea"
          style={{ flex: 1 }}
          placeholder="Enter text here..."
          value={input}
          onChange={e => setInput(e.target.value)}
          autoFocus
        />
        
        <div style={{ display: "flex", gap: "16px", marginTop: "8px" }}>
          <CustomSelect
            value={mode}
            onChange={(val) => setMode(val as any)}
            options={[
              { value: "base64", label: "Base64" },
              { value: "url", label: "URL Encoding" }
            ]}
          />

          <CustomSelect
            value={action}
            onChange={(val) => setAction(val as any)}
            options={[
              { value: "encode", label: "Encode" },
              { value: "decode", label: "Decode" }
            ]}
          />
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", gap: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label style={{ fontWeight: "600", color: "var(--color-text)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px", margin: 0 }}>
            Output
          </label>
          <button type="button" className="icon-button" onClick={() => navigator.clipboard.writeText(result)} title="Copy" aria-label="Copy">
            <ClipboardPaste size={14} />
          </button>
        </div>
        <textarea
          className="api-tools-textarea"
          style={{ flex: 1, color: result.startsWith("Error") ? "var(--color-status-error, #ef4444)" : "var(--color-text)" }}
          readOnly
          value={result}
        />
      </div>
    </div>
  );
}

function JsonFormatter() {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  const formatted = useMemo(() => {
    if (!input.trim()) {
      setError("");
      return "";
    }
    try {
      const parsed = JSON.parse(input);
      setError("");
      return JSON.stringify(parsed, null, 2);
    } catch (e: any) {
      setError(e.message);
      return input;
    }
  }, [input]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <label style={{ fontWeight: "600", color: "var(--color-text)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px", margin: 0 }}>
          JSON Formatter / Validator
        </label>
        <div style={{ display: "flex", gap: "4px" }}>
          <button type="button" className="icon-button" onClick={() => setInput(formatted)} title="Format" aria-label="Format JSON">
            <Code size={14} />
          </button>
        </div>
      </div>
      
      {error && (
        <div style={{ color: "#ef4444", padding: "8px 12px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "6px", fontSize: "12px" }}>
          Invalid JSON: {error}
        </div>
      )}

      <textarea
        className="api-tools-textarea"
        style={{ flex: 1, whiteSpace: "pre" }}
        placeholder='{"key": "value"}'
        value={input}
        onChange={e => setInput(e.target.value)}
        autoFocus
      />
    </div>
  );
}

function HashGenerator() {
  const [input, setInput] = useState("");
  const [hashes, setHashes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!input) {
      setHashes({});
      return;
    }

    const computeHashes = async () => {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(input);
        
        const algos = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];
        const results: Record<string, string> = {};
        
        for (const algo of algos) {
          const hashBuffer = await crypto.subtle.digest(algo, data);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
          results[algo] = hashHex;
        }
        
        setHashes(results);
      } catch (e) {
        console.error(e);
      }
    };

    computeHashes();
  }, [input]);

  return (
    <div style={{ display: "flex", gap: "24px", height: "100%", width: "100%" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", gap: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label style={{ fontWeight: "600", color: "var(--color-text)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px", margin: 0 }}>
            Input String
          </label>
        </div>
        <textarea
          className="api-tools-textarea"
          style={{ flex: 1 }}
          placeholder="Enter text to hash..."
          value={input}
          onChange={e => setInput(e.target.value)}
          autoFocus
        />
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "20px", overflowY: "auto" }}>
        <label style={{ fontWeight: "600", color: "var(--color-text)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Generated Hashes
        </label>
        
        {Object.entries(hashes).length === 0 ? (
          <div style={{ color: "var(--color-text-muted)", fontStyle: "italic", padding: "32px 16px", textAlign: "center", border: "1px dashed var(--color-border-tint)", borderRadius: "8px", fontSize: "14px", background: "var(--color-surface-hover)" }}>
            Enter text to generate hashes
          </div>
        ) : (
          Object.entries(hashes).map(([algo, hash]) => (
            <div key={algo} style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {algo}
                </span>
                <button type="button" className="icon-button" onClick={() => navigator.clipboard.writeText(hash)} title="Copy" aria-label="Copy" style={{ padding: "2px" }}>
                  <ClipboardPaste size={12} />
                </button>
              </div>
              <pre className="api-tools-pre" style={{ wordBreak: "break-all", whiteSpace: "pre-wrap" }}>
                {hash}
              </pre>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function LocalMockServerView() {
  const [running, setRunning] = useState(false);
  const [port, setPort] = useState(3010);
  const [requestCount, setRequestCount] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);

  const handleToggle = async () => {
    if (running) {
      const { stopLocalMockServer } = await import("../services/local-store");
      await stopLocalMockServer();
      setRunning(false);
      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Mock server stopped.`]);
    } else {
      const { startLocalMockServer } = await import("../services/local-store");
      const actualPort = await startLocalMockServer(port);
      setPort(actualPort);
      setRunning(true);
      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Mock server listening on http://127.0.0.1:${actualPort}`]);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "15px", color: "var(--color-text)" }}>Local Mock Server Engine</h3>
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--color-text-muted)" }}>
            Spin up a local HTTP mock server listening natively on your device.
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            border: "none",
            fontWeight: "600",
            fontSize: "13px",
            cursor: "pointer",
            backgroundColor: running ? "#ef4444" : "#10b981",
            color: "#ffffff"
          }}
        >
          {running ? "Stop Mock Server" : "Start Mock Server"}
        </button>
      </div>

      <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
        <label style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
          Port:
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
            disabled={running}
            style={{
              marginLeft: "8px",
              padding: "4px 8px",
              borderRadius: "4px",
              border: "1px solid var(--color-border)",
              backgroundColor: "var(--color-bg)",
              color: "var(--color-text)",
              width: "90px"
            }}
          />
        </label>
        <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
          Status: <strong style={{ color: running ? "#10b981" : "var(--color-text-muted)" }}>{running ? "ACTIVE" : "STOPPED"}</strong>
        </span>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
        <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--color-text)", textTransform: "uppercase" }}>
          Server Event Log
        </label>
        <pre className="api-tools-pre" style={{ flex: 1, overflowY: "auto", margin: 0 }}>
          {logs.length === 0 ? "// Mock server logs will appear here..." : logs.join("\n")}
        </pre>
      </div>
    </div>
  );
}

function OpenApiEngineView({ collections }: { collections: { id: string; name: string }[] }) {
  const [spec, setSpec] = useState("");
  const [selectedCollection, setSelectedCollection] = useState<string>(collections[0]?.id || "");

  useEffect(() => {
    if (!selectedCollection && collections.length > 0) {
      setSelectedCollection(collections[0].id);
    }
  }, [collections, selectedCollection]);

  const handleExport = async () => {
    const { exportOpenApiSpec } = await import("../services/local-store");
    const colName = collections.find(c => c.id === selectedCollection)?.name || "KobeanREST Workspace API";
    const result = await exportOpenApiSpec(selectedCollection || undefined, colName);
    setSpec(result.spec_json);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "15px", color: "var(--color-text)" }}>OpenAPI 3.0 Spec Engine</h3>
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--color-text-muted)" }}>
            Generate compliant OpenAPI 3.0.3 specification documents from your collections.
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div style={{ width: "200px" }}>
            <CustomSelect
              options={collections.map(c => ({ label: c.name, value: c.id }))}
              value={selectedCollection}
              onChange={setSelectedCollection}
              placeholder="Select collection..."
            />
          </div>
          <button
            type="button"
            onClick={handleExport}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "1px solid var(--color-border)",
              backgroundColor: "var(--color-surface-hover)",
              color: "var(--color-text)",
              fontWeight: "600",
              fontSize: "13px",
              cursor: "pointer",
              whiteSpace: "nowrap"
            }}
          >
            Generate OpenAPI 3.0 Spec
          </button>
        </div>
      </div>

      <textarea
        className="api-tools-textarea"
        style={{ flex: 1 }}
        readOnly
        placeholder="Click Generate to produce OpenAPI 3.0.3 JSON specification..."
        value={spec}
      />
    </div>
  );
}

function McpServerView() {
  const [manifest, setManifest] = useState("");

  const handleExportManifest = async () => {
    const { exportMcpManifest } = await import("../services/local-store");
    const result = await exportMcpManifest();
    setManifest(result.manifest_json);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "15px", color: "var(--color-text)" }}>AI Assistant MCP Server</h3>
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--color-text-muted)" }}>
            Expose KobeanREST requests & environments to LLMs / AI assistants via Model Context Protocol.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportManifest}
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            border: "1px solid var(--color-border)",
            backgroundColor: "var(--color-surface-hover)",
            color: "var(--color-text)",
            fontWeight: "600",
            fontSize: "13px",
            cursor: "pointer"
          }}
        >
          Get MCP Manifest
        </button>
      </div>

      <textarea
        className="api-tools-textarea"
        style={{ flex: 1 }}
        readOnly
        placeholder="Click Get MCP Manifest to view tool declarations..."
        value={manifest}
      />
    </div>
  );
}

export function ApiToolsModal({ open, onClose, collections = [] }: ApiToolsModalProps) {
  const [activeTab, setActiveTab] = useState<"jwt" | "encode" | "json" | "hash" | "mock" | "openapi" | "mcp">("openapi");

  if (!open) return null;

  const tabs = [
    { id: "jwt", label: "JWT Decoder", icon: <Key size={14} /> },
    { id: "encode", label: "Encode / Decode", icon: <Code size={14} /> },
    { id: "json", label: "JSON Formatter", icon: <Braces size={14} /> },
    { id: "hash", label: "Hash Generator", icon: <Lock size={14} /> },
    { id: "mock", label: "Mock Server", icon: <Code size={14} /> },
    { id: "openapi", label: "OpenAPI 3.0", icon: <Braces size={14} /> },
    { id: "mcp", label: "MCP Protocol", icon: <Key size={14} /> },
  ] as const;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="API Tools"
      onClick={onClose}
    >
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()} style={{ width: "1000px", maxWidth: "95vw", height: "85vh", display: "flex", flexDirection: "column" }}>
        <div className="settings-header" style={{ flexShrink: 0 }}>
          <div>
            <span className="settings-kicker">Developer Utilities</span>
            <h2>API Tools</h2>
            <p>Helpful utilities for debugging and building APIs.</p>
          </div>
          <button className="settings-close" type="button" aria-label="Close API Tools" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        
        <div className="settings-content" style={{ display: "flex", overflow: "hidden", flex: 1 }}>
          <div style={{ width: "200px", borderRight: "1px solid var(--color-border)", display: "flex", flexDirection: "column", padding: "16px 0" }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  all: "unset",
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "10px 20px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: activeTab === tab.id ? 600 : 500,
                  color: activeTab === tab.id ? "var(--color-text)" : "var(--color-text-muted)",
                  background: activeTab === tab.id ? "var(--color-surface-hover)" : "transparent",
                  borderLeft: `3px solid ${activeTab === tab.id ? "var(--color-text-active)" : "transparent"}`,
                  transition: "all 150ms",
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, padding: "24px", overflow: "hidden" }}>
            {activeTab === "jwt" && <JwtDecoder />}
            {activeTab === "encode" && <EncoderDecoder />}
            {activeTab === "json" && <JsonFormatter />}
            {activeTab === "hash" && <HashGenerator />}
            {activeTab === "mock" && <LocalMockServerView />}
            {activeTab === "openapi" && <OpenApiEngineView collections={collections || []} />}
            {activeTab === "mcp" && <McpServerView />}
          </div>
        </div>
      </div>
    </div>
  );
}
