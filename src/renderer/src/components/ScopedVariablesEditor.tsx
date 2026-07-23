import { AlignLeft, Check, Eye, EyeOff, Plus, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import type { ScopedVariable, ScopedVariableEntityType } from "../types";

function toBulkText(variables: ScopedVariable[]): string {
  return variables.map((v) => `${v.key}=${v.value}`).join("\n");
}

function parseBulkText(text: string): Array<{ key: string; value: string }> {
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
      return { key, value };
    })
    .filter((v): v is { key: string; value: string } => v !== null);
}

export interface ScopedVariablesEditorProps {
  entityId: string;
  entityType: ScopedVariableEntityType;
  variables: ScopedVariable[];
  onSave: (entityId: string, entityType: ScopedVariableEntityType, key: string, value: string) => Promise<void>;
  onDelete: (entityId: string, entityType: ScopedVariableEntityType, key: string) => Promise<void>;
}

export function ScopedVariablesEditor({
  entityId,
  entityType,
  variables,
  onSave,
  onDelete,
}: ScopedVariablesEditorProps) {
  const [mode, setMode] = useState<"grid" | "bulk">("grid");
  const [bulkText, setBulkText] = useState("");
  const [bulkApplying, setBulkApplying] = useState(false);
  const [showValues, setShowValues] = useState(() => localStorage.getItem("env-show-values") !== "false");
  const [visibleValues, setVisibleValues] = useState<Record<string, boolean>>(() => JSON.parse(localStorage.getItem("env-visible-values") || "{}"));

  const handleGlobalToggle = () => {
    const next = !showValues;
    setShowValues(next);
    localStorage.setItem("env-show-values", String(next));
    setVisibleValues({});
    localStorage.setItem("env-visible-values", "{}");
  };

  const toggleValueVisibility = (key: string) => {
    setVisibleValues((prev) => {
      const next = { ...prev };
      const currentlyVisible = prev[key] ?? showValues;
      next[key] = !currentlyVisible;
      localStorage.setItem("env-visible-values", JSON.stringify(next));
      return next;
    });
  };

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingKeyDraft, setEditingKeyDraft] = useState("");
  const [editingValueDraft, setEditingValueDraft] = useState("");

  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const editingRowRef = useRef<HTMLDivElement | null>(null);

  function enterBulk() {
    setBulkText(toBulkText(variables));
    setMode("bulk");
  }

  async function applyBulk() {
    setBulkApplying(true);
    try {
      const parsed = parseBulkText(bulkText);
      const parsedKeys = new Set(parsed.map((v) => v.key));
      for (const v of variables) {
        if (!parsedKeys.has(v.key)) await onDelete(entityId, entityType, v.key);
      }
      for (const v of parsed) {
        await onSave(entityId, entityType, v.key, v.value);
      }
    } finally {
      setBulkApplying(false);
      setMode("grid");
    }
  }

  function startInlineEdit(v: ScopedVariable) {
    setEditingKey(v.key);
    setEditingKeyDraft(v.key);
    setEditingValueDraft(v.value);
  }

  function cancelInlineEdit() {
    setEditingKey(null);
  }

  async function commitInlineEdit() {
    if (editingKey === null) return;
    const k = editingKeyDraft.trim();
    if (!k) { cancelInlineEdit(); return; }

    if (k !== editingKey) await onDelete(entityId, entityType, editingKey);

    await onSave(entityId, entityType, k, editingValueDraft);
    setEditingKey(null);
  }

  function handleEditingRowBlur(e: React.FocusEvent<HTMLDivElement>) {
    const nextFocus = e.relatedTarget as Node | null;
    if (editingRowRef.current && nextFocus && editingRowRef.current.contains(nextFocus)) {
      return; // focus stayed inside the editing row
    }
    void commitInlineEdit();
  }

  async function handleAdd() {
    if (!newKey.trim()) return;
    await onSave(entityId, entityType, newKey.trim(), newValue);
    setNewKey("");
    setNewValue("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
          {variables.length} {variables.length === 1 ? "variable" : "variables"}
        </span>
        <div style={{ display: "flex", gap: "6px" }}>
          {mode === "grid" && (
            <button
              type="button"
              className="ghost-button"
              onClick={handleGlobalToggle}
              title={showValues ? "Hide values" : "Show values"}
              style={{ fontSize: "12px", padding: "3px 10px", display: "flex", alignItems: "center", gap: "5px" }}
            >
              {showValues ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
          )}
          {mode === "grid" ? (
            <button
              type="button"
              className="ghost-button"
              onClick={enterBulk}
              style={{ fontSize: "12px", padding: "3px 10px", display: "flex", alignItems: "center", gap: "5px" }}
            >
              <AlignLeft size={12} /> Bulk Edit
            </button>
          ) : (
            <>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setMode("grid")}
                disabled={bulkApplying}
                style={{ fontSize: "12px", padding: "3px 10px", display: "flex", alignItems: "center", gap: "5px" }}
              >
                <X size={12} /> Cancel
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => void applyBulk()}
                disabled={bulkApplying}
                style={{ fontSize: "12px", padding: "3px 10px", display: "flex", alignItems: "center", gap: "5px", color: "var(--color-text-active)" }}
              >
                <Check size={12} /> Apply
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
            rows={Math.max(3, variables.length + 2)}
            aria-label="Bulk edit variables"
            placeholder={"KEY=value\nANOTHER_KEY=another_value\n# comment lines are ignored"}
            spellCheck={false}
            style={{
              width: "100%",
              boxSizing: "border-box",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: "13px",
              padding: "10px 12px",
              borderRadius: "10px",
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
            <code>KEY=value</code> per line. Secrets show as <code>[secret]</code> — leave unchanged to preserve. Removing a line deletes it.
          </p>
        </div>
      )}

      {/* Grid mode */}
      {mode === "grid" && (
        <div className="env-variable-card" style={{ display: "flex", flexDirection: "column" }}>
          {variables.length === 0 && (
            <p style={{ fontSize: "12px", color: "var(--color-text-muted)", fontStyle: "italic", padding: "10px 12px", margin: 0, borderBottom: "1px solid var(--color-border)" }}>
              No variables. Override environment variables for this {entityType}.
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
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", minWidth: 0 }}>
                      <input
                        className="env-inline-input"
                        value={editingValueDraft}
                        aria-label="Edit value"
                        type="text"
                        style={{ flex: 1 }}
                        onChange={(e) => setEditingValueDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); void commitInlineEdit(); }
                          if (e.key === "Escape") { e.preventDefault(); cancelInlineEdit(); }
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
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
                    <span className="env-variable-key" onClick={() => startInlineEdit(v)} title="Click to edit">
                      {v.key}
                    </span>
                    <span
                      className="env-variable-value"
                      onClick={() => startInlineEdit(v)}
                      title="Click to edit"
                    >
                      { (visibleValues[v.key] ?? showValues) ? v.value : "••••••••" }
                    </span>
                  </>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <button
                    type="button"
                    className="env-icon-button"
                    aria-label={`Toggle visibility of ${v.key}`}
                    onClick={(e) => { e.stopPropagation(); toggleValueVisibility(v.key); }}
                  >
                    { (visibleValues[v.key] ?? showValues) ? <EyeOff size={12} /> : <Eye size={12} /> }
                  </button>
                  <button
                    type="button"
                    className="env-icon-button danger"
                    aria-label={`Delete variable ${v.key}`}
                    onClick={(e) => { e.stopPropagation(); cancelInlineEdit(); void onDelete(entityId, entityType, v.key); }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
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
                aria-label="Variable key"
                onKeyDown={(e) => { if (e.key === "Enter") void handleAdd(); }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <input
                  style={{ flex: 1, minWidth: 0 }}
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="Value"
                  aria-label="New variable value"
                  type="text"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleAdd();
                  }}
                />
              </div>
            </div>
            <div className="env-add-variable-actions">
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
