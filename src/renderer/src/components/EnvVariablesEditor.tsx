import { AlignLeft, Check, Eye, EyeOff, Plus, Trash2, X } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import type { EnvironmentVariable } from "../types";
import { resolveSecrets } from "../services/local-store";

function parseBulkText(text: string, existing: EnvironmentVariable[]): Array<{ key: string; value: string; secret: boolean }> {
  const secretMap = new Map(existing.filter((v) => v.secret).map((v) => [v.key, v]));
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const eqIdx = line.indexOf("=");
      if (eqIdx <= 0) return null;
      const key = line.slice(0, eqIdx).trim();
      const value = line.slice(eqIdx + 1).trim();
      if (!key) return null;
      const sec = secretMap.get(key);
      if (sec && (value === "[secret]" || value === "[secret stored outside SQLite]")) {
        return { key, value: sec.value, secret: true };
      }
      return { key, value, secret: false };
    })
    .filter((v): v is { key: string; value: string; secret: boolean } => v !== null);
}

function toBulkText(variables: EnvironmentVariable[]): string {
  return variables.map((v) => `${v.key}=${v.secret ? "[secret]" : v.value}`).join("\n");
}

export interface EnvVariablesEditorProps {
  envName: string;
  variables: EnvironmentVariable[];
  onSave: (envName: string, key: string, value: string) => Promise<void>;
  onSaveSecret: (envName: string, key: string, value: string) => Promise<void>;
  onDelete: (envName: string, key: string) => Promise<void>;
}

