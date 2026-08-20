import React, { useState, useMemo, useEffect, useRef } from "react";
import { useI18n } from "../services/i18n";
import {
  X,
  ShieldCheck,
  Binary,
  Braces,
  Hash,
  Server,
  FileCode2,
  Bot,
  Copy,
  Check,
  WandSparkles,
  Layers,
  Plus,
  Play,
  Square,
  Trash2,
  Sparkles,
  Clock,
  ClipboardPaste,
  Edit2,
  Code,
  Lock,
  Radio,
  FileText,
  CheckCircle2,
  AlertCircle,
  Zap,
  ArrowLeftRight
} from "lucide-react";
import type { MockRoute, MockRequestLog } from "../services/local-store";
import { CustomSelect } from "./CustomSelect";
import { parseProtoSchema, generateSampleMessageJson, SAMPLE_PROTO_DEFINITIONS } from "../services/proto-parser";
import { MOCK_SERVER_TEMPLATES, createRoutesFromTemplate, type MockServerTemplate } from "../services/mock-templates";

export interface ApiToolsModalProps {
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
  const { t } = useI18n();
  const [token, setToken] = useState("");
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const decoded = useMemo(() => {
    if (!token.trim()) return null;
    try {
      const parts = token.trim().split(".");
      if (parts.length !== 3) return { error: "{t('tools.jwtInvalidFormat')} (must contain 3 base64 segments separated by dots)." };
      
      const headerStr = b64DecodeUnicode(parts[0]);
      const payloadStr = b64DecodeUnicode(parts[1]);
      
      const header = JSON.parse(headerStr);
      const payload = JSON.parse(payloadStr);
      
      let expDate = null;
      let isExpired = false;
      if (payload.exp && typeof payload.exp === "number") {
        expDate = new Date(payload.exp * 1000);
        isExpired = Date.now() > payload.exp * 1000;
      }

      return {
        header: JSON.stringify(header, null, 2),
        payload: JSON.stringify(payload, null, 2),
        signature: parts[2],
        expDate: expDate ? expDate.toLocaleString() : null,
        isExpired,
        algo: header.alg || "Unknown"
      };
    } catch (e: any) {
      return { error: `Failed to decode: ${e.message}` };
    }
  }, [token]);

