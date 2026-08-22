import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  X,
  Search,
  Keyboard,
  Sparkles,
  Code2,
  Globe2,
  Copy,
  Check,
  ExternalLink,
  Zap,
} from "lucide-react";
import { useI18n } from "../services/i18n";
import { openProductDocs } from "../app-utils";

export interface CheatsheetModalProps {
  open: boolean;
  onClose: () => void;
  onOpenDocs?: () => void;
}

type TabCategory = "all" | "hotkeys" | "variables" | "scripts" | "http";

interface HotkeyItem {
  keys: string[];
  label: string;
  description: string;
  category: "General" | "Composer" | "Sidebar & Tabs";
}

interface VariableItem {
  syntax: string;
  output: string;
  description: string;
  category: "Generators" | "Time & Date" | "Chaining & Scope";
}

interface ScriptSnippet {
  name: string;
  code: string;
  description: string;
  runtime: "kb" | "pm" | "chain";
}

interface HttpStatusItem {
  code: number;
  phrase: string;
  category: "2xx" | "3xx" | "4xx" | "5xx";
  description: string;
}

const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const modKey = isMac ? "⌘" : "Ctrl";

const HOTKEYS_LIST: HotkeyItem[] = [
  { keys: [modKey, "Enter"], label: "Send Request", description: "Execute the active HTTP / WS / gRPC request immediately", category: "Composer" },
  { keys: [modKey, "S"], label: "Save Request", description: "Persist unsaved changes to active request in workspace", category: "Composer" },
  { keys: [modKey, "T"], label: "New Request Tab", description: "Open a fresh, blank request tab in workspace", category: "Sidebar & Tabs" },
  { keys: [modKey, "B"], label: "Toggle Sidebar", description: "Show or hide the collections and workspace sidebar", category: "Sidebar & Tabs" },
  { keys: [modKey, "\\"], label: "Toggle Split Layout", description: "Switch between Stacked (Top/Bottom) and Side-by-Side (Left/Right) split", category: "General" },
  { keys: [modKey, "/"], label: "Open Cheatsheet & Hotkeys", description: "Quick access to this interactive cheatsheet modal", category: "General" },
  { keys: ["Esc"], label: "Dismiss / Close Popup", description: "Close active modal, dropdown list, or search overlay", category: "General" },
  { keys: ["Tab"], label: "Next Parameter / Header Field", description: "Focus next input row in request editor tables", category: "Composer" },
  { keys: ["Shift", "Enter"], label: "Multi-line Newline", description: "Insert newline in URL bar, query, or prompt textareas", category: "Composer" },
  { keys: ["{{...}}"], label: "Variable Autocomplete", description: "Type {{ to trigger environment & dynamic variable suggestions", category: "Composer" },
  { keys: ["Right Click"], label: "Extract Variable", description: "Select any text in headers/body/URL and extract to environment variable", category: "General" },
];

const DYNAMIC_VARIABLES: VariableItem[] = [
  { syntax: "{{$guid}}", output: "e874b2f1-08e1-4c12-9c44-b2586b453e9a", description: "Generates a unique UUID v4 string on each request", category: "Generators" },
  { syntax: "{{$timestamp}}", output: "1724337600", description: "Current Unix epoch timestamp in seconds", category: "Time & Date" },
  { syntax: "{{$isoTimestamp}}", output: "2026-08-22T15:50:00.000Z", description: "Current date and time in standard ISO 8601 UTC format", category: "Time & Date" },
  { syntax: "{{$randomInt}}", output: "742", description: "Random integer between 0 and 1000", category: "Generators" },
  { syntax: "{{$randomEmail}}", output: "dev.user@example.com", description: "Realistic randomized mock email address", category: "Generators" },
  { syntax: "{{$randomName}}", output: "Jordan Hayes", description: "Realistic randomized mock full name", category: "Generators" },
  { syntax: "{{$randomColor}}", output: "#3b82f6", description: "Random hexadecimal RGB color code", category: "Generators" },
  { syntax: "{{$randomIpv4}}", output: "192.168.1.100", description: "Randomized valid IPv4 network address", category: "Generators" },
  { syntax: "{{$randomUrl}}", output: "https://example.com/api/v1", description: "Random mock HTTPS endpoint URL", category: "Generators" },
  { syntax: "{{$randomWords}}", output: "lorem ipsum dolor sit amet", description: "Randomized placeholder text words", category: "Generators" },
  { syntax: "{{$response.body.data.id}}", output: "extracted from last run", description: "Chain value from previously executed request body JSON", category: "Chaining & Scope" },
  { syntax: "{{$response.header.X-Token}}", output: "extracted from header", description: "Chain response header value into following requests", category: "Chaining & Scope" },
  { syntax: "{{baseUrl}}", output: "active env variable", description: "Resolves variable from active environment or collection scope", category: "Chaining & Scope" },
];

