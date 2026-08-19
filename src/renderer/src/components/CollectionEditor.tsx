import { useState, useEffect } from "react";
import { Save, Lock, Unlock, Shield, ShieldCheck, ShieldAlert, KeyRound } from "lucide-react";
import type { CollectionSummary, EnvironmentVariable, ScopedVariableEntityType, AuthConfig, ApiAuthMode } from "../types";
import { AuthEditorForm } from "./AuthEditorForm";
import { ScriptEditor } from "./ScriptEditor";
import { ScopedVariablesEditor } from "./ScopedVariablesEditor";
import { DocsEditor } from "./DocsEditor";
import { getScripts, saveScript, saveCollectionAuth, saveCollectionDescription } from "../services/local-store";
import { getCollectionLockConfig } from "../services/collection-security";

export interface CollectionEditorProps {
  collection: CollectionSummary;
  activeVars: EnvironmentVariable[];
  unlockedCollectionIds?: Set<string>;
  onUpdateCollection: (collection: CollectionSummary) => void;
  onSaveScopedVariable: (entityId: string, entityType: ScopedVariableEntityType, key: string, value: string) => Promise<void>;
  onDeleteScopedVariable: (entityId: string, entityType: ScopedVariableEntityType, key: string) => Promise<void>;
  onOpenLockModal?: (collectionId: string, mode: "lock" | "unlock" | "remove-lock") => void;
  onRelockCollection?: (collectionId: string) => void;
}

