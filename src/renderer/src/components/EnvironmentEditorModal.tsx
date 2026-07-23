import { Edit2, Plus, Trash2, X } from "lucide-react";
import type { WorkspaceSummary } from "../types";
import { EnvVariablesEditor } from "./EnvVariablesEditor";

export interface EnvironmentEditorModalProps {
  open: boolean;
  workspace: WorkspaceSummary | null;
  envEditorTarget: string;
  renamingEnvironment: string;
  environmentNameDraft: string;

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

  // Variable CRUD (kept for compat; bulk/inline handled inside EnvVariablesEditor)
  onDeleteVariable: (envName: string, key: string) => void;
  onNewVarKeyChange: (value: string) => void;
  onNewVarValueChange: (value: string) => void;
  onSaveVariable: (envName: string, key: string, value: string) => Promise<void>;
}

export function EnvironmentEditorModal({
  open,
  workspace,
  envEditorTarget,
  renamingEnvironment,
  environmentNameDraft,
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
  onSaveVariable,
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
                  </div>
                  <EnvVariablesEditor
                    envName={env.name}
                    variables={env.variables}
                    onSave={onSaveVariable}
                    onDelete={(envName, key) => { onDeleteVariable(envName, key); return Promise.resolve(); }}
                  />
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
