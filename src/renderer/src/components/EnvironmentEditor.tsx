import React, { useState, useCallback } from "react";
import { Trash2, Plus, Eye, EyeOff, Edit3, X, Check } from "lucide-react";
import { EnvironmentVariable } from "../types";

export interface EnvironmentEditorProps {
  environmentName: string;
  variables: EnvironmentVariable[];
  onUpdateVariables: (variables: EnvironmentVariable[]) => void;
  onRenameEnvironment?: (newName: string) => void;
  onDeleteEnvironment?: () => void;
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
}: EnvironmentEditorProps) {
  const toEditable = (vars: EnvironmentVariable[]): EditableVariable[] =>
    vars.map((v, i) => ({ ...v, _id: `${v.key}-${i}` }));

  const [editingVars, setEditingVars] = useState<EditableVariable[]>(
    () => toEditable(variables)
  );
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState(environmentName);
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());

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
    <div className="environment-editor" style={{ padding: "16px", height: "100%", display: "flex", flexDirection: "column" }}>
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
        {onDeleteEnvironment && (
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  `Delete environment "${environmentName}"? This cannot be undone.`
                )
              ) {
                onDeleteEnvironment();
              }
            }}
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

      <div
        style={{
          flex: 1,
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
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
                  <input
                    type="text"
                    value={v.key}
                    onChange={(e) => updateVariable(v._id, "key", e.target.value)}
                    placeholder="Variable name"
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      border: "1px solid transparent",
                      borderRadius: "4px",
                      background: "transparent",
                      fontSize: "13px",
                      outline: "none",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "var(--color-border-strong)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "transparent";
                    }}
                  />
                </td>
                <td style={{ padding: "4px 12px", borderBottom: "1px solid var(--color-border)" }}>
                  <input
                    type={v.secret && !visibleSecrets.has(v._id) ? "password" : "text"}
                    value={v.value}
                    onChange={(e) => updateVariable(v._id, "value", e.target.value)}
                    placeholder="Value"
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      border: "1px solid transparent",
                      borderRadius: "4px",
                      background: "transparent",
                      fontSize: "13px",
                      outline: "none",
                      fontFamily:
                        v.secret && !visibleSecrets.has(v._id)
                          ? "monospace"
                          : "inherit",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "var(--color-border-strong)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "transparent";
                    }}
                  />
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
      </div>
    </div>
  );
}