const SCRIPT_SNIPPETS: ScriptSnippet[] = [
  {
    name: "Save Token to Environment (Native kb.*)",
    runtime: "kb",
    description: "Extract JWT/Bearer token from response JSON and save for subsequent requests",
    code: `const data = kb.response.json();
if (data?.token) {
  kb.env.set("token", data.token);
  console.log("Updated bearer token in active environment!");
}`,
  },
  {
    name: "Assert Status Code 200 & Response Time",
    runtime: "kb",
    description: "Validate response HTTP status code and ensure latency is below SLA limit",
    code: `kb.test("Status is 200 OK", () => {
  kb.expect(kb.response.status).toBe(200);
});

kb.test("Response time under 500ms", () => {
  kb.expect(kb.response.time).toBeLessThan(500);
});`,
  },
  {
    name: "Postman Compatibility Test (pm.*)",
    runtime: "pm",
    description: "Write test assertions using standard Postman pm.* syntax",
    code: `pm.test("Status code is 201 Created", function () {
  pm.response.to.have.status(201);
});

const jsonData = pm.response.json();
pm.environment.set("userId", jsonData.user.id);`,
  },
  {
    name: "Pre-Request Dynamic Timestamp Injection",
    runtime: "kb",
    description: "Compute custom cryptographic or time parameters before dispatching request",
    code: `const nonce = Math.random().toString(36).substring(2);
kb.env.set("requestNonce", nonce);
kb.env.set("signedAt", new Date().toISOString());`,
  },
];

const HTTP_STATUS_LIST: HttpStatusItem[] = [
  { code: 200, phrase: "OK", category: "2xx", description: "Standard successful response for GET/POST" },
  { code: 201, phrase: "Created", category: "2xx", description: "Resource created successfully (typically POST/PUT)" },
  { code: 204, phrase: "No Content", category: "2xx", description: "Request succeeded, no response body returned" },
  { code: 301, phrase: "Moved Permanently", category: "3xx", description: "Target resource assigned a new permanent URI" },
  { code: 304, phrase: "Not Modified", category: "3xx", description: "Cached version is valid (ETag/If-None-Match)" },
  { code: 400, phrase: "Bad Request", category: "4xx", description: "Malformed syntax, invalid parameters or payload" },
  { code: 401, phrase: "Unauthorized", category: "4xx", description: "Authentication required or invalid credentials" },
  { code: 403, phrase: "Forbidden", category: "4xx", description: "Server understands request but refuses authorization" },
  { code: 404, phrase: "Not Found", category: "4xx", description: "Requested endpoint or resource was not found" },
  { code: 409, phrase: "Conflict", category: "4xx", description: "Request conflicts with current state of resource" },
  { code: 422, phrase: "Unprocessable Entity", category: "4xx", description: "Semantic validation failure on request payload" },
  { code: 429, phrase: "Too Many Requests", category: "4xx", description: "Rate limit exceeded; backoff recommended" },
  { code: 500, phrase: "Internal Server Error", category: "5xx", description: "Generic server-side execution failure" },
  { code: 502, phrase: "Bad Gateway", category: "5xx", description: "Invalid response from upstream backend service" },
  { code: 503, phrase: "Service Unavailable", category: "5xx", description: "Server temporarily overloaded or under maintenance" },
  { code: 504, phrase: "Gateway Timeout", category: "5xx", description: "Upstream server failed to respond in time" },
];

