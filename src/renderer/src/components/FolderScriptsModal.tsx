import { X } from "lucide-react";
import { ScriptEditor } from "./ScriptEditor";
import type { EnvironmentVariable } from "../types";

export interface FolderScriptsModalProps {
  open: boolean;
  preScript: string;
  postScript: string;
  activeVars: EnvironmentVariable[];
  onClose: () => void;
  onPreScriptChange: (value: string) => void;
  onPostScriptChange: (value: string) => void;
  onSave: () => void;
}

export function FolderScriptsModal({
  open,
  preScript,
  postScript,
  activeVars,
  onClose,
  onPreScriptChange,
  onPostScriptChange,
  onSave,
}: FolderScriptsModalProps) {
  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Folder scripts"
      onClick={onClose}
    >
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "560px", maxWidth: "95vw", display: "flex", flexDirection: "column", gap: "16px" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: "16px" }}>Folder Scripts</h2>
          <button type="button" onClick={onClose} style={{ all: "unset", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "var(--color-text-active)" }} />
              Pre-request Script
            </label>
            <ScriptEditor
              value={preScript}
              onChange={onPreScriptChange}
              variables={activeVars.map((v) => v.key)}
              placeholder="// JavaScript only (no TypeScript types) to run before any request in this folder"
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "var(--color-text-active)" }} />
              Post-request Script
            </label>
            <ScriptEditor
              value={postScript}
              onChange={onPostScriptChange}
              variables={activeVars.map((v) => v.key)}
              placeholder="// JavaScript only (no TypeScript types) to run after any request in this folder"
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
