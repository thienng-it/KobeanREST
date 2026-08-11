import React, { useState, useRef, useEffect } from "react";
import { X, Send, Bot, User, Trash2, Loader2, Sparkles, Settings } from "lucide-react";

import { exportMcpManifest, executeMcpToolCall } from "../services/local-store";

interface Message {
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  tool_calls?: any[];
  tool_name?: string;
}

interface AIChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  width?: number;
}

export function AIChatSidebar({ isOpen, onClose, width = 320 }: AIChatSidebarProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("llama3");
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [mcpServerUrl, setMcpServerUrl] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [mcpTools, setMcpTools] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    exportMcpManifest().then((result) => {
      try {
        const manifest = JSON.parse(result.manifest_json);
        if (manifest && manifest.tools) {
          setMcpTools(manifest.tools);
        }
      } catch (err) {
        console.error("Failed to parse MCP manifest", err);
      }
    });
  }, []);

  useEffect(() => {
    if (isOpen && models.length === 0) {
      setIsFetchingModels(true);
      fetch("http://localhost:11434/api/tags")
        .then((res) => res.json())
        .then((data) => {
          if (data.models && data.models.length > 0) {
            const modelNames = data.models.map((m: any) => m.name);
            setModels(modelNames);
            if (!modelNames.includes(selectedModel)) {
              setSelectedModel(modelNames[0]);
            }
          }
        })
        .catch((err) => {
          console.error("Failed to fetch Ollama models:", err);
        })
        .finally(() => {
          setIsFetchingModels(false);
        });
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    const initialMessages = [...messages, userMessage];
    setMessages(initialMessages);
    setInput("");
    setIsLoading(true);
    setError(null);

    await processChat(initialMessages);
  };

  const processChat = async (currentMessages: Message[]) => {
    try {
      const ollamaTools = mcpTools.length > 0 ? mcpTools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema
        }
      })) : undefined;

      const response = await fetch("http://localhost:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            { role: "system", content: "You are a helpful AI assistant. Use the provided tools to answer the user's questions. Always summarize tool results into human-readable text. Do not output raw JSON." },
            ...currentMessages.map((m) => {
              if (m.role === "tool") {
                const lastUserMessage = currentMessages.slice().reverse().find(msg => msg.role === "user")?.content || "the user's request";
                return {
                  role: "user",
                  content: `[System Update] The tool '${m.tool_name}' returned the following data:\n\n${m.content}\n\nPlease analyze this data and provide a conversational answer to: "${lastUserMessage}"`
                };
              }

              const out: any = { role: m.role, content: m.content || "" };
              if (m.tool_calls) out.tool_calls = m.tool_calls;
              return out;
            })
          ],
          stream: false,
          tools: ollamaTools
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMsg = response.statusText;
        try {
          const parsed = JSON.parse(errorText);
          if (parsed.error) errorMsg = parsed.error;
        } catch {
          if (errorText) errorMsg = errorText;
        }
        throw new Error(`Ollama API error: ${errorMsg}`);
      }

      const data = await response.json();
      const assistantMessage = data.message;
      
      const newMessages = [...currentMessages, assistantMessage];
      setMessages(newMessages);

      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        const toolMessages: Message[] = [];
        for (const call of assistantMessage.tool_calls) {
          try {
            const result = await executeMcpToolCall(call.function.name, JSON.stringify(call.function.arguments));
            toolMessages.push({
              role: "tool",
              content: typeof result === "string" ? result : JSON.stringify(result),
              tool_name: call.function.name
            });
          } catch (toolErr: any) {
            toolMessages.push({
              role: "tool",
              content: JSON.stringify({ error: toolErr.message || String(toolErr) }),
              tool_name: call.function.name
            });
          }
        }
        const nextMessages = [...newMessages, ...toolMessages];
        setMessages(nextMessages);
        await processChat(nextMessages);
      } else {
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error("AI Chat Error:", err);
      setError(err.message || "Failed to connect to Local LLM. Is Ollama running?");
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div
      className="ai-chat-sidebar"
      style={{
        width,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--color-sidebar)",
        borderLeft: "1px solid var(--color-border)",
        height: "100%",
        flexShrink: 0,
        zIndex: 10,
      }}
    >
      <div
        className="ai-chat-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid var(--color-border)",
          backgroundColor: "var(--color-surface)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600 }}>
            <Sparkles size={16} className="text-brand" style={{ color: "var(--color-accent)" }} />
            <span>AI Assistant</span>
          </div>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={isFetchingModels || models.length === 0}
            title="Select Ollama Model"
            style={{
              fontSize: "12px",
              padding: "4px 6px",
              borderRadius: "4px",
              backgroundColor: "var(--color-surface)",
              color: "var(--color-text)",
              border: "1px solid var(--color-border)",
              outline: "none",
              cursor: "pointer",
              maxWidth: "160px",
            }}
          >
            {models.length === 0 ? (
               <option value={selectedModel}>{isFetchingModels ? "Loading models..." : selectedModel}</option>
            ) : (
               models.map((m) => (
                 <option key={m} value={m}>{m}</option>
               ))
            )}
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="icon-btn"
            title="Settings"
            style={{ padding: "4px", background: showSettings ? "var(--color-surface-active)" : "none", border: "none", cursor: "pointer", color: showSettings ? "var(--color-text-active)" : "var(--color-text-muted)", borderRadius: "4px" }}
          >
            <Settings size={16} />
          </button>
          <button
            onClick={clearChat}
            className="icon-btn"
            title="Clear Chat"
            style={{ padding: "4px", background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)" }}
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={onClose}
            className="icon-btn"
            title="Close"
            style={{ padding: "4px", background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)" }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {showSettings && (
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--color-border)",
            backgroundColor: "var(--color-surface)",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text)" }}>MCP Server URL</label>
          <input
            type="text"
            value={mcpServerUrl}
            onChange={(e) => setMcpServerUrl(e.target.value)}
            placeholder="http://localhost:3000"
            style={{
              padding: "6px 8px",
              borderRadius: "4px",
              border: "1px solid var(--color-border)",
              backgroundColor: "var(--color-background)",
              color: "var(--color-text)",
              fontSize: "12px",
              outline: "none",
            }}
          />
          <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
            Provide an MCP server URL to allow the LLM to execute tools and fetch context.
          </span>
        </div>
      )}

      <div
        className="ai-chat-messages"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {messages.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--color-text-muted)", marginTop: "40px", fontSize: "14px" }}>
            <Bot size={32} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
            <p>I am your local AI assistant running via Ollama.</p>
            <p style={{ marginTop: "8px", fontSize: "12px", opacity: 0.8 }}>
              Make sure Ollama is running locally on port 11434.
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            if (msg.role === "tool") {
              // Try to format JSON if possible
              let formattedContent = msg.content;
              try {
                const parsed = JSON.parse(msg.content);
                formattedContent = JSON.stringify(parsed, null, 2);
              } catch (e) {
                // not JSON, leave as is
              }

              return (
                <details key={idx} style={{ flexShrink: 0, padding: "8px 12px", margin: "0 16px", backgroundColor: "var(--color-background)", border: "1px solid var(--color-border)", borderRadius: "6px", fontSize: "11px", color: "var(--color-text-muted)", fontFamily: "monospace", overflowX: "auto" }}>
                  <summary style={{ fontWeight: 600, color: "var(--color-text)", cursor: "pointer", userSelect: "none", outline: "none" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", verticalAlign: "middle" }}>
                      <Settings size={12} />
                      <span>Tool Response: {msg.tool_name || 'unknown'}</span>
                    </div>
                  </summary>
                  <div style={{ marginTop: "8px", whiteSpace: "pre-wrap", maxHeight: "400px", overflowY: "auto" }}>
                    {formattedContent}
                  </div>
                </details>
              );
            }

            return (
              <div
                key={idx}
                style={{
                  display: "flex",
                  gap: "12px",
                  flexDirection: msg.role === "user" ? "row-reverse" : "row",
                }}
              >
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: msg.role === "user" ? "var(--color-accent)" : "var(--color-surface)",
                    color: msg.role === "user" ? "#fff" : "var(--color-text)",
                    flexShrink: 0,
                    border: msg.role === "assistant" ? "1px solid var(--color-border)" : "none",
                  }}
                >
                  {msg.role === "user" ? <User size={14} /> : <Bot size={14} />}
                </div>
                <div
                  style={{
                    maxWidth: "85%",
                    padding: "10px 14px",
                    borderRadius: "12px",
                    borderTopRightRadius: msg.role === "user" ? "4px" : "12px",
                    borderTopLeftRadius: msg.role === "assistant" ? "4px" : "12px",
                    backgroundColor: msg.role === "user" ? "var(--color-accent)" : "var(--color-surface)",
                    color: msg.role === "user" ? "#fff" : "var(--color-text)",
                    border: msg.role === "assistant" ? "1px solid var(--color-border)" : "none",
                    fontSize: "13px",
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {msg.content}
                  {msg.tool_calls && msg.tool_calls.length > 0 && (
                    <div style={{ marginTop: msg.content ? "8px" : "0", paddingTop: msg.content ? "8px" : "0", borderTop: msg.content ? "1px solid var(--color-border)" : "none" }}>
                      {msg.tool_calls.map((tc, tIdx) => (
                        <div key={tIdx} style={{ fontSize: "12px", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                           <Settings size={12} />
                           <span>Calling tool: <strong>{tc.function?.name || 'unknown'}</strong></span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        {isLoading && (
          <div style={{ display: "flex", gap: "12px" }}>
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                flexShrink: 0,
              }}
            >
              <Bot size={14} />
            </div>
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "12px",
                borderTopLeftRadius: "4px",
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Loader2 size={14} className="animate-spin" />
              <span style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>Thinking...</span>
            </div>
          </div>
        )}
        {error && (
          <div
            style={{
              padding: "10px",
              borderRadius: "8px",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              color: "#ef4444",
              fontSize: "13px",
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div
        className="ai-chat-input"
        style={{
          padding: "16px",
          borderTop: "1px solid var(--color-border)",
          backgroundColor: "var(--color-surface)",
        }}
      >
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: "8px", position: "relative" }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Ask AI anything..."
            disabled={isLoading}
            style={{
              flex: 1,
              minHeight: "44px",
              maxHeight: "120px",
              padding: "10px 40px 10px 14px",
              borderRadius: "20px",
              border: "1px solid var(--color-border)",
              backgroundColor: "var(--color-background)",
              color: "var(--color-text)",
              fontSize: "13px",
              resize: "none",
              fontFamily: "inherit",
              outline: "none",
              lineHeight: 1.4,
            }}
            rows={1}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            style={{
              position: "absolute",
              right: "6px",
              bottom: "6px",
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              border: "none",
              backgroundColor: input.trim() && !isLoading ? "var(--color-accent)" : "transparent",
              color: input.trim() && !isLoading ? "#fff" : "var(--color-text-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: input.trim() && !isLoading ? "pointer" : "default",
              transition: "all 0.2s",
            }}
          >
            <Send size={14} style={{ marginLeft: "2px" }} />
          </button>
        </form>
      </div>
    </div>
  );
}
