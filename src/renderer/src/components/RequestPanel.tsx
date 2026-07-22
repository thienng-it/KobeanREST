import { ChevronDown, Code2, Plus, Play, Save, Settings, Trash2, WandSparkles } from "lucide-react";
import { useEffect, useRef, useState, type ClipboardEvent, type CSSProperties, type MutableRefObject } from "react";
import { createPortal } from "react-dom";
import { MethodSelector } from "./MethodSelector";
import { ScriptEditor } from "./ScriptEditor";
import { VariableInput, VariableTextarea } from "./VariableInput";
import { obtainOAuth2Token } from "../services/auth";
import { buildVariableMap } from "../services/variables";
import {
  SCRIPT_EDITOR_MODES,
  SCRIPT_SNIPPETS,
  SCRIPT_SNIPPET_GROUPS,
  snippetsForGroup,
  type RequestCodeSnippetTarget,
  type ScriptEditorMode,
} from "../services/script-tools";
import type { ApiAuthMode, AuthConfig, EnvironmentVariable, SavedRequest, WorkspaceSummary } from "../types";

type RequestHeader = SavedRequest["headers"][number];
type ScriptOutputEntry = { tone: "info" | "error"; message: string };

const authModes = ["None", "Basic Auth", "Bearer Token", "API Key", "OAuth 2.0", "NTLM", "Kerberos"] as const;
const AUTH_MODE_LABELS: Record<string, string> = {
  none: "None", basic: "Basic Auth", bearer: "Bearer Token",
  apiKey: "API Key", oauth2: "OAuth 2.0", ntlm: "NTLM", kerberos: "Kerberos"
};
const AUTH_MODE_MAP: Record<string, string> = {
  "None": "none", "Basic Auth": "basic", "Bearer Token": "bearer",
  "API Key": "apiKey", "OAuth 2.0": "oauth2", "NTLM": "ntlm", "Kerberos": "kerberos"
};

const HEADER_PRESET_MENU_GAP = 6;
const HEADER_PRESET_MENU_PADDING = 16;
const HEADER_PRESET_MENU_MIN_WIDTH = 212;
const HEADER_PRESET_MENU_MIN_HEIGHT = 120;
const HEADER_PRESET_MENU_MAX_HEIGHT = 280;

const commonHeaderPresets = [
  { label: "Accept", key: "Accept", value: "application/json" },
  { label: "Content-Type", key: "Content-Type", value: "application/json" },
  { label: "Authorization", key: "Authorization", value: "Bearer " },
  { label: "X-Request-Id", key: "X-Request-Id", value: "" },
];

function createBlankHeader(): RequestHeader {
  return { key: "", value: "", enabled: true };
}

interface HeaderPresetMenuLayout {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  placement: "top" | "bottom";
}

function getHeaderPresetMenuLayout(
  triggerRect: Pick<DOMRect, "top" | "bottom" | "left" | "right" | "width">,
  menuHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): HeaderPresetMenuLayout {
  const width = Math.max(Math.round(triggerRect.width), HEADER_PRESET_MENU_MIN_WIDTH);
  const left = Math.min(
    Math.max(HEADER_PRESET_MENU_PADDING, Math.round(triggerRect.right - width)),
    Math.max(HEADER_PRESET_MENU_PADDING, viewportWidth - width - HEADER_PRESET_MENU_PADDING),
  );
  const availableBelow = Math.max(viewportHeight - triggerRect.bottom - HEADER_PRESET_MENU_PADDING, 0);
  const availableAbove = Math.max(triggerRect.top - HEADER_PRESET_MENU_PADDING, 0);
  const placement =
    availableBelow < Math.min(menuHeight, 220) && availableAbove > availableBelow
      ? "top"
      : "bottom";
  const availableSpace = placement === "top" ? availableAbove : availableBelow;
  const maxHeight = Math.max(
    HEADER_PRESET_MENU_MIN_HEIGHT,
    Math.min(HEADER_PRESET_MENU_MAX_HEIGHT, Math.floor(availableSpace)),
  );
  const renderedHeight = Math.min(menuHeight, maxHeight);
  const top =
    placement === "top"
      ? Math.max(HEADER_PRESET_MENU_PADDING, Math.round(triggerRect.top - HEADER_PRESET_MENU_GAP - renderedHeight))
      : Math.min(
          Math.round(triggerRect.bottom + HEADER_PRESET_MENU_GAP),
          Math.max(HEADER_PRESET_MENU_PADDING, viewportHeight - HEADER_PRESET_MENU_PADDING - renderedHeight),
        );

  return { left, top, width, maxHeight, placement };
}

