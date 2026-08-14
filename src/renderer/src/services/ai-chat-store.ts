export interface Message {
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  tool_calls?: any[];
  tool_name?: string;
  isStreaming?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  providerId?: string;
  selectedModel?: string;
}

export const SESSIONS_STORAGE_KEY = "kobeanrest_ai_chat_sessions";
export const ACTIVE_SESSION_STORAGE_KEY = "kobeanrest_ai_active_session_id";

export function loadChatSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Prune extra empty 0-message sessions on load
        const activeId = loadActiveSessionId();
        const nonEmpties = parsed.filter((s: ChatSession) => s.messages && s.messages.length > 0);
        const activeSession = parsed.find((s: ChatSession) => s.id === activeId);

        if (activeSession && activeSession.messages.length === 0) {
          return [activeSession, ...nonEmpties.filter((s: ChatSession) => s.id !== activeId)];
        }
        if (nonEmpties.length > 0) return nonEmpties;
        return [parsed[0]];
      }
    }
  } catch { /* ignore */ }
  const defaultSession: ChatSession = {
    id: "session_" + Date.now(),
    title: "New Chat",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  };
  return [defaultSession];
}

export function saveChatSessions(sessions: ChatSession[]) {
  try {
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  } catch { /* ignore */ }
}

export function loadActiveSessionId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveActiveSessionId(id: string) {
  try {
    localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, id);
  } catch { /* ignore */ }
}

const KB_STORAGE_KEY = "kobeanrest_ai_knowledge_base";

export function loadKnowledgeBase(): string {
  try { return localStorage.getItem(KB_STORAGE_KEY) || ""; } catch { return ""; }
}

export function saveKnowledgeBase(text: string) {
  try { localStorage.setItem(KB_STORAGE_KEY, text); } catch { /* ignore */ }
}

const MCP_SERVERS_KEY = "kobeanrest_mcp_servers";

export interface McpServerConfig {
  id: string;
  name: string;
  url: string; // e.g. http://localhost:8080
  enabled: boolean;
}

export function loadMcpServers(): McpServerConfig[] {
  try {
    const raw = localStorage.getItem(MCP_SERVERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

export function saveMcpServers(servers: McpServerConfig[]) {
  try { localStorage.setItem(MCP_SERVERS_KEY, JSON.stringify(servers)); } catch { /* ignore */ }
}

