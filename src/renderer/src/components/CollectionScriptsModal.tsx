import { X } from "lucide-react";
import { ScriptEditor } from "./ScriptEditor";
import { ScopedVariablesEditor } from "./ScopedVariablesEditor";
import type { EnvironmentVariable, ScopedVariable, ScopedVariableEntityType } from "../types";

export interface CollectionScriptsModalProps {
  open: boolean;
  collectionId: string;
  collectionName: string;
  preScript: string;
  postScript: string;
  activeVars: EnvironmentVariable[];
  collectionVariables: ScopedVariable[];
  onClose: () => void;
  onPreScriptChange: (value: string) => void;
  onPostScriptChange: (value: string) => void;
  onSave: () => void;
  onSaveScopedVariable: (entityId: string, entityType: ScopedVariableEntityType, key: string, value: string) => Promise<void>;
  onDeleteScopedVariable: (entityId: string, entityType: ScopedVariableEntityType, key: string) => Promise<void>;
}

export function CollectionScriptsModal({
  open,
  collectionId,
  collectionName,
  preScript,
  postScript,
  activeVars,
  collectionVariables,
  onClose,
  onPreScriptChange,
  onPostScriptChange,
  onSave,
  onSaveScopedVariable,
  onDeleteScopedVariable,
}: CollectionScriptsModalProps) {
  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Collection editor"
      onClick={onClose}
    >
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "620px", maxWidth: "95vw", display: "flex", flexDirection: "column", gap: "16px" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ fontSize: "11px", color: "var(--color-text-muted)", display: "block", marginBottom: "2px" }}>Collection</span>
            <h2 style={{ margin: 0, fontSize: "16px" }}>{collectionName}</h2>
          </div>
          <button type="button" onClick={onClose} style={{ all: "unset", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Collection Variables */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "var(--color-accent)" }} />
              Collection Variables
            </label>
            <p style={{ fontSize: "11px", color: "var(--color-text-muted)", fontStyle: "italic", margin: 0 }}>
              Override environment variables for all requests in this collection. Folder and request variables take precedence.
            </p>
            <ScopedVariablesEditor
              entityId={collectionId}
              entityType="collection"
              variables={collectionVariables}
              onSave={onSaveScopedVariable}
              onDelete={onDeleteScopedVariable}
            />
          </div>

          {/* Pre-request Script */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "var(--color-text-active)" }} />
              Pre-request Script
            </label>
            <ScriptEditor
              value={preScript}
              onChange={onPreScriptChange}
              variables={activeVars.map((v) => v.key)}
              placeholder="// JavaScript only (no TypeScript types) to run before any request in this collection"
            />
          </div>

          {/* Post-request Script */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "var(--color-text-active)" }} />
              Post-request Script
            </label>
            <ScriptEditor
              value={postScript}
              onChange={onPostScriptChange}
              variables={activeVars.map((v) => v.key)}
              placeholder="// JavaScript only (no TypeScript types) to run after any request in this collection"
            />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button className="modal-cancel" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="modal-confirm" type="button" onClick={onSave}>
            Save Scripts
          </button>
        </div>
      </div>
    </div>
  );
}