function parsePastedHeaders(text: string): RequestHeader[] {
  const parsed: RequestHeader[] = [];

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const separatorIndex = trimmed.indexOf(":");
    if (separatorIndex <= 0) continue;

    parsed.push({
      key: trimmed.slice(0, separatorIndex).trim(),
      value: trimmed.slice(separatorIndex + 1).trim(),
      enabled: true,
    });
  }

  return parsed;
}

function getEffectiveAuth(request: SavedRequest, workspace: WorkspaceSummary | null) {
  if (!workspace) {
    return { mode: "none" as const, config: {}, source: "No workspace loaded" };
  }

  if (request.authMode !== "none") {
    return { mode: request.authMode, config: request.authConfig, source: "Request level" };
  }

  const folder = workspace?.folders.find((item) => item.id === request.folderId);
  if (folder?.authMode && folder.authMode !== "none") {
    return { mode: folder.authMode, config: folder.authConfig ?? {}, source: `Inherited from folder: ${folder.name}` };
  }

  const collection = workspace?.collections?.find((item) => folder?.collectionId === item.id);
  if (collection?.authMode && collection.authMode !== "none") {
    return { mode: collection.authMode, config: collection.authConfig ?? {}, source: `Inherited from collection: ${collection.name}` };
  }

  return { mode: "none" as const, config: {}, source: "No inherited auth" };
}

function describeAuthTarget(mode: ApiAuthMode, config: AuthConfig): string {
  switch (mode) {
    case "basic":
      return config.username || config.password ? "Authorization header" : "Username or password missing";
    case "bearer":
      return config.token ? "Authorization: Bearer [hidden]" : "Token missing";
    case "oauth2":
      if (config.token) return "Authorization: Bearer [hidden]";
      return config.accessTokenUrl ? "Token requested before send" : "Access token missing";
    case "apiKey":
      if (!config.keyName) return "Key name missing";
      if (!config.keyValue) return `${config.keyName} value missing`;
      return config.placement === "query" ? `Query param: ${config.keyName}` : `Header: ${config.keyName}`;
    case "ntlm":
    case "kerberos":
      return "Not applied by sender yet";
    default:
      return "No auth will be sent";
  }
}

export interface RequestPanelProps {
  draftRequest: SavedRequest;
  activeVars: EnvironmentVariable[];
  isSending: boolean;
  requestPath: string;
  effectiveAuth: ReturnType<typeof getEffectiveAuth> | null;

  // request-panel local UI state (owned by App)
  activeTab: "body" | "headers" | "auth" | "scripts" | "settings";
  setActiveTab: (tab: "body" | "headers" | "auth" | "scripts" | "settings") => void;
  preScript: string;
  setPreScript: (value: string) => void;
  postScript: string;
  setPostScript: (value: string) => void;
  preScriptDirty: boolean;
  postScriptDirty: boolean;
  scriptsDirty: boolean;
  activeRequestScript: "pre" | "post";
  setActiveRequestScript: (value: "pre" | "post") => void;
  scriptEditorMode: ScriptEditorMode;
  setScriptEditorMode: (value: ScriptEditorMode) => void;
  activeSnippetId: string;
  setActiveSnippetId: (value: string) => void;
  scriptOutputLog: ScriptOutputEntry[];
  scriptOutputExpanded: boolean;
  setScriptOutputExpanded: (value: boolean | ((prev: boolean) => boolean)) => void;
  headersPresetMenuOpen: boolean;
  setHeadersPresetMenuOpen: (value: boolean | ((prev: boolean) => boolean)) => void;

  // cross-cutting actions (remain in App)
  onUpdateDraft: (fields: Partial<SavedRequest>) => void;
  onSaveRequest: () => void;
  onSendRequest: () => void;
  onSaveScripts: () => void;

  // script-insertion handlers (shared with request-code modal; remain in App)
  scriptEditorActionsRef: MutableRefObject<{ insertText: (text: string) => void } | null>;
  onInsertScriptToken: (token: string) => void;
  onPrettifyScript: () => void;
  onInsertSelectedScriptSnippet: () => void;
  onOpenRequestCode: () => void;

  // diagnostic for prettify errors
  diagnosticMessage: (error: unknown) => string;
}