export function EnvVariablesEditor({ envName, variables, onSave, onSaveSecret, onDelete }: EnvVariablesEditorProps) {
  const [mode, setMode] = useState<"grid" | "bulk">("grid");
  const [bulkText, setBulkText] = useState("");
  const [bulkApplying, setBulkApplying] = useState(false);

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingKeyDraft, setEditingKeyDraft] = useState("");
  const [editingValueDraft, setEditingValueDraft] = useState("");
  const [editingWasSecret, setEditingWasSecret] = useState(false);
  const [editingIsSecret, setEditingIsSecret] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newSecret, setNewSecret] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [secretLoaded, setSecretLoaded] = useState(false);

  // Ref to track all elements inside the currently-editing row
  const editingRowRef = useRef<HTMLDivElement | null>(null);

  function enterBulk() {
    setBulkText(toBulkText(variables));
    setMode("bulk");
  }

  async function applyBulk() {
    setBulkApplying(true);
    try {
      const parsed = parseBulkText(bulkText, variables);
      const parsedKeys = new Set(parsed.map((v) => v.key));
      for (const v of variables) {
        if (!parsedKeys.has(v.key)) await onDelete(envName, v.key);
      }
      for (const v of parsed) {
        if (v.secret) {
          // secret preserved — no plaintext available
        } else {
          await onSave(envName, v.key, v.value);
        }
      }
    } finally {
      setBulkApplying(false);
      setMode("grid");
    }
  }

  useEffect(() => {
    if (editingKey !== null && editingWasSecret) {
      const v = variables.find((v) => v.key === editingKey);
      if (v && v.secretRef) {
        resolveSecrets([v.secretRef])
          .then((res) => {
            if (res[v.secretRef!]) {
              setEditingValueDraft(res[v.secretRef!]);
              setSecretLoaded(true);
            }
          })
          .catch(console.error);
      }
    }
  }, [editingKey, editingWasSecret, variables]);

  function startInlineEdit(v: EnvironmentVariable) {
    setEditingKey(v.key);
    setEditingKeyDraft(v.key);
    setEditingValueDraft(v.secret ? "" : v.value);
    setEditingWasSecret(v.secret ?? false);
    setEditingIsSecret(v.secret ?? false);
    setShowEditPassword(false);
    setSecretLoaded(!(v.secret ?? false));
  }

  function cancelInlineEdit() {
    setEditingKey(null);
  }

  async function commitInlineEdit() {
    if (editingKey === null) return;
    const k = editingKeyDraft.trim();
    if (!k) { cancelInlineEdit(); return; }

    if (editingWasSecret && !secretLoaded && editingValueDraft === "") {
      if (!editingIsSecret) {
        alert("The original secret value could not be retrieved from the keychain. To convert this to a normal variable, please enter a new value.");
        return;
      }
      if (k !== editingKey) {
        alert("Please enter the secret value again to rename this variable.");
      }
      cancelInlineEdit();
      return;
    }

    if (k !== editingKey) {
      await onDelete(envName, editingKey);
    }

    if (editingIsSecret) {
      await onSaveSecret(envName, k, editingValueDraft);
    } else {
      await onSave(envName, k, editingValueDraft);
    }
    setEditingKey(null);
  }

  /** Only commit when focus leaves the entire editing row container. */
  function handleEditingRowBlur(e: React.FocusEvent<HTMLDivElement>) {
    const nextFocus = e.relatedTarget as Node | null;
    if (editingRowRef.current && nextFocus && editingRowRef.current.contains(nextFocus)) {
      // Focus moved to another element inside the row — don't commit yet
      return;
    }
    void commitInlineEdit();
  }

  async function handleAdd() {
    if (!newKey.trim()) return;
    if (newSecret) {
      await onSaveSecret(envName, newKey.trim(), newValue);
    } else {
      await onSave(envName, newKey.trim(), newValue);
    }
    setNewKey("");
    setNewValue("");
    setNewSecret(false);
    setShowNewPassword(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
          {variables.length} {variables.length === 1 ? "variable" : "variables"}
        </span>
        <div style={{ display: "flex", gap: "6px" }}>
          {mode === "grid" ? (
            <button
              type="button"
              className="ghost-button"
              onClick={enterBulk}
              title="Bulk edit as text"
              style={{ fontSize: "12px", padding: "4px 10px", display: "flex", alignItems: "center", gap: "5px" }}
            >
              <AlignLeft size={13} /> Bulk Edit
            </button>
          ) : (
            <>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setMode("grid")}
                disabled={bulkApplying}
                style={{ fontSize: "12px", padding: "4px 10px", display: "flex", alignItems: "center", gap: "5px" }}
              >
                <X size={13} /> Cancel
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => void applyBulk()}
                disabled={bulkApplying}
                style={{ fontSize: "12px", padding: "4px 10px", display: "flex", alignItems: "center", gap: "5px", color: "var(--color-text-active)" }}
              >
                <Check size={13} /> Apply
              </button>
            </>
          )}
        </div>
      </div>

      {/* Bulk textarea */}
      {mode === "bulk" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={Math.max(4, variables.length + 2)}
            aria-label="Bulk edit variables"
            placeholder={"KEY=value\nANOTHER_KEY=another_value\n# comment lines are ignored"}
            spellCheck={false}
            style={{
              width: "100%",
              boxSizing: "border-box",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: "13px",
              padding: "12px",
              borderRadius: "12px",
              border: "1px solid var(--color-border)",
              background: "var(--color-surface)",
              color: "var(--color-text)",
              resize: "vertical",
              outline: "none",
              lineHeight: 1.6,
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-text-active)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }}
          />
          <p style={{ fontSize: "11px", color: "var(--color-text-muted)", margin: 0, fontStyle: "italic" }}>
            One variable per line as <code>KEY=value</code>. Secrets show as <code>[secret]</code> — leave unchanged to preserve. Removing a line deletes it.
          </p>
        </div>
      )}

      {/* Grid mode */}
      {mode === "grid" && (
        <div className="env-variable-card">
          {variables.length === 0 && (
            <p className="env-empty-state" style={{ margin: 0, border: "none", borderBottom: "1px solid var(--color-border)", borderRadius: 0 }}>
              No variables yet — add one below.
            </p>
          )}

          {variables.map((v) => {
            const isEditing = editingKey === v.key;
            return (
              <div
                key={v.key}
                ref={isEditing ? editingRowRef : null}
                className="env-variable-row"
                data-editing={isEditing ? "true" : undefined}
                style={{ cursor: "pointer" }}
                onBlur={isEditing ? handleEditingRowBlur : undefined}
              >
                {isEditing ? (
                  <>
                    {/* Key */}
                    <input
                      className="env-inline-input"
                      value={editingKeyDraft}
                      aria-label="Edit key"
                      autoFocus
                      onChange={(e) => setEditingKeyDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); void commitInlineEdit(); }
                        if (e.key === "Escape") { e.preventDefault(); cancelInlineEdit(); }
                      }}
                    />

                    {/* Value + show/hide */}
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", minWidth: 0 }}>
                        <input
                          className={`env-inline-input ${editingIsSecret && !showEditPassword ? "password-mask" : ""}`}
                          value={editingValueDraft}
                          aria-label="Edit value"
                          type="text"
                          placeholder={editingWasSecret ? "Enter new secret value…" : ""}
                          style={{ flex: 1 }}
                          onChange={(e) => setEditingValueDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); void commitInlineEdit(); }
                            if (e.key === "Escape") { e.preventDefault(); cancelInlineEdit(); }
                          }}
                          autoFocus
                        />
                      {editingIsSecret && (
                        <button
                          type="button"
                          className="env-icon-button"
                          tabIndex={0}
                          onPointerDown={(e) => e.preventDefault()}
                          onClick={() => setShowEditPassword((p) => !p)}
                          aria-label={showEditPassword ? "Hide value" : "Show value"}
                          style={{ flexShrink: 0 }}
                        >
                          {showEditPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      )}
                    </div>

                    {/* Secret toggle + commit/cancel */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                      <label 
                        className="env-secret-toggle" 
                        style={{ fontSize: "11px", whiteSpace: "nowrap", cursor: "pointer" }}
                        onPointerDown={(e) => {
                          e.preventDefault(); // Prevent Safari blur
                          setEditingIsSecret(!editingIsSecret);
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={editingIsSecret}
                          readOnly
                        />
                        Secret
                      </label>
                      <button
                        type="button"
                        className="env-icon-button"
                        tabIndex={0}
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={() => void commitInlineEdit()}
                        aria-label="Save"
                        title="Save (Enter)"
                        style={{ color: "var(--color-text-active)" }}
                      >
                        <Check size={12} />
                      </button>
                      <button
                        type="button"
                        className="env-icon-button"
                        tabIndex={0}
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={cancelInlineEdit}
                        aria-label="Cancel"
                        title="Cancel (Escape)"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span
                      className="env-variable-key"
                      onClick={() => startInlineEdit(v)}
                      title="Click to edit"
                    >
                      {v.key}
                    </span>
                    <span
                      className={v.secret ? "env-variable-value secret" : "env-variable-value"}
                      onClick={() => startInlineEdit(v)}
                      title="Click to edit"
                    >
                      {v.secret ? "[secret]" : v.value}
                    </span>
                    {v.secret
                      ? <span className="env-secret-badge">Secret</span>
                      : <span />
                    }
                  </>
                )}

                <button
                  type="button"
                  className="env-icon-button danger"
                  aria-label={`Delete variable ${v.key}`}
                  onClick={() => { cancelInlineEdit(); void onDelete(envName, v.key); }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}

          {/* Add new row */}
          <div className="env-add-variable" aria-label="Add variable">
            <div className="env-add-variable-fields">
              <input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="New key"
                aria-label="New variable key"
                onKeyDown={(e) => { if (e.key === "Enter") void handleAdd(); }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <input
                  style={{ flex: 1, minWidth: 0 }}
                  className={newSecret && !showNewPassword ? "password-mask" : ""}
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder={newSecret ? "Secret value" : "Value"}
                  aria-label="New variable value"
                  type="text"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleAdd();
                  }}
                />
                {newSecret && (
                  <button
                    type="button"
                    className="env-icon-button"
                    onClick={() => setShowNewPassword((p) => !p)}
                    aria-label={showNewPassword ? "Hide value" : "Show value"}
                  >
                    {showNewPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                )}
              </div>
            </div>
            <div className="env-add-variable-actions">
              <label className="env-secret-toggle">
                <input
                  type="checkbox"
                  checked={newSecret}
                  onChange={(e) => { setNewSecret(e.target.checked); setShowNewPassword(false); }}
                />
                Secret
              </label>
              <button type="button" className="ghost-button" onClick={() => void handleAdd()}>
                <Plus size={12} /> Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
