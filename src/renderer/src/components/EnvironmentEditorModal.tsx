import { Edit2, Plus, Trash2, X } from "lucide-react";
import type { WorkspaceSummary } from "../types";

interface AddVariableRowProps {
  newVarKey: string;
  newVarValue: string;
  newVarSecret: boolean;
  setNewVarKey: (v: string) => void;
  setNewVarValue: (v: string) => void;
  setNewVarSecret: (v: boolean) => void;
  onSave: (key: string, value: string, secret: boolean) => Promise<void>;
}



function AddVariableRow({
  newVarKey,
  newVarValue,
  newVarSecret,
  setNewVarKey,
  setNewVarValue,
  setNewVarSecret,
  onSave,
}: AddVariableRowProps) {
  return (
    <div className="env-add-variable" aria-label="Add variable">
      <div className="env-add-variable-fields">
        <input
          value={newVarKey}
          onChange={(e) => setNewVarKey(e.target.value)}
          placeholder="New key"
          aria-label="Variable key"
        />
        <input
          value={newVarValue}
          onChange={(e) => setNewVarValue(e.target.value)}
          placeholder={newVarSecret ? "Secret value" : "Value"}
          aria-label="Variable value"
          type={newVarSecret ? "password" : "text"}
        />
      </div>
      <div className="env-add-variable-actions">
        <label className="env-secret-toggle">
          <input type="checkbox" checked={newVarSecret} onChange={(e) => setNewVarSecret(e.target.checked)} />
          Secret
        </label>
        <button
          type="button"
          className="ghost-button"
          onClick={() => void onSave(newVarKey, newVarValue, newVarSecret)}
        >
          <Plus size={12} /> Add
        </button>
      </div>
    </div>
  );
}

export interface EnvironmentEditorModalProps {
  open: boolean;
  workspace: WorkspaceSummary | null;
  envEditorTarget: string;
  renamingEnvironment: string;
  environmentNameDraft: string;
  newVarKey: string;
  newVarValue: string;
  newVarSecret: boolean;

  onClose: () => void;
  onEnvEditorTargetChange: (name: string) => void;

  // Environment rename
  onRenameEnvironment: (name: string) => void;
  onApplyEnvironmentRename: (name: string) => Promise<void>;
  onCancelEnvironmentRename: () => void;
  onEnvironmentNameDraftChange: (value: string) => void;

  // Environment CRUD
  onCreateEnvironment: () => void;
  onDeleteEnvironment: (name: string) => void;
  onSetActiveEnvironment: (name: string) => void;

  // Variable CRUD
  onDeleteVariable: (envName: string, key: string) => void;
  onNewVarKeyChange: (value: string) => void;
  onNewVarValueChange: (value: string) => void;
  onNewVarSecretChange: (value: boolean) => void;
  onSaveVariable: (envName: string, key: string, value: string) => Promise<void>;
  onAddSecretVariable: (envName: string, key: string, value: string) => Promise<void>;
}

