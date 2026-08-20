import React, { useState, useEffect } from "react";
import { KeyRound, Copy } from "lucide-react";
import { CustomSelect } from "./CustomSelect";
import { VariableInput } from "./VariableInput";
import { obtainOAuth2Token } from "../services/auth";
import { buildVariableMap } from "../services/variables";
import type { ApiAuthMode, AuthConfig, EnvironmentVariable } from "../types";

export const AUTH_MODE_MAP: Record<string, string> = {
  "None": "none", "Basic Auth": "basic", "Bearer Token": "bearer",
  "API Key": "apiKey", "OAuth 2.0": "oauth2", "NTLM": "ntlm", "Kerberos": "kerberos",
};

export type AuthDraft = { mode: ApiAuthMode; config: AuthConfig };

export interface AuthEditorFormProps {
  draft: AuthDraft;
  activeVars: EnvironmentVariable[];
  onDraftChange: (draft: AuthDraft) => void;
  onTokenObtained?: (config: AuthConfig) => void;
}

export function AuthEditorForm({
  draft,
  activeVars,
  onDraftChange,
  onTokenObtained,
}: AuthEditorFormProps) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const updateConfig = (fields: Partial<AuthConfig>) => {
    onDraftChange({ ...draft, config: { ...draft.config, ...fields } });
  };

  return (
    <>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
            <KeyRound size={14} />
            Authentication Method
          </label>
          <CustomSelect
            value={draft.mode}
            onChange={(val) => onDraftChange({ ...draft, mode: val as ApiAuthMode })}
            options={Object.entries(AUTH_MODE_MAP).map(([label, value]) => ({
              value,
              label,
            }))}
          />
        </div>

        {draft.mode === "basic" && (
          <div className="auth-config-fields" aria-label="Basic auth credentials">
            <label>
              <span>Username</span>
              <VariableInput activeVariables={activeVars} value={draft.config.username ?? ""} onChange={(v) => updateConfig({ username: v.target.value })} placeholder="username or {{variable}}" autoComplete="off" />
            </label>
            <label>
              <span>Password</span>
              <VariableInput type="password" activeVariables={activeVars} value={draft.config.password ?? ""} onChange={(v) => updateConfig({ password: v.target.value })} placeholder="password or {{variable}}" autoComplete="new-password" />
            </label>
          </div>
        )}

        {draft.mode === "bearer" && (
          <div className="auth-config-fields" aria-label="Token credential">
            <label>
              <span>Token</span>
              <div style={{ display: "flex", gap: "8px" }}>
                <VariableInput type="password" activeVariables={activeVars} value={draft.config.token ?? ""} onChange={(v) => updateConfig({ token: v.target.value })} placeholder="token or {{variable}}" autoComplete="off" style={{ flex: 1 }} />
                <button type="button" className="icon-button" onClick={() => navigator.clipboard.writeText(draft.config.token ?? "")} title="Copy Token" aria-label="Copy Token">
                  <Copy size={16} />
                </button>
              </div>
            </label>
          </div>
        )}

        {draft.mode === "oauth2" && (
          <div className="auth-config-fields" aria-label="OAuth 2.0 credentials" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <label>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span>Token</span>
                {draft.config.expiresAt && now > draft.config.expiresAt && (
                  <span style={{ color: "var(--color-danger, #ef4444)", fontSize: "11px", fontWeight: 600, padding: "2px 6px", backgroundColor: "rgba(239, 68, 68, 0.1)", borderRadius: "4px" }}>EXPIRED</span>
                )}
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                <VariableInput type="password" activeVariables={activeVars} value={draft.config.token ?? ""} onChange={(v) => updateConfig({ token: v.target.value })} placeholder="access token or {{variable}}" autoComplete="off" style={{ flex: 1 }} />
                <button type="button" onClick={async () => {
                  try {
                    window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: "Obtaining OAuth 2.0 token...", tone: "info" } }));
                    const result = await obtainOAuth2Token(draft.config, buildVariableMap(activeVars));
                    const newConfig = { 
                      ...draft.config,
                      token: result.token, 
                      refreshToken: result.refreshToken || draft.config.refreshToken, 
                      expiresAt: result.expiresAt 
                    };
                    updateConfig(newConfig);
                    if (onTokenObtained) onTokenObtained(newConfig);
                    window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: "Access token obtained successfully!", tone: "success" } }));
                  } catch (err) {
                    window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: "Failed to obtain OAuth 2.0 token: " + (err instanceof Error ? err.message : String(err)), tone: "error", durationMs: 6000 } }));
                  }
                }} style={{ padding: "4px 12px", cursor: "pointer", backgroundColor: "var(--color-primary, #0066cc)", color: "#fff", border: "none", borderRadius: "4px", flexShrink: 0 }}>
                  Get Token
                </button>
                {draft.config.refreshToken && (
                  <button type="button" onClick={async () => {
                    try {
                      window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: "Refreshing OAuth 2.0 token...", tone: "info" } }));
                      const { refreshOAuth2Token, obtainOAuth2Token } = await import("../services/auth");
                      let result;
                      try {
                        result = await refreshOAuth2Token(draft.config, buildVariableMap(activeVars));
                      } catch (refreshErr) {
                        window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: "Refresh token failed or expired. Obtaining new token...", tone: "warning" } }));
                        result = await obtainOAuth2Token(draft.config, buildVariableMap(activeVars));
                      }
                      const newConfig = { 
                        ...draft.config,
                        token: result.token, 
                        refreshToken: result.refreshToken || draft.config.refreshToken, 
                        expiresAt: result.expiresAt 
                      };
                      updateConfig(newConfig);
                      if (onTokenObtained) onTokenObtained(newConfig);
                      window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: "Access token updated successfully!", tone: "success" } }));
                    } catch (err) {
                      window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: "Failed to refresh or obtain OAuth 2.0 token: " + (err instanceof Error ? err.message : String(err)), tone: "error", durationMs: 6000 } }));
                    }
                  }} style={{ padding: "4px 12px", cursor: "pointer", backgroundColor: "var(--color-success, #10b981)", color: "#fff", border: "none", borderRadius: "4px", flexShrink: 0, fontWeight: 600, display: "flex", alignItems: "center", gap: "6px", boxShadow: "0 2px 4px rgba(16, 185, 129, 0.2)" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21v-5h5"/></svg>
                    Refresh
                  </button>
                )}
                <button type="button" className="icon-button" style={{ flexShrink: 0 }} onClick={() => navigator.clipboard.writeText(draft.config.token ?? "")} title="Copy Token" aria-label="Copy Token">
                  <Copy size={16} />
                </button>
              </div>
            </label>
            <div style={{ padding: "12px", background: "linear-gradient(to right, rgba(0, 102, 204, 0.05), transparent)", borderLeft: "3px solid var(--color-primary, #0066cc)", borderRadius: "0 6px 6px 0", marginTop: "4px", marginBottom: "12px" }}>
              <label style={{ margin: 0 }}>
                <span style={{ color: "var(--color-primary, #0066cc)", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21v-5h5"/></svg>
                  Refresh Token
                </span>
                <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                  <VariableInput type="password" activeVariables={activeVars} value={draft.config.refreshToken ?? ""} onChange={(v) => updateConfig({ refreshToken: v.target.value })} placeholder="refresh token or {{variable}}" autoComplete="off" style={{ flex: 1, borderColor: "rgba(0, 102, 204, 0.3)", boxShadow: "0 0 0 1px rgba(0, 102, 204, 0.1)" }} />
                </div>
              </label>
            </div>
            <label>
              <span>Grant Type</span>
              <CustomSelect
                value={draft.config.grantType ?? "client_credentials"}
                onChange={(val) => updateConfig({ grantType: val as "client_credentials" | "password_credentials" | "authorization_code" })}
                options={[
                  { value: "client_credentials", label: "Client Credentials" },
                  { value: "password_credentials", label: "Password Credentials" },
                  { value: "authorization_code", label: "Authorization Code (Browser)" }
                ]}
              />
            </label>
            {draft.config.grantType === "authorization_code" && (
              <label>
                <span>Target URL (Login URL)</span>
                <VariableInput activeVariables={activeVars} value={draft.config.authUrl ?? ""} onChange={(v) => updateConfig({ authUrl: v.target.value })} placeholder="https://example.com/auth or {{variable}}" autoComplete="off" />
              </label>
            )}
            <label>
              <span>Access Token URL</span>
              <VariableInput activeVariables={activeVars} value={draft.config.accessTokenUrl ?? ""} onChange={(v) => updateConfig({ accessTokenUrl: v.target.value })} placeholder="https://example.com/oauth/token or {{variable}}" autoComplete="off" />
            </label>
            <label>
              <span>Client ID</span>
              <VariableInput activeVariables={activeVars} value={draft.config.clientId ?? ""} onChange={(v) => updateConfig({ clientId: v.target.value })} placeholder="client_id or {{variable}}" autoComplete="off" />
            </label>
            <label>
              <span>Client Secret</span>
              <VariableInput type="password" activeVariables={activeVars} value={draft.config.clientSecret ?? ""} onChange={(v) => updateConfig({ clientSecret: v.target.value })} placeholder="client_secret or {{variable}}" autoComplete="new-password" />
            </label>
            {(draft.config.grantType === "password_credentials") && (
              <>
                <label>
                  <span>Username</span>
                  <VariableInput activeVariables={activeVars} value={draft.config.username ?? ""} onChange={(v) => updateConfig({ username: v.target.value })} placeholder="username or {{variable}}" autoComplete="off" />
                </label>
                <label>
                  <span>Password</span>
                  <VariableInput type="password" activeVariables={activeVars} value={draft.config.password ?? ""} onChange={(v) => updateConfig({ password: v.target.value })} placeholder="password or {{variable}}" autoComplete="new-password" />
                </label>
              </>
            )}
            <label>
              <span>Scope</span>
              <VariableInput activeVariables={activeVars} value={draft.config.scope ?? ""} onChange={(v) => updateConfig({ scope: v.target.value })} placeholder="read write or {{variable}}" autoComplete="off" />
            </label>
            <label>
              <span>Audience</span>
              <VariableInput activeVariables={activeVars} value={draft.config.audience ?? ""} onChange={(v) => updateConfig({ audience: v.target.value })} placeholder="audience or {{variable}}" autoComplete="off" />
            </label>
          </div>
        )}

        {draft.mode === "apiKey" && (
          <div className="auth-config-fields" aria-label="API key credentials">
            <label>
              <span>Key name</span>
              <VariableInput activeVariables={activeVars} value={draft.config.keyName ?? ""} onChange={(v) => updateConfig({ keyName: v.target.value })} placeholder="X-API-Key or {{variable}}" autoComplete="off" />
            </label>
            <label>
              <span>Key value</span>
              <VariableInput activeVariables={activeVars} value={draft.config.keyValue ?? ""} onChange={(v) => updateConfig({ keyValue: v.target.value })} placeholder="value or {{variable}}" autoComplete="off" />
            </label>
            <label>
              <span>Add to</span>
              <CustomSelect
                value={draft.config.placement ?? "header"}
                onChange={(val) => updateConfig({ placement: val as "header" | "query" })}
                options={[
                  { value: "header", label: "Header" },
                  { value: "query", label: "Query parameter" }
                ]}
              />
            </label>
          </div>
        )}
    </>
  );
}
