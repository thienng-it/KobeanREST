import React, { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Bot, User, Trash2, Loader2, Sparkles, Settings, Square, Copy, Check, ChevronDown, ChevronRight, Zap, AlertTriangle, Eye, EyeOff, Shield } from "lucide-react";
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

// ── Interfaces ──────────────────────────────────────────────────────────────
interface Message {
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  tool_calls?: any[];
  tool_name?: string;
  isStreaming?: boolean;
}

interface AIChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  width?: number;
  draftRequest?: SavedRequest | null;
  workspace?: WorkspaceSummary | null;
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
  return (
    <div style={{ position: "relative", margin: "6px 0", borderRadius: "6px", overflow: "hidden", border: "1px solid var(--color-border)" }}>
      {lang && (
        <div style={{ padding: "3px 10px", backgroundColor: "rgba(0,0,0,0.2)", fontSize: "10px", color: "var(--color-text-muted)", fontFamily: "monospace", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{lang}</span>
          <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", padding: 0, display: "flex", alignItems: "center", gap: "4px", fontSize: "10px" }}>
            {copied ? <Check size={10} /> : <Copy size={10} />} {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
      <pre style={{ margin: 0, padding: "10px", overflowX: "auto", backgroundColor: "rgba(0,0,0,0.15)", fontSize: "12px", fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-all" }}><code>{code}</code></pre>
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

export function AIChatSidebar({ isOpen, onClose, width = 360, draftRequest, workspace }: AIChatSidebarProps) {
  const saved = loadSettings();

  const [messages, setMessages] = useState<Message[]>([]);
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
  const [apiKeyMissing, setApiKeyMissing] = useState(false);

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

  const buildSystemPrompt = useCallback((): string => {
    let prompt = `You are an expert AI assistant embedded in KobeanREST, a REST API client. You help developers work with HTTP APIs.

Capabilities: HTTP concepts, status codes, OAuth2/JWT/auth flows, request debugging, JSON/API body generation, pre/post request scripts (JavaScript), testing strategies.

Format responses with markdown. Use fenced code blocks for code and JSON. Keep answers concise and actionable.`;

    if (draftRequest) {
      prompt += `\n\n## Active Request\nMethod: ${draftRequest.method}\nURL: ${draftRequest.url || "(not set)"}\nAuth: ${draftRequest.authMode || "none"}`;
      if (draftRequest.headers?.filter(h => h.enabled && h.key).length > 0) {
        const hdrs = draftRequest.headers.filter(h => h.enabled && h.key)
          .map(h => `  ${h.key}: ${/auth|secret|token|key/i.test(h.key) ? "[REDACTED]" : h.value}`)
          .join("\n");
        prompt += `\nHeaders:\n${hdrs}`;
      }
      if (draftRequest.body && draftRequest.bodyMimeType) {
        const preview = draftRequest.body.length > 500 ? draftRequest.body.slice(0, 500) + "…" : draftRequest.body;
        prompt += `\nContent-Type: ${draftRequest.bodyMimeType}\nBody:\n${preview}`;
      }
    }

    if (workspace) {
      prompt += `\n\n## Workspace: ${workspace.name || "Unnamed"}`;
      if (workspace.collections?.length) prompt += `\nCollections: ${workspace.collections.map(c => c.name).join(", ")}`;
      if (workspace.activeEnvironment) prompt += `\nActive Environment: ${workspace.activeEnvironment}`;
    }

    return prompt;
  }, [draftRequest, workspace]);

  const stop = () => { abortRef.current?.abort(); abortRef.current = null; setIsLoading(false); };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    if (provider.requiresApiKey && !apiKey.trim()) {
      setApiKeyMissing(true);
      setShowSettings(true);
      return;
    }
    setApiKeyMissing(false);

    const userMessage: Message = { role: "user", content: input.trim() };
    const history = [...messages, userMessage];
    setMessages(history);
    setInput("");
    setIsLoading(true);
    setError(null);
    await processChat(history);
  };

  const processChat = async (currentMessages: Message[]) => {
    try {
      const controller = new AbortController();
      abortRef.current = controller;
      const systemPrompt = buildSystemPrompt();

      // Add streaming placeholder
      setMessages(prev => [...prev, { role: "assistant", content: "", isStreaming: true }]);

      const ollamaTools = mcpTools.length > 0 ? mcpTools.map(t => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.inputSchema }
      })) : undefined;

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

      // Mark streaming done
      setMessages(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant") next[next.length - 1] = { ...last, isStreaming: false, tool_calls: finalMessage?.tool_calls };
        return next;
      });

      // Handle tool calls (Ollama only for now)
      if (finalMessage?.tool_calls?.length > 0) {
        const snapshot = await new Promise<Message[]>(res => setMessages(prev => { res(prev); return prev; }));
        const toolMessages: Message[] = [];
        for (const call of finalMessage.tool_calls) {
          try {
            const result = await executeMcpToolCall(call.function.name, JSON.stringify(call.function.arguments));
            toolMessages.push({ role: "tool", content: typeof result === "string" ? result : JSON.stringify(result), tool_name: call.function.name });
          } catch (err: any) {
            toolMessages.push({ role: "tool", content: JSON.stringify({ error: err.message }), tool_name: call.function.name });
          }
        }
        const next = [...snapshot, ...toolMessages];
        setMessages(next);
        await processChat(next);
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
    <div className="ai-chat-sidebar" style={{ width, display: "flex", flexDirection: "column", backgroundColor: "var(--color-sidebar)", borderLeft: "1px solid var(--color-border)", height: "100%", flexShrink: 0, zIndex: 10 }}>

      {/* ── Header ────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-surface)", flexShrink: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600 }}>
            <Sparkles size={16} style={{ color: "var(--color-accent)", flexShrink: 0 }} />
            <span>AI Assistant</span>
            {hasContext && (
              <span style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "10px", backgroundColor: "rgba(99,102,241,0.15)", color: "var(--color-accent)", fontWeight: 500 }}>Context ✓</span>
            )}
          </div>
          {/* Provider + Model row */}
          <div style={{ display: "flex", gap: "4px" }}>
            <select
              value={providerId}
              onChange={(e) => { setProviderId(e.target.value as ProviderId); setModels([]); setSelectedModel(""); setError(null); }}
              style={{ fontSize: "11px", padding: "3px 4px", borderRadius: "4px", backgroundColor: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-border)", outline: "none", cursor: "pointer" }}
            >
              {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={isFetchingModels}
              style={{ flex: 1, fontSize: "11px", padding: "3px 4px", borderRadius: "4px", backgroundColor: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-border)", outline: "none", cursor: "pointer", minWidth: 0 }}
            >
              {models.length === 0
                ? <option value={selectedModel}>{isFetchingModels ? "Loading…" : (selectedModel || "Select model")}</option>
                : models.map(m => <option key={m} value={m}>{m}</option>)
              }
            </select>
            <button onClick={fetchModels} disabled={isFetchingModels} title="Refresh models" style={{ padding: "3px 6px", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "4px", cursor: "pointer", color: "var(--color-text-muted)", fontSize: "11px", flexShrink: 0 }}>
              {isFetchingModels ? <Loader2 size={11} className="animate-spin" /> : "↻"}
            </button>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginLeft: "8px", flexShrink: 0 }}>
          <button onClick={() => setShowSettings(!showSettings)} title="Settings" style={{ padding: "4px", background: showSettings ? "var(--color-surface-active)" : "none", border: "none", cursor: "pointer", color: showSettings ? "var(--color-text-active)" : "var(--color-text-muted)", borderRadius: "4px" }}>
            <Settings size={15} />
          </button>
          <button onClick={clearChat} title="Clear Chat" style={{ padding: "4px", background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", borderRadius: "4px" }}>
            <Trash2 size={15} />
          </button>
          <button onClick={onClose} title="Close" style={{ padding: "4px", background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", borderRadius: "4px" }}>
            <X size={15} />
          </button>
        </div>
      </div>

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
            {mcpTools.length > 0 && (
              <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "10px", backgroundColor: "rgba(99,102,241,0.1)", color: "var(--color-accent)", border: "1px solid rgba(99,102,241,0.2)" }}>
                🔧 {mcpTools.length} MCP tools
              </span>
            )}
            {hasContext && (
              <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "10px", backgroundColor: "rgba(99,102,241,0.1)", color: "var(--color-accent)", border: "1px solid rgba(99,102,241,0.2)" }}>
                📡 Request context injected
              </span>
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
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", textAlign: "left" }}>
              {["Explain this response body", "Generate test cases for this endpoint", "Help me debug this auth error", "Convert this to a curl command"].map(s => (
                <button key={s} onClick={() => setInput(s)} style={{ padding: "7px 12px", borderRadius: "8px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)", fontSize: "12px", textAlign: "left", cursor: "pointer" }}>
                  {s}
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
            placeholder="Ask AI… (Shift+Enter for newline)"
            disabled={isLoading}
            style={{ flex: 1, minHeight: "44px", maxHeight: "120px", padding: "10px 14px", borderRadius: "10px", border: "1px solid var(--color-border)", backgroundColor: "var(--color-background)", color: "var(--color-text)", fontSize: "13px", resize: "none", fontFamily: "inherit", outline: "none", lineHeight: 1.4, boxSizing: "border-box", display: "block", overflowY: "hidden" }}
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