export function EnvironmentEditorModal({
  open,
  workspace,
  envEditorTarget,
  renamingEnvironment,
  environmentNameDraft,
  newVarKey,
  newVarValue,
  newVarSecret,
  onClose,
  onEnvEditorTargetChange,
  onRenameEnvironment,
  onApplyEnvironmentRename,
  onCancelEnvironmentRename,
  onEnvironmentNameDraftChange,
  onCreateEnvironment,
  onDeleteEnvironment,
  onSetActiveEnvironment,
  onDeleteVariable,
  onNewVarKeyChange,
  onNewVarValueChange,
  onNewVarSecretChange,
  onSaveVariable,
  onAddSecretVariable,
}: EnvironmentEditorModalProps) {
  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Environment editor"
      onClick={onClose}
    >
      <div className="modal env-modal" onClick={(e) => e.stopPropagation()}>
        <div className="env-modal-header">
          <div>
            <span className="env-modal-kicker">Workspace settings</span>
            <h2>Environments</h2>
            <p>Manage variables for request URLs, headers, auth, and scripts.</p>
          </div>
          <button
            type="button"
            className="env-modal-close"
            aria-label="Close environment editor"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="env-modal-body">
          <aside className="env-list-panel">
            <div className="env-section-label">Environments</div>
            {workspace?.environments.map((env) => (
              <div
                key={env.name}
                className={envEditorTarget === env.name ? "env-list-row selected" : "env-list-row"}
              >
                {renamingEnvironment === env.name ? (
                  <input
                    className="env-rename-input"
                    value={environmentNameDraft}
                    aria-label={`Rename ${env.name}`}
                    autoFocus
                    onChange={(event) => onEnvironmentNameDraftChange(event.target.value)}
                    onBlur={() => void onApplyEnvironmentRename(env.name)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        event.currentTarget.blur();
                      } else if (event.key === "Escape") {
                        event.preventDefault();
                        onCancelEnvironmentRename();
                      }
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => onEnvEditorTargetChange(env.name)}
                    className="env-list-button"
                  >
                    {env.name}
                    {workspace?.activeEnvironment === env.name && (
                      <span className="env-active-dot" aria-label="Active environment" />
                    )}
                  </button>
                )}
                <div className="env-row-actions">
                  <button type="button" className="env-icon-button" aria-label={`Rename ${env.name}`} onClick={() => onRenameEnvironment(env.name)}><Edit2 size={12} /></button>
                  <button type="button" className="env-icon-button danger" aria-label={`Delete ${env.name}`} onClick={() => onDeleteEnvironment(env.name)}><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="ghost-button env-wide-button"
              onClick={onCreateEnvironment}
            >
              <Plus size={12} /> New
            </button>
            {envEditorTarget && workspace?.activeEnvironment !== envEditorTarget && (
              <button
                type="button"
                className="ghost-button env-wide-button"
                onClick={() => onSetActiveEnvironment(envEditorTarget)}
              >
                Set active
              </button>
            )}
          </aside>

          <section className="env-variable-panel">
            {envEditorTarget ? (() => {
              const env = workspace?.environments.find((e) => e.name === envEditorTarget);
              if (!env) return null;
              return (
                <>
                  <div className="env-variable-header">
                    <span className="env-section-label">Variables</span>
                    <strong>{env.name}</strong>
                    <span>{env.variables.length} {env.variables.length === 1 ? "variable" : "variables"}</span>
                  </div>
                  <div className="env-variable-card">
                    {env.variables.map((v) => (
                      <div key={v.key} className="env-variable-row">
                        <span className="env-variable-key">{v.key}</span>
                        <span className={v.secret ? "env-variable-value secret" : "env-variable-value"}>
                          {v.secret ? "[secret stored outside SQLite]" : v.value}
                        </span>
                        {v.secret && <span className="env-secret-badge">Secret</span>}
                        <button type="button" className="env-icon-button danger" aria-label={`Delete variable ${v.key}`} onClick={() => onDeleteVariable(env.name, v.key)}><Trash2 size={12} /></button>
                      </div>
                    ))}
                    <AddVariableRow
                      newVarKey={newVarKey}
                      newVarValue={newVarValue}
                      newVarSecret={newVarSecret}
                      setNewVarKey={onNewVarKeyChange}
                      setNewVarValue={onNewVarValueChange}
                      setNewVarSecret={onNewVarSecretChange}
                      onSave={async (key, value, secret) => {
                        if (!key) return;
                        if (secret) {
                          await onAddSecretVariable(env.name, key, value);
                        } else {
                          await onSaveVariable(env.name, key, value);
                        }
                        onNewVarKeyChange("");
                        onNewVarValueChange("");
                        onNewVarSecretChange(false);
                      }}
                    />
                  </div>
                </>
              );
            })() : (
              <p className="env-empty-state">Select an environment to edit its variables.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
