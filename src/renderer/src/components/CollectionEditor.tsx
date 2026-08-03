import { useState, useEffect } from "react";
import { Save } from "lucide-react";
import type { CollectionSummary, EnvironmentVariable, ScopedVariableEntityType, AuthConfig, ApiAuthMode } from "../types";
import { AuthEditorForm } from "./AuthEditorForm";
import { ScriptEditor } from "./ScriptEditor";
import { ScopedVariablesEditor } from "./ScopedVariablesEditor";
import { getScripts, saveScript, saveCollectionAuth } from "../services/local-store";

export interface CollectionEditorProps {
  collection: CollectionSummary;
  activeVars: EnvironmentVariable[];
  onUpdateCollection: (collection: CollectionSummary) => void;
  onSaveScopedVariable: (entityId: string, entityType: ScopedVariableEntityType, key: string, value: string) => Promise<void>;
  onDeleteScopedVariable: (entityId: string, entityType: ScopedVariableEntityType, key: string) => Promise<void>;
}

export function CollectionEditor({
  collection,
  activeVars,
  onUpdateCollection,
  onSaveScopedVariable,
  onDeleteScopedVariable,
}: CollectionEditorProps) {
  const [activeTab, setActiveTab] = useState<"auth" | "pre-script" | "post-script" | "variables">("auth");
  const [preScript, setPreScript] = useState("");
  const [postScript, setPostScript] = useState("");
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
      setScriptsLoaded(true);
      setIsDirty(false);
      setDraftAuthMode(collection.authMode || "none");
      setDraftAuthConfig(collection.authConfig || {});
    }
    setScriptsLoaded(false);
    loadScripts();
  }, [collection.id]);

  const handleSave = async () => {
    await saveScript(collection.id, "collection", "pre", preScript);
    await saveScript(collection.id, "collection", "post", postScript);
    await saveCollectionAuth(collection.id, draftAuthMode, draftAuthConfig);
    onUpdateCollection({
      ...collection,
      authMode: draftAuthMode,
      authConfig: draftAuthConfig,
    });
    setIsDirty(false);
  };

  const handleAuthChange = (draft: { mode: ApiAuthMode; config: AuthConfig }) => {
    setDraftAuthMode(draft.mode);
    setDraftAuthConfig(draft.config);
    setIsDirty(true);
  };

  if (!scriptsLoaded) return null;

  const tabs = [
    { id: "auth", label: "Auth" },
    { id: "pre-script", label: "Pre-request Script" },
    { id: "post-script", label: "Post-request Script" },
    { id: "variables", label: "Variables" }
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

            if (tab.id === "variables") {
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
        
        {activeTab === "auth" && (
          <div className="request-tab-panel auth-panel">
            <div style={{ padding: "16px", maxWidth: "800px" }}>
              <p style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "16px" }}>
                Configure authentication that will be inherited by all requests within this collection.
              </p>
              <AuthEditorForm
                draft={{ mode: draftAuthMode, config: draftAuthConfig }}
                activeVars={activeVars}
                onDraftChange={handleAuthChange}
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
          <div className="request-tab-panel" style={{ padding: "16px", maxWidth: "800px" }}>
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
      </div>
    </div>
  );
}
