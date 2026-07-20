import { X } from "lucide-react";
import type { RequestCodeSnippetTarget } from "../services/script-tools";

export interface RequestCodeModalProps {
  open: boolean;
  codeSnippet: string;
  codeTarget: RequestCodeSnippetTarget;
  onClose: () => void;
  onTargetChange: (target: RequestCodeSnippetTarget) => void;
  onInsert: () => void;
}

export function RequestCodeModal({
  open,
  codeSnippet,
  codeTarget,
  onClose,
  onTargetChange,
  onInsert,
}: RequestCodeModalProps) {
  if (!open) return null;

  return (
    <div
      className="modal-overlay script-code-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Request code"
      onClick={onClose}
    >
      <div className="modal script-code-modal" onClick={(event) => event.stopPropagation()}>
        <div className="script-code-modal-header">
          <div>
            <span className="script-code-modal-kicker">Generated client</span>
            <h2>Request code</h2>
          </div>
          <button
            type="button"
            className="script-code-modal-close"
            aria-label="Close request code"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        <div className="script-code-modal-toolbar">
          <select
            className="script-tool-select"
            value={codeTarget}
            onChange={(event) => onTargetChange(event.target.value as RequestCodeSnippetTarget)}
            aria-label="Request code snippet target"
          >
            <option value="curl">cURL</option>
            <option value="fetch">Fetch</option>
            <option value="node">Node</option>
          </select>
          <button
            className="ghost-button script-tool-action"
            type="button"
            onClick={onInsert}
            aria-label="Insert request code snippet"
          >
            Insert into script
          </button>
        </div>
        <pre className="script-code-modal-preview">{codeSnippet}</pre>
      </div>
    </div>
  );
}