export function CheatsheetModal({ open, onClose, onOpenDocs }: CheatsheetModalProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<TabCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => {
      setCopiedKey(null);
    }, 1600);
  };

  const query = searchQuery.trim().toLowerCase();

  const filteredHotkeys = useMemo(() => {
    if (!query) return HOTKEYS_LIST;
    return HOTKEYS_LIST.filter(
      (h) =>
        h.label.toLowerCase().includes(query) ||
        h.description.toLowerCase().includes(query) ||
        h.keys.some((k) => k.toLowerCase().includes(query)),
    );
  }, [query]);

  const filteredVariables = useMemo(() => {
    if (!query) return DYNAMIC_VARIABLES;
    return DYNAMIC_VARIABLES.filter(
      (v) =>
        v.syntax.toLowerCase().includes(query) ||
        v.description.toLowerCase().includes(query) ||
        v.output.toLowerCase().includes(query),
    );
  }, [query]);

  const filteredScripts = useMemo(() => {
    if (!query) return SCRIPT_SNIPPETS;
    return SCRIPT_SNIPPETS.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query) ||
        s.code.toLowerCase().includes(query),
    );
  }, [query]);

  const filteredHttp = useMemo(() => {
    if (!query) return HTTP_STATUS_LIST;
    return HTTP_STATUS_LIST.filter(
      (h) =>
        String(h.code).includes(query) ||
        h.phrase.toLowerCase().includes(query) ||
        h.description.toLowerCase().includes(query),
    );
  }, [query]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t("nav.cheatsheet") || "Super Cheatsheet & Hotkeys"}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="modal cheatsheet-modal settings-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "880px",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
          padding: 0,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 24px 14px",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--color-surface-elevated, rgba(15, 23, 42, 0.6))",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "rgba(59, 130, 246, 0.14)",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                color: "var(--color-accent, #3b82f6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Keyboard size={20} />
            </div>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "17px",
                  fontWeight: 750,
                  color: "var(--color-text)",
                  letterSpacing: "-0.01em",
                }}
              >
                {t("nav.cheatsheet") || "Super Cheatsheet & Hotkeys"}
              </h2>
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: "12px",
                  color: "var(--color-text-muted)",
                }}
              >
                Quick reference for shortcuts, dynamic variables, test runtime scripts, and HTTP codes
              </p>
            </div>
          </div>
          <button
            type="button"
            className="settings-close"
            aria-label={t("common.close") || "Close"}
            onClick={onClose}
            style={{
              flexShrink: 0,
              cursor: "pointer",
            }}
          >
            <X size={20} strokeWidth={2.2} />
          </button>
        </div>

        {/* Search & Navigation Bar */}
        <div
          style={{
            padding: "12px 24px",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--color-surface)",
          }}
        >
          {/* Search box */}
          <div
            style={{
              position: "relative",
              flex: "1 1 260px",
              maxWidth: "360px",
            }}
          >
            <Search
              size={14}
              style={{
                position: "absolute",
                left: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--color-text-muted)",
                pointerEvents: "none",
              }}
            />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search shortcuts, variables, APIs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "7px 12px 7px 32px",
                borderRadius: "8px",
                border: "1px solid var(--color-border)",
                background: "var(--color-surface-hover, rgba(255,255,255,0.04))",
                color: "var(--color-text)",
                fontSize: "12.5px",
                outline: "none",
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: "8px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  color: "var(--color-text-muted)",
                  cursor: "pointer",
                  padding: 2,
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              background: "var(--color-surface-hover, rgba(0,0,0,0.15))",
              padding: "3px",
              borderRadius: "8px",
              border: "1px solid var(--color-border)",
            }}
          >
            {[
              { id: "all", label: "All", icon: <Sparkles size={13} /> },
              { id: "hotkeys", label: "Hotkeys", icon: <Keyboard size={13} /> },
              { id: "variables", label: "Variables", icon: <Zap size={13} /> },
              { id: "scripts", label: "Scripts & Tests", icon: <Code2 size={13} /> },
              { id: "http", label: "HTTP Codes", icon: <Globe2 size={13} /> },
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as TabCategory)}
                  style={{
                    all: "unset",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "5px 10px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: active ? 700 : 500,
                    cursor: "pointer",
                    background: active ? "var(--color-surface, rgba(255,255,255,0.12))" : "transparent",
                    color: active ? "var(--color-text)" : "var(--color-text-muted)",
                    boxShadow: active ? "0 1px 4px rgba(0,0,0,0.2)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Body (Scrollable) */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}
        >
          {/* 1. Hotkeys Section */}
          {(activeTab === "all" || activeTab === "hotkeys") && filteredHotkeys.length > 0 && (
            <section>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Keyboard size={15} style={{ color: "var(--color-accent, #3b82f6)" }} />
                  <h3
                    style={{
                      margin: 0,
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "var(--color-text)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Keyboard Hotkeys & Shortcuts
                  </h3>
                </div>
                <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                  {filteredHotkeys.length} shortcuts available
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
                  gap: "8px",
                }}
              >
                {filteredHotkeys.map((h, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      background: "var(--color-surface-hover, rgba(255,255,255,0.03))",
                      border: "1px solid var(--color-border)",
                      transition: "background 0.15s ease",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "12.5px", fontWeight: 650, color: "var(--color-text)" }}>
                        {h.label}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "2px" }}>
                        {h.description}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0, marginLeft: "12px" }}>
                      {h.keys.map((k, ki) => (
                        <kbd
                          key={ki}
                          style={{
                            padding: "3px 7px",
                            borderRadius: "5px",
                            fontSize: "11px",
                            fontFamily: "var(--font-mono, monospace)",
                            fontWeight: 700,
                            background: "var(--color-surface, #1e293b)",
                            border: "1px solid var(--color-border-strong, rgba(255,255,255,0.2))",
                            color: "var(--color-text)",
                            boxShadow: "0 2px 0 rgba(0,0,0,0.25)",
                          }}
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 2. Dynamic Variables Section */}
          {(activeTab === "all" || activeTab === "variables") && filteredVariables.length > 0 && (
            <section>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Zap size={15} style={{ color: "#eab308" }} />
                  <h3
                    style={{
                      margin: 0,
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "var(--color-text)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Dynamic Variables & Mock Data
                  </h3>
                </div>
                <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                  Auto-resolves live on send
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: "8px",
                }}
              >
                {filteredVariables.map((v, i) => {
                  const isCopied = copiedKey === `var-${i}`;
                  return (
                    <div
                      key={i}
                      style={{
                        padding: "10px 12px",
                        borderRadius: "8px",
                        background: "var(--color-surface-hover, rgba(255,255,255,0.03))",
                        border: "1px solid var(--color-border)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <code
                          style={{
                            fontSize: "12px",
                            fontFamily: "var(--font-mono, monospace)",
                            fontWeight: 750,
                            color: "var(--color-accent, #38bdf8)",
                          }}
                        >
                          {v.syntax}
                        </code>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(v.syntax, `var-${i}`)}
                          title="Copy syntax"
                          style={{
                            all: "unset",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "3px",
                            color: isCopied ? "#22c55e" : "var(--color-text-muted)",
                            background: isCopied ? "rgba(34, 197, 94, 0.12)" : "var(--color-surface)",
                            border: `1px solid ${isCopied ? "rgba(34, 197, 94, 0.3)" : "var(--color-border)"}`,
                          }}
                        >
                          {isCopied ? <Check size={11} /> : <Copy size={11} />}
                          {isCopied ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                        {v.description}
                      </div>
                      <div
                        style={{
                          fontSize: "10.5px",
                          fontFamily: "monospace",
                          color: "var(--color-text)",
                          opacity: 0.75,
                          background: "rgba(0,0,0,0.2)",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        e.g. {v.output}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* 3. Scripting & Assertions Section */}
          {(activeTab === "all" || activeTab === "scripts") && filteredScripts.length > 0 && (
            <section>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Code2 size={15} style={{ color: "#a855f7" }} />
                  <h3
                    style={{
                      margin: 0,
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "var(--color-text)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Script Runtime & Test Assertions (kb.* / pm.*)
                  </h3>
                </div>
                <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                  Pre-request & Post-response scripts
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {filteredScripts.map((s, i) => {
                  const isCopied = copiedKey === `script-${i}`;
                  return (
                    <div
                      key={i}
                      style={{
                        borderRadius: "8px",
                        background: "var(--color-surface-hover, rgba(255,255,255,0.03))",
                        border: "1px solid var(--color-border)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          padding: "8px 12px",
                          background: "var(--color-surface-elevated, rgba(0,0,0,0.2))",
                          borderBottom: "1px solid var(--color-border)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <div>
                          <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--color-text)" }}>
                            {s.name}
                          </span>
                          <span style={{ fontSize: "11px", color: "var(--color-text-muted)", marginLeft: "8px" }}>
                            {s.description}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(s.code, `script-${i}`)}
                          style={{
                            all: "unset",
                            padding: "3px 8px",
                            borderRadius: "5px",
                            fontSize: "11px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            color: isCopied ? "#22c55e" : "var(--color-text)",
                            background: isCopied ? "rgba(34, 197, 94, 0.12)" : "var(--color-surface)",
                            border: `1px solid ${isCopied ? "rgba(34, 197, 94, 0.3)" : "var(--color-border)"}`,
                          }}
                        >
                          {isCopied ? <Check size={12} /> : <Copy size={12} />}
                          {isCopied ? "Copied" : "Copy Code"}
                        </button>
                      </div>
                      <pre
                        style={{
                          margin: 0,
                          padding: "10px 14px",
                          fontSize: "11.5px",
                          fontFamily: "var(--font-mono, monospace)",
                          color: "#38bdf8",
                          background: "rgba(15, 23, 42, 0.7)",
                          overflowX: "auto",
                          lineHeight: "1.5",
                        }}
                      >
                        <code>{s.code}</code>
                      </pre>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* 4. HTTP Status Codes Section */}
          {(activeTab === "all" || activeTab === "http") && filteredHttp.length > 0 && (
            <section>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Globe2 size={15} style={{ color: "#10b981" }} />
                  <h3
                    style={{
                      margin: 0,
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "var(--color-text)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    HTTP Status Codes Quick Reference
                  </h3>
                </div>
                <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                  Standard RFC semantics
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: "8px",
                }}
              >
                {filteredHttp.map((status, i) => {
                  const is2xx = status.code >= 200 && status.code < 300;
                  const is3xx = status.code >= 300 && status.code < 400;
                  const is4xx = status.code >= 400 && status.code < 500;

                  const color = is2xx
                    ? "#10b981"
                    : is3xx
                    ? "#3b82f6"
                    : is4xx
                    ? "#f59e0b"
                    : "#ef4444";

                  return (
                    <div
                      key={i}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "8px",
                        background: "var(--color-surface-hover, rgba(255,255,255,0.03))",
                        border: "1px solid var(--color-border)",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "12px",
                          fontFamily: "var(--font-mono, monospace)",
                          fontWeight: 800,
                          color: color,
                          background: `${color}18`,
                          border: `1px solid ${color}35`,
                          padding: "2px 6px",
                          borderRadius: "4px",
                          flexShrink: 0,
                        }}
                      >
                        {status.code}
                      </span>
                      <div>
                        <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text)" }}>
                          {status.phrase}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "2px" }}>
                          {status.description}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Empty search state */}
          {filteredHotkeys.length === 0 &&
            filteredVariables.length === 0 &&
            filteredScripts.length === 0 &&
            filteredHttp.length === 0 && (
              <div
                style={{
                  padding: "48px 24px",
                  textAlign: "center",
                  color: "var(--color-text-muted)",
                }}
              >
                <Search size={32} style={{ opacity: 0.3, marginBottom: "12px" }} />
                <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text)" }}>
                  No matches found for "{searchQuery}"
                </div>
                <div style={{ fontSize: "12px", marginTop: "4px" }}>
                  Try searching for keywords like "save", "token", "200", or "guid".
                </div>
              </div>
            )}
        </div>

        {/* Footer Bar */}
        <div
          style={{
            padding: "12px 24px",
            borderTop: "1px solid var(--color-border)",
            background: "var(--color-surface-elevated, rgba(15, 23, 42, 0.6))",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontSize: "11.5px", color: "var(--color-text-muted)" }}>
            Tip: Press <kbd style={{ padding: "1px 5px", borderRadius: "4px", background: "var(--color-surface)", border: "1px solid var(--color-border)", fontSize: "10.5px" }}>{modKey} + /</kbd> anywhere to open this cheatsheet.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              type="button"
              className="secondary-button"
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenDocs) {
                  onOpenDocs();
                } else {
                  openProductDocs();
                }
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--color-accent, #3b82f6)",
                cursor: "pointer",
                background: "rgba(59, 130, 246, 0.12)",
                border: "1px solid rgba(59, 130, 246, 0.3)",
              }}
            >
              <span>{t("nav.docs") || "Full Documentation"}</span>
              <ExternalLink size={13} />
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              style={{
                padding: "6px 14px",
                fontSize: "12px",
                borderRadius: "6px",
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
