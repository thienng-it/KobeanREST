import React, { useState, useMemo, useEffect, useRef } from "react";
import { X, Key, ClipboardPaste, Trash2, Code, Braces, Lock, Copy, Check, WandSparkles, FileCode2, Sparkles, Plus, Layers } from "lucide-react";
import type { MockRoute, MockRequestLog } from "../services/local-store";
import { CustomSelect } from "./CustomSelect";
import { parseProtoSchema, generateSampleMessageJson, SAMPLE_PROTO_DEFINITIONS } from "../services/proto-parser";
import { MOCK_SERVER_TEMPLATES, createRoutesFromTemplate, type MockServerTemplate } from "../services/mock-templates";

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

function StatPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      <span style={{ fontSize: "10px", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</span>
      <span style={{ fontSize: "13px", fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

function RouteEditor({ route, onSave, onCancel }: { route: MockRoute; onSave: (r: MockRoute) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<MockRoute>({ ...route });
  const update = (fields: Partial<MockRoute>) => setDraft(prev => ({ ...prev, ...fields }));
  const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "GRPC", "*"];
  const CONTENT_TYPES = ["application/json", "application/grpc-web+proto", "text/plain", "text/html", "text/xml", "application/xml"];
  const COMMON_STATUSES = [200, 201, 204, 301, 400, 401, 403, 404, 409, 422, 429, 500, 502, 503];

  const handlePrettifyJson = () => {
    try {
      const parsed = JSON.parse(draft.response_body);
      update({ response_body: JSON.stringify(parsed, null, 2) });
    } catch {
      // ignore
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <h3 style={{ margin: 0, fontSize: "15px", color: "var(--color-text)" }}>
          {draft.method === "GRPC" ? "Edit gRPC Mock Route" : "Edit Route"}
        </h3>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={onCancel} style={{ padding: "7px 16px", borderRadius: "6px", border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)", cursor: "pointer", fontSize: "13px" }}>Cancel</button>
          <button onClick={() => onSave(draft)} style={{ padding: "7px 16px", borderRadius: "6px", border: "none", background: "var(--color-accent)", color: "#fff", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}>Save Route</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "130px 1fr 110px", gap: "12px", flexShrink: 0 }}>
        {[
          { label: "Method / Protocol", el: (
            <select
              value={draft.method}
              onChange={e => {
                const nextMethod = e.target.value;
                const isGrpc = nextMethod === "GRPC";
                update({
                  method: nextMethod,
                  content_type: isGrpc ? "application/grpc-web+proto" : draft.content_type === "application/grpc-web+proto" ? "application/json" : draft.content_type,
                  path: isGrpc && !draft.path.includes(".") ? "/helloworld.Greeter/SayHello" : draft.path
                });
              }}
              style={{ width: "100%", padding: "7px 8px", borderRadius: "4px", border: "1px solid var(--color-border)", backgroundColor: "var(--color-background)", color: "var(--color-text)", fontSize: "13px", fontWeight: draft.method === "GRPC" ? 700 : 500 }}
            >
              {METHODS.map(m => <option key={m} value={m}>{m === "GRPC" ? "gRPC" : m}</option>)}
            </select>
          )},
          { label: draft.method === "GRPC" ? "RPC Path (/<Service>/<Method>)" : "Path", el: (
            <input
              type="text"
              value={draft.path}
              onChange={e => update({ path: e.target.value })}
              placeholder={draft.method === "GRPC" ? "/helloworld.Greeter/SayHello" : "/users/:id"}
              style={{ width: "100%", padding: "7px 10px", borderRadius: "4px", border: "1px solid var(--color-border)", backgroundColor: "var(--color-background)", color: "var(--color-text)", fontSize: "13px", fontFamily: "monospace", boxSizing: "border-box" }}
            />
          )},
          { label: draft.method === "GRPC" ? "Status (HTTP / gRPC)" : "Status", el: (
            <select
              value={draft.status_code}
              onChange={e => update({ status_code: Number(e.target.value) })}
              style={{ width: "100%", padding: "7px 8px", borderRadius: "4px", border: "1px solid var(--color-border)", backgroundColor: "var(--color-background)", color: "var(--color-text)", fontSize: "13px" }}
            >
              {COMMON_STATUSES.map(s => (
                <option key={s} value={s}>
                  {s} {s === 200 && draft.method === "GRPC" ? "(0 OK)" : s === 400 && draft.method === "GRPC" ? "(3 INVALID_ARG)" : s === 404 && draft.method === "GRPC" ? "(5 NOT_FOUND)" : s === 503 && draft.method === "GRPC" ? "(14 UNAVAIL)" : ""}
                </option>
              ))}
            </select>
          )},
        ].map(({ label, el }) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase" }}>{label}</label>
            {el}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 130px", gap: "12px", flexShrink: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase" }}>Content-Type</label>
          <select value={draft.content_type} onChange={e => update({ content_type: e.target.value })} style={{ padding: "7px 8px", borderRadius: "4px", border: "1px solid var(--color-border)", backgroundColor: "var(--color-background)", color: "var(--color-text)", fontSize: "13px" }}>
            {CONTENT_TYPES.map(ct => <option key={ct} value={ct}>{ct}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase" }}>Delay (ms)</label>
          <input type="number" value={draft.delay_ms} min={0} max={30000} onChange={e => update({ delay_ms: Number(e.target.value) })} style={{ padding: "7px 10px", borderRadius: "4px", border: "1px solid var(--color-border)", backgroundColor: "var(--color-background)", color: "var(--color-text)", fontSize: "13px" }} />
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase" }}>
            {draft.method === "GRPC" ? "gRPC Response JSON Payload" : "Response Body"}
          </label>
          <button
            type="button"
            onClick={handlePrettifyJson}
            className="ghost-button"
            style={{ fontSize: "11px", padding: "2px 8px", display: "flex", alignItems: "center", gap: "4px" }}
          >
            <Sparkles size={11} /> Format JSON
          </button>
        </div>
        <textarea className="api-tools-textarea" style={{ flex: 1 }} value={draft.response_body} onChange={e => update({ response_body: e.target.value })} placeholder='{"message": "Hello!"}' />
      </div>
    </div>
  );
}

function MockTemplatesDrawer({
  onLoadTemplate,
  onAppendTemplate,
  onClose,
}: {
  onLoadTemplate: (template: MockServerTemplate) => void;
  onAppendTemplate: (template: MockServerTemplate) => void;
  onClose: () => void;
}) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const categories = [
    { id: "all", label: "All Templates" },
    { id: "rest", label: "REST / HTTP" },
    { id: "grpc", label: "gRPC & Proto" },
    { id: "ai", label: "AI & LLM" },
    { id: "infra", label: "DevOps & Health" },
  ];

  const filtered = useMemo(() => {
    if (selectedCategory === "all") return MOCK_SERVER_TEMPLATES;
    return MOCK_SERVER_TEMPLATES.filter((t) => t.category === selectedCategory);
  }, [selectedCategory]);

  const categoryColor = (cat: string) => {
    switch (cat) {
      case "grpc":
        return { bg: "rgba(99, 102, 241, 0.15)", text: "#818cf8" };
      case "ai":
        return { bg: "rgba(168, 85, 247, 0.15)", text: "#c084fc" };
      case "infra":
        return { bg: "rgba(234, 179, 8, 0.15)", text: "#facc15" };
      default:
        return { bg: "rgba(16, 185, 129, 0.15)", text: "#34d399" };
    }
  };

  return (
    <div style={{ padding: "16px", backgroundColor: "var(--color-surface-muted)", border: "1px solid var(--color-border)", borderRadius: "10px", display: "flex", flexDirection: "column", gap: "12px", flexShrink: 0 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Layers size={16} color="var(--color-accent)" />
          <strong style={{ fontSize: "14px", color: "var(--color-text)" }}>Mock Server Starter Templates</strong>
          <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "10px", backgroundColor: "rgba(99, 102, 241, 0.15)", color: "#818cf8", fontWeight: 600 }}>
            {MOCK_SERVER_TEMPLATES.length} presets
          </span>
        </div>
        <button type="button" onClick={onClose} className="ghost-button" style={{ fontSize: "12px", padding: "4px 8px" }}>
          Close
        </button>
      </div>

      {/* Category Pills */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelectedCategory(c.id)}
            style={{
              padding: "4px 12px",
              borderRadius: "14px",
              border: "1px solid var(--color-border)",
              fontSize: "11px",
              fontWeight: selectedCategory === c.id ? 700 : 500,
              backgroundColor: selectedCategory === c.id ? "var(--color-accent)" : "transparent",
              color: selectedCategory === c.id ? "#fff" : "var(--color-text-muted)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Template Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "10px", maxHeight: "280px", overflowY: "auto", paddingRight: "4px" }}>
        {filtered.map((tpl) => {
          const colors = categoryColor(tpl.category);
          return (
            <div
              key={tpl.id}
              style={{
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid var(--color-border)",
                backgroundColor: "var(--color-surface)",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "16px" }}>{tpl.icon}</span>
                    <strong style={{ fontSize: "13px", color: "var(--color-text)" }}>{tpl.name}</strong>
                  </div>
                  <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", backgroundColor: colors.bg, color: colors.text, fontWeight: 700, textTransform: "uppercase" }}>
                    {tpl.category}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: "11px", color: "var(--color-text-muted)", lineHeight: 1.4 }}>
                  {tpl.description}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "8px" }}>
                  {tpl.routes.slice(0, 3).map((r, idx) => (
                    <span key={idx} style={{ fontSize: "10px", fontFamily: "monospace", padding: "1px 5px", borderRadius: "3px", backgroundColor: "var(--color-surface-hover)", color: "var(--color-text)" }}>
                      <strong style={{ color: r.method === "GRPC" ? "#818cf8" : "var(--color-accent)" }}>{r.method}</strong> {r.path}
                    </span>
                  ))}
                  {tpl.routes.length > 3 && (
                    <span style={{ fontSize: "10px", color: "var(--color-text-muted)", padding: "1px 4px" }}>
                      +{tpl.routes.length - 3} more
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", marginTop: "4px" }}>
                <button
                  type="button"
                  onClick={() => onAppendTemplate(tpl)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "5px",
                    border: "1px solid var(--color-border)",
                    backgroundColor: "transparent",
                    color: "var(--color-text)",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                  title="Add routes without overwriting existing ones"
                >
                  + Append
                </button>
                <button
                  type="button"
                  onClick={() => onLoadTemplate(tpl)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: "5px",
                    border: "none",
                    backgroundColor: "var(--color-accent)",
                    color: "#fff",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                  title="Replace all routes with this template"
                >
                  Load Template
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LocalMockServerView() {
  const [running, setRunning] = useState(false);
  const [port, setPort] = useState(3010);
  const [requestCount, setRequestCount] = useState(0);
  const [routes, setRoutes] = useState<MockRoute[]>([]);
  const [requestLog, setRequestLog] = useState<MockRequestLog[]>([]);
  const [activeView, setActiveView] = useState<"routes" | "log">("routes");
  const [protocolFilter, setProtocolFilter] = useState<"all" | "http" | "grpc">("all");
  const [editingRoute, setEditingRoute] = useState<MockRoute | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showProtoGenerator, setShowProtoGenerator] = useState<boolean>(false);
  const [showTemplatesDrawer, setShowTemplatesDrawer] = useState<boolean>(false);
  const [protoText, setProtoText] = useState<string>(SAMPLE_PROTO_DEFINITIONS[0].proto);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleLoadTemplate = async (template: MockServerTemplate) => {
    const newRoutes = createRoutesFromTemplate(template);
    await syncRoutes(newRoutes);
    setShowTemplatesDrawer(false);
  };

  const handleAppendTemplate = async (template: MockServerTemplate) => {
    const newRoutes = createRoutesFromTemplate(template);
    const existingKeys = new Set(routes.map(r => `${r.method}:${r.path}`));
    const merged = [
      ...routes,
      ...newRoutes.filter(r => !existingKeys.has(`${r.method}:${r.path}`))
    ];
    await syncRoutes(merged);
    setShowTemplatesDrawer(false);
  };

  const newRoute = (method: string = "GET"): MockRoute => {
    const isGrpc = method === "GRPC";
    return {
      id: `route-${Date.now()}`,
      method: isGrpc ? "GRPC" : method,
      path: isGrpc ? "/helloworld.Greeter/SayHello" : "/",
      status_code: 200,
      response_body: isGrpc
        ? JSON.stringify({ message: "Hello from mock gRPC Greeter!" }, null, 2)
        : JSON.stringify({ message: "Hello from KobeanREST mock server!" }, null, 2),
      content_type: isGrpc ? "application/grpc-web+proto" : "application/json",
      delay_ms: 0,
      enabled: true,
    };
  };

  useEffect(() => {
    import("../services/local-store").then(({ getMockRoutes, getMockServerStatus }) => {
      getMockRoutes().then(setRoutes);
      getMockServerStatus().then(s => { setRunning(s.running); setPort(s.port); setRequestCount(s.request_count); });
    });
  }, []);

  useEffect(() => {
    if (running) {
      pollRef.current = setInterval(async () => {
        const { getMockServerStatus, getMockRequestLog } = await import("../services/local-store");
        getMockServerStatus().then(s => setRequestCount(s.request_count));
        getMockRequestLog().then(log => setRequestLog([...log].reverse()));
      }, 1000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [running]);

  const syncRoutes = async (next: MockRoute[]) => {
    setRoutes(next);
    const { setMockRoutes } = await import("../services/local-store");
    await setMockRoutes(next);
  };

  const handleToggle = async () => {
    const { startLocalMockServer, stopLocalMockServer, setMockRoutes } = await import("../services/local-store");
    if (running) {
      await stopLocalMockServer();
      setRunning(false);
    } else {
      await setMockRoutes(routes);
      const actualPort = await startLocalMockServer(port);
      setPort(actualPort);
      setRunning(true);
      setRequestCount(0);
      setRequestLog([]);
    }
  };

  const copyUrl = (id: string, path: string) => {
    navigator.clipboard.writeText(`http://127.0.0.1:${port}${path}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const clearLog = async () => {
    const { clearMockRequestLog } = await import("../services/local-store");
    await clearMockRequestLog();
    setRequestLog([]);
  };

  // Generate Mock gRPC Endpoints from Protobuf schema
  const handleGenerateFromProto = async () => {
    try {
      const parsed = parseProtoSchema(protoText);
      const newGrpcRoutes: MockRoute[] = [];

      for (const service of parsed.services) {
        for (const method of service.methods) {
          const sampleResponse = generateSampleMessageJson(method.responseType, parsed);
          newGrpcRoutes.push({
            id: `grpc-mock-${service.name}-${method.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            method: "GRPC",
            path: `/${service.name}/${method.name}`,
            status_code: 200,
            response_body: sampleResponse,
            content_type: "application/grpc-web+proto",
            delay_ms: 0,
            enabled: true,
          });
        }
      }

      if (newGrpcRoutes.length > 0) {
        // Keep non-duplicate routes
        const existingPaths = new Set(routes.map(r => `${r.method}:${r.path}`));
        const merged = [
          ...routes,
          ...newGrpcRoutes.filter(r => !existingPaths.has(`${r.method}:${r.path}`))
        ];
        await syncRoutes(merged);
      }
      setShowProtoGenerator(false);
    } catch {
      // ignore
    }
  };

  const statusColor = (code: number) => code < 300 ? "#10b981" : code < 400 ? "#f59e0b" : "#ef4444";
  const methodColor = (m: string) => ({
    GET: "#10b981",
    POST: "#3b82f6",
    PUT: "#f59e0b",
    PATCH: "#8b5cf6",
    DELETE: "#ef4444",
    GRPC: "#6366f1"
  }[m.toUpperCase()] ?? "#6b7280");

  const displayedRoutes = useMemo(() => {
    if (protocolFilter === "http") return routes.filter(r => r.method.toUpperCase() !== "GRPC");
    if (protocolFilter === "grpc") return routes.filter(r => r.method.toUpperCase() === "GRPC");
    return routes;
  }, [routes, protocolFilter]);

  const httpCount = useMemo(() => routes.filter(r => r.method.toUpperCase() !== "GRPC").length, [routes]);
  const grpcCount = useMemo(() => routes.filter(r => r.method.toUpperCase() === "GRPC").length, [routes]);

  if (editingRoute) {
    return (
      <RouteEditor
        route={editingRoute}
        onSave={async (r) => {
          const exists = routes.some(x => x.id === r.id);
          await syncRoutes(exists ? routes.map(x => x.id === r.id ? r : x) : [...routes, r]);
          setEditingRoute(null);
        }}
        onCancel={() => setEditingRoute(null)}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "14px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexShrink: 0 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "15px", color: "var(--color-text)" }}>Local Mock Server (HTTP &amp; gRPC)</h3>
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--color-text-muted)" }}>
            Mock REST endpoints and gRPC RPC methods with custom payloads, status codes, and latency simulation.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {!running && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Port</span>
              <input type="number" value={port} onChange={e => setPort(Number(e.target.value))} style={{ width: "80px", padding: "5px 8px", borderRadius: "4px", border: "1px solid var(--color-border)", backgroundColor: "var(--color-background)", color: "var(--color-text)", fontSize: "12px" }} />
            </div>
          )}
          {running && (
            <button onClick={() => copyUrl("__base", "/")} style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid var(--color-border)", background: "var(--color-surface-hover)", color: "var(--color-text)", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontFamily: "monospace" }}>
              {copiedId === "__base" ? <Check size={12} /> : <Copy size={12} />}
              http://127.0.0.1:{port}
            </button>
          )}
          <button type="button" onClick={handleToggle} style={{ padding: "8px 16px", borderRadius: "6px", border: "none", fontWeight: 600, fontSize: "13px", cursor: "pointer", backgroundColor: running ? "#ef4444" : "#10b981", color: "#fff", display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.7)", display: "inline-block", animation: running ? "pulse-dot 1.5s ease-in-out infinite" : "none" }} />
            {running ? "Stop Server" : "Start Server"}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {running && (
        <div style={{ display: "flex", gap: "24px", padding: "10px 16px", borderRadius: "8px", backgroundColor: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.2)", flexShrink: 0 }}>
          <StatPill label="Status" value="RUNNING" color="#10b981" />
          <StatPill label="Port" value={String(port)} color="var(--color-text)" />
          <StatPill label="Total Requests" value={String(requestCount)} color="var(--color-accent)" />
          <StatPill label="Active Routes" value={`${routes.filter(r => r.enabled).length} / ${routes.length}`} color="var(--color-text-muted)" />
          <StatPill label="gRPC Mocks" value={String(grpcCount)} color="#818cf8" />
        </div>
      )}

      {/* Mock Templates Drawer */}
      {showTemplatesDrawer && (
        <MockTemplatesDrawer
          onLoadTemplate={handleLoadTemplate}
          onAppendTemplate={handleAppendTemplate}
          onClose={() => setShowTemplatesDrawer(false)}
        />
      )}

      {/* Proto Schema Generator Drawer / Section */}
      {showProtoGenerator && (
        <div style={{ padding: "14px", backgroundColor: "var(--color-surface-muted)", border: "1px solid var(--color-border)", borderRadius: "10px", display: "flex", flexDirection: "column", gap: "10px", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <WandSparkles size={16} color="var(--color-accent)" />
              <strong style={{ fontSize: "13px", color: "var(--color-text)" }}>Generate gRPC Mock Server from Protobuf Schema</strong>
            </div>
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <select
                onChange={(e) => {
                  const preset = SAMPLE_PROTO_DEFINITIONS.find(p => p.label === e.target.value);
                  if (preset) setProtoText(preset.proto);
                }}
                style={{ fontSize: "11px", padding: "4px 8px", borderRadius: "4px", backgroundColor: "var(--color-input-bg)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              >
                {SAMPLE_PROTO_DEFINITIONS.map(p => (
                  <option key={p.label} value={p.label}>{p.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowProtoGenerator(false)}
                className="ghost-button"
                style={{ fontSize: "12px", padding: "4px 8px" }}
              >
                Cancel
              </button>
            </div>
          </div>

          <textarea
            value={protoText}
            onChange={e => setProtoText(e.target.value)}
            placeholder="Paste .proto IDL syntax definition here..."
            style={{
              fontFamily: "monospace",
              fontSize: "11px",
              padding: "10px",
              borderRadius: "6px",
              border: "1px solid var(--color-border)",
              backgroundColor: "var(--color-input-bg)",
              color: "var(--color-text)",
              minHeight: "130px",
              resize: "vertical"
            }}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <button
              type="button"
              onClick={handleGenerateFromProto}
              style={{
                padding: "6px 16px",
                borderRadius: "6px",
                border: "none",
                background: "var(--color-accent)",
                color: "#fff",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <WandSparkles size={13} /> Generate Mock RPC Routes
            </button>
          </div>
        </div>
      )}

      {/* Tab bar and Protocol Filter */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--color-border)", flexShrink: 0, alignItems: "center" }}>
        {(["routes", "log"] as const).map(v => (
          <button key={v} onClick={() => setActiveView(v)} style={{ padding: "8px 16px", border: "none", borderBottom: `2px solid ${activeView === v ? "var(--color-accent)" : "transparent"}`, background: "none", color: activeView === v ? "var(--color-text)" : "var(--color-text-muted)", cursor: "pointer", fontSize: "13px", fontWeight: activeView === v ? 600 : 400 }}>
            {v === "log" ? `Request Log${requestLog.length > 0 ? ` (${requestLog.length})` : ""}` : "Routes"}
          </button>
        ))}

        {activeView === "routes" && (
          <div style={{ display: "flex", gap: "4px", marginLeft: "16px" }}>
            {(["all", "http", "grpc"] as const).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setProtocolFilter(f)}
                style={{
                  padding: "3px 10px",
                  borderRadius: "12px",
                  border: "1px solid var(--color-border)",
                  fontSize: "11px",
                  fontWeight: protocolFilter === f ? 700 : 500,
                  backgroundColor: protocolFilter === f ? "var(--color-surface-hover)" : "transparent",
                  color: protocolFilter === f ? "var(--color-text)" : "var(--color-text-muted)",
                  cursor: "pointer"
                }}
              >
                {f === "all" ? `All (${routes.length})` : f === "http" ? `HTTP (${httpCount})` : `gRPC (${grpcCount})`}
              </button>
            ))}
          </div>
        )}

        <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
          {activeView === "routes" && (
            <>
              <button
                onClick={() => setShowTemplatesDrawer(prev => !prev)}
                style={{
                  padding: "4px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--color-border)",
                  background: showTemplatesDrawer ? "var(--color-accent)" : "var(--color-surface-hover)",
                  color: showTemplatesDrawer ? "#fff" : "var(--color-text)",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "5px"
                }}
              >
                <Layers size={12} color={showTemplatesDrawer ? "#fff" : "var(--color-accent)"} /> Templates
              </button>
              <button
                onClick={() => setShowProtoGenerator(prev => !prev)}
                style={{
                  padding: "4px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--color-border)",
                  background: showProtoGenerator ? "#6366f1" : "var(--color-surface-hover)",
                  color: showProtoGenerator ? "#fff" : "var(--color-text)",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "5px"
                }}
              >
                <WandSparkles size={12} color={showProtoGenerator ? "#fff" : "#818cf8"} /> Generate from Proto
              </button>
              <button onClick={() => setEditingRoute(newRoute("GRPC"))} style={{ padding: "4px 12px", borderRadius: "6px", border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.12)", color: "#818cf8", cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>
                + Add gRPC
              </button>
              <button onClick={() => setEditingRoute(newRoute("GET"))} style={{ padding: "4px 12px", borderRadius: "6px", border: "none", background: "var(--color-accent)", color: "#fff", cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>
                + Add Route
              </button>
            </>
          )}
          {activeView === "log" && requestLog.length > 0 && <button onClick={clearLog} style={{ padding: "4px 12px", borderRadius: "6px", border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)", cursor: "pointer", fontSize: "12px" }}>Clear</button>}
        </div>
      </div>

      {/* Routes */}
      {activeView === "routes" && (
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
          {displayedRoutes.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 16px", color: "var(--color-text-muted)", border: "2px dashed var(--color-border)", borderRadius: "8px" }}>
              <p style={{ marginBottom: "12px", fontSize: "14px" }}>
                {protocolFilter === "grpc" ? "No gRPC mock routes defined yet." : "No routes defined yet."}
              </p>
              <div style={{ display: "flex", justifyContent: "center", gap: "8px", flexWrap: "wrap" }}>
                <button onClick={() => setShowTemplatesDrawer(true)} style={{ padding: "8px 18px", borderRadius: "6px", border: "1px solid var(--color-border)", background: "var(--color-surface-hover)", color: "var(--color-text)", cursor: "pointer", fontWeight: 600, fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <Layers size={14} color="var(--color-accent)" /> Browse Starter Templates
                </button>
                <button onClick={() => setShowProtoGenerator(true)} style={{ padding: "8px 18px", borderRadius: "6px", border: "1px solid var(--color-border)", background: "var(--color-surface-hover)", color: "var(--color-text)", cursor: "pointer", fontWeight: 600, fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <WandSparkles size={14} color="#818cf8" /> Generate from Proto Schema
                </button>
                <button onClick={() => setEditingRoute(newRoute(protocolFilter === "grpc" ? "GRPC" : "GET"))} style={{ padding: "8px 20px", borderRadius: "6px", border: "none", background: "var(--color-accent)", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>
                  + Add {protocolFilter === "grpc" ? "gRPC Route" : "Route"}
                </button>
              </div>
            </div>
          ) : displayedRoutes.map(r => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 14px", borderRadius: "8px", border: "1px solid var(--color-border)", background: r.enabled ? "var(--color-surface)" : "transparent", opacity: r.enabled ? 1 : 0.5 }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: methodColor(r.method), minWidth: "52px", textAlign: "center", padding: "2px 6px", borderRadius: "4px", background: `${methodColor(r.method)}18` }}>{r.method}</span>
              <span style={{ flex: 1, fontFamily: "monospace", fontSize: "13px", color: "var(--color-text)" }}>{r.path}</span>
              <span style={{ fontSize: "12px", fontWeight: 700, color: statusColor(r.status_code), minWidth: "38px" }}>{r.status_code}</span>
              {r.delay_ms > 0 && <span style={{ fontSize: "11px", color: "var(--color-text-muted)", minWidth: "40px" }}>{r.delay_ms}ms</span>}
              {running && <button onClick={() => copyUrl(r.id, r.path)} title="Copy URL" style={{ padding: "3px 6px", background: "none", border: "1px solid var(--color-border)", borderRadius: "4px", cursor: "pointer", color: "var(--color-text-muted)", display: "flex", alignItems: "center" }}>{copiedId === r.id ? <Check size={11} /> : <Copy size={11} />}</button>}
              <button onClick={() => syncRoutes(routes.map(x => x.id === r.id ? { ...x, enabled: !x.enabled } : x))} style={{ padding: "3px 8px", background: "none", border: "1px solid var(--color-border)", borderRadius: "4px", cursor: "pointer", color: "var(--color-text-muted)", fontSize: "11px" }}>{r.enabled ? "Disable" : "Enable"}</button>
              <button onClick={() => setEditingRoute(r)} style={{ padding: "3px 8px", background: "none", border: "1px solid var(--color-border)", borderRadius: "4px", cursor: "pointer", color: "var(--color-text-muted)", fontSize: "11px" }}>Edit</button>
              <button onClick={() => syncRoutes(routes.filter(x => x.id !== r.id))} style={{ padding: "3px 6px", background: "none", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "4px", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center" }}><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      )}

      {/* Request Log */}
      {activeView === "log" && (
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
          {requestLog.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 16px", color: "var(--color-text-muted)", border: "2px dashed var(--color-border)", borderRadius: "8px", fontSize: "13px" }}>
              {running ? "Waiting for incoming requests…" : "Start the server and send requests to see the log."}
            </div>
          ) : requestLog.map(entry => (
            <div key={entry.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "7px 12px", borderRadius: "6px", border: "1px solid var(--color-border)", background: "var(--color-surface)", fontSize: "12px" }}>
              <span style={{ fontWeight: 700, color: methodColor(entry.method), minWidth: "45px", textAlign: "center", fontSize: "11px" }}>{entry.method}</span>
              <span style={{ flex: 1, fontFamily: "monospace", color: "var(--color-text)" }}>{entry.path}</span>
              <span style={{ fontWeight: 700, color: statusColor(entry.status_code), minWidth: "35px", textAlign: "right" }}>{entry.status_code}</span>
              <span style={{ color: "var(--color-text-muted)", minWidth: "55px", textAlign: "right" }}>{entry.duration_ms}ms</span>
              <span style={{ color: "var(--color-text-muted)", fontSize: "10px", minWidth: "72px", textAlign: "right" }}>{new Date(entry.timestamp).toLocaleTimeString()}</span>
              {!entry.matched_route_id && <span style={{ fontSize: "10px", color: "#ef4444", padding: "1px 5px", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "3px" }}>no match</span>}
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
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