export function CollectionEditor({
  collection,
  activeVars,
  unlockedCollectionIds,
  onUpdateCollection,
  onSaveScopedVariable,
  onDeleteScopedVariable,
  onOpenLockModal,
  onRelockCollection,
}: CollectionEditorProps) {
  const [activeTab, setActiveTab] = useState<"docs" | "auth" | "pre-script" | "post-script" | "variables" | "security">(
    collection.description && collection.description.trim() !== "" ? "docs" : "auth"
  );
  const [preScript, setPreScript] = useState("");
  const [postScript, setPostScript] = useState("");
  const [draftDescription, setDraftDescription] = useState(collection.description || "");
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const [draftAuthMode, setDraftAuthMode] = useState<ApiAuthMode>(collection.authMode || "none");
  const [draftAuthConfig, setDraftAuthConfig] = useState<AuthConfig>(collection.authConfig || {});

  useEffect(() => {
    async function loadScripts() {
      const scripts = await getScripts(collection.id, "collection");
      const pre = scripts.find((s) => s.scriptType === "pre")?.content || "";
      const post = scripts.find((s) => s.scriptType === "post")?.content || "";
      setPreScript(pre);
      setPostScript(post);
      setDraftDescription(collection.description || "");
      setScriptsLoaded(true);
      setIsDirty(false);
      setDraftAuthMode(collection.authMode || "none");
      setDraftAuthConfig(collection.authConfig || {});
    }
    setScriptsLoaded(false);
    loadScripts();
  }, [collection.id, collection.description]);

  const handleSave = async () => {
    await saveScript(collection.id, "collection", "pre", preScript);
    await saveScript(collection.id, "collection", "post", postScript);
    await saveCollectionAuth(collection.id, draftAuthMode, draftAuthConfig);
    await saveCollectionDescription(collection.id, draftDescription);
    onUpdateCollection({
      ...collection,
      authMode: draftAuthMode,
      authConfig: draftAuthConfig,
      description: draftDescription,
    });
    setIsDirty(false);
  };

  const handleAuthChange = (draft: { mode: ApiAuthMode; config: AuthConfig }) => {
    setDraftAuthMode(draft.mode);
    setDraftAuthConfig(draft.config);
    setIsDirty(true);
  };

  const handleTokenObtained = async (newConfig: AuthConfig) => {
    await saveScript(collection.id, "collection", "pre", preScript);
    await saveScript(collection.id, "collection", "post", postScript);
    await saveCollectionAuth(collection.id, draftAuthMode, newConfig);
    await saveCollectionDescription(collection.id, draftDescription);
    onUpdateCollection({
      ...collection,
      authMode: draftAuthMode,
      authConfig: newConfig,
      description: draftDescription,
    });
    setDraftAuthConfig(newConfig);
    setIsDirty(false);
  };

  if (!scriptsLoaded) return null;

  const lockConfig = collection.lockConfig || getCollectionLockConfig(collection.id);
  const isProtected = Boolean(lockConfig?.isLocked);
  const isUnlockedInSession = unlockedCollectionIds?.has(collection.id);

  const tabs = [
    { id: "docs", label: "Docs" },
    { id: "auth", label: "Auth" },
    { id: "pre-script", label: "Pre-request Script" },
    { id: "post-script", label: "Post-request Script" },
    { id: "variables", label: "Variables" },
    { id: "security", label: isProtected ? "Security 🔒" : "Security" }
  ] as const;

  return (
    <div className="request-pane">
      <div className="request-header" style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-bg)" }}>
        <h2 style={{ margin: 0, fontSize: "14px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px", color: "var(--color-text)" }}>
          {collection.name}
        </h2>
        <button
          className={`ghost-button script-workspace-save${isDirty ? " dirty" : ""}`}
          type="button"
          onClick={handleSave}
          disabled={!isDirty}
          title={isDirty ? "Save collection settings" : "All changes saved"}
        >
          <Save size={14} />
          <span>{isDirty ? "Save" : "Saved"}</span>
        </button>
      </div>

      <div className="request-workspace">
        <div className="tab-row" role="tablist">
          {tabs.map((tab) => {
            let hasData = false;
            let count = 0;
            let isTabDirty = false;

            if (tab.id === "docs") {
              hasData = Boolean(draftDescription && draftDescription.trim() !== "");
              isTabDirty = draftDescription !== (collection.description || "");
            } else if (tab.id === "variables") {
              const items = collection.variables || [];
              hasData = items.length > 0;
              count = items.length;
            } else if (tab.id === "auth") {
              hasData = draftAuthMode !== "none";
              isTabDirty = draftAuthMode !== (collection.authMode || "none") || JSON.stringify(draftAuthConfig) !== JSON.stringify(collection.authConfig || {});
            } else if (tab.id === "pre-script") {
              hasData = preScript.trim() !== "";
              isTabDirty = isDirty;
            } else if (tab.id === "post-script") {
              hasData = postScript.trim() !== "";
              isTabDirty = isDirty;
            } else if (tab.id === "security") {
              hasData = isProtected;
            }

            const tabLabel = tab.id === "variables" && count > 0 ? `${tab.label} (${count})` : tab.label;

            return (
              <button
                key={tab.id}
                className={activeTab === tab.id ? "tab active" : "tab"}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                type="button"
              >
                {tabLabel}
                {(hasData || isTabDirty) && (
                  <span
                    className={`tab-script-indicator ${isTabDirty ? 'dirty' : ''}`}
                    title={isTabDirty ? "Unsaved changes" : "Contains data"}
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
        
        {activeTab === "docs" && (
          <div className="request-tab-panel docs-tab-panel" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
            <DocsEditor
              description={draftDescription}
              onChange={(val) => {
                setDraftDescription(val);
                setIsDirty(true);
              }}
              requestName={collection.name}
            />
          </div>
        )}

        {activeTab === "auth" && (
          <div className="request-tab-panel auth-panel">
            <div style={{ padding: "16px", maxWidth: "1200px" }}>
              <p style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "16px" }}>
                Configure authentication that will be inherited by all requests within this collection.
              </p>
              <AuthEditorForm
                draft={{ mode: draftAuthMode, config: draftAuthConfig }}
                activeVars={activeVars}
                onDraftChange={handleAuthChange}
                onTokenObtained={handleTokenObtained}
              />
            </div>
          </div>
        )}
        
        {activeTab === "pre-script" && (
          <div className="request-tab-panel request-scripts-panel" style={{ flex: 1, minHeight: 0, position: "relative" }}>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
              <div className="script-workspace" style={{ border: "none", flex: 1, minHeight: 0 }}>
                <div className="script-editor-frame">
                  <div className="script-editor-shell">
                    <ScriptEditor
                      value={preScript}
                      onChange={(val) => { setPreScript(val); setIsDirty(true); }}
                      variables={activeVars.map((v) => v.key)}
                      height="100%"
                      placeholder="// JavaScript only (no TypeScript types) to run before any request in this collection"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "post-script" && (
          <div className="request-tab-panel request-scripts-panel" style={{ flex: 1, minHeight: 0, position: "relative" }}>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
              <div className="script-workspace" style={{ border: "none", flex: 1, minHeight: 0 }}>
                <div className="script-editor-frame">
                  <div className="script-editor-shell">
                    <ScriptEditor
                      value={postScript}
                      onChange={(val) => { setPostScript(val); setIsDirty(true); }}
                      variables={activeVars.map((v) => v.key)}
                      height="100%"
                      placeholder="// JavaScript only (no TypeScript types) to run after any request in this collection"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "variables" && (
          <div className="request-tab-panel" style={{ padding: "16px", maxWidth: "1200px" }}>
            <p style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "16px" }}>
              Override environment variables for all requests in this collection.
            </p>
            <ScopedVariablesEditor
              entityId={collection.id}
              entityType="collection"
              variables={collection.variables || []}
              onSave={onSaveScopedVariable}
              onDelete={onDeleteScopedVariable}
            />
          </div>
        )}

        {activeTab === "security" && (
          <div className="request-tab-panel" style={{ padding: "20px", maxWidth: "800px" }}>
            <div
              style={{
                border: "1px solid var(--color-border)",
                borderRadius: "10px",
                padding: "20px",
                backgroundColor: "var(--color-surface)",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      backgroundColor: isProtected ? "rgba(239, 68, 68, 0.12)" : "rgba(16, 185, 129, 0.12)",
                      color: isProtected ? "var(--color-status-error, #ef4444)" : "var(--color-status-2xx, #10b981)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {isProtected ? <Lock size={18} /> : <ShieldCheck size={18} />}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "var(--color-text)" }}>
                      {isProtected ? "Passcode Protection Active" : "No Passcode Lock Set"}
                    </h3>
                    <p style={{ margin: 0, fontSize: "12px", color: "var(--color-text-muted)" }}>
                      {isProtected
                        ? "Requests and folders in this collection require a PIN / password to access."
                        : "Anyone with access to this workspace can view and run requests in this collection."}
                    </p>
                  </div>
                </div>

                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: "12px",
                    fontSize: "12px",
                    fontWeight: 600,
                    backgroundColor: isProtected
                      ? (isUnlockedInSession ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)")
                      : "var(--color-surface-muted)",
                    color: isProtected
                      ? (isUnlockedInSession ? "var(--color-status-2xx, #10b981)" : "var(--color-status-error, #ef4444)")
                      : "var(--color-text-muted)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  {isProtected ? (isUnlockedInSession ? "Unlocked (Session)" : "Locked") : "Unprotected"}
                </span>
              </div>

              {isProtected && lockConfig?.hint && (
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    backgroundColor: "var(--color-surface-muted)",
                    border: "1px solid var(--color-border)",
                    fontSize: "12px",
                    color: "var(--color-text-muted)",
                  }}
                >
                  💡 <strong>Password Hint:</strong> {lockConfig.hint}
                </div>
              )}

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", paddingTop: "8px", borderTop: "1px solid var(--color-border)" }}>
                {isProtected ? (
                  <>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => onOpenLockModal?.(collection.id, "remove-lock")}
                      style={{
                        padding: "8px 14px",
                        fontSize: "13px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        backgroundColor: "var(--color-status-error, #ef4444)",
                        color: "#fff",
                        borderRadius: "6px",
                        border: "none",
                        cursor: "pointer",
                        fontWeight: 500,
                      }}
                    >
                      <Unlock size={14} /> Remove Passcode Lock
                    </button>

                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => onOpenLockModal?.(collection.id, "lock")}
                      style={{
                        padding: "8px 14px",
                        fontSize: "13px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <KeyRound size={14} /> Change Passcode
                    </button>

                    {isUnlockedInSession ? (
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => onRelockCollection?.(collection.id)}
                        style={{
                          padding: "8px 14px",
                          fontSize: "13px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <Lock size={14} /> Relock Now
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => onOpenLockModal?.(collection.id, "unlock")}
                        style={{
                          padding: "8px 14px",
                          fontSize: "13px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <Unlock size={14} /> Unlock Collection
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => onOpenLockModal?.(collection.id, "lock")}
                    style={{
                      padding: "8px 16px",
                      fontSize: "13px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <Lock size={14} /> Set PIN / Passcode Lock
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
