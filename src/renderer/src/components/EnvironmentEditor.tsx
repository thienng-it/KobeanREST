import React, { useState, useCallback } from "react";
import { Trash2, Plus, Eye, EyeOff, Edit3, X, Check, AlignLeft, CheckCircle2 } from "lucide-react";
import { EnvironmentVariable } from "../types";

export interface EnvironmentEditorProps {
  environmentName: string;
  variables: EnvironmentVariable[];
  onUpdateVariables: (variables: EnvironmentVariable[]) => void;
  onRenameEnvironment?: (newName: string) => void;
  onDeleteEnvironment?: () => void;
  isActiveEnvironment?: boolean;
  onSetActiveEnvironment?: () => void;
  collections?: { id: string; name: string; defaultEnvironment?: string }[];
  onUpdateCollectionDefaultEnvironment?: (collectionId: string, defaultEnvironment: string | null) => Promise<void>;
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

function toBulkText(variables: EnvironmentVariable[]): string {
  return variables.map((v) => `${v.key}=${v.value}`).join("\n");
}

interface EditableVariable extends EnvironmentVariable {
  _id: string;
}

export function EnvironmentEditor({
  environmentName,
  variables,
  onUpdateVariables,
  onRenameEnvironment,
  onDeleteEnvironment,
  isActiveEnvironment,
  onSetActiveEnvironment,
  collections = [],
  onUpdateCollectionDefaultEnvironment,
}: EnvironmentEditorProps) {
  const toEditable = (vars: EnvironmentVariable[]): EditableVariable[] =>
    vars.map((v, i) => ({ ...v, _id: `${v.key}-${i}` }));

  const [editingVars, setEditingVars] = useState<EditableVariable[]>(
    () => toEditable(variables)
  );
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState(environmentName);
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [bulkText, setBulkText] = useState("");

  React.useEffect(() => {
    setEditingVars(toEditable(variables));
  }, [variables]);

  React.useEffect(() => {
    setRenameDraft(environmentName);
  }, [environmentName]);

  const persistChanges = useCallback(
    (newVars: EditableVariable[]) => {
      const validVars = newVars.filter((v) => v.key.trim() !== "");
      const toSave: EnvironmentVariable[] = validVars.map(
        ({ _id, ...rest }) => rest
      );
      onUpdateVariables(toSave);
    },
    [onUpdateVariables]
  );

  const updateVariable = useCallback(
    (id: string, field: keyof EnvironmentVariable, value: string | boolean) => {
      setEditingVars((prev) => {
        const updated = prev.map((v) =>
          v._id === id ? { ...v, [field]: value } : v
        );
        persistChanges(updated);
        return updated;
      });
    },
    [persistChanges]
  );

  const deleteVariable = useCallback(
    (id: string) => {
      setEditingVars((prev) => {
        const updated = prev.filter((v) => v._id !== id);
        persistChanges(updated);
        return updated;
      });
    },
    [persistChanges]
  );

  const addEmptyVariable = useCallback(() => {
    const newId = `new-${Date.now()}`;
    setEditingVars((prev) => [
      ...prev,
      { _id: newId, key: "", value: "", secret: false },
    ]);
  }, []);

  const toggleSecretVisibility = useCallback((id: string) => {
    setVisibleSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const applyRename = useCallback(() => {
    if (renameDraft.trim() && renameDraft.trim() !== environmentName) {
      onRenameEnvironment?.(renameDraft.trim());
    }
    setIsRenaming(false);
  }, [renameDraft, environmentName, onRenameEnvironment]);

  const cancelRename = useCallback(() => {
    setRenameDraft(environmentName);
    setIsRenaming(false);
  }, [environmentName]);

  return (
    <div
      className="environment-editor"
      style={{
        padding: "16px",
        flex: "1 1 0%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        border: "1px solid var(--color-border)",
        borderRadius: "16px",
        background: "var(--color-panel)",
        boxShadow: "0 12px 40px var(--color-shadow)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {isRenaming ? (
            <>
              <input
                type="text"
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyRename();
                  else if (e.key === "Escape") cancelRename();
                }}
                autoFocus
                style={{
                  fontSize: "16px",
                  fontWeight: 600,
                  padding: "4px 8px",
                  borderRadius: "4px",
                  border: "1px solid var(--color-border-strong)",
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={applyRename}
                style={{ padding: "4px" }}
              >
                <Check size={16} className="text-success" />
              </button>
              <button
                type="button"
                onClick={cancelRename}
                style={{ padding: "4px" }}
              >
                <X size={16} className="text-muted" />
              </button>
            </>
          ) : (
            <>
              <h2
                style={{
                  fontSize: "16px",
                  fontWeight: 600,
                  margin: 0,
                }}
              >
                Environment: {environmentName}
              </h2>
              {onRenameEnvironment && (
                <button
                  type="button"
                  onClick={() => setIsRenaming(true)}
                  style={{
                    padding: "4px",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    color: "var(--color-muted)",
                  }}
                  title="Rename environment"
                >
                  <Edit3 size={14} />
                </button>
              )}
            </>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {onSetActiveEnvironment && (
            <button
              type="button"
              onClick={onSetActiveEnvironment}
              disabled={isActiveEnvironment}
              style={{
                padding: "6px 12px",
                border: "1px solid",
                borderColor: isActiveEnvironment ? "var(--color-text-active)" : "var(--color-border-strong)",
                background: isActiveEnvironment ? "color-mix(in srgb, var(--color-text-active) 15%, transparent)" : "transparent",
                color: isActiveEnvironment ? "var(--color-text-active)" : "var(--color-text)",
                borderRadius: "6px",
                cursor: isActiveEnvironment ? "default" : "pointer",
                fontSize: "12px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                opacity: isActiveEnvironment ? 1 : 0.8,
              }}
            >
              {isActiveEnvironment ? <CheckCircle2 size={14} /> : null}
              {isActiveEnvironment ? "Active" : "Set Active"}
            </button>
          )}

          {onUpdateCollectionDefaultEnvironment && collections.length > 0 && (
            <select
              className="input"
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  void onUpdateCollectionDefaultEnvironment(e.target.value, environmentName);
                }
              }}
              style={{
                padding: "5px 12px",
                border: "1px solid var(--color-border-strong)",
                background: "transparent",
                color: "var(--color-text)",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              <option value="" disabled>Set default for...</option>
              {collections.map(c => (
                <option key={c.id} value={c.id} disabled={c.defaultEnvironment === environmentName}>
                  {c.name} {c.defaultEnvironment === environmentName ? "(Active)" : ""}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => {
              if (isBulkEditing) {
                // Apply bulk changes
                const parsed = parseBulkText(bulkText);
                const newVars: EnvironmentVariable[] = parsed.map((p) => ({
                  key: p.key,
                  value: p.value,
                  enabled: true,
                  secret: false,
                }));
                onUpdateVariables(newVars);
                setIsBulkEditing(false);
              } else {
                setBulkText(toBulkText(variables));
                setIsBulkEditing(true);
              }
            }}
            style={{
              padding: "6px 12px",
              border: "1px solid var(--color-border-strong)",
              background: isBulkEditing ? "var(--color-surface-hover)" : "transparent",
              color: "var(--color-text)",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "12px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {isBulkEditing ? <Check size={14} /> : <AlignLeft size={14} />}
            {isBulkEditing ? "Save Bulk" : "Bulk Edit"}
          </button>

          {isBulkEditing && (
            <button
              type="button"
              onClick={() => setIsBulkEditing(false)}
              style={{
                padding: "6px 12px",
                border: "1px solid var(--color-border-strong)",
                background: "transparent",
                color: "var(--color-text)",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "12px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              Cancel
            </button>
          )}

          {onDeleteEnvironment && (
            <button
              type="button"
              onClick={onDeleteEnvironment}
              style={{
                padding: "6px 12px",
                border: "1px solid #ef4444",
                background: "transparent",
                color: "#ef4444",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "12px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Trash2 size={14} />
              Delete
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {isBulkEditing ? (
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={"KEY=value\nANOTHER_KEY=123\n# Comments are supported"}
            style={{
              flex: 1,
              width: "100%",
              resize: "none",
              padding: "12px",
              fontSize: "13px",
              fontFamily: "var(--font-mono)",
              background: "var(--color-surface)",
              color: "var(--color-text)",
              border: "1px solid var(--color-border-strong)",
              borderRadius: "6px",
              outline: "none",
            }}
          />
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: 0,
              fontSize: "13px",
            }}
          >
            <thead>
            <tr style={{ position: "sticky", top: 0, background: "var(--color-surface-solid)" }}>
              <th
                style={{
                  textAlign: "left",
                  padding: "8px 12px",
                  fontWeight: 600,
                  borderBottom: "1px solid var(--color-border)",
                  width: "35%",
                }}
              >
                KEY
              </th>
              <th
                style={{
                  textAlign: "left",
                  padding: "8px 12px",
                  fontWeight: 600,
                  borderBottom: "1px solid var(--color-border)",
                  width: "45%",
                }}
              >
                VALUE
              </th>
              <th
                style={{
                  textAlign: "center",
                  padding: "8px 12px",
                  fontWeight: 600,
                  borderBottom: "1px solid var(--color-border)",
                  width: "10%",
                }}
              >
                SECRET
              </th>
              <th
                style={{
                  textAlign: "center",
                  padding: "8px 12px",
                  fontWeight: 600,
                  borderBottom: "1px solid var(--color-border)",
                  width: "10%",
                }}
              ></th>
            </tr>
          </thead>
          <tbody>
            {editingVars.map((v) => (
              <tr key={v._id}>
                <td style={{ padding: "4px 12px", borderBottom: "1px solid var(--color-border)" }}>
                  <div className="headers-row-input" style={{ display: 'flex', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="headers-row-input-field"
                      value={v.key}
                      onChange={(e) => updateVariable(v._id, "key", e.target.value)}
                      placeholder="Variable name"
                      style={{
                        width: "100%",
                        background: "transparent",
                        border: "none",
                        outline: "none",
                      }}
                    />
                  </div>
                </td>
                <td style={{ padding: "4px 12px", borderBottom: "1px solid var(--color-border)" }}>
                  <div className="headers-row-input" style={{ display: 'flex', alignItems: 'center' }}>
                    <input
                      type={v.secret && !visibleSecrets.has(v._id) ? "password" : "text"}
                      className="headers-row-input-field"
                      value={v.value}
                      onChange={(e) => updateVariable(v._id, "value", e.target.value)}
                      placeholder="Value"
                      style={{
                        width: "100%",
                        background: "transparent",
                        border: "none",
                        outline: "none",
                        fontFamily:
                          v.secret && !visibleSecrets.has(v._id)
                            ? "monospace"
                            : "inherit",
                      }}
                    />
                  </div>
                </td>
                <td
                  style={{
                    padding: "4px 12px",
                    borderBottom: "1px solid var(--color-border)",
                    textAlign: "center",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleSecretVisibility(v._id)}
                    style={{
                      padding: "4px",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      color: v.secret
                        ? "var(--color-accent)"
                        : "var(--color-muted)",
                    }}
                    title={v.secret ? "Toggle visibility" : "Mark as secret first"}
                  >
                    {v.secret ? (
                      visibleSecrets.has(v._id) ? (
                        <Eye size={14} />
                      ) : (
                        <EyeOff size={14} />
                      )
                    ) : (
                      <Eye size={14} style={{ opacity: 0.4 }} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateVariable(v._id, "secret", !v.secret)}
                    style={{
                      marginLeft: "4px",
                      width: "14px",
                      height: "14px",
                      borderRadius: "3px",
                      border: v.secret
                        ? "2px solid var(--color-accent)"
                        : "2px solid var(--color-border)",
                      background: v.secret ? "var(--color-accent)" : "transparent",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    title={v.secret ? "Unmark as secret" : "Mark as secret"}
                  >
                    {v.secret && (
                      <Check size={10} style={{ color: "white" }} />
                    )}
                  </button>
                </td>
                <td
                  style={{
                    padding: "4px 12px",
                    borderBottom: "1px solid var(--color-border)",
                    textAlign: "center",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => deleteVariable(v._id)}
                    style={{
                      padding: "4px",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      color: "var(--color-muted)",
                    }}
                    title="Delete variable"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      
      {!isBulkEditing && (
        <button
          type="button"
          onClick={addEmptyVariable}
          style={{
            marginTop: "8px",
            padding: "8px 16px",
            border: "1px dashed var(--color-border)",
            background: "transparent",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "13px",
            color: "var(--color-muted)",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <Plus size={14} />
          Add Variable
        </button>
      )}
    </div>
  );
}
