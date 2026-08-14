import React, { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Bot, User, Trash2, Loader2, Sparkles, Settings, Square, Copy, Check, ChevronDown, ChevronRight, Zap, AlertTriangle, Eye, EyeOff, Shield, Plus, MessageSquare, History, Edit2, Search, BookOpen, Database, Cpu } from "lucide-react";
import { exportMcpManifest, executeMcpToolCall } from "../services/local-store";
import type { SavedRequest, WorkspaceSummary } from "../types";

// ── Provider Definitions ────────────────────────────────────────────────────
type ProviderId = "ollama" | "lmstudio" | "openai" | "anthropic" | "gemini" | "custom";

interface AIProvider {
  id: ProviderId;
  name: string;
  baseUrl: string;
  isLocal: boolean;
  format: "ollama" | "openai" | "anthropic" | "gemini";
  defaultModels: string[];
  requiresApiKey: boolean;
  apiKeyLabel: string;
  apiKeyPlaceholder: string;
  modelsEndpoint?: string;
}

const PROVIDERS: AIProvider[] = [
  {
    id: "ollama",
    name: "Ollama (Local)",
    baseUrl: "http://localhost:11434",
    isLocal: true,
    format: "ollama",
    defaultModels: ["llama3", "mistral", "codellama", "phi3", "gemma2"],
    requiresApiKey: false,
    apiKeyLabel: "",
    apiKeyPlaceholder: "",
    modelsEndpoint: "/api/tags",
  },
  {
    id: "lmstudio",
    name: "LM Studio (Local)",
    baseUrl: "http://localhost:1234",
    isLocal: true,
    format: "openai",
    defaultModels: ["local-model"],
    requiresApiKey: false,
    apiKeyLabel: "",
    apiKeyPlaceholder: "",
    modelsEndpoint: "/v1/models",
  },
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com",
    isLocal: false,
    format: "openai",
    defaultModels: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
    requiresApiKey: true,
    apiKeyLabel: "OpenAI API Key",
    apiKeyPlaceholder: "sk-...",
    modelsEndpoint: "/v1/models",
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    baseUrl: "https://api.anthropic.com",
    isLocal: false,
    format: "anthropic",
    defaultModels: ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-4-5", "claude-3-5-sonnet-20241022"],
    requiresApiKey: true,
    apiKeyLabel: "Anthropic API Key",
    apiKeyPlaceholder: "sk-ant-...",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com",
    isLocal: false,
    format: "gemini",
    defaultModels: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
    requiresApiKey: true,
    apiKeyLabel: "Google AI API Key",
    apiKeyPlaceholder: "AIza...",
  },
  {
    id: "custom",
    name: "Custom OpenAI-compatible",
    baseUrl: "",
    isLocal: false,
    format: "openai",
    defaultModels: [],
    requiresApiKey: true,
    apiKeyLabel: "API Key (optional)",
    apiKeyPlaceholder: "Bearer token or API key",
    modelsEndpoint: "/v1/models",
  },
];

import type { Message, ChatSession, McpServerConfig } from "../services/ai-chat-store";
import { loadChatSessions, saveChatSessions, loadActiveSessionId, saveActiveSessionId, loadKnowledgeBase, saveKnowledgeBase, loadMcpServers, saveMcpServers } from "../services/ai-chat-store";
export type { Message, ChatSession };

interface AIChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  width?: number;
  draftRequest?: SavedRequest | null;
  workspace?: WorkspaceSummary | null;
  lastResponse?: { status: number; body: string; headers: Record<string, string>; durationMs: number } | null;
  onUpdateRequest?: (updater: (draft: SavedRequest) => SavedRequest) => void;
}

// ── Markdown Renderer ───────────────────────────────────────────────────────
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) { codeLines.push(lines[i]); i++; }
      nodes.push(<CodeBlock key={`cb-${i}`} lang={lang} code={codeLines.join("\n")} />);
      i++;
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const sizes = ["15px", "14px", "13px"];
      nodes.push(<div key={i} style={{ fontWeight: 700, fontSize: sizes[headingMatch[1].length - 1], marginTop: "8px", marginBottom: "2px" }}>{inlineMarkdown(headingMatch[2])}</div>);
      i++; continue;
    }

    if (line.match(/^[-*]\s+/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^[-*]\s+/)) { items.push(lines[i].replace(/^[-*]\s+/, "")); i++; }
      nodes.push(<ul key={`ul-${i}`} style={{ paddingLeft: "16px", margin: "4px 0" }}>{items.map((it, j) => <li key={j} style={{ marginBottom: "2px" }}>{inlineMarkdown(it)}</li>)}</ul>);
      continue;
    }

    if (line.match(/^\d+\.\s+/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s+/)) { items.push(lines[i].replace(/^\d+\.\s+/, "")); i++; }
      nodes.push(<ol key={`ol-${i}`} style={{ paddingLeft: "16px", margin: "4px 0" }}>{items.map((it, j) => <li key={j} style={{ marginBottom: "2px" }}>{inlineMarkdown(it)}</li>)}</ol>);
      continue;
    }

    if (line.match(/^---+$/)) { nodes.push(<hr key={i} style={{ border: "none", borderTop: "1px solid var(--color-border)", margin: "8px 0" }} />); i++; continue; }
    if (line.trim() === "") { nodes.push(<div key={i} style={{ height: "6px" }} />); i++; continue; }

    nodes.push(<div key={i} style={{ marginBottom: "2px" }}>{inlineMarkdown(line)}</div>);
    i++;
  }
  return nodes;
}

function inlineMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*\*.+?\*\*\*|\*\*.+?\*\*|\*.+?\*|`.+?`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("***") && part.endsWith("***")) return <strong key={i}><em>{part.slice(3, -3)}</em></strong>;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i} style={{ backgroundColor: "rgba(0,0,0,0.15)", borderRadius: "3px", padding: "1px 4px", fontFamily: "monospace", fontSize: "12px" }}>{part.slice(1, -1)}</code>;
    return part;
  });
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const displayLang = lang || "code";
  return (
    <div style={{ position: "relative", margin: "8px 0", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--color-border)", backgroundColor: "var(--color-background)" }}>
      <div style={{ padding: "4px 10px", backgroundColor: "rgba(0,0,0,0.25)", fontSize: "11px", color: "var(--color-text-muted)", fontFamily: "monospace", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--color-border)" }}>
        <span style={{ fontWeight: 500, textTransform: "lowercase" }}>{displayLang}</span>
        <button
          onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          style={{ background: "none", border: "none", cursor: "pointer", color: copied ? "var(--color-accent)" : "var(--color-text-muted)", padding: "2px 6px", borderRadius: "4px", display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", fontWeight: 500, transition: "color 0.15s ease" }}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre style={{ margin: 0, padding: "10px 12px", overflowX: "auto", fontSize: "12px", fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-all", color: "var(--color-text)", lineHeight: 1.45 }}><code>{code}</code></pre>
    </div>
  );
}

function ToolMessage({ msg }: { msg: Message }) {
  const [open, setOpen] = useState(false);
  let display = msg.content;
  try { display = JSON.stringify(JSON.parse(msg.content), null, 2); } catch { /* leave as is */ }
  return (
    <div style={{ flexShrink: 0, borderRadius: "6px", border: "1px solid var(--color-border)", overflow: "hidden", fontSize: "11px" }}>
      <button onClick={() => setOpen(!open)} style={{ width: "100%", display: "flex", alignItems: "center", gap: "6px", padding: "6px 10px", background: "var(--color-surface)", border: "none", cursor: "pointer", color: "var(--color-text-muted)", textAlign: "left" }}>
        <Zap size={11} style={{ flexShrink: 0, color: "var(--color-accent)" }} />
        <span style={{ flex: 1, fontWeight: 600, color: "var(--color-text)" }}>Tool: {msg.tool_name || "unknown"}</span>
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      </button>
      {open && <pre style={{ margin: 0, padding: "8px 10px", backgroundColor: "rgba(0,0,0,0.15)", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: "300px", overflowY: "auto", fontFamily: "monospace", color: "var(--color-text-muted)" }}>{display}</pre>}
    </div>
  );
}

// ── API Adapters ────────────────────────────────────────────────────────────
async function callOllama(
  baseUrl: string,
  model: string,
  messages: Message[],
  systemPrompt: string,
  tools: any[] | undefined,
  signal: AbortSignal,
  onChunk: (delta: string) => void
): Promise<{ finalMessage: any }> {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => {
          if (m.role === "tool") {
            const lastUser = messages.slice().reverse().find(msg => msg.role === "user")?.content || "the request";
            return { role: "user", content: `[Tool Result] '${m.tool_name}' returned:\n\n${m.content}\n\nPlease answer: "${lastUser}"` };
          }
          const out: any = { role: m.role, content: m.content || "" };
          if (m.tool_calls) out.tool_calls = m.tool_calls;
          return out;
        })
      ],
      stream: true,
      tools,
    }),
  });

  if (!response.ok) {
    const txt = await response.text();
    let msg = response.statusText;
    try { const p = JSON.parse(txt); if (p.error) msg = p.error; } catch { if (txt) msg = txt; }
    if (tools && msg.toLowerCase().includes("does not support tools")) {
      return callOllama(baseUrl, model, messages, systemPrompt, undefined, signal, onChunk);
    }
    throw new Error(`Ollama: ${msg}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let finalMessage: any = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split("\n").filter(Boolean)) {
      try {
        const json = JSON.parse(line);
        if (json.message?.content) onChunk(json.message.content);
        if (json.message) finalMessage = json.message;
      } catch { /* partial */ }
    }
  }

  return { finalMessage };
}

async function callOpenAI(
  baseUrl: string,
  model: string,
  messages: Message[],
  systemPrompt: string,
  apiKey: string,
  signal: AbortSignal,
  onChunk: (delta: string) => void
): Promise<{ finalMessage: any }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.filter(m => m.role !== "tool" && m.role !== "system").map(m => ({ role: m.role, content: m.content || "" }))
      ],
      stream: true,
    }),
  });

  if (!response.ok) {
    const txt = await response.text();
    let msg = response.statusText;
    try { const p = JSON.parse(txt); if (p.error?.message) msg = p.error.message; } catch { if (txt) msg = txt; }
    throw new Error(`OpenAI: ${msg}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let fullContent = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split("\n").filter(l => l.startsWith("data: "))) {
      const data = line.slice(6);
      if (data === "[DONE]") continue;
      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) { onChunk(delta); fullContent += delta; }
      } catch { /* partial */ }
    }
  }

  return { finalMessage: { role: "assistant", content: fullContent } };
}