export function RequestPanel({
  draftRequest,
  activeVars,
  isSending,
  requestPath,
  effectiveAuth,
  activeTab,
  setActiveTab,
  preScript,
  setPreScript,
  postScript,
  setPostScript,
  preScriptDirty,
  postScriptDirty,
  scriptsDirty,
  activeRequestScript,
  setActiveRequestScript,
  scriptEditorMode,
  setScriptEditorMode,
  activeSnippetId,
  setActiveSnippetId,
  scriptOutputLog,
  scriptOutputExpanded,
  setScriptOutputExpanded,
  headersPresetMenuOpen,
  setHeadersPresetMenuOpen,
  onUpdateDraft,
  onSaveRequest,
  onSendRequest,
  onSaveScripts,
  scriptEditorActionsRef,
  onInsertScriptToken,
  onPrettifyScript,
  onInsertSelectedScriptSnippet,
  onOpenRequestCode,
  diagnosticMessage,
}: RequestPanelProps) {
  const currentScriptValue = activeRequestScript === "pre" ? preScript : postScript;
  const selectedScriptSnippet = SCRIPT_SNIPPETS.find((snippet) => snippet.id === activeSnippetId) ?? SCRIPT_SNIPPETS[0];
  const scriptRuntimeTokens = activeRequestScript === "pre"
    ? ["request.url", "request.method", "request.headers", "variables.get(key)", "variables.set(key, value)"]
    : ["request.url", "request.method", "request.headers", "response.status", "response.body", "variables.get(key)", "variables.set(key, value)"];
  const scriptVariableTokens = activeVars.map((variable) => `{{${variable.key}}}`);
  const currentScriptTitle = activeRequestScript === "pre" ? "Pre-request Script" : "Post-request Script";

  // --- local editing helpers ---
  function updateDraft(fields: Partial<SavedRequest>) {
    onUpdateDraft(fields);
  }

  function updateHeaderField(index: number, field: "key" | "value", value: string) {
    const headers = [...draftRequest.headers];
    headers[index] = { ...headers[index], [field]: value };
    updateDraft({ headers });
  }

  function toggleHeaderEnabled(index: number, enabled: boolean) {
    const headers = [...draftRequest.headers];
    headers[index] = { ...headers[index], enabled };
    updateDraft({ headers });
  }

  function removeHeader(index: number) {
    updateDraft({ headers: draftRequest.headers.filter((_, headerIndex) => headerIndex !== index) });
  }

  function addHeader(nextHeader: RequestHeader = createBlankHeader()) {
    updateDraft({ headers: [...draftRequest.headers, nextHeader] });
  }

  function insertCommonHeader(key: string, value: string) {
    addHeader({ key, value, enabled: true });
    setHeadersPresetMenuOpen(false);
  }

  function updateAuthConfig(fields: Partial<AuthConfig>) {
    onUpdateDraft({ authConfig: { ...draftRequest.authConfig, ...fields } });
  }

  function handleHeaderPaste(index: number, event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData("text");
    if (!text) return;

    const parsedHeaders = parsePastedHeaders(text);
    const looksLikeStructuredPaste =
      parsedHeaders.length > 1 ||
      (parsedHeaders.length === 1 &&
        (text.includes("\n") ||
          (draftRequest.headers[index].key.trim() === "" && draftRequest.headers[index].value.trim() === "")));

    if (!looksLikeStructuredPaste || parsedHeaders.length === 0) {
      return;
    }

    event.preventDefault();

    const headers = [...draftRequest.headers];
    headers[index] = parsedHeaders[0];
    if (parsedHeaders.length > 1) {
      headers.splice(index + 1, 0, ...parsedHeaders.slice(1));
    }
    updateDraft({ headers });
  }

  const headersPresetMenuRef = useRef<HTMLDivElement | null>(null);
  const headersPresetTriggerRef = useRef<HTMLButtonElement | null>(null);
  const headersPresetDropdownRef = useRef<HTMLDivElement | null>(null);
  const [headersPresetMenuLayout, setHeadersPresetMenuLayout] = useState<HeaderPresetMenuLayout | null>(null);

  useEffect(() => {
    if (!headersPresetMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (headersPresetMenuRef.current?.contains(target) || headersPresetDropdownRef.current?.contains(target)) {
        return;
      }
      setHeadersPresetMenuOpen(false);
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [headersPresetMenuOpen, setHeadersPresetMenuOpen]);

  useEffect(() => {
    if (!headersPresetMenuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setHeadersPresetMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [headersPresetMenuOpen, setHeadersPresetMenuOpen]);

  useEffect(() => {
    if (!headersPresetMenuOpen) return;

    const updateLayout = () => {
      if (!headersPresetTriggerRef.current) return;
      const triggerRect = headersPresetTriggerRef.current.getBoundingClientRect();
      const menuHeight = headersPresetDropdownRef.current?.scrollHeight ?? 220;
      setHeadersPresetMenuLayout(
        getHeaderPresetMenuLayout(triggerRect, menuHeight, window.innerWidth, window.innerHeight),
      );
    };

    updateLayout();
    const frame = window.requestAnimationFrame(updateLayout);
    window.addEventListener("resize", updateLayout);
    window.addEventListener("scroll", updateLayout, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateLayout);
      window.removeEventListener("scroll", updateLayout, true);
    };
  }, [headersPresetMenuOpen]);

  useEffect(() => {
    if (!headersPresetMenuOpen) {
      setHeadersPresetMenuLayout(null);
    }
  }, [headersPresetMenuOpen]);

  return (
    <section className="request-panel" aria-label="Request builder">
      <div className="request-header">
        <div className="request-identity">
          <span className="muted-label">Request</span>
          <div className="request-title-row">
            <h1>{draftRequest.name}</h1>
          </div>
          <div className="request-path">{requestPath}</div>
        </div>
        <div className="request-header-actions">
          <button
            className="ghost-button request-save-button"
            type="button"
            onClick={onSaveRequest}
            title="Save (Cmd/Ctrl + S)"
          >
            <Save size={17} />
            Save
          </button>
        </div>
      </div>

      <div className="request-command-bar">
        <MethodSelector
          method={draftRequest.method}
          customMethod={draftRequest.customMethod}
          onChange={(m, cm) => updateDraft({ method: m, customMethod: cm })}
        />
        <VariableInput
          activeVariables={activeVars}
          value={draftRequest.url}
          aria-label="Request URL"
          onChange={(e) => updateDraft({ url: e.target.value })}
          placeholder="https://api.example.com"
          containerClassName="request-command-input"
          className="request-command-input-field"
          containerStyle={{ flex: 1 } as CSSProperties}
        />
        <button
          className="send-button request-send-button"
          type="button"
          onClick={onSendRequest}
          disabled={isSending}
        >
          <Play size={17} />
          {isSending ? "Sending" : "Send"}
        </button>
      </div>

      <div className="request-workspace">
        <div className="tab-row" role="tablist" aria-label="Request configuration">
          {(["body", "headers", "auth", "scripts", "settings"] as const).map((tab) => {
            const hasScript = tab === "scripts" && (preScript.trim() !== "" || postScript.trim() !== "");
            const scriptUnsaved = tab === "scripts" && scriptsDirty;
            return (
              <button
                className={activeTab === tab ? "tab active" : "tab"}
                key={tab}
                onClick={() => setActiveTab(tab)}
                role="tab"
                type="button"
              >
                {tab}
                {hasScript && (
                  <span
                    className={`tab-script-indicator${scriptUnsaved ? " dirty" : ""}`}
                    title={scriptUnsaved ? "Scripts have unsaved changes" : "Scripts configured"}
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>

        {activeTab === "body" && (
          <div className="request-tab-panel request-body-panel">
            <div className="request-body-toolbar">
              <label>Content-Type</label>
              <select
                value={draftRequest.bodyMimeType}
                onChange={(e) => {
                  const newMimeType = e.target.value;
                  const updates: any = { bodyMimeType: newMimeType };
                  if (["application/x-www-form-urlencoded", "multipart/form-data"].includes(newMimeType)) {
                    updates.bodyForm = draftRequest.bodyForm ?? [];
                  }
                  updateDraft(updates);
                }}
              >
                <option value="text/plain">Text (plain)</option>
                <option value="application/json">JSON</option>
                <option value="application/xml">XML</option>
                <option value="text/xml">XML</option>
                <option value="application/x-www-form-urlencoded">Form URL Encoded</option>
                <option value="multipart/form-data">Multipart Form Data</option>
                <option value="application/octet-stream">Binary</option>
              </select>
            </div>

            {["application/x-www-form-urlencoded", "multipart/form-data"].includes(draftRequest.bodyMimeType) ? (
              <div className="table-like" aria-label="Body form data">
                {(draftRequest.bodyForm ?? []).map((item, idx) => (
                  <div className="table-row" key={idx} style={{ display: 'flex', gap: '8px', padding: '4px 0', borderBottom: '1px solid var(--color-border)' }}>
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={(e) => {
                        const form = [...(draftRequest.bodyForm ?? [])];
                        form[idx].enabled = e.target.checked;
                        updateDraft({ bodyForm: form });
                      }}
                    />
                    <VariableInput
                      activeVariables={activeVars}
                      value={item.key}
                      placeholder="Key"
                      onChange={(e) => {
                        const form = [...(draftRequest.bodyForm ?? [])];
                        form[idx].key = e.target.value;
                        updateDraft({ bodyForm: form });
                      }}
                      style={{ backgroundColor: 'transparent', border: 'none' }}
                      containerStyle={{ flex: 1 } as CSSProperties}
                    />
                    <VariableInput
                      activeVariables={activeVars}
                      value={item.value}
                      placeholder="Value"
                      onChange={(e) => {
                        const form = [...(draftRequest.bodyForm ?? [])];
                        form[idx].value = e.target.value;
                        updateDraft({ bodyForm: form });
                      }}
                      style={{ backgroundColor: 'transparent', border: 'none' }}
                      containerStyle={{ flex: 2 } as CSSProperties}
                    />
                    <button type="button" onClick={() => {
                      const form = (draftRequest.bodyForm ?? []).filter((_, i) => i !== idx);
                      updateDraft({ bodyForm: form });
                    }} style={{ all: 'unset', cursor: 'pointer', padding: '4px', opacity: 0.7 }}><Trash2 size={14}/></button>
                  </div>
                ))}
                <button type="button" className="ghost-button" onClick={() => {
                  updateDraft({ bodyForm: [...(draftRequest.bodyForm ?? []), { key: '', value: '', enabled: true }] });
                }} style={{ marginTop: '8px' }}>
                  <Plus size={14}/> Add Field
                </button>
              </div>
            ) : (
              <VariableTextarea
                activeVariables={activeVars}
                className="editor request-body-editor"
                containerClassName="request-body-editor-shell"
                containerStyle={{ flex: 1, minHeight: 0 } as CSSProperties}
                aria-label="Request body"
                value={draftRequest.body}
                onChange={(e) => updateDraft({ body: e.target.value })}
                placeholder="// Request body"
                style={{ width: '100%', height: '100%', minHeight: '100%', padding: '12px 14px', fontFamily: 'monospace', resize: 'none' } as CSSProperties}
              />
            )}
          </div>
        )}
      {activeTab === "headers" && (
        <div className="request-tab-panel">
          <div className="headers-editor" aria-label="Request headers">
            <div className="headers-table">
              <div className="headers-table-toolbar">
                <div className="headers-toolbar-actions">
                  <div className="headers-common-menu-wrap" ref={headersPresetMenuRef}>
                    <button
                      ref={headersPresetTriggerRef}
                      type="button"
                      className="ghost-button"
                      aria-label="Common header presets"
                      aria-haspopup="listbox"
                      aria-expanded={headersPresetMenuOpen}
                      onClick={() => setHeadersPresetMenuOpen((open) => !open)}
                    >
                      Common
                      <ChevronDown size={14} />
                    </button>
                    {headersPresetMenuOpen && createPortal(
                      <div
                        ref={headersPresetDropdownRef}
                        className="headers-common-menu"
                        role="listbox"
                        aria-label="Common header presets"
                        data-placement={headersPresetMenuLayout?.placement ?? "bottom"}
                        style={{
                          top: headersPresetMenuLayout?.top ?? 0,
                          left: headersPresetMenuLayout?.left ?? 0,
                          width: headersPresetMenuLayout?.width,
                          maxHeight: headersPresetMenuLayout?.maxHeight,
                          visibility: headersPresetMenuLayout ? "visible" : "hidden",
                        } as CSSProperties}
                      >
                        {commonHeaderPresets.map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            className="headers-common-option"
                            onClick={() => insertCommonHeader(preset.key, preset.value)}
                          >
                            <span>{preset.label}</span>
                            <small>{preset.value || "Custom value"}</small>
                          </button>
                        ))}
                      </div>,
                      document.body,
                    )}
                  </div>
                  <button
                    type="button"
                    className="ghost-button headers-add-button"
                    onClick={() => addHeader()}
                  >
                    <Plus size={14} /> Add Header
                  </button>
                </div>
              </div>

              <div className="headers-grid-body">
                <div className="headers-grid-header" aria-hidden="true">
                  <span>On</span>
                  <span>Key</span>
                  <span>Value</span>
                  <span>Actions</span>
                </div>

                <div className="headers-rows">
                  {draftRequest.headers.map((header, idx) => {
                    return (
                      <div className={header.enabled ? "headers-row" : "headers-row headers-row-disabled"} key={idx}>
                        <label className="headers-toggle">
                          <input
                            type="checkbox"
                            checked={header.enabled}
                            onChange={(e) => toggleHeaderEnabled(idx, e.target.checked)}
                          />
                        </label>

                        <VariableInput
                          activeVariables={activeVars}
                          value={header.key}
                          placeholder="Header key"
                          onChange={(e) => updateHeaderField(idx, "key", e.target.value)}
                          onPaste={(e) => handleHeaderPaste(idx, e)}
                          className="headers-row-input-field"
                          containerClassName="headers-row-input"
                        />

                        <VariableInput
                          activeVariables={activeVars}
                          value={header.value}
                          placeholder="Header value"
                          onChange={(e) => updateHeaderField(idx, "value", e.target.value)}
                          onPaste={(e) => handleHeaderPaste(idx, e)}
                          className="headers-row-input-field"
                          containerClassName="headers-row-input"
                        />

                        <div className="headers-actions">
                          <button
                            type="button"
                            className="icon-button headers-delete-button"
                            aria-label={`Delete header ${header.key || idx + 1}`}
                            onClick={() => removeHeader(idx)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
  {activeTab === "auth" && (
    <div className="request-tab-panel auth-panel" aria-label="API request authentication">
          <div className="auth-panel-grid">
            <label className="auth-method-card">
              <span>Authentication Method</span>
              <select
                value={draftRequest.authMode}
                onChange={(e) => updateDraft({ authMode: e.target.value as ApiAuthMode })}
              >
                {authModes.map((mode) => (
                  <option key={AUTH_MODE_MAP[mode]} value={AUTH_MODE_MAP[mode]}>{mode}</option>
                ))}
              </select>
            </label>

            <div className="auth-effective-card">
              <span>Will Send</span>
              <strong>{effectiveAuth ? describeAuthTarget(effectiveAuth.mode, effectiveAuth.config) : "No auth will be sent"}</strong>
              {effectiveAuth && <small>{effectiveAuth.source} · {AUTH_MODE_LABELS[effectiveAuth.mode]}</small>}
            </div>
          </div>

          {draftRequest.authMode === "basic" && (
            <div className="auth-config-fields" aria-label="Basic auth credentials">
              <label>
                <span>Username</span>
                <VariableInput activeVariables={activeVars} value={draftRequest.authConfig?.username ?? ""} onChange={e => updateAuthConfig({ username: e.target.value })} placeholder="username or {{variable}}" autoComplete="off" />
              </label>
              <label>
                <span>Password</span>
                <VariableInput type="password" activeVariables={activeVars} value={draftRequest.authConfig?.password ?? ""} onChange={e => updateAuthConfig({ password: e.target.value })} placeholder="password or {{variable}}" autoComplete="new-password" />
              </label>
            </div>
          )}
          {draftRequest.authMode === "bearer" && (
            <div className="auth-config-fields" aria-label="Bearer token credential">
              <label>
                <span>Token</span>
                <VariableInput activeVariables={activeVars} value={draftRequest.authConfig?.token ?? ""} onChange={e => updateAuthConfig({ token: e.target.value })} placeholder="token or {{variable}}" autoComplete="off" />
              </label>
            </div>
          )}
          {draftRequest.authMode === "oauth2" && (
            <div className="auth-config-fields" aria-label="OAuth 2.0 credentials" style={{ display: 'flex', flexDirection: 'column', gap: '12px' } as CSSProperties}>
              <label>
                <span>Token</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <VariableInput activeVariables={activeVars} value={draftRequest.authConfig?.token ?? ""} onChange={e => updateAuthConfig({ token: e.target.value })} placeholder="access token or {{variable}}" autoComplete="off" style={{ flex: 1 } as CSSProperties} />
                  <button className="primary-action" type="button" onClick={async () => {
                    try {
                      const token = await obtainOAuth2Token(draftRequest.authConfig ?? {}, buildVariableMap(activeVars));
                      updateAuthConfig({ token });
                      alert("Access token obtained successfully!");
                    } catch (err) {
                      alert("Failed to obtain OAuth 2.0 token: " + (err instanceof Error ? err.message : String(err)));
                    }
                  }}>
                    Get Token
                  </button>
                </div>
              </label>
              <label>
                <span>Grant Type</span>
                <select value={draftRequest.authConfig?.grantType ?? "client_credentials"} onChange={e => updateAuthConfig({ grantType: e.target.value as "client_credentials" | "password" })}>
                  <option value="client_credentials">Client Credentials</option>
                  <option value="password">Password</option>
                </select>
              </label>
              <label>
                <span>Access Token URL</span>
                <VariableInput activeVariables={activeVars} value={draftRequest.authConfig?.accessTokenUrl ?? ""} onChange={e => updateAuthConfig({ accessTokenUrl: e.target.value })} placeholder="https://example.com/oauth/token or {{variable}}" autoComplete="off" />
              </label>
              <label>
                <span>Client ID</span>
                <VariableInput activeVariables={activeVars} value={draftRequest.authConfig?.clientId ?? ""} onChange={e => updateAuthConfig({ clientId: e.target.value })} placeholder="client_id or {{variable}}" autoComplete="off" />
              </label>
              <label>
                <span>Client Secret</span>
                <VariableInput type="password" activeVariables={activeVars} value={draftRequest.authConfig?.clientSecret ?? ""} onChange={e => updateAuthConfig({ clientSecret: e.target.value })} placeholder="client_secret or {{variable}}" autoComplete="new-password" />
              </label>
              {(draftRequest.authConfig?.grantType === "password") && (
                <>
                  <label>
                    <span>Username</span>
                    <VariableInput activeVariables={activeVars} value={draftRequest.authConfig?.username ?? ""} onChange={e => updateAuthConfig({ username: e.target.value })} placeholder="username or {{variable}}" autoComplete="off" />
                  </label>
                  <label>
                    <span>Password</span>
                    <VariableInput type="password" activeVariables={activeVars} value={draftRequest.authConfig?.password ?? ""} onChange={e => updateAuthConfig({ password: e.target.value })} placeholder="password or {{variable}}" autoComplete="new-password" />
                  </label>
                </>
              )}
              <label>
                <span>Scope</span>
                <VariableInput activeVariables={activeVars} value={draftRequest.authConfig?.scope ?? ""} onChange={e => updateAuthConfig({ scope: e.target.value })} placeholder="read write or {{variable}}" autoComplete="off" />
              </label>
              <label>
                <span>Audience</span>
                <VariableInput activeVariables={activeVars} value={draftRequest.authConfig?.audience ?? ""} onChange={e => updateAuthConfig({ audience: e.target.value })} placeholder="audience or {{variable}}" autoComplete="off" />
              </label>
            </div>
          )}
          {draftRequest.authMode === "apiKey" && (
            <div className="auth-config-fields" aria-label="API key credentials">
              <label>
                <span>Key name</span>
                <VariableInput activeVariables={activeVars} value={draftRequest.authConfig?.keyName ?? ""} onChange={e => updateAuthConfig({ keyName: e.target.value })} placeholder="X-API-Key or {{variable}}" autoComplete="off" />
              </label>
              <label>
                <span>Key value</span>
                <VariableInput activeVariables={activeVars} value={draftRequest.authConfig?.keyValue ?? ""} onChange={e => updateAuthConfig({ keyValue: e.target.value })} placeholder="value or {{variable}}" autoComplete="off" />
              </label>
              <label>
                <span>Add to</span>
                <select value={draftRequest.authConfig?.placement ?? "header"} onChange={e => updateAuthConfig({ placement: e.target.value as "header" | "query" })}>
                  <option value="header">Header</option>
                  <option value="query">Query parameter</option>
                </select>
              </label>
            </div>
          )}
        </div>
      )}
      {activeTab === "scripts" && (
      <div className="request-tab-panel request-scripts-panel">
        <div className="script-workspace">
          <div className="script-workspace-toolbar">
            <div className="script-type-segment" role="tablist" aria-label="Request script type">
              <button
                className={activeRequestScript === "pre" ? "script-type-option active" : "script-type-option"}
                onClick={() => setActiveRequestScript("pre")}
                role="tab"
                type="button"
                aria-selected={activeRequestScript === "pre"}
                title={
                  preScript.trim() === ""
                    ? "No pre-request script"
                    : preScriptDirty
                      ? "Pre-request script has unsaved changes"
                      : "Pre-request script saved"
                }
              >
                Pre-request
                {preScript.trim() !== "" && (
                  <span className={`script-dot${preScriptDirty ? " dirty" : ""}`} aria-hidden="true" />
                )}
              </button>
              <button
                className={activeRequestScript === "post" ? "script-type-option active" : "script-type-option"}
                onClick={() => setActiveRequestScript("post")}
                role="tab"
                type="button"
                aria-selected={activeRequestScript === "post"}
                title={
                  postScript.trim() === ""
                    ? "No post-request script"
                    : postScriptDirty
                      ? "Post-request script has unsaved changes"
                      : "Post-request script saved"
                }
              >
                Post-request
                {postScript.trim() !== "" && (
                  <span className={`script-dot${postScriptDirty ? " dirty" : ""}`} aria-hidden="true" />
                )}
              </button>
            </div>
            <button
              className={`ghost-button script-workspace-save${scriptsDirty ? " dirty" : ""}`}
              type="button"
              onClick={onSaveScripts}
              disabled={!scriptsDirty}
              aria-label={scriptsDirty ? "Save scripts (pending edits)" : "Scripts saved"}
              title={scriptsDirty ? "Pending edits — click to save" : "All scripts saved"}
            >
              <Save size={14} />
              <span>{scriptsDirty ? "Save Scripts" : "Saved"}</span>
            </button>
          </div>
          <div className="script-tool-row">
            <label className="script-tool-group">
              <span className="script-tool-label">Language</span>
              <select
                className="script-tool-select"
                value={scriptEditorMode}
                onChange={(event) => setScriptEditorMode(event.target.value as ScriptEditorMode)}
                aria-label="Script editor type"
              >
                {SCRIPT_EDITOR_MODES.map((mode) => (
                  <option key={mode.value} value={mode.value}>{mode.label}</option>
                ))}
              </select>
            </label>
            <button
              className="ghost-button script-tool-action"
              type="button"
              onClick={onPrettifyScript}
              aria-label="Prettify current script"
            >
              <WandSparkles size={14} />
              Prettify
            </button>
            <label className="script-tool-group script-tool-group-fill">
              <span className="script-tool-label">Template</span>
              <select
                className="script-tool-select"
                value={activeSnippetId}
                onChange={(event) => setActiveSnippetId(event.target.value)}
                aria-label="Script snippet"
              >
                {SCRIPT_SNIPPET_GROUPS.map((group) => {
                  const items = snippetsForGroup(group);
                  if (items.length === 0) return null;
                  return (
                    <optgroup key={group.label} label={group.label}>
                      {items.map((snippet) => (
                        <option key={snippet.id} value={snippet.id}>{snippet.label}</option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </label>
            <button
              className="ghost-button script-tool-action script-tool-action-primary"
              type="button"
              onClick={onInsertSelectedScriptSnippet}
              aria-label="Insert selected script snippet"
            >
              Insert
            </button>
            <select
              className="script-helper-select"
              value=""
              onChange={(event) => {
                if (event.target.value) onInsertScriptToken(event.target.value);
              }}
              aria-label="Insert script helper"
            >
              <option value="">Insert helper…</option>
              <optgroup label="Runtime">
                {scriptRuntimeTokens.map((token) => (
                  <option key={token} value={token}>{token}</option>
                ))}
              </optgroup>
              <optgroup label="Variables">
                {scriptVariableTokens.map((token) => (
                  <option key={token} value={token}>{token}</option>
                ))}
              </optgroup>
            </select>
            <button
              className="ghost-button script-tool-action script-code-button"
              type="button"
              onClick={onOpenRequestCode}
              aria-label="Open request code"
            >
              <Code2 size={14} />
              Code
            </button>
          </div>
          <div className="script-editor-frame">
            <div className="script-editor-shell">
              <ScriptEditor
                key={activeRequestScript}
                value={currentScriptValue}
                onChange={activeRequestScript === "pre" ? setPreScript : setPostScript}
                variables={activeVars.map(v => v.key)}
                placeholder={activeRequestScript === "pre" ? "// Runs before the request. Use request and variables." : "// Runs after the response. Use request, response, and variables."}
                height="100%"
                onReady={(actions) => {
                  scriptEditorActionsRef.current = actions;
                }}
              />
            </div>
            <section className="script-console" aria-label="Script console">
              <button
                className="script-console-toggle"
                type="button"
                aria-expanded={scriptOutputExpanded}
                aria-controls="script-console-content"
                onClick={() => setScriptOutputExpanded((expanded) => !expanded)}
              >
                <span>Console</span>
                <span>{scriptOutputLog.length}</span>
                <ChevronDown className={scriptOutputExpanded ? "script-console-chevron open" : "script-console-chevron"} size={14} />
              </button>
              {scriptOutputExpanded && (
                <div id="script-console-content" className="script-console-content">
                  {scriptOutputLog.length === 0 ? (
                    <span className="script-output-empty">Script output will appear here after prettify or send.</span>
                  ) : (
                    scriptOutputLog.map((entry, index) => (
                      <div key={`${entry.message}-${index}`} className={`script-output-line ${entry.tone}`}>
                        {entry.message}
                      </div>
                    ))
                  )}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
      )}
      {activeTab === "settings" && (
        <div className="request-tab-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' } as CSSProperties}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Settings size={14} /> Request Settings
            </label>
            <div style={{ display: 'grid', gap: '12px', padding: '12px', borderRadius: '6px', background: 'var(--color-surface-muted)', border: '1px solid var(--color-border)' }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', fontSize: '13px', color: 'var(--color-text)' }}>
                <span>Timeout (ms)</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    value={draftRequest.timeoutMs ?? ""}
                    onChange={(e) => updateDraft({ timeoutMs: parseInt(e.target.value) || undefined })}
                    style={{ width: '80px', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '4px' }}
                  />
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => updateDraft({ timeoutMs: undefined })}
                    disabled={draftRequest.timeoutMs === undefined}
                    style={{ padding: '2px 6px', fontSize: '11px' }}
                  >
                    Reset
                  </button>
                </div>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', fontSize: '13px', color: 'var(--color-text)' }}>
                <span>Follow Redirects</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={draftRequest.followRedirects ?? false}
                    onChange={e => updateDraft({ followRedirects: e.target.checked })}
                    style={{ cursor: 'pointer' }}
                  />
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => updateDraft({ followRedirects: undefined })}
                    disabled={draftRequest.followRedirects === undefined}
                    style={{ padding: '2px 6px', fontSize: '11px' }}
                  >
                    Reset
                  </button>
                </div>
              </label>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              Values are inherited from Folder or Global settings if not overridden.
            </p>
          </div>
        </div>
      )}
    </div>
  </section>
  );
}
