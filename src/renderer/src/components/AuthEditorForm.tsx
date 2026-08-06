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
  onTokenObtained?: (token: string) => void;
}

export function AuthEditorForm({
  draft,
  activeVars,
  onDraftChange,
  onTokenObtained,
}: AuthEditorFormProps) {
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
              <span>Token</span>
              <div style={{ display: "flex", gap: "8px" }}>
                <VariableInput type="password" activeVariables={activeVars} value={draft.config.token ?? ""} onChange={(v) => updateConfig({ token: v.target.value })} placeholder="access token or {{variable}}" autoComplete="off" style={{ flex: 1 }} />
                <button type="button" onClick={async () => {
                  try {
                    window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: "Obtaining OAuth 2.0 token...", tone: "info" } }));
                    const token = await obtainOAuth2Token(draft.config, buildVariableMap(activeVars));
                    updateConfig({ token });
                    if (onTokenObtained) onTokenObtained(token);
                    window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: "Access token obtained successfully!", tone: "success" } }));
                  } catch (err) {
                    window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: "Failed to obtain OAuth 2.0 token: " + (err instanceof Error ? err.message : String(err)), tone: "error", durationMs: 6000 } }));
                  }
                }} style={{ padding: "4px 12px", cursor: "pointer", backgroundColor: "var(--color-primary, #0066cc)", color: "#fff", border: "none", borderRadius: "4px", flexShrink: 0 }}>
                  Get Token
                </button>
                <button type="button" className="icon-button" style={{ flexShrink: 0 }} onClick={() => navigator.clipboard.writeText(draft.config.token ?? "")} title="Copy Token" aria-label="Copy Token">
                  <Copy size={16} />
                </button>
              </div>
            </label>
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
            {draft.config.grantType === "authorization_code" ? (
              <label>
                <span>Target URL (Login URL)</span>
                <VariableInput activeVariables={activeVars} value={draft.config.authUrl ?? ""} onChange={(v) => updateConfig({ authUrl: v.target.value })} placeholder="https://example.com/auth or {{variable}}" autoComplete="off" />
              </label>
            ) : (
              <>
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
                {draft.config.grantType === "password_credentials" && (
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
              </>
            )}
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