async function callAnthropic(
  baseUrl: string,
  model: string,
  messages: Message[],
  systemPrompt: string,
  apiKey: string,
  signal: AbortSignal,
  onChunk: (delta: string) => void
): Promise<{ finalMessage: any }> {
  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    signal,
    body: JSON.stringify({
      model,
      system: systemPrompt,
      max_tokens: 4096,
      messages: messages
        .filter(m => m.role === "user" || m.role === "assistant")
        .map(m => ({ role: m.role, content: m.content || "" })),
      stream: true,
    }),
  });

  if (!response.ok) {
    const txt = await response.text();
    let msg = response.statusText;
    try { const p = JSON.parse(txt); if (p.error?.message) msg = p.error.message; } catch { if (txt) msg = txt; }
    throw new Error(`Anthropic: ${msg}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let fullContent = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split("\n").filter(l => l.startsWith("data: "))) {
      try {
        const json = JSON.parse(line.slice(6));
        const delta = json.delta?.text;
        if (delta) { onChunk(delta); fullContent += delta; }
      } catch { /* partial */ }
    }
  }

  return { finalMessage: { role: "assistant", content: fullContent } };
}

async function callGemini(
  baseUrl: string,
  model: string,
  messages: Message[],
  systemPrompt: string,
  apiKey: string,
  signal: AbortSignal,
  onChunk: (delta: string) => void
): Promise<{ finalMessage: any }> {
  const geminiMessages = messages
    .filter(m => m.role === "user" || m.role === "assistant")
    .map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content || "" }] }));

  const response = await fetch(`${baseUrl}/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: geminiMessages,
    }),
  });

  if (!response.ok) {
    const txt = await response.text();
    let msg = response.statusText;
    try { const p = JSON.parse(txt); if (p.error?.message) msg = p.error.message; } catch { if (txt) msg = txt; }
    throw new Error(`Gemini: ${msg}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let fullContent = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split("\n").filter(l => l.startsWith("data: "))) {
      try {
        const json = JSON.parse(line.slice(6));
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) { onChunk(text); fullContent += text; }
      } catch { /* partial */ }
    }
  }

  return { finalMessage: { role: "assistant", content: fullContent } };
}

// ── RAG: Workspace Request Retrieval ────────────────────────────────────────
function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9/._-]/g, ' ').split(/\s+/).filter(Boolean);
}

function scoreRequest(req: { name: string; method: string; url: string }, queryTokens: string[]): number {
  const target = tokenize(`${req.name} ${req.method} ${req.url}`);
  let score = 0;
  for (const qt of queryTokens) {
    if (target.some(t => t.includes(qt) || qt.includes(t))) score++;
  }
  return score;
}

function retrieveRelevantRequests(
  workspace: WorkspaceSummary | null | undefined,
  query: string,
  topN = 5
): Array<{ name: string; method: string; url: string; folder?: string }> {
  if (!workspace?.requests?.length) return [];
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const folderMap = new Map<string, string>(workspace.folders.map(f => [f.id, f.name]));

  return workspace.requests
    .map(r => ({ r, score: scoreRequest(r, tokens) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(({ r }) => ({
      name: r.name,
      method: r.method,
      url: r.url,
      folder: folderMap.get(r.folderId),
    }));
}

// ── Main Component ─────────────────────────────────────────────────────────
const STORAGE_KEY = "kobeanrest_ai_settings";

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

function saveSettings(data: any) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

export function AIChatSidebar({ isOpen, onClose, width = 360, draftRequest, workspace, lastResponse, onUpdateRequest }: AIChatSidebarProps) {
  const saved = loadSettings();

  const [sessions, setSessions] = useState<ChatSession[]>(() => loadChatSessions());
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const savedId = loadActiveSessionId();
    const loaded = loadChatSessions();
    if (savedId && loaded.some(s => s.id === savedId)) return savedId;
    return loaded[0]?.id || "session_default";
  });
  const [showSessionsDrawer, setShowSessionsDrawer] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [sessionFilter, setSessionFilter] = useState("");

  const activeSessionIdRef = useRef(activeSessionId);
  useEffect(() => { activeSessionIdRef.current = activeSessionId; }, [activeSessionId]);

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const messages = activeSession?.messages || [];

  const updateMessages = useCallback((updater: Message[] | ((prev: Message[]) => Message[])) => {
    setSessions(prevSessions => {
      const targetId = activeSessionIdRef.current;
      const nextSessions = prevSessions.map(session => {
        if (session.id !== targetId) return session;
        const newMsgs = typeof updater === "function" ? updater(session.messages) : updater;
        let title = session.title;
        if (title === "New Chat" && newMsgs.length > 0) {
          const firstUserMsg = newMsgs.find(m => m.role === "user")?.content;
          if (firstUserMsg) {
            const clean = firstUserMsg.trim().replace(/\n/g, " ");
            title = clean.slice(0, 28) + (clean.length > 28 ? "…" : "");
          }
        }
        return {
          ...session,
          title,
          messages: newMsgs,
          updatedAt: Date.now(),
        };
      });
      saveChatSessions(nextSessions);
      return nextSessions;
    });
  }, []);

  const setMessages = updateMessages;

  const getClampedWidth = useCallback((targetWidth: number): number => {
    const windowW = typeof window !== "undefined" ? window.innerWidth : 1200;
    const minW = Math.max(280, Math.floor(windowW * 0.28));
    const maxW = Math.max(360, Math.floor(windowW * 0.48));
    return Math.min(Math.max(targetWidth, minW), maxW);
  }, []);

  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const savedWidth = localStorage.getItem("kobeanrest_ai_chat_width");
      if (savedWidth) {
        const parsed = parseInt(savedWidth, 10);
        if (!isNaN(parsed)) {
          const windowW = typeof window !== "undefined" ? window.innerWidth : 1200;
          const minW = Math.max(280, Math.floor(windowW * 0.28));
          const maxW = Math.max(360, Math.floor(windowW * 0.48));
          return Math.min(Math.max(parsed, minW), maxW);
        }
      }
    } catch { /* ignore */ }
    const windowW = typeof window !== "undefined" ? window.innerWidth : 1200;
    return Math.min(420, Math.max(320, Math.floor(windowW * 0.35)));
  });
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    try { localStorage.setItem("kobeanrest_ai_chat_width", sidebarWidth.toString()); } catch { /* ignore */ }
  }, [sidebarWidth]);

  // Auto reset to default width every time AI Chat is opened/toggled
  useEffect(() => {
    if (isOpen) {
      const windowW = typeof window !== "undefined" ? window.innerWidth : 1200;
      const defaultW = Math.min(380, Math.max(320, Math.floor(windowW * 0.32)));
      setSidebarWidth(defaultW);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleWindowResize = () => {
      setSidebarWidth(prev => getClampedWidth(prev));
    };
    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, [getClampedWidth]);

  const handleMouseDownResizer = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      const targetW = startWidth + delta;
      const windowW = window.innerWidth;
      const minW = Math.max(280, Math.floor(windowW * 0.28));
      const maxW = Math.max(360, Math.floor(windowW * 0.48));
      const clamped = Math.min(Math.max(targetW, minW), maxW);
      setSidebarWidth(clamped);
    };

    const onMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const handleDoubleClickResizer = () => {
    const windowW = typeof window !== "undefined" ? window.innerWidth : 1200;
    setSidebarWidth(Math.floor(windowW * 0.35));
  };

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [providerId, setProviderId] = useState<ProviderId>(saved?.providerId ?? "ollama");
  const [customBaseUrl, setCustomBaseUrl] = useState(saved?.customBaseUrl ?? "");
  const [apiKey, setApiKey] = useState(""); // Never persisted
  const [showApiKey, setShowApiKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState(saved?.selectedModel ?? "llama3");
  const [models, setModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [mcpTools, setMcpTools] = useState<any[]>([]);
  const [thirdPartyServers, setThirdPartyServers] = useState<McpServerConfig[]>(() => loadMcpServers());
  const [thirdPartyTools, setThirdPartyTools] = useState<any[]>([]);
  const [showMcpServers, setShowMcpServers] = useState(false);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [knowledgeBase, setKnowledgeBase] = useState<string>(() => loadKnowledgeBase());
  const [showKnowledgeBase, setShowKnowledgeBase] = useState(false);
  const [kbDraft, setKbDraft] = useState<string>("");
  const [contextBadges, setContextBadges] = useState<string[]>([]);

  // Built-in workspace tools callable by the AI
  const builtinTools: any[] = workspace ? [
    {
      type: "function",
      function: {
        name: "search_workspace_requests",
        description: "Search the workspace for API requests by name, method, or URL keyword. Returns up to 10 matching requests.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search keyword (endpoint name, HTTP method, URL path fragment)" }
          },
          required: ["query"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "get_environment_variables",
        description: "List the active environment variables (non-secret) available in the workspace.",
        parameters: { type: "object", properties: {} }
      }
    },
    {
      type: "function",
      function: {
        name: "get_request_details",
        description: "Get full details of a specific saved request by name.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "The exact name of the saved request" }
          },
          required: ["name"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "get_current_request",
        description: "Get the full details of the currently active draft request that the user is looking at.",
        parameters: { type: "object", properties: {} }
      }
    },
    {
      type: "function",
      function: {
        name: "update_current_request",
        description: "Update the currently active draft request. You can change url, method, authMode, authConfig, headers, queryParams, bodyMimeType, or body. Only provide fields you want to update.",
        parameters: {
          type: "object",
          properties: {
            url: { type: "string" },
            method: { type: "string" },
            authMode: { type: "string" },
            authConfig: { type: "object", additionalProperties: true },
            headers: { 
              type: "array", 
              items: { type: "object", properties: { key: { type: "string" }, value: { type: "string" }, enabled: { type: "boolean" } } }
            },
            queryParams: {
              type: "array",
              items: { type: "object", properties: { key: { type: "string" }, value: { type: "string" }, enabled: { type: "boolean" } } }
            },
            body: { type: "string" },
            bodyMimeType: { type: "string" },
            bodyForm: {
              type: "array",
              items: { type: "object", properties: { key: { type: "string" }, value: { type: "string" }, enabled: { type: "boolean" } } }
            }
          }
        }
      }
    }
  ] : [];

  const isCurrentSessionEmpty = messages.length === 0;

  const createNewSession = useCallback(() => {
    if (messages.length === 0) {
      textareaRef.current?.focus();
      setShowSessionsDrawer(false);
      return;
    }

    const newSession: ChatSession = {
      id: "session_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      title: "New Chat",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      providerId,
      selectedModel,
    };
    setSessions(prev => {
      // Prune inactive 0-message sessions
      const cleaned = prev.filter(s => s.messages && s.messages.length > 0);
      const next = [newSession, ...cleaned];
      saveChatSessions(next);
      return next;
    });
    setActiveSessionId(newSession.id);
    saveActiveSessionId(newSession.id);
    setError(null);
    setShowSessionsDrawer(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, [messages.length, providerId, selectedModel]);

  const switchSession = useCallback((id: string) => {
    setSessions(prev => {
      // Keep target session and non-empty sessions
      const cleaned = prev.filter(s => s.id === id || (s.messages && s.messages.length > 0));
      saveChatSessions(cleaned);
      return cleaned;
    });
    setActiveSessionId(id);
    saveActiveSessionId(id);
    setError(null);
    setShowSessionsDrawer(false);
  }, []);

  const renameSession = useCallback((id: string, newTitle: string) => {
    const trimmed = newTitle.trim() || "Untitled Chat";
    setSessions(prev => {
      const next = prev.map(s => s.id === id ? { ...s, title: trimmed, updatedAt: Date.now() } : s);
      saveChatSessions(next);
      return next;
    });
    setEditingSessionId(null);
  }, []);

  const deleteSession = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSessions(prev => {
      const remaining = prev.filter(s => s.id !== id);
      if (remaining.length === 0) {
        const fresh: ChatSession = {
          id: "session_" + Date.now(),
          title: "New Chat",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: [],
        };
        saveChatSessions([fresh]);
        setActiveSessionId(fresh.id);
        saveActiveSessionId(fresh.id);
        return [fresh];
      }
      saveChatSessions(remaining);
      if (activeSessionIdRef.current === id) {
        const nextActive = remaining[0].id;
        setActiveSessionId(nextActive);
        saveActiveSessionId(nextActive);
      }
      return remaining;
    });
  }, []);

  const filteredSessions = sessions.filter(s =>
    !sessionFilter.trim() || s.title.toLowerCase().includes(sessionFilter.toLowerCase())
  );

  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const provider = PROVIDERS.find(p => p.id === providerId) ?? PROVIDERS[0];
  const effectiveBaseUrl = providerId === "custom" ? customBaseUrl : provider.baseUrl;

  // Persist settings (except API key)
  useEffect(() => {
    saveSettings({ providerId, customBaseUrl, selectedModel });
  }, [providerId, customBaseUrl, selectedModel]);

  useEffect(() => {
    exportMcpManifest().then((result) => {
      try {
        const manifest = JSON.parse(result.manifest_json);
        if (manifest?.tools) setMcpTools(manifest.tools);
      } catch { /* ignore */ }
    });
  }, []);

  const fetchModels = useCallback(async () => {
    if (!provider.modelsEndpoint) {
      setModels(provider.defaultModels);
      if (!provider.defaultModels.includes(selectedModel)) setSelectedModel(provider.defaultModels[0] ?? "");
      return;
    }

    setIsFetchingModels(true);
    const url = effectiveBaseUrl || provider.baseUrl;
    const headers: Record<string, string> = {};
    if (apiKey && provider.requiresApiKey) headers["Authorization"] = `Bearer ${apiKey}`;
    if (provider.id === "anthropic") headers["x-api-key"] = apiKey;

    try {
      const res = await fetch(`${url}${provider.modelsEndpoint}`, { headers });
      const data = await res.json();

      let names: string[] = [];
      if (provider.id === "ollama") names = (data.models ?? []).map((m: any) => m.name);
      else names = (data.data ?? []).map((m: any) => m.id).filter((id: string) => !id.includes("embedding") && !id.includes("whisper") && !id.includes("tts") && !id.includes("dall-e"));

      if (names.length > 0) {
        setModels(names);
        if (!names.includes(selectedModel)) setSelectedModel(names[0]);
      } else {
        setModels(provider.defaultModels);
      }
    } catch {
      setModels(provider.defaultModels);
    } finally {
      setIsFetchingModels(false);
    }
  }, [provider, effectiveBaseUrl, apiKey, selectedModel]);

  const fetchThirdPartyTools = useCallback(async () => {
    const enabledServers = thirdPartyServers.filter(s => s.enabled && s.url.trim());
    if (enabledServers.length === 0) { setThirdPartyTools([]); return; }
    const allTools: any[] = [];
    for (const server of enabledServers) {
      try {
        const res = await fetch(`${server.url.replace(/\/$/, '')}/tools/list`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const data = await res.json();
          const tools = (data.tools || []).map((t: any) => ({ ...t, _serverUrl: server.url, _serverName: server.name }));
          allTools.push(...tools);
        }
      } catch { /* server offline, skip */ }
    }
    setThirdPartyTools(allTools);
  }, [thirdPartyServers]);

  useEffect(() => {
    fetchThirdPartyTools();
  }, [thirdPartyServers]);

  useEffect(() => {
    if (isOpen) fetchModels();
  }, [isOpen, providerId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [input]);

  const buildSystemPrompt = useCallback((userQuery?: string): string => {
    let prompt = `You are an expert AI assistant embedded in KobeanREST, a professional REST API client application.

Your role is to help developers work efficiently with HTTP APIs. You have deep expertise in:
- HTTP methods, status codes, headers, authentication (OAuth2, JWT, API keys, Bearer tokens)
- Request debugging, response analysis, and performance troubleshooting
- JSON, XML, GraphQL, gRPC, and other API formats
- Pre/post request scripting in JavaScript (for KobeanREST's script runner)
- API testing strategies, load testing, and mock server configuration
- Security best practices for APIs

Format all responses with markdown. Use fenced code blocks with language tags for code and JSON. Be concise and actionable.

IMPORTANT: When the user asks you to modify, update, rename, or create anything in the workspace, use the available tools directly — do NOT ask the user for IDs. All IDs are already provided below in the workspace index.`;

    // Active request context (with ID so AI can modify it directly)
    if (draftRequest) {
      prompt += `\n\n## Currently Open Request\nID: ${draftRequest.id}\nName: ${draftRequest.name}\nMethod: ${draftRequest.method}\nURL: ${draftRequest.url || "(not set)"}\nAuth: ${draftRequest.authMode || "none"}`;
      if (draftRequest.headers?.filter(h => h.enabled && h.key).length > 0) {
        const hdrs = draftRequest.headers.filter(h => h.enabled && h.key)
          .map(h => `  ${h.key}: ${/auth|secret|token|key/i.test(h.key) ? "[REDACTED]" : h.value}`)
          .join("\n");
        prompt += `\nHeaders:\n${hdrs}`;
      }
      if (draftRequest.body && draftRequest.bodyMimeType) {
        const preview = draftRequest.body.length > 800 ? draftRequest.body.slice(0, 800) + "…" : draftRequest.body;
        prompt += `\nContent-Type: ${draftRequest.bodyMimeType}\nBody (preview):\n${preview}`;
      }
      if (draftRequest.queryParams?.filter(p => p.enabled && p.key).length > 0) {
        const qp = draftRequest.queryParams.filter(p => p.enabled && p.key).map(p => `  ${p.key}=${p.value}`).join("\n");
        prompt += `\nQuery Params:\n${qp}`;
      }
    }

    // Last HTTP response context
    if (lastResponse) {
      prompt += `\n\n## Last HTTP Response\nStatus: ${lastResponse.status}\nDuration: ${lastResponse.durationMs}ms`;
      const contentType = lastResponse.headers["content-type"] || lastResponse.headers["Content-Type"] || "";
      if (lastResponse.body) {
        const preview = lastResponse.body.length > 1200 ? lastResponse.body.slice(0, 1200) + "…" : lastResponse.body;
        prompt += `\nContent-Type: ${contentType}\nBody (preview):\n${preview}`;
      }
    }

    // Full workspace index with IDs — allows AI to call write tools without asking for IDs
    if (workspace) {
      prompt += `\n\n## Workspace: ${workspace.name || "Unnamed"}\nID: ${workspace.id}\nActive Environment: ${workspace.activeEnvironment || "none"}`;

      // Collections index
      if (workspace.collections?.length) {
        prompt += `\n\n### Collections`;
        for (const c of workspace.collections) {
          prompt += `\n- "${c.name}" | id: ${c.id}${c.authMode && c.authMode !== "none" ? ` | auth: ${c.authMode}` : ""}`;
        }
      }

      // Folders index (grouped by collection)
      if (workspace.folders?.length) {
        prompt += `\n\n### Folders`;
        const colMap = new Map((workspace.collections || []).map(c => [c.id, c.name]));
        for (const f of workspace.folders) {
          const colName = f.collectionId ? colMap.get(f.collectionId) : undefined;
          prompt += `\n- "${f.name}" | id: ${f.id}${colName ? ` | collection: "${colName}"` : ""}${f.parentId ? ` | parent_folder_id: ${f.parentId}` : ""}`;
        }
      }

      // Full requests index with IDs
      if (workspace.requests?.length) {
        // Build folder name map
        const folderMap = new Map((workspace.folders || []).map(f => [f.id, f.name]));
        prompt += `\n\n### All Requests (${workspace.requests.length} total)`;

        // If query given, show relevant first then rest; otherwise show all
        const relevant = userQuery ? retrieveRelevantRequests(workspace, userQuery, 8).map(r => r.name) : [];
        const sorted = userQuery && relevant.length > 0
          ? [...workspace.requests.filter(r => relevant.includes(r.name)), ...workspace.requests.filter(r => !relevant.includes(r.name))]
          : workspace.requests;

        for (const r of sorted) {
          const folder = folderMap.get(r.folderId);
          const isRelevant = relevant.includes(r.name);
          prompt += `\n- ${isRelevant ? "★ " : ""}[${r.method}] "${r.name}" | id: ${r.id} | url: ${r.url || "(empty)"}${folder ? ` | folder: "${folder}"` : ""}`;
        }
      }

      // Environments index
      if (workspace.environments?.length) {
        prompt += `\n\n### Environments`;
        for (const env of workspace.environments) {
          const isActive = env.name === workspace.activeEnvironment;
          const nonSecretVars = env.variables?.filter(v => !v.secret && !v.secretRef) || [];
          prompt += `\n- "${env.name}"${isActive ? " (active)" : ""}`;
          if (nonSecretVars.length > 0) {
            prompt += `: ${nonSecretVars.slice(0, 8).map(v => `${v.key}=${v.value}`).join(", ")}${nonSecretVars.length > 8 ? `, …+${nonSecretVars.length - 8} more` : ""}`;
          }
        }
      }
    }

    // Knowledge base notes
    const kb = loadKnowledgeBase();
    if (kb.trim()) {
      prompt += `\n\n## Knowledge Base (custom notes)\n${kb.trim()}`;
    }

    // Tool instructions — tell the AI what it can do and that it already has all IDs
    const allToolNames = [
      ...builtinTools.map(t => t.function.name),
      "update_request", "save_request_script", "set_environment_variable",
      "create_new_request", "rename_folder", "rename_collection", "get_scripts",
    ];
    if (allToolNames.length > 0) {
      prompt += `\n\n## Available Tools\nYou have access to the following tools. All entity IDs are listed above — use them directly:\n${allToolNames.map(n => `- ${n}`).join("\n")}\n\nWhen the user says "modify this request", "update the URL", "add a script", etc. — use the ID from the workspace index above. Never say "please provide the ID". If the user asks to modify the currently open request, or refers to "this request", you can use \`get_current_request\` and \`update_current_request\` without needing an ID.`;
    }

    return prompt;
  }, [draftRequest, workspace, lastResponse, knowledgeBase, builtinTools]);


  const stop = () => { abortRef.current?.abort(); abortRef.current = null; setIsLoading(false); };

  const executeBuiltinTool = useCallback((name: string, args: any): string => {
    if (name === "search_workspace_requests") {
      const results = retrieveRelevantRequests(workspace, args.query || "", 10);
      if (results.length === 0) return JSON.stringify({ results: [], message: "No matching requests found." });
      return JSON.stringify({ results });
    }
    if (name === "get_environment_variables") {
      const env = workspace?.environments?.find(e => e.name === workspace.activeEnvironment);
      const vars = (env?.variables || []).filter(v => !v.secret && !v.secretRef).map(v => ({ key: v.key, value: v.value }));
      return JSON.stringify({ environment: workspace?.activeEnvironment, variables: vars });
    }
    if (name === "get_request_details") {
      const req = workspace?.requests?.find(r => r.name === args.name);
      if (!req) return JSON.stringify({ error: `Request '${args.name}' not found.` });
      const folder = workspace?.folders?.find(f => f.id === req.folderId);
      return JSON.stringify({
        name: req.name, method: req.method, url: req.url,
        folder: folder?.name, authMode: req.authMode,
        headers: req.headers?.filter(h => h.enabled && h.key && !/auth|secret|token|key/i.test(h.key)),
        queryParams: req.queryParams?.filter(p => p.enabled && p.key),
        bodyMimeType: req.bodyMimeType,
        body: req.body?.slice(0, 1000)
      });
    }
    if (name === "get_current_request") {
      if (!draftRequest) return JSON.stringify({ error: "No active draft request is currently open." });
      return JSON.stringify({
        name: draftRequest.name,
        method: draftRequest.method,
        url: draftRequest.url,
        authMode: draftRequest.authMode,
        authConfig: draftRequest.authConfig,
        headers: draftRequest.headers,
        queryParams: draftRequest.queryParams,
        bodyMimeType: draftRequest.bodyMimeType,
        body: draftRequest.body,
        bodyForm: draftRequest.bodyForm
      });
    }
    if (name === "update_current_request") {
      if (!draftRequest) return JSON.stringify({ error: "No active draft request is currently open." });
      if (!onUpdateRequest) return JSON.stringify({ error: "onUpdateRequest handler is not provided." });

      onUpdateRequest((prev) => {
        const next = { ...prev };
        if (args.url !== undefined) next.url = args.url;
        if (args.method !== undefined) next.method = args.method as any;
        if (args.authMode !== undefined) next.authMode = args.authMode as any;
        if (args.authConfig !== undefined) next.authConfig = { ...next.authConfig, ...args.authConfig };
        if (args.headers !== undefined) next.headers = args.headers;
        if (args.queryParams !== undefined) next.queryParams = args.queryParams;
        if (args.body !== undefined) next.body = args.body;
        if (args.bodyMimeType !== undefined) next.bodyMimeType = args.bodyMimeType;
        if (args.bodyForm !== undefined) next.bodyForm = args.bodyForm;
        return next;
      });
      return JSON.stringify({ success: true, message: "Draft request updated successfully." });
    }
    return JSON.stringify({ error: `Unknown tool: ${name}` });
  }, [workspace, draftRequest, onUpdateRequest]);

  const handleSubmit = async (e?: React.FormEvent, overrideText?: string) => {
    if (e) e.preventDefault();
    const textToSend = (overrideText || input).trim();
    if (!textToSend || isLoading) return;

    if (provider.requiresApiKey && !apiKey.trim()) {
      setApiKeyMissing(true);
      setShowSettings(true);
      return;
    }
    setApiKeyMissing(false);

    const userMessage: Message = { role: "user", content: textToSend };
    const history = [...messages, userMessage];
    setMessages(history);
    setInput("");
    setIsLoading(true);
    setError(null);
    await processChat(history, textToSend);
  };

  const processChat = async (currentMessages: Message[], userQuery?: string, isToolContinuation = false, fallbackSummary = "") => {
    try {
      const controller = new AbortController();
      abortRef.current = controller;
      const systemPrompt = buildSystemPrompt(userQuery);

      // Add streaming placeholder (skip on tool continuations — content may be empty)
      if (!isToolContinuation) {
        setMessages(prev => [...prev, { role: "assistant", content: "", isStreaming: true }]);
      } else {
        // For tool continuations, add placeholder but track it may be empty
        setMessages(prev => [...prev, { role: "assistant", content: "", isStreaming: true }]);
      }

      const allTools = [
        ...(mcpTools.length > 0 ? mcpTools.map(t => ({
          type: "function",
          function: { name: t.name, description: t.description, parameters: t.inputSchema }
        })) : []),
        ...builtinTools,
        ...thirdPartyTools.map(t => ({
          type: "function",
          function: { name: t.name, description: t.description || "", parameters: t.inputSchema || { type: "object", properties: {} } }
        }))
      ];
      const ollamaTools = allTools.length > 0 ? allTools : undefined;

      let finalMessage: any;

      const onChunk = (delta: string) => {
        setMessages(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant") next[next.length - 1] = { ...last, content: last.content + delta };
          return next;
        });
      };

      if (provider.format === "ollama") {
        ({ finalMessage } = await callOllama(effectiveBaseUrl, selectedModel, currentMessages, systemPrompt, ollamaTools, controller.signal, onChunk));
      } else if (provider.format === "anthropic") {
        ({ finalMessage } = await callAnthropic(effectiveBaseUrl, selectedModel, currentMessages, systemPrompt, apiKey, controller.signal, onChunk));
      } else if (provider.format === "gemini") {
        ({ finalMessage } = await callGemini(effectiveBaseUrl, selectedModel, currentMessages, systemPrompt, apiKey, controller.signal, onChunk));
      } else {
        ({ finalMessage } = await callOpenAI(effectiveBaseUrl, selectedModel, currentMessages, systemPrompt, apiKey, controller.signal, onChunk));
      }

      // Mark streaming done — use fallback summary if model returned empty (common after write tool calls)
      setMessages(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant") {
          const hasContent = last.content.trim().length > 0;
          const hasToolCalls = (finalMessage?.tool_calls?.length ?? 0) > 0;
          if (!hasContent && !hasToolCalls && isToolContinuation) {
            if (fallbackSummary) {
              // Fill with the tool result summary so user sees what happened
              next[next.length - 1] = { ...last, isStreaming: false, content: fallbackSummary };
            } else {
              // Nothing to show — remove the empty bubble
              return next.slice(0, -1);
            }
            return next;
          }
          next[next.length - 1] = { ...last, isStreaming: false, tool_calls: finalMessage?.tool_calls };
        }
        return next;
      });


      // Handle tool calls (Ollama only for now)
      if (finalMessage?.tool_calls?.length > 0) {
        const snapshot = await new Promise<Message[]>(res => setMessages(prev => { res(prev); return prev; }));
        const toolMessages: Message[] = [];
        for (const call of finalMessage.tool_calls) {
          try {
            const isBuiltin = builtinTools.some(t => t.function.name === call.function.name);
            const thirdPartyTool = thirdPartyTools.find(t => t.name === call.function.name);
            let result: string;
            if (isBuiltin) {
              result = executeBuiltinTool(call.function.name, call.function.arguments || {});
            } else if (thirdPartyTool) {
              // Call third-party MCP server
              const serverUrl = thirdPartyTool._serverUrl;
              const tRes = await fetch(`${serverUrl.replace(/\/$/, '')}/tools/call`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: call.function.name, arguments: call.function.arguments || {} }),
                signal: AbortSignal.timeout(30000),
              });
              const tData = await tRes.json();
              result = typeof tData === 'string' ? tData : JSON.stringify(tData);
            } else {
              const raw = await executeMcpToolCall(call.function.name, JSON.stringify(call.function.arguments));
              result = typeof raw === "string" ? raw : JSON.stringify(raw);
            }
            toolMessages.push({ role: "tool", content: result, tool_name: call.function.name });
          } catch (err: any) {
            toolMessages.push({ role: "tool", content: JSON.stringify({ error: err.message }), tool_name: call.function.name });
          }
        }
        const next = [...snapshot, ...toolMessages];
        setMessages(next);

        // Build a synthetic fallback summary from tool results in case model returns empty
        const writeToolNames = ["update_request","save_request_script","set_environment_variable","create_new_request","rename_folder","rename_collection"];
        const writeCalls = finalMessage.tool_calls.filter((tc: any) => writeToolNames.includes(tc.function?.name));
        let fallbackSummary = "";
        if (writeCalls.length > 0) {
          const lines = toolMessages
            .filter(tm => writeCalls.some((tc: any) => tc.function?.name === tm.tool_name))
            .map(tm => {
              try {
                const r = JSON.parse(tm.content);
                if (r.status === "success") return `✅ **${tm.tool_name}**: ${r.message || "Done"}`;
                if (r.error) return `❌ **${tm.tool_name}**: ${r.error}`;
              } catch { /* ignore */ }
              return `✅ **${tm.tool_name}** executed`;
            });
          if (lines.length > 0) fallbackSummary = lines.join("\n");
        }

        await processChat(next, userQuery, true /* isToolContinuation */, fallbackSummary);

      } else {
        setIsLoading(false);
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      setError(err.message || "Request failed");
      setIsLoading(false);
      // Remove empty streaming placeholder on error
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last.content === "") return prev.slice(0, -1);
        return prev;
      });
    }
  };

  const clearChat = () => { setMessages([]); setError(null); };
  const hasContext = !!draftRequest?.url || !!draftRequest?.method;

  if (!isOpen) return null;

  return (
    <div
      className="ai-chat-sidebar"
      style={{
        width: sidebarWidth,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--color-sidebar)",
        borderLeft: "1px solid var(--color-border)",
        height: "100%",
        flexShrink: 0,
        zIndex: 10,
        userSelect: isResizing ? "none" : "auto",
      }}
    >
      {/* ── Left Resize Drag Handle ──────────────────────────────── */}
      <div
        onMouseDown={handleMouseDownResizer}
        onDoubleClick={handleDoubleClickResizer}
        title="Drag to resize (Double-click to reset width)"
        style={{
          position: "absolute",
          left: "-3px",
          top: 0,
          bottom: 0,
          width: "7px",
          cursor: "col-resize",
          zIndex: 30,
          backgroundColor: isResizing ? "var(--color-accent)" : "transparent",
          transition: "background-color 0.15s ease",
        }}
        className="ai-chat-resize-handle"
      />

      {/* ── Header ────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "10px 12px", borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-surface)", flexShrink: 0 }}>
        {/* Row 1: Title & Top Action Controls */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0, overflow: "hidden" }}>
            <Sparkles size={15} style={{ color: "var(--color-accent)", flexShrink: 0 }} />
            <span style={{ fontWeight: 600, fontSize: "13px", color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              AI Assistant
            </span>
            {hasContext && (
              <span title="Active API Request context loaded" style={{ fontSize: "10px", padding: "1px 5px", borderRadius: "8px", backgroundColor: "rgba(99,102,241,0.15)", color: "var(--color-accent)", fontWeight: 600, flexShrink: 0 }}>
                Context ✓
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "2px", flexShrink: 0 }}>
            <button
              onClick={() => setShowSessionsDrawer(!showSessionsDrawer)}
              title="Chat History & Sessions"
              style={{ padding: "4px 5px", background: showSessionsDrawer ? "var(--color-surface-active)" : "none", border: "none", cursor: "pointer", color: showSessionsDrawer ? "var(--color-text-active)" : "var(--color-text-muted)", borderRadius: "4px" }}
            >
              <History size={13} />
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              title="Settings"
              style={{ padding: "4px 5px", background: showSettings ? "var(--color-surface-active)" : "none", border: "none", cursor: "pointer", color: showSettings ? "var(--color-text-active)" : "var(--color-text-muted)", borderRadius: "4px" }}
            >
              <Settings size={13} />
            </button>
            <button
              onClick={clearChat}
              title="Clear Current Chat"
              style={{ padding: "4px 5px", background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", borderRadius: "4px" }}
            >
              <Trash2 size={13} />
            </button>
            <button
              onClick={onClose}
              title="Close Sidebar"
              style={{ padding: "4px 5px", background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", borderRadius: "4px" }}
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Row 2: Provider Select, Model Select, Refresh & New Chat */}
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          <select
            value={providerId}
            onChange={(e) => { setProviderId(e.target.value as ProviderId); setModels([]); setSelectedModel(""); setError(null); }}
            style={{ fontSize: "11px", padding: "4px 4px", borderRadius: "5px", backgroundColor: "var(--color-background)", color: "var(--color-text)", border: "1px solid var(--color-border)", outline: "none", cursor: "pointer", maxWidth: "98px", flexShrink: 0 }}
          >
            {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={isFetchingModels}
            style={{ flex: 1, fontSize: "11px", padding: "4px 4px", borderRadius: "5px", backgroundColor: "var(--color-background)", color: "var(--color-text)", border: "1px solid var(--color-border)", outline: "none", cursor: "pointer", minWidth: 0 }}
          >
            {models.length === 0
              ? <option value={selectedModel}>{isFetchingModels ? "Loading…" : (selectedModel || "Select model")}</option>
              : models.map(m => <option key={m} value={m}>{m}</option>)
            }
          </select>

          <button onClick={fetchModels} disabled={isFetchingModels} title="Refresh models" style={{ width: "26px", height: "26px", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-background)", border: "1px solid var(--color-border)", borderRadius: "5px", cursor: "pointer", color: "var(--color-text-muted)", fontSize: "11px", flexShrink: 0 }}>
            {isFetchingModels ? <Loader2 size={11} className="animate-spin" /> : "↻"}
          </button>

          <button
            onClick={createNewSession}
            disabled={isCurrentSessionEmpty}
            title={isCurrentSessionEmpty ? "Current chat is empty" : "New Chat"}
            style={{ width: "26px", height: "26px", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: isCurrentSessionEmpty ? "var(--color-surface)" : "var(--color-accent)", color: isCurrentSessionEmpty ? "var(--color-text-muted)" : "#fff", border: "1px solid var(--color-border)", borderRadius: "5px", cursor: isCurrentSessionEmpty ? "not-allowed" : "pointer", opacity: isCurrentSessionEmpty ? 0.6 : 1, flexShrink: 0 }}
          >
            <Plus size={13} />
          </button>
        </div>

        {/* Row 3: Active Session Bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "var(--color-background)", border: "1px solid var(--color-border)", borderRadius: "5px", padding: "4px 8px", fontSize: "11px" }}>
          <button
            onClick={() => setShowSessionsDrawer(!showSessionsDrawer)}
            style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", cursor: "pointer", color: "var(--color-text)", padding: 0, minWidth: 0, flex: 1, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}
          >
            <MessageSquare size={12} style={{ color: "var(--color-accent)", flexShrink: 0 }} />
            <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {activeSession?.title || "New Chat"}
            </span>
            <span style={{ fontSize: "10px", color: "var(--color-text-muted)", flexShrink: 0 }}>
              ({messages.length} msg{messages.length === 1 ? "" : "s"})
            </span>
          </button>

          <button
            onClick={() => setShowSessionsDrawer(!showSessionsDrawer)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", padding: "2px", display: "flex", alignItems: "center", flexShrink: 0 }}
          >
            <ChevronDown size={12} style={{ transform: showSessionsDrawer ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }} />
          </button>
        </div>
      </div>

      {/* ── Sessions Drawer Overlay Panel ─────────────────────────── */}
      {showSessionsDrawer && (
        <div style={{ display: "flex", flexDirection: "column", borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-surface)", padding: "10px 14px", gap: "8px", flexShrink: 0, maxHeight: "220px", overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text)", display: "flex", alignItems: "center", gap: "6px" }}>
              <History size={13} /> Sessions ({sessions.length})
            </span>
            <button
              onClick={createNewSession}
              disabled={isCurrentSessionEmpty}
              title={isCurrentSessionEmpty ? "Current chat is empty" : "New Chat"}
              style={{ fontSize: "11px", display: "flex", alignItems: "center", gap: "4px", padding: "2px 8px", backgroundColor: isCurrentSessionEmpty ? "var(--color-surface)" : "var(--color-accent)", color: isCurrentSessionEmpty ? "var(--color-text-muted)" : "#fff", border: "1px solid var(--color-border)", borderRadius: "4px", cursor: isCurrentSessionEmpty ? "not-allowed" : "pointer", opacity: isCurrentSessionEmpty ? 0.6 : 1 }}
            >
              <Plus size={11} /> New Chat
            </button>
          </div>

          {/* Search Filter */}
          {sessions.length > 3 && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "var(--color-background)", border: "1px solid var(--color-border)", borderRadius: "4px", padding: "3px 8px" }}>
              <Search size={11} style={{ color: "var(--color-text-muted)" }} />
              <input
                type="text"
                value={sessionFilter}
                onChange={(e) => setSessionFilter(e.target.value)}
                placeholder="Filter sessions..."
                style={{ width: "100%", background: "none", border: "none", outline: "none", fontSize: "11px", color: "var(--color-text)" }}
              />
            </div>
          )}

          {/* Sessions List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {filteredSessions.map(session => {
              const isActive = session.id === activeSessionId;
              const isEditing = session.id === editingSessionId;

              return (
                <div
                  key={session.id}
                  onClick={() => switchSession(session.id)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", borderRadius: "5px", cursor: "pointer", backgroundColor: isActive ? "rgba(99,102,241,0.12)" : "var(--color-background)", border: isActive ? "1px solid var(--color-accent)" : "1px solid var(--color-border)", fontSize: "11px" }}
                >
                  {isEditing ? (
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => renameSession(session.id, editingTitle)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") renameSession(session.id, editingTitle);
                        if (e.key === "Escape") setEditingSessionId(null);
                      }}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      style={{ flex: 1, fontSize: "11px", padding: "1px 4px", borderRadius: "3px", border: "1px solid var(--color-accent)", backgroundColor: "var(--color-surface)", color: "var(--color-text)", outline: "none" }}
                    />
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: isActive ? 600 : 400, color: isActive ? "var(--color-accent)" : "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {session.title}
                      </span>
                      <span style={{ fontSize: "10px", color: "var(--color-text-muted)" }}>
                        {session.messages.length} msg{session.messages.length === 1 ? "" : "s"} • {new Date(session.updatedAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: "4px", marginLeft: "6px", flexShrink: 0 }}>
                    {!isEditing && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingSessionId(session.id); setEditingTitle(session.title); }}
                        title="Rename"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", padding: "2px", borderRadius: "3px" }}
                      >
                        <Edit2 size={11} />
                      </button>
                    )}
                    <button
                      onClick={(e) => deleteSession(session.id, e)}
                      title="Delete Session"
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", padding: "2px", borderRadius: "3px" }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Privacy Notice (non-local providers) ─────────────────── */}
      {!provider.isLocal && (
        <div style={{ padding: "8px 14px", backgroundColor: "rgba(245,158,11,0.08)", borderBottom: "1px solid rgba(245,158,11,0.2)", display: "flex", gap: "8px", alignItems: "flex-start", flexShrink: 0 }}>
          <AlertTriangle size={13} style={{ color: "#f59e0b", flexShrink: 0, marginTop: "2px" }} />
          <div style={{ fontSize: "11px", color: "var(--color-text-muted)", lineHeight: 1.5 }}>
            <strong style={{ color: "#f59e0b" }}>Cloud AI provider.</strong> Your messages and request context will be sent to <strong>{provider.name}</strong>. Avoid sharing sensitive credentials or PII.
          </div>
        </div>
      )}

      {/* ── Settings Panel ───────────────────────────────────────── */}
      {showSettings && (
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-surface)", display: "flex", flexDirection: "column", gap: "10px", flexShrink: 0 }}>
          {/* API Key */}
          {provider.requiresApiKey && (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: apiKeyMissing ? "#ef4444" : "var(--color-text)", display: "flex", alignItems: "center", gap: "6px" }}>
                <Shield size={12} />
                {provider.apiKeyLabel}
                {apiKeyMissing && <span style={{ color: "#ef4444", fontWeight: 400 }}>— required</span>}
              </label>
              <div style={{ display: "flex", gap: "4px" }}>
                <input
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); setApiKeyMissing(false); }}
                  placeholder={provider.apiKeyPlaceholder}
                  style={{ flex: 1, padding: "5px 8px", borderRadius: "4px", border: `1px solid ${apiKeyMissing ? "#ef4444" : "var(--color-border)"}`, backgroundColor: "var(--color-background)", color: "var(--color-text)", fontSize: "12px", outline: "none" }}
                />
                <button type="button" onClick={() => setShowApiKey(!showApiKey)} style={{ padding: "4px 6px", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "4px", cursor: "pointer", color: "var(--color-text-muted)" }}>
                  {showApiKey ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              </div>
              <span style={{ fontSize: "10px", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                <Shield size={10} /> Not saved to disk — enter each session
              </span>
            </div>
          )}
          {/* Custom base URL */}
          {(providerId === "custom" || provider.isLocal) && (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text)" }}>Base URL</label>
              <input
                type="text"
                value={providerId === "custom" ? customBaseUrl : provider.baseUrl}
                onChange={(e) => providerId === "custom" && setCustomBaseUrl(e.target.value)}
                readOnly={providerId !== "custom"}
                placeholder="http://localhost:11434"
                style={{ padding: "5px 8px", borderRadius: "4px", border: "1px solid var(--color-border)", backgroundColor: "var(--color-background)", color: "var(--color-text)", fontSize: "12px", outline: "none", opacity: providerId !== "custom" ? 0.6 : 1 }}
              />
            </div>
          )}
          {/* Status info */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {provider.isLocal && (
              <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "10px", backgroundColor: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)" }}>
                🔒 Local — data stays on device
              </span>
            )}
            {(mcpTools.length + builtinTools.length) > 0 && (
              <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "10px", backgroundColor: "rgba(99,102,241,0.1)", color: "var(--color-accent)", border: "1px solid rgba(99,102,241,0.2)" }}>
                🔧 {mcpTools.length + builtinTools.length} tools ({builtinTools.length} built-in{mcpTools.length > 0 ? `, ${mcpTools.length} MCP` : ""})
              </span>
            )}
            {hasContext && (
              <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "10px", backgroundColor: "rgba(99,102,241,0.1)", color: "var(--color-accent)", border: "1px solid rgba(99,102,241,0.2)" }}>
                📡 Request context injected
              </span>
            )}
            {lastResponse && (
              <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "10px", backgroundColor: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)" }}>
                📥 Last response ({lastResponse.status}) injected
              </span>
            )}
            {knowledgeBase.trim() && (
              <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "10px", backgroundColor: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)" }}>
                📚 Knowledge base active
              </span>
            )}
            {!!workspace?.requests?.length && (
              <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "10px", backgroundColor: "rgba(99,102,241,0.1)", color: "var(--color-accent)", border: "1px solid rgba(99,102,241,0.2)" }}>
                🗂 {workspace.requests.length} requests indexed for RAG
              </span>
            )}
          </div>

          {/* Knowledge Base */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text)", display: "flex", alignItems: "center", gap: "6px" }}>
                <BookOpen size={12} /> Knowledge Base
              </label>
              <button
                type="button"
                onClick={() => {
                  if (showKnowledgeBase) {
                    saveKnowledgeBase(kbDraft);
                    setKnowledgeBase(kbDraft);
                  } else {
                    setKbDraft(loadKnowledgeBase());
                  }
                  setShowKnowledgeBase(!showKnowledgeBase);
                }}
                style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "4px", border: "1px solid var(--color-border)", background: showKnowledgeBase ? "var(--color-accent)" : "var(--color-surface)", color: showKnowledgeBase ? "#fff" : "var(--color-text)", cursor: "pointer" }}
              >
                {showKnowledgeBase ? "Save" : (knowledgeBase.trim() ? "Edit" : "Add Notes")}
              </button>
            </div>
            {showKnowledgeBase && (
              <textarea
                value={kbDraft}
                onChange={(e) => setKbDraft(e.target.value)}
                placeholder={"Add custom notes, API documentation snippets, team conventions, or any context you want the AI to always know about.\n\nExample:\n- Our API uses snake_case for all JSON fields\n- Auth tokens expire after 15 minutes\n- Base URL for prod: https://api.example.com"}
                style={{ height: "120px", padding: "7px 10px", borderRadius: "6px", border: "1px solid var(--color-border)", backgroundColor: "var(--color-background)", color: "var(--color-text)", fontSize: "11px", resize: "vertical", fontFamily: "inherit", outline: "none", lineHeight: 1.5 }}
              />
            )}
            {!showKnowledgeBase && knowledgeBase.trim() && (
              <span style={{ fontSize: "10px", color: "#10b981" }}>✓ {knowledgeBase.trim().split("\n").length} lines of custom context loaded</span>
            )}
            {!showKnowledgeBase && !knowledgeBase.trim() && (
              <span style={{ fontSize: "10px", color: "var(--color-text-muted)" }}>Add notes, docs, or conventions that the AI should always remember</span>
            )}
          </div>

          {/* Third-party MCP Servers */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text)", display: "flex", alignItems: "center", gap: "6px" }}>
                <Database size={12} /> MCP Servers
              </label>
              <button
                type="button"
                onClick={() => setShowMcpServers(!showMcpServers)}
                style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "4px", border: "1px solid var(--color-border)", background: showMcpServers ? "var(--color-accent)" : "var(--color-surface)", color: showMcpServers ? "#fff" : "var(--color-text)", cursor: "pointer" }}
              >
                {showMcpServers ? "Hide" : `Manage (${thirdPartyServers.length})`}
              </button>
            </div>
            {showMcpServers && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {thirdPartyServers.map((srv, i) => (
                  <div key={srv.id} style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={srv.enabled}
                      onChange={e => {
                        const next = thirdPartyServers.map((s, j) => j === i ? { ...s, enabled: e.target.checked } : s);
                        setThirdPartyServers(next); saveMcpServers(next);
                      }}
                      style={{ flexShrink: 0 }}
                    />
                    <input
                      type="text"
                      value={srv.name}
                      onChange={e => {
                        const next = thirdPartyServers.map((s, j) => j === i ? { ...s, name: e.target.value } : s);
                        setThirdPartyServers(next); saveMcpServers(next);
                      }}
                      placeholder="Server name"
                      style={{ width: "80px", padding: "3px 6px", borderRadius: "4px", border: "1px solid var(--color-border)", backgroundColor: "var(--color-background)", color: "var(--color-text)", fontSize: "11px", outline: "none" }}
                    />
                    <input
                      type="text"
                      value={srv.url}
                      onChange={e => {
                        const next = thirdPartyServers.map((s, j) => j === i ? { ...s, url: e.target.value } : s);
                        setThirdPartyServers(next); saveMcpServers(next);
                      }}
                      placeholder="http://localhost:8080"
                      style={{ flex: 1, padding: "3px 6px", borderRadius: "4px", border: "1px solid var(--color-border)", backgroundColor: "var(--color-background)", color: "var(--color-text)", fontSize: "11px", outline: "none" }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = thirdPartyServers.filter((_, j) => j !== i);
                        setThirdPartyServers(next); saveMcpServers(next);
                      }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", padding: "2px" }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      const next = [...thirdPartyServers, { id: Date.now().toString(), name: "My MCP", url: "http://localhost:8080", enabled: true }];
                      setThirdPartyServers(next); saveMcpServers(next);
                    }}
                    style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "4px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                  >
                    <Plus size={11} /> Add Server
                  </button>
                  <button
                    type="button"
                    onClick={fetchThirdPartyTools}
                    style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "4px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)", cursor: "pointer" }}
                  >
                    Refresh Tools
                  </button>
                </div>
                {thirdPartyTools.length > 0 && (
                  <div style={{ fontSize: "10px", color: "#10b981", display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    {thirdPartyTools.map((t, i) => (
                      <span key={i} style={{ padding: "1px 6px", borderRadius: "8px", backgroundColor: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
                        {t.name}
                      </span>
                    ))}
                  </div>
                )}
                <span style={{ fontSize: "10px", color: "var(--color-text-muted)", lineHeight: 1.4 }}>
                  Connect any MCP-compatible server (e.g. filesystem, database, GitHub). Uses the MCP /tools/list and /tools/call HTTP transport.
                </span>
              </div>
            )}
            {!showMcpServers && thirdPartyTools.length > 0 && (
              <span style={{ fontSize: "10px", color: "#10b981" }}>✓ {thirdPartyTools.length} external tools from {thirdPartyServers.filter(s=>s.enabled).length} server(s)</span>
            )}
          </div>
        </div>
      )}

      {/* ── Messages ─────────────────────────────────────────────── */}
      <div className="ai-chat-messages" style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--color-text-muted)", marginTop: "24px", fontSize: "13px" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "50%", backgroundColor: "rgba(99,102,241,0.1)", border: "2px solid rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
              <Bot size={22} style={{ color: "var(--color-accent)" }} />
            </div>
            <p style={{ fontWeight: 600, marginBottom: "4px" }}>{provider.name}</p>
            <p style={{ fontSize: "11px", opacity: 0.7, marginBottom: "12px" }}>
              {provider.isLocal ? "Running locally — your data stays on device." : `Cloud AI via ${provider.name}.`}
            </p>
            {!provider.isLocal && (
              <div style={{ marginBottom: "12px", padding: "8px 12px", borderRadius: "8px", backgroundColor: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", fontSize: "11px", textAlign: "left", display: "flex", gap: "8px" }}>
                <AlertTriangle size={12} style={{ color: "#f59e0b", flexShrink: 0, marginTop: "1px" }} />
                <span>This provider sends data to external servers. Do not share API keys, passwords, or sensitive PII.</span>
              </div>
            )}
            {provider.requiresApiKey && !apiKey && (
              <div style={{ marginBottom: "12px" }}>
                <button onClick={() => setShowSettings(true)} style={{ padding: "7px 14px", borderRadius: "8px", border: "none", backgroundColor: "var(--color-accent)", color: "#fff", fontSize: "12px", cursor: "pointer", fontWeight: 600 }}>
                  Enter API Key to get started
                </button>
              </div>
            )}
            {hasContext && (
              <div style={{ marginBottom: "12px", padding: "8px 12px", borderRadius: "8px", backgroundColor: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", fontSize: "12px", textAlign: "left" }}>
                <div style={{ fontWeight: 600, color: "var(--color-accent)", marginBottom: "4px" }}>📡 Context loaded</div>
                <div style={{ fontSize: "11px" }}>{draftRequest?.method} {draftRequest?.url || "(no URL)"}</div>
              </div>
            )}
            {lastResponse && (
              <div style={{ marginBottom: "12px", padding: "8px 12px", borderRadius: "8px", backgroundColor: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.18)", fontSize: "12px", textAlign: "left" }}>
                <div style={{ fontWeight: 600, color: "#10b981", marginBottom: "4px" }}>📥 Last response ready</div>
                <div style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>HTTP {lastResponse.status} · {lastResponse.durationMs}ms · Ask me to explain or debug it</div>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", textAlign: "left" }}>
              {[
                lastResponse ? "Explain this response body" : "How do I authenticate with OAuth2?",
                "Generate test cases for this endpoint",
                hasContext ? "Help me debug this request" : "Help me debug this auth error",
                lastResponse ? `Why did I get HTTP ${lastResponse.status}?` : "Convert this to a curl command",
                workspace?.requests?.length ? "List all requests in my workspace" : "How do I set up environment variables?"
              ].map(s => (
                <button
                  key={s}
                  onClick={() => handleSubmit(undefined, s)}
                  style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)", fontSize: "12px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all 0.15s ease" }}
                >
                  <span>{s}</span>
                  <ChevronRight size={12} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => {
            if (msg.role === "tool") return <ToolMessage key={idx} msg={msg} />;
            if (msg.role === "system") return null;
            return (
              <div key={idx} style={{ display: "flex", gap: "10px", flexDirection: msg.role === "user" ? "row-reverse" : "row", alignItems: "flex-start" }}>
                <div style={{ width: "26px", height: "26px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: msg.role === "user" ? "var(--color-accent)" : "var(--color-surface)", color: msg.role === "user" ? "#fff" : "var(--color-text)", flexShrink: 0, border: msg.role === "assistant" ? "1px solid var(--color-border)" : "none" }}>
                  {msg.role === "user" ? <User size={13} /> : <Bot size={13} />}
                </div>
                <div style={{ maxWidth: "88%", padding: "9px 13px", borderRadius: "12px", borderTopRightRadius: msg.role === "user" ? "4px" : "12px", borderTopLeftRadius: msg.role === "assistant" ? "4px" : "12px", backgroundColor: msg.role === "user" ? "var(--color-accent)" : "var(--color-surface)", color: msg.role === "user" ? "#fff" : "var(--color-text)", border: msg.role === "assistant" ? "1px solid var(--color-border)" : "none", fontSize: "13px", lineHeight: 1.5, wordBreak: "break-word", minWidth: 0 }}>
                  {msg.role === "assistant"
                    ? <>{renderMarkdown(msg.content)}{msg.isStreaming && <span style={{ display: "inline-block", width: "8px", height: "14px", backgroundColor: "var(--color-accent)", borderRadius: "2px", marginLeft: "2px", animation: "blink 1s step-end infinite", verticalAlign: "middle" }} />}</>
                    : <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
                  }
                  {(msg.tool_calls?.length ?? 0) > 0 && (
                    <div style={{ marginTop: msg.content ? "8px" : 0, paddingTop: msg.content ? "6px" : 0, borderTop: msg.content ? "1px solid rgba(255,255,255,0.1)" : "none" }}>
                      {msg.tool_calls?.map((tc, j) => <div key={j} style={{ fontSize: "11px", display: "flex", alignItems: "center", gap: "5px", opacity: 0.75 }}><Zap size={10} /> Calling: <strong>{tc.function?.name}</strong></div>)}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {isLoading && !messages.some(m => m.isStreaming) && (
          <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
            <div style={{ width: "26px", height: "26px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", flexShrink: 0 }}>
              <Bot size={13} />
            </div>
            <div style={{ padding: "9px 13px", borderRadius: "12px", borderTopLeftRadius: "4px", backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", display: "flex", alignItems: "center", gap: "8px" }}>
              <Loader2 size={13} className="animate-spin" />
              <span style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>Thinking…</span>
            </div>
          </div>
        )}

        {error && (
          <div style={{ padding: "10px", borderRadius: "8px", backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: "12px" }}>
            <strong>Error:</strong> {error}
            {provider.isLocal && <div style={{ marginTop: "4px", fontSize: "11px", opacity: 0.8 }}>Make sure {provider.name} is running locally.</div>}
            {provider.requiresApiKey && apiKey && <div style={{ marginTop: "4px", fontSize: "11px", opacity: 0.8 }}>Check your API key is valid and has sufficient quota.</div>}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input ─────────────────────────────────────────────────── */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid var(--color-border)", backgroundColor: "var(--color-surface)", flexShrink: 0 }}>
        {provider.requiresApiKey && !apiKey && (
          <div style={{ marginBottom: "8px", padding: "6px 10px", borderRadius: "6px", backgroundColor: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", fontSize: "11px", color: "#f59e0b", display: "flex", alignItems: "center", gap: "6px" }}>
            <AlertTriangle size={11} />
            API key required — <button onClick={() => setShowSettings(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-accent)", textDecoration: "underline", fontSize: "11px", padding: 0 }}>open settings</button>
          </div>
        )}
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
            placeholder="Ask AI…"
            disabled={isLoading}
            style={{ flex: 1, minHeight: "40px", maxHeight: "120px", padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--color-border)", backgroundColor: "var(--color-background)", color: "var(--color-text)", fontSize: "12px", resize: "none", fontFamily: "inherit", outline: "none", lineHeight: 1.4, boxSizing: "border-box", display: "block", overflowY: "hidden", minWidth: 0 }}
            rows={1}
          />
          {isLoading ? (
            <button type="button" onClick={stop} title="Stop" style={{ width: "36px", height: "36px", borderRadius: "10px", border: "none", backgroundColor: "#ef4444", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <Square size={14} />
            </button>
          ) : (
            <button type="submit" disabled={!input.trim()} title="Send (Enter)" style={{ width: "36px", height: "36px", borderRadius: "10px", border: "none", backgroundColor: input.trim() ? "var(--color-accent)" : "transparent", color: input.trim() ? "#fff" : "var(--color-text-muted)", display: "flex", alignItems: "center", justifyContent: "center", cursor: input.trim() ? "pointer" : "default", transition: "all 0.2s", flexShrink: 0 }}>
              <Send size={14} style={{ marginLeft: "1px" }} />
            </button>
          )}
        </form>
        <div style={{ marginTop: "6px", fontSize: "10px", color: "var(--color-text-muted)", textAlign: "center" }}>
          Shift+Enter for new line · {provider.isLocal ? "🔒 Local AI — private" : "☁️ Cloud AI — data leaves device"}
        </div>
      </div>

      <style>{`@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }`}</style>
    </div>
  );
}
