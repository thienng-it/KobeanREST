import React, { useState, useMemo } from "react";
import { X, Key, ClipboardPaste, Trash2 } from "lucide-react";

interface JwtDecoderModalProps {
  open: boolean;
  onClose: () => void;
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

export function JwtDecoderModal({ open, onClose }: JwtDecoderModalProps) {
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

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="JWT Decoder"
      onClick={onClose}
    >
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()} style={{ width: "1000px", maxWidth: "95vw", height: "85vh", display: "flex", flexDirection: "column" }}>
        <div className="settings-header" style={{ flexShrink: 0 }}>
          <div>
            <span className="settings-kicker">Tools</span>
            <h2><Key size={18} style={{ marginRight: 8, verticalAlign: "bottom" }} /> JWT Decoder</h2>
            <p>Paste an encoded JSON Web Token to debug its contents instantly.</p>
          </div>
          <button className="settings-close" type="button" aria-label="Close JWT Decoder" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        
        <div className="settings-content" style={{ display: "flex", gap: "24px", overflow: "hidden", padding: "24px", flex: 1 }}>
          
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
              style={{
                flex: 1,
                resize: "none",
                width: "100%",
                boxSizing: "border-box",
                padding: "16px",
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "13px",
                lineHeight: "1.5",
                border: "1px solid var(--color-border-tint)",
                borderRadius: "8px",
                background: "var(--color-surface-hover)",
                color: "var(--color-text)",
                wordBreak: "break-all"
              }}
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
                  <pre style={{
                    margin: 0, padding: "16px", background: "var(--color-surface-hover)", border: "1px solid var(--color-border-tint)", borderRadius: "8px", overflowX: "auto", color: "#ec4899", fontFamily: "var(--font-mono, monospace)", fontSize: "13px"
                  }}>
                    {decoded.header}
                  </pre>
                </div>
                
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--color-text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Payload <span style={{ textTransform: "none", opacity: 0.7, fontWeight: "normal" }}>(Data)</span>
                  </div>
                  <pre style={{
                    margin: 0, padding: "16px", background: "var(--color-surface-hover)", border: "1px solid var(--color-border-tint)", borderRadius: "8px", overflowX: "auto", color: "#8b5cf6", fontFamily: "var(--font-mono, monospace)", fontSize: "13px"
                  }}>
                    {decoded.payload}
                  </pre>
                </div>
                
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--color-text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Signature
                  </div>
                  <pre style={{
                    margin: 0, padding: "16px", background: "var(--color-surface-hover)", border: "1px solid var(--color-border-tint)", borderRadius: "8px", overflowX: "auto", color: "#0ea5e9", wordBreak: "break-all", whiteSpace: "pre-wrap", fontFamily: "var(--font-mono, monospace)", fontSize: "13px"
                  }}>
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
      </div>
    </div>
  );
}