  const copyText = (text: string | undefined, section: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 1500);
  };

  return (
    <div className="api-tools-pane-split">
      <div className="api-tools-pane-col">
        <div className="api-tools-pane-header">
          <div className="api-tools-section-title">Encoded JWT Token</div>
          <div className="api-tools-action-group">
            <button
              type="button"
              className="ghost-button api-tools-mini-btn"
              onClick={async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  setToken(text);
                } catch (e) {
                  console.error("Failed to read clipboard", e);
                }
              }}
              title="Paste from Clipboard"
            >
              <ClipboardPaste size={13} /> Paste
            </button>
            {token && (
              <button
                type="button"
                className="ghost-button api-tools-mini-btn danger"
                onClick={() => setToken("")}
                title="Clear Token"
              >
                <Trash2 size={13} /> Clear
              </button>
            )}
          </div>
        </div>
        <textarea
          className="api-tools-textarea"
          style={{ flex: 1, wordBreak: "break-all" }}
          placeholder="{t('tools.jwtPastePlaceholder')} (e.g. eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...)"
          value={token}
          onChange={e => setToken(e.target.value)}
          autoFocus
        />
      </div>

      <div className="api-tools-pane-col api-tools-pane-results">
        <div className="api-tools-pane-header">
          <div className="api-tools-section-title">Decoded Claims &amp; Payload</div>
          {decoded && !decoded.error && (
            <div className="api-tools-jwt-meta-pill">
              <span>Alg: <strong>{decoded.algo}</strong></span>
              {decoded.expDate && (
                <span className={decoded.isExpired ? "api-tools-badge-expired" : "api-tools-badge-valid"}>
                  {decoded.isExpired ? "⚠️ Expired" : "✓ Active"}
                </span>
              )}
            </div>
          )}
        </div>
        
        {decoded?.error ? (
          <div className="api-tools-alert-box error">
            <AlertCircle size={16} />
            <span>{decoded.error}</span>
          </div>
        ) : decoded ? (
          <div className="api-tools-jwt-cards">
            <div className="api-tools-card-block">
              <div className="api-tools-card-header">
                <span className="api-tools-card-tag tag-pink">Header</span>
                <span className="api-tools-card-hint">Algorithm &amp; Token Type</span>
                <button
                  type="button"
                  className="ghost-button api-tools-card-copy-btn"
                  onClick={() => copyText(decoded.header, "header")}
                >
                  {copiedSection === "header" ? <Check size={12} /> : <Copy size={12} />}
                  {copiedSection === "header" ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="api-tools-code-display code-pink">{decoded.header}</pre>
            </div>
            
            <div className="api-tools-card-block">
              <div className="api-tools-card-header">
                <span className="api-tools-card-tag tag-purple">Payload</span>
                <span className="api-tools-card-hint">Subject, Roles &amp; Claims</span>
                <button
                  type="button"
                  className="ghost-button api-tools-card-copy-btn"
                  onClick={() => copyText(decoded.payload, "payload")}
                >
                  {copiedSection === "payload" ? <Check size={12} /> : <Copy size={12} />}
                  {copiedSection === "payload" ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="api-tools-code-display code-purple">{decoded.payload}</pre>
            </div>
            
            <div className="api-tools-card-block">
              <div className="api-tools-card-header">
                <span className="api-tools-card-tag tag-blue">Signature</span>
                <span className="api-tools-card-hint">HMAC / RSA Cryptographic Hash</span>
                <button
                  type="button"
                  className="ghost-button api-tools-card-copy-btn"
                  onClick={() => copyText(decoded.signature, "signature")}
                >
                  {copiedSection === "signature" ? <Check size={12} /> : <Copy size={12} />}
                  {copiedSection === "signature" ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="api-tools-code-display code-blue" style={{ wordBreak: "break-all", whiteSpace: "pre-wrap" }}>
                {decoded.signature}
              </pre>
            </div>
          </div>
        ) : (
          <div className="api-tools-empty-placeholder">
            <ShieldCheck size={36} className="api-tools-empty-icon" />
            <p>Paste a JWT token on the left to inspect its headers, payload claims, and signature validity.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function EncoderDecoder() {
  const { t } = useI18n();
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"base64" | "url" | "hex">("base64");
  const [action, setAction] = useState<"encode" | "decode">("encode");
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => {
    if (!input) return "";
    try {
      if (mode === "base64") {
        return action === "encode" ? btoa(input) : atob(input);
      } else if (mode === "url") {
        return action === "encode" ? encodeURIComponent(input) : decodeURIComponent(input);
      } else if (mode === "hex") {
        if (action === "encode") {
          const encoder = new TextEncoder();
          const bytes = encoder.encode(input);
          return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
        } else {
          const cleanHex = input.replace(/\s+/g, "");
          const bytes = new Uint8Array(cleanHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
          const decoder = new TextDecoder();
          return decoder.decode(bytes);
        }
      }
      return "";
    } catch (e: any) {
      return `Error: ${e.message}`;
    }
  }, [input, mode, action]);

  const handleCopy = () => {
    if (!result || result.startsWith("Error")) return;
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSwap = () => {
    if (result && !result.startsWith("Error")) {
      setInput(result);
      setAction(action === "encode" ? "decode" : "encode");
    }
  };

  return (
    <div className="api-tools-pane-split">
      <div className="api-tools-pane-col">
        <div className="api-tools-pane-header">
          <div className="api-tools-section-title">Input Text</div>
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              type="button"
              className="ghost-button api-tools-mini-btn"
              onClick={handleSwap}
              disabled={!result || result.startsWith("Error")}
              title="Swap input and output"
            >
              <ArrowLeftRight size={13} /> Swap
            </button>
            {input && (
              <button
                type="button"
                className="ghost-button api-tools-mini-btn danger"
                onClick={() => setInput("")}
              >
                Clear
              </button>
            )}
          </div>
        </div>
        <textarea
          className="api-tools-textarea"
          style={{ flex: 1 }}
          placeholder="Enter text string to transform..."
          value={input}
          onChange={e => setInput(e.target.value)}
          autoFocus
        />
        
        <div className="api-tools-selector-bar">
          <div className="api-tools-segmented-group">
            {(["base64", "url", "hex"] as const).map(m => (
              <button
                key={m}
                type="button"
                className={`api-tools-seg-btn ${mode === m ? "active" : ""}`}
                onClick={() => setMode(m)}
              >
                {m === "base64" ? "Base64" : m === "url" ? "URL Encode" : "Hex String"}
              </button>
            ))}
          </div>

          <div className="api-tools-segmented-group" style={{ marginLeft: "auto" }}>
            {(["encode", "decode"] as const).map(a => (
              <button
                key={a}
                type="button"
                className={`api-tools-seg-btn ${action === a ? "active" : ""}`}
                onClick={() => setAction(a)}
              >
                {a === "encode" ? "Encode ↗" : "Decode ↘"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="api-tools-pane-col">
        <div className="api-tools-pane-header">
          <div className="api-tools-section-title">Result</div>
          <button
            type="button"
            className="ghost-button api-tools-mini-btn"
            onClick={handleCopy}
            disabled={!result || result.startsWith("Error")}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy Output"}
          </button>
        </div>
        <textarea
          className="api-tools-textarea api-tools-output-textarea"
          style={{ flex: 1, color: result.startsWith("Error") ? "var(--color-status-error, #ef4444)" : "var(--color-text)" }}
          readOnly
          placeholder="Transformed output will appear here..."
          value={result}
        />
      </div>
    </div>
  );
}

function JsonFormatter() {
  const { t } = useI18n();
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

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

  const handleMinify = () => {
    if (!input.trim()) return;
    try {
      const parsed = JSON.parse(input);
      setInput(JSON.stringify(parsed));
      setError("");
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handlePrettify = () => {
    if (!input.trim()) return;
    try {
      const parsed = JSON.parse(input);
      setInput(JSON.stringify(parsed, null, 2));
      setError("");
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleCopy = () => {
    if (!input.trim()) return;
    navigator.clipboard.writeText(input);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "10px" }}>
      <div className="api-tools-pane-header">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div className="api-tools-section-title">JSON Formatter &amp; Validator</div>
          {input.trim() && !error && (
            <span className="api-tools-badge-valid">✓ Valid JSON</span>
          )}
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            type="button"
            className="ghost-button api-tools-mini-btn"
            onClick={handlePrettify}
            disabled={!input.trim()}
          >
            <Sparkles size={13} /> Prettify
          </button>
          <button
            type="button"
            className="ghost-button api-tools-mini-btn"
            onClick={handleMinify}
            disabled={!input.trim()}
          >
            Minify
          </button>
          <button
            type="button"
            className="ghost-button api-tools-mini-btn"
            onClick={handleCopy}
            disabled={!input.trim()}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy"}
          </button>
          {input && (
            <button
              type="button"
              className="ghost-button api-tools-mini-btn danger"
              onClick={() => setInput("")}
            >
              Clear
            </button>
          )}
        </div>
      </div>
      
      {error && (
        <div className="api-tools-alert-box error">
          <AlertCircle size={16} />
          <span>Invalid JSON Syntax: {error}</span>
        </div>
      )}

      <textarea
        className="api-tools-textarea"
        style={{ flex: 1, whiteSpace: "pre", fontFamily: "var(--font-mono, monospace)" }}
        placeholder='Paste JSON here (e.g. {"status": "ok", "items": [1, 2, 3]})...'
        value={input}
        onChange={e => setInput(e.target.value)}
        autoFocus
      />
    </div>
  );
}

function HashGenerator() {
  const { t } = useI18n();
  const [input, setInput] = useState("");
  const [hashes, setHashes] = useState<Record<string, string>>({});
  const [copiedAlgo, setCopiedAlgo] = useState<string | null>(null);

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

  const copyHash = (hash: string, algo: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedAlgo(algo);
    setTimeout(() => setCopiedAlgo(null), 1500);
  };

  return (
    <div className="api-tools-pane-split">
      <div className="api-tools-pane-col">
        <div className="api-tools-pane-header">
          <div className="api-tools-section-title">Source Plaintext</div>
          {input && (
            <button
              type="button"
              className="ghost-button api-tools-mini-btn danger"
              onClick={() => setInput("")}
            >
              Clear
            </button>
          )}
        </div>
        <textarea
          className="api-tools-textarea"
          style={{ flex: 1 }}
          placeholder="Enter text to generate cryptographic hashes..."
          value={input}
          onChange={e => setInput(e.target.value)}
          autoFocus
        />
      </div>

      <div className="api-tools-pane-col api-tools-pane-results">
        <div className="api-tools-pane-header">
          <div className="api-tools-section-title">Cryptographic Digests</div>
        </div>
        
        {Object.entries(hashes).length === 0 ? (
          <div className="api-tools-empty-placeholder">
            <Hash size={36} className="api-tools-empty-icon" />
            <p>Type text on the left to calculate SHA-1, SHA-256, SHA-384, and SHA-512 digests in real-time.</p>
          </div>
        ) : (
          <div className="api-tools-hash-list">
            {Object.entries(hashes).map(([algo, hash]) => (
              <div key={algo} className="api-tools-card-block">
                <div className="api-tools-card-header">
                  <span className="api-tools-card-tag tag-indigo">{algo}</span>
                  <span className="api-tools-card-hint">{hash.length * 4} bits</span>
                  <button
                    type="button"
                    className="ghost-button api-tools-card-copy-btn"
                    onClick={() => copyHash(hash, algo)}
                  >
                    {copiedAlgo === algo ? <Check size={12} /> : <Copy size={12} />}
                    {copiedAlgo === algo ? "Copied" : "Copy"}
                  </button>
                </div>
                <pre className="api-tools-code-display" style={{ wordBreak: "break-all", whiteSpace: "pre-wrap", color: "var(--color-text)" }}>
                  {hash}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color, icon }: { label: string; value: string; color: string; icon?: React.ReactNode }) {
  return (
    <div className="api-tools-stat-card">
      <div className="api-tools-stat-label">
        {icon}
        <span>{label}</span>
      </div>
      <div className="api-tools-stat-value" style={{ color }}>{value}</div>
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
    <div className="api-tools-route-editor">
      <div className="api-tools-editor-header">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div className="api-tools-icon-badge">
            <Edit2 size={15} color="var(--color-accent)" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "15px", color: "var(--color-text)", fontWeight: 600 }}>
              {draft.method === "GRPC" ? "Configure gRPC RPC Method" : "Configure Mock Route"}
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--color-text-muted)" }}>
              Customize method, path matching, status codes, and mock response body.
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button type="button" onClick={onCancel} className="ghost-button">Cancel</button>
          <button type="button" onClick={() => onSave(draft)} className="primary-button" style={{ padding: "6px 16px" }}>Save Route</button>
        </div>
      </div>

      <div className="api-tools-editor-grid">
        <div className="api-tools-form-field">
          <label>Protocol / Method</label>
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
            className="api-tools-select"
            style={{ fontWeight: draft.method === "GRPC" ? 700 : 500 }}
          >
            {METHODS.map(m => <option key={m} value={m}>{m === "GRPC" ? "gRPC-Web (Proto)" : m}</option>)}
          </select>
        </div>

        <div className="api-tools-form-field">
          <label>{draft.method === "GRPC" ? "RPC Path (/<Service>/<Method>)" : "Route Path"}</label>
          <input
            type="text"
            value={draft.path}
            onChange={e => update({ path: e.target.value })}
            placeholder={draft.method === "GRPC" ? "/helloworld.Greeter/SayHello" : "/api/v1/users/:id"}
            className="api-tools-input"
            style={{ fontFamily: "var(--font-mono, monospace)" }}
          />
        </div>

        <div className="api-tools-form-field">
          <label>Status Code</label>
          <select
            value={draft.status_code}
            onChange={e => update({ status_code: Number(e.target.value) })}
            className="api-tools-select"
          >
            {COMMON_STATUSES.map(s => (
              <option key={s} value={s}>
                {s} {s === 200 && draft.method === "GRPC" ? "(0 OK)" : s === 400 && draft.method === "GRPC" ? "(3 INVALID_ARG)" : s === 404 && draft.method === "GRPC" ? "(5 NOT_FOUND)" : s === 503 && draft.method === "GRPC" ? "(14 UNAVAIL)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="api-tools-form-field">
          <label>Content-Type</label>
          <select
            value={draft.content_type}
            onChange={e => update({ content_type: e.target.value })}
            className="api-tools-select"
          >
            {CONTENT_TYPES.map(ct => <option key={ct} value={ct}>{ct}</option>)}
          </select>
        </div>

        <div className="api-tools-form-field">
          <label>Simulated Latency (ms)</label>
          <input
            type="number"
            value={draft.delay_ms}
            min={0}
            max={30000}
            onChange={e => update({ delay_ms: Number(e.target.value) })}
            className="api-tools-input"
            placeholder="0"
          />
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px", minHeight: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {draft.method === "GRPC" ? "gRPC Response JSON Payload" : "Response Payload Body"}
          </label>
          <button
            type="button"
            onClick={handlePrettifyJson}
            className="ghost-button api-tools-mini-btn"
          >
            <Sparkles size={12} /> Format JSON
          </button>
        </div>
        <textarea
          className="api-tools-textarea"
          style={{ flex: 1, fontFamily: "var(--font-mono, monospace)", fontSize: "12.5px" }}
          value={draft.response_body}
          onChange={e => update({ response_body: e.target.value })}
          placeholder='{"message": "Hello from mock server!"}'
        />
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
    { id: "ai", label: "AI & Streaming" },
    { id: "infra", label: "DevOps & Health" },
  ];

  const filtered = useMemo(() => {
    if (selectedCategory === "all") return MOCK_SERVER_TEMPLATES;
    return MOCK_SERVER_TEMPLATES.filter((t) => t.category === selectedCategory);
  }, [selectedCategory]);

  return (
    <div className="api-tools-drawer">
      <div className="api-tools-drawer-header">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Layers size={16} color="var(--color-accent)" />
          <strong style={{ fontSize: "14px", color: "var(--color-text)" }}>Mock Server Starter Templates</strong>
          <span className="api-tools-pill-counter">{MOCK_SERVER_TEMPLATES.length} presets</span>
        </div>
        <button type="button" onClick={onClose} className="ghost-button api-tools-mini-btn">
          <X size={14} /> Close
        </button>
      </div>

      <div className="api-tools-category-chips">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelectedCategory(c.id)}
            className={`api-tools-category-chip ${selectedCategory === c.id ? "active" : ""}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="api-tools-templates-grid">
        {filtered.map((tpl) => (
          <div key={tpl.id} className="api-tools-template-card">
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "16px" }}>{tpl.icon}</span>
                  <strong style={{ fontSize: "13px", color: "var(--color-text)" }}>{tpl.name}</strong>
                </div>
                <span className={`api-tools-tag-cat cat-${tpl.category}`}>
                  {tpl.category}
                </span>
              </div>
              <p className="api-tools-template-desc">
                {tpl.description}
              </p>
              <div className="api-tools-template-routes">
                {tpl.routes.slice(0, 3).map((r, idx) => (
                  <span key={idx} className="api-tools-template-route-chip">
                    <strong className={`method-text method-${r.method.toLowerCase()}`}>{r.method}</strong> {r.path}
                  </span>
                ))}
                {tpl.routes.length > 3 && (
                  <span className="api-tools-template-more-chip">
                    +{tpl.routes.length - 3} more
                  </span>
                )}
              </div>
            </div>

            <div className="api-tools-template-actions">
              <button
                type="button"
                onClick={() => onAppendTemplate(tpl)}
                className="ghost-button api-tools-mini-btn"
                title="Add routes without overwriting existing ones"
              >
                + Append
              </button>
              <button
                type="button"
                onClick={() => onLoadTemplate(tpl)}
                className="primary-button api-tools-mini-btn"
                title="Replace all routes with this template"
              >
                Load Template
              </button>
            </div>
          </div>
        ))}
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
      {/* Top Banner & Control Station */}
      <div className="api-tools-server-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h3 className="api-tools-title">Local Mock Server</h3>
            <span className="api-tools-subtitle-badge">HTTP &amp; gRPC</span>
            {running ? (
              <button
                type="button"
                className="api-tools-live-badge live"
                onClick={() => copyUrl("__base", "/")}
                title="Click to copy mock base URL"
              >
                <span className="api-tools-dot-pulse" />
                <span>ONLINE: http://127.0.0.1:{port}</span>
                {copiedId === "__base" ? <Check size={11} /> : <Copy size={11} />}
              </button>
            ) : (
              <span className="api-tools-live-badge offline">
                <span className="api-tools-dot-idle" />
                <span>OFFLINE</span>
              </span>
            )}
          </div>
          <p className="api-tools-desc">
            Simulate REST endpoints &amp; gRPC-Web RPC methods with custom payloads, status codes, and latency.
          </p>
        </div>

        <div className="api-tools-server-controls">
          {!running && (
            <div className="api-tools-port-pill">
              <span className="api-tools-port-label">Port</span>
              <input
                type="number"
                value={port}
                onChange={e => setPort(Number(e.target.value))}
                className="api-tools-port-input"
              />
            </div>
          )}
          
          <button
            type="button"
            onClick={handleToggle}
            className={`api-tools-power-btn ${running ? "btn-stop" : "btn-start"}`}
          >
            {running ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
            <span>{running ? "Stop Server" : "Start Server"}</span>
          </button>
        </div>
      </div>

      {/* Telemetry Stats bar (When running) */}
      {running && (
        <div className="api-tools-stats-grid">
          <StatCard label="Port" value={String(port)} color="var(--color-text)" icon={<Radio size={12} />} />
          <StatCard label="Requests Handled" value={String(requestCount)} color="var(--color-accent)" icon={<Zap size={12} />} />
          <StatCard label="Active Routes" value={`${routes.filter(r => r.enabled).length} / ${routes.length}`} color="#10b981" icon={<CheckCircle2 size={12} />} />
          <StatCard label="gRPC Methods" value={String(grpcCount)} color="#818cf8" icon={<Layers size={12} />} />
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

      {/* Proto Schema Generator Drawer */}
      {showProtoGenerator && (
        <div className="api-tools-drawer">
          <div className="api-tools-drawer-header">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <WandSparkles size={16} color="#818cf8" />
              <strong style={{ fontSize: "14px", color: "var(--color-text)" }}>Generate gRPC Mock Server from Protobuf Schema</strong>
            </div>
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <select
                onChange={(e) => {
                  const preset = SAMPLE_PROTO_DEFINITIONS.find(p => p.label === e.target.value);
                  if (preset) setProtoText(preset.proto);
                }}
                className="api-tools-select"
                style={{ fontSize: "11px", padding: "4px 8px" }}
              >
                {SAMPLE_PROTO_DEFINITIONS.map(p => (
                  <option key={p.label} value={p.label}>{p.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowProtoGenerator(false)}
                className="ghost-button api-tools-mini-btn"
              >
                <X size={14} /> Cancel
              </button>
            </div>
          </div>

          <textarea
            value={protoText}
            onChange={e => setProtoText(e.target.value)}
            placeholder="Paste .proto IDL syntax definition here..."
            className="api-tools-textarea"
            style={{ minHeight: "140px", fontSize: "12px", fontFamily: "var(--font-mono, monospace)" }}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <button
              type="button"
              onClick={handleGenerateFromProto}
              className="primary-button api-tools-mini-btn"
              style={{ background: "#6366f1" }}
            >
              <WandSparkles size={13} /> Generate Mock RPC Routes
            </button>
          </div>
        </div>
      )}

      {/* Modern Main Toolbar */}
      <div className="api-tools-main-toolbar">
        <div className="api-tools-segmented-group">
          {(["routes", "log"] as const).map(v => (
            <button
              key={v}
              type="button"
              className={`api-tools-seg-btn ${activeView === v ? "active" : ""}`}
              onClick={() => setActiveView(v)}
            >
              {v === "log" ? `Live Logs ${requestLog.length > 0 ? `(${requestLog.length})` : ""}` : `Routes (${routes.length})`}
            </button>
          ))}
        </div>

        {activeView === "routes" && (
          <div className="api-tools-filter-chips">
            {(["all", "http", "grpc"] as const).map(f => (
              <button
                key={f}
                type="button"
                className={`api-tools-filter-chip ${protocolFilter === f ? "active" : ""}`}
                onClick={() => setProtocolFilter(f)}
              >
                {f === "all" ? `All (${routes.length})` : f === "http" ? `HTTP (${httpCount})` : `gRPC (${grpcCount})`}
              </button>
            ))}
          </div>
        )}

        <div className="api-tools-toolbar-actions">
          {activeView === "routes" && (
            <>
              <button
                type="button"
                onClick={() => setShowTemplatesDrawer(prev => !prev)}
                className={`ghost-button api-tools-action-btn ${showTemplatesDrawer ? "active-accent" : ""}`}
              >
                <Layers size={13} /> Templates
              </button>
              <button
                type="button"
                onClick={() => setShowProtoGenerator(prev => !prev)}
                className={`ghost-button api-tools-action-btn ${showProtoGenerator ? "active-indigo" : ""}`}
              >
                <WandSparkles size={13} /> Import Proto
              </button>
              <button
                type="button"
                onClick={() => setEditingRoute(newRoute("GRPC"))}
                className="ghost-button api-tools-action-btn grpc-btn"
              >
                + gRPC Method
              </button>
              <button
                type="button"
                onClick={() => setEditingRoute(newRoute("GET"))}
                className="primary-button api-tools-action-btn"
              >
                <Plus size={14} /> Add Route
              </button>
            </>
          )}
          {activeView === "log" && requestLog.length > 0 && (
            <button
              type="button"
              onClick={clearLog}
              className="ghost-button api-tools-mini-btn danger"
            >
              <Trash2 size={13} /> Clear Logs
            </button>
          )}
        </div>
      </div>

      {/* Routes List */}
      {activeView === "routes" && (
        <div className="api-tools-routes-container">
          {displayedRoutes.length === 0 ? (
            <div className="api-tools-hero-empty-state">
              <div className="api-tools-empty-circle">
                <Server size={32} className="api-tools-pulse-icon" />
              </div>
              <h4 className="api-tools-empty-title">
                {protocolFilter === "grpc" ? "No gRPC mock routes defined" : "No mock routes configured"}
              </h4>
              <p className="api-tools-empty-desc">
                Simulate backend endpoints instantly. Load starter templates, import from Protobuf schemas, or define custom routes.
              </p>

              <div className="api-tools-empty-action-cards">
                <button
                  type="button"
                  onClick={() => setShowTemplatesDrawer(true)}
                  className="api-tools-empty-card"
                >
                  <div className="api-tools-empty-card-icon tag-purple">
                    <Layers size={18} />
                  </div>
                  <div className="api-tools-empty-card-body">
                    <strong>Starter Templates</strong>
                    <span>Load eCommerce, Auth, or AI routes</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setShowProtoGenerator(true)}
                  className="api-tools-empty-card"
                >
                  <div className="api-tools-empty-card-icon tag-indigo">
                    <WandSparkles size={18} />
                  </div>
                  <div className="api-tools-empty-card-body">
                    <strong>Import Proto Schema</strong>
                    <span>Scaffold mock gRPC RPC methods</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setEditingRoute(newRoute(protocolFilter === "grpc" ? "GRPC" : "GET"))}
                  className="api-tools-empty-card"
                >
                  <div className="api-tools-empty-card-icon tag-blue">
                    <Plus size={18} />
                  </div>
                  <div className="api-tools-empty-card-body">
                    <strong>Custom Route</strong>
                    <span>Define path, status, and payload</span>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <div className="api-tools-routes-list">
              {displayedRoutes.map(r => (
                <div key={r.id} className={`api-tools-route-row ${!r.enabled ? "disabled" : ""}`}>
                  <span className={`method method-${r.method.toLowerCase()} api-tools-method-pill`}>
                    {r.method}
                  </span>
                  
                  <span className="api-tools-route-path" title={r.path}>
                    {r.path}
                  </span>

                  <span className="api-tools-status-pill" style={{ color: statusColor(r.status_code), borderColor: `${statusColor(r.status_code)}40`, background: `${statusColor(r.status_code)}14` }}>
                    {r.status_code}
                  </span>

                  {r.delay_ms > 0 && (
                    <span className="api-tools-delay-pill">
                      <Clock size={10} /> {r.delay_ms}ms
                    </span>
                  )}

                  <div className="api-tools-row-actions">
                    {running && (
                      <button
                        type="button"
                        onClick={() => copyUrl(r.id, r.path)}
                        className="ghost-button api-tools-row-btn"
                        title="Copy Mock Endpoint URL"
                      >
                        {copiedId === r.id ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => syncRoutes(routes.map(x => x.id === r.id ? { ...x, enabled: !x.enabled } : x))}
                      className="ghost-button api-tools-row-btn"
                      title={r.enabled ? "Disable route" : "Enable route"}
                    >
                      {r.enabled ? "Enabled" : "Disabled"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingRoute(r)}
                      className="ghost-button api-tools-row-btn"
                      title="Edit Route"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => syncRoutes(routes.filter(x => x.id !== r.id))}
                      className="ghost-button api-tools-row-btn danger"
                      title="Delete Route"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Live Request Logs */}
      {activeView === "log" && (
        <div className="api-tools-log-container">
          {requestLog.length === 0 ? (
            <div className="api-tools-empty-placeholder">
              <Radio size={36} className="api-tools-empty-icon" />
              <p>{running ? "Waiting for incoming mock requests…" : "Start the mock server to stream request telemetry in real-time."}</p>
            </div>
          ) : (
            <div className="api-tools-log-list">
              {requestLog.map(entry => (
                <div key={entry.id} className="api-tools-log-row">
                  <span className={`method method-${entry.method.toLowerCase()} api-tools-method-pill mini`}>
                    {entry.method}
                  </span>
                  <span className="api-tools-log-path">{entry.path}</span>
                  <span className="api-tools-log-status" style={{ color: statusColor(entry.status_code) }}>
                    {entry.status_code}
                  </span>
                  <span className="api-tools-log-duration">{entry.duration_ms}ms</span>
                  <span className="api-tools-log-time">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                  {!entry.matched_route_id && (
                    <span className="api-tools-badge-nomatch">No Match (404)</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OpenApiEngineView({ collections }: { collections: { id: string; name: string }[] }) {
  const [spec, setSpec] = useState("");
  const [selectedCollection, setSelectedCollection] = useState<string>(collections[0]?.id || "");
  const [copied, setCopied] = useState(false);

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

  const handleCopy = () => {
    if (!spec) return;
    navigator.clipboard.writeText(spec);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "14px" }}>
      <div className="api-tools-server-header">
        <div>
          <h3 className="api-tools-title">OpenAPI 3.0.3 Spec Generator</h3>
          <p className="api-tools-desc">
            Export standards-compliant OpenAPI 3.0 specification documents from your request collections.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <div style={{ width: "220px" }}>
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
            className="primary-button api-tools-action-btn"
          >
            <Sparkles size={13} /> Generate Spec
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px", minHeight: 0 }}>
        <div className="api-tools-pane-header">
          <div className="api-tools-section-title">OpenAPI 3.0 Specification (JSON)</div>
          {spec && (
            <button
              type="button"
              className="ghost-button api-tools-mini-btn"
              onClick={handleCopy}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "Copied" : "Copy Spec"}
            </button>
          )}
        </div>
        <textarea
          className="api-tools-textarea"
          style={{ flex: 1, fontFamily: "var(--font-mono, monospace)", fontSize: "12.5px" }}
          readOnly
          placeholder="Click 'Generate Spec' above to produce OpenAPI 3.0.3 JSON definitions..."
          value={spec}
        />
      </div>
    </div>
  );
}

function McpServerView() {
  const [manifest, setManifest] = useState("");
  const [copied, setCopied] = useState(false);

  const handleExportManifest = async () => {
    const { exportMcpManifest } = await import("../services/local-store");
    const result = await exportMcpManifest();
    setManifest(result.manifest_json);
  };

  const handleCopy = () => {
    if (!manifest) return;
    navigator.clipboard.writeText(manifest);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "14px" }}>
      <div className="api-tools-server-header">
        <div>
          <h3 className="api-tools-title">Model Context Protocol (MCP) Server</h3>
          <p className="api-tools-desc">
            Expose KobeanREST workspace collections, requests, and environments to AI coding agents and LLMs.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportManifest}
          className="primary-button api-tools-action-btn"
        >
          <Bot size={14} /> Get MCP Tool Manifest
        </button>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px", minHeight: 0 }}>
        <div className="api-tools-pane-header">
          <div className="api-tools-section-title">MCP Tools &amp; Resources Schema</div>
          {manifest && (
            <button
              type="button"
              className="ghost-button api-tools-mini-btn"
              onClick={handleCopy}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "Copied" : "Copy Manifest"}
            </button>
          )}
        </div>
        <textarea
          className="api-tools-textarea"
          style={{ flex: 1, fontFamily: "var(--font-mono, monospace)", fontSize: "12.5px" }}
          readOnly
          placeholder="Click 'Get MCP Tool Manifest' to export declared tool definitions for LLMs..."
          value={manifest}
        />
      </div>
    </div>
  );
}

export function ApiToolsModal({ open, onClose, collections = [] }: ApiToolsModalProps) {
  const [activeTab, setActiveTab] = useState<"jwt" | "encode" | "json" | "hash" | "mock" | "openapi" | "mcp">("mock");

  if (!open) return null;

  const tabCategories = [
    {
      category: "Transformers & Security",
      tabs: [
        { id: "jwt", label: "JWT Decoder", icon: <ShieldCheck size={15} /> },
        { id: "encode", label: "Encode / Decode", icon: <Binary size={15} /> },
        { id: "json", label: "JSON Formatter", icon: <Braces size={15} /> },
        { id: "hash", label: "Hash Generator", icon: <Hash size={15} /> },
      ] as const
    },
    {
      category: "Servers & Protocols",
      tabs: [
        { id: "mock", label: "Mock Server", icon: <Server size={15} />, isHero: true },
        { id: "openapi", label: "OpenAPI 3.0", icon: <FileCode2 size={15} /> },
        { id: "mcp", label: "MCP Protocol", icon: <Bot size={15} /> },
      ] as const
    }
  ];

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="API Tools"
      onClick={onClose}
    >
      <div
        className="modal settings-modal api-tools-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="api-tools-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div className="api-tools-icon-banner">
              <Sparkles size={16} />
            </div>
            <div>
              <div className="api-tools-eyebrow">Developer Utilities</div>
              <h2 className="api-tools-main-title">API Tools &amp; Local Mock Servers</h2>
            </div>
          </div>
          <button
            className="settings-close"
            type="button"
            aria-label="Close API Tools"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        
        {/* Body Layout */}
        <div className="api-tools-modal-body">
          {/* Navigation Sidebar */}
          <div className="api-tools-sidebar">
            {tabCategories.map((group, gIdx) => (
              <div key={gIdx} className="api-tools-nav-group">
                <div className="api-tools-group-label">{group.category}</div>
                {group.tabs.map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`api-tools-nav-item ${activeTab === tab.id ? "active" : ""}`}
                  >
                    <div className="api-tools-nav-icon">{tab.icon}</div>
                    <span className="api-tools-nav-label">{tab.label}</span>
                    {tab.id === "mock" && (
                      <span className="api-tools-mock-dot-live" title="Mock Server Ready" />
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>

          {/* Main Workspace Pane */}
          <div className="api-tools-workspace">
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
