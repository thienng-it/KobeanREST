import { KeyRound, X } from "lucide-react";
import { CustomSelect } from "./CustomSelect";
import { VariableInput } from "./VariableInput";
import { obtainOAuth2Token } from "../services/auth";
import { buildVariableMap } from "../services/variables";
import type { ApiAuthMode, AuthConfig, EnvironmentVariable } from "../types";

const AUTH_MODE_MAP: Record<string, string> = {
  "None": "none", "Basic Auth": "basic", "Bearer Token": "bearer",
  "API Key": "apiKey", "OAuth 2.0": "oauth2", "NTLM": "ntlm", "Kerberos": "kerberos",
};

export type AuthEditorTarget = { id: string; type: "collection" | "folder" } | null;
export type AuthDraft = { mode: ApiAuthMode; config: AuthConfig };

export interface AuthEditorModalProps {
  open: boolean;
  target: AuthEditorTarget;
  draft: AuthDraft;
  activeVars: EnvironmentVariable[];
  onClose: () => void;
  onDraftChange: (draft: AuthDraft) => void;
  onSave: () => void;
}

export function AuthEditorModal({
  open,
  target,
  draft,
  activeVars,
  onClose,
  onDraftChange,
  onSave,
}: AuthEditorModalProps) {
  if (!open) return null;

  const updateConfig = (fields: Partial<AuthConfig>) => {
    onDraftChange({ ...draft, config: { ...draft.config, ...fields } });
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Entity authentication editor"
      onClick={onClose}
    >
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "500px", maxWidth: "90vw", display: "flex", flexDirection: "column", gap: "16px" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: "16px" }}>
            Authentication for {target?.type === "folder" ? "Folder" : "Collection"}
          </h2>
          <button type="button" onClick={onClose} style={{ all: "unset", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>

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
              <VariableInput activeVariables={activeVars} value={draft.config.token ?? ""} onChange={(v) => updateConfig({ token: v.target.value })} placeholder="token or {{variable}}" autoComplete="off" />
            </label>
          </div>
        )}

        {draft.mode === "oauth2" && (
          <div className="auth-config-fields" aria-label="OAuth 2.0 credentials" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <label>
              <span>Token</span>
              <div style={{ display: "flex", gap: "8px" }}>
                <VariableInput activeVariables={activeVars} value={draft.config.token ?? ""} onChange={(v) => updateConfig({ token: v.target.value })} placeholder="access token or {{variable}}" autoComplete="off" style={{ flex: 1 }} />
                <button type="button" onClick={async () => {
                  try {
                    const token = await obtainOAuth2Token(draft.config, buildVariableMap(activeVars));
                    updateConfig({ token });
                    alert("Access token obtained successfully!");
                  } catch (err) {
                    alert("Failed to obtain OAuth 2.0 token: " + (err instanceof Error ? err.message : String(err)));
                  }
                }} style={{ padding: "4px 12px", cursor: "pointer", backgroundColor: "var(--color-primary, #0066cc)", color: "#fff", border: "none", borderRadius: "4px" }}>
                  Get Token
                </button>
              </div>
            </label>
            <label>
              <span>Grant Type</span>
              <CustomSelect
                value={draft.config.grantType ?? "client_credentials"}
                onChange={(val) => updateConfig({ grantType: val as "client_credentials" | "password" })}
                options={[
                  { value: "client_credentials", label: "Client Credentials" },
                  { value: "password", label: "Password" }
                ]}
              />
            </label>
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
            {draft.config.grantType === "password" && (
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

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
          <button className="modal-cancel" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="modal-confirm" type="button" onClick={onSave}>
            Save Authentication
          </button>
        </div>
      </div>
    </div>
  );
}
